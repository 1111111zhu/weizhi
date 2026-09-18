"use client";

import type {
  SmartFormV2CompiledDefinition,
  SmartFormV2CoreNode,
  SmartFormV2FieldAnswer,
  SmartFormV2FieldDefinition,
  SmartFormV2FieldValue,
  SmartFormV2FixedSheetRow,
  SmartFormV2I18nConfig,
  SmartFormV2NumberingRule,
  SmartFormV2Response,
  SmartFormV2ResponseValidationIssue,
  SmartFormV2RichTextBlock,
  SmartFormV2RichTextDocument,
  SmartFormV2RichTextInline,
  SmartFormV2RichTextMark,
  SmartFormV2SheetLeafColumn,
  SmartFormV2SheetNode,
} from "@project-wing/shared";
import {
  isSmartFormV2ExpressionTrue,
  resolveSmartFormV2ConditionalBranch,
  smartFormV2FieldIssueKey,
  smartFormV2SheetCellIssueKey,
  validateSmartFormV2Response,
} from "@project-wing/shared";
import { MobileActionSheet } from "@project-wing/ui";
import type { JSONContent } from "@tiptap/core";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  CircleAlert,
  FileText,
  Folder,
  FolderOpen,
  Link2,
  Minus,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { Badge } from "@/components/extend/ui/badge";
import { Button } from "@/components/extend/ui/button";
import { Card } from "@/components/extend/ui/card";
import { Input } from "@/components/extend/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/extend/ui/select";
import {
  ReviewNoteRichTextComposer,
  reviewNoteDocumentToMarkdown,
  reviewNoteMarkdownToDocument,
} from "@/components/review-note-rich-text";
import {
  SmartFormV2ExpansionProvider,
  useSmartFormV2ExpansionCommand,
  useSmartFormV2MobileLayout,
  useSmartFormV2Viewport,
} from "@/components/smart-form-v2-expansion";
import {
  LocalizedRichText,
  FieldValue,
  RichTextDocument,
  resolveLocalized,
} from "@/components/smart-form-v2-readonly";
import {
  SmartFormV2ReviewQuestionButton,
  SmartFormV2ReviewQuestionsProvider,
  SmartFormV2ReviewTargetProvider,
  smartFormV2NodeContainsReviewTarget,
  useSmartFormV2ReviewTarget,
  useSmartFormV2ReviewTargetFocus,
} from "@/components/smart-form-v2-review-questions";
import type {
  SmartFormV2ReviewQuestionsConfig,
  SmartFormV2ReviewTarget,
} from "@/components/smart-form-v2-review-questions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { SmartFormV2MobileHeader } from "./smart-form-v2-mobile-header";
import type { SmartFormV2MobileHeaderConfig } from "./smart-form-v2-mobile-header";
import { SmartFormV2MobileRecords } from "./smart-form-v2-mobile-records";
import {
  mobileSheetLayout,
  projectMobileSheetColumns,
} from "./smart-form-v2-mobile-sheet";
import {
  isSmartFormV2FieldRequired,
  SmartFormV2RequiredIndicator,
} from "./smart-form-v2-required-indicator";

import mobileFormStyles from "./smart-form-v2-mobile-form.module.css";
import mobileInputStyles from "./smart-form-v2-mobile-input.module.css";
import mobileRecordStyles from "./smart-form-v2-mobile-records.module.css";
import tableStyles from "@/components/smart-form-v2-table.module.css";

const EMPTY_DEFAULT_ARRAY: never[] = [];

export type SmartFormV2EditorCopy = {
  editorLabel: string;
  entryMode: string;
  previewMode: string;
  draft: string;
  saved: string;
  unsaved: string;
  save: string;
  select: string;
  unselected: string;
  emptyValue: string;
  tableLabel: string;
  expand: string;
  collapse: string;
  expandSection: string;
  collapseSection: string;
  expansionControls: string;
  expandAll: string;
  collapseAll: string;
  reset: string;
  resetTitle: string;
  resetDescription: string;
  cancelReset: string;
  confirmReset: string;
  addReference: string;
  searchReferences: string;
  noReferences: string;
  removeReference: string;
  editRichText: string;
  editField?: string;
  closeEditor?: string;
  richTextPlaceholder: string;
  uploadAttachment: string;
  removeAttachment: string;
  attachment: string;
  reference: string;
  validationSummary: string;
  draftValidationSummary?: string;
  requiredError: string;
  invalidError: string;
  required: string;
  optional: string;
  structuredRichTextReadOnly: string;
  conditionPending: string;
  conditionMatched: string;
  conditionOtherwise: string;
  requiredProgress?: string;
  missingRequiredMessage?: string;
  requiredComplete?: string;
  expandFolder?: string;
  collapseFolder?: string;
  currentWorkingPaperCount?: string;
  richText: {
    formattingToolbar: string;
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
    link: string;
    attachImage: string;
  };
};

export type SmartFormV2ReferenceOption = {
  targetType: string;
  targetId: string;
  label: string;
  code?: string;
  title?: string;
  path?: string;
  pathSegments?: string[];
};

type SheetRowModel = {
  source: SmartFormV2FixedSheetRow;
  number: string;
  depth: number;
  order: number;
  children?: SheetRowModel[];
};

type ChangeAnswer = (answer: SmartFormV2FieldValue | undefined) => void;

const UNSELECTED_CHOICE_VALUE = "__smart-form-unselected__";

export function SmartFormV2Editor({
  definition,
  initialResponse,
  initialDraft,
  locale,
  copy,
  referenceOptions = EMPTY_DEFAULT_ARRAY,
  reviewQuestions,
  focusTarget,
  onSave,
  onChange,
  className,
  mobileHeader,
}: {
  definition: SmartFormV2CompiledDefinition;
  initialResponse?: SmartFormV2Response;
  /** Restores a local edit session without replacing its saved baseline. */
  initialDraft?: SmartFormV2Response;
  locale: string;
  copy: SmartFormV2EditorCopy;
  referenceOptions?: SmartFormV2ReferenceOption[];
  reviewQuestions?: SmartFormV2ReviewQuestionsConfig;
  focusTarget?: SmartFormV2ReviewTarget | null;
  onSave?: (response: SmartFormV2Response) => void | Promise<void>;
  onChange?: (response: SmartFormV2Response) => void;
  className?: string;
  mobileHeader?: SmartFormV2MobileHeaderConfig;
}) {
  const initial = useMemo(
    () => initialResponse ?? createEmptyResponse(definition, locale),
    [definition, initialResponse, locale]
  );
  const [draft, setDraft] = useState(initialDraft ?? initial);
  const [saved, setSaved] = useState(initial);
  const [validationIssues, setValidationIssues] = useState<
    SmartFormV2ResponseValidationIssue[]
  >([]);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const isMobile = useSmartFormV2MobileLayout();
  const [expansionCommand, setExpansionCommand] = useState({
    expanded: true,
    version: 0,
  });
  const documentRef = useRef<HTMLDivElement>(null);
  const issuesByKey = useMemo(
    () => new Map(validationIssues.map((issue) => [issue.key, issue])),
    [validationIssues]
  );
  const currentValidation = useMemo(
    () => validateSmartFormV2Response(definition, draft),
    [definition, draft]
  );
  const requiredTotal = useMemo(
    () => countRequiredSmartFormResponses(definition, draft),
    [definition, draft]
  );
  const missingRequired = currentValidation.success
    ? 0
    : currentValidation.issues.filter((issue) => issue.code === "required")
        .length;
  const requiredAnswered = Math.max(requiredTotal - missingRequired, 0);
  const requiredPercent =
    requiredTotal === 0 ? 100 : (requiredAnswered / requiredTotal) * 100;
  const draftFingerprint = useMemo(() => responseFingerprint(draft), [draft]);
  const savedFingerprint = useMemo(() => responseFingerprint(saved), [saved]);
  const dirty = draftFingerprint !== savedFingerprint;
  useEffect(() => {
    onChange?.(draft);
  }, [draft, onChange]);

  function updateField(
    fieldId: string,
    answerLocaleMode: "single" | "per-locale" | undefined,
    nextValue: SmartFormV2FieldValue | undefined
  ) {
    setValidationIssues((current) =>
      current.filter((issue) => issue.key !== smartFormV2FieldIssueKey(fieldId))
    );
    setDraft((current) => {
      const nextFields = { ...current.fields };
      const nextAnswer = mergeFieldAnswer(
        current.fields[fieldId],
        nextValue,
        locale,
        answerLocaleMode
      );
      if (nextAnswer) {
        nextFields[fieldId] = nextAnswer;
      } else {
        Reflect.deleteProperty(nextFields, fieldId);
      }
      return { ...current, fields: nextFields, responseLocale: locale };
    });
  }

  function updateSheetCell(
    sheetId: string,
    rowId: string,
    rowOrder: number,
    columnId: string,
    answerLocaleMode: "single" | "per-locale" | undefined,
    nextValue: SmartFormV2FieldValue | undefined
  ) {
    const issueKey = smartFormV2SheetCellIssueKey(sheetId, rowId, columnId);
    setValidationIssues((current) =>
      current.filter((issue) => issue.key !== issueKey)
    );
    setDraft((current) => {
      const currentSheet = current.sheets[sheetId] ?? { rows: [] };
      const rowIndex = currentSheet.rows.findIndex(
        (row) => (row.sourceRowId ?? row.id) === rowId
      );
      const currentRow =
        rowIndex === -1
          ? {
              id: `${rowId}-response`,
              sourceRowId: rowId,
              order: rowOrder,
              cells: {},
            }
          : currentSheet.rows[rowIndex];
      const nextCells = { ...currentRow.cells };
      const nextAnswer = mergeFieldAnswer(
        nextCells[columnId],
        nextValue,
        locale,
        answerLocaleMode
      );
      if (nextAnswer) {
        nextCells[columnId] = nextAnswer;
      } else {
        Reflect.deleteProperty(nextCells, columnId);
      }
      const nextRow = { ...currentRow, order: rowOrder, cells: nextCells };
      const nextRows = [...currentSheet.rows];
      if (rowIndex === -1) {
        nextRows.push(nextRow);
      } else {
        nextRows[rowIndex] = nextRow;
      }
      return {
        ...current,
        responseLocale: locale,
        sheets: {
          ...current.sheets,
          [sheetId]: { rows: nextRows.sort((a, b) => a.order - b.order) },
        },
      };
    });
  }

  async function saveDraft() {
    const next = { ...draft, updatedAt: new Date().toISOString() };
    const validation = validateSmartFormV2Response(definition, next);
    if (validation.success) {
      setValidationIssues([]);
    } else {
      setValidationIssues(validation.issues);
      if (
        validation.issues.some((issue) => issue.code === "invalid-response")
      ) {
        return;
      }
    }
    setDraft(next);
    setSaving(true);
    try {
      await onSave?.(next);
      setSaved(next);
    } catch {
      // The parent surface owns the visible API error. Keep the draft dirty so
      // The user can retry instead of presenting a failed request as saved.
    } finally {
      setSaving(false);
    }
  }

  const setAllExpanded = useCallback((expanded: boolean) => {
    setExpansionCommand((current) => ({
      expanded,
      version: current.version + 1,
    }));
  }, []);

  useSmartFormV2ReviewTargetFocus({
    rootRef: documentRef,
    target: focusTarget,
    expandAll: useCallback(() => setAllExpanded(true), [setAllExpanded]),
  });

  function resetDraft() {
    const next = createEmptyResponse(definition, locale);
    setDraft(next);
    setValidationIssues([]);
    setResetDialogOpen(false);
  }

  const resetControl = (
    <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-sm border-0 px-2.5 text-destructive shadow-none hover:bg-destructive/10 hover:text-destructive"
          />
        }
      >
        <RotateCcw className="size-3.5" />
        {copy.reset}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-destructive" />
            {copy.resetTitle}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {copy.resetDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{copy.cancelReset}</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            onClick={resetDraft}
          >
            <RotateCcw className="size-4" />
            {copy.confirmReset}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <SmartFormV2ExpansionProvider value={expansionCommand}>
      <SmartFormV2ReviewTargetProvider value={focusTarget ?? null}>
        <SmartFormV2ReviewQuestionsProvider value={reviewQuestions ?? null}>
          <div ref={documentRef} className="contents">
            <Card
              render={<form onSubmit={(event) => event.preventDefault()} />}
              className={cn(
                "smart-form-v2-document w-full overflow-hidden rounded-lg border-border/70 bg-card text-card-foreground shadow-none",
                mobileFormStyles.document,
                className
              )}
            >
              {isMobile ? (
                <SmartFormV2MobileHeader
                  title={
                    <LocalizedRichText
                      as="h1"
                      value={definition.title}
                      locale={locale}
                      i18n={definition.i18n}
                    />
                  }
                  config={mobileHeader}
                  actions={resetControl}
                  status={
                    <span
                      className={
                        missingRequired > 0
                          ? "text-warning-text"
                          : "text-success-text"
                      }
                    >
                      {formatSmartFormCopy(
                        copy.requiredProgress ??
                          "{answered}/{total} required responses complete",
                        { answered: requiredAnswered, total: requiredTotal }
                      )}
                    </span>
                  }
                />
              ) : (
                <header className="sticky top-0 z-20 border-b border-border/70 bg-card/95 px-4 py-3 backdrop-blur-sm md:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div
                      data-smart-form-document-title
                      className="min-w-0 flex-1"
                    >
                      <LocalizedRichText
                        as="h1"
                        value={definition.title}
                        locale={locale}
                        i18n={definition.i18n}
                        className="truncate text-xl font-semibold tracking-tight"
                      />
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate font-mono">
                          {definition.id}
                        </span>
                        <span className="border-s border-border ps-2">
                          {copy.draft}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <ButtonGroup
                        label={copy.editorLabel}
                        className="gap-0.5 rounded-md border border-border/70 bg-muted/30 p-0.5"
                      >
                        {isMobile ? null : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-sm border-0 px-2.5 text-muted-foreground shadow-none hover:text-foreground"
                            onClick={() => setAllExpanded(true)}
                          >
                            <ChevronsDown className="size-3.5" />
                            {copy.expandAll}
                          </Button>
                        )}
                        {isMobile ? null : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-sm border-0 px-2.5 text-muted-foreground shadow-none hover:text-foreground"
                            onClick={() => setAllExpanded(false)}
                          >
                            <ChevronsUp className="size-3.5" />
                            {copy.collapseAll}
                          </Button>
                        )}
                        {isMobile ? null : (
                          <ButtonGroupSeparator className="mx-0.5 my-1" />
                        )}
                        {resetControl}
                      </ButtonGroup>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-foreground">
                        {formatSmartFormCopy(
                          copy.requiredProgress ??
                            "{answered}/{total} required responses complete",
                          {
                            answered: requiredAnswered,
                            total: requiredTotal,
                          }
                        )}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5",
                          missingRequired > 0
                            ? "text-warning-text"
                            : "text-success"
                        )}
                      >
                        {missingRequired > 0 ? (
                          <CircleAlert className="size-3.5" />
                        ) : (
                          <CheckCircle2 className="size-3.5" />
                        )}
                        {missingRequired > 0
                          ? formatSmartFormCopy(
                              copy.missingRequiredMessage ??
                                "{count} required responses remaining",
                              { count: missingRequired }
                            )
                          : (copy.requiredComplete ??
                            "All required responses are complete")}
                      </span>
                    </div>
                    <Progress
                      className="h-1 rounded-none bg-muted"
                      label={formatSmartFormCopy(
                        copy.requiredProgress ??
                          "{answered}/{total} required responses complete",
                        {
                          answered: requiredAnswered,
                          total: requiredTotal,
                        }
                      )}
                      max={100}
                      value={requiredPercent}
                    />
                  </div>
                </header>
              )}

              <div className="divide-y divide-border/60 bg-card">
                {validationIssues.length > 0 ? (
                  <div
                    role="alert"
                    className="border-b border-destructive/20 bg-destructive/6 px-5 py-3 text-sm font-medium text-destructive md:px-8"
                  >
                    {(isMobile &&
                    !validationIssues.some(
                      (issue) => issue.code === "invalid-response"
                    )
                      ? (copy.draftValidationSummary ?? copy.validationSummary)
                      : copy.validationSummary
                    ).replace("{count}", String(validationIssues.length))}
                  </div>
                ) : null}
                {definition.children.map((node) => (
                  <EditableNode
                    key={node.id}
                    node={node}
                    formDefinition={definition}
                    depth={0}
                    locale={locale}
                    i18n={definition.i18n}
                    copy={copy}
                    response={draft}
                    issuesByKey={issuesByKey}
                    referenceOptions={referenceOptions}
                    onFieldChange={updateField}
                    onSheetCellChange={updateSheetCell}
                  />
                ))}
              </div>

              <footer className="sticky bottom-0 z-10 flex min-h-14 items-center justify-between gap-4 border-t border-border/70 bg-background/95 px-5 py-2.5 backdrop-blur-sm md:px-8">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {dirty ? (
                    <CircleAlert
                      aria-hidden="true"
                      className="size-4 text-warning-text"
                    />
                  ) : (
                    <CheckCircle2
                      aria-hidden="true"
                      className="size-4 text-success"
                    />
                  )}
                  {dirty ? copy.unsaved : copy.saved}
                </div>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={!dirty || saving}
                  onClick={() => saveDraft()}
                >
                  <Save className="size-4" />
                  {copy.save}
                </Button>
              </footer>
            </Card>
          </div>
        </SmartFormV2ReviewQuestionsProvider>
      </SmartFormV2ReviewTargetProvider>
    </SmartFormV2ExpansionProvider>
  );
}

