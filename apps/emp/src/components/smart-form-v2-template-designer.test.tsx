import {
  AuditProcedureSheetPropsSchema,
  CONDITIONAL_CONTENT_SMART_FORM_V2_AUTHORED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
} from "@project-wing/shared";
import type {
  SmartFormV2Definition,
  SmartFormV2LocalizedRichText,
  SmartFormV2Node,
} from "@project-wing/shared";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SmartFormV2ReadonlyCopy } from "./smart-form-v2-readonly";
import { SmartFormV2TemplateDesigner } from "./smart-form-v2-template-designer";
import type { SmartFormV2TemplateDesignerCopy } from "./smart-form-v2-template-designer";

// @vitest-environment jsdom

function flattenNodes(nodes: readonly SmartFormV2Node[]): SmartFormV2Node[] {
  return nodes.flatMap((node) => [
    node,
    ...(node.kind === "section" || node.kind === "group"
      ? flattenNodes(node.children)
      : node.kind === "conditional"
        ? flattenNodes([
            ...node.branches.flatMap((branch) => branch.children),
            ...node.otherwise.children,
          ])
        : []),
  ]);
}

vi.mock("./smart-form-v2-puck-editor", () => ({
  SmartFormV2PuckEditor: ({
    definition,
    copy,
    dirty,
    saveError,
    locale,
    supportedLocales,
    onLocaleChange,
    onEditNode,
    onSave,
  }: {
    definition: { children: SmartFormV2Node[] };
    copy: { save: string; saved: string; unsaved: string };
    dirty: boolean;
    saveError?: string;
    locale: string;
    supportedLocales: string[];
    onLocaleChange: (locale: string) => void;
    onEditNode: (id: string) => void;
    onSave: () => void;
  }) => (
    <div>
      <span>{dirty ? copy.unsaved : copy.saved}</span>
      {saveError ? <span data-testid="save-error">{saveError}</span> : null}
      <button type="button" disabled={!dirty} onClick={onSave}>
        {copy.save}
      </button>
      {supportedLocales.map((supportedLocale) => (
        <button
          key={supportedLocale}
          type="button"
          aria-pressed={locale === supportedLocale}
          onClick={() => onLocaleChange(supportedLocale)}
        >
          {`Switch ${supportedLocale}`}
        </button>
      ))}
      {flattenNodes(definition.children).map((node) => (
        <button key={node.id} type="button" onClick={() => onEditNode(node.id)}>
          {`Edit ${node.id}`}
        </button>
      ))}
    </div>
  ),
}));

