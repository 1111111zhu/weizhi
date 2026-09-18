"use client";

import type {
  AuditProcedureSheetProps,
  SmartFormV2CompiledDefinition,
  SmartFormV2Definition,
  SmartFormV2FieldDefinition,
  SmartFormV2FixedSheetRow,
  SmartFormV2LocalizedRichText,
  SmartFormV2Node,
  SmartFormV2NumberingRule,
  SmartFormV2Response,
  SmartFormV2RichTextDocument,
  SmartFormV2SheetColumnNode,
  SmartFormV2SheetLeafColumn,
  SmartFormV2SheetNode,
} from "@project-wing/shared";
import {
  AUDIT_PROCEDURE_SHEET_COMPONENT_ID,
  AuditProcedureSheetPropsSchema,
  STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY,
  compileSmartFormV2Definition,
} from "@project-wing/shared";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/extend/ui/button";
import { Input } from "@/components/extend/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { SmartFormV2PuckEditor } from "./smart-form-v2-puck-editor";
import type { SmartFormPuckCopy } from "./smart-form-v2-puck-editor";
import { formatOrdinal } from "./smart-form-v2-readonly";
import type { SmartFormV2ReadonlyCopy } from "./smart-form-v2-readonly";
import { SmartFormV2RequiredIndicator } from "./smart-form-v2-required-indicator";

import tableStyles from "@/components/smart-form-v2-table.module.css";

export type SmartFormV2TemplateDesignerCopy = {
  designerLabel: string;
  save: string;
  saved: string;
  unsaved: string;
  outline: string;
  preview: string;
  inspector: string;
  template: string;
  astBadge: string;
  title: string;
  description: string;
  addSection: string;
  addTopLevelContent: string;
  addField: string;
  addContent: string;
  addSheet: string;
  procedureRows: string;
  procedureLabel: string;
  addProcedure: string;
  procedureSheetTitleZh: string;
  procedureSheetTitleEn: string;
  descriptionPlaceholderZh: string;
  descriptionPlaceholderEn: string;
  deleteNode: string;
  selectNode: string;
  section: string;
  group: string;
  field: string;
  content: string;
  sheet: string;
  component: string;
  fieldLabel: string;
  fieldType: string;
  required: string;
  optional: string;
  choice: string;
  text: string;
  richText: string;
  yes: string;
  no: string;
  noSelection: string;
  invalidDefinition: string;
  sectionTitlePlaceholder: string;
  fieldLabelPlaceholder: string;
  descriptionPlaceholder: string;
  contextHint: string;
  canvasMenu: string;
  newSectionAfter: string;
  insertQuestion: string;
  insertTable: string;
  editSection: string;
  editQuestion: string;
  editConditional: string;
  conditionOperator: string;
  conditionExpected: string;
  conditionIncludesAny: string;
  conditionIncludesAll: string;
  conditionSelected: string;
  conditionTrigger: string;
  conditionNoMatch: string;
  conditionAddBranch: string;
  conditionIf: string;
  conditionElseIf: string;
  editTable: string;
  editContent: string;
  delete: string;
  cancel: string;
  create: string;
  update: string;
  questionLabel: string;
  questionHelp: string;
  questionType: string;
  singleChoice: string;
  multipleChoice: string;
  number: string;
  reference: string;
  attachment: string;
  date: string;
  optionsOnePerLine: string;
  optionsPlaceholder: string;
  cardinality: string;
  one: string;
  many: string;
  numberFormat: string;
  decimal: string;
  currency: string;
  percent: string;
  currencyCode: string;
  tableTitle: string;
  rowHeader: string;
  columns: string;
  columnHeader: string;
  columnType: string;
  addColumn: string;
  rows: string;
  rowLabel: string;
  rowType: string;
  questionRow: string;
  staticRow: string;
  addRow: string;
  remove: string;
  parentRow: string;
  level: string;
  topLevel: string;
  moveUp: string;
  moveDown: string;
  indentRow: string;
  outdentRow: string;
  expandGroup: string;
  collapseGroup: string;
  deleteTitle: string;
  deleteDescription: string;
  confirmDelete: string;
  manageStructure: string;
  structureRecovery: string;
  structureRecoveryDescription: string;
  edit: string;
  staticText: string;
  conditional: string;
  conditionMatched: string;
  conditionOtherwise: string;
  branchQuestionPlaceholder: string;
  ribbonInsert: string;
  ribbonEdit: string;
  ribbonView: string;
  undo: string;
  redo: string;
  moreCommands: string;
  language: string;
  languageChinese: string;
  languageEnglish: string;
  translationMode: string;
  chineseReference: string;
  dropIntoSection: string;
  dropIntoDocument: string;
  staticTextPlaceholder: string;
};

type Props = {
  initialDefinition: SmartFormV2Definition;
  response?: SmartFormV2Response;
  locale: string;
  copy: SmartFormV2TemplateDesignerCopy;
  readonlyCopy: SmartFormV2ReadonlyCopy;
  onSave?: (definition: SmartFormV2Definition) => void;
  className?: string;
  headerContext?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  headerActions?: ReactNode;
};

type FieldEditorType =
  | "singleChoice"
  | "multipleChoice"
  | "text"
  | "richText"
  | "number"
  | "reference"
  | "attachment"
  | "date";

type SectionEditorState = {
  nodeId?: string;
  parentId?: string;
  afterId?: string;
  title: string;
  description: string;
  referenceTitle?: string;
  referenceDescription?: string;
};

type QuestionEditorState = {
  nodeId?: string;
  parentId?: string;
  afterId?: string;
  label: string;
  help: string;
  type: FieldEditorType;
  required: boolean;
  options: string;
  cardinality: "one" | "many";
  numberFormat: "decimal" | "currency" | "percent";
  currencyCode: string;
  referenceLabel?: string;
  referenceHelp?: string;
  referenceOptions?: string;
  source?: SmartFormV2FieldDefinition;
};

type TableColumnDraft = {
  id?: string;
  header: string;
  type: FieldEditorType;
  required: boolean;
  options: string;
  cardinality: "one" | "many";
  numberFormat: "decimal" | "currency" | "percent";
  currencyCode: string;
  referenceHeader?: string;
  referenceOptions?: string;
  source?: SmartFormV2SheetLeafColumn;
};

type TableRowDraft = {
  id?: string;
  label: string;
  role: "data" | "group";
  depth: number;
  referenceLabel?: string;
  source?: SmartFormV2FixedSheetRow;
};

type TableEditorState = {
  nodeId?: string;
  parentId?: string;
  afterId?: string;
  title: string;
  description: string;
  rowHeader: string;
  referenceTitle?: string;
  referenceDescription?: string;
  referenceRowHeader?: string;
  columns: TableColumnDraft[];
  rows: TableRowDraft[];
  source?: SmartFormV2SheetNode;
};

type TableDesignerSelection =
  | { kind: "table" }
  | { kind: "column"; index: number }
  | { kind: "row"; index: number };

type ContentEditorState = {
  nodeId: string;
  value: string;
  referenceValue?: string;
};

type ConditionalQuestionType = "singleChoice" | "multipleChoice" | "number";
type ConditionalEditorOperator =
  | "selected"
  | "includesAny"
  | "includesAll"
  | "gt"
  | "gte"
  | "eq"
  | "lte"
  | "lt";
type ConditionalEditorArmState = {
  id: string;
  operator: ConditionalEditorOperator;
  expectedOptions: string[];
  numberValue: string;
};
type ConditionalEditorState = {
  nodeId: string;
  label: string;
  help: string;
  type: ConditionalQuestionType;
  required: boolean;
  options: string;
  branches: ConditionalEditorArmState[];
  referenceLabel?: string;
  referenceHelp?: string;
  referenceOptions?: string;
  source: Extract<SmartFormV2Node, { kind: "conditional" }>;
};