function EditableNode({
  node,
  formDefinition,
  depth,
  locale,
  i18n,
  copy,
  response,
  issuesByKey,
  referenceOptions,
  onFieldChange,
  onSheetCellChange,
}: {
  node: SmartFormV2CoreNode;
  formDefinition: SmartFormV2CompiledDefinition;
  depth: number;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2EditorCopy;
  response: SmartFormV2Response;
  issuesByKey: Map<string, SmartFormV2ResponseValidationIssue>;
  referenceOptions: SmartFormV2ReferenceOption[];
  onFieldChange: (
    fieldId: string,
    answerLocaleMode: "single" | "per-locale" | undefined,
    value: SmartFormV2FieldValue | undefined
  ) => void;
  onSheetCellChange: (
    sheetId: string,
    rowId: string,
    rowOrder: number,
    columnId: string,
    answerLocaleMode: "single" | "per-locale" | undefined,
    value: SmartFormV2FieldValue | undefined
  ) => void;
}) {
  const reviewTarget = useSmartFormV2ReviewTarget();
  if (
    !smartFormV2NodeContainsReviewTarget(node, reviewTarget) &&
    !isSmartFormV2ExpressionTrue(formDefinition, response, node.visibleWhen)
  ) {
    return null;
  }
  switch (node.kind) {
    case "section": {
      return (
        <EditableSection
          node={node}
          formDefinition={formDefinition}
          depth={depth}
          locale={locale}
          i18n={i18n}
          copy={copy}
          response={response}
          issuesByKey={issuesByKey}
          referenceOptions={referenceOptions}
          onFieldChange={onFieldChange}
          onSheetCellChange={onSheetCellChange}
        />
      );
    }
    case "group": {
      return (
        <section className={cn("space-y-4", nodeDepthInsetClassName(depth))}>
          {node.title || node.description ? (
            <header>
              {node.title ? (
                <LocalizedRichText
                  as="h3"
                  value={node.title}
                  locale={locale}
                  i18n={i18n}
                  className="text-lg font-semibold tracking-tight"
                />
              ) : null}
              {node.description ? (
                <LocalizedRichText
                  value={node.description}
                  locale={locale}
                  i18n={i18n}
                  className="mt-1 text-sm leading-6 text-muted-foreground"
                />
              ) : null}
            </header>
          ) : null}
          {node.children.map((child) => (
            <EditableNode
              key={child.id}
              node={child}
              formDefinition={formDefinition}
              depth={depth + 1}
              locale={locale}
              i18n={i18n}
              copy={copy}
              response={response}
              issuesByKey={issuesByKey}
              referenceOptions={referenceOptions}
              onFieldChange={onFieldChange}
              onSheetCellChange={onSheetCellChange}
            />
          ))}
        </section>
      );
    }
    case "conditional": {
      return (
        <EditableConditional
          node={node}
          formDefinition={formDefinition}
          depth={depth}
          locale={locale}
          i18n={i18n}
          copy={copy}
          response={response}
          issuesByKey={issuesByKey}
          referenceOptions={referenceOptions}
          onFieldChange={onFieldChange}
          onSheetCellChange={onSheetCellChange}
        />
      );
    }
    case "content": {
      return (
        <EditableContent
          content={node.content}
          depth={depth}
          locale={locale}
          i18n={i18n}
          copy={copy}
        />
      );
    }
    case "field": {
      return (
        <div
          className={nodeContentInsetClassName(depth)}
          data-smart-form-node-id={node.id}
          data-smart-form-node-kind={node.kind}
        >
          <EditableField
            id={node.id}
            label={node.label}
            help={node.help}
            definition={node.value}
            answer={response.fields[node.id]}
            answerLocaleMode={node.answerLocaleMode}
            required={
              node.required ||
              (node.requiredWhen !== undefined &&
                isSmartFormV2ExpressionTrue(
                  formDefinition,
                  response,
                  node.requiredWhen
                ))
            }
            locale={locale}
            i18n={i18n}
            copy={copy}
            referenceOptions={referenceOptions}
            error={issuesByKey.get(smartFormV2FieldIssueKey(node.id))}
            onChange={(value) =>
              onFieldChange(node.id, node.answerLocaleMode, value)
            }
          />
        </div>
      );
    }
    case "sheet": {
      return (
        <EditableSheet
          sheet={node}
          formDefinition={formDefinition}
          depth={depth}
          locale={locale}
          i18n={i18n}
          copy={copy}
          response={response}
          issuesByKey={issuesByKey}
          referenceOptions={referenceOptions}
          onCellChange={onSheetCellChange}
        />
      );
    }
    default: {
      return null;
    }
  }
}

