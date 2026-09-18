"use client";

import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Dropdown,
  Field,
  Input,
  Option,
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
} from "@fluentui/react-components";
import {
  ArrowRedo20Regular,
  ArrowUndo20Regular,
  Attach20Regular,
  DocumentAdd20Regular,
  LineHorizontal120Regular,
  Link20Regular,
  Megaphone20Regular,
  TextBold20Regular,
  TextBulletListLtr20Regular,
  TextHeader120Regular,
  TextHeader220Regular,
  TextHeader320Regular,
  TextItalic20Regular,
  TextNumberListLtr20Regular,
  TextParagraph20Regular,
  TextQuote20Regular,
} from "@fluentui/react-icons";
import {
  projectWingToast,
  ViewSwitcher,
  useCompactViewport,
  useMobileKeyboardViewport,
} from "@project-wing/ui";
import { Placeholder } from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { KnowledgeAttachment } from "@/components/knowledge-attachment";
import {
  formatAttachmentSize,
  getAttachmentKind,
} from "@/components/knowledge-attachment-utils";
import { Input as FileInput } from "@/components/ui/input";
import type { IntranetDictionary } from "@/i18n/dictionaries";
import {
  updateKnowledgeDocument,
  uploadKnowledgeDocument,
} from "@/lib/knowledge-api";
import { knowledgeCategories, knowledgeTypeIds } from "@/lib/knowledge-catalog";
import type {
  KnowledgeDepartment,
  KnowledgeItem,
  KnowledgeType,
} from "@/lib/knowledge-catalog";

type PublishKind = "FILE" | "NOTICE";
type ConcreteDepartment = Exclude<KnowledgeDepartment, "recent" | "all">;
type ConcreteType = Exclude<KnowledgeType, "all">;