export function SmartFormV2TemplateDesigner({
  initialDefinition,
  locale,
  copy,
  readonlyCopy,
  onSave,
  className,
  headerActions,
  headerContext,
  headerSubtitle,
  headerTitle,
}: Props) {
  const [definition, setDefinition] = useState(initialDefinition);
  const [savedDefinition, setSavedDefinition] = useState(initialDefinition);
  const [previewDefinition, setPreviewDefinition] = useState(initialDefinition);
  const [sectionEditor, setSectionEditor] = useState<SectionEditorState>();
  const [questionEditor, setQuestionEditor] = useState<QuestionEditorState>();
  const [tableEditor, setTableEditor] = useState<TableEditorState>();
  const [contentEditor, setContentEditor] = useState<ContentEditorState>();
  const [conditionalEditor, setConditionalEditor] =
    useState<ConditionalEditorState>();
  const [saveError, setSaveError] = useState<string>();
  const { defaultLocale } = definition.i18n;
  const [editingLocale, setEditingLocale] = useState(() =>
    definition.i18n.supportedLocales.includes(locale) ? locale : defaultLocale
  );
  const translationMode = editingLocale !== defaultLocale;

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setPreviewDefinition(definition),
      250
    );
    return () => window.clearTimeout(timeout);
  }, [definition]);

  const dirty = useMemo(
    () => JSON.stringify(definition) !== JSON.stringify(savedDefinition),
    [definition, savedDefinition]
  );
  const compiled = useMemo(() => {
    try {
      return {
        value: compileSmartFormV2Definition(
          previewDefinition,
          STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
        ),
      } as { value: SmartFormV2CompiledDefinition; error?: undefined };
    } catch (error) {
      return {
        value: undefined,
        error:
          error instanceof Error ? error : new Error(copy.invalidDefinition),
      };
    }
  }, [copy.invalidDefinition, previewDefinition]);
  const { supportedLocales } = definition.i18n;
  const puckCopy = useMemo<SmartFormPuckCopy>(
    () => ({
      section: copy.section,
      staticText: copy.staticText,
      conditional: copy.conditional,
      conditionMatched: copy.conditionMatched,
      conditionOtherwise: copy.conditionOtherwise,
      conditionSelected: copy.conditionSelected,
      conditionIncludesAny: copy.conditionIncludesAny,
      conditionIncludesAll: copy.conditionIncludesAll,
      conditionIf: copy.conditionIf,
      conditionElseIf: copy.conditionElseIf,
      branchQuestionPlaceholder: copy.branchQuestionPlaceholder,
      question: copy.questionLabel,
      table: copy.sheet,
      insert: copy.ribbonInsert,
      editGroup: copy.ribbonEdit,
      viewGroup: copy.ribbonView,
      undo: copy.undo,
      redo: copy.redo,
      moreCommands: copy.moreCommands,
      preview: copy.preview,
      language: copy.language,
      languageChinese: copy.languageChinese,
      languageEnglish: copy.languageEnglish,
      translationMode: copy.translationMode,
      chineseReference: copy.chineseReference,
      save: copy.save,
      saved: copy.saved,
      unsaved: copy.unsaved,
      edit: copy.edit,
      required: copy.required,
      optional: copy.optional,
      emptyValue: readonlyCopy.emptyValue,
      dropIntoSection: copy.dropIntoSection,
      dropIntoDocument: copy.dropIntoDocument,
      sectionTitlePlaceholder: copy.sectionTitlePlaceholder,
      staticTextPlaceholder: copy.staticTextPlaceholder,
      fieldLabelPlaceholder: copy.fieldLabelPlaceholder,
      tableTitlePlaceholder: copy.tableTitle,
      rowHeader: copy.rowHeader,
      columnHeader: copy.columnHeader,
      rowLabel: copy.rowLabel,
      yes: copy.yes,
      no: copy.no,
      singleChoice: copy.singleChoice,
      multipleChoice: copy.multipleChoice,
      text: copy.text,
      richText: copy.richText,
      number: copy.number,
      reference: copy.reference,
      attachment: copy.attachment,
      date: copy.date,
    }),
    [copy, readonlyCopy.emptyValue]
  );

  function commit(next: SmartFormV2Definition) {
    setSaveError(undefined);
    setDefinition(cleanComponentLocks(next));
  }

  function handleSave() {
    try {
      compileSmartFormV2Definition(
        definition,
        STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
      );
    } catch {
      setSaveError(copy.invalidDefinition);
      return;
    }
    setSaveError(undefined);
    setSavedDefinition(definition);
    onSave?.(definition);
  }

  function openEditSection(node: SmartFormV2Node) {
    if (node.kind !== "section" && node.kind !== "group") {
      return;
    }
    setSectionEditor({
      nodeId: node.id,
      title: readLocalizedExact(node.title, editingLocale),
      description: readLocalizedExact(node.description, editingLocale),
      referenceTitle: translationMode
        ? readLocalizedExact(node.title, defaultLocale)
        : undefined,
      referenceDescription: translationMode
        ? readLocalizedExact(node.description, defaultLocale)
        : undefined,
    });
  }

  function openEditQuestion(node: SmartFormV2Node) {
    if (node.kind !== "field") {
      return;
    }
    const parent = findParentContainer(definition.children, node.id);
    setQuestionEditor({
      nodeId: node.id,
      parentId: parent?.id,
      label: readLocalizedExact(node.label, editingLocale),
      help: readLocalizedExact(node.help, editingLocale),
      referenceLabel: translationMode
        ? readLocalizedExact(node.label, defaultLocale)
        : undefined,
      referenceHelp: translationMode
        ? readLocalizedExact(node.help, defaultLocale)
        : undefined,
      type: editorTypeForField(node.value),
      required: Boolean(node.required),
      options:
        node.value.type === "choice"
          ? node.value.options
              .map((option) => readLocalizedExact(option.label, editingLocale))
              .join("\n")
          : `${copy.yes}\n${copy.no}`,
      referenceOptions:
        translationMode && node.value.type === "choice"
          ? node.value.options
              .map((option) => readLocalizedExact(option.label, defaultLocale))
              .join("\n")
          : undefined,
      cardinality:
        node.value.type === "choice" ||
        node.value.type === "reference" ||
        node.value.type === "attachment"
          ? node.value.cardinality
          : "one",
      numberFormat:
        node.value.type === "number"
          ? (node.value.format ?? "decimal")
          : "decimal",
      currencyCode:
        node.value.type === "number"
          ? (node.value.currencyCode ?? "USD")
          : "USD",
      source: node.value,
    });
  }

  function openEditConditional(
    node: Extract<SmartFormV2Node, { kind: "conditional" }>
  ) {
    const question = node.branchQuestion;
    const type = editorTypeForField(question.value) as ConditionalQuestionType;
    const optionLabels =
      question.value.type === "choice"
        ? question.value.options.map((option) => ({
            id: option.id,
            label: readLocalizedExact(option.label, editingLocale),
            reference: translationMode
              ? readLocalizedExact(option.label, defaultLocale)
              : undefined,
          }))
        : [];
    setConditionalEditor({
      nodeId: node.id,
      label: readLocalizedExact(question.label, editingLocale),
      help: readLocalizedExact(question.help, editingLocale),
      type,
      required: question.required,
      options: optionLabels.map((option) => option.label).join("\n"),
      branches: node.branches.map((branch) => {
        const expectedOptionIds =
          branch.comparison.type === "singleChoice"
            ? [branch.comparison.optionId]
            : branch.comparison.type === "multipleChoice"
              ? branch.comparison.optionIds
              : [];
        return {
          id: branch.id,
          operator: branch.comparison.operator,
          expectedOptions: optionLabels
            .filter((option) => expectedOptionIds.includes(option.id))
            .map((option) => option.label),
          numberValue:
            branch.comparison.type === "number" ? branch.comparison.value : "0",
        };
      }),
      referenceLabel: translationMode
        ? readLocalizedExact(question.label, defaultLocale)
        : undefined,
      referenceHelp: translationMode
        ? readLocalizedExact(question.help, defaultLocale)
        : undefined,
      referenceOptions: translationMode
        ? optionLabels.map((option) => option.reference ?? "").join("\n")
        : undefined,
      source: node,
    });
  }

  function openEditTable(node: SmartFormV2Node) {
    if (node.kind !== "sheet" && node.kind !== "component") {
      return;
    }
    const parent = findParentContainer(definition.children, node.id);
    const source =
      node.kind === "sheet"
        ? node
        : findCompiledSheet(compiled.value?.children ?? [], node.id);
    if (!source || source.rows.mode !== "fixed") {
      return;
    }
    const leafColumns = flattenSheetColumns(source.columns);
    const rowHeaderColumn = leafColumns.find(
      (column) => column.cell.kind === "rowLabel"
    );
    setTableEditor({
      nodeId: node.id,
      parentId: parent?.id,
      title: readLocalizedExact(source.title, editingLocale),
      description: readLocalizedExact(source.description, editingLocale),
      rowHeader: rowHeaderColumn
        ? readLocalizedExact(rowHeaderColumn.header, editingLocale)
        : copy.rowHeader,
      referenceTitle: translationMode
        ? readLocalizedExact(source.title, defaultLocale)
        : undefined,
      referenceDescription: translationMode
        ? readLocalizedExact(source.description, defaultLocale)
        : undefined,
      referenceRowHeader:
        translationMode && rowHeaderColumn
          ? readLocalizedExact(rowHeaderColumn.header, defaultLocale)
          : undefined,
      columns: leafColumns
        .filter((column) => column.cell.kind === "field")
        .map((column) =>
          tableColumnDraftFromSource(
            column,
            editingLocale,
            copy,
            translationMode ? defaultLocale : undefined
          )
        ),
      rows: flattenTableRows(
        source.rows.items,
        editingLocale,
        0,
        translationMode ? defaultLocale : undefined
      ),
      source,
    });
  }

  function submitSection() {
    if (!sectionEditor?.title.trim()) {
      return;
    }
    if (sectionEditor.nodeId) {
      commit(
        mapNodes(definition, sectionEditor.nodeId, (node) =>
          node.kind === "section" || node.kind === "group"
            ? {
                ...node,
                title: updateLocalizedText(
                  node.title,
                  sectionEditor.title.trim(),
                  editingLocale,
                  `${node.id}-title`,
                  supportedLocales
                ),
                description: optionalLocalizedText(
                  node.description,
                  sectionEditor.description,
                  editingLocale,
                  `${node.id}-description`,
                  supportedLocales
                ),
              }
            : node
        )
      );
    } else {
      const id = createId("section");
      const node: SmartFormV2Node = {
        kind: "section",
        id,
        title: localizedText(
          sectionEditor.title.trim(),
          `${id}-title`,
          editingLocale
        ),
        description: sectionEditor.description.trim()
          ? localizedText(
              sectionEditor.description.trim(),
              `${id}-description`,
              editingLocale
            )
          : undefined,
        children: [],
      };
      commit(
        sectionEditor.parentId
          ? insertIntoContainer(
              definition,
              sectionEditor.parentId,
              node,
              sectionEditor.afterId
            )
          : insertAtRoot(definition, node, sectionEditor.afterId)
      );
    }
    setSectionEditor(undefined);
  }

  function submitQuestion() {
    if (!questionEditor?.label.trim()) {
      return;
    }
    const value = fieldDefinitionFromEditor(
      questionEditor,
      copy,
      editingLocale,
      supportedLocales,
      questionEditor.source
    );
    if (!value) {
      return;
    }
    if (questionEditor.nodeId) {
      commit(
        mapNodes(definition, questionEditor.nodeId, (node) =>
          node.kind === "field"
            ? {
                ...node,
                label: updateLocalizedText(
                  node.label,
                  questionEditor.label.trim(),
                  editingLocale,
                  `${node.id}-label`,
                  supportedLocales
                ),
                help: optionalLocalizedText(
                  node.help,
                  questionEditor.help,
                  editingLocale,
                  `${node.id}-help`,
                  supportedLocales
                ),
                value,
                required: questionEditor.required,
              }
            : node
        )
      );
    } else {
      const id = createId("field");
      const node: SmartFormV2Node = {
        kind: "field",
        id,
        label: localizedText(
          questionEditor.label.trim(),
          `${id}-label`,
          editingLocale
        ),
        help: questionEditor.help.trim()
          ? localizedText(
              questionEditor.help.trim(),
              `${id}-help`,
              editingLocale
            )
          : undefined,
        value,
        required: questionEditor.required,
      };
      commit(
        questionEditor.parentId
          ? insertIntoContainer(
              definition,
              questionEditor.parentId,
              node,
              questionEditor.afterId
            )
          : insertAtRoot(definition, node, questionEditor.afterId)
      );
    }
    setQuestionEditor(undefined);
  }

  function submitConditional() {
    if (!conditionalEditor?.label.trim()) {
      return;
    }
    const questionDraft: QuestionEditorState = {
      nodeId: conditionalEditor.source.branchQuestion.id,
      label: conditionalEditor.label,
      help: conditionalEditor.help,
      type: conditionalEditor.type,
      required: conditionalEditor.required,
      options: conditionalEditor.options,
      cardinality: conditionalEditor.type === "multipleChoice" ? "many" : "one",
      numberFormat: "decimal",
      currencyCode: "USD",
      source: conditionalEditor.source.branchQuestion.value,
    };
    const value = fieldDefinitionFromEditor(
      questionDraft,
      copy,
      editingLocale,
      supportedLocales,
      conditionalEditor.source.branchQuestion.value
    );
    if (!value || (value.type !== "choice" && value.type !== "number")) {
      return;
    }
    const sourceBranches = new Map(
      conditionalEditor.source.branches.map((branch) => [branch.id, branch])
    );
    const branches = conditionalEditor.branches.map((editorBranch, index) => {
      const sourceBranch =
        sourceBranches.get(editorBranch.id) ??
        conditionalEditor.source.branches[index];
      const selectedOptionIds =
        value.type === "choice"
          ? value.options
              .filter((option) =>
                editorBranch.expectedOptions.includes(
                  readLocalizedExact(option.label, editingLocale)
                )
              )
              .map((option) => option.id)
          : [];
      const comparison = translationMode
        ? (sourceBranch?.comparison ?? editorBranchToComparison(editorBranch))
        : value.type === "number"
          ? {
              type: "number" as const,
              operator: (["gt", "gte", "eq", "lte", "lt"].includes(
                editorBranch.operator
              )
                ? editorBranch.operator
                : "gte") as "gt" | "gte" | "eq" | "lte" | "lt",
              value: editorBranch.numberValue || "0",
            }
          : value.cardinality === "many"
            ? {
                type: "multipleChoice" as const,
                operator:
                  editorBranch.operator === "includesAll"
                    ? ("includesAll" as const)
                    : ("includesAny" as const),
                optionIds: selectedOptionIds,
              }
            : {
                type: "singleChoice" as const,
                operator: "selected" as const,
                optionId: selectedOptionIds[0] ?? "",
              };
      return {
        id: editorBranch.id,
        comparison,
        children: sourceBranch?.children ?? [],
      };
    });
    commit(
      mapNodes(definition, conditionalEditor.nodeId, (node) =>
        node.kind === "conditional"
          ? {
              ...node,
              branchQuestion: {
                ...node.branchQuestion,
                label: updateLocalizedText(
                  node.branchQuestion.label,
                  conditionalEditor.label.trim(),
                  editingLocale,
                  `${node.branchQuestion.id}-label`,
                  supportedLocales
                ),
                help: optionalLocalizedText(
                  node.branchQuestion.help,
                  conditionalEditor.help,
                  editingLocale,
                  `${node.branchQuestion.id}-help`,
                  supportedLocales
                ),
                value,
                required: conditionalEditor.required,
              },
              branches,
              otherwise: {
                ...node.otherwise,
              },
            }
          : node
      )
    );
    setConditionalEditor(undefined);
  }

  function submitTable() {
    if (
      (!translationMode && !tableEditor?.rowHeader.trim()) ||
      (!translationMode && !tableEditor?.columns.length) ||
      (!translationMode && !tableEditor?.rows.length) ||
      (!translationMode &&
        tableEditor?.columns.some((column) => tableColumnInvalid(column))) ||
      (!translationMode && tableEditor?.rows.some((row) => !row.label.trim()))
    ) {
      return;
    }
    if (!tableEditor) {
      return;
    }
    if (translationMode && tableEditor.nodeId) {
      const sourceNode = findNode(definition.children, tableEditor.nodeId);
      const translatedComponent = updateAuditProcedureComponentTranslation(
        sourceNode,
        tableEditor,
        editingLocale,
        supportedLocales
      );
      if (translatedComponent) {
        commit(
          mapNodes(definition, tableEditor.nodeId, () => translatedComponent)
        );
        setTableEditor(undefined);
        return;
      }
    }
    const id = tableEditor.nodeId ?? createId("sheet");
    const sheet = buildSheetNode(
      id,
      tableEditor,
      editingLocale,
      copy,
      supportedLocales
    );
    if (tableEditor.nodeId) {
      commit(mapNodes(definition, tableEditor.nodeId, () => sheet));
    } else {
      commit(
        tableEditor.parentId
          ? insertIntoContainer(
              definition,
              tableEditor.parentId,
              sheet,
              tableEditor.afterId
            )
          : insertAtRoot(definition, sheet, tableEditor.afterId)
      );
    }
    setTableEditor(undefined);
  }

  function submitContent() {
    if (!contentEditor?.value.trim()) {
      return;
    }
    commit(
      mapNodes(definition, contentEditor.nodeId, (node) =>
        node.kind === "content"
          ? {
              ...node,
              content: updateLocalizedText(
                node.content,
                contentEditor.value.trim(),
                editingLocale,
                `${node.id}-content`,
                supportedLocales
              ),
            }
          : node
      )
    );
    setContentEditor(undefined);
  }

  function editNode(nodeId: string) {
    const node = findNode(definition.children, nodeId);
    if (!node) {
      return;
    }
    // Generic compiled components do not expose a locale-safe text contract.
    // Converting one to a native sheet while translating would mutate structure,
    // So keep it read-only outside the template's primary language.
    if (
      translationMode &&
      node.kind === "component" &&
      node.componentId !== AUDIT_PROCEDURE_SHEET_COMPONENT_ID
    ) {
      return;
    }
    if (node.kind === "section" || node.kind === "group") {
      return openEditSection(node);
    }
    if (node.kind === "conditional") {
      openEditConditional(node);
      return;
    }
    if (node.kind === "field") {
      return openEditQuestion(node);
    }
    if (node.kind === "content") {
      setContentEditor({
        nodeId: node.id,
        value: readLocalizedExact(node.content, editingLocale),
        referenceValue: translationMode
          ? readLocalizedExact(node.content, defaultLocale)
          : undefined,
      });
      return;
    }
    openEditTable(node);
  }

  return (
    <div className={cn("h-full min-h-0", className)}>
      <SmartFormV2PuckEditor
        definition={definition}
        compiledDefinition={compiled.value}
        locale={editingLocale}
        defaultLocale={defaultLocale}
        supportedLocales={supportedLocales}
        onLocaleChange={setEditingLocale}
        copy={puckCopy}
        dirty={dirty}
        saveError={
          saveError ?? (compiled.error ? copy.invalidDefinition : undefined)
        }
        headerActions={headerActions}
        headerContext={headerContext}
        headerSubtitle={headerSubtitle}
        headerTitle={headerTitle}
        onChange={(next) => {
          setSaveError(undefined);
          setDefinition(cleanComponentLocks(next));
        }}
        onEditNode={editNode}
        onSave={handleSave}
        className="h-full"
      />

      <SectionDialog
        state={sectionEditor}
        copy={copy}
        translationMode={translationMode}
        onChange={setSectionEditor}
        onClose={() => setSectionEditor(undefined)}
        onSubmit={submitSection}
      />
      <QuestionDialog
        state={questionEditor}
        copy={copy}
        translationMode={translationMode}
        onChange={setQuestionEditor}
        onClose={() => setQuestionEditor(undefined)}
        onSubmit={submitQuestion}
      />
      <TableDialog
        state={tableEditor}
        copy={copy}
        translationMode={translationMode}
        onChange={setTableEditor}
        onClose={() => setTableEditor(undefined)}
        onSubmit={submitTable}
      />
      <ContentDialog
        state={contentEditor}
        copy={copy}
        translationMode={translationMode}
        onChange={setContentEditor}
        onClose={() => setContentEditor(undefined)}
        onSubmit={submitContent}
      />
      <ConditionalDialog
        state={conditionalEditor}
        copy={copy}
        translationMode={translationMode}
        onChange={setConditionalEditor}
        onClose={() => setConditionalEditor(undefined)}
        onSubmit={submitConditional}
      />
    </div>
  );
}