function EditableContent({
  content,
  depth,
  locale,
  i18n,
  copy,
}: {
  content: Extract<SmartFormV2CoreNode, { kind: "content" }>["content"];
  depth: number;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2EditorCopy;
}) {
  const expansionCommand = useSmartFormV2ExpansionCommand();
  const document = resolveLocalized(content, locale, i18n);
  const heading = document?.content[0];
  const hasHeading = heading?.type === "heading";
  const isMobile = useSmartFormV2MobileLayout();
  const [desktopExpanded, setDesktopExpanded] = useState(
    !hasHeading || depth > 0
  );
  const expanded = isMobile || desktopExpanded;
  const title = hasHeading
    ? richTextBlockPlainText(heading).join(" ")
    : copy.editorLabel;
  const body = document
    ? {
        ...document,
        content: hasHeading ? document.content.slice(1) : document.content,
      }
    : undefined;

  useEffect(() => {
    if (expansionCommand.version > 0) {
      setDesktopExpanded(expansionCommand.expanded);
    }
  }, [expansionCommand]);

  return (
    <section className={staticContentGutterClassName(depth)}>
      <div
        className={cn(
          "overflow-hidden rounded-md border border-border/70 bg-muted/20",
          mobileFormStyles.guidance
        )}
      >
        {isMobile ? (
          <h3 className="px-4 py-2 text-sm font-semibold">{title}</h3>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-full justify-between rounded-none px-4 font-semibold"
            aria-expanded={expanded}
            onClick={() => setDesktopExpanded((current) => !current)}
          >
            <span className="truncate">{title}</span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 transition-transform duration-[var(--motion-normal)]",
                expanded && "rotate-180"
              )}
            />
          </Button>
        )}
        {expanded && body && body.content.length > 0 ? (
          <div className="border-t border-border/60 px-4 py-3.5">
            <RichTextDocument
              document={body}
              className="space-y-2 text-sm leading-6 [&_ol]:my-0 [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_ul]:my-0 [&_ul]:space-y-1.5 [&_ul]:pl-5"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function EditableConditional({
  node,
  formDefinition,
  depth,
  locale,
  i18n,
  copy,
  response,
  issuesByKey,
  referenceOptions,
  onFieldChange,
  onSheetCellChange,
}: {
  node: Extract<SmartFormV2CoreNode, { kind: "conditional" }>;
  formDefinition: SmartFormV2CompiledDefinition;
  depth: number;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2EditorCopy;
  response: SmartFormV2Response;
  issuesByKey: Map<string, SmartFormV2ResponseValidationIssue>;
  referenceOptions: SmartFormV2ReferenceOption[];
  onFieldChange: (
    fieldId: string,
    answerLocaleMode: "single" | "per-locale" | undefined,
    value: SmartFormV2FieldValue | undefined
  ) => void;
  onSheetCellChange: (
    sheetId: string,
    rowId: string,
    rowOrder: number,
    columnId: string,
    answerLocaleMode: "single" | "per-locale" | undefined,
    value: SmartFormV2FieldValue | undefined
  ) => void;
}) {
  const branch = resolveSmartFormV2ConditionalBranch(
    formDefinition,
    response,
    node
  );
  const activeArm =
    branch.type === "branch"
      ? node.branches.find((candidate) => candidate.id === branch.branchId)
      : branch.type === "otherwise"
        ? node.otherwise
        : undefined;
  const activeChildren = activeArm?.children ?? [];

  return (
    <section
      data-smart-form-conditional-branch={
        branch.type === "pending" ? "pending" : branch.branchId
      }
      data-smart-form-node-id={node.id}
      data-smart-form-node-kind={node.kind}
    >
      <div className={nodeContentInsetClassName(depth)}>
        <EditableField
          id={node.branchQuestion.id}
          label={node.branchQuestion.label}
          help={node.branchQuestion.help}
          definition={node.branchQuestion.value}
          answer={response.fields[node.branchQuestion.id]}
          required={node.branchQuestion.required}
          locale={locale}
          i18n={i18n}
          copy={copy}
          referenceOptions={referenceOptions}
          error={issuesByKey.get(
            smartFormV2FieldIssueKey(node.branchQuestion.id)
          )}
          onChange={(value) =>
            onFieldChange(node.branchQuestion.id, undefined, value)
          }
        />
      </div>
      {activeChildren.length > 0 ? (
        <div className="mt-4 grid w-full gap-4 md:ms-6 md:mt-5 md:w-[calc(100%-1.5rem)] md:gap-5">
          {activeChildren.map((child) => (
            <EditableNode
              key={child.id}
              node={child}
              formDefinition={formDefinition}
              depth={depth}
              locale={locale}
              i18n={i18n}
              copy={copy}
              response={response}
              issuesByKey={issuesByKey}
              referenceOptions={referenceOptions}
              onFieldChange={onFieldChange}
              onSheetCellChange={onSheetCellChange}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function EditableSection({
  node,
  formDefinition,
  depth,
  locale,
  i18n,
  copy,
  response,
  issuesByKey,
  referenceOptions,
  onFieldChange,
  onSheetCellChange,
}: {
  node: Extract<SmartFormV2CoreNode, { kind: "section" }>;
  formDefinition: SmartFormV2CompiledDefinition;
  depth: number;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2EditorCopy;
  response: SmartFormV2Response;
  issuesByKey: Map<string, SmartFormV2ResponseValidationIssue>;
  referenceOptions: SmartFormV2ReferenceOption[];
  onFieldChange: (
    fieldId: string,
    answerLocaleMode: "single" | "per-locale" | undefined,
    value: SmartFormV2FieldValue | undefined
  ) => void;
  onSheetCellChange: (
    sheetId: string,
    rowId: string,
    rowOrder: number,
    columnId: string,
    answerLocaleMode: "single" | "per-locale" | undefined,
    value: SmartFormV2FieldValue | undefined
  ) => void;
}) {
  const isMobile = useSmartFormV2MobileLayout();
  const [desktopExpanded, setDesktopExpanded] = useState(true);
  const expanded = isMobile || desktopExpanded;
  const expansionCommand = useSmartFormV2ExpansionCommand();

  useEffect(() => {
    setDesktopExpanded(expansionCommand.expanded);
  }, [expansionCommand]);

  return (
    <section
      className={smartFormSectionClassName(depth)}
      data-smart-form-node-id={node.id}
      data-smart-form-node-kind={node.kind}
    >
      <header
        className={cn(
          "max-w-5xl",
          expanded && "mb-4 border-b border-border/70 pb-3"
        )}
      >
        <div className="flex items-start gap-2.5">
          {isMobile ? null : (
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              className={cn(
                "mt-0.5 size-6 shrink-0 rounded-md border-border bg-background shadow-none",
                tableStyles.headerInteractive
              )}
              aria-label={expanded ? copy.collapseSection : copy.expandSection}
              aria-expanded={expanded}
              onClick={() => setDesktopExpanded((current) => !current)}
            >
              {expanded ? (
                <Minus className="size-3.5" />
              ) : (
                <Plus className="size-3.5" />
              )}
            </Button>
          )}
          <LocalizedRichText
            as="h2"
            value={node.title}
            locale={locale}
            i18n={i18n}
            className={cn(
              "font-semibold tracking-tight",
              depth === 0 ? "text-lg" : "text-base"
            )}
          />
        </div>
        {expanded && node.description ? (
          <LocalizedRichText
            value={node.description}
            locale={locale}
            i18n={i18n}
            className="mt-1.5 text-sm leading-6 text-muted-foreground md:ps-9"
          />
        ) : null}
      </header>
      {expanded ? (
        <div className="space-y-4">
          {node.children.map((child) => (
            <EditableNode
              key={child.id}
              node={child}
              formDefinition={formDefinition}
              depth={depth + 1}
              locale={locale}
              i18n={i18n}
              copy={copy}
              response={response}
              issuesByKey={issuesByKey}
              referenceOptions={referenceOptions}
              onFieldChange={onFieldChange}
              onSheetCellChange={onSheetCellChange}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function EditableSheet({
  sheet,
  formDefinition,
  depth,
  locale,
  i18n,
  copy,
  response,
  issuesByKey,
  referenceOptions,
  onCellChange,
}: {
  sheet: SmartFormV2SheetNode;
  formDefinition: SmartFormV2CompiledDefinition;
  depth: number;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2EditorCopy;
  response: SmartFormV2Response;
  issuesByKey: Map<string, SmartFormV2ResponseValidationIssue>;
  referenceOptions: SmartFormV2ReferenceOption[];
  onCellChange: (
    sheetId: string,
    rowId: string,
    rowOrder: number,
    columnId: string,
    answerLocaleMode: "single" | "per-locale" | undefined,
    value: SmartFormV2FieldValue | undefined
  ) => void;
}) {
  const expansionCommand = useSmartFormV2ExpansionCommand();
  const viewport = useSmartFormV2Viewport();
  const isMobile = viewport === true;
  const [collapsedRows, setCollapsedRows] = useState<Set<string>>(() =>
    expansionCommand.expanded || sheet.rows.mode !== "fixed"
      ? new Set()
      : collectCollapsibleSheetRowIds(sheet.rows.items)
  );

  useEffect(() => {
    setCollapsedRows(
      expansionCommand.expanded || sheet.rows.mode !== "fixed"
        ? new Set()
        : collectCollapsibleSheetRowIds(sheet.rows.items)
    );
  }, [expansionCommand, sheet.rows]);

  const sheetAnswer = response.sheets[sheet.id];
  const answerRows = useMemo(
    () =>
      new Map(
        (sheetAnswer?.rows ?? []).map((row) => [row.sourceRowId ?? row.id, row])
      ),
    [sheetAnswer]
  );
  const rows = useMemo(
    () =>
      sheet.rows.mode === "fixed"
        ? buildSheetRows(sheet.rows.items, sheet.rows.numbering)
        : [],
    [sheet.rows]
  );
  const visibleRows = useMemo(
    () =>
      flattenVisibleRows(rows, isMobile ? new Set<string>() : collapsedRows),
    [rows, isMobile, collapsedRows]
  );
  const projectedColumns = useMemo(
    () => projectMobileSheetColumns(sheet.columns),
    [sheet.columns]
  );
  const columns = useMemo(
    () => projectedColumns.map(({ column }) => column),
    [projectedColumns]
  );
  // Mount only the active projection: CSS-hidden editors still render on every keystroke.
  const recordLayout = mobileSheetLayout(sheet) === "records";
  const showMobileRecords = viewport !== false && recordLayout;
  const showTable = viewport !== true || !recordLayout;

  if (sheet.rows.mode !== "fixed") {
    return (
      <p
        className={cn(
          "text-sm text-muted-foreground",
          nodeContentInsetClassName(depth)
        )}
      >
        {copy.emptyValue}
      </p>
    );
  }

  function toggleRow(rowId: string) {
    setCollapsedRows((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }

  return (
    <div
      className={nodeContentInsetClassName(depth)}
      data-smart-form-node-id={sheet.id}
      data-smart-form-node-kind={sheet.kind}
    >
      {sheet.title || sheet.description ? (
        <header className="mb-3">
          {sheet.title ? (
            <LocalizedRichText
              as={depth === 0 ? "h2" : "h3"}
              value={sheet.title}
              locale={locale}
              i18n={i18n}
              className={cn(
                "font-semibold tracking-tight",
                depth === 0 ? "text-xl md:text-[1.375rem]" : "text-lg"
              )}
            />
          ) : null}
          {sheet.description ? (
            <LocalizedRichText
              value={sheet.description}
              locale={locale}
              i18n={i18n}
              className="mt-1 text-sm leading-6 text-muted-foreground"
            />
          ) : null}
        </header>
      ) : null}

      {showTable ? (
        <div
          className={cn(
            "hidden min-w-0 overflow-hidden rounded-md border border-border/70 bg-card shadow-none md:block",
            mobileSheetLayout(sheet) === "table" &&
              mobileRecordStyles.scrollTable
          )}
        >
          <Table
            label={`${copy.tableLabel}: ${sheet.id}`}
            className="w-full min-w-0 table-fixed"
          >
            <TableHeader className={tableStyles.headerSurface}>
              <TableRow
                className={cn(
                  "hover:bg-transparent hover:shadow-none",
                  tableStyles.headerBorder
                )}
              >
                {columns.map((column, columnIndex) => (
                  <TableHead
                    key={column.id}
                    className={cn(
                      "h-11 min-w-0 max-w-0 whitespace-normal px-3 text-xs font-semibold leading-5",
                      tableStyles.headerForeground,
                      sheetColumnAlignClassName(column),
                      sheetColumnWidthClassName(column)
                    )}
                  >
                    <span className="inline-flex items-start gap-1">
                      {isMobile
                        ? projectedColumns[columnIndex].ancestors.map(
                            (ancestor) => (
                              <span key={ancestor.id}>
                                <LocalizedRichText
                                  value={ancestor.header}
                                  locale={locale}
                                  i18n={i18n}
                                />
                                <span aria-hidden> / </span>
                              </span>
                            )
                          )
                        : null}
                      <LocalizedRichText
                        value={column.header}
                        locale={locale}
                        i18n={i18n}
                      />
                      {column.cell.kind === "field" ? (
                        <SmartFormV2RequiredIndicator
                          required={isSmartFormV2FieldRequired(
                            column.cell.field,
                            formDefinition,
                            response
                          )}
                          requiredLabel={copy.required}
                          optionalLabel={copy.optional}
                        />
                      ) : null}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => {
                const answerRow = answerRows.get(row.source.id);
                const isGroup = row.source.role === "group";
                if (isGroup) {
                  return (
                    <TableRow
                      key={row.source.id}
                      data-smart-form-node-id={sheet.id}
                      data-smart-form-row-id={row.source.id}
                      className={cn(
                        "border-border/70 hover:shadow-none",
                        tableStyles.groupInteractive
                      )}
                    >
                      <TableCell
                        colSpan={columns.length}
                        className={cn(
                          "whitespace-normal px-3 py-2.5 align-middle text-sm font-semibold leading-5"
                        )}
                      >
                        <EditableProcedureLabel
                          sheetId={sheet.id}
                          row={row}
                          locale={locale}
                          i18n={i18n}
                          copy={copy}
                          expanded={!collapsedRows.has(row.source.id)}
                          onToggle={() => toggleRow(row.source.id)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                }
                return (
                  <TableRow
                    key={row.source.id}
                    data-smart-form-node-id={sheet.id}
                    data-smart-form-row-id={row.source.id}
                    className={cn(
                      "border-border/60 bg-card transition-colors hover:shadow-none",
                      tableStyles.groupRow
                    )}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(
                          "min-w-0 max-w-0 whitespace-normal px-3 py-2.5 align-middle text-sm leading-5",
                          sheetColumnAlignClassName(column),
                          sheetColumnWidthClassName(column)
                        )}
                      >
                        {column.cell.kind === "rowLabel" ? (
                          <EditableProcedureLabel
                            sheetId={sheet.id}
                            row={row}
                            locale={locale}
                            i18n={i18n}
                            copy={copy}
                            expanded={!collapsedRows.has(row.source.id)}
                            onToggle={() => toggleRow(row.source.id)}
                          />
                        ) : (
                          <EditableSheetCell
                            sheet={sheet}
                            column={column}
                            row={row}
                            formDefinition={formDefinition}
                            response={response}
                            answer={answerRow?.cells[column.id]}
                            locale={locale}
                            i18n={i18n}
                            copy={copy}
                            referenceOptions={referenceOptions}
                            error={issuesByKey.get(
                              smartFormV2SheetCellIssueKey(
                                sheet.id,
                                row.source.id,
                                column.id
                              )
                            )}
                            compact
                            onChange={(value) =>
                              onCellChange(
                                sheet.id,
                                row.source.id,
                                row.order,
                                column.id,
                                column.cell.kind === "field"
                                  ? column.cell.field.answerLocaleMode
                                  : undefined,
                                value
                              )
                            }
                          />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {showMobileRecords ? (
        <SmartFormV2MobileRecords
          sheet={sheet}
          rows={visibleRows}
          definition={formDefinition}
          response={response}
          requiredLabel={copy.required}
          optionalLabel={copy.optional}
          renderText={(value) => (
            <LocalizedRichText value={value} locale={locale} i18n={i18n} />
          )}
          isVisible={(row, column) =>
            isEditableSheetCellVisible(row, column, formDefinition, response)
          }
          renderHeading={(row) => (
            <EditableProcedureLabel
              sheetId={sheet.id}
              row={row}
              locale={locale}
              i18n={i18n}
              copy={copy}
              expanded={!collapsedRows.has(row.source.id)}
              onToggle={() => toggleRow(row.source.id)}
            />
          )}
          renderValue={(row, column, labelId) => (
            <EditableSheetCell
              labelledBy={labelId}
              sheet={sheet}
              column={column}
              row={row}
              formDefinition={formDefinition}
              response={response}
              answer={answerRows.get(row.source.id)?.cells[column.id]}
              locale={locale}
              i18n={i18n}
              copy={copy}
              referenceOptions={referenceOptions}
              error={issuesByKey.get(
                smartFormV2SheetCellIssueKey(sheet.id, row.source.id, column.id)
              )}
              compact
              onChange={(value) =>
                onCellChange(
                  sheet.id,
                  row.source.id,
                  row.order,
                  column.id,
                  column.cell.kind === "field"
                    ? column.cell.field.answerLocaleMode
                    : undefined,
                  value
                )
              }
            />
          )}
        />
      ) : null}
    </div>
  );
}

function EditableProcedureLabel({
  sheetId,
  row,
  locale,
  i18n,
  copy,
  expanded,
  onToggle,
}: {
  sheetId: string;
  row: SheetRowModel;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2EditorCopy;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isMobile = useSmartFormV2MobileLayout();
  const hasChildren = Boolean(row.children?.length);
  return (
    <div
      data-smart-form-procedure-depth={row.depth}
      className={cn(
        "flex min-w-0 items-start gap-2.5",
        row.depth === 1 && "ms-5",
        row.depth === 2 && "ms-10",
        row.depth >= 3 && "ms-14"
      )}
    >
      {hasChildren && !isMobile ? (
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          className={cn(
            "mt-px size-5 shrink-0 rounded-md border-border bg-background shadow-none",
            tableStyles.headerInteractive
          )}
          aria-label={expanded ? copy.collapse : copy.expand}
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {expanded ? (
            <Minus className="size-3" />
          ) : (
            <Plus className="size-3" />
          )}
        </Button>
      ) : (
        <span
          data-smart-form-procedure-spacer
          aria-hidden="true"
          className="size-5 shrink-0 sm:size-6"
        />
      )}
      {row.number ? (
        <span
          data-smart-form-number
          className="shrink-0 pt-px font-mono text-xs font-medium text-muted-foreground tabular-nums"
        >
          {row.number}
        </span>
      ) : null}
      {row.source.label ? (
        <LocalizedRichText
          value={row.source.label}
          locale={locale}
          i18n={i18n}
          className="min-w-0 text-sm leading-5 font-normal"
        />
      ) : null}
      <SmartFormV2ReviewQuestionButton
        target={{
          nodeId: sheetId,
          rowId: row.source.id,
          label: row.source.label
            ? localizedPlainText(row.source.label, locale, i18n)
            : row.number || row.source.id,
        }}
      />
    </div>
  );
}

function EditableSheetCell({
  sheet,
  column,
  row,
  formDefinition,
  response,
  answer,
  locale,
  i18n,
  copy,
  referenceOptions,
  error,
  compact = false,
  labelledBy,
  onChange,
}: {
  sheet: SmartFormV2SheetNode;
  column: SmartFormV2SheetLeafColumn;
  row: SheetRowModel;
  formDefinition: SmartFormV2CompiledDefinition;
  response: SmartFormV2Response;
  answer?: SmartFormV2FieldAnswer;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2EditorCopy;
  referenceOptions: SmartFormV2ReferenceOption[];
  error?: SmartFormV2ResponseValidationIssue;
  compact?: boolean;
  labelledBy?: string;
  onChange: (value: SmartFormV2FieldValue | undefined) => void;
}) {
  const override = row.source.cells?.[column.id];
  if (!isEditableSheetCellVisible(row, column, formDefinition, response)) {
    return null;
  }
  if (override?.kind === "empty") {
    return null;
  }
  if (override?.kind === "content") {
    return (
      <LocalizedRichText value={override.content} locale={locale} i18n={i18n} />
    );
  }
  if (column.cell.kind !== "field") {
    return null;
  }
  const definition =
    override?.kind === "field" &&
    override.profileOverride &&
    column.cell.field.value.type === "richText"
      ? {
          ...column.cell.field.value,
          profile: override.profileOverride,
        }
      : column.cell.field.value;
  const rowLabel = row.source.label
    ? localizedPlainText(row.source.label, locale, i18n)
    : row.number;
  const columnLabel = localizedPlainText(column.header, locale, i18n);
  const ancestorHeaders =
    projectMobileSheetColumns(sheet.columns).find(
      ({ column: item }) => item.id === column.id
    )?.ancestors ?? [];
  const fieldLabel = [
    ...ancestorHeaders.map((group) =>
      localizedPlainText(group.header, locale, i18n)
    ),
    columnLabel,
  ].join(" / ");
  const errorId = `${sheet.id}-${row.source.id}-${column.id}-error`;
  return (
    <div
      role="group"
      aria-label={`${rowLabel}: ${columnLabel}`}
      aria-labelledby={labelledBy}
      aria-describedby={error ? errorId : undefined}
      className={cn("grid min-w-0 gap-1", mobileFormStyles.control)}
    >
      <FieldControl
        id={`${sheet.id}-${row.source.id}-${column.id}`}
        fieldLabel={fieldLabel}
        definition={definition}
        answer={answer}
        locale={locale}
        i18n={i18n}
        copy={copy}
        referenceOptions={referenceOptions}
        compact={compact}
        onChange={onChange}
      />
      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {validationIssueText(error, copy)}
        </p>
      ) : null}
    </div>
  );
}

function EditableField({
  id,
  label,
  help,
  definition,
  answer,
  required,
  locale,
  i18n,
  copy,
  referenceOptions,
  error,
  onChange,
}: {
  id: string;
  label: Extract<SmartFormV2CoreNode, { kind: "field" }>["label"];
  help?: Extract<SmartFormV2CoreNode, { kind: "field" }>["help"];
  definition: SmartFormV2FieldDefinition;
  answer?: SmartFormV2FieldAnswer;
  answerLocaleMode?: "single" | "per-locale";
  required?: boolean;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2EditorCopy;
  referenceOptions: SmartFormV2ReferenceOption[];
  error?: SmartFormV2ResponseValidationIssue;
  onChange: ChangeAnswer;
}) {
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-2">
      <Label id={labelId} className="flex items-start gap-1">
        <LocalizedRichText
          as="span"
          value={label}
          locale={locale}
          i18n={i18n}
          className="text-sm font-medium"
        />
        <SmartFormV2RequiredIndicator
          required={Boolean(required)}
          requiredLabel={copy.required}
          optionalLabel={copy.optional}
        />
        <SmartFormV2ReviewQuestionButton
          target={{
            nodeId: id,
            label: localizedPlainText(label, locale, i18n),
          }}
        />
      </Label>
      {help ? (
        <LocalizedRichText
          value={help}
          locale={locale}
          i18n={i18n}
          className={cn(
            "text-sm leading-6 text-muted-foreground",
            mobileFormStyles.fieldDescription
          )}
        />
      ) : null}
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={error ? errorId : undefined}
        className={cn("grid gap-1", mobileFormStyles.control)}
      >
        <FieldControl
          id={id}
          fieldLabel={localizedPlainText(label, locale, i18n)}
          definition={definition}
          answer={answer}
          locale={locale}
          i18n={i18n}
          copy={copy}
          referenceOptions={referenceOptions}
          onChange={onChange}
        />
        {error ? (
          <p id={errorId} className="text-xs font-medium text-destructive">
            {validationIssueText(error, copy)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function FieldControl(props: Parameters<typeof FieldControlContent>[0]) {
  const isMobile = useSmartFormV2MobileLayout();
  const [open, setOpen] = useState(false);
  const valueId = useId();
  if (!isMobile || props.definition.type === "reference") {
    return <FieldControlContent {...props} />;
  }
  const title = props.fieldLabel ?? props.copy.editorLabel;
  const value = resolveFieldValue(props.answer, props.locale, props.i18n);
  const selected = value?.type === "choice" ? value.selectedOptionIds : [];
  const choice =
    props.definition.type === "choice" ? props.definition : undefined;
  return (
    <>
      <div
        className={mobileInputStyles.preview}
        data-inline-choice={
          choice || props.definition.type === "date" ? "true" : undefined
        }
      >
        <div id={valueId} className={mobileInputStyles.value}>
          <FieldValue
            definition={props.definition}
            answer={props.answer}
            locale={props.locale}
            i18n={props.i18n}
            copy={props.copy}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={mobileInputStyles.trigger}
          aria-label={`${props.copy.editField ?? "Edit"}: ${title}`}
          aria-describedby={valueId}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          {choice || props.definition.type === "date" ? (
            <ChevronDown />
          ) : (
            <Pencil />
          )}
        </Button>
      </div>
      <MobileActionSheet
        open={open}
        onOpenChange={setOpen}
        title={title}
        closeLabel={props.copy.closeEditor ?? "Close editor"}
      >
        <div className={mobileInputStyles.content}>
          {choice ? (
            <div className={mobileInputStyles.options}>
              <Button
                type="button"
                variant="ghost"
                aria-pressed={selected.length === 0}
                onClick={() => {
                  props.onChange({ type: "choice", selectedOptionIds: [] });
                  if (choice.cardinality === "one") {
                    setOpen(false);
                  }
                }}
              >
                {props.copy.unselected}
                {selected.length === 0 ? <Check /> : null}
              </Button>
              {choice.options.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant="ghost"
                  aria-pressed={selected.includes(option.id)}
                  onClick={() => {
                    props.onChange({
                      type: "choice",
                      selectedOptionIds:
                        choice.cardinality === "one"
                          ? [option.id]
                          : selected.includes(option.id)
                            ? selected.filter((id) => id !== option.id)
                            : [...selected, option.id],
                    });
                    if (choice.cardinality === "one") {
                      setOpen(false);
                    }
                  }}
                >
                  <LocalizedRichText
                    as="span"
                    value={option.label}
                    locale={props.locale}
                    i18n={props.i18n}
                  />
                  {selected.includes(option.id) ? <Check /> : null}
                </Button>
              ))}
            </div>
          ) : (
            <FieldControlContent {...props} compact={false} />
          )}
        </div>
      </MobileActionSheet>
    </>
  );
}

function FieldControlContent({
  id,
  definition,
  answer,
  locale,
  i18n,
  copy,
  referenceOptions,
  compact = false,
  onChange,
}: {
  id: string;
  fieldLabel?: string;
  definition: SmartFormV2FieldDefinition;
  answer?: SmartFormV2FieldAnswer;
  locale: string;
  i18n: SmartFormV2I18nConfig;
  copy: SmartFormV2EditorCopy;
  referenceOptions: SmartFormV2ReferenceOption[];
  compact?: boolean;
  onChange: (value: SmartFormV2FieldValue | undefined) => void;
}) {
  const isMobile = useSmartFormV2MobileLayout();
  const value = resolveFieldValue(answer, locale, i18n);
  const [richTextOpen, setRichTextOpen] = useState(false);
  switch (definition.type) {
    case "choice": {
      const selected = value?.type === "choice" ? value.selectedOptionIds : [];
      if (definition.cardinality === "many") {
        return (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {definition.options.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <label
                  key={option.id}
                  htmlFor={`smart-form-choice-${option.id}`}
                  className="inline-flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    id={`smart-form-choice-${option.id}`}
                    checked={checked}
                    label={localizedPlainText(option.label, locale, i18n)}
                    onCheckedChange={(nextChecked) =>
                      onChange({
                        type: "choice",
                        selectedOptionIds: nextChecked
                          ? [...selected, option.id]
                          : selected.filter((item) => item !== option.id),
                      })
                    }
                  />
                  <LocalizedRichText
                    as="span"
                    value={option.label}
                    locale={locale}
                    i18n={i18n}
                  />
                </label>
              );
            })}
          </div>
        );
      }
      const selectedOption = definition.options.find(
        (option) => option.id === selected[0]
      );
      return (
        <Select
          value={selected[0] ?? UNSELECTED_CHOICE_VALUE}
          onValueChange={(next) =>
            onChange({
              type: "choice",
              selectedOptionIds:
                next && String(next) !== UNSELECTED_CHOICE_VALUE
                  ? [String(next)]
                  : [],
            })
          }
        >
          <SelectTrigger
            size={compact ? "sm" : "default"}
            className={cn(
              "min-w-0",
              compact &&
                "min-h-8 rounded-sm border-border/60 bg-background/80 shadow-none hover:border-border sm:min-h-8",
              compact &&
                (selectedOption
                  ? choiceValueToneClassName(selected[0])
                  : "text-muted-foreground")
            )}
            aria-label={copy.select}
          >
            <SelectValue>
              {selectedOption ? (
                <LocalizedRichText
                  as="span"
                  value={selectedOption.label}
                  locale={locale}
                  i18n={i18n}
                />
              ) : (
                copy.unselected
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSELECTED_CHOICE_VALUE}>
              {copy.unselected}
            </SelectItem>
            {definition.options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                <LocalizedRichText
                  as="span"
                  value={option.label}
                  locale={locale}
                  i18n={i18n}
                />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case "text": {
      const text = value?.type === "text" ? value.text : "";
      return definition.multiline ? (
        <Textarea
          value={text}
          label={copy.editorLabel}
          placeholder={copy.richTextPlaceholder}
          maxLength={definition.maxLength}
          className={compact ? "min-h-20" : "min-h-24"}
          onChange={(event) =>
            onChange({ type: "text", text: event.currentTarget.value })
          }
        />
      ) : (
        <Input
          value={text}
          size={compact ? "sm" : "default"}
          maxLength={definition.maxLength}
          aria-label={copy.editorLabel}
          onChange={(event) =>
            onChange({ type: "text", text: event.currentTarget.value })
          }
        />
      );
    }
    case "richText": {
      const document =
        value?.type === "richText" ? value.document : emptyRichTextDocument(id);
      if (!isMarkdownEditableRichText(document, definition.profile)) {
        return (
          <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
            <RichTextDocument document={document} />
            <p className="text-xs leading-5 text-muted-foreground">
              {copy.structuredRichTextReadOnly}
            </p>
          </div>
        );
      }
      const markdown = smartFormDocumentToMarkdown(document);
      if (compact && !isMobile) {
        const summary = richTextSummary(markdown, copy.emptyValue);
        return (
          <Popover open={richTextOpen} onOpenChange={setRichTextOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className={cn(
                    "h-auto min-h-8 w-full max-w-full min-w-0 justify-start gap-1.5 rounded-sm border-border/60 bg-background/80 px-2 py-1.5 text-left font-normal shadow-none hover:border-border hover:bg-muted/30 sm:min-h-8",
                    summary === copy.emptyValue && "text-muted-foreground"
                  )}
                />
              }
            >
              <FileText className="size-3.5 shrink-0 text-primary" />
              <span className="truncate">{summary}</span>
            </PopoverTrigger>
            {richTextOpen ? (
              <PopoverContent
                align="end"
                className="w-[min(42rem,calc(100vw-2rem))] gap-3 p-3"
              >
                <PopoverTitle>{copy.editRichText}</PopoverTitle>
                <ReviewNoteRichTextComposer
                  value={markdown}
                  documentValue={smartFormDocumentToEditorJson(document)}
                  ariaLabel={copy.editRichText}
                  placeholder={copy.richTextPlaceholder}
                  copy={copy.richText}
                  allowedBlocks={richTextEditorBlocks(
                    definition.profile.allowedBlocks
                  )}
                  allowedMarks={definition.profile.allowedMarks}
                  allowMention={false}
                  removeEmptyStructuredBlockOnBackspace
                  className="min-h-64"
                  editorClassName="min-h-44"
                  onChange={() => {}}
                  onDocumentChange={(nextDocument) => {
                    onChange({
                      type: "richText",
                      document: editorJsonToSmartFormDocument(
                        nextDocument,
                        id,
                        document
                      ),
                    });
                  }}
                />
              </PopoverContent>
            ) : null}
          </Popover>
        );
      }
      return (
        <ReviewNoteRichTextComposer
          presentation={isMobile ? "plain" : "framed"}
          overlayPlacement={isMobile ? "bottom" : "dialog"}
          value={markdown}
          documentValue={smartFormDocumentToEditorJson(document)}
          ariaLabel={copy.editRichText}
          placeholder={copy.richTextPlaceholder}
          copy={copy.richText}
          allowedBlocks={richTextEditorBlocks(definition.profile.allowedBlocks)}
          allowedMarks={definition.profile.allowedMarks}
          allowMention={false}
          removeEmptyStructuredBlockOnBackspace
          className={isMobile ? undefined : "min-h-64"}
          editorClassName={isMobile ? undefined : "min-h-44"}
          onChange={() => {}}
          onDocumentChange={(nextDocument) => {
            onChange({
              type: "richText",
              document: editorJsonToSmartFormDocument(
                nextDocument,
                id,
                document
              ),
            });
          }}
        />
      );
    }
    case "attachment": {
      const attachments = value?.type === "attachment" ? value.attachments : [];
      const accepts = definition.allowedMediaTypes?.join(",");
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          {attachments.map((attachment) => (
            <Badge
              key={attachment.attachmentId}
              variant="outline"
              size="lg"
              className="max-w-full gap-1.5 rounded-md border-border bg-muted/40 px-2.5 font-normal"
            >
              <Paperclip className="size-3.5 text-muted-foreground" />
              <span className="truncate">
                {attachment.fileNameSnapshot ??
                  `${copy.attachment} ${attachment.attachmentId}`}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="-me-1 size-5"
                aria-label={copy.removeAttachment}
                onClick={() =>
                  onChange({
                    type: "attachment",
                    attachments: attachments.filter(
                      (item) => item.attachmentId !== attachment.attachmentId
                    ),
                  })
                }
              >
                <X className="size-3" />
              </Button>
            </Badge>
          ))}
          <label className="cursor-pointer">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground shadow-xs/5 transition-colors hover:bg-muted">
              <Paperclip className="size-3.5" />
              {copy.uploadAttachment}
            </span>
            <Input
              nativeInput
              type="file"
              accept={accepts}
              multiple={definition.cardinality === "many"}
              className="hidden"
              aria-label={copy.uploadAttachment}
              onChange={(event) => {
                const files = [...(event.currentTarget.files ?? [])];
                const next = files.map((file, index) => ({
                  attachmentId: `${id}-attachment-${Date.now()}-${index}`,
                  fileNameSnapshot: file.name,
                  mediaTypeSnapshot: file.type || undefined,
                  sizeBytesSnapshot: file.size,
                }));
                const maxFiles =
                  definition.cardinality === "one"
                    ? 1
                    : (definition.maxFiles ?? Number.POSITIVE_INFINITY);
                onChange({
                  type: "attachment",
                  attachments: [
                    ...(definition.cardinality === "one" ? [] : attachments),
                    ...next,
                  ].slice(0, maxFiles),
                });
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      );
    }
    case "reference": {
      const references = value?.type === "reference" ? value.references : [];
      return (
        <ReferenceEditor
          definition={definition}
          references={references}
          options={referenceOptions}
          copy={copy}
          onChange={(nextReferences) =>
            onChange({ type: "reference", references: nextReferences })
          }
        />
      );
    }
    case "date": {
      const dateValue = value?.type === "date" ? value.value : "";
      const type =
        definition.precision === "day"
          ? "date"
          : definition.precision === "month"
            ? "month"
            : "number";
      return (
        <Input
          nativeInput
          type={type}
          value={dateValue}
          size={compact ? "sm" : "default"}
          min={definition.min}
          max={definition.max}
          aria-label={copy.editorLabel}
          onChange={(event) => {
            const next = event.currentTarget.value;
            onChange(next ? { type: "date", value: next } : undefined);
          }}
        />
      );
    }
    case "number": {
      const decimal = value?.type === "number" ? value.decimal : "";
      return (
        <Input
          nativeInput
          type="number"
          inputMode="decimal"
          value={decimal}
          step={
            definition.scale === undefined
              ? "any"
              : String(1 / 10 ** definition.scale)
          }
          min={definition.min}
          max={definition.max}
          size={compact ? "sm" : "default"}
          aria-label={copy.editorLabel}
          onChange={(event) => {
            const next = event.currentTarget.value;
            onChange(next ? { type: "number", decimal: next } : undefined);
          }}
        />
      );
    }
    default: {
      return null;
    }
  }
}

function ReferenceEditor({
  definition,
  references,
  options,
  copy,
  onChange,
}: {
  definition: Extract<SmartFormV2FieldDefinition, { type: "reference" }>;
  references: Extract<
    SmartFormV2FieldValue,
    { type: "reference" }
  >["references"];
  options: SmartFormV2ReferenceOption[];
  copy: SmartFormV2EditorCopy;
  onChange: (
    references: Extract<
      SmartFormV2FieldValue,
      { type: "reference" }
    >["references"]
  ) => void;
}) {
  const isMobile = useSmartFormV2MobileLayout();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedKeys = new Set(
    references.map((item) => `${item.targetType}:${item.targetId}`)
  );
  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      options.filter((option) => {
        if (!definition.targetTypes.includes(option.targetType)) {
          return false;
        }
        if (!normalized) {
          return true;
        }
        return [option.label, option.path, option.targetId]
          .filter(Boolean)
          .some((item) => item?.toLowerCase().includes(normalized));
      }),
    [definition.targetTypes, normalized, options]
  );
  const optionTree = useMemo(
    () => buildReferenceOptionTree(filtered),
    [filtered]
  );
  const eligibleOptionCount = options.filter((option) =>
    definition.targetTypes.includes(option.targetType)
  ).length;
  const [expandedFolderKeys, setExpandedFolderKeys] = useState<Set<string>>(
    () =>
      new Set(buildReferenceOptionTree(options).folders.map(({ key }) => key))
  );
  const atLimit =
    definition.cardinality === "one"
      ? references.length > 0
      : references.length >= (definition.maxItems ?? Number.POSITIVE_INFINITY);

  const pickerContent = (
    <>
      {" "}
      <div className="border-b border-border/70 px-4 py-3">
        {isMobile ? null : <PopoverTitle>{copy.addReference}</PopoverTitle>}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatSmartFormCopy(
            copy.currentWorkingPaperCount ??
              "{count} current-period working papers",
            { count: eligibleOptionCount }
          )}
        </p>
        <div className="relative mt-2.5">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            aria-label={copy.searchReferences}
            placeholder={copy.searchReferences}
            className="ps-8"
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </div>
      </div>
      <div
        data-slot="smart-form-reference-results"
        className={tableStyles.referencePickerTree}
      >
        {filtered.length > 0 ? (
          <ReferenceOptionTree
            tree={optionTree}
            selectedKeys={selectedKeys}
            expandedFolderKeys={expandedFolderKeys}
            forceExpanded={Boolean(normalized)}
            copy={copy}
            onToggleFolder={(folderKey) =>
              setExpandedFolderKeys((current) => {
                const next = new Set(current);
                if (next.has(folderKey)) {
                  next.delete(folderKey);
                } else {
                  next.add(folderKey);
                }
                return next;
              })
            }
            onSelect={(option) => {
              const optionKey = `${option.targetType}:${option.targetId}`;
              const selected = selectedKeys.has(optionKey);
              if (selected) {
                onChange(
                  references.filter(
                    (reference) =>
                      `${reference.targetType}:${reference.targetId}` !==
                      optionKey
                  )
                );
                return;
              }
              onChange([
                ...(definition.cardinality === "one" ? [] : references),
                {
                  targetType: option.targetType,
                  targetId: option.targetId,
                  labelSnapshot: option.label,
                },
              ]);
              if (definition.cardinality === "one") {
                setOpen(false);
                setQuery("");
              }
            }}
          />
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {copy.noReferences}
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {references.map((reference) => (
        <Badge
          data-smart-form-reference
          key={`${reference.targetType}:${reference.targetId}`}
          variant="outline"
          size="lg"
          className="max-w-full gap-1.5 rounded-md border-border bg-muted/55 px-2.5 font-medium text-foreground"
        >
          <Link2
            className={cn("size-3.5 shrink-0", tableStyles.headerForeground)}
          />
          <span className="truncate">
            {reference.labelSnapshot ??
              `${copy.reference} ${reference.targetId}`}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="-me-1 size-5"
            aria-label={copy.removeReference}
            onClick={() =>
              onChange(
                references.filter(
                  (item) =>
                    item.targetType !== reference.targetType ||
                    item.targetId !== reference.targetId
                )
              )
            }
          >
            <X className="size-3" />
          </Button>
        </Badge>
      ))}
      {atLimit ? null : isMobile ? (
        <>
          <Button
            type="button"
            variant="ghost"
            data-smart-form-reference-trigger
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <Link2 />
            {copy.addReference}
          </Button>
          <MobileActionSheet
            open={open}
            onOpenChange={setOpen}
            title={copy.addReference}
            closeLabel={copy.closeEditor ?? "Close editor"}
          >
            <div className={mobileInputStyles.content}>{pickerContent}</div>
          </MobileActionSheet>
        </>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            data-smart-form-reference-trigger
            render={
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="h-8 w-full max-w-full min-w-0 justify-start overflow-hidden rounded-sm border-border/60 bg-background/80 px-2 text-xs font-medium text-muted-foreground shadow-none hover:border-border hover:bg-muted/30 sm:h-8"
              />
            }
          >
            <Link2 className="size-3.5" />
            <span className="min-w-0 truncate">{copy.addReference}</span>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className={cn(
              tableStyles.referencePicker,
              "gap-0 overflow-hidden p-0"
            )}
          >
            {pickerContent}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

type ReferenceOptionFolder = {
  key: string;
  label: string;
  folders: ReferenceOptionFolder[];
  options: SmartFormV2ReferenceOption[];
};

type ReferenceOptionTreeModel = {
  folders: ReferenceOptionFolder[];
  options: SmartFormV2ReferenceOption[];
};

function ReferenceOptionTree({
  tree,
  selectedKeys,
  expandedFolderKeys,
  forceExpanded,
  copy,
  onToggleFolder,
  onSelect,
}: {
  tree: ReferenceOptionTreeModel;
  selectedKeys: Set<string>;
  expandedFolderKeys: Set<string>;
  forceExpanded: boolean;
  copy: SmartFormV2EditorCopy;
  onToggleFolder: (folderKey: string) => void;
  onSelect: (option: SmartFormV2ReferenceOption) => void;
}) {
  return (
    <div role="tree" aria-label={copy.addReference} className="py-1.5">
      {tree.options.map((option) => (
        <ReferenceOptionRow
          key={`${option.targetType}:${option.targetId}`}
          option={option}
          selected={selectedKeys.has(`${option.targetType}:${option.targetId}`)}
          depth={0}
          onSelect={() => onSelect(option)}
        />
      ))}
      {tree.folders.map((folder) => (
        <ReferenceFolderRow
          key={folder.key}
          folder={folder}
          selectedKeys={selectedKeys}
          expandedFolderKeys={expandedFolderKeys}
          forceExpanded={forceExpanded}
          copy={copy}
          depth={0}
          onToggleFolder={onToggleFolder}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function ReferenceFolderRow({
  folder,
  selectedKeys,
  expandedFolderKeys,
  forceExpanded,
  copy,
  depth,
  onToggleFolder,
  onSelect,
}: {
  folder: ReferenceOptionFolder;
  selectedKeys: Set<string>;
  expandedFolderKeys: Set<string>;
  forceExpanded: boolean;
  copy: SmartFormV2EditorCopy;
  depth: number;
  onToggleFolder: (folderKey: string) => void;
  onSelect: (option: SmartFormV2ReferenceOption) => void;
}) {
  const expanded = forceExpanded || expandedFolderKeys.has(folder.key);
  const accessibleLabel = `${
    expanded
      ? (copy.collapseFolder ?? "Collapse folder")
      : (copy.expandFolder ?? "Expand folder")
  }: ${folder.label}`;
  return (
    <div role="none">
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "h-9 w-full justify-start gap-2 rounded-none pe-3 text-left font-medium",
          referenceTreeIndentClassName(depth)
        )}
        role="treeitem"
        aria-expanded={expanded}
        aria-label={accessibleLabel}
        onClick={() => onToggleFolder(folder.key)}
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-[var(--motion-normal)]",
            expanded && "rotate-90"
          )}
        />
        {expanded ? (
          <FolderOpen className="size-4 shrink-0 text-primary" />
        ) : (
          <Folder className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{folder.label}</span>
      </Button>
      {expanded ? (
        <div role="group">
          {folder.options.map((option) => (
            <ReferenceOptionRow
              key={`${option.targetType}:${option.targetId}`}
              option={option}
              selected={selectedKeys.has(
                `${option.targetType}:${option.targetId}`
              )}
              depth={depth + 1}
              onSelect={() => onSelect(option)}
            />
          ))}
          {folder.folders.map((child) => (
            <ReferenceFolderRow
              key={child.key}
              folder={child}
              selectedKeys={selectedKeys}
              expandedFolderKeys={expandedFolderKeys}
              forceExpanded={forceExpanded}
              copy={copy}
              depth={depth + 1}
              onToggleFolder={onToggleFolder}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReferenceOptionRow({
  option,
  selected,
  depth,
  onSelect,
}: {
  option: SmartFormV2ReferenceOption;
  selected: boolean;
  depth: number;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-auto min-h-11 w-full items-start justify-start gap-2 rounded-none pe-3 py-2 text-left whitespace-normal",
        selected && "bg-accent",
        referenceTreeIndentClassName(depth)
      )}
      role="treeitem"
      aria-selected={selected}
      onClick={onSelect}
    >
      <Link2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 leading-5">
        {option.code ? (
          <span className="me-1.5 font-mono text-xs font-medium text-muted-foreground">
            {option.code}
          </span>
        ) : null}
        <span className="font-medium">{option.title ?? option.label}</span>
      </span>
      {selected ? (
        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
      ) : null}
    </Button>
  );
}

function buildReferenceOptionTree(
  options: SmartFormV2ReferenceOption[]
): ReferenceOptionTreeModel {
  const root: ReferenceOptionTreeModel = { folders: [], options: [] };
  for (const option of options) {
    const fallbackSegments = option.path
      ?.split(" \u203A ")
      .filter(Boolean)
      .slice(0, -1);
    const segments =
      option.pathSegments?.filter(Boolean) ?? fallbackSegments ?? [];
    let cursor = root;
    const keySegments: string[] = [];
    for (const segment of segments) {
      keySegments.push(segment);
      const key = keySegments.join("/");
      let folder = cursor.folders.find((candidate) => candidate.key === key);
      if (!folder) {
        folder = { key, label: segment, folders: [], options: [] };
        cursor.folders.push(folder);
      }
      cursor = folder;
    }
    cursor.options.push(option);
  }
  sortReferenceTree(root);
  return root;
}

function sortReferenceTree(tree: ReferenceOptionTreeModel) {
  tree.folders.sort((left, right) => left.label.localeCompare(right.label));
  tree.options.sort((left, right) => left.label.localeCompare(right.label));
  tree.folders.forEach(sortReferenceTree);
}

function referenceTreeIndentClassName(depth: number) {
  if (depth <= 0) {
    return "ps-3";
  }
  if (depth === 1) {
    return "ps-7";
  }
  if (depth === 2) {
    return "ps-11";
  }
  return "ps-15";
}

function createEmptyResponse(
  definition: SmartFormV2CompiledDefinition,
  locale: string
): SmartFormV2Response {
  return {
    kind: "smartFormResponse",
    schemaVersion: 2,
    definitionVersionId: definition.id,
    responseLocale: locale,
    updatedAt: new Date(0).toISOString(),
    fields: {},
    sheets: {},
  };
}

function mergeFieldAnswer(
  current: SmartFormV2FieldAnswer | undefined,
  nextValue: SmartFormV2FieldValue | undefined,
  locale: string,
  answerLocaleMode: "single" | "per-locale" | undefined
): SmartFormV2FieldAnswer | undefined {
  const localized = current?.type === "localized";
  if (!localized && answerLocaleMode !== "per-locale") {
    return nextValue;
  }
  const values = {
    ...(localized ? current.values : {}),
  };
  if (nextValue) {
    values[locale] = nextValue;
  } else {
    Reflect.deleteProperty(values, locale);
  }
  return Object.keys(values).length > 0
    ? { type: "localized", values }
    : undefined;
}

function resolveFieldValue(
  answer: SmartFormV2FieldAnswer | undefined,
  locale: string,
  i18n: SmartFormV2I18nConfig
): SmartFormV2FieldValue | undefined {
  if (!answer) {
    return undefined;
  }
  if (answer.type !== "localized") {
    return answer;
  }
  const candidates = [
    locale,
    ...(i18n.fallbackLocales?.[locale] ?? []),
    i18n.defaultLocale,
    ...i18n.supportedLocales,
  ];
  for (const candidate of candidates) {
    const value = answer.values[candidate];
    if (value) {
      return value;
    }
  }
  return Object.values(answer.values)[0];
}

function responseFingerprint(response: SmartFormV2Response) {
  const { updatedAt: _updatedAt, ...content } = response;
  return JSON.stringify(content);
}

function buildSheetRows(
  rows: SmartFormV2FixedSheetRow[],
  numbering?: SmartFormV2NumberingRule,
  depth = 0,
  parentNumber = "",
  orderState?: { current: number }
): SheetRowModel[] {
  const resolvedOrderState = orderState ?? { current: 0 };
  return rows.map((source, index) => {
    const rule = numberingForDepth(numbering, depth);
    const ownNumber = rule?.enabled
      ? `${rule.prefix ?? ""}${formatOrdinal(
          (rule.startAt ?? 1) + index,
          rule.style
        )}${rule.suffix ?? ""}`
      : "";
    const number = parentNumber
      ? `${parentNumber}${rule?.separator ?? ""}${ownNumber}`
      : ownNumber;
    const order = resolvedOrderState.current + 1;
    resolvedOrderState.current = order;
    return {
      source,
      number,
      depth,
      order,
      children: source.children?.length
        ? buildSheetRows(
            source.children,
            numbering,
            depth + 1,
            number,
            resolvedOrderState
          )
        : undefined,
    };
  });
}

function collectCollapsibleSheetRowIds(rows: SmartFormV2FixedSheetRow[]) {
  const rowIds = new Set<string>();
  const visit = (items: SmartFormV2FixedSheetRow[]) => {
    for (const row of items) {
      if (!row.children?.length) {
        continue;
      }
      rowIds.add(row.id);
      visit(row.children);
    }
  };
  visit(rows);
  return rowIds;
}

function flattenVisibleRows(
  rows: SheetRowModel[],
  collapsedRows: Set<string>
): SheetRowModel[] {
  return rows.flatMap((row) => [
    row,
    ...(row.children?.length && !collapsedRows.has(row.source.id)
      ? flattenVisibleRows(row.children, collapsedRows)
      : []),
  ]);
}

function numberingForDepth(
  numbering: SmartFormV2NumberingRule | undefined,
  depth: number
) {
  let current = numbering;
  for (let index = 0; index < depth; index += 1) {
    current = current?.child;
  }
  return current;
}

function formatOrdinal(
  value: number,
  numberingStyle: SmartFormV2NumberingRule["style"]
) {
  if (numberingStyle === "decimal") {
    return String(value);
  }
  if (numberingStyle === "lower-alpha" || numberingStyle === "upper-alpha") {
    let remaining = value;
    let output = "";
    while (remaining > 0) {
      remaining -= 1;
      output = String.fromCodePoint(97 + (remaining % 26)) + output;
      remaining = Math.floor(remaining / 26);
    }
    return numberingStyle === "upper-alpha" ? output.toUpperCase() : output;
  }
  const roman = toRoman(value);
  return numberingStyle === "upper-roman" ? roman : roman.toLowerCase();
}

function toRoman(value: number) {
  const tokens: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let remaining = value;
  let output = "";
  for (const [unit, token] of tokens) {
    while (remaining >= unit) {
      output += token;
      remaining -= unit;
    }
  }
  return output;
}

function flattenSheetColumns(
  column: SmartFormV2SheetNode["columns"][number]
): SmartFormV2SheetLeafColumn[] {
  return column.kind === "column"
    ? [column]
    : column.children.flatMap(flattenSheetColumns);
}

function isEditableSheetCellVisible(
  row: SheetRowModel,
  column: SmartFormV2SheetLeafColumn,
  definition: SmartFormV2CompiledDefinition,
  response: SmartFormV2Response
) {
  const override = row.source.cells?.[column.id];
  return !(
    override?.kind === "field" &&
    !isSmartFormV2ExpressionTrue(definition, response, override.visibleWhen)
  );
}

function sheetColumnAlignClassName(column: SmartFormV2SheetLeafColumn) {
  if (column.align === "center") {
    return "text-center";
  }
  if (column.align === "end") {
    return "text-end";
  }
  return "text-start";
}

function choiceValueToneClassName(optionId: string | undefined) {
  if (
    optionId === "yes" ||
    optionId === "satisfactory" ||
    optionId === "confirmed"
  ) {
    return "font-medium text-success";
  }
  if (optionId === "unsatisfactory" || optionId === "exception") {
    return "font-medium text-destructive";
  }
  return "text-foreground";
}

function sheetColumnWidthClassName(column: SmartFormV2SheetLeafColumn) {
  if (column.id === "procedure") {
    return tableStyles.procedureColumn;
  }
  if (column.id === "test-required") {
    return tableStyles.testRequiredColumn;
  }
  if (column.id === "result") {
    return tableStyles.resultColumn;
  }
  if (column.id === "working-paper-reference") {
    return tableStyles.referenceColumn;
  }
  if (column.id === "comments") {
    return tableStyles.commentsColumn;
  }
  if (column.width === "42%") {
    return "w-[42%]";
  }
  if (column.width === "13%") {
    return "w-[13%]";
  }
  if (column.width === "15%") {
    return "w-[15%]";
  }
}

function nodeDepthInsetClassName(depth: number) {
  if (depth <= 0) {
    return "";
  }
  if (depth === 1) {
    return "w-full md:ms-9 md:w-[calc(100%-2.25rem)]";
  }
  if (depth === 2) {
    return "w-full md:ms-16 md:w-[calc(100%-4rem)]";
  }
  return "w-full md:ms-20 md:w-[calc(100%-5rem)]";
}

function nodeContentInsetClassName(depth: number) {
  return depth <= 0 ? "py-4 md:px-5 md:py-5" : nodeDepthInsetClassName(depth);
}

function smartFormSectionClassName(depth: number) {
  return depth <= 0
    ? "py-4 md:px-5 md:py-5"
    : "py-1 md:border-s-2 md:border-s-border/70 md:ps-5";
}

function staticContentGutterClassName(depth: number) {
  return depth <= 0 ? "py-4 md:px-5" : nodeDepthInsetClassName(depth);
}

function countRequiredSmartFormResponses(
  definition: SmartFormV2CompiledDefinition,
  response: SmartFormV2Response
) {
  function countNodes(nodes: SmartFormV2CoreNode[]): number {
    return nodes.reduce((total, node) => {
      if (
        node.visibleWhen !== undefined &&
        !isSmartFormV2ExpressionTrue(definition, response, node.visibleWhen)
      ) {
        return total;
      }
      if (node.kind === "section" || node.kind === "group") {
        return total + countNodes(node.children);
      }
      if (node.kind === "conditional") {
        const questionCount = isSmartFormV2FieldRequired(
          node.branchQuestion,
          definition,
          response
        )
          ? 1
          : 0;
        const branch = resolveSmartFormV2ConditionalBranch(
          definition,
          response,
          node
        );
        const activeChildren =
          branch.type === "branch"
            ? (node.branches.find(
                (candidate) => candidate.id === branch.branchId
              )?.children ?? [])
            : branch.type === "otherwise"
              ? node.otherwise.children
              : [];
        return total + questionCount + countNodes(activeChildren);
      }
      if (node.kind === "field") {
        return (
          total +
          (isSmartFormV2FieldRequired(node, definition, response) ? 1 : 0)
        );
      }
      if (node.kind !== "sheet") {
        return total;
      }
      const fieldColumns = node.columns
        .flatMap(flattenSheetColumns)
        .filter((column) => column.cell.kind === "field");
      if (node.rows.mode === "repeatable") {
        const rowCount = response.sheets[node.id]?.rows.length ?? 0;
        const requiredColumnCount = fieldColumns.filter(
          (column) =>
            column.cell.kind === "field" &&
            isSmartFormV2FieldRequired(column.cell.field, definition, response)
        ).length;
        return total + rowCount * requiredColumnCount;
      }
      const rows = flattenVisibleRows(
        buildSheetRows(node.rows.items, node.rows.numbering),
        new Set()
      );
      const requiredCellCount = rows.reduce(
        (rowTotal, row) =>
          rowTotal +
          fieldColumns.filter((column) => {
            if (column.cell.kind !== "field") {
              return false;
            }
            const override = row.source.cells?.[column.id];
            return (
              override?.kind !== "empty" &&
              override?.kind !== "content" &&
              isEditableSheetCellVisible(row, column, definition, response) &&
              isSmartFormV2FieldRequired(
                column.cell.field,
                definition,
                response
              )
            );
          }).length,
        0
      );
      return total + requiredCellCount;
    }, 0);
  }

  return countNodes(definition.children);
}

function formatSmartFormCopy(
  template: string,
  values: Record<string, number | string>
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function localizedPlainText(
  value: Parameters<typeof resolveLocalized>[0],
  locale: string,
  i18n: SmartFormV2I18nConfig
) {
  const document = resolveLocalized(value, locale, i18n);
  return document ? richTextDocumentPlainText(document) : "";
}

function richTextDocumentPlainText(document: SmartFormV2RichTextDocument) {
  return document.content
    .flatMap((block) => richTextBlockPlainText(block))
    .join(" ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function richTextBlockPlainText(block: SmartFormV2RichTextBlock): string[] {
  switch (block.type) {
    case "paragraph":
    case "heading": {
      return block.content.map(richTextInlinePlainText);
    }
    case "bulletList":
    case "orderedList": {
      return block.items.flatMap((item) =>
        item.content.flatMap(richTextBlockPlainText)
      );
    }
    case "blockquote": {
      return block.content.flatMap(richTextBlockPlainText);
    }
    case "table": {
      return block.rows.flatMap((row) =>
        row.cells.flatMap((cell) =>
          cell.content.flatMap(richTextBlockPlainText)
        )
      );
    }
    case "embed": {
      return [block.labelSnapshot ?? block.entityId];
    }
    default: {
      return [];
    }
  }
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

function isMarkdownEditableRichText(
  document: SmartFormV2RichTextDocument,
  profile: Extract<SmartFormV2FieldDefinition, { type: "richText" }>["profile"]
) {
  const visitInline = (inline: SmartFormV2RichTextInline) =>
    inline.type !== "entityReference" &&
    (inline.type !== "text" ||
      (inline.marks ?? []).every((mark) =>
        profile.allowedMarks.includes(mark.type)
      ));
  const visitBlock = (block: SmartFormV2RichTextBlock): boolean => {
    if (!profile.allowedBlocks.includes(block.type)) {
      return false;
    }
    if (block.type === "table" || block.type === "embed") {
      return false;
    }
    if (block.type === "heading" && block.level > 3) {
      return false;
    }
    if (block.type === "paragraph" || block.type === "heading") {
      return block.content.every(visitInline);
    }
    if (block.type === "bulletList" || block.type === "orderedList") {
      return block.items.every((item) => item.content.every(visitBlock));
    }
    if (block.type === "blockquote") {
      return block.content.every(visitBlock);
    }
    return false;
  };
  return document.content.every(visitBlock);
}

function richTextEditorBlocks(
  blocks: Extract<
    SmartFormV2FieldDefinition,
    { type: "richText" }
  >["profile"]["allowedBlocks"]
): (
  | "paragraph"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "orderedList"
  | "blockquote"
)[] {
  return blocks.flatMap((block) => {
    if (block === "heading") {
      return ["heading2", "heading3"] as const;
    }
    if (
      block === "paragraph" ||
      block === "bulletList" ||
      block === "orderedList" ||
      block === "blockquote"
    ) {
      return [block];
    }
    return [];
  });
}

function validationIssueText(
  issue: SmartFormV2ResponseValidationIssue,
  copy: SmartFormV2EditorCopy
) {
  return issue.code === "required" ? copy.requiredError : copy.invalidError;
}

function emptyRichTextDocument(id: string): SmartFormV2RichTextDocument {
  return {
    type: "doc",
    version: 1,
    content: [
      { type: "paragraph", id: `${safeId(id)}-paragraph`, content: [] },
    ],
  };
}

export function smartFormDocumentToMarkdown(
  document: SmartFormV2RichTextDocument
) {
  return reviewNoteDocumentToMarkdown(smartFormDocumentToEditorJson(document));
}

export function smartFormDocumentToEditorJson(
  document: SmartFormV2RichTextDocument
): JSONContent {
  return {
    type: "doc",
    content: document.content.map(smartFormBlockToJson),
  };
}

function smartFormBlockToJson(block: SmartFormV2RichTextBlock): JSONContent {
  switch (block.type) {
    case "paragraph": {
      return {
        type: "paragraph",
        attrs: { smartFormNodeId: block.id },
        content: block.content.flatMap(smartFormInlineToJson),
      };
    }
    case "heading": {
      return {
        type: "heading",
        attrs: {
          level: Math.min(block.level, 3),
          smartFormNodeId: block.id,
        },
        content: block.content.flatMap(smartFormInlineToJson),
      };
    }
    case "bulletList":
    case "orderedList": {
      return {
        type: block.type,
        attrs: { smartFormNodeId: block.id },
        content: block.items.map((item) => ({
          type: "listItem",
          attrs: { smartFormNodeId: item.id },
          content: item.content.map(smartFormBlockToJson),
        })),
      };
    }
    case "blockquote": {
      return {
        type: "blockquote",
        attrs: { smartFormNodeId: block.id },
        content: block.content.map(smartFormBlockToJson),
      };
    }
    case "table": {
      return {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: block.rows
              .map((row) =>
                row.cells
                  .map((cell) =>
                    cell.content.flatMap(richTextBlockPlainText).join(" ")
                  )
                  .join(" | ")
              )
              .join("\n"),
          },
        ],
      };
    }
    case "embed": {
      return {
        type: "text",
        text: block.labelSnapshot ?? block.entityId,
      };
    }
    default: {
      return { type: "text", text: "" };
    }
  }
}

function smartFormInlineToJson(
  inline: SmartFormV2RichTextInline
): JSONContent[] {
  if (inline.type === "hardBreak") {
    return [{ type: "hardBreak" }];
  }
  if (inline.type === "entityReference") {
    return [
      {
        type: "text",
        text: inline.labelSnapshot ?? inline.entityId,
      },
    ];
  }
  return [
    {
      type: "text",
      text: inline.text,
      marks: inline.marks?.map((mark) =>
        mark.type === "link"
          ? { type: "link", attrs: { href: mark.href } }
          : { type: mark.type }
      ),
    },
  ];
}

export function markdownToSmartFormDocument(
  markdown: string,
  id: string,
  previousDocument?: SmartFormV2RichTextDocument
): SmartFormV2RichTextDocument {
  return editorJsonToSmartFormDocument(
    reviewNoteMarkdownToDocument(markdown),
    id,
    previousDocument
  );
}

export function editorJsonToSmartFormDocument(
  json: JSONContent,
  id: string,
  previousDocument?: SmartFormV2RichTextDocument
): SmartFormV2RichTextDocument {
  const previousBlocks = previousDocument?.content ?? [];
  const allocateId = createRichTextIdAllocator(json, previousDocument, id);
  const previousByNewIndex = reconcileRichTextBlocks(
    json.content ?? [],
    previousBlocks
  );
  const content = (json.content ?? []).map((node, index) => {
    const previous = previousByNewIndex.get(index);
    return jsonBlockToSmartForm(
      node,
      allocateId(node, previous?.id),
      previous,
      allocateId
    );
  });
  return {
    type: "doc",
    version: 1,
    content:
      content.length > 0
        ? content
        : [
            {
              type: "paragraph",
              id:
                previousBlocks[0]?.type === "paragraph"
                  ? previousBlocks[0].id
                  : createRichTextNodeId(id),
              content: [],
            },
          ],
  };
}

function jsonBlockToSmartForm(
  node: JSONContent,
  id: string,
  previous: SmartFormV2RichTextBlock | undefined,
  allocateId: RichTextIdAllocator
): SmartFormV2RichTextBlock {
  if (node.type === "heading") {
    const level = node.attrs?.level === 3 ? 3 : 2;
    return {
      type: "heading",
      id,
      level,
      content: jsonInlinesToSmartForm(node.content),
    };
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    const previousItems = previous?.type === node.type ? previous.items : [];
    return {
      type: node.type,
      id,
      items: (node.content ?? []).map((item, itemIndex) => ({
        id: allocateId(item, previousItems[itemIndex]?.id, `${id}-item`),
        content: (item.content ?? []).map((child, childIndex) =>
          jsonBlockToSmartForm(
            child,
            allocateId(
              child,
              previousItems[itemIndex]?.content[childIndex]?.id,
              `${id}-item-block`
            ),
            previousItems[itemIndex]?.content[childIndex],
            allocateId
          )
        ),
      })),
    };
  }
  if (node.type === "blockquote") {
    const previousContent =
      previous?.type === "blockquote" ? previous.content : [];
    return {
      type: "blockquote",
      id,
      content: (node.content ?? []).map((child, childIndex) =>
        jsonBlockToSmartForm(
          child,
          allocateId(child, previousContent[childIndex]?.id, `${id}-quote`),
          previousContent[childIndex],
          allocateId
        )
      ),
    };
  }
  return {
    type: "paragraph",
    id,
    content: jsonInlinesToSmartForm(node.content),
  };
}

function reconcileRichTextBlocks(
  nextNodes: JSONContent[],
  previousBlocks: SmartFormV2RichTextBlock[]
) {
  const matches = new Map<number, SmartFormV2RichTextBlock>();
  const usedPrevious = new Set<number>();
  const nextFingerprints = nextNodes.map(jsonBlockFingerprint);
  const previousFingerprints = previousBlocks.map(smartFormBlockFingerprint);

  // Preserve unchanged blocks across insertions/deletions before applying a
  // Positional fallback for the block currently being edited.
  let previousCursor = 0;
  nextFingerprints.forEach((fingerprint, nextIndex) => {
    const previousIndex = previousFingerprints.findIndex(
      (candidate, index) =>
        index >= previousCursor &&
        !usedPrevious.has(index) &&
        candidate === fingerprint
    );
    if (previousIndex === -1) {
      return;
    }
    matches.set(nextIndex, previousBlocks[previousIndex]);
    usedPrevious.add(previousIndex);
    previousCursor = previousIndex + 1;
  });

  if (nextNodes.length !== previousBlocks.length) {
    return matches;
  }

  nextNodes.forEach((node, nextIndex) => {
    if (matches.has(nextIndex)) {
      return;
    }
    const kind = jsonBlockKind(node);
    const candidates = previousBlocks
      .map((block, index) => ({ block, index }))
      .filter(
        ({ block, index }) =>
          !usedPrevious.has(index) && smartFormBlockKind(block) === kind
      )
      .sort(
        (left, right) =>
          Math.abs(left.index - nextIndex) - Math.abs(right.index - nextIndex)
      );
    const [candidate] = candidates;
    if (!candidate) {
      return;
    }
    matches.set(nextIndex, candidate.block);
    usedPrevious.add(candidate.index);
  });

  return matches;
}

function jsonNodeId(node: JSONContent) {
  const value = node.attrs?.smartFormNodeId;
  return typeof value === "string" && value.trim() ? value : undefined;
}

type RichTextIdAllocator = (
  node: JSONContent,
  previousId?: string,
  prefix?: string
) => string;

/** A paragraph/list split can copy TipTap node attributes. Keep the old ID with
 * unchanged content, reserve other incoming IDs, and repair only collisions. */
function createRichTextIdAllocator(
  json: JSONContent,
  previousDocument: SmartFormV2RichTextDocument | undefined,
  fieldId: string
): RichTextIdAllocator {
  const collect = (node: JSONContent, result: Map<string, JSONContent[]>) => {
    const nodeId = jsonNodeId(node);
    if (nodeId) {
      const entries = result.get(nodeId) ?? [];
      entries.push(node);
      result.set(nodeId, entries);
    }
    for (const child of node.content ?? []) {
      collect(child, result);
    }
  };
  const fingerprint = (node: JSONContent): string => {
    const parts: unknown[] = [];
    const visit = (current: JSONContent) => {
      parts.push(
        current.type,
        current.text ?? "",
        current.attrs?.level ?? null,
        current.content?.length ?? 0
      );
      for (const child of current.content ?? []) {
        visit(child);
      }
    };
    visit(node);
    return JSON.stringify(parts);
  };
  const incoming = new Map<string, JSONContent[]>();
  const previous = new Map<string, JSONContent[]>();
  collect(json, incoming);
  if (previousDocument) {
    collect(smartFormDocumentToEditorJson(previousDocument), previous);
  }
  const owners = new Map<string, JSONContent>();
  for (const [nodeId, nodes] of incoming) {
    if (nodes.length === 1) {
      owners.set(nodeId, nodes[0]);
      continue;
    }
    const old = previous.get(nodeId)?.[0];
    const oldFingerprint = old ? fingerprint(old) : undefined;
    const owner = old
      ? nodes.find((node) => fingerprint(node) === oldFingerprint)
      : undefined;
    owners.set(nodeId, owner ?? nodes[0]);
  }
  const used = new Set<string>();
  return (node, previousId, prefix = fieldId) => {
    const canUse = (candidate: string | undefined): candidate is string =>
      Boolean(
        candidate &&
        !used.has(candidate) &&
        (!owners.has(candidate) || owners.get(candidate) === node)
      );
    const incomingId = jsonNodeId(node);
    let result = canUse(incomingId)
      ? incomingId
      : canUse(previousId)
        ? previousId
        : undefined;
    while (!result) {
      const generated = createRichTextNodeId(prefix);
      if (canUse(generated)) {
        result = generated;
      }
    }
    used.add(result);
    return result;
  };
}

function jsonBlockKind(node: JSONContent) {
  if (node.type === "heading") {
    return "heading";
  }
  if (node.type === "bulletList") {
    return "bulletList";
  }
  if (node.type === "orderedList") {
    return "orderedList";
  }
  if (node.type === "blockquote") {
    return "blockquote";
  }
  return "paragraph";
}

function smartFormBlockKind(block: SmartFormV2RichTextBlock) {
  return block.type;
}

function jsonBlockFingerprint(node: JSONContent) {
  return reviewNoteDocumentToMarkdown({
    type: "doc",
    content: [node],
  }).trim();
}

function smartFormBlockFingerprint(block: SmartFormV2RichTextBlock) {
  return smartFormDocumentToMarkdown({
    type: "doc",
    version: 1,
    content: [block],
  }).trim();
}

let richTextNodeSequence = 0;

function createRichTextNodeId(prefix: string) {
  richTextNodeSequence += 1;
  return `${safeId(prefix)}-${Date.now().toString(36)}-${richTextNodeSequence.toString(36)}`;
}

function jsonInlinesToSmartForm(
  content: JSONContent[] | undefined
): SmartFormV2RichTextInline[] {
  return (content ?? []).flatMap<SmartFormV2RichTextInline>((node) => {
    if (node.type === "hardBreak") {
      return [{ type: "hardBreak" as const }];
    }
    if (node.type !== "text" || !node.text) {
      return [];
    }
    const marks = (node.marks ?? []).flatMap<SmartFormV2RichTextMark>(
      (mark) => {
        if (mark.type === "link" && mark.attrs?.href) {
          return [{ type: "link" as const, href: String(mark.attrs.href) }];
        }
        if (
          mark.type === "bold" ||
          mark.type === "italic" ||
          mark.type === "underline" ||
          mark.type === "strike" ||
          mark.type === "code"
        ) {
          return [{ type: mark.type }];
        }
        return [];
      }
    );
    return [
      {
        type: "text" as const,
        text: node.text,
        ...(marks.length > 0 ? { marks } : {}),
      },
    ];
  });
}

function richTextSummary(markdown: string, emptyValue: string) {
  const summary = markdown
    .replaceAll(/^#{1,6}\s+/gm, "")
    .replaceAll(/^[-*>]\s+/gm, "")
    .replaceAll(/^\d+\.\s+/gm, "")
    .replaceAll(/[*_~`[\]()]/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
  return summary || emptyValue;
}

function safeId(value: string) {
  return value.replaceAll(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 120);
}