export function KnowledgePublishDialog({
  copy,
  department: initialDepartment,
  kind,
  item,
  open: controlledOpen,
  onOpenChange,
  onPublished,
  secondaryCategory,
  tertiaryCategory,
}: {
  copy: IntranetDictionary;
  department?: ConcreteDepartment;
  kind: PublishKind;
  item?: KnowledgeItem;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onPublished: (item: KnowledgeItem) => void;
  secondaryCategory?: string;
  tertiaryCategory?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const mobile = useCompactViewport(767);
  const mobileSurface = useRef<HTMLDivElement>(null);
  useMobileKeyboardViewport(mobileSurface, mobile && open);
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };
  const [selectedDepartment, setSelectedDepartment] = useState<
    ConcreteDepartment | undefined
  >(item?.department ?? initialDepartment);
  const [selectedSecondary, setSelectedSecondary] = useState(
    item?.secondaryCategory ?? secondaryCategory
  );
  const [selectedTertiary, setSelectedTertiary] = useState(
    item?.tertiaryCategory ?? tertiaryCategory
  );
  const [referenceCode, setReferenceCode] = useState(item?.referenceCode ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [type, setType] = useState<ConcreteType>(item?.type ?? "guide");
  const [externalLink, setExternalLink] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const mobileLinkSurface = useRef<HTMLDivElement>(null);
  useMobileKeyboardViewport(mobileLinkSurface, mobile && linkPopoverOpen);
  const [linkSelection, setLinkSelection] = useState({ from: 0, to: 0 });
  const [file, setFile] = useState<File | null>(null);
  const [noticeFiles, setNoticeFiles] = useState<{ id: string; file: File }[]>(
    []
  );
  const [noticeBody, setNoticeBody] = useState("");
  const [historyAvailability, setHistoryAvailability] = useState({
    canRedo: false,
    canUndo: false,
  });
  const [previewAllowed, setPreviewAllowed] = useState(
    item?.previewAllowed ?? true
  );
  const [downloadAllowed, setDownloadAllowed] = useState(
    item?.downloadAllowed ?? kind === "FILE"
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    content: item?.body ?? "",
    editorProps: {
      attributes: {
        style: "min-height: 20rem; padding: 0.75rem; outline: none;",
      },
    },
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      KnowledgeAttachment.configure({
        removeLabel: copy.knowledge.notice.removeAttachment,
      }),
      Placeholder.configure({
        placeholder: copy.knowledge.notice.bodyPlaceholder,
      }),
    ],
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      setNoticeBody(currentEditor.getText());
      const clientIds = new Set<string>();
      currentEditor.state.doc.descendants((node) => {
        if (node.type.name === "knowledgeAttachment" && node.attrs.clientId) {
          clientIds.add(node.attrs.clientId as string);
        }
      });
      setNoticeFiles((current) =>
        current.filter(({ id }) => clientIds.has(id))
      );
    },
    onTransaction: ({ editor: currentEditor }) => {
      const nextAvailability = {
        canRedo: currentEditor.can().redo(),
        canUndo: currentEditor.can().undo(),
      };
      setHistoryAvailability((current) =>
        current.canRedo === nextAvailability.canRedo &&
        current.canUndo === nextAvailability.canUndo
          ? current
          : nextAvailability
      );
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    setReferenceCode(item?.referenceCode ?? "");
    setSelectedDepartment(item?.department ?? initialDepartment);
    setSelectedSecondary(item?.secondaryCategory ?? secondaryCategory);
    setSelectedTertiary(item?.tertiaryCategory ?? tertiaryCategory);
    setTitle(item?.title ?? "");
    setType(item?.type ?? "guide");
    setPreviewAllowed(item?.previewAllowed ?? true);
    setDownloadAllowed(item?.downloadAllowed ?? kind === "FILE");
    setFile(null);
    setNoticeFiles([]);
    editor?.commands.setContent(item?.body ?? "");
    setNoticeBody(editor?.getText() ?? "");
  }, [
    editor,
    initialDepartment,
    item,
    kind,
    open,
    secondaryCategory,
    tertiaryCategory,
  ]);

  const actionCopy =
    kind === "FILE" ? copy.knowledge.upload : copy.knowledge.notice;
  const selectedDepartmentCategories = selectedDepartment
    ? knowledgeCategories[selectedDepartment]
    : [];
  const selectedDirectory = selectedDepartmentCategories.find(
    (category) => category.id === selectedSecondary
  );
  const canSubmit = useMemo(() => {
    if (!title.trim() || !selectedDepartment || isPublishing) {
      return false;
    }
    if (kind === "FILE") {
      return Boolean(referenceCode.trim() && (file || item?.fileName));
    }
    return Boolean(
      noticeBody.trim() ||
      noticeFiles.length > 0 ||
      (item?.body && !editor?.isEmpty)
    );
  }, [
    editor?.isEmpty,
    file,
    noticeFiles.length,
    isPublishing,
    item,
    kind,
    noticeBody,
    referenceCode,
    selectedDepartment,
    title,
  ]);

  function reset() {
    setReferenceCode(item?.referenceCode ?? "");
    setSelectedDepartment(item?.department ?? initialDepartment);
    setSelectedSecondary(item?.secondaryCategory ?? secondaryCategory);
    setSelectedTertiary(item?.tertiaryCategory ?? tertiaryCategory);
    setTitle(item?.title ?? "");
    setType(item?.type ?? "guide");
    setExternalLink("");
    setLinkText("");
    setLinkPopoverOpen(false);
    setFile(null);
    setNoticeFiles([]);
    setNoticeBody("");
    setHistoryAvailability({ canRedo: false, canUndo: false });
    setPreviewAllowed(item?.previewAllowed ?? true);
    setDownloadAllowed(item?.downloadAllowed ?? kind === "FILE");
    editor?.commands.setContent(item?.body ?? "");
  }

  function openLinkEditor() {
    if (!editor) {
      return;
    }
    const { from, to } = editor.state.selection;
    setLinkSelection({ from, to });
    setLinkText(editor.state.doc.textBetween(from, to, " "));
    setExternalLink(editor.getAttributes("link").href ?? "");
    setLinkPopoverOpen(true);
  }

  function insertLink() {
    if (!editor || !externalLink.trim()) {
      return;
    }
    const rawHref = externalLink.trim();
    const href = /^[a-z][a-z\d+.-]*:/i.test(rawHref)
      ? rawHref
      : `https://${rawHref}`;
    const text = linkText.trim() || href;
    const chain = editor.chain().focus().setTextSelection(linkSelection);
    if (linkSelection.from === linkSelection.to) {
      chain
        .insertContentAt(linkSelection.from, {
          type: "text",
          text,
          marks: [{ type: "link", attrs: { href, target: "_blank" } }],
        })
        .run();
    } else {
      chain.setLink({ href, target: "_blank" }).run();
    }
    setLinkPopoverOpen(false);
    setLinkText("");
    setExternalLink("");
  }

  function insertAttachment(nextFile: File | null) {
    if (!nextFile || !editor) {
      return;
    }
    const clientId = crypto.randomUUID();
    setNoticeFiles((current) => [...current, { id: clientId, file: nextFile }]);
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "knowledgeAttachment",
          attrs: {
            fileKind: getAttachmentKind(nextFile.name),
            fileName: nextFile.name,
            fileSize: formatAttachmentSize(nextFile.size),
            clientId,
          },
        },
        { type: "paragraph" },
      ])
      .focus("end")
      .run();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !selectedDepartment) {
      return;
    }
    const body = new FormData();
    body.set("kind", kind);
    body.set("title", title.trim());
    body.set("department", selectedDepartment);
    body.set("type", type);
    body.set("secondaryCategory", selectedSecondary ?? "");
    body.set("tertiaryCategory", selectedTertiary ?? "");
    body.set("previewAllowed", String(previewAllowed));
    body.set("downloadAllowed", String(downloadAllowed));
    if (referenceCode.trim()) {
      body.set("referenceCode", referenceCode.trim());
    }
    if (kind === "NOTICE" && editor) {
      body.set("body", JSON.stringify(editor.getJSON()));
    }
    if (file) {
      body.set("file", file);
    }
    for (const attachment of noticeFiles) {
      body.append("attachments", attachment.file);
    }

    setIsPublishing(true);
    try {
      const savedItem = item?.id
        ? await updateKnowledgeDocument(item.id, body)
        : await uploadKnowledgeDocument(body);
      onPublished(savedItem);
      setOpen(false);
      reset();
    } catch {
      projectWingToast.error(copy.knowledge.upload.uploadError, {
        duration: 5000,
      });
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(_, data) => {
          setOpen(data.open);
          if (!data.open && !isPublishing) {
            reset();
          }
        }}
      >
        {controlledOpen === undefined ? (
          <DialogTrigger disableButtonEnhancement>
            <Button
              appearance="primary"
              aria-label={actionCopy.action}
              className="knowledge-pane-action"
              icon={
                kind === "FILE" ? (
                  <DocumentAdd20Regular />
                ) : (
                  <Megaphone20Regular />
                )
              }
              size="small"
            >
              <span className="knowledge-pane-action-label">
                {actionCopy.action}
              </span>
            </Button>
          </DialogTrigger>
        ) : (
          <span hidden />
        )}
        <DialogSurface
          ref={mobileSurface}
          data-responsive-dialog=""
          className={
            mobile
              ? "knowledge-publish-dialog-surface"
              : "knowledge-publish-dialog-surface !w-[min(80rem,calc(100vw-2rem))] !max-w-[min(80rem,calc(100vw-2rem))]"
          }
        >
          <form onSubmit={submit}>
            <DialogBody>
              <DialogTitle>
                {item ? copy.knowledge.manage.editTitle : actionCopy.title}
              </DialogTitle>
              <DialogContent className="knowledge-publish-content grid max-h-[calc(100vh-11rem)] gap-4 overflow-y-auto pt-2">
                <div className="grid grid-cols-[minmax(0,2fr)_minmax(12rem,1fr)_minmax(12rem,1fr)] gap-4">
                  <Field label={copy.knowledge.upload.itemTitle} required>
                    <Input
                      className="w-full"
                      value={title}
                      onChange={(_, data) => setTitle(data.value)}
                    />
                  </Field>
                  <Field label={copy.knowledge.upload.type} required>
                    {mobile ? (
                      <ViewSwitcher
                        mobilePresentation="sheet"
                        label={copy.knowledge.upload.type}
                        value={type}
                        options={knowledgeTypeIds.slice(1).map((value) => ({
                          value,
                          label: copy.types[value],
                        }))}
                        onValueChange={(value) =>
                          setType(value as ConcreteType)
                        }
                      />
                    ) : (
                      <Dropdown
                        className="w-full"
                        selectedOptions={[type]}
                        value={copy.types[type]}
                        onOptionSelect={(_, data) =>
                          data.optionValue &&
                          setType(data.optionValue as ConcreteType)
                        }
                      >
                        {knowledgeTypeIds.slice(1).map((knowledgeTypeId) => (
                          <Option key={knowledgeTypeId} value={knowledgeTypeId}>
                            {copy.types[knowledgeTypeId]}
                          </Option>
                        ))}
                      </Dropdown>
                    )}
                  </Field>
                  <Field
                    label={copy.knowledge.upload.referenceCode}
                    required={kind === "FILE"}
                  >
                    <Input
                      className="w-full"
                      placeholder={
                        copy.knowledge.upload.referenceCodePlaceholder
                      }
                      value={referenceCode}
                      onChange={(_, data) => setReferenceCode(data.value)}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Field label={copy.knowledge.manage.department} required>
                    {mobile ? (
                      <ViewSwitcher
                        mobilePresentation="sheet"
                        label={copy.knowledge.manage.department}
                        value={selectedDepartment ?? ""}
                        options={(
                          ["admin", "hr", "finance", "qm", "it"] as const
                        ).map((value) => ({
                          value,
                          label: copy.departments[value],
                        }))}
                        onValueChange={(value) => {
                          setSelectedDepartment(value as ConcreteDepartment);
                          setSelectedSecondary(undefined);
                          setSelectedTertiary(undefined);
                        }}
                      />
                    ) : (
                      <Dropdown
                        className="w-full"
                        placeholder={copy.knowledge.manage.department}
                        selectedOptions={
                          selectedDepartment ? [selectedDepartment] : []
                        }
                        value={
                          selectedDepartment
                            ? copy.departments[selectedDepartment]
                            : ""
                        }
                        onOptionSelect={(_, data) => {
                          if (!data.optionValue) {
                            return;
                          }
                          setSelectedDepartment(
                            data.optionValue as ConcreteDepartment
                          );
                          setSelectedSecondary(undefined);
                          setSelectedTertiary(undefined);
                        }}
                      >
                        {(["admin", "hr", "finance", "qm", "it"] as const).map(
                          (department) => (
                            <Option key={department} value={department}>
                              {copy.departments[department]}
                            </Option>
                          )
                        )}
                      </Dropdown>
                    )}
                  </Field>
                  <Field label={copy.knowledge.manage.directory}>
                    {mobile ? (
                      <ViewSwitcher
                        mobilePresentation="sheet"
                        label={copy.knowledge.manage.directory}
                        value={selectedSecondary ?? ""}
                        disabled={!selectedDepartment}
                        options={selectedDepartmentCategories.map(
                          (category) => ({
                            value: category.id,
                            label:
                              copy.knowledge.navigation.categoryLabels[
                                category.id
                              ] ?? category.id,
                          })
                        )}
                        onValueChange={(value) => {
                          setSelectedSecondary(value);
                          setSelectedTertiary(undefined);
                        }}
                      />
                    ) : (
                      <Dropdown
                        className="w-full"
                        disabled={!selectedDepartment}
                        placeholder={copy.knowledge.manage.directory}
                        selectedOptions={
                          selectedSecondary ? [selectedSecondary] : []
                        }
                        value={
                          selectedSecondary
                            ? (copy.knowledge.navigation.categoryLabels[
                                selectedSecondary
                              ] ?? selectedSecondary)
                            : ""
                        }
                        onOptionSelect={(_, data) => {
                          setSelectedSecondary(data.optionValue);
                          setSelectedTertiary(undefined);
                        }}
                      >
                        {selectedDepartmentCategories.map((category) => (
                          <Option key={category.id} value={category.id}>
                            {copy.knowledge.navigation.categoryLabels[
                              category.id
                            ] ?? category.id}
                          </Option>
                        ))}
                      </Dropdown>
                    )}
                  </Field>
                  <Field label={copy.knowledge.manage.subdirectory}>
                    {mobile ? (
                      <ViewSwitcher
                        mobilePresentation="sheet"
                        label={copy.knowledge.manage.subdirectory}
                        value={selectedTertiary ?? ""}
                        disabled={!selectedDirectory?.children?.length}
                        options={(selectedDirectory?.children ?? []).map(
                          (category) => ({
                            value: category.id,
                            label:
                              copy.knowledge.navigation.categoryLabels[
                                category.id
                              ] ?? category.id,
                          })
                        )}
                        onValueChange={setSelectedTertiary}
                      />
                    ) : (
                      <Dropdown
                        className="w-full"
                        disabled={!selectedDirectory?.children?.length}
                        placeholder={copy.knowledge.manage.subdirectory}
                        selectedOptions={
                          selectedTertiary ? [selectedTertiary] : []
                        }
                        value={
                          selectedTertiary
                            ? (copy.knowledge.navigation.categoryLabels[
                                selectedTertiary
                              ] ?? selectedTertiary)
                            : ""
                        }
                        onOptionSelect={(_, data) =>
                          setSelectedTertiary(data.optionValue)
                        }
                      >
                        {(selectedDirectory?.children ?? []).map((category) => (
                          <Option key={category.id} value={category.id}>
                            {copy.knowledge.navigation.categoryLabels[
                              category.id
                            ] ?? category.id}
                          </Option>
                        ))}
                      </Dropdown>
                    )}
                  </Field>
                </div>
                {kind === "NOTICE" ? (
                  <Field label={copy.knowledge.notice.body} required>
                    <div className="w-full overflow-hidden rounded-md border bg-background">
                      <Toolbar
                        className="knowledge-editor-toolbar flex flex-nowrap border-b bg-secondary/30 p-1"
                        size="small"
                        aria-label={copy.knowledge.notice.body}
                      >
                        <ToolbarButton
                          aria-label={copy.knowledge.notice.paragraph}
                          icon={<TextParagraph20Regular />}
                          onClick={() =>
                            editor?.chain().focus().setParagraph().run()
                          }
                          type="button"
                        />
                        <ToolbarButton
                          aria-label={copy.knowledge.notice.heading1}
                          icon={<TextHeader120Regular />}
                          onClick={() =>
                            editor
                              ?.chain()
                              .focus()
                              .toggleHeading({ level: 1 })
                              .run()
                          }
                          type="button"
                        />
                        <ToolbarButton
                          aria-label={copy.knowledge.notice.heading2}
                          icon={<TextHeader220Regular />}
                          onClick={() =>
                            editor
                              ?.chain()
                              .focus()
                              .toggleHeading({ level: 2 })
                              .run()
                          }
                          type="button"
                        />
                        <ToolbarButton
                          aria-label={copy.knowledge.notice.heading3}
                          icon={<TextHeader320Regular />}
                          onClick={() =>
                            editor
                              ?.chain()
                              .focus()
                              .toggleHeading({ level: 3 })
                              .run()
                          }
                          type="button"
                        />
                        <ToolbarDivider />
                        <ToolbarButton
                          aria-label={copy.knowledge.notice.bold}
                          icon={<TextBold20Regular />}
                          onClick={() =>
                            editor?.chain().focus().toggleBold().run()
                          }
                          type="button"
                        />
                        <ToolbarButton
                          aria-label={copy.knowledge.notice.italic}
                          icon={<TextItalic20Regular />}
                          onClick={() =>
                            editor?.chain().focus().toggleItalic().run()
                          }
                          type="button"
                        />
                        <ToolbarDivider />
                        <ToolbarButton
                          aria-label={copy.knowledge.notice.bulletList}
                          icon={<TextBulletListLtr20Regular />}
                          onClick={() =>
                            editor?.chain().focus().toggleBulletList().run()
                          }
                          type="button"
                        />
                        <ToolbarButton
                          aria-label={copy.knowledge.notice.orderedList}
                          icon={<TextNumberListLtr20Regular />}
                          onClick={() =>
                            editor?.chain().focus().toggleOrderedList().run()
                          }
                          type="button"
                        />
                        <ToolbarButton
                          aria-label={copy.knowledge.notice.quote}
                          icon={<TextQuote20Regular />}
                          onClick={() =>
                            editor?.chain().focus().toggleBlockquote().run()
                          }
                          type="button"
                        />
                        <ToolbarButton
                          aria-label={copy.knowledge.notice.horizontalRule}
                          icon={<LineHorizontal120Regular />}
                          onClick={() =>
                            editor?.chain().focus().setHorizontalRule().run()
                          }
                          type="button"
                        />
                        <ToolbarDivider />
                        <ToolbarButton
                          aria-label={copy.knowledge.notice.link}
                          icon={<Link20Regular />}
                          onClick={openLinkEditor}
                          title={copy.knowledge.notice.link}
                          type="button"
                        />
                        <FileInput
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                          className="hidden"
                          multiple
                          onChange={(event) =>
                            [...(event.currentTarget.files ?? [])].forEach(
                              insertAttachment
                            )
                          }
                          ref={fileInputRef}
                          type="file"
                        />
                        <ToolbarButton
                          aria-label={copy.knowledge.notice.attachment}
                          icon={<Attach20Regular />}
                          onClick={() => fileInputRef.current?.click()}
                          title={copy.knowledge.notice.attachment}
                          type="button"
                        />
                        <ToolbarDivider />
                        <ToolbarButton
                          aria-label={copy.knowledge.notice.undo}
                          disabled={!historyAvailability.canUndo}
                          icon={<ArrowUndo20Regular />}
                          onClick={() => editor?.chain().focus().undo().run()}
                          type="button"
                        />
                        <ToolbarButton
                          aria-label={copy.knowledge.notice.redo}
                          disabled={!historyAvailability.canRedo}
                          icon={<ArrowRedo20Regular />}
                          onClick={() => editor?.chain().focus().redo().run()}
                          type="button"
                        />
                      </Toolbar>
                      <EditorContent
                        className="knowledge-editor"
                        editor={editor}
                      />
                    </div>
                  </Field>
                ) : null}
                {kind === "FILE" ? (
                  <Field label={copy.knowledge.upload.file} required>
                    <FileInput
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      aria-label={copy.knowledge.upload.file}
                      type="file"
                      onChange={(event) =>
                        setFile(event.currentTarget.files?.[0] ?? null)
                      }
                    />
                  </Field>
                ) : null}
                <div className="flex flex-wrap gap-5">
                  <Checkbox
                    checked={previewAllowed}
                    label={copy.knowledge.actions.preview}
                    onChange={(_, data) =>
                      setPreviewAllowed(Boolean(data.checked))
                    }
                  />
                  <Checkbox
                    checked={downloadAllowed}
                    label={copy.knowledge.actions.download}
                    onChange={(_, data) =>
                      setDownloadAllowed(Boolean(data.checked))
                    }
                  />
                </div>
              </DialogContent>
              <DialogActions>
                <DialogTrigger disableButtonEnhancement>
                  <Button appearance="secondary">
                    {copy.knowledge.upload.cancel}
                  </Button>
                </DialogTrigger>
                <Button
                  appearance="primary"
                  disabled={!canSubmit}
                  type="submit"
                >
                  {isPublishing
                    ? kind === "FILE"
                      ? copy.knowledge.upload.uploading
                      : copy.knowledge.notice.publishing
                    : kind === "FILE"
                      ? copy.knowledge.upload.submit
                      : copy.knowledge.notice.submit}
                </Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>
      <Dialog
        open={linkPopoverOpen}
        onOpenChange={(_, data) => setLinkPopoverOpen(data.open)}
      >
        <DialogSurface
          ref={mobileLinkSurface}
          data-responsive-dialog=""
          className={mobile ? undefined : "!w-[min(34rem,calc(100vw-2rem))]"}
        >
          <DialogBody>
            <DialogTitle>{copy.knowledge.notice.link}</DialogTitle>
            <DialogContent className="grid gap-4 pt-3">
              <Field label={copy.knowledge.notice.linkText}>
                <Input
                  autoFocus
                  placeholder={copy.knowledge.notice.linkTextPlaceholder}
                  value={linkText}
                  onChange={(_, data) => setLinkText(data.value)}
                />
              </Field>
              <Field label={copy.knowledge.notice.link}>
                <Input
                  placeholder={copy.knowledge.notice.linkPlaceholder}
                  value={externalLink}
                  onChange={(_, data) => setExternalLink(data.value)}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setLinkPopoverOpen(false)}
                type="button"
              >
                {copy.knowledge.upload.cancel}
              </Button>
              <Button
                appearance="primary"
                disabled={!externalLink.trim()}
                onClick={insertLink}
                type="button"
              >
                {copy.knowledge.notice.confirmLink}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