function SectionDialog({
  state,
  copy,
  translationMode,
  onChange,
  onClose,
  onSubmit,
}: {
  state?: SectionEditorState;
  copy: SmartFormV2TemplateDesignerCopy;
  translationMode: boolean;
  onChange: (state: SectionEditorState | undefined) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {state?.nodeId ? copy.editSection : copy.addSection}
          </DialogTitle>
          <DialogDescription>
            {translationMode ? copy.translationMode : copy.contextHint}
          </DialogDescription>
        </DialogHeader>
        {state ? (
          <div className="grid gap-4">
            <LabeledInput
              id="smart-form-section-title"
              label={copy.title}
              value={state.title}
              reference={state.referenceTitle}
              referenceLabel={copy.chineseReference}
              onChange={(title) => onChange({ ...state, title })}
            />
            <LabeledTextarea
              id="smart-form-section-description"
              label={copy.description}
              value={state.description}
              reference={state.referenceDescription}
              referenceLabel={copy.chineseReference}
              onChange={(description) => onChange({ ...state, description })}
            />
          </div>
        ) : null}
        <EditorDialogFooter
          copy={copy}
          editing={Boolean(state?.nodeId)}
          submitDisabled={!state?.title.trim()}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

function QuestionDialog({
  state,
  copy,
  translationMode,
  onChange,
  onClose,
  onSubmit,
}: {
  state?: QuestionEditorState;
  copy: SmartFormV2TemplateDesignerCopy;
  translationMode: boolean;
  onChange: (state: QuestionEditorState | undefined) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const choice =
    state?.type === "singleChoice" || state?.type === "multipleChoice";
  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {state?.nodeId ? copy.editQuestion : copy.insertQuestion}
          </DialogTitle>
          <DialogDescription>
            {translationMode ? copy.translationMode : copy.questionHelp}
          </DialogDescription>
        </DialogHeader>
        {state ? (
          <div className="grid gap-4">
            <LabeledInput
              id="smart-form-question-label"
              label={copy.questionLabel}
              value={state.label}
              reference={state.referenceLabel}
              referenceLabel={copy.chineseReference}
              onChange={(label) => onChange({ ...state, label })}
            />
            <LabeledTextarea
              id="smart-form-question-help"
              label={copy.questionHelp}
              value={state.help}
              reference={state.referenceHelp}
              referenceLabel={copy.chineseReference}
              onChange={(help) => onChange({ ...state, help })}
            />
            {translationMode ? null : (
              <div className="grid gap-1.5">
                <Label htmlFor="smart-form-question-type">
                  {copy.questionType}
                </Label>
                <Select
                  value={state.type}
                  onValueChange={(value) =>
                    onChange({ ...state, type: value as FieldEditorType })
                  }
                >
                  <SelectTrigger id="smart-form-question-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldTypeOptions(copy).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {choice ? (
              <LabeledTextarea
                id="smart-form-question-options"
                label={copy.optionsOnePerLine}
                value={state.options}
                reference={state.referenceOptions}
                referenceLabel={copy.chineseReference}
                placeholder={copy.optionsPlaceholder}
                onChange={(options) => onChange({ ...state, options })}
              />
            ) : null}
            {!translationMode &&
            (state.type === "reference" || state.type === "attachment") ? (
              <div className="grid gap-1.5">
                <Label htmlFor="smart-form-question-cardinality">
                  {copy.cardinality}
                </Label>
                <Select
                  value={state.cardinality}
                  onValueChange={(value) =>
                    onChange({
                      ...state,
                      cardinality: value as "one" | "many",
                    })
                  }
                >
                  <SelectTrigger id="smart-form-question-cardinality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one">{copy.one}</SelectItem>
                    <SelectItem value="many">{copy.many}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {!translationMode && state.type === "number" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="smart-form-number-format">
                    {copy.numberFormat}
                  </Label>
                  <Select
                    value={state.numberFormat}
                    onValueChange={(value) =>
                      onChange({
                        ...state,
                        numberFormat:
                          value as QuestionEditorState["numberFormat"],
                      })
                    }
                  >
                    <SelectTrigger id="smart-form-number-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="decimal">{copy.decimal}</SelectItem>
                      <SelectItem value="currency">{copy.currency}</SelectItem>
                      <SelectItem value="percent">{copy.percent}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {state.numberFormat === "currency" ? (
                  <LabeledInput
                    id="smart-form-currency-code"
                    label={copy.currencyCode}
                    value={state.currencyCode}
                    onChange={(currencyCode) =>
                      onChange({
                        ...state,
                        currencyCode: currencyCode.toUpperCase(),
                      })
                    }
                  />
                ) : null}
              </div>
            ) : null}
            {translationMode ? null : (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={state.required}
                  onCheckedChange={(checked) =>
                    onChange({ ...state, required: checked === true })
                  }
                />
                <SmartFormV2RequiredIndicator
                  decorative
                  required={state.required}
                  requiredLabel={copy.required}
                  optionalLabel={copy.optional}
                />
                {state.required ? copy.required : copy.optional}
              </label>
            )}
          </div>
        ) : null}
        <EditorDialogFooter
          copy={copy}
          editing={Boolean(state?.nodeId)}
          submitDisabled={
            !state?.label.trim() ||
            (choice && parseOptions(state.options).length === 0) ||
            (state?.type === "number" &&
              state.numberFormat === "currency" &&
              !/^[A-Z]{3}$/.test(state.currencyCode))
          }
          onClose={onClose}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

function conditionalQuestionTypeLabel(
  type: ConditionalQuestionType,
  copy: SmartFormV2TemplateDesignerCopy
) {
  return type === "singleChoice"
    ? copy.singleChoice
    : type === "multipleChoice"
      ? copy.multipleChoice
      : copy.number;
}

function conditionalOperatorLabel(
  operator: ConditionalEditorOperator,
  copy: SmartFormV2TemplateDesignerCopy
) {
  return {
    selected: copy.conditionSelected,
    includesAny: copy.conditionIncludesAny,
    includesAll: copy.conditionIncludesAll,
    gt: ">",
    gte: "≥",
    eq: "=",
    lte: "≤",
    lt: "<",
  }[operator];
}

function editorBranchToComparison(branch: ConditionalEditorArmState) {
  if (["gt", "gte", "eq", "lte", "lt"].includes(branch.operator)) {
    return {
      type: "number" as const,
      operator: branch.operator as "gt" | "gte" | "eq" | "lte" | "lt",
      value: branch.numberValue || "0",
    };
  }
  if (branch.operator === "includesAny" || branch.operator === "includesAll") {
    return {
      type: "multipleChoice" as const,
      operator: branch.operator,
      optionIds: branch.expectedOptions,
    };
  }
  return {
    type: "singleChoice" as const,
    operator: "selected" as const,
    optionId: branch.expectedOptions[0] ?? "",
  };
}

function ConditionalDialog({
  state,
  copy,
  translationMode,
  onChange,
  onClose,
  onSubmit,
}: {
  state?: ConditionalEditorState;
  copy: SmartFormV2TemplateDesignerCopy;
  translationMode: boolean;
  onChange: (state: ConditionalEditorState | undefined) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const choice = state?.type !== "number";
  const options = state ? parseOptions(state.options) : [];
  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{copy.editConditional}</DialogTitle>
          <DialogDescription>
            {translationMode ? copy.translationMode : copy.questionHelp}
          </DialogDescription>
        </DialogHeader>
        {state ? (
          <div className="grid gap-4">
            <LabeledInput
              id="smart-form-conditional-label"
              label={copy.questionLabel}
              value={state.label}
              reference={state.referenceLabel}
              referenceLabel={copy.chineseReference}
              onChange={(label) => onChange({ ...state, label })}
            />
            <LabeledTextarea
              id="smart-form-conditional-help"
              label={copy.questionHelp}
              value={state.help}
              reference={state.referenceHelp}
              referenceLabel={copy.chineseReference}
              onChange={(help) => onChange({ ...state, help })}
            />
            {translationMode ? null : (
              <div className="grid gap-1.5">
                <Label htmlFor="smart-form-conditional-type">
                  {copy.questionType}
                </Label>
                <Select
                  value={state.type}
                  onValueChange={(value) => {
                    const type = value as ConditionalQuestionType;
                    const nextOptions = parseOptions(state.options);
                    onChange({
                      ...state,
                      type,
                      branches: state.branches.map((branch, index) => ({
                        ...branch,
                        operator:
                          type === "number"
                            ? "gte"
                            : type === "multipleChoice"
                              ? "includesAny"
                              : "selected",
                        expectedOptions:
                          type === "number"
                            ? []
                            : nextOptions[index]
                              ? [nextOptions[index]]
                              : [],
                      })),
                    });
                  }}
                >
                  <SelectTrigger id="smart-form-conditional-type">
                    <SelectValue>
                      {conditionalQuestionTypeLabel(state.type, copy)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="singleChoice">
                      {copy.singleChoice}
                    </SelectItem>
                    <SelectItem value="multipleChoice">
                      {copy.multipleChoice}
                    </SelectItem>
                    <SelectItem value="number">{copy.number}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {choice ? (
              <LabeledTextarea
                id="smart-form-conditional-options"
                label={copy.optionsOnePerLine}
                value={state.options}
                reference={state.referenceOptions}
                referenceLabel={copy.chineseReference}
                placeholder={copy.optionsPlaceholder}
                onChange={(value) => {
                  const nextOptions = parseOptions(value);
                  onChange({
                    ...state,
                    options: value,
                    branches: state.branches.map((branch) => ({
                      ...branch,
                      expectedOptions: branch.expectedOptions.filter((option) =>
                        nextOptions.includes(option)
                      ),
                    })),
                  });
                }}
              />
            ) : null}
            {translationMode ? null : (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={state.required}
                  onCheckedChange={(checked) =>
                    onChange({ ...state, required: checked === true })
                  }
                />
                <SmartFormV2RequiredIndicator
                  decorative
                  required={state.required}
                  requiredLabel={copy.required}
                  optionalLabel={copy.optional}
                />
                {state.required ? copy.required : copy.optional}
              </label>
            )}
            <div className="overflow-hidden rounded-lg border border-border/70 bg-muted/10">
              <div className="grid grid-cols-[8rem_minmax(12rem,1fr)_2.5rem] gap-3 border-b border-border/70 bg-muted/35 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>{copy.conditional}</span>
                <span>{copy.conditionTrigger}</span>
                <span />
              </div>
              {state.branches.map((branch, branchIndex) => {
                const usedByEarlierBranches = new Set(
                  state.branches
                    .slice(0, branchIndex)
                    .flatMap((candidate) => candidate.expectedOptions)
                );
                return (
                  <div
                    className="grid grid-cols-[8rem_minmax(12rem,1fr)_2.5rem] items-center gap-3 border-b border-border/60 px-3 py-3"
                    key={branch.id}
                  >
                    <span className="text-xs font-semibold text-warning">
                      {branchIndex === 0
                        ? copy.conditionIf
                        : copy.conditionElseIf}
                    </span>
                    {translationMode ? (
                      <div className="pt-2 text-sm text-muted-foreground">
                        {conditionalOperatorLabel(branch.operator, copy)}{" "}
                        {branch.expectedOptions.join(", ") ||
                          branch.numberValue}
                      </div>
                    ) : state.type === "singleChoice" ? (
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {copy.conditionSelected}
                        </span>
                        <Select
                          value={branch.expectedOptions[0] ?? ""}
                          onValueChange={(value) =>
                            onChange({
                              ...state,
                              branches: state.branches.map(
                                (candidate, index) =>
                                  index === branchIndex
                                    ? {
                                        ...candidate,
                                        expectedOptions: value ? [value] : [],
                                      }
                                    : index > branchIndex &&
                                        value !== null &&
                                        candidate.expectedOptions.includes(
                                          value
                                        )
                                      ? { ...candidate, expectedOptions: [] }
                                      : candidate
                              ),
                            })
                          }
                        >
                          <SelectTrigger aria-label={copy.conditionTrigger}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {options
                              .filter(
                                (option) =>
                                  !usedByEarlierBranches.has(option) ||
                                  branch.expectedOptions.includes(option)
                              )
                              .map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : state.type === "multipleChoice" ? (
                      <div className="grid gap-2 rounded-md border border-border/60 bg-background px-3 py-2">
                        <Select
                          value={branch.operator}
                          onValueChange={(operator) =>
                            onChange({
                              ...state,
                              branches: state.branches.map(
                                (candidate, index) =>
                                  index === branchIndex
                                    ? {
                                        ...candidate,
                                        operator:
                                          operator as ConditionalEditorOperator,
                                      }
                                    : candidate
                              ),
                            })
                          }
                        >
                          <SelectTrigger aria-label={copy.conditionOperator}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="includesAny">
                              {copy.conditionIncludesAny}
                            </SelectItem>
                            <SelectItem value="includesAll">
                              {copy.conditionIncludesAll}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-x-3 gap-y-2">
                          {options.map((option) => (
                            <label
                              className="flex items-center gap-1.5 text-xs"
                              key={option}
                            >
                              <Checkbox
                                checked={branch.expectedOptions.includes(
                                  option
                                )}
                                onCheckedChange={(checked) =>
                                  onChange({
                                    ...state,
                                    branches: state.branches.map(
                                      (candidate, index) =>
                                        index === branchIndex
                                          ? {
                                              ...candidate,
                                              expectedOptions:
                                                checked === true
                                                  ? [
                                                      ...candidate.expectedOptions,
                                                      option,
                                                    ]
                                                  : candidate.expectedOptions.filter(
                                                      (selected) =>
                                                        selected !== option
                                                    ),
                                            }
                                          : candidate
                                    ),
                                  })
                                }
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-[6rem_1fr] gap-2">
                        <Select
                          value={branch.operator}
                          onValueChange={(operator) =>
                            onChange({
                              ...state,
                              branches: state.branches.map(
                                (candidate, index) =>
                                  index === branchIndex
                                    ? {
                                        ...candidate,
                                        operator:
                                          operator as ConditionalEditorOperator,
                                      }
                                    : candidate
                              ),
                            })
                          }
                        >
                          <SelectTrigger aria-label={copy.conditionOperator}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(["gt", "gte", "eq", "lte", "lt"] as const).map(
                              (operator) => (
                                <SelectItem key={operator} value={operator}>
                                  {conditionalOperatorLabel(operator, copy)}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                        <Input
                          aria-label={copy.conditionExpected}
                          value={branch.numberValue}
                          onChange={(event) =>
                            onChange({
                              ...state,
                              branches: state.branches.map(
                                (candidate, index) =>
                                  index === branchIndex
                                    ? {
                                        ...candidate,
                                        numberValue: event.target.value,
                                      }
                                    : candidate
                              ),
                            })
                          }
                        />
                      </div>
                    )}
                    <Button
                      aria-label={copy.remove}
                      disabled={translationMode || state.branches.length === 1}
                      size="icon"
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        onChange({
                          ...state,
                          branches: state.branches.filter(
                            (_, index) => index !== branchIndex
                          ),
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
              <div className="grid grid-cols-[8rem_minmax(12rem,1fr)_2.5rem] items-center gap-3 px-3 py-3">
                <span className="text-xs font-semibold text-warning">
                  {copy.conditionOtherwise}
                </span>
                <span className="text-xs text-muted-foreground">
                  {copy.conditionNoMatch}
                </span>
                <span />
              </div>
            </div>
            {translationMode ? null : (
              <Button
                className="w-fit"
                disabled={
                  state.branches.length >= 8 ||
                  (state.type === "singleChoice" &&
                    state.branches.length >= options.length)
                }
                type="button"
                variant="outline"
                onClick={() => {
                  const used = new Set(
                    state.branches.flatMap((branch) => branch.expectedOptions)
                  );
                  const nextOption = options.find(
                    (option) => !used.has(option)
                  );
                  const id = `${state.nodeId}-branch-${Date.now().toString(36)}`;
                  onChange({
                    ...state,
                    branches: [
                      ...state.branches,
                      {
                        id,
                        operator:
                          state.type === "number"
                            ? "gte"
                            : state.type === "multipleChoice"
                              ? "includesAny"
                              : "selected",
                        expectedOptions: nextOption ? [nextOption] : [],
                        numberValue: "0",
                      },
                    ],
                  });
                }}
              >
                <Plus className="size-4" />
                {copy.conditionAddBranch}
              </Button>
            )}
          </div>
        ) : null}
        <EditorDialogFooter
          copy={copy}
          editing
          submitDisabled={
            !state?.label.trim() ||
            !state.branches.length ||
            state.branches.some(
              (branch) =>
                (state.type !== "number" && !branch.expectedOptions.length) ||
                (state.type === "number" && !branch.numberValue.trim())
            ) ||
            (state.type !== "number" && !parseOptions(state.options).length)
          }
          onClose={onClose}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

function TableDialog({
  state,
  copy,
  translationMode,
  onChange,
  onClose,
  onSubmit,
}: {
  state?: TableEditorState;
  copy: SmartFormV2TemplateDesignerCopy;
  translationMode: boolean;
  onChange: (state: TableEditorState | undefined) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [selection, setSelection] = useState<TableDesignerSelection>({
    kind: "row",
    index: 0,
  });
  const [collapsedRows, setCollapsedRows] = useState<Set<string>>(
    () => new Set()
  );
  const editorKey = state
    ? `open:${state.nodeId ?? state.parentId ?? state.afterId ?? "new"}`
    : "closed";

  useEffect(() => {
    if (editorKey === "closed") {
      return;
    }
    setSelection({ kind: "row", index: 0 });
    setCollapsedRows(new Set());
  }, [editorKey]);

  const invalid =
    !state?.rowHeader.trim() ||
    state.columns.length === 0 ||
    state.rows.length === 0 ||
    state.columns.some((column) => tableColumnInvalid(column)) ||
    state.rows.some((row) => !row.label.trim());
  const selectedColumn =
    selection.kind === "column" ? state?.columns[selection.index] : undefined;
  const selectedRow =
    selection.kind === "row" ? state?.rows[selection.index] : undefined;
  const selectedRowHasChildren =
    selection.kind === "row" && state
      ? rowSubtreeEnd(state.rows, selection.index) > selection.index + 1
      : false;
  const rowNumbers = state
    ? buildTableDesignerNumbers(state.rows, tableDesignerNumbering(state))
    : [];
  const visibleRowIndexes = state
    ? visibleTableRowIndexes(state.rows, collapsedRows)
    : [];
  const selectedRowParentIndex =
    selection.kind === "row" && state
      ? parentRowIndex(state.rows, selection.index)
      : -1;
  const selectedRowParent =
    selectedRowParentIndex >= 0
      ? state?.rows[selectedRowParentIndex]
      : undefined;

  function updateColumn(index: number, patch: Partial<TableColumnDraft>) {
    if (!state) {
      return;
    }
    onChange({
      ...state,
      columns: state.columns.map((column, columnIndex) =>
        columnIndex === index ? { ...column, ...patch } : column
      ),
    });
  }

  function updateRow(index: number, patch: Partial<TableRowDraft>) {
    if (!state) {
      return;
    }
    onChange({
      ...state,
      rows: state.rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      ),
    });
  }

  function toggleCollapsedRow(index: number) {
    if (!state) {
      return;
    }
    const row = state.rows[index];
    if (
      !row ||
      row.role !== "group" ||
      rowSubtreeEnd(state.rows, index) <= index + 1
    ) {
      return;
    }
    const key = tableRowEditorKey(row, index);
    setCollapsedRows((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setSelection({ kind: "row", index });
  }

  function addColumn() {
    if (!state) {
      return;
    }
    const index = state.columns.length;
    onChange({
      ...state,
      columns: [...state.columns, newTableColumnDraft(copy)],
    });
    setSelection({ kind: "column", index });
  }

  function removeColumn(index: number) {
    if (!state || state.columns.length <= 1) {
      return;
    }
    const columns = state.columns.filter(
      (_, columnIndex) => columnIndex !== index
    );
    onChange({ ...state, columns });
    setSelection({
      kind: "column",
      index: Math.min(index, columns.length - 1),
    });
  }

  function addRow() {
    if (!state) {
      return;
    }
    const index = state.rows.length;
    onChange({
      ...state,
      rows: [...state.rows, { label: copy.rowLabel, role: "data", depth: 0 }],
    });
    setSelection({ kind: "row", index });
  }

  function removeRow(index: number) {
    if (!state || state.rows.length <= 1) {
      return;
    }
    const rows = removeRowAndPromoteChildren(state.rows, index);
    onChange({ ...state, rows });
    setSelection({
      kind: "row",
      index: Math.min(index, rows.length - 1),
    });
  }

  function moveSelectedRow(direction: "up" | "down") {
    if (!state || selection.kind !== "row") {
      return;
    }
    const moved = moveRowBlock(state.rows, selection.index, direction);
    if (!moved) {
      return;
    }
    onChange({ ...state, rows: moved.rows });
    setSelection({ kind: "row", index: moved.index });
  }

  function indentRow(index: number) {
    if (!state) {
      return;
    }
    const rows = indentRowBlock(state.rows, index);
    if (!rows) {
      return;
    }
    onChange({ ...state, rows });
    setSelection({ kind: "row", index });
  }

  function indentSelectedRow() {
    if (selection.kind !== "row") {
      return;
    }
    indentRow(selection.index);
  }

  function outdentRow(index: number) {
    if (!state) {
      return;
    }
    const moved = outdentRowBlock(state.rows, index);
    if (!moved) {
      return;
    }
    onChange({ ...state, rows: moved.rows });
    setSelection({ kind: "row", index: moved.index });
  }

  function outdentSelectedRow() {
    if (selection.kind !== "row") {
      return;
    }
    outdentRow(selection.index);
  }

  function pasteRows(index: number, value: string) {
    if (!state) {
      return false;
    }
    const labels = parsePastedRows(value);
    if (labels.length <= 1) {
      return false;
    }
    const current = state.rows[index];
    if (!current) {
      return false;
    }
    const replacements: TableRowDraft[] = labels.map((label, labelIndex) =>
      labelIndex === 0
        ? { ...current, label }
        : { label, role: "data", depth: current.depth }
    );
    const rows = [...state.rows];
    rows.splice(index, 1, ...replacements);
    onChange({ ...state, rows });
    return true;
  }

  if (translationMode) {
    return (
      <TranslationTableDialog
        state={state}
        copy={copy}
        invalid={false}
        onChange={onChange}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );
  }

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-adaptive-height="true"
        className={cn(
          tableStyles.designerDialog,
          "w-11/12 max-w-7xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-border/60 p-0 shadow-xl sm:max-w-7xl"
        )}
      >
        <DialogHeader className="border-b border-border/50 bg-background px-5 py-4 pe-14 text-left">
          <DialogTitle>
            {state?.nodeId ? copy.editTable : copy.insertTable}
          </DialogTitle>
          <DialogDescription>{copy.contextHint}</DialogDescription>
          {state ? (
            <div className="pt-2">
              <Label htmlFor="smart-form-table-title" className="sr-only">
                {copy.tableTitle}
              </Label>
              <Input
                id="smart-form-table-title"
                value={state.title}
                placeholder={copy.tableTitle}
                className="h-9 max-w-3xl border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                onChange={(event) =>
                  onChange({ ...state, title: event.currentTarget.value })
                }
              />
            </div>
          ) : null}
        </DialogHeader>

        {state ? (
          <div className="flex h-full min-h-0 flex-col overflow-hidden lg:flex-row">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/20 p-5">
              <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto min-w-0 flex-1 justify-start px-1 py-1 text-left font-normal whitespace-normal text-muted-foreground"
                    onClick={() => setSelection({ kind: "table" })}
                  >
                    {state.description.trim() || copy.descriptionPlaceholder}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addColumn}
                  >
                    <Plus className="mr-1.5 size-3.5" />
                    {copy.addColumn}
                  </Button>
                </div>

                <div
                  data-smart-form-table-grid="true"
                  className="min-h-0 flex-1 overflow-hidden rounded-md border border-border/60 bg-background shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)]"
                >
                  <div
                    data-smart-form-table-scroll="true"
                    className="h-full overflow-auto"
                  >
                    <Table
                      label={`${copy.preview}: ${state.title || copy.sheet}`}
                      containerClassName="overflow-visible"
                      className="w-max min-w-full table-fixed border-separate border-spacing-0 text-sm"
                    >
                      <thead className="sticky top-0 z-20 bg-muted/55 backdrop-blur">
                        <tr>
                          <th className="sticky left-0 z-30 w-80 max-w-80 min-w-80 overflow-hidden border-r border-b border-border/55 bg-muted p-2 text-left align-top">
                            <Label
                              htmlFor="smart-form-row-header"
                              className="sr-only"
                            >
                              {copy.rowHeader}
                            </Label>
                            <Input
                              id="smart-form-row-header"
                              value={state.rowHeader}
                              className="h-8 border-0 bg-transparent px-1 font-semibold shadow-none focus-visible:bg-background focus-visible:ring-1"
                              onFocus={() => setSelection({ kind: "table" })}
                              onChange={(event) =>
                                onChange({
                                  ...state,
                                  rowHeader: event.currentTarget.value,
                                })
                              }
                            />
                          </th>
                          {state.columns.map((column, index) => {
                            const active =
                              selection.kind === "column" &&
                              selection.index === index;
                            return (
                              <th
                                key={column.id ?? `new-column-${index}`}
                                aria-label={`${column.header}: ${
                                  column.required
                                    ? copy.required
                                    : copy.optional
                                }`}
                                scope="col"
                                data-selected={active ? "true" : undefined}
                                className={cn(
                                  "group w-48 min-w-48 max-w-48 overflow-hidden border-b border-r border-border/55 bg-muted/55 p-2 text-left align-top last:border-r-0",
                                  active &&
                                    "border-b-2 border-b-primary bg-primary/10 ring-1 ring-inset ring-primary/30"
                                )}
                              >
                                <div className="grid gap-1">
                                  <div className="flex items-center gap-1">
                                    <Label
                                      htmlFor={`smart-form-column-${index}`}
                                      className="sr-only"
                                    >
                                      {`${copy.columnHeader} ${index + 1}`}
                                    </Label>
                                    <Input
                                      id={`smart-form-column-${index}`}
                                      value={column.header}
                                      className="h-8 min-w-0 border-0 bg-transparent px-1 font-semibold shadow-none focus-visible:bg-background focus-visible:ring-1"
                                      onFocus={() =>
                                        setSelection({ kind: "column", index })
                                      }
                                      onChange={(event) =>
                                        updateColumn(index, {
                                          header: event.currentTarget.value,
                                        })
                                      }
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                                      disabled={state.columns.length <= 1}
                                      aria-label={`${copy.remove} ${copy.columnHeader} ${index + 1}`}
                                      onClick={() => removeColumn(index)}
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </div>
                                  <label className="flex w-fit items-center gap-1.5 px-1 text-xs font-normal text-muted-foreground">
                                    <Checkbox
                                      aria-label={`${column.header}: ${
                                        column.required
                                          ? copy.required
                                          : copy.optional
                                      }`}
                                      checked={column.required}
                                      onFocus={() =>
                                        setSelection({ kind: "column", index })
                                      }
                                      onCheckedChange={(checked) =>
                                        updateColumn(index, {
                                          required: checked === true,
                                        })
                                      }
                                    />
                                    <SmartFormV2RequiredIndicator
                                      decorative
                                      required={column.required}
                                      requiredLabel={copy.required}
                                      optionalLabel={copy.optional}
                                    />
                                    {column.required
                                      ? copy.required
                                      : copy.optional}
                                  </label>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRowIndexes.map((index) => {
                          const row = state.rows[index];
                          const active =
                            selection.kind === "row" &&
                            selection.index === index;
                          const hasChildren =
                            rowSubtreeEnd(state.rows, index) > index + 1;
                          const rowKey = tableRowEditorKey(row, index);
                          const collapsed = collapsedRows.has(rowKey);
                          return (
                            <tr
                              key={row.id ?? `new-row-${index}`}
                              data-selected={active ? "true" : undefined}
                              className={cn(
                                "group/row border-b border-border/45 last:border-b-0",
                                row.role === "group" && "bg-muted/30",
                                active && "bg-primary/5"
                              )}
                            >
                              <td
                                className={cn(
                                  "sticky left-0 z-10 w-80 min-w-80 max-w-80 overflow-hidden border-r border-border/50 p-1.5 align-top group-hover/row:bg-muted",
                                  active
                                    ? "border-l-2 border-l-primary bg-accent"
                                    : row.role === "group"
                                      ? "bg-muted"
                                      : "bg-background"
                                )}
                              >
                                <div className="flex min-w-0 items-center gap-1">
                                  <div className="flex shrink-0 items-center self-stretch">
                                    {Array.from({
                                      length: Math.min(row.depth, 6),
                                    }).map((_, level) => (
                                      <span
                                        key={`${rowKey}-guide-${level}`}
                                        aria-hidden="true"
                                        className="h-8 w-5 border-l border-border/60"
                                      />
                                    ))}
                                    <span className="flex size-7 shrink-0 items-center justify-center">
                                      {row.role === "group" && hasChildren ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="size-6 rounded-md"
                                          aria-label={`${collapsed ? copy.expandGroup : copy.collapseGroup} ${rowNumbers[index] || index + 1}`}
                                          aria-expanded={!collapsed}
                                          onClick={() =>
                                            toggleCollapsedRow(index)
                                          }
                                        >
                                          {collapsed ? (
                                            <ChevronRight className="size-3.5" />
                                          ) : (
                                            <ChevronDown className="size-3.5" />
                                          )}
                                        </Button>
                                      ) : (
                                        <span
                                          aria-hidden="true"
                                          className="size-6"
                                        />
                                      )}
                                    </span>
                                  </div>
                                  <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                                    {rowNumbers[index]}
                                  </span>
                                  <Label
                                    htmlFor={`smart-form-row-${index}`}
                                    className="sr-only"
                                  >
                                    {`${copy.rowLabel} ${index + 1}`}
                                  </Label>
                                  <Input
                                    id={`smart-form-row-${index}`}
                                    value={row.label}
                                    className={cn(
                                      "h-8 min-w-0 border-0 bg-transparent px-1 shadow-none focus-visible:bg-background focus-visible:ring-1",
                                      row.role === "group" && "font-semibold"
                                    )}
                                    onFocus={() =>
                                      setSelection({ kind: "row", index })
                                    }
                                    onKeyDown={(event) => {
                                      if (!(event.altKey && event.shiftKey)) {
                                        return;
                                      }
                                      if (event.key === "ArrowRight") {
                                        event.preventDefault();
                                        indentRow(index);
                                      }
                                      if (event.key === "ArrowLeft") {
                                        event.preventDefault();
                                        outdentRow(index);
                                      }
                                    }}
                                    onPaste={(event) => {
                                      if (
                                        pasteRows(
                                          index,
                                          event.clipboardData.getData(
                                            "text/plain"
                                          )
                                        )
                                      ) {
                                        event.preventDefault();
                                      }
                                    }}
                                    onChange={(event) =>
                                      updateRow(index, {
                                        label: event.currentTarget.value,
                                      })
                                    }
                                  />
                                </div>
                              </td>
                              {row.role === "group" ? (
                                <td
                                  colSpan={state.columns.length}
                                  className={cn(
                                    "px-3 py-2 text-xs text-muted-foreground",
                                    active && "bg-primary/5"
                                  )}
                                >
                                  {copy.staticRow}
                                </td>
                              ) : (
                                state.columns.map((column, columnIndex) => {
                                  const columnActive =
                                    selection.kind === "column" &&
                                    selection.index === columnIndex;
                                  return (
                                    <td
                                      key={`${row.id ?? index}-${column.id ?? columnIndex}`}
                                      data-column-selected={
                                        columnActive ? "true" : undefined
                                      }
                                      className={cn(
                                        "w-48 min-w-48 max-w-48 overflow-hidden border-r border-border/45 px-3 py-2 align-middle text-xs text-muted-foreground/55 last:border-r-0",
                                        active && "bg-primary/5",
                                        columnActive && "bg-primary/10"
                                      )}
                                    >
                                      {fieldTypeLabel(copy, column.type)}
                                    </td>
                                  );
                                })
                              )}
                            </tr>
                          );
                        })}
                        <tr>
                          <td
                            colSpan={state.columns.length + 1}
                            className="p-2 text-center"
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={addRow}
                            >
                              <Plus className="mr-1.5 size-3.5" />
                              {copy.addRow}
                            </Button>
                          </td>
                        </tr>
                      </tbody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>

            <aside
              data-smart-form-table-inspector="true"
              className="max-h-80 w-full shrink-0 overflow-y-auto border-t border-border/50 bg-muted/15 p-4 lg:max-h-none lg:w-80 lg:border-t-0 lg:border-l"
            >
              <div className="grid gap-4">
                <div className="border-b border-border/50 pb-3">
                  <h3 className="text-sm font-semibold">{copy.inspector}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selection.kind === "column"
                      ? `${copy.columns} ${selection.index + 1}`
                      : selection.kind === "row"
                        ? `${copy.rows} ${selection.index + 1}`
                        : copy.tableTitle}
                  </p>
                </div>

                {selection.kind === "table" ? (
                  <div className="grid gap-4">
                    <LabeledTextarea
                      id="smart-form-table-description"
                      label={copy.description}
                      value={state.description}
                      placeholder={copy.descriptionPlaceholder}
                      onChange={(description) =>
                        onChange({ ...state, description })
                      }
                    />
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md border border-border/60 bg-background p-3">
                        <div className="text-xs text-muted-foreground">
                          {copy.columns}
                        </div>
                        <div className="mt-1 text-lg font-semibold">
                          {state.columns.length}
                        </div>
                      </div>
                      <div className="rounded-md border border-border/60 bg-background p-3">
                        <div className="text-xs text-muted-foreground">
                          {copy.rows}
                        </div>
                        <div className="mt-1 text-lg font-semibold">
                          {state.rows.length}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {selection.kind === "column" && selectedColumn ? (
                  <div className="grid gap-4">
                    <LabeledInput
                      id={`smart-form-inspector-column-${selection.index}`}
                      label={copy.columnHeader}
                      value={selectedColumn.header}
                      onChange={(header) =>
                        updateColumn(selection.index, { header })
                      }
                    />
                    <div className="grid gap-1.5">
                      <Label htmlFor="smart-form-inspector-column-type">
                        {copy.columnType}
                      </Label>
                      <Select
                        value={selectedColumn.type}
                        onValueChange={(value) => {
                          const type = value as FieldEditorType;
                          updateColumn(selection.index, {
                            type,
                            options:
                              (type === "singleChoice" ||
                                type === "multipleChoice") &&
                              parseOptions(selectedColumn.options).length === 0
                                ? `${copy.yes}\n${copy.no}`
                                : selectedColumn.options,
                            cardinality:
                              type === "singleChoice"
                                ? "one"
                                : type === "multipleChoice"
                                  ? "many"
                                  : selectedColumn.cardinality,
                          });
                        }}
                      >
                        <SelectTrigger id="smart-form-inspector-column-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldTypeOptions(copy).map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedColumn.required}
                        onCheckedChange={(checked) =>
                          updateColumn(selection.index, {
                            required: checked === true,
                          })
                        }
                      />
                      <SmartFormV2RequiredIndicator
                        decorative
                        required={selectedColumn.required}
                        requiredLabel={copy.required}
                        optionalLabel={copy.optional}
                      />
                      {selectedColumn.required ? copy.required : copy.optional}
                    </label>

                    {selectedColumn.type === "singleChoice" ||
                    selectedColumn.type === "multipleChoice" ? (
                      <LabeledTextarea
                        id="smart-form-inspector-column-options"
                        label={copy.optionsOnePerLine}
                        value={selectedColumn.options}
                        placeholder={copy.optionsPlaceholder}
                        onChange={(options) =>
                          updateColumn(selection.index, { options })
                        }
                      />
                    ) : null}

                    {selectedColumn.type === "reference" ||
                    selectedColumn.type === "attachment" ? (
                      <div className="grid gap-1.5">
                        <Label htmlFor="smart-form-inspector-column-cardinality">
                          {copy.cardinality}
                        </Label>
                        <Select
                          value={selectedColumn.cardinality}
                          onValueChange={(value) =>
                            updateColumn(selection.index, {
                              cardinality: value as "one" | "many",
                            })
                          }
                        >
                          <SelectTrigger id="smart-form-inspector-column-cardinality">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="one">{copy.one}</SelectItem>
                            <SelectItem value="many">{copy.many}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {selectedColumn.type === "number" ? (
                      <div className="grid gap-3">
                        <div className="grid gap-1.5">
                          <Label htmlFor="smart-form-inspector-number-format">
                            {copy.numberFormat}
                          </Label>
                          <Select
                            value={selectedColumn.numberFormat}
                            onValueChange={(value) =>
                              updateColumn(selection.index, {
                                numberFormat:
                                  value as TableColumnDraft["numberFormat"],
                              })
                            }
                          >
                            <SelectTrigger id="smart-form-inspector-number-format">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="decimal">
                                {copy.decimal}
                              </SelectItem>
                              <SelectItem value="currency">
                                {copy.currency}
                              </SelectItem>
                              <SelectItem value="percent">
                                {copy.percent}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedColumn.numberFormat === "currency" ? (
                          <LabeledInput
                            id="smart-form-inspector-currency-code"
                            label={copy.currencyCode}
                            value={selectedColumn.currencyCode}
                            onChange={(currencyCode) =>
                              updateColumn(selection.index, {
                                currencyCode: currencyCode.toUpperCase(),
                              })
                            }
                          />
                        ) : null}
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      variant="outline"
                      disabled={state.columns.length <= 1}
                      onClick={() => removeColumn(selection.index)}
                    >
                      <Trash2 className="mr-2 size-4" />
                      {copy.remove}
                    </Button>
                  </div>
                ) : null}

                {selection.kind === "row" && selectedRow ? (
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md border border-border/60 bg-background p-3">
                        <div className="text-xs text-muted-foreground">
                          {copy.parentRow}
                        </div>
                        <div className="mt-1 truncate text-sm font-medium">
                          {selectedRowParent?.label ?? copy.topLevel}
                        </div>
                      </div>
                      <div className="rounded-md border border-border/60 bg-background p-3">
                        <div className="text-xs text-muted-foreground">
                          {copy.level}
                        </div>
                        <div className="mt-1 text-sm font-medium tabular-nums">
                          {selectedRow.depth + 1}
                        </div>
                      </div>
                    </div>
                    <LabeledInput
                      id={`smart-form-inspector-row-${selection.index}`}
                      label={copy.rowLabel}
                      value={selectedRow.label}
                      onChange={(label) =>
                        updateRow(selection.index, { label })
                      }
                    />
                    <div className="grid gap-1.5">
                      <Label htmlFor="smart-form-inspector-row-type">
                        {copy.rowType}
                      </Label>
                      <Select
                        value={selectedRow.role}
                        onValueChange={(value) =>
                          updateRow(selection.index, {
                            role: value as TableRowDraft["role"],
                          })
                        }
                      >
                        <SelectTrigger
                          id="smart-form-inspector-row-type"
                          className="w-full"
                        >
                          <SelectValue>
                            {selectedRow.role === "data"
                              ? copy.questionRow
                              : copy.staticRow}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value="data"
                            disabled={selectedRowHasChildren}
                          >
                            {copy.questionRow}
                          </SelectItem>
                          <SelectItem value="group">
                            {copy.staticRow}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          !canMoveRow(state.rows, selection.index, "up")
                        }
                        onClick={() => moveSelectedRow("up")}
                      >
                        <ArrowUp className="size-4" />
                        {copy.moveUp}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          !canMoveRow(state.rows, selection.index, "down")
                        }
                        onClick={() => moveSelectedRow("down")}
                      >
                        <ArrowDown className="size-4" />
                        {copy.moveDown}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={selectedRow.depth <= 0}
                        onClick={outdentSelectedRow}
                      >
                        <ArrowLeft className="size-4" />
                        {copy.outdentRow}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canIndentRow(state.rows, selection.index)}
                        onClick={indentSelectedRow}
                      >
                        {copy.indentRow}
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={state.rows.length <= 1}
                      onClick={() => removeRow(selection.index)}
                    >
                      <Trash2 className="mr-2 size-4" />
                      {copy.remove}
                    </Button>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-border/50 bg-muted/15 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button type="button" disabled={invalid} onClick={onSubmit}>
            {state?.nodeId ? copy.update : copy.create}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TranslationTableDialog({
  state,
  copy,
  invalid,
  onChange,
  onClose,
  onSubmit,
}: {
  state?: TableEditorState;
  copy: SmartFormV2TemplateDesignerCopy;
  invalid: boolean;
  onChange: (state: TableEditorState | undefined) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-adaptive-height="true"
        className={cn(
          tableStyles.designerDialog,
          "w-11/12 max-w-7xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-border/60 p-0 shadow-xl sm:max-w-7xl"
        )}
      >
        <DialogHeader className="border-b border-border/50 bg-background px-5 py-4 pe-14 text-left">
          <DialogTitle>{copy.editTable}</DialogTitle>
          <DialogDescription>{copy.translationMode}</DialogDescription>
          {state ? (
            <div className="pt-2">
              <Label
                htmlFor="smart-form-table-translation-title"
                className="sr-only"
              >
                {copy.tableTitle}
              </Label>
              <Input
                id="smart-form-table-translation-title"
                value={state.title}
                placeholder={state.referenceTitle || copy.tableTitle}
                className="h-9 max-w-3xl border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                onChange={(event) =>
                  onChange({ ...state, title: event.currentTarget.value })
                }
              />
              <TranslationReference
                label={copy.chineseReference}
                value={state.referenceTitle}
              />
            </div>
          ) : null}
        </DialogHeader>

        {state ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20 p-5">
            <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="smart-form-table-translation-description">
                  {copy.description}
                </Label>
                <Textarea
                  id="smart-form-table-translation-description"
                  value={state.description}
                  rows={2}
                  placeholder={
                    state.referenceDescription || copy.descriptionPlaceholder
                  }
                  className="resize-none bg-background"
                  onChange={(event) =>
                    onChange({
                      ...state,
                      description: event.currentTarget.value,
                    })
                  }
                />
                <TranslationReference
                  label={copy.chineseReference}
                  value={state.referenceDescription}
                />
              </div>

              <div
                data-smart-form-table-grid="true"
                className="min-h-0 flex-1 overflow-hidden rounded-md border border-border/60 bg-background shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)]"
              >
                <div
                  data-smart-form-table-scroll="true"
                  className="h-full overflow-auto"
                >
                  <Table
                    label={`${copy.preview}: ${state.title || copy.sheet}`}
                    containerClassName="overflow-visible"
                    className="w-max min-w-full table-fixed border-separate border-spacing-0 text-sm"
                  >
                    <thead className="sticky top-0 z-20 bg-muted/55 backdrop-blur">
                      <tr>
                        <th className="sticky left-0 z-30 w-80 max-w-80 min-w-80 overflow-hidden border-r border-b border-border/55 bg-muted p-2 text-left align-top">
                          <Label
                            htmlFor="smart-form-table-translation-row-header"
                            className="sr-only"
                          >
                            {copy.rowHeader}
                          </Label>
                          <Input
                            id="smart-form-table-translation-row-header"
                            value={state.rowHeader}
                            placeholder={
                              state.referenceRowHeader || copy.rowHeader
                            }
                            className="h-8 border-0 bg-transparent px-1 font-semibold shadow-none focus-visible:bg-background focus-visible:ring-1"
                            onChange={(event) =>
                              onChange({
                                ...state,
                                rowHeader: event.currentTarget.value,
                              })
                            }
                          />
                          <TranslationReference
                            label={copy.chineseReference}
                            value={state.referenceRowHeader}
                            compact
                          />
                        </th>
                        {state.columns.map((column, index) => (
                          <th
                            key={column.id ?? `translation-column-${index}`}
                            className="w-56 max-w-56 min-w-56 overflow-hidden border-r border-b border-border/55 bg-muted/55 p-2 text-left align-top last:border-r-0"
                          >
                            <div className="grid gap-1.5">
                              <div className="flex items-center gap-2">
                                <Label
                                  htmlFor={`smart-form-column-translation-${index}`}
                                  className="sr-only"
                                >
                                  {`${copy.columnHeader} ${index + 1}`}
                                </Label>
                                <Input
                                  id={`smart-form-column-translation-${index}`}
                                  value={column.header}
                                  placeholder={
                                    column.referenceHeader ||
                                    `${copy.columnHeader} ${index + 1}`
                                  }
                                  className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 font-semibold shadow-none focus-visible:bg-background focus-visible:ring-1"
                                  onChange={(event) =>
                                    onChange({
                                      ...state,
                                      columns: state.columns.map(
                                        (item, itemIndex) =>
                                          itemIndex === index
                                            ? {
                                                ...item,
                                                header:
                                                  event.currentTarget.value,
                                              }
                                            : item
                                      ),
                                    })
                                  }
                                />
                              </div>
                              <TranslationReference
                                label={copy.chineseReference}
                                value={column.referenceHeader}
                                compact
                              />
                              {column.type === "singleChoice" ||
                              column.type === "multipleChoice" ? (
                                <>
                                  <Label
                                    htmlFor={`smart-form-column-options-translation-${index}`}
                                    className="text-xs text-muted-foreground"
                                  >
                                    {copy.optionsOnePerLine}
                                  </Label>
                                  <Textarea
                                    id={`smart-form-column-options-translation-${index}`}
                                    value={column.options}
                                    rows={Math.max(
                                      2,
                                      Math.min(
                                        4,
                                        parseOptions(column.options).length
                                      )
                                    )}
                                    placeholder={
                                      column.referenceOptions ||
                                      copy.optionsPlaceholder
                                    }
                                    className="min-h-14 resize-y bg-background text-xs font-normal"
                                    onChange={(event) =>
                                      onChange({
                                        ...state,
                                        columns: state.columns.map(
                                          (item, itemIndex) =>
                                            itemIndex === index
                                              ? {
                                                  ...item,
                                                  options:
                                                    event.currentTarget.value,
                                                }
                                              : item
                                        ),
                                      })
                                    }
                                  />
                                  <TranslationReference
                                    label={copy.chineseReference}
                                    value={column.referenceOptions}
                                    compact
                                  />
                                </>
                              ) : null}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {state.rows.map((row, index) => (
                        <tr
                          key={row.id ?? `translation-row-${index}`}
                          className={cn(
                            "border-b border-border/45 last:border-b-0",
                            row.role === "group" && "bg-muted/30"
                          )}
                        >
                          <td
                            aria-label={`${copy.rowLabel} ${index + 1}`}
                            className={cn(
                              "sticky left-0 z-10 w-80 min-w-80 max-w-80 overflow-hidden border-r border-border/50 bg-background p-2 align-top",
                              row.role === "group" && "bg-muted"
                            )}
                          >
                            <div
                              className={cn(
                                "grid min-w-0 gap-1",
                                row.depth === 1 && "ps-5",
                                row.depth === 2 && "ps-10",
                                row.depth === 3 && "ps-15",
                                row.depth === 4 && "ps-20",
                                row.depth === 5 && "ps-25",
                                row.depth >= 6 && "ps-30"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                                  {index + 1}
                                </span>
                                <Label
                                  htmlFor={`smart-form-row-translation-${index}`}
                                  className="sr-only"
                                >
                                  {`${copy.rowLabel} ${index + 1}`}
                                </Label>
                                <Input
                                  id={`smart-form-row-translation-${index}`}
                                  value={row.label}
                                  placeholder={
                                    row.referenceLabel ||
                                    `${copy.rowLabel} ${index + 1}`
                                  }
                                  className={cn(
                                    "h-8 min-w-0 border-0 bg-transparent px-1 shadow-none focus-visible:bg-background focus-visible:ring-1",
                                    row.role === "group" && "font-semibold"
                                  )}
                                  onChange={(event) =>
                                    onChange({
                                      ...state,
                                      rows: state.rows.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? {
                                              ...item,
                                              label: event.currentTarget.value,
                                            }
                                          : item
                                      ),
                                    })
                                  }
                                />
                              </div>
                              <div className="ps-10">
                                <TranslationReference
                                  label={copy.chineseReference}
                                  value={row.referenceLabel}
                                  compact
                                />
                              </div>
                            </div>
                          </td>
                          {row.role === "group" ? (
                            <td
                              colSpan={state.columns.length}
                              className="px-3 py-2 text-xs text-muted-foreground"
                            >
                              {copy.staticRow}
                            </td>
                          ) : (
                            state.columns.map((column, columnIndex) => (
                              <td
                                key={`${row.id ?? index}-${column.id ?? columnIndex}`}
                                className="w-56 max-w-56 min-w-56 overflow-hidden border-r border-border/45 px-3 py-2 text-center text-xs text-muted-foreground last:border-r-0"
                              >
                                {fieldTypeLabel(copy, column.type)}
                              </td>
                            ))
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-border/50 bg-muted/15 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button type="button" disabled={invalid} onClick={onSubmit}>
            {copy.update}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TranslationReference({
  label,
  value,
  compact = false,
}: {
  label: string;
  value?: string;
  compact?: boolean;
}) {
  if (!value?.trim()) {
    return null;
  }
  return (
    <p
      className={cn(
        "break-words text-muted-foreground",
        compact ? "text-[11px] leading-4" : "text-xs"
      )}
    >
      {label}: {value}
    </p>
  );
}

function ContentDialog({
  state,
  copy,
  translationMode,
  onChange,
  onClose,
  onSubmit,
}: {
  state?: ContentEditorState;
  copy: SmartFormV2TemplateDesignerCopy;
  translationMode: boolean;
  onChange: (state: ContentEditorState | undefined) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{copy.editContent}</DialogTitle>
          <DialogDescription>
            {translationMode ? copy.translationMode : copy.description}
          </DialogDescription>
        </DialogHeader>
        {state ? (
          <LabeledTextarea
            id="smart-form-content"
            label={copy.content}
            value={state.value}
            reference={state.referenceValue}
            referenceLabel={copy.chineseReference}
            onChange={(value) => onChange({ ...state, value })}
            className="min-h-48"
          />
        ) : null}
        <EditorDialogFooter
          copy={copy}
          editing
          submitDisabled={!state?.value.trim()}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditorDialogFooter({
  copy,
  editing,
  submitDisabled,
  onClose,
  onSubmit,
}: {
  copy: SmartFormV2TemplateDesignerCopy;
  editing: boolean;
  submitDisabled: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onClose}>
        {copy.cancel}
      </Button>
      <Button type="button" disabled={submitDisabled} onClick={onSubmit}>
        {editing ? copy.update : copy.create}
      </Button>
    </DialogFooter>
  );
}

function LabeledInput({
  id,
  label,
  value,
  reference,
  referenceLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  reference?: string;
  referenceLabel?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {reference ? (
        <p className="text-xs leading-5 text-muted-foreground">
          <span className="font-medium">{referenceLabel}:</span> {reference}
        </p>
      ) : null}
    </div>
  );
}

function LabeledTextarea({
  id,
  label,
  value,
  reference,
  referenceLabel,
  onChange,
  placeholder,
  className,
}: {
  id: string;
  label: string;
  value: string;
  reference?: string;
  referenceLabel?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        className={className}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {reference ? (
        <p className="text-xs leading-5 whitespace-pre-wrap text-muted-foreground">
          <span className="font-medium">{referenceLabel}:</span> {reference}
        </p>
      ) : null}
    </div>
  );
}

function fieldTypeOptions(copy: SmartFormV2TemplateDesignerCopy) {
  return [
    { value: "singleChoice", label: copy.singleChoice },
    { value: "multipleChoice", label: copy.multipleChoice },
    { value: "text", label: copy.text },
    { value: "richText", label: copy.richText },
    { value: "number", label: copy.number },
    { value: "reference", label: copy.reference },
    { value: "attachment", label: copy.attachment },
    { value: "date", label: copy.date },
  ] satisfies { value: FieldEditorType; label: string }[];
}

function fieldTypeLabel(
  copy: SmartFormV2TemplateDesignerCopy,
  type: FieldEditorType
) {
  return (
    fieldTypeOptions(copy).find((option) => option.value === type)?.label ??
    type
  );
}

function tableColumnDraftFromSource(
  column: SmartFormV2SheetLeafColumn,
  locale: string,
  copy: SmartFormV2TemplateDesignerCopy,
  referenceLocale?: string
): TableColumnDraft {
  const value =
    column.cell.kind === "field"
      ? column.cell.field.value
      : ({ type: "text", multiline: true } as const);
  return {
    id: column.id,
    header: readLocalizedExact(column.header, locale),
    referenceHeader: referenceLocale
      ? readLocalizedExact(column.header, referenceLocale)
      : undefined,
    type: editorTypeForField(value),
    required:
      column.cell.kind === "field" && column.cell.field.required === true,
    options:
      value.type === "choice"
        ? value.options
            .map((option) => readLocalizedExact(option.label, locale))
            .join("\n")
        : `${copy.yes}\n${copy.no}`,
    referenceOptions:
      referenceLocale && value.type === "choice"
        ? value.options
            .map((option) => readLocalizedExact(option.label, referenceLocale))
            .join("\n")
        : undefined,
    cardinality:
      value.type === "choice" ||
      value.type === "reference" ||
      value.type === "attachment"
        ? value.cardinality
        : "one",
    numberFormat:
      value.type === "number" ? (value.format ?? "decimal") : "decimal",
    currencyCode:
      value.type === "number" ? (value.currencyCode ?? "USD") : "USD",
    source: column,
  };
}

function newTableColumnDraft(
  copy: SmartFormV2TemplateDesignerCopy
): TableColumnDraft {
  return {
    header: copy.columnHeader,
    type: "text",
    required: false,
    options: `${copy.yes}\n${copy.no}`,
    cardinality: "one",
    numberFormat: "decimal",
    currencyCode: "USD",
  };
}

function tableColumnInvalid(column: TableColumnDraft) {
  if (!column.header.trim()) {
    return true;
  }
  if (
    (column.type === "singleChoice" || column.type === "multipleChoice") &&
    parseOptions(column.options).length === 0
  ) {
    return true;
  }
  if (
    column.type === "number" &&
    column.numberFormat === "currency" &&
    !/^[A-Z]{3}$/.test(column.currencyCode)
  ) {
    return true;
  }
  return false;
}

function fieldDefinitionFromEditor(
  state: Pick<
    QuestionEditorState,
    "type" | "options" | "cardinality" | "numberFormat" | "currencyCode"
  >,
  copy: SmartFormV2TemplateDesignerCopy,
  locale: string,
  supportedLocales: string[],
  source?: SmartFormV2FieldDefinition
): SmartFormV2FieldDefinition | undefined {
  if (state.type === "singleChoice" || state.type === "multipleChoice") {
    const labels = parseOptions(state.options);
    if (labels.length === 0) {
      return source?.type === "choice" ? source : undefined;
    }
    const previous = source?.type === "choice" ? source.options : [];
    const existingByNextIndex = matchChoiceOptions(labels, previous, locale);
    const usedValues = new Set(previous.map((option) => option.value));
    return {
      type: "choice",
      cardinality: state.type === "singleChoice" ? "one" : "many",
      options: labels.map((label, index) => {
        const existing = existingByNextIndex.get(index);
        let value = existing?.value ?? slugValue(label, index);
        if (!existing) {
          let suffix = 2;
          const base = value;
          while (usedValues.has(value)) {
            value = `${base}-${(suffix += 1)}`;
          }
          usedValues.add(value);
        }
        const id = existing?.id ?? createId("option");
        return {
          id,
          value,
          label: updateLocalizedText(
            existing?.label,
            label,
            locale,
            `${id}-label`,
            supportedLocales
          ),
          help: existing?.help,
        };
      }),
    };
  }
  if (state.type === "richText") {
    if (source?.type === "richText") {
      return source;
    }
    return {
      type: "richText",
      profile: {
        allowedBlocks: ["paragraph", "bulletList", "orderedList", "blockquote"],
        allowedMarks: ["bold", "italic", "underline", "strike"],
        allowedEntities: [
          "attachment",
          "image",
          "workingPaper",
          "externalLink",
        ],
        presentation: "document",
      },
    };
  }
  if (state.type === "number") {
    const existing = source?.type === "number" ? source : undefined;
    return {
      ...existing,
      type: "number",
      scale:
        existing?.scale ?? (state.numberFormat === "percent" ? 2 : undefined),
      format: state.numberFormat,
      currencyCode:
        state.numberFormat === "currency"
          ? state.currencyCode.toUpperCase()
          : undefined,
    };
  }
  if (state.type === "reference") {
    const existing = source?.type === "reference" ? source : undefined;
    return {
      ...existing,
      type: "reference",
      cardinality: state.cardinality,
      targetTypes: existing?.targetTypes ?? ["projectWing.workingPaper"],
      maxItems: state.cardinality === "one" ? 1 : existing?.maxItems,
    };
  }
  if (state.type === "attachment") {
    const existing = source?.type === "attachment" ? source : undefined;
    return {
      ...existing,
      type: "attachment",
      cardinality: state.cardinality,
      maxFiles: state.cardinality === "one" ? 1 : existing?.maxFiles,
    };
  }
  if (state.type === "date") {
    return source?.type === "date"
      ? source
      : { type: "date", precision: "day" };
  }
  if (state.type === "text") {
    return source?.type === "text" ? source : { type: "text", multiline: true };
  }
  return undefined;
}

function matchChoiceOptions(
  labels: string[],
  previous: Extract<SmartFormV2FieldDefinition, { type: "choice" }>["options"],
  locale: string
) {
  const matches = new Map<number, (typeof previous)[number]>();
  const unused = new Set(previous.map((_, index) => index));

  for (const [nextIndex, label] of labels.entries()) {
    const normalized = label.trim();
    const exactIndex = previous.findIndex(
      (option, index) =>
        unused.has(index) &&
        readLocalized(option.label, locale).trim() === normalized
    );
    if (exactIndex === -1) {
      continue;
    }
    matches.set(nextIndex, previous[exactIndex]);
    unused.delete(exactIndex);
  }

  for (const nextIndex of labels.keys()) {
    if (matches.has(nextIndex)) {
      continue;
    }
    if (!unused.has(nextIndex)) {
      continue;
    }
    matches.set(nextIndex, previous[nextIndex]);
    unused.delete(nextIndex);
  }

  return matches;
}

function editorTypeForField(
  value: SmartFormV2FieldDefinition
): FieldEditorType {
  if (value.type === "choice") {
    return value.cardinality === "one" ? "singleChoice" : "multipleChoice";
  }
  return value.type;
}

function updateAuditProcedureComponentTranslation(
  node: SmartFormV2Node | undefined,
  state: TableEditorState,
  locale: string,
  supportedLocales: string[]
): SmartFormV2Node | undefined {
  if (
    node?.kind !== "component" ||
    node.componentId !== AUDIT_PROCEDURE_SHEET_COMPONENT_ID
  ) {
    return;
  }
  const parsedProps = AuditProcedureSheetPropsSchema.safeParse(node.props);
  if (!parsedProps.success || !state.source) {
    return;
  }

  const props = parsedProps.data;
  const sourceColumns = flattenSheetColumns(state.source.columns);
  const sourceHeader = (columnId: string) =>
    sourceColumns.find((column) => column.id === columnId)?.header;
  const draftHeader = (columnId: string) =>
    state.columns.find((column) => column.id === columnId)?.header ?? "";
  const updateHeader = (
    existing: SmartFormV2LocalizedRichText | undefined,
    columnId: string,
    value: string
  ) =>
    updateLocalizedText(
      existing ?? sourceHeader(columnId),
      value,
      locale,
      `${node.id}-${columnId}-header`,
      supportedLocales
    );
  const headers: NonNullable<AuditProcedureSheetProps["headers"]> = {
    ...props.headers,
    procedure: updateHeader(
      props.headers?.procedure,
      "procedure",
      state.rowHeader
    ),
    testRequired: updateHeader(
      props.headers?.testRequired,
      "test-required",
      draftHeader("test-required")
    ),
    result: updateHeader(
      props.headers?.result,
      "result",
      draftHeader("result")
    ),
    references: updateHeader(
      props.headers?.references,
      "working-paper-reference",
      draftHeader("working-paper-reference")
    ),
    comments: updateHeader(
      props.headers?.comments,
      "comments",
      draftHeader("comments")
    ),
  };
  const rowDrafts = new Map(
    state.rows
      .filter((row) => row.id)
      .map((row) => [row.id as string, row.label])
  );
  const updateProcedures = (
    procedures: AuditProcedureSheetProps["procedures"]
  ): AuditProcedureSheetProps["procedures"] =>
    procedures.map((procedure) => {
      const label = rowDrafts.get(procedure.id);
      return {
        ...procedure,
        label:
          label === undefined
            ? procedure.label
            : updateLocalizedText(
                procedure.label,
                label,
                locale,
                `${procedure.id}-label`,
                supportedLocales
              ),
        ...(procedure.children
          ? { children: updateProcedures(procedure.children) }
          : {}),
      };
    });
  const nextProps: AuditProcedureSheetProps = {
    ...props,
    title: optionalLocalizedText(
      props.title,
      state.title,
      locale,
      `${node.id}-title`,
      supportedLocales
    ),
    description: optionalLocalizedText(
      props.description,
      state.description,
      locale,
      `${node.id}-description`,
      supportedLocales
    ),
    headers,
    procedures: updateProcedures(props.procedures),
  };

  return {
    ...node,
    props: AuditProcedureSheetPropsSchema.parse(nextProps),
  };
}

function buildSheetNode(
  id: string,
  state: TableEditorState,
  locale: string,
  copy: SmartFormV2TemplateDesignerCopy,
  supportedLocales: string[]
): SmartFormV2SheetNode {
  const sourceColumns = state.source
    ? flattenSheetColumns(state.source.columns)
    : [];
  const sourceRowHeader = sourceColumns.find(
    (column) => column.cell.kind === "rowLabel"
  );
  const rowHeaderId = sourceRowHeader?.id ?? `${id}-row-label`;
  const draftById = new Map(
    state.columns
      .filter((column) => column.id)
      .map((column) => [column.id, column])
  );
  const usedDraftIds = new Set<string>();
  const buildFieldColumn = (
    column: TableColumnDraft,
    index: number
  ): SmartFormV2SheetLeafColumn => {
    const columnId = column.id ?? `${id}-column-${createId(String(index + 1))}`;
    const sourceField =
      column.source?.cell.kind === "field"
        ? column.source.cell.field
        : undefined;
    const value = fieldDefinitionFromEditor(
      {
        type: column.type,
        options: column.options,
        cardinality: column.cardinality,
        numberFormat: column.numberFormat,
        currencyCode: column.currencyCode,
      },
      copy,
      locale,
      supportedLocales,
      sourceField?.value
    ) ?? { type: "text", multiline: true };
    const header =
      column.source &&
      readLocalized(column.source.header, locale).trim() ===
        column.header.trim()
        ? column.source.header
        : updateLocalizedText(
            column.source?.header,
            column.header.trim(),
            locale,
            `${columnId}-header`,
            supportedLocales
          );
    const required = column.required
      ? true
      : sourceField?.required === true
        ? false
        : sourceField?.required;
    const field =
      sourceField &&
      JSON.stringify(sourceField.value) === JSON.stringify(value) &&
      sourceField.required === required
        ? sourceField
        : { ...sourceField, required, value };
    return {
      ...column.source,
      kind: "column",
      id: columnId,
      header,
      width:
        column.source?.width ??
        `${Math.max(12, Math.floor(64 / state.columns.length))}%`,
      cell: {
        kind: "field",
        field,
      },
    };
  };
  const rebuildColumns = (
    columns: SmartFormV2SheetColumnNode[]
  ): SmartFormV2SheetColumnNode[] =>
    columns.flatMap<SmartFormV2SheetColumnNode>((column) => {
      if (column.kind === "columnGroup") {
        const children = rebuildColumns(column.children);
        return children.length > 0 ? [{ ...column, children }] : [];
      }
      if (column.cell.kind === "rowLabel") {
        return [
          readLocalized(column.header, locale).trim() === state.rowHeader.trim()
            ? column
            : {
                ...column,
                header: updateLocalizedText(
                  column.header,
                  state.rowHeader.trim(),
                  locale,
                  `${column.id}-header`,
                  supportedLocales
                ),
              },
        ];
      }
      const draft = draftById.get(column.id);
      if (!draft) {
        return [];
      }
      usedDraftIds.add(column.id);
      return [buildFieldColumn(draft, state.columns.indexOf(draft))];
    });
  const existingColumns = state.source
    ? rebuildColumns(state.source.columns)
    : [
        {
          kind: "column" as const,
          id: rowHeaderId,
          header: localizedText(
            state.rowHeader.trim(),
            `${rowHeaderId}-header`,
            locale
          ),
          width: "36%",
          cell: { kind: "rowLabel" as const },
        },
      ];
  const columns = [
    ...existingColumns,
    ...state.columns
      .filter((column) => !column.id || !usedDraftIds.has(column.id))
      .map(buildFieldColumn),
  ];
  const answerColumnIds = new Set(
    flattenSheetColumns(columns)
      .filter((column) => column.cell.kind === "field")
      .map((column) => column.id)
  );
  const sourceAnswerColumnIds = new Set(
    sourceColumns
      .filter((column) => column.cell.kind === "field")
      .map((column) => column.id)
  );
  const originalItems =
    state.source?.rows.mode === "fixed" ? state.source.rows.items : [];
  const rows =
    state.source?.rows.mode === "fixed" &&
    tableRowsUnchanged(state.rows, originalItems, locale) &&
    setEquals(answerColumnIds, sourceAnswerColumnIds)
      ? originalItems
      : buildTableRows(
          originalItems,
          state.rows,
          locale,
          id,
          supportedLocales,
          answerColumnIds
        );
  return {
    ...state.source,
    kind: "sheet",
    id,
    title: optionalLocalizedText(
      state.source?.title,
      state.title,
      locale,
      `${id}-title`,
      supportedLocales
    ),
    description: optionalLocalizedText(
      state.source?.description,
      state.description,
      locale,
      `${id}-description`,
      supportedLocales
    ),
    presentation: state.source?.presentation ?? {
      density: "comfortable",
      width: "full",
      stickyHeader: true,
      showGridLines: true,
      stripedRows: true,
      responsive: "scroll",
    },
    columns,
    rows:
      state.source?.rows.mode === "fixed"
        ? { ...state.source.rows, items: rows }
        : {
            mode: "fixed",
            numbering: {
              enabled: true,
              style: "decimal",
              startAt: 1,
              child: {
                enabled: true,
                style: "lower-alpha",
                prefix: "(",
                suffix: ")",
              },
            },
            items: rows,
          },
  };
}

function buildTableRows(
  original: SmartFormV2FixedSheetRow[],
  drafts: TableRowDraft[],
  locale: string,
  sheetId: string,
  supportedLocales: string[],
  answerColumnIds: Set<string>
): SmartFormV2FixedSheetRow[] {
  const originalById = new Map<string, SmartFormV2FixedSheetRow>();
  const indexRows = (rows: SmartFormV2FixedSheetRow[]) => {
    for (const row of rows) {
      originalById.set(row.id, row);
      indexRows(row.children ?? []);
    }
  };
  indexRows(original);

  const roots: SmartFormV2FixedSheetRow[] = [];
  const stack: SmartFormV2FixedSheetRow[] = [];

  drafts.forEach((draft, index) => {
    const existing =
      (draft.id ? originalById.get(draft.id) : undefined) ?? draft.source;
    const rowId = draft.id ?? `${sheetId}-row-${createId(String(index + 1))}`;
    const label =
      existing &&
      readLocalized(existing.label, locale).trim() === draft.label.trim()
        ? existing.label
        : updateLocalizedText(
            existing?.label,
            draft.label.trim(),
            locale,
            `${rowId}-label`,
            supportedLocales
          );
    const cells =
      draft.role === "group"
        ? Object.fromEntries(
            [...answerColumnIds].map((columnId) => [
              columnId,
              { kind: "empty" as const },
            ])
          )
        : existing?.role === "group"
          ? undefined
          : existing?.cells
            ? Object.fromEntries(
                Object.entries(existing.cells).filter(([columnId]) =>
                  answerColumnIds.has(columnId)
                )
              )
            : undefined;
    const row: SmartFormV2FixedSheetRow = {
      ...existing,
      id: rowId,
      role: draft.role,
      label,
      cells,
      children: undefined,
    };

    let depth = Math.max(0, Math.min(draft.depth, stack.length));
    while (depth > 0 && stack[depth - 1]?.role !== "group") {
      depth -= 1;
    }
    stack.length = depth;
    if (depth === 0) {
      roots.push(row);
    } else {
      const parent = stack[depth - 1];
      parent.children = [...(parent.children ?? []), row];
    }
    stack.push(row);
  });

  return roots;
}

function tableRowsUnchanged(
  drafts: TableRowDraft[],
  original: SmartFormV2FixedSheetRow[],
  locale: string
) {
  const previous = flattenTableRows(original, locale);
  if (drafts.length !== previous.length) {
    return false;
  }
  return drafts.every((draft, index) => {
    const source = previous[index];
    return (
      source &&
      draft.id === source.id &&
      draft.role === source.role &&
      draft.depth === source.depth &&
      draft.label === source.label
    );
  });
}

function setEquals(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) {
    return false;
  }
  return [...left].every((value) => right.has(value));
}

function tableDesignerNumbering(
  state: TableEditorState
): SmartFormV2NumberingRule | undefined {
  if (state.source?.rows.mode === "fixed") {
    return state.source.rows.numbering;
  }
  return {
    enabled: true,
    style: "decimal",
    startAt: 1,
    child: {
      enabled: true,
      style: "lower-alpha",
      prefix: "(",
      suffix: ")",
    },
  };
}

function buildTableDesignerNumbers(
  rows: TableRowDraft[],
  numbering?: SmartFormV2NumberingRule
) {
  const counters: number[] = [];
  const parents: string[] = [];
  return rows.map((row) => {
    const depth = Math.max(0, row.depth);
    counters.length = depth + 1;
    parents.length = depth;
    counters[depth] = (counters[depth] ?? 0) + 1;
    const rule = numberingForTableDepth(numbering, depth);
    const ownNumber = rule?.enabled
      ? `${rule.prefix ?? ""}${formatOrdinal(
          (rule.startAt ?? 1) + counters[depth] - 1,
          rule.style
        )}${rule.suffix ?? ""}`
      : "";
    const parentNumber = depth > 0 ? (parents[depth - 1] ?? "") : "";
    const number = parentNumber
      ? `${parentNumber}${rule?.separator ?? ""}${ownNumber}`
      : ownNumber;
    parents[depth] = number;
    return number;
  });
}

function numberingForTableDepth(
  numbering: SmartFormV2NumberingRule | undefined,
  depth: number
) {
  let current = numbering;
  for (let index = 0; index < depth; index += 1) {
    current = current?.child;
  }
  return current;
}

function tableRowEditorKey(row: TableRowDraft, index: number) {
  return row.id ?? `draft-row-${index}`;
}

function visibleTableRowIndexes(
  rows: TableRowDraft[],
  collapsedRows: Set<string>
) {
  const visible: number[] = [];
  const collapsedDepths: number[] = [];
  rows.forEach((row, index) => {
    while (
      collapsedDepths.length > 0 &&
      row.depth <= collapsedDepths[collapsedDepths.length - 1]
    ) {
      collapsedDepths.pop();
    }
    const hidden = collapsedDepths.length > 0;
    if (!hidden) {
      visible.push(index);
    }
    if (
      !hidden &&
      row.role === "group" &&
      rowSubtreeEnd(rows, index) > index + 1 &&
      collapsedRows.has(tableRowEditorKey(row, index))
    ) {
      collapsedDepths.push(row.depth);
    }
  });
  return visible;
}

function parentRowIndex(rows: TableRowDraft[], index: number) {
  const row = rows[index];
  if (!row || row.depth <= 0) {
    return -1;
  }
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (rows[cursor].depth === row.depth - 1) {
      return cursor;
    }
    if (rows[cursor].depth < row.depth - 1) {
      return -1;
    }
  }
  return -1;
}

function rowSubtreeEnd(rows: TableRowDraft[], index: number) {
  const row = rows[index];
  if (!row) {
    return index;
  }
  let end = index + 1;
  while (end < rows.length && rows[end].depth > row.depth) {
    end += 1;
  }
  return end;
}

function previousSiblingIndex(rows: TableRowDraft[], index: number) {
  const row = rows[index];
  if (!row) {
    return -1;
  }
  let cursor = index - 1;
  while (cursor >= 0 && rows[cursor].depth > row.depth) {
    cursor -= 1;
  }
  return cursor >= 0 && rows[cursor].depth === row.depth ? cursor : -1;
}

function nextSiblingIndex(rows: TableRowDraft[], index: number) {
  const row = rows[index];
  if (!row) {
    return -1;
  }
  const cursor = rowSubtreeEnd(rows, index);
  return cursor < rows.length && rows[cursor].depth === row.depth ? cursor : -1;
}

function canMoveRow(
  rows: TableRowDraft[],
  index: number,
  direction: "up" | "down"
) {
  return direction === "up"
    ? previousSiblingIndex(rows, index) >= 0
    : nextSiblingIndex(rows, index) >= 0;
}

function moveRowBlock(
  rows: TableRowDraft[],
  index: number,
  direction: "up" | "down"
): { rows: TableRowDraft[]; index: number } | undefined {
  const currentEnd = rowSubtreeEnd(rows, index);
  const current = rows.slice(index, currentEnd);
  if (direction === "up") {
    const previous = previousSiblingIndex(rows, index);
    if (previous < 0) {
      return undefined;
    }
    const previousBlock = rows.slice(previous, index);
    return {
      rows: [
        ...rows.slice(0, previous),
        ...current,
        ...previousBlock,
        ...rows.slice(currentEnd),
      ],
      index: previous,
    };
  }
  const next = nextSiblingIndex(rows, index);
  if (next < 0) {
    return undefined;
  }
  const nextEnd = rowSubtreeEnd(rows, next);
  const nextBlock = rows.slice(next, nextEnd);
  return {
    rows: [
      ...rows.slice(0, index),
      ...nextBlock,
      ...current,
      ...rows.slice(nextEnd),
    ],
    index: index + nextBlock.length,
  };
}

function canIndentRow(rows: TableRowDraft[], index: number) {
  const previous = previousSiblingIndex(rows, index);
  return previous >= 0 && rows[previous]?.role === "group";
}

function indentRowBlock(rows: TableRowDraft[], index: number) {
  if (!canIndentRow(rows, index)) {
    return;
  }
  const end = rowSubtreeEnd(rows, index);
  return rows.map((row, rowIndex) =>
    rowIndex >= index && rowIndex < end ? { ...row, depth: row.depth + 1 } : row
  );
}

function outdentRowBlock(
  rows: TableRowDraft[],
  index: number
): { rows: TableRowDraft[]; index: number } | undefined {
  const row = rows[index];
  if (!row || row.depth <= 0) {
    return undefined;
  }
  const currentEnd = rowSubtreeEnd(rows, index);
  const current = rows
    .slice(index, currentEnd)
    .map((item) => ({ ...item, depth: item.depth - 1 }));
  let parent = index - 1;
  while (parent >= 0 && rows[parent].depth >= row.depth) {
    parent -= 1;
  }
  if (parent < 0) {
    return undefined;
  }
  const parentEnd = rowSubtreeEnd(rows, parent);
  const withoutCurrent = [...rows.slice(0, index), ...rows.slice(currentEnd)];
  const insertionIndex = parentEnd - current.length;
  const nextRows = [
    ...withoutCurrent.slice(0, insertionIndex),
    ...current,
    ...withoutCurrent.slice(insertionIndex),
  ];
  return { rows: nextRows, index: insertionIndex };
}

function removeRowAndPromoteChildren(rows: TableRowDraft[], index: number) {
  const row = rows[index];
  if (!row) {
    return rows;
  }
  const end = rowSubtreeEnd(rows, index);
  const promoted = rows.slice(index + 1, end).map((child) => ({
    ...child,
    depth: Math.max(row.depth, child.depth - 1),
  }));
  return [...rows.slice(0, index), ...promoted, ...rows.slice(end)];
}

function parsePastedRows(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.split("\t")[0]?.trim() ?? "")
    .filter(Boolean);
}

function flattenTableRows(
  rows: SmartFormV2FixedSheetRow[],
  locale: string,
  depth = 0,
  referenceLocale?: string
): TableRowDraft[] {
  return rows.flatMap((row) => [
    {
      id: row.id,
      label: readLocalizedExact(row.label, locale),
      referenceLabel: referenceLocale
        ? readLocalizedExact(row.label, referenceLocale)
        : undefined,
      role: row.role ?? (row.children?.length ? "group" : "data"),
      depth,
      source: row,
    },
    ...flattenTableRows(row.children ?? [], locale, depth + 1, referenceLocale),
  ]);
}

function flattenSheetColumns(
  columns: SmartFormV2SheetNode["columns"]
): SmartFormV2SheetLeafColumn[] {
  return columns.flatMap((column) =>
    column.kind === "column" ? [column] : flattenSheetColumns(column.children)
  );
}

function findCompiledSheet(
  nodes: SmartFormV2CompiledDefinition["children"],
  id: string
): SmartFormV2SheetNode | undefined {
  for (const node of nodes) {
    if (node.id === id && node.kind === "sheet") {
      return node;
    }
    if (node.kind === "section" || node.kind === "group") {
      const match = findCompiledSheet(node.children, id);
      if (match) {
        return match;
      }
    }
    if (node.kind === "conditional") {
      const match = findCompiledSheet(
        [
          ...node.branches.flatMap((branch) => branch.children),
          ...node.otherwise.children,
        ],
        id
      );
      if (match) {
        return match;
      }
    }
  }
  return undefined;
}

function insertAtRoot(
  definition: SmartFormV2Definition,
  node: SmartFormV2Node,
  afterId?: string
) {
  const index = afterId
    ? definition.children.findIndex((child) => child.id === afterId)
    : -1;
  const children = [...definition.children];
  children.splice(index >= 0 ? index + 1 : children.length, 0, node);
  return { ...definition, children };
}

function insertIntoContainer(
  definition: SmartFormV2Definition,
  containerId: string,
  node: SmartFormV2Node,
  afterId?: string
) {
  return mapNodes(definition, containerId, (current) => {
    if (current.kind !== "section" && current.kind !== "group") {
      return current;
    }
    const children = [...current.children];
    const index = afterId
      ? children.findIndex((child) => child.id === afterId)
      : -1;
    children.splice(index >= 0 ? index + 1 : children.length, 0, node);
    return { ...current, children };
  });
}

function findNode(
  nodes: SmartFormV2Node[],
  id: string
): SmartFormV2Node | undefined {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.kind === "section" || node.kind === "group") {
      const match = findNode(node.children, id);
      if (match) {
        return match;
      }
    }
    if (node.kind === "conditional") {
      const match = findNode(
        [
          ...node.branches.flatMap((branch) => branch.children),
          ...node.otherwise.children,
        ],
        id
      );
      if (match) {
        return match;
      }
    }
  }
  return undefined;
}

function findParentContainer(
  nodes: SmartFormV2Node[],
  id: string
): Extract<SmartFormV2Node, { kind: "section" | "group" }> | undefined {
  for (const node of nodes) {
    if (node.kind !== "section" && node.kind !== "group") {
      continue;
    }
    if (node.children.some((child) => child.id === id)) {
      return node;
    }
    const parent = findParentContainer(node.children, id);
    if (parent) {
      return parent;
    }
  }
  return undefined;
}

function mapNodes(
  definition: SmartFormV2Definition,
  id: string,
  updater: (node: SmartFormV2Node) => SmartFormV2Node
) {
  const visit = (nodes: SmartFormV2Node[]): SmartFormV2Node[] =>
    nodes.map((node) => {
      const next = node.id === id ? updater(node) : node;
      if (next.kind === "section" || next.kind === "group") {
        return { ...next, children: visit(next.children) };
      }
      if (next.kind === "conditional") {
        return {
          ...next,
          branches: next.branches.map((branch) => ({
            ...branch,
            children: visit(branch.children),
          })),
          otherwise: {
            ...next.otherwise,
            children: visit(next.otherwise.children),
          },
        };
      }
      return next;
    });
  return { ...definition, children: visit(definition.children) };
}

function cleanComponentLocks(definition: SmartFormV2Definition) {
  const componentKeys = new Set<string>();
  const visit = (nodes: SmartFormV2Node[]) => {
    for (const node of nodes) {
      if (node.kind === "component") {
        componentKeys.add(`${node.componentId}@${node.componentVersion}`);
      }
      if (node.kind === "section" || node.kind === "group") {
        visit(node.children);
      }
      if (node.kind === "conditional") {
        node.branches.forEach((branch) => visit(branch.children));
        visit(node.otherwise.children);
      }
    }
  };
  visit(definition.children);
  return {
    ...definition,
    componentLocks: definition.componentLocks?.filter((lock) =>
      componentKeys.has(`${lock.componentId}@${lock.componentVersion}`)
    ),
  };
}

function localizedText(value: string, id: string, locale: string) {
  return {
    values: {
      [locale]: paragraphDocument(value, `${id}-${locale}`),
    },
  };
}

function optionalLocalizedText(
  existing: SmartFormV2LocalizedRichText | undefined,
  value: string,
  locale: string,
  id: string,
  supportedLocales: string[]
) {
  if (value.trim()) {
    return updateLocalizedText(
      existing,
      value.trim(),
      locale,
      id,
      supportedLocales
    );
  }
  if (!existing) {
    return;
  }
  const values = { ...existing.values };
  Reflect.deleteProperty(values, locale);
  return Object.keys(values).length > 0 ? { values } : undefined;
}

function updateLocalizedText(
  existing: SmartFormV2LocalizedRichText | undefined,
  value: string,
  locale: string,
  id: string,
  _unused_supportedLocales: string[]
) {
  if (!existing) {
    return localizedText(value, id, locale);
  }
  const values = { ...existing?.values };
  const previous = values[locale];
  values[locale] = paragraphDocument(
    value,
    previous?.content[0]?.id ?? `${id}-${locale}`
  );
  return { values };
}

function paragraphDocument(
  value: string,
  id: string
): SmartFormV2RichTextDocument {
  return {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        id,
        content: value ? [{ type: "text", text: value }] : [],
      },
    ],
  };
}

function readLocalized(
  value: SmartFormV2LocalizedRichText | undefined,
  locale: string
) {
  const document =
    value?.values[locale] ?? Object.values(value?.values ?? {})[0];
  if (!document) {
    return "";
  }
  return richTextBlocksToPlainText(document.content);
}

function readLocalizedExact(
  value: SmartFormV2LocalizedRichText | undefined,
  locale: string
) {
  const document = value?.values[locale];
  return document ? richTextBlocksToPlainText(document.content) : "";
}

function richTextBlocksToPlainText(
  blocks: SmartFormV2RichTextDocument["content"]
): string {
  return blocks
    .map((block) => {
      if (block.type === "paragraph" || block.type === "heading") {
        return block.content
          .map((inline) =>
            inline.type === "text"
              ? inline.text
              : inline.type === "hardBreak"
                ? "\n"
                : ""
          )
          .join("");
      }
      if (block.type === "bulletList" || block.type === "orderedList") {
        return block.items
          .map(
            (item, index) =>
              `${block.type === "orderedList" ? `${index + 1}. ` : "• "}${richTextBlocksToPlainText(item.content)}`
          )
          .join("\n");
      }
      if (block.type === "blockquote") {
        return richTextBlocksToPlainText(block.content);
      }
      if (block.type === "table") {
        return block.rows
          .map((row) =>
            row.cells
              .map((cell) => richTextBlocksToPlainText(cell.content))
              .join("\t")
          )
          .join("\n");
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function parseOptions(value: string) {
  return value
    .split(/\r?\n/)
    .map((option) => option.trim())
    .filter(Boolean);
}

function slugValue(label: string, index: number) {
  const slug = label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
  return slug || `option-${index + 1}`;
}

function createId(prefix: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${suffix}`;
}
