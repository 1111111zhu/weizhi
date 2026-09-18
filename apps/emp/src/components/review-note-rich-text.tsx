"use client";

import {
  Button as MobileButton,
  ProjectWingTopBarAvatar,
  tokenizeReviewNoteInline,
  MobileActionSheet,
} from "@project-wing/ui";
import { Extension } from "@tiptap/core";
import type { ChainedCommands, Editor, JSONContent } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { StarterKit as TiptapStarterKit } from "@tiptap/starter-kit";
import {
  AtSign,
  Bold,
  ChevronDown,
  Code2,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  MoreHorizontal,
  Paperclip,
  Pilcrow,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import composerStyles from "./review-note-rich-text.module.css";

export { ReviewNoteRichText } from "@project-wing/ui";

export type ReviewNoteEditorCopy = {
  formattingToolbar: string;
  moreFormatting?: string;
  closeFormatting?: string;
  paragraph: string;
  heading2: string;
  heading3: string;
  bold: string;
  italic: string;
  underline: string;
  strikethrough: string;
  inlineCode: string;
  bulletList: string;
  numberedList: string;
  quote: string;
  mention: string;
  mentionSearch?: string;
  noSearchResults?: string;
  link: string;
  linkText?: string;
  linkAddress?: string;
  insertLink?: string;
  cancelLink?: string;
  invalidLink?: string;
  removeLink?: string;
  attachImage: string;
};

export type ReviewNoteMentionOption = {
  description?: string;
  id: string;
  label: string;
};

const EMPTY_REVIEW_NOTE_MENTION_OPTIONS: ReviewNoteMentionOption[] = [];

const SmartFormNodeIdExtension = Extension.create({
  name: "smartFormNodeIds",
  addGlobalAttributes() {
    return [
      {
        types: [
          "paragraph",
          "heading",
          "bulletList",
          "orderedList",
          "blockquote",
          "listItem",
        ],
        attributes: {
          smartFormNodeId: {
            default: null,
            parseHTML: (element) => element.dataset.smartFormNodeId,
            renderHTML: (attributes) =>
              attributes.smartFormNodeId
                ? {
                    "data-smart-form-node-id":
                      attributes.smartFormNodeId as string,
                  }
                : {},
          },
        },
      },
    ];
  },
});

export function ReviewNoteRichTextComposer({
  value,
  onChange,
  documentValue,
  onDocumentChange,
  ariaLabel,
  placeholder,
  disabled = false,
  copy,
  accept,
  allowImages = false,
  multiple = true,
  onFiles,
  onPaste,
  onKeyDown,
  allowedBlocks,
  allowedMarks,
  allowMention = true,
  removeEmptyStructuredBlockOnBackspace = false,
  mentionOptions = EMPTY_REVIEW_NOTE_MENTION_OPTIONS,
  className,
  editorClassName,
  presentation = "framed",
  overlayPlacement = "dialog",
  toolbarDensity = "full",
}: {
  value: string;
  onChange: (value: string) => void;
  documentValue?: JSONContent;
  onDocumentChange?: (document: JSONContent) => void;
  ariaLabel: string;
  placeholder: string;
  disabled?: boolean;
  copy: ReviewNoteEditorCopy;
  accept?: string;
  allowImages?: boolean;
  multiple?: boolean;
  onFiles?: (files: FileList | null) => void;
  onPaste?: (event: ClipboardEvent<HTMLElement>) => void;
  onKeyDown?: (event: globalThis.KeyboardEvent) => void;
  allowedBlocks?: (
    | "paragraph"
    | "heading2"
    | "heading3"
    | "bulletList"
    | "orderedList"
    | "blockquote"
  )[];
  allowedMarks?: (
    | "bold"
    | "italic"
    | "underline"
    | "strike"
    | "code"
    | "link"
  )[];
  allowMention?: boolean;
  removeEmptyStructuredBlockOnBackspace?: boolean;
  mentionOptions?: readonly ReviewNoteMentionOption[];
  className?: string;
  editorClassName?: string;
  presentation?: "framed" | "contextual" | "plain";
  overlayPlacement?: "dialog" | "bottom";
  toolbarDensity?: "full" | "compact";
}) {
  const [focused, setFocused] = useState(false);
  const blockCapabilities = allowedBlocks ?? [
    "paragraph",
    "heading2",
    "heading3",
    "bulletList",
    "orderedList",
    "blockquote",
  ];
  const markCapabilities = allowedMarks ?? [
    "bold",
    "italic",
    "underline",
    "strike",
    "code",
    "link",
  ];
  const allowsBlock = (block: (typeof blockCapabilities)[number]) =>
    blockCapabilities.includes(block);
  const allowsMark = (mark: (typeof markCapabilities)[number]) =>
    markCapabilities.includes(mark);
  const hasHeadingControls = allowsBlock("heading2") || allowsBlock("heading3");
  const hasMarkControls = markCapabilities.length > 0;
  const hasListControls =
    allowsBlock("bulletList") ||
    allowsBlock("orderedList") ||
    allowsBlock("blockquote");
  const hasEntityControls = allowImages || allowMention || allowsMark("link");
  const uploadInputId = useId();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const onDocumentChangeRef = useRef(onDocumentChange);
  const onPasteRef = useRef(onPaste);
  const onKeyDownRef = useRef(onKeyDown);
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const compactToolbar = toolbarDensity === "compact";
  const compactSelection = useRef<{
    from: number;
    to: number;
    storedMarks: Editor["state"]["storedMarks"];
  } | null>(null);
  const mentionSelection = useRef<{
    from: number;
    to: number;
    storedMarks: Editor["state"]["storedMarks"];
  } | null>(null);
  const afterCompactSheetClose = useRef<(() => void) | null>(null);
  const [linkText, setLinkText] = useState("");
  const [linkAddress, setLinkAddress] = useState("");
  const [editingLink, setEditingLink] = useState(false);
  const linkSelection = useRef({ from: 1, to: 1 });
  const normalizedLink = normalizeReviewNoteLink(linkAddress);
  const filteredMentionOptions = mentionOptions.filter((option) => {
    const query = mentionSearch.trim().toLocaleLowerCase();
    if (!query) {
      return true;
    }
    return [option.id, option.label, option.description]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(query);
  });
  useEffect(() => {
    onChangeRef.current = onChange;
    onDocumentChangeRef.current = onDocumentChange;
    onPasteRef.current = onPaste;
    onKeyDownRef.current = onKeyDown;
  }, [onChange, onDocumentChange, onKeyDown, onPaste]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      TiptapStarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          autolink: true,
          defaultProtocol: "https",
          openOnClick: false,
          HTMLAttributes: { class: "pw-text-link" },
        },
        trailingNode: removeEmptyStructuredBlockOnBackspace ? false : {},
      }),
      SmartFormNodeIdExtension,
      Placeholder.configure({ placeholder }),
    ],
    content: documentValue ?? reviewNoteMarkdownToDocument(value),
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        "aria-multiline": "true",
        role: "textbox",
        class:
          "tiptap min-h-full px-3 py-3 text-sm leading-6 text-foreground outline-none",
      },
      handleKeyDown: (view, event) => {
        onKeyDownRef.current?.(event);
        if (
          !event.defaultPrevented &&
          removeEmptyStructuredBlockOnBackspace &&
          event.key === "Backspace"
        ) {
          const { $from, empty } = view.state.selection;
          if (
            empty &&
            $from.parent.isTextblock &&
            $from.parent.content.size === 0 &&
            $from.parentOffset === 0
          ) {
            let targetDepth: number | undefined;
            let orderedListReplacement:
              | {
                  depth: number;
                  items: ReturnType<typeof $from.node>[];
                }
              | undefined;
            for (let depth = $from.depth - 1; depth >= 1; depth -= 1) {
              const node = $from.node(depth);
              if (node.type.name === "blockquote") {
                targetDepth = depth;
                break;
              }
              if (
                node.type.name === "listItem" &&
                node.childCount === 1 &&
                node.firstChild?.isTextblock &&
                node.firstChild.content.size === 0
              ) {
                const listDepth = depth - 1;
                const list = $from.node(listDepth);
                if (list.type.name === "orderedList") {
                  if (list.childCount === 1) {
                    targetDepth = listDepth;
                  } else {
                    const itemIndex = $from.index(listDepth);
                    const items = [];
                    for (let index = 0; index < list.childCount; index += 1) {
                      if (index !== itemIndex) {
                        items.push(list.child(index));
                      }
                    }
                    orderedListReplacement = { depth: listDepth, items };
                  }
                  break;
                }
              }
            }

            if (orderedListReplacement) {
              event.preventDefault();
              const list = $from.node(orderedListReplacement.depth);
              const transaction = view.state.tr.replaceWith(
                $from.before(orderedListReplacement.depth),
                $from.after(orderedListReplacement.depth),
                list.type.create(list.attrs, orderedListReplacement.items)
              );
              view.dispatch(transaction.scrollIntoView());
              return true;
            }

            if (targetDepth !== undefined) {
              event.preventDefault();
              const from = $from.before(targetDepth);
              const to = $from.after(targetDepth);
              const parent = $from.node(targetDepth - 1);
              const { paragraph } = view.state.schema.nodes;
              const needsWritableParagraph =
                parent.childCount === 1 &&
                (parent.type.name === "doc" || parent.type.name === "listItem");
              const transaction = needsWritableParagraph
                ? view.state.tr.replaceWith(from, to, paragraph.create())
                : view.state.tr.delete(from, to);
              view.dispatch(transaction.scrollIntoView());
              return true;
            }
          }
        }
        if (
          !event.defaultPrevented &&
          allowMention &&
          mentionOptions.length > 0 &&
          event.key === "@"
        ) {
          if (compactToolbar) {
            event.preventDefault();
            view.dispatch(view.state.tr.insertText("@"));
            const { from, to } = view.state.selection;
            compactSelection.current = {
              from,
              to,
              storedMarks: view.state.storedMarks,
            };
          } else {
            // ProseMirror inserts a typed trigger after handleKeyDown returns.
            // Save the post-insertion caret up front so opening the picker cannot
            // lose the trigger when focus moves to its search field.
            const { from } = view.state.selection;
            mentionSelection.current = {
              from: from + 1,
              to: from + 1,
              storedMarks: view.state.storedMarks,
            };
          }
          setMentionSearch("");
          setMentionMenuOpen(true);
        }
        return event.defaultPrevented;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const document = currentEditor.getJSON();
      if (onDocumentChangeRef.current) {
        onDocumentChangeRef.current(document);
      } else {
        onChangeRef.current(reviewNoteDocumentToMarkdown(document));
      }
    },
  });
  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      paragraph: currentEditor?.isActive("paragraph") ?? true,
      heading2: currentEditor?.isActive("heading", { level: 2 }) ?? false,
      heading3: currentEditor?.isActive("heading", { level: 3 }) ?? false,
      bold: currentEditor?.isActive("bold") ?? false,
      italic: currentEditor?.isActive("italic") ?? false,
      underline: currentEditor?.isActive("underline") ?? false,
      strike: currentEditor?.isActive("strike") ?? false,
      code: currentEditor?.isActive("code") ?? false,
      bulletList: currentEditor?.isActive("bulletList") ?? false,
      orderedList: currentEditor?.isActive("orderedList") ?? false,
      blockquote: currentEditor?.isActive("blockquote") ?? false,
      link: currentEditor?.isActive("link") ?? false,
    }),
  });

  useLayoutEffect(() => {
    if (!mentionMenuOpen || !editor || mentionSelection.current) {
      return;
    }
    const { from, to } = editor.state.selection;
    mentionSelection.current = {
      from,
      to,
      storedMarks: editor.state.storedMarks,
    };
  }, [editor, mentionMenuOpen, mentionSelection]);

  useEffect(() => {
    // Changing availability is not a content edit. Emitting an update here can
    // restore stale text immediately after a successful send clears the draft.
    editor?.setEditable(!disabled, false);
  }, [disabled, editor]);

  // Sync controlled content before another keystroke can reach the editor.
  // A passive effect can replay an older parent echo over newer local input.
  useLayoutEffect(() => {
    if (!editor) {
      return;
    }
    if (documentValue) {
      if (JSON.stringify(editor.getJSON()) === JSON.stringify(documentValue)) {
        return;
      }
      editor.commands.setContent(documentValue, { emitUpdate: false });
      return;
    }
    const currentValue = reviewNoteDocumentToMarkdown(editor.getJSON());
    if (currentValue === value) {
      return;
    }
    editor.commands.setContent(reviewNoteMarkdownToDocument(value), {
      emitUpdate: false,
    });
  }, [documentValue, editor, value]);

  const paragraphLabel = editorState?.heading2
    ? copy.heading2
    : editorState?.heading3
      ? copy.heading3
      : copy.paragraph;

  function rememberCompactSelection() {
    if (!editor) {
      return;
    }
    const { from, to } = editor.state.selection;
    compactSelection.current = {
      from,
      to,
      storedMarks: editor.state.storedMarks,
    };
  }

  function rememberMentionSelection() {
    if (!editor) {
      return;
    }
    const { from, to } = editor.state.selection;
    mentionSelection.current = {
      from,
      to,
      storedMarks: editor.state.storedMarks,
    };
  }

  function openMentionMenu() {
    rememberMentionSelection();
    setMentionSearch("");
    setMentionMenuOpen(true);
  }

  function closeMentionMenu(open: boolean) {
    setMentionMenuOpen(open);
    if (!open) {
      setMentionSearch("");
    }
  }

  function compactCommandChain() {
    if (!editor || disabled || !editor.isEditable) {
      return null;
    }
    const chain = editor.chain();
    const selection = compactSelection.current;
    if (selection) {
      const end = editor.state.doc.content.size;
      chain
        .setTextSelection({
          from: Math.min(selection.from, end),
          to: Math.min(selection.to, end),
        })
        .command(({ tr }) => {
          tr.setStoredMarks(selection.storedMarks);
          return true;
        });
    }
    return chain;
  }

  function completeCompactSheet(open: boolean) {
    if (open) {
      return;
    }
    // Wait until the sheet releases its focus trap. Restoring the old selection
    // after toggling a mark would clear that mark for the next typed character.
    const action = afterCompactSheetClose.current;
    afterCompactSheetClose.current = null;
    if (action) {
      action();
    } else {
      compactCommandChain()?.focus().run();
    }
    compactSelection.current = null;
  }

  function queueCompactFormat(
    command: (chain: ChainedCommands) => ChainedCommands
  ) {
    afterCompactSheetClose.current = () => {
      const chain = compactCommandChain();
      if (chain) {
        command(chain).focus().run();
      }
    };
    setFormatMenuOpen(false);
  }

  const compactFormatActions = [
    {
      enabled: allowsBlock("paragraph"),
      label: copy.paragraph,
      icon: <Pilcrow />,
      active: editorState?.paragraph,
      command: (chain: ChainedCommands) => chain.setParagraph(),
    },
    {
      enabled: allowsBlock("heading2"),
      label: copy.heading2,
      icon: <Heading2 />,
      active: editorState?.heading2,
      command: (chain: ChainedCommands) => chain.toggleHeading({ level: 2 }),
    },
    {
      enabled: allowsBlock("heading3"),
      label: copy.heading3,
      icon: <Heading3 />,
      active: editorState?.heading3,
      command: (chain: ChainedCommands) => chain.toggleHeading({ level: 3 }),
    },
    {
      enabled: allowsMark("strike"),
      label: copy.strikethrough,
      icon: <Strikethrough />,
      active: editorState?.strike,
      command: (chain: ChainedCommands) => chain.toggleStrike(),
    },
    {
      enabled: allowsMark("code"),
      label: copy.inlineCode,
      icon: <Code2 />,
      active: editorState?.code,
      command: (chain: ChainedCommands) => chain.toggleCode(),
    },
    {
      enabled: allowsBlock("bulletList"),
      label: copy.bulletList,
      icon: <List />,
      active: editorState?.bulletList,
      command: (chain: ChainedCommands) => chain.toggleBulletList(),
    },
    {
      enabled: allowsBlock("orderedList"),
      label: copy.numberedList,
      icon: <ListOrdered />,
      active: editorState?.orderedList,
      command: (chain: ChainedCommands) => chain.toggleOrderedList(),
    },
    {
      enabled: allowsBlock("blockquote"),
      label: copy.quote,
      icon: <Quote />,
      active: editorState?.blockquote,
      command: (chain: ChainedCommands) => chain.toggleBlockquote(),
    },
  ].filter((action) => action.enabled);

  function setLink() {
    if (!editor) {
      return;
    }
    editor.commands.extendMarkRange("link");
    const { from, to } = editor.state.selection;
    linkSelection.current = { from, to };
    setLinkText(editor.state.doc.textBetween(from, to, " "));
    setLinkAddress(
      (editor.getAttributes("link").href as string | undefined) ?? ""
    );
    setEditingLink(editor.isActive("link"));
    setLinkOpen(true);
  }

  function insertLink() {
    if (!editor || disabled || !normalizedLink) {
      return;
    }
    editor
      .chain()
      .focus()
      .setTextSelection(linkSelection.current)
      .insertContentAt(linkSelection.current, {
        type: "text",
        text: linkText.trim() || normalizedLink,
        marks: [
          {
            type: "link",
            attrs: {
              href: normalizedLink,
              target: "_blank",
              rel: "noopener noreferrer",
            },
          },
        ],
      })
      .command(({ tr }) => {
        tr.removeStoredMark(editor.schema.marks.link);
        return true;
      })
      .run();
    setLinkOpen(false);
  }

  function insertMention(option: ReviewNoteMentionOption) {
    if (!editor) {
      return;
    }
    const savedSelection = mentionSelection.current;
    const end = editor.state.doc.content.size;
    const from = Math.min(
      savedSelection?.from ?? editor.state.selection.from,
      end
    );
    const to = Math.min(savedSelection?.to ?? editor.state.selection.to, end);
    const position = from;
    const previousCharacter =
      position > 1
        ? editor.state.doc.textBetween(position - 1, position, "", "")
        : "";
    const chain = editor.chain().focus().setTextSelection({ from, to });
    if (savedSelection) {
      chain.command(({ tr }) => {
        tr.setStoredMarks(savedSelection.storedMarks);
        return true;
      });
    }
    if (previousCharacter === "@") {
      chain.deleteRange({ from: position - 1, to: position });
    }
    chain.insertContent(`@${option.label} `).run();
    mentionSelection.current = null;
    closeMentionMenu(false);
  }

  const linkFields = (
    <>
      <label className="grid gap-1.5">
        <span>{copy.linkText ?? "Display text"}</span>
        <Input
          value={linkText}
          onChange={(event) => setLinkText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              insertLink();
            }
          }}
        />
      </label>
      <label className="grid gap-1.5">
        <span>{copy.linkAddress ?? "Link address"}</span>
        <Input
          type="url"
          value={linkAddress}
          aria-invalid={Boolean(linkAddress.trim() && !normalizedLink)}
          onChange={(event) => setLinkAddress(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              insertLink();
            }
          }}
        />
        {linkAddress.trim() && !normalizedLink ? (
          <span className="text-xs text-destructive">
            {copy.invalidLink ?? "Enter a valid HTTP or HTTPS address."}
          </span>
        ) : null}
      </label>
      <div className="flex justify-end gap-2">
        {editingLink ? (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto"
            onClick={() => {
              editor
                ?.chain()
                .focus()
                .setTextSelection(linkSelection.current)
                .unsetLink()
                .run();
              setLinkOpen(false);
            }}
          >
            {copy.removeLink ?? "Remove link"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={() => setLinkOpen(false)}
        >
          {copy.cancelLink ?? "Cancel"}
        </Button>
        <Button
          type="button"
          disabled={disabled || !normalizedLink}
          onClick={insertLink}
        >
          {copy.insertLink ?? "Insert link"}
        </Button>
      </div>
    </>
  );

  return (
    <div
      data-slot="review-note-rich-text-composer"
      data-presentation={presentation}
      data-editing={
        focused ||
        linkOpen ||
        mentionMenuOpen ||
        blockMenuOpen ||
        formatMenuOpen
      }
      data-toolbar-density={toolbarDensity}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      }}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm shadow-foreground/5",
        presentation !== "framed" && composerStyles.contextual,
        className
      )}
    >
      <div
        role="toolbar"
        aria-label={copy.formattingToolbar}
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1 border-b border-border bg-background/80 px-2 py-1.5",
          compactToolbar && composerStyles.compactToolbar
        )}
      >
        {compactToolbar ? (
          <>
            {allowsMark("bold") ? (
              <CompactToolbarButton
                label={copy.bold}
                disabled={disabled}
                active={editorState?.bold}
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                <Bold />
              </CompactToolbarButton>
            ) : null}
            {allowsMark("italic") ? (
              <CompactToolbarButton
                label={copy.italic}
                disabled={disabled}
                active={editorState?.italic}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                <Italic />
              </CompactToolbarButton>
            ) : null}
            {allowsMark("underline") ? (
              <CompactToolbarButton
                label={copy.underline}
                disabled={disabled}
                active={editorState?.underline}
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
              >
                <Underline />
              </CompactToolbarButton>
            ) : null}
            {allowImages ? (
              <CompactToolbarButton
                label={copy.attachImage}
                disabled={disabled}
                onClick={() => uploadInputRef.current?.click()}
              >
                <Paperclip />
              </CompactToolbarButton>
            ) : null}
            {allowMention ? (
              <CompactToolbarButton
                label={copy.mention}
                disabled={disabled}
                opensSheet={mentionOptions.length > 0}
                expanded={mentionMenuOpen}
                onClick={() => {
                  if (mentionOptions.length > 0) {
                    rememberCompactSelection();
                    openMentionMenu();
                  } else {
                    editor?.chain().focus().insertContent("@").run();
                  }
                }}
              >
                <AtSign />
              </CompactToolbarButton>
            ) : null}
            {compactFormatActions.length > 0 || allowsMark("link") ? (
              <CompactToolbarButton
                label={copy.moreFormatting ?? "More formatting"}
                disabled={disabled}
                opensSheet
                expanded={formatMenuOpen}
                onClick={() => {
                  rememberCompactSelection();
                  setFormatMenuOpen(true);
                }}
              >
                <MoreHorizontal />
              </CompactToolbarButton>
            ) : null}
          </>
        ) : (
          <>
            {hasHeadingControls ? (
              overlayPlacement === "bottom" ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => setBlockMenuOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={blockMenuOpen}
                  >
                    {paragraphLabel}
                    <ChevronDown />
                  </Button>
                  <MobileActionSheet
                    open={blockMenuOpen}
                    onOpenChange={setBlockMenuOpen}
                    title={copy.formattingToolbar}
                    closeLabel={copy.cancelLink ?? "Close"}
                    onOpenChangeComplete={(open) => {
                      if (!open) {
                        editor?.commands.focus();
                      }
                    }}
                  >
                    {allowsBlock("paragraph") ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          editor?.chain().focus().setParagraph().run();
                          setBlockMenuOpen(false);
                        }}
                      >
                        <Pilcrow />
                        {copy.paragraph}
                      </Button>
                    ) : null}
                    {allowsBlock("heading2") ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          editor
                            ?.chain()
                            .focus()
                            .toggleHeading({ level: 2 })
                            .run();
                          setBlockMenuOpen(false);
                        }}
                      >
                        <Heading2 />
                        {copy.heading2}
                      </Button>
                    ) : null}
                    {allowsBlock("heading3") ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          editor
                            ?.chain()
                            .focus()
                            .toggleHeading({ level: 3 })
                            .run();
                          setBlockMenuOpen(false);
                        }}
                      >
                        <Heading3 />
                        {copy.heading3}
                      </Button>
                    ) : null}
                  </MobileActionSheet>
                </>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        className="min-w-28 justify-between font-normal"
                      />
                    }
                  >
                    <span>{paragraphLabel}</span>
                    <ChevronDown className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    {allowsBlock("paragraph") ? (
                      <DropdownMenuItem
                        onClick={() =>
                          editor?.chain().focus().setParagraph().run()
                        }
                      >
                        <Pilcrow />
                        {copy.paragraph}
                      </DropdownMenuItem>
                    ) : null}
                    {allowsBlock("heading2") ? (
                      <DropdownMenuItem
                        onClick={() =>
                          editor
                            ?.chain()
                            .focus()
                            .toggleHeading({ level: 2 })
                            .run()
                        }
                      >
                        <Heading2 />
                        {copy.heading2}
                      </DropdownMenuItem>
                    ) : null}
                    {allowsBlock("heading3") ? (
                      <DropdownMenuItem
                        onClick={() =>
                          editor
                            ?.chain()
                            .focus()
                            .toggleHeading({ level: 3 })
                            .run()
                        }
                      >
                        <Heading3 />
                        {copy.heading3}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            ) : null}

            {hasHeadingControls && hasMarkControls ? (
              <Separator orientation="vertical" className="mx-1 h-5" />
            ) : null}
            {hasMarkControls ? (
              <ButtonGroup>
                {allowsMark("bold") ? (
                  <ToolbarButton
                    label={copy.bold}
                    disabled={disabled}
                    active={editorState?.bold}
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                  >
                    <Bold />
                  </ToolbarButton>
                ) : null}
                {allowsMark("italic") ? (
                  <ToolbarButton
                    label={copy.italic}
                    disabled={disabled}
                    active={editorState?.italic}
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                  >
                    <Italic />
                  </ToolbarButton>
                ) : null}
                {allowsMark("underline") ? (
                  <ToolbarButton
                    label={copy.underline}
                    disabled={disabled}
                    active={editorState?.underline}
                    onClick={() =>
                      editor?.chain().focus().toggleUnderline().run()
                    }
                  >
                    <Underline />
                  </ToolbarButton>
                ) : null}
                {allowsMark("strike") ? (
                  <ToolbarButton
                    label={copy.strikethrough}
                    disabled={disabled}
                    active={editorState?.strike}
                    onClick={() => editor?.chain().focus().toggleStrike().run()}
                  >
                    <Strikethrough />
                  </ToolbarButton>
                ) : null}
                {allowsMark("code") ? (
                  <ToolbarButton
                    label={copy.inlineCode}
                    disabled={disabled}
                    active={editorState?.code}
                    onClick={() => editor?.chain().focus().toggleCode().run()}
                  >
                    <Code2 />
                  </ToolbarButton>
                ) : null}
              </ButtonGroup>
            ) : null}

            {(hasHeadingControls || hasMarkControls) && hasListControls ? (
              <Separator orientation="vertical" className="mx-1 h-5" />
            ) : null}
            {hasListControls ? (
              <ButtonGroup>
                {allowsBlock("bulletList") ? (
                  <ToolbarButton
                    label={copy.bulletList}
                    disabled={disabled}
                    active={editorState?.bulletList}
                    onClick={() =>
                      editor?.chain().focus().toggleBulletList().run()
                    }
                  >
                    <List />
                  </ToolbarButton>
                ) : null}
                {allowsBlock("orderedList") ? (
                  <ToolbarButton
                    label={copy.numberedList}
                    disabled={disabled}
                    active={editorState?.orderedList}
                    onClick={() =>
                      editor?.chain().focus().toggleOrderedList().run()
                    }
                  >
                    <ListOrdered />
                  </ToolbarButton>
                ) : null}
                {allowsBlock("blockquote") ? (
                  <ToolbarButton
                    label={copy.quote}
                    disabled={disabled}
                    active={editorState?.blockquote}
                    onClick={() =>
                      editor?.chain().focus().toggleBlockquote().run()
                    }
                  >
                    <Quote />
                  </ToolbarButton>
                ) : null}
              </ButtonGroup>
            ) : null}

            {(hasHeadingControls || hasMarkControls || hasListControls) &&
            hasEntityControls ? (
              <Separator orientation="vertical" className="mx-1 h-5" />
            ) : null}
            {hasEntityControls ? (
              <ButtonGroup>
                {allowImages ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <label
                          htmlFor={uploadInputId}
                          aria-label={copy.attachImage}
                          className={cn(
                            buttonVariants({
                              variant: "ghost",
                              size: "icon-sm",
                            }),
                            "cursor-pointer",
                            disabled && "pointer-events-none opacity-50"
                          )}
                        />
                      }
                    >
                      <Paperclip />
                      <span className="sr-only">{copy.attachImage}</span>
                      <Input
                        id={uploadInputId}
                        aria-label={copy.attachImage}
                        type="file"
                        accept={accept}
                        multiple={multiple}
                        className="hidden"
                        disabled={disabled}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => {
                          onFiles?.(event.currentTarget.files);
                          event.currentTarget.value = "";
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{copy.attachImage}</TooltipContent>
                  </Tooltip>
                ) : null}
                {allowMention && mentionOptions.length > 0 ? (
                  <DropdownMenu
                    open={mentionMenuOpen}
                    onOpenChange={closeMentionMenu}
                    onOpenChangeComplete={(open) => {
                      if (!open) {
                        editor?.commands.focus();
                      }
                    }}
                  >
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={copy.mention}
                          disabled={disabled}
                          onClick={openMentionMenu}
                        />
                      }
                    >
                      <AtSign />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-64 overflow-hidden"
                    >
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>{copy.mention}</DropdownMenuLabel>
                        <div className="px-2 pb-2">
                          <Input
                            type="search"
                            aria-label={copy.mentionSearch ?? "Search members"}
                            placeholder={copy.mentionSearch ?? "Search members"}
                            value={mentionSearch}
                            onChange={(event) =>
                              setMentionSearch(event.target.value)
                            }
                            onKeyDown={(event) => event.stopPropagation()}
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto">
                          {filteredMentionOptions.length > 0 ? (
                            filteredMentionOptions.map((option) => (
                              <DropdownMenuItem
                                className="items-start py-2"
                                key={option.id}
                                onClick={() => insertMention(option)}
                              >
                                <ProjectWingTopBarAvatar
                                  name={option.label}
                                  label={option.label}
                                  size="sm"
                                />
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">
                                    {option.label}
                                  </span>
                                  {option.description ? (
                                    <span className="block truncate text-xs text-muted-foreground">
                                      {option.description}
                                    </span>
                                  ) : null}
                                </span>
                              </DropdownMenuItem>
                            ))
                          ) : (
                            <DropdownMenuItem disabled>
                              {copy.noSearchResults ?? "No matching members"}
                            </DropdownMenuItem>
                          )}
                        </div>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : allowMention ? (
                  <ToolbarButton
                    label={copy.mention}
                    disabled={disabled}
                    onClick={() =>
                      editor?.chain().focus().insertContent("@").run()
                    }
                  >
                    <AtSign />
                  </ToolbarButton>
                ) : null}
                {allowsMark("link") ? (
                  <ToolbarButton
                    label={copy.link}
                    disabled={disabled}
                    active={editorState?.link}
                    onClick={setLink}
                  >
                    <Link2 />
                  </ToolbarButton>
                ) : null}
              </ButtonGroup>
            ) : null}
          </>
        )}
      </div>
      {compactToolbar ? (
        <>
          {allowImages ? (
            <Input
              ref={uploadInputRef}
              id={uploadInputId}
              aria-label={copy.attachImage}
              type="file"
              accept={accept}
              multiple={multiple}
              className="hidden"
              disabled={disabled}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                onFiles?.(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
          ) : null}
          <MobileActionSheet
            open={formatMenuOpen}
            onOpenChange={setFormatMenuOpen}
            title={copy.moreFormatting ?? "More formatting"}
            closeLabel={copy.closeFormatting ?? "Close formatting"}
            onOpenChangeComplete={completeCompactSheet}
          >
            <div className={composerStyles.formatGrid}>
              {compactFormatActions.map((action) => (
                <MobileButton
                  key={action.label}
                  variant="quiet"
                  className={composerStyles.formatAction}
                  aria-pressed={action.active}
                  disabled={disabled}
                  iconStart={action.icon}
                  onClick={() => queueCompactFormat(action.command)}
                >
                  {action.label}
                </MobileButton>
              ))}
              {allowsMark("link") ? (
                <MobileButton
                  variant="quiet"
                  className={composerStyles.formatAction}
                  aria-pressed={editorState?.link}
                  disabled={disabled}
                  iconStart={<Link2 />}
                  onClick={() => {
                    afterCompactSheetClose.current = () => {
                      if (compactCommandChain()?.run()) {
                        setLink();
                      }
                    };
                    setFormatMenuOpen(false);
                  }}
                >
                  {copy.link}
                </MobileButton>
              ) : null}
            </div>
          </MobileActionSheet>
          {allowMention && mentionOptions.length > 0 ? (
            <MobileActionSheet
              open={mentionMenuOpen}
              onOpenChange={closeMentionMenu}
              title={copy.mention}
              closeLabel={copy.closeFormatting ?? "Close formatting"}
              onOpenChangeComplete={completeCompactSheet}
            >
              <Input
                type="search"
                aria-label={copy.mentionSearch ?? "Search members"}
                placeholder={copy.mentionSearch ?? "Search members"}
                value={mentionSearch}
                onChange={(event) => setMentionSearch(event.target.value)}
              />
              <div className="max-h-[min(60vh,28rem)] overflow-y-auto">
                {filteredMentionOptions.length > 0 ? (
                  filteredMentionOptions.map((option) => (
                    <MobileButton
                      key={option.id}
                      variant="quiet"
                      disabled={disabled}
                      iconStart={
                        <ProjectWingTopBarAvatar
                          name={option.label}
                          label={option.label}
                          size="sm"
                        />
                      }
                      onClick={() => {
                        afterCompactSheetClose.current = () => {
                          if (compactCommandChain()?.run()) {
                            insertMention(option);
                          }
                        };
                        closeMentionMenu(false);
                      }}
                    >
                      <span className="block text-start">
                        <span className="block">{option.label}</span>
                        {option.description ? (
                          <span className="block text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                    </MobileButton>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    {copy.noSearchResults ?? "No matching members"}
                  </p>
                )}
              </div>
            </MobileActionSheet>
          ) : null}
        </>
      ) : null}
      {overlayPlacement === "bottom" ? (
        <MobileActionSheet
          open={linkOpen}
          onOpenChange={setLinkOpen}
          title={copy.insertLink ?? "Insert link"}
          closeLabel={copy.cancelLink ?? "Close"}
          onOpenChangeComplete={(open) => {
            if (!open) {
              editor?.commands.focus();
            }
          }}
        >
          {linkFields}
        </MobileActionSheet>
      ) : (
        <Dialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          onOpenChangeComplete={(open) => {
            if (!open) {
              editor?.commands.focus();
            }
          }}
        >
          <DialogContent
            className="sm:max-w-md"
            finalFocus={false}
            showCloseButton={false}
          >
            <DialogHeader>
              <DialogTitle>{copy.insertLink ?? "Insert link"}</DialogTitle>
            </DialogHeader>
            {linkFields}
          </DialogContent>
        </Dialog>
      )}
      <EditorContent
        data-review-note-editor
        editor={editor}
        className={cn(
          "min-h-32 flex-1 overflow-y-auto bg-transparent",
          "[&_.tiptap]:h-full [&_.tiptap]:min-h-32",
          "[&_.tiptap_h2]:mb-2 [&_.tiptap_h2]:text-lg [&_.tiptap_h2]:font-semibold",
          "[&_.tiptap_h3]:mb-1.5 [&_.tiptap_h3]:text-base [&_.tiptap_h3]:font-semibold",
          "[&_.tiptap_blockquote]:my-2 [&_.tiptap_blockquote]:border-l-2 [&_.tiptap_blockquote]:border-border [&_.tiptap_blockquote]:pl-3 [&_.tiptap_blockquote]:text-muted-foreground",
          "[&_.tiptap_ul]:my-2 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-6",
          "[&_.tiptap_ol]:my-2 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-6",
          "[&_.tiptap_code]:rounded [&_.tiptap_code]:bg-foreground/10 [&_.tiptap_code]:px-1 [&_.tiptap_code]:py-0.5 [&_.tiptap_code]:font-mono",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          editorClassName
        )}
        onPaste={(event) => onPasteRef.current?.(event)}
      />
    </div>
  );
}

function CompactToolbarButton({
  label,
  disabled,
  active,
  expanded,
  opensSheet = false,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  active?: boolean;
  expanded?: boolean;
  opensSheet?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <MobileButton
      variant="quiet"
      size="icon"
      aria-label={label}
      aria-pressed={active}
      aria-haspopup={opensSheet ? "dialog" : undefined}
      aria-expanded={opensSheet ? expanded : undefined}
      disabled={disabled}
      className={composerStyles.compactAction}
      iconStart={children}
      onPointerDown={(event) => event.preventDefault()}
      onClick={onClick}
    />
  );
}

function ToolbarButton({
  label,
  disabled,
  active = false,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant={active ? "default" : "ghost"}
            size="icon-sm"
            className={cn(
              active &&
                "bg-primary text-primary-foreground shadow-sm hover:bg-primary/85 hover:text-primary-foreground"
            )}
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function reviewNoteMarkdownToDocument(value: string): JSONContent {
  const lines = value.replaceAll(/\r\n?/g, "\n").split("\n");
  const content: JSONContent[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.startsWith("- ")) {
      const items: JSONContent[] = [];
      while (index < lines.length && lines[index]?.startsWith("- ")) {
        items.push({
          type: "listItem",
          content: [paragraphNode((lines[index] ?? "").slice(2))],
        });
        index += 1;
      }
      index -= 1;
      content.push({ type: "bulletList", content: items });
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: JSONContent[] = [];
      while (index < lines.length && /^\d+\.\s/.test(lines[index] ?? "")) {
        items.push({
          type: "listItem",
          content: [
            paragraphNode((lines[index] ?? "").replace(/^\d+\.\s/, "")),
          ],
        });
        index += 1;
      }
      index -= 1;
      content.push({ type: "orderedList", content: items });
      continue;
    }

    if (line.startsWith("### ")) {
      content.push({
        type: "heading",
        attrs: { level: 3 },
        content: parseReviewNoteInline(line.slice(4)),
      });
      continue;
    }
    if (line.startsWith("## ")) {
      content.push({
        type: "heading",
        attrs: { level: 2 },
        content: parseReviewNoteInline(line.slice(3)),
      });
      continue;
    }
    if (line.startsWith("> ")) {
      content.push({
        type: "blockquote",
        content: [paragraphNode(line.slice(2))],
      });
      continue;
    }
    content.push(paragraphNode(line));
  }

  return {
    type: "doc",
    content: content.length > 0 ? content : [paragraphNode("")],
  };
}

export function reviewNoteDocumentToMarkdown(document: JSONContent) {
  return (document.content ?? [])
    .map((node) => serializeReviewNoteBlock(node))
    .join("\n")
    .trimEnd();
}

function paragraphNode(value: string): JSONContent {
  const content = parseReviewNoteInline(value);
  return {
    type: "paragraph",
    ...(content.length > 0 ? { content } : {}),
  };
}

function parseReviewNoteInline(
  value: string,
  inheritedMarks: NonNullable<JSONContent["marks"]> = []
): JSONContent[] {
  return tokenizeReviewNoteInline(value).flatMap((token) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return parseReviewNoteInline(token.slice(2, -2), [
        ...inheritedMarks,
        { type: "bold" },
      ]);
    }
    if (token.startsWith("~~") && token.endsWith("~~")) {
      return parseReviewNoteInline(token.slice(2, -2), [
        ...inheritedMarks,
        { type: "strike" },
      ]);
    }
    if (token.startsWith("[u]") && token.endsWith("[/u]")) {
      return parseReviewNoteInline(token.slice(3, -4), [
        ...inheritedMarks,
        { type: "underline" },
      ]);
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return textNode(token.slice(1, -1), [
        ...inheritedMarks,
        { type: "code" },
      ]);
    }
    if (token.startsWith("_") && token.endsWith("_")) {
      return parseReviewNoteInline(token.slice(1, -1), [
        ...inheritedMarks,
        { type: "italic" },
      ]);
    }
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) {
      return parseReviewNoteInline(link[1], [
        ...inheritedMarks,
        { type: "link", attrs: { href: link[2] } },
      ]);
    }
    return textNode(token, inheritedMarks);
  });
}

function textNode(
  text: string,
  marks: NonNullable<JSONContent["marks"]>
): JSONContent[] {
  if (!text) {
    return [];
  }
  return [
    {
      type: "text",
      text,
      ...(marks.length > 0 ? { marks } : {}),
    },
  ];
}

function serializeReviewNoteBlock(node: JSONContent): string {
  if (node.type === "heading") {
    const level = node.attrs?.level === 3 ? "###" : "##";
    return `${level} ${serializeReviewNoteInline(node.content)}`;
  }
  if (node.type === "blockquote") {
    const body = (node.content ?? [])
      .map((child) => serializeReviewNoteBlock(child))
      .join("\n");
    return body
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    return (node.content ?? [])
      .map((item, index) => {
        const body = (item.content ?? [])
          .map((child) => serializeReviewNoteBlock(child))
          .join("\n");
        return `${node.type === "bulletList" ? "-" : `${index + 1}.`} ${body}`;
      })
      .join("\n");
  }
  if (node.type === "paragraph") {
    return serializeReviewNoteInline(node.content);
  }
  return serializeReviewNoteInline(node.content);
}

function serializeReviewNoteInline(content: JSONContent[] | undefined) {
  return (content ?? [])
    .map((node) => {
      if (node.type === "hardBreak") {
        return "\n";
      }
      if (node.type !== "text") {
        return serializeReviewNoteBlock(node);
      }
      let value = node.text ?? "";
      const markTypes = new Set((node.marks ?? []).map((mark) => mark.type));
      if (markTypes.has("code")) {
        value = `\`${value}\``;
      } else {
        if (markTypes.has("italic")) {
          value = `_${value}_`;
        }
        if (markTypes.has("bold")) {
          value = `**${value}**`;
        }
        if (markTypes.has("underline")) {
          value = `[u]${value}[/u]`;
        }
        if (markTypes.has("strike")) {
          value = `~~${value}~~`;
        }
      }
      const link = node.marks?.find((mark) => mark.type === "link");
      if (link?.attrs?.href) {
        value = `[${value}](${String(link.attrs.href)})`;
      }
      return value;
    })
    .join("");
}

function normalizeReviewNoteLink(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return null;
  }
  const href = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(href);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      url.hostname
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function reviewNotePlainText(value: string) {
  return value
    .replaceAll(/^#{2,3}\s/gm, "")
    .replaceAll(/^>\s/gm, "")
    .replaceAll(/^[-*]\s/gm, "")
    .replaceAll(/^\d+\.\s/gm, "")
    .replaceAll(/\*\*([^*]+)\*\*/g, "$1")
    .replaceAll(/~~([^~]+)~~/g, "$1")
    .replaceAll(/\[u\]([\s\S]*?)\[\/u\]/g, "$1")
    .replaceAll(/`([^`]+)`/g, "$1")
    .replaceAll(/_([^_]+)_/g, "$1")
    .replaceAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1")
    .trim();
}
