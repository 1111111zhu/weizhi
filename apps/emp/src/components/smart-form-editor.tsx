"use client";

import {
  STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY,
  compileSmartFormV2Definition,
} from "@project-wing/shared";
import type {
  SmartFormLocale,
  SmartFormPackage,
  SmartFormV2Response,
} from "@project-wing/shared";
import { FileCheck2, Maximize2, Minimize2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { cn } from "@/lib/utils";

import { SmartFormV2Editor } from "./smart-form-v2-editor";
import type {
  SmartFormV2EditorCopy,
  SmartFormV2ReferenceOption,
} from "./smart-form-v2-editor";
import { SmartFormV2Readonly } from "./smart-form-v2-readonly";
import type { SmartFormV2ReadonlyCopy } from "./smart-form-v2-readonly";
import type {
  SmartFormV2ReviewQuestionsConfig,
  SmartFormV2ReviewTarget,
} from "./smart-form-v2-review-questions";

const EMPTY_DEFAULT_ARRAY: never[] = [];

export type SmartFormEditorCopy = Partial<
  SmartFormV2EditorCopy & SmartFormV2ReadonlyCopy
> & {
  saving?: string;
  closeAndCheckIn?: string;
  discard?: string;
  reviewQuestionButtonLabel?: string;
  reviewQuestionBadgeLabel?: string;
  reviewMasterConflictTitle?: string;
  reviewMasterConflictDescription?: string;
  focusMode?: string;
  exitFocusMode?: string;
  masterMode?: string;
};

export type SmartFormWorkingPaperOption = {
  id?: string;
  workingPaperId?: string;
  code: string;
  title: string;
  path?: string;
  pathSegments?: string[];
};

export const defaultSmartFormEditorCopy: SmartFormEditorCopy = {
  saving: "Saving...",
  closeAndCheckIn: "Save as draft",
  discard: "Discard",
  reviewQuestionButtonLabel: "Add or view review questions",
  reviewQuestionBadgeLabel: "Q",
  reviewMasterConflictTitle: "Close the SmartForm currently being edited",
  reviewMasterConflictDescription:
    "The read-only review target will not replace the active Master or its unsaved changes.",
  focusMode: "Focus mode",
  exitFocusMode: "Exit focus mode",
  masterMode: "Master editing",
};

export function SmartFormEditor({
  busy = false,
  className,
  copy = defaultSmartFormEditorCopy,
  fileName,
  locale,
  mode,
  onClose,
  onDiscard,
  onReadOnlyClose,
  onSave,
  package: smartFormPackage,
  reviewQuestions,
  focusTarget,
  readOnlyCloseLabel = "Close",
  workingPaperOptions = EMPTY_DEFAULT_ARRAY,
}: {
  busy?: boolean;
  className?: string;
  copy?: SmartFormEditorCopy;
  fileName: string;
  locale: SmartFormLocale;
  mode: "MASTER" | "READ_ONLY";
  onClose?: (nextPackage: SmartFormPackage) => void;
  onDiscard?: () => void;
  onReadOnlyClose?: () => void;
  onSave?: (nextPackage: SmartFormPackage) => void | Promise<void>;
  package: SmartFormPackage;
  reviewQuestions?: SmartFormV2ReviewQuestionsConfig;
  focusTarget?: SmartFormV2ReviewTarget | null;
  readOnlyCloseLabel?: string;
  workingPaperOptions?: SmartFormWorkingPaperOption[];
}) {
  const definition = useMemo(
    () =>
      compileSmartFormV2Definition(
        smartFormPackage.definition,
        STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
      ),
    [smartFormPackage.definition]
  );
  const editorCopy = { ...DEFAULT_EDITOR_COPY, ...copy };
  const readonlyCopy = { ...DEFAULT_READONLY_COPY, ...copy };
  const referenceOptions: SmartFormV2ReferenceOption[] = workingPaperOptions
    .map((option) => ({
      targetType: "projectWing.workingPaper",
      targetId: option.id ?? option.workingPaperId ?? "",
      label: [option.code, option.title].filter(Boolean).join(" "),
      code: option.code,
      title: option.title,
      path: option.path,
      pathSegments: option.pathSegments,
    }))
    .filter((option) => Boolean(option.targetId));

  function packageWithResponse(response: SmartFormV2Response) {
    return {
      ...smartFormPackage,
      response,
      updatedAt: response.updatedAt,
    };
  }
  const latestResponseRef = useRef(smartFormPackage.response);
  const [focusMode, setFocusMode] = useState(false);

  return (
    <section
      aria-label={fileName}
      className={cn(
        "flex h-full min-h-0 flex-col",
        focusMode
          ? "fixed inset-0 z-50 bg-background"
          : "overflow-hidden rounded-lg border border-border/70 bg-muted/30",
        className
      )}
    >
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border/70 bg-card/95 px-4 py-2 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <FileCheck2 className="size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {fileName}
            </p>
            <p className="text-xs text-muted-foreground">
              {mode === "MASTER"
                ? (copy.masterMode ?? "Master editing")
                : readonlyCopy.readOnly}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {busy ? (
            <span className="text-xs text-muted-foreground">
              {copy.saving ?? "Saving..."}
            </span>
          ) : null}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={
              focusMode
                ? (copy.exitFocusMode ?? "Exit focus mode")
                : (copy.focusMode ?? "Focus mode")
            }
            tooltip={
              focusMode
                ? (copy.exitFocusMode ?? "Exit focus mode")
                : (copy.focusMode ?? "Focus mode")
            }
            onClick={() => setFocusMode((current) => !current)}
          >
            {focusMode ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </Button>
          {mode === "MASTER" ? (
            <ButtonGroup>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onDiscard?.()}
              >
                {copy.discard ?? "Discard"}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  onClose?.(packageWithResponse(latestResponseRef.current))
                }
              >
                {copy.closeAndCheckIn ?? "Save as draft"}
              </Button>
            </ButtonGroup>
          ) : (
            <Button type="button" size="sm" onClick={onReadOnlyClose}>
              {readOnlyCloseLabel}
            </Button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-transparent p-2 md:p-3">
        {mode === "MASTER" ? (
          <SmartFormV2Editor
            definition={definition}
            initialResponse={smartFormPackage.response}
            locale={locale}
            copy={editorCopy}
            referenceOptions={referenceOptions}
            reviewQuestions={reviewQuestions}
            focusTarget={focusTarget}
            onChange={(response) => {
              latestResponseRef.current = response;
            }}
            onSave={(response) => onSave?.(packageWithResponse(response))}
          />
        ) : (
          <SmartFormV2Readonly
            definition={definition}
            response={smartFormPackage.response}
            locale={locale}
            copy={readonlyCopy}
            reviewQuestions={reviewQuestions}
            focusTarget={focusTarget}
          />
        )}
      </div>
    </section>
  );
}

const DEFAULT_EDITOR_COPY: SmartFormV2EditorCopy = {
  editorLabel: "SmartForm V2",
  entryMode: "Entry",
  previewMode: "Preview",
  draft: "Draft",
  saved: "Saved",
  unsaved: "Unsaved changes",
  save: "Save",
  select: "Select",
  unselected: "Not selected",
  emptyValue: "Not provided",
  tableLabel: "SmartForm table",
  expand: "Expand",
  collapse: "Collapse",
  expandSection: "Expand section",
  collapseSection: "Collapse section",
  expansionControls: "Expansion controls",
  expandAll: "Expand all",
  collapseAll: "Collapse all",
  reset: "Reset",
  resetTitle: "Reset this SmartForm?",
  resetDescription:
    "This clears every response in the form and cannot be undone on this page.",
  cancelReset: "Cancel",
  confirmReset: "Reset form",
  addReference: "Add reference",
  searchReferences: "Search working papers",
  noReferences: "No matching working papers",
  removeReference: "Remove reference",
  editRichText: "Edit rich text",
  richTextPlaceholder: "Enter a response",
  uploadAttachment: "Upload attachment",
  removeAttachment: "Remove attachment",
  attachment: "Attachment",
  reference: "Reference",
  validationSummary: "Review {count} item(s).",
  requiredError: "This field is required.",
  invalidError: "This value is invalid.",
  required: "Required",
  optional: "Optional",
  structuredRichTextReadOnly: "Structured rich text is preserved read-only.",
  conditionPending: "Answer the branch question first",
  conditionMatched: "Condition matched",
  conditionOtherwise: "Otherwise",
  richText: {
    formattingToolbar: "Formatting",
    paragraph: "Paragraph",
    heading2: "Heading 2",
    heading3: "Heading 3",
    bold: "Bold",
    italic: "Italic",
    underline: "Underline",
    strikethrough: "Strikethrough",
    inlineCode: "Inline code",
    bulletList: "Bullet list",
    numberedList: "Numbered list",
    quote: "Quote",
    mention: "Mention",
    link: "Link",
    attachImage: "Attach image",
  },
};
const DEFAULT_READONLY_COPY: SmartFormV2ReadonlyCopy = {
  readOnly: "Read-only",
  schemaVersion: "Schema",
  emptyValue: "Not provided",
  unresolvedComponent: "This component could not be resolved.",
  attachment: "Attachment",
  reference: "Reference",
  tableLabel: "SmartForm table",
  expand: "Expand",
  collapse: "Collapse",
  expandSection: "Expand section",
  collapseSection: "Collapse section",
  expansionControls: "Expansion controls",
  expandAll: "Expand all",
  collapseAll: "Collapse all",
  conditionPending: "Answer the branch question first",
  conditionMatched: "Condition matched",
  conditionOtherwise: "Otherwise",
  required: "Required",
  optional: "Optional",
};
