"use client";

import type {
  SmartFormV2I18nConfig,
  SmartFormV2LocalizedRichText,
  SmartFormV2RichTextBlock,
  SmartFormV2RichTextDocument,
  SmartFormV2RichTextInline,
} from "@project-wing/shared";
import { MessageSquarePlus } from "lucide-react";
import { createContext, useContext, useEffect } from "react";
import type { RefObject } from "react";

import { Button } from "@/components/ui/button";

export type SmartFormV2ReviewTarget = {
  nodeId: string;
  rowId?: string;
  label: string;
};

export type SmartFormV2ReviewQuestionsConfig = {
  buttonLabel: string;
  getQuestionCount: (target: SmartFormV2ReviewTarget) => number;
  onOpen: (target: SmartFormV2ReviewTarget) => void;
};

const SmartFormV2ReviewQuestionsContext =
  createContext<SmartFormV2ReviewQuestionsConfig | null>(null);
const SmartFormV2ReviewTargetContext =
  createContext<SmartFormV2ReviewTarget | null>(null);

export const SmartFormV2ReviewQuestionsProvider =
  SmartFormV2ReviewQuestionsContext.Provider;
export const SmartFormV2ReviewTargetProvider =
  SmartFormV2ReviewTargetContext.Provider;

export function useSmartFormV2ReviewTarget() {
  return useContext(SmartFormV2ReviewTargetContext);
}

type SmartFormV2ReviewTargetTreeNode = {
  id: string;
  kind: string;
  children?: readonly SmartFormV2ReviewTargetTreeNode[];
  branchQuestion?: SmartFormV2ReviewTargetTreeNode;
  branches?: readonly {
    children?: readonly SmartFormV2ReviewTargetTreeNode[];
  }[];
  otherwise?: { children?: readonly SmartFormV2ReviewTargetTreeNode[] };
};

export function smartFormV2NodeContainsReviewTarget(
  node: SmartFormV2ReviewTargetTreeNode,
  target: SmartFormV2ReviewTarget | null
): boolean {
  if (!target) {
    return false;
  }
  if (node.id === target.nodeId) {
    return true;
  }
  if (node.branchQuestion?.id === target.nodeId) {
    return true;
  }
  if (node.kind === "conditional") {
    return [
      ...(node.branches ?? []).flatMap((branch) => branch.children ?? []),
      ...(node.otherwise?.children ?? []),
    ].some((child) => smartFormV2NodeContainsReviewTarget(child, target));
  }
  if (node.kind !== "section" && node.kind !== "group") {
    return false;
  }
  return (node.children ?? []).some((child) =>
    smartFormV2NodeContainsReviewTarget(child, target)
  );
}

export function useSmartFormV2ReviewTargetFocus({
  rootRef,
  target,
  expandAll,
}: {
  rootRef: RefObject<HTMLElement | null>;
  target?: SmartFormV2ReviewTarget | null;
  expandAll: () => void;
}) {
  useEffect(() => {
    if (!target) {
      return;
    }
    expandAll();
    let focusedElement: HTMLElement | null = null;
    const timer = window.setTimeout(() => {
      const root = rootRef.current;
      if (!root) {
        return;
      }
      const candidates = [
        ...root.querySelectorAll<HTMLElement>("[data-smart-form-node-id]"),
      ].filter(
        (candidate) =>
          candidate.dataset.smartFormNodeId === target.nodeId &&
          (target.rowId
            ? candidate.dataset.smartFormRowId === target.rowId
            : candidate.dataset.smartFormRowId === undefined)
      );
      // Desktop table and mobile records share identity, but only one is visible.
      focusedElement =
        candidates.find((candidate) => candidate.getClientRects().length > 0) ??
        candidates[0] ??
        null;
      if (!focusedElement) {
        return;
      }
      focusedElement.classList.add("smart-form-v2-review-target");
      focusedElement.scrollIntoView?.({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
    return () => {
      window.clearTimeout(timer);
      focusedElement?.classList.remove("smart-form-v2-review-target");
    };
  }, [expandAll, rootRef, target]);
}

export function SmartFormV2ReviewQuestionButton({
  target,
}: {
  target: SmartFormV2ReviewTarget;
}) {
  const config = useContext(SmartFormV2ReviewQuestionsContext);
  if (!config) {
    return null;
  }
  const count = config.getQuestionCount(target);

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="ms-auto h-6 shrink-0 gap-1 rounded-md px-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
      aria-label={`${config.buttonLabel}: ${target.label}`}
      onClick={() => config.onOpen(target)}
    >
      <MessageSquarePlus className="size-3.5" />
      {count > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-center text-[0.625rem] leading-none font-bold text-primary-foreground tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Button>
  );
}

export function smartFormV2LocalizedPlainText(
  value: SmartFormV2LocalizedRichText,
  locale: string,
  i18n: SmartFormV2I18nConfig
) {
  const candidates = [
    locale,
    ...(i18n.fallbackLocales?.[locale] ?? []),
    i18n.defaultLocale,
    ...i18n.supportedLocales,
  ];
  let document: SmartFormV2RichTextDocument | undefined;
  for (const candidate of candidates) {
    document = value.values[candidate];
    if (document) {
      break;
    }
  }
  document ??= Object.values(value.values)[0];
  return document ? richTextDocumentPlainText(document) : "SmartForm item";
}

function richTextDocumentPlainText(document: SmartFormV2RichTextDocument) {
  return document.content.map(richTextBlockPlainText).filter(Boolean).join(" ");
}

function richTextBlockPlainText(block: SmartFormV2RichTextBlock): string {
  if (block.type === "paragraph" || block.type === "heading") {
    return block.content.map(richTextInlinePlainText).join("");
  }
  if (block.type === "bulletList" || block.type === "orderedList") {
    return block.items
      .flatMap((item) => item.content.map(richTextBlockPlainText))
      .filter(Boolean)
      .join(" ");
  }
  if (block.type === "blockquote") {
    return block.content.map(richTextBlockPlainText).filter(Boolean).join(" ");
  }
  if (block.type === "table") {
    return block.rows
      .flatMap((row) =>
        row.cells.flatMap((cell) => cell.content.map(richTextBlockPlainText))
      )
      .filter(Boolean)
      .join(" ");
  }
  if (block.type === "embed") {
    return block.labelSnapshot ?? block.entityId;
  }
  return "";
}

function richTextInlinePlainText(inline: SmartFormV2RichTextInline) {
  if (inline.type === "text") {
    return inline.text;
  }
  if (inline.type === "hardBreak") {
    return " ";
  }
  return inline.labelSnapshot ?? inline.entityId;
}