const copy: SmartFormV2TemplateDesignerCopy = {
  designerLabel: "SmartForm V2 Template Designer",
  save: "Save template",
  saved: "Saved",
  unsaved: "Unsaved changes",
  outline: "Outline",
  preview: "Live preview",
  inspector: "Inspector",
  template: "Template",
  astBadge: "V2 AST",
  title: "Title",
  description: "Description",
  addSection: "Add section",
  addTopLevelContent: "Add top-level content",
  addField: "Add field",
  addContent: "Add content",
  addSheet: "Add audit procedure sheet",
  procedureRows: "Procedure rows",
  procedureLabel: "Procedure",
  addProcedure: "Add procedure row",
  procedureSheetTitleZh: "审计程序",
  procedureSheetTitleEn: "Audit procedures",
  descriptionPlaceholderZh: "补充说明（可选）",
  descriptionPlaceholderEn: "Add an optional description",
  deleteNode: "Delete node",
  selectNode: "Select a node.",
  section: "Section",
  group: "Group",
  field: "Field",
  content: "Content",
  sheet: "Sheet",
  component: "Component",
  fieldLabel: "Field label",
  fieldType: "Field type",
  required: "Required",
  optional: "Optional",
  choice: "Choice",
  text: "Text",
  richText: "Rich text",
  yes: "Yes",
  no: "No",
  noSelection: "No node selected",
  invalidDefinition: "Fix the template structure before saving.",
  sectionTitlePlaceholder: "New section",
  fieldLabelPlaceholder: "New field",
  descriptionPlaceholder: "Add an optional description",
  contextHint: "Edit the selected block.",
  canvasMenu: "SmartForm canvas",
  newSectionAfter: "New section after",
  insertQuestion: "Insert question",
  insertTable: "Insert table",
  editSection: "Edit section",
  editQuestion: "Edit question",
  editConditional: "Edit branch question",
  conditionOperator: "Comparison",
  conditionExpected: "Expected answer",
  conditionIncludesAny: "Includes any",
  conditionIncludesAll: "Includes all",
  conditionSelected: "Selected",
  conditionTrigger: "Trigger condition",
  conditionNoMatch: "No earlier condition matched",
  conditionAddBranch: "Add else if",
  conditionIf: "If",
  conditionElseIf: "Else if",
  editTable: "Edit table",
  editContent: "Edit static text",
  delete: "Delete",
  cancel: "Cancel",
  create: "Create",
  update: "Update",
  questionLabel: "Question",
  questionHelp: "Question guidance (optional)",
  questionType: "Answer data type",
  singleChoice: "Single choice",
  multipleChoice: "Multiple choice",
  number: "Number",
  reference: "Reference",
  attachment: "Attachment",
  date: "Date",
  optionsOnePerLine: "Options",
  optionsPlaceholder: "Option one\nOption two",
  cardinality: "Allowed selections",
  one: "One",
  many: "Many",
  numberFormat: "Number format",
  decimal: "Decimal",
  currency: "Currency",
  percent: "Percent",
  currencyCode: "Currency code",
  tableTitle: "Table title",
  rowHeader: "Row header",
  columns: "Columns",
  columnHeader: "Column header",
  columnType: "Column data type",
  addColumn: "Add column",
  rows: "Rows",
  rowLabel: "Row item",
  rowType: "Row type",
  questionRow: "Question row",
  staticRow: "Static text row",
  addRow: "Add row",
  remove: "Remove",
  parentRow: "Parent",
  level: "Level",
  topLevel: "Top level",
  moveUp: "Move up",
  moveDown: "Move down",
  indentRow: "Indent",
  outdentRow: "Outdent",
  expandGroup: "Expand group",
  collapseGroup: "Collapse group",
  deleteTitle: "Delete node",
  deleteDescription: "Delete {name}?",
  confirmDelete: "Delete",
  manageStructure: "Manage structure",
  structureRecovery: "Structure recovery",
  structureRecoveryDescription: "Edit unavailable nodes.",
  edit: "Edit",
  staticText: "Static text",
  conditional: "Branch question",
  conditionMatched: "Condition matched",
  conditionOtherwise: "Otherwise",
  branchQuestionPlaceholder: "Enter a branch question",
  ribbonInsert: "Insert",
  ribbonEdit: "Edit",
  ribbonView: "View",
  undo: "Undo",
  redo: "Redo",
  moreCommands: "More commands",
  language: "Language",
  languageChinese: "中文",
  languageEnglish: "English",
  translationMode: "Translate text only.",
  chineseReference: "Chinese reference",
  dropIntoSection: "Drop into section",
  dropIntoDocument: "Drop into document",
  staticTextPlaceholder: "Static explanatory text",
};
const readonlyCopy: SmartFormV2ReadonlyCopy = {
  readOnly: "Read only",
  schemaVersion: "Schema",
  emptyValue: "Not provided",
  unresolvedComponent: "Uncompiled component",
  attachment: "Attachment",
  reference: "Reference",
  tableLabel: "SmartForm data table",
  expand: "Expand sub-procedures",
  collapse: "Collapse sub-procedures",
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

describe("lint test setup", () => {
  afterEach(() => cleanup());

  describe(SmartFormV2TemplateDesigner, () => {
    it("edits a first-class branch question without flattening its slots", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderDesigner(
        onSave,
        CONDITIONAL_CONTENT_SMART_FORM_V2_AUTHORED_FIXTURE,
        "zh-CN"
      );

      await user.click(
        screen.getByRole("button", {
          name: "Edit inventory-applicability-condition",
        })
      );
      const dialog = screen.getByRole("dialog", {
        name: copy.editConditional,
      });
      const label = within(dialog).getByLabelText(copy.questionLabel);
      await user.clear(label);
      await user.type(label, "是否需要执行存货测试？");
      await user.click(
        within(dialog).getByRole("checkbox", { name: copy.required })
      );
      const [firstTrigger] = within(dialog).getAllByRole("combobox", {
        name: copy.conditionTrigger,
      });
      expect(firstTrigger).toBeDefined();
      if (!firstTrigger) {
        return;
      }
      await user.click(firstTrigger);
      await user.click(screen.getByRole("option", { name: "否" }));
      await user.click(within(dialog).getByRole("button", { name: "Update" }));
      await user.click(screen.getByRole("button", { name: "Save template" }));

      const saved = findTreeNode(
        onSave.mock.calls[0][0].children,
        "inventory-applicability-condition"
      );
      expect(saved.kind).toBe("conditional");
      if (saved.kind !== "conditional") {
        return;
      }
      expect(readNodeText(saved.branchQuestion.label, "zh-CN")).toBe(
        "是否需要执行存货测试？"
      );
      expect(saved.branches[0]?.comparison).toStrictEqual({
        type: "singleChoice",
        operator: "selected",
        optionId: "no",
      });
      expect(saved.branches[0]?.children).toHaveLength(1);
      expect(saved.otherwise.children).toHaveLength(1);
      expect(saved.branchQuestion.required).toBeFalsy();
    });

    it("stores table requiredness on the selected answer column", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderDesigner(onSave, undefined, "zh-CN");

      await user.click(
        screen.getByRole("button", {
          name: "Edit deferred-income-general-procedures",
        })
      );
      const dialog = screen.getByRole("dialog", { name: copy.editTable });
      const [firstColumnRequired] = within(dialog).getAllByRole("checkbox");
      expect(firstColumnRequired).toBeChecked();
      await user.click(firstColumnRequired);
      await user.click(within(dialog).getByRole("button", { name: "Update" }));
      await user.click(screen.getByRole("button", { name: "Save template" }));

      const savedSheet = requireSheet(
        findTreeNode(
          onSave.mock.calls[0][0].children,
          "deferred-income-general-procedures"
        )
      );
      const firstAnswerColumn = savedSheet.columns
        .flatMap((column) =>
          column.kind === "columnGroup" ? column.children : [column]
        )
        .find((column) => column.id === "test-required");
      expect(firstAnswerColumn?.kind).toBe("column");
      expect(
        firstAnswerColumn?.kind === "column" &&
          firstAnswerColumn.cell.kind === "field"
          ? firstAnswerColumn.cell.field.required
          : undefined
      ).toBeFalsy();
    });

    it("adds an ordered else-if branch using the next unassigned single-choice option", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderDesigner(
        onSave,
        CONDITIONAL_CONTENT_SMART_FORM_V2_AUTHORED_FIXTURE,
        "zh-CN"
      );
      await user.click(
        screen.getByRole("button", {
          name: "Edit inventory-applicability-condition",
        })
      );
      const dialog = screen.getByRole("dialog", {
        name: copy.editConditional,
      });
      await user.click(
        within(dialog).getByRole("button", { name: copy.conditionAddBranch })
      );
      const triggers = within(dialog).getAllByRole("combobox", {
        name: copy.conditionTrigger,
      });
      expect(triggers).toHaveLength(3);
      expect(triggers[2]).toHaveTextContent("否");
      await user.click(within(dialog).getByRole("button", { name: "Update" }));
      await user.click(screen.getByRole("button", { name: "Save template" }));

      const saved = findTreeNode(
        onSave.mock.calls[0][0].children,
        "inventory-applicability-condition"
      );
      expect(saved.kind).toBe("conditional");
      if (saved.kind !== "conditional") {
        return;
      }
      expect(saved.branches).toHaveLength(3);
      expect(saved.branches[2]?.comparison).toStrictEqual({
        type: "singleChoice",
        operator: "selected",
        optionId: "no",
      });
    });

    it("restricts numeric branch questions to numeric comparisons", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderDesigner(
        onSave,
        CONDITIONAL_CONTENT_SMART_FORM_V2_AUTHORED_FIXTURE,
        "zh-CN"
      );
      await user.click(
        screen.getByRole("button", {
          name: "Edit inventory-applicability-condition",
        })
      );
      const dialog = screen.getByRole("dialog", {
        name: copy.editConditional,
      });
      await user.click(
        within(dialog).getByRole("combobox", { name: copy.questionType })
      );
      await user.click(screen.getByRole("option", { name: copy.number }));
      const [firstExpectedValue] = within(dialog).getAllByLabelText(
        copy.conditionExpected
      );
      expect(firstExpectedValue).toBeDefined();
      if (!firstExpectedValue) {
        return;
      }
      fireEvent.change(firstExpectedValue, { target: { value: "100" } });
      await user.click(within(dialog).getByRole("button", { name: "Update" }));
      await user.click(screen.getByRole("button", { name: "Save template" }));

      const saved = findTreeNode(
        onSave.mock.calls[0][0].children,
        "inventory-applicability-condition"
      );
      expect(saved.kind).toBe("conditional");
      if (saved.kind !== "conditional") {
        return;
      }
      expect(saved.branchQuestion.value.type).toBe("number");
      expect(saved.branches[0]?.comparison).toStrictEqual({
        type: "number",
        operator: "gte",
        value: "100",
      });
    });

    it("edits English copy while preserving the Chinese source", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderDesigner(onSave, undefined, "zh-CN");

      await user.click(screen.getByRole("button", { name: "Switch en-US" }));
      await user.click(
        screen.getByRole("button", { name: "Edit deferred-income-general" })
      );

      expect(screen.getByText("一般审计程序")).toBeInTheDocument();
      const title = screen.getByLabelText("Title");
      await user.clear(title);
      await user.type(title, "Translated general procedures");
      await user.click(screen.getByRole("button", { name: "Update" }));
      await user.click(screen.getByRole("button", { name: "Save template" }));

      const savedSection = findTreeNode(
        onSave.mock.calls[0][0].children,
        "deferred-income-general"
      );
      expect(readNodeText(requireTitle(savedSection), "en-US")).toBe(
        "Translated general procedures"
      );
      expect(readNodeText(requireTitle(savedSection), "zh-CN")).toBe(
        "一般审计程序"
      );
    });

    it("edits English table copy in the same grid layout without structural actions", async () => {
      const user = userEvent.setup();
      const definition = structuredClone(
        DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE
      );
      const sheet = structuredClone(
        findTreeNode(
          DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE.children,
          "deferred-income-general-procedures"
        )
      );
      sheet.id = "translation-grid-table";
      definition.children.push(sheet);
      renderDesigner(vi.fn(), definition, "zh-CN");

      await user.click(screen.getByRole("button", { name: "Switch en-US" }));
      await user.click(
        screen.getByRole("button", { name: "Edit translation-grid-table" })
      );

      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.getByLabelText("Column header 1")).toBeInTheDocument();
      expect(
        screen.getByRole("cell", { name: "Row item 1" })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Add column" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Add row" })
      ).not.toBeInTheDocument();
    });

    it("edits an English audit-procedure component without replacing its structure", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const originalNode = findTreeNode(
        DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE.children,
        "deferred-income-general-procedures"
      );
      if (originalNode.kind !== "component") {
        throw new Error("Expected an audit-procedure component fixture");
      }
      const originalProps = AuditProcedureSheetPropsSchema.parse(
        originalNode.props
      );
      renderDesigner(onSave, undefined, "zh-CN");

      await user.click(screen.getByRole("button", { name: "Switch en-US" }));
      await user.click(
        screen.getByRole("button", {
          name: "Edit deferred-income-general-procedures",
        })
      );
      const firstProcedure = screen.getByRole("textbox", {
        name: "Row item 1",
      });
      await user.clear(firstProcedure);
      await user.type(firstProcedure, "Translated lead-schedule procedure");
      await user.click(screen.getByRole("button", { name: "Update" }));
      await user.click(screen.getByRole("button", { name: "Save template" }));

      const savedNode = findTreeNode(
        onSave.mock.calls[0][0].children,
        "deferred-income-general-procedures"
      );
      expect(savedNode.kind).toBe("component");
      if (savedNode.kind !== "component") {
        throw new Error("Audit-procedure component was replaced");
      }
      const savedProps = AuditProcedureSheetPropsSchema.parse(savedNode.props);
      expect(readNodeText(savedProps.procedures[0].label, "en-US")).toBe(
        "Translated lead-schedule procedure"
      );
      expect(savedProps.procedures[0].label.values["zh-CN"]).toStrictEqual(
        originalProps.procedures[0].label.values["zh-CN"]
      );
    });

    it("edits a section and saves the current definition", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderDesigner(onSave);

      await user.click(
        screen.getByRole("button", { name: "Edit deferred-income-general" })
      );
      const title = screen.getByLabelText("Title");
      await user.clear(title);
      await user.type(title, "Updated general procedures");
      await user.click(screen.getByRole("button", { name: "Update" }));
      await user.click(screen.getByRole("button", { name: "Save template" }));

      expect(onSave).toHaveBeenCalledOnce();
      expect(
        readNodeText(
          requireTitle(
            findTreeNode(
              onSave.mock.calls[0][0].children,
              "deferred-income-general"
            )
          ),
          "en-US"
        )
      ).toBe("Updated general procedures");
    });

    it("edits a top-level static content node without changing its position", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderDesigner(onSave);

      await user.click(
        screen.getByRole("button", {
          name: "Edit deferred-income-audit-objectives",
        })
      );
      fireEvent.change(screen.getByLabelText("Content"), {
        target: { value: "Audit objectives before chapter one." },
      });
      await user.click(screen.getByRole("button", { name: "Update" }));
      await user.click(screen.getByRole("button", { name: "Save template" }));

      const [[saved]] = onSave.mock.calls;
      expect(saved.children[0]).toMatchObject({
        kind: "content",
        id: "deferred-income-audit-objectives",
      });
      expect(saved.children[1]).toMatchObject({
        kind: "section",
        id: "deferred-income-general",
      });
    });

    it("preserves choice option identities while editing question copy", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderDesigner(onSave);

      await user.click(
        screen.getByRole("button", {
          name: "Edit deferred-income-final-conclusion-confirmation",
        })
      );
      const label = screen.getByLabelText("Question");
      await user.clear(label);
      await user.type(label, "Updated final conclusion");
      await user.click(screen.getByRole("button", { name: "Update" }));
      await user.click(screen.getByRole("button", { name: "Save template" }));

      expect(
        findTreeNode(
          onSave.mock.calls[0][0].children,
          "deferred-income-final-conclusion-confirmation"
        )
      ).toMatchObject({
        kind: "field",
        required: true,
        value: {
          type: "choice",
          options: [
            { id: "confirmed", value: "confirmed" },
            { id: "exception", value: "exception" },
          ],
        },
      });
    });

    it("preserves choice identities when options are reordered or removed", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderDesigner(onSave);

      await user.click(
        screen.getByRole("button", {
          name: "Edit deferred-income-final-conclusion-confirmation",
        })
      );
      fireEvent.change(screen.getByLabelText("Options"), {
        target: {
          value: "Exception noted\nConfirmed without exception",
        },
      });
      await user.click(screen.getByRole("button", { name: "Update" }));
      await user.click(screen.getByRole("button", { name: "Save template" }));

      expect(
        requireFieldOptions(
          findTreeNode(
            onSave.mock.calls[0][0].children,
            "deferred-income-final-conclusion-confirmation"
          )
        )
      ).toMatchObject([
        { id: "exception", value: "exception" },
        { id: "confirmed", value: "confirmed" },
      ]);

      cleanup();
      const removeSave = vi.fn();
      renderDesigner(removeSave);
      await user.click(
        screen.getByRole("button", {
          name: "Edit deferred-income-final-conclusion-confirmation",
        })
      );
      fireEvent.change(screen.getByLabelText("Options"), {
        target: { value: "Exception noted" },
      });
      await user.click(screen.getByRole("button", { name: "Update" }));
      await user.click(screen.getByRole("button", { name: "Save template" }));
      expect(
        requireFieldOptions(
          findTreeNode(
            removeSave.mock.calls[0][0].children,
            "deferred-income-final-conclusion-confirmation"
          )
        )
      ).toMatchObject([{ id: "exception", value: "exception" }]);
    });

    it("edits root questions and root tables without losing table conditions", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const definition = structuredClone(
        DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE
      );
      const question = structuredClone(
        findTreeNode(
          definition.children,
          "deferred-income-final-conclusion-confirmation"
        )
      );
      question.id = "root-question";
      const sheet = structuredClone(
        findTreeNode(
          DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE.children,
          "deferred-income-general-procedures"
        )
      );
      const rootTable = requireSheet(sheet);
      rootTable.id = "root-table";
      rootTable.title = undefined;
      rootTable.visibleWhen = { op: "literal", value: false };
      definition.children.push(question, rootTable);
      renderDesigner(onSave, definition);

      await user.click(
        screen.getByRole("button", { name: "Edit root-question" })
      );
      const label = screen.getByLabelText("Question");
      await user.clear(label);
      await user.type(label, "Updated root question");
      await user.click(screen.getByRole("button", { name: "Update" }));

      await user.click(screen.getByRole("button", { name: "Edit root-table" }));
      await user.click(screen.getByRole("button", { name: "Update" }));
      await user.click(screen.getByRole("button", { name: "Save template" }));

      const [[saved]] = onSave.mock.calls;
      expect(
        readNodeText(
          requireLabel(findTreeNode(saved.children, "root-question"))
        )
      ).toBe("Updated root question");
      expect(findTreeNode(saved.children, "root-table")).toMatchObject({
        kind: "sheet",
        title: undefined,
        visibleWhen: { op: "literal", value: false },
      });
    }, 15_000);

    it("preserves compiled table semantics when only the title is edited", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderDesigner(
        onSave,
        {
          ...DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
          i18n: {
            ...DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE.i18n,
            publishingPolicy: "default-required",
          },
        },
        "zh-CN"
      );

      await user.click(
        screen.getByRole("button", {
          name: "Edit deferred-income-general-procedures",
        })
      );
      const title = screen.getByLabelText("Table title");
      await user.clear(title);
      await user.type(title, "Updated procedures");
      await user.click(screen.getByRole("button", { name: "Update" }));
      expect(
        screen.getByRole("button", { name: "Save template" })
      ).not.toBeDisabled();
      await user.click(screen.getByRole("button", { name: "Save template" }));
      const saveError = screen.queryByTestId("save-error");
      if (saveError) {
        throw new Error(saveError.textContent ?? "Unknown save error");
      }

      const savedSheet = findTreeNode(
        onSave.mock.calls[0][0].children,
        "deferred-income-general-procedures"
      );
      const compiledSheet = findTreeNode(
        DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE.children,
        "deferred-income-general-procedures"
      );
      expect(savedSheet).toMatchObject({ kind: "sheet" });
      expect(requireSheet(savedSheet).columns).toStrictEqual(
        requireSheet(compiledSheet).columns
      );
      expect(requireSheet(savedSheet).rows).toStrictEqual(
        requireSheet(compiledSheet).rows
      );
      expect(requireSheet(savedSheet).presentation).toStrictEqual(
        requireSheet(compiledSheet).presentation
      );
    }, 15_000);

    it("converts a question row into a static full-width row", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderDesigner(onSave, undefined, "zh-CN");

      await user.click(
        screen.getByRole("button", {
          name: "Edit deferred-income-general-procedures",
        })
      );
      await user.click(screen.getAllByLabelText("Row type")[0]);
      await user.click(
        await screen.findByRole("option", { name: "Static text row" })
      );
      await user.click(screen.getByRole("button", { name: "Update" }));
      await user.click(screen.getByRole("button", { name: "Save template" }));

      const savedSheet = findTreeNode(
        onSave.mock.calls[0][0].children,
        "deferred-income-general-procedures"
      );
      expect(requireFixedRows(savedSheet).items[0]).toMatchObject({
        role: "group",
        cells: {
          "test-required": { kind: "empty" },
          result: { kind: "empty" },
          "working-paper-reference": { kind: "empty" },
          comments: { kind: "empty" },
        },
      });
    }, 15_000);

    it("renders hierarchy numbering and can collapse and expand group rows", async () => {
      const user = userEvent.setup();
      renderDesigner(vi.fn(), undefined, "zh-CN");

      await user.click(
        screen.getByRole("button", {
          name: "Edit deferred-income-general-procedures",
        })
      );

      expect(screen.getByText("2(a)")).toBeInTheDocument();
      const childLabel = "将本期数据与以前期间数据进行比较；";
      await user.click(screen.getByDisplayValue(childLabel));
      expect(screen.getByText("Parent")).toBeInTheDocument();
      expect(screen.getByText("Level")).toBeInTheDocument();
      expect(screen.getByText("执行分析程序，例如：")).toBeInTheDocument();
      const rowType = screen.getByLabelText("Row type");
      expect(rowType).toHaveTextContent("Question row");
      expect(rowType).toHaveClass("w-full");

      await user.click(
        screen.getByRole("button", { name: "Collapse group 2" })
      );
      expect(screen.queryByDisplayValue(childLabel)).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Expand group 2" }));
      expect(screen.getByDisplayValue(childLabel)).toBeInTheDocument();
    });

    it("uses adaptive dialog sizing and visible row and column selection states", async () => {
      const user = userEvent.setup();
      renderDesigner(vi.fn(), undefined, "zh-CN");

      await user.click(
        screen.getByRole("button", {
          name: "Edit deferred-income-general-procedures",
        })
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("data-adaptive-height", "true");
      expect(dialog.className).not.toContain("h-11/12");
      expect(dialog).toHaveClass("grid-rows-[auto_minmax(0,1fr)_auto]");
      expect(
        dialog.querySelector('[data-smart-form-table-grid="true"]')
      ).toHaveClass("border-border/60");
      expect(
        dialog.querySelector('[data-smart-form-table-scroll="true"]')
      ).toHaveClass("h-full", "overflow-auto");
      expect(
        dialog.querySelector('[data-smart-form-table-inspector="true"]')
      ).toHaveClass("border-border/50", "bg-muted/15");

      const firstColumn = screen.getByLabelText("Column header 1");
      await user.click(firstColumn);
      expect(firstColumn.closest("th")).toHaveAttribute(
        "data-selected",
        "true"
      );

      const firstRow = screen.getByLabelText("Row item 1");
      await user.click(firstRow);
      expect(firstRow.closest("tr")).toHaveAttribute("data-selected", "true");
    });

    it("removes stale row overrides when a table column is deleted", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const definition = structuredClone(
        DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE
      );
      const section = definition.children.find(
        (node) => node.id === "deferred-income-general"
      );
      if (!section || section.kind !== "section") {
        throw new Error("Missing section");
      }
      const localized = structuredClone(section.title);
      section.children.push({
        kind: "sheet",
        id: "native-sheet-with-overrides",
        title: localized,
        presentation: {
          density: "comfortable",
          width: "full",
          responsive: "scroll",
        },
        columns: [
          {
            kind: "column",
            id: "row-label",
            header: localized,
            cell: { kind: "rowLabel" },
          },
          {
            kind: "column",
            id: "kept-column",
            header: localized,
            cell: { kind: "field", field: { value: { type: "text" } } },
          },
          {
            kind: "column",
            id: "removed-column",
            header: localized,
            cell: { kind: "field", field: { value: { type: "text" } } },
          },
        ],
        rows: {
          mode: "fixed",
          items: [
            {
              id: "row-with-override",
              role: "data",
              label: localized,
              cells: { "removed-column": { kind: "empty" } },
            },
          ],
        },
      });
      renderDesigner(onSave, definition, "zh-CN");

      await user.click(
        screen.getByRole("button", { name: "Edit native-sheet-with-overrides" })
      );
      await user.click(
        screen.getByRole("button", { name: "Remove Column header 2" })
      );
      await user.click(screen.getByRole("button", { name: "Update" }));
      await user.click(screen.getByRole("button", { name: "Save template" }));

      const savedSheet = findTreeNode(
        onSave.mock.calls[0][0].children,
        "native-sheet-with-overrides"
      );
      expect(requireFixedRows(savedSheet).items[0].cells).toStrictEqual({});
    });
  });

  function renderDesigner(
    onSave: (definition: SmartFormV2Definition) => void,
    initialDefinition = DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
    locale = "en-US"
  ) {
    return render(
      <SmartFormV2TemplateDesigner
        initialDefinition={initialDefinition}
        locale={locale}
        copy={copy}
        readonlyCopy={readonlyCopy}
        onSave={onSave}
      />
    );
  }

  function findTreeNode(nodes: SmartFormV2Node[], id: string): SmartFormV2Node {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      if (node.kind === "section" || node.kind === "group") {
        const match = findTreeNodeOptional(node.children, id);
        if (match) {
          return match;
        }
      }
      if (node.kind === "conditional") {
        const match = findTreeNodeOptional(
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
    throw new Error(`Missing node ${id}`);
  }

  function findTreeNodeOptional(
    nodes: SmartFormV2Node[],
    id: string
  ): SmartFormV2Node | undefined {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      if (node.kind === "section" || node.kind === "group") {
        const match = findTreeNodeOptional(node.children, id);
        if (match) {
          return match;
        }
      }
      if (node.kind === "conditional") {
        const match = findTreeNodeOptional(
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

  function requireTitle(node: SmartFormV2Node): SmartFormV2LocalizedRichText {
    if (!("title" in node) || !node.title) {
      throw new Error(`Node ${node.id} has no title`);
    }
    return node.title;
  }

  function requireLabel(node: SmartFormV2Node): SmartFormV2LocalizedRichText {
    if (!("label" in node)) {
      throw new Error(`Node ${node.id} has no label`);
    }
    return node.label;
  }

  function requireFieldOptions(node: SmartFormV2Node) {
    if (node.kind !== "field" || !("options" in node.value)) {
      throw new Error(`Node ${node.id} has no options`);
    }
    return node.value.options;
  }

  function requireSheet(node: SmartFormV2Node) {
    if (node.kind !== "sheet") {
      throw new Error(`Node ${node.id} is not a sheet`);
    }
    return node;
  }

  function requireFixedRows(node: SmartFormV2Node) {
    const sheet = requireSheet(node);
    if (sheet.rows.mode !== "fixed") {
      throw new Error(`Sheet ${node.id} is not fixed-row`);
    }
    return sheet.rows;
  }

  function readNodeText(value: SmartFormV2LocalizedRichText, locale = "en-US") {
    const document = value.values[locale] ?? Object.values(value.values)[0];
    return document.content
      .flatMap((block) =>
        block.type === "paragraph" || block.type === "heading"
          ? block.content
          : []
      )
      .map((inline) => ("text" in inline ? (inline.text ?? "") : ""))
      .join("");
  }
});
