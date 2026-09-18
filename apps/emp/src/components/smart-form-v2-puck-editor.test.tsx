import {
  CONDITIONAL_CONTENT_SMART_FORM_V2_AUTHORED_FIXTURE,
  CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
} from "@project-wing/shared";
// @vitest-environment jsdom
import type { SmartFormV2Definition } from "@project-wing/shared";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  SMART_FORM_PUCK_COMPONENTS,
  SmartFormV2PuckEditor,
  definitionToPuckData,
  puckDataToDefinition,
} from "./smart-form-v2-puck-editor";
import type {
  SmartFormPuckCopy,
  SmartFormPuckData,
} from "./smart-form-v2-puck-editor";

const copy: SmartFormPuckCopy = {
  section: "Section",
  staticText: "Static text",
  conditional: "Branch question",
  conditionMatched: "Condition matched",
  conditionOtherwise: "Otherwise",
  conditionSelected: "Selected",
  conditionIncludesAny: "Includes any",
  conditionIncludesAll: "Includes all",
  conditionIf: "If",
  conditionElseIf: "Else if",
  branchQuestionPlaceholder: "Enter a branch question",
  question: "Question",
  table: "Table",
  insert: "Insert",
  editGroup: "Edit",
  viewGroup: "View",
  undo: "Undo",
  redo: "Redo",
  moreCommands: "More commands",
  preview: "Preview",
  language: "Language",
  languageChinese: "中文",
  languageEnglish: "English",
  translationMode: "Translate text only.",
  chineseReference: "Chinese reference",
  save: "Save",
  saved: "Saved",
  unsaved: "Unsaved",
  edit: "Edit",
  required: "Required",
  optional: "Optional",
  emptyValue: "Not provided",
  dropIntoSection: "Drop into section",
  dropIntoDocument: "Drop into document",
  sectionTitlePlaceholder: "New section",
  staticTextPlaceholder: "Static text",
  fieldLabelPlaceholder: "New question",
  tableTitlePlaceholder: "New table",
  rowHeader: "Row",
  columnHeader: "Answer",
  rowLabel: "New row",
  yes: "Yes",
  no: "No",
  singleChoice: "Single choice",
  multipleChoice: "Multiple choice",
  text: "Text",
  richText: "Rich text",
  number: "Number",
  reference: "Reference",
  attachment: "Attachment",
  date: "Date",
};

describe("smartForm V2 Puck adapter", () => {
  it("round-trips first-class conditional slots without flattening branches", () => {
    const data = definitionToPuckData(
      CONDITIONAL_CONTENT_SMART_FORM_V2_AUTHORED_FIXTURE,
      CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE,
      "zh-CN",
      copy
    );
    const [conditional] = data.content;
    expect(conditional?.type).toBe(SMART_FORM_PUCK_COMPONENTS.conditional);
    expect(
      conditional?.type === SMART_FORM_PUCK_COMPONENTS.conditional
        ? conditional.props.branch0
        : []
    ).toHaveLength(1);
    expect(
      conditional?.type === SMART_FORM_PUCK_COMPONENTS.conditional
        ? conditional.props.otherwise
        : []
    ).toHaveLength(1);
    expect(
      conditional?.type === SMART_FORM_PUCK_COMPONENTS.conditional
        ? conditional.props.required
        : undefined
    ).toBeTruthy();
    expect(
      puckDataToDefinition(
        data,
        CONDITIONAL_CONTENT_SMART_FORM_V2_AUTHORED_FIXTURE,
        copy
      )
    ).toStrictEqual(CONDITIONAL_CONTENT_SMART_FORM_V2_AUTHORED_FIXTURE);
  });

  it("renders conditional branch slots in the Puck canvas", () => {
    const view = render(
      <SmartFormV2PuckEditor
        definition={CONDITIONAL_CONTENT_SMART_FORM_V2_AUTHORED_FIXTURE}
        compiledDefinition={CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE}
        locale="zh-CN"
        copy={copy}
        dirty={false}
        onChange={() => {}}
        onEditNode={() => {}}
        onSave={() => {}}
      />
    );

    expect(view.getByText("客户业务是否包含存货？")).toBeInTheDocument();
    expect(
      view.container.querySelector(
        '[data-smart-form-required-state="required"]'
      )
    ).toHaveClass("text-destructive");
    expect(view.getByText("执行存货监盘及计价测试。")).toBeInTheDocument();
    expect(view.getByText("记录不适用存货程序的理由。")).toBeInTheDocument();
  });

  it("exposes the approved compact command bar and narrow overflow actions", () => {
    const view = render(
      <SmartFormV2PuckEditor
        definition={DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE}
        compiledDefinition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
        headerSubtitle="SF-AUD-DEFERRED-INCOME"
        headerTitle="Audit Programme — Deferred income"
        locale="zh-CN"
        copy={copy}
        dirty={false}
        onChange={() => {}}
        onEditNode={() => {}}
        onSave={() => {}}
      />
    );

    expect(
      view.container.querySelector(
        '[role="toolbar"][aria-label="Insert · Edit · View"]'
      )
    ).not.toBeNull();
    expect(view.getByText("SF-AUD-DEFERRED-INCOME · 中文")).toBeInTheDocument();

    const moreCommands = view.container.querySelector<HTMLButtonElement>(
      'button[aria-label="More commands"]'
    );
    expect(moreCommands).not.toBeNull();
    if (!moreCommands) {
      return;
    }
    fireEvent.click(moreCommands);
    expect(
      view.getByRole("menuitemradio", { name: "中文" })
    ).toBeInTheDocument();
    expect(
      view.getByRole("menuitemradio", { name: "English" })
    ).toBeInTheDocument();
    view.unmount();
  });

  it("mounts the full deferred-income fixture without invalid slot data", () => {
    const view = render(
      <SmartFormV2PuckEditor
        definition={DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE}
        compiledDefinition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
        locale="en-US"
        copy={copy}
        dirty={false}
        onChange={() => {}}
        onEditNode={() => {}}
        onSave={() => {}}
      />
    );
    const staticRow = view
      .getByText("Carry out analytical procedures such as:")
      .closest("tr");
    expect(staticRow).not.toBeNull();
    if (!staticRow) {
      return;
    }
    expect(staticRow.querySelectorAll("td")).toHaveLength(1);

    const sectionChildSlots = [
      ...view.container.querySelectorAll(
        '[data-smart-form-hierarchy="section-children"]'
      ),
    ];
    expect(sectionChildSlots.length).toBeGreaterThan(0);
    expect(
      sectionChildSlots.some((sectionSlot) =>
        sectionSlot.querySelector("table")
      )
    ).toBeTruthy();
  });

  it("edits document title and description only in the designer locale", () => {
    const onDefinitionChange = vi.fn();
    const originalEnglishTitle = structuredClone(
      DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE.title.values["en-US"]
    );
    const originalEnglishDescription = structuredClone(
      DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE.description?.values[
        "en-US"
      ]
    );

    function Harness() {
      const [definition, setDefinition] = useState(() =>
        structuredClone(DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE)
      );
      return (
        <SmartFormV2PuckEditor
          definition={definition}
          compiledDefinition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          locale="zh-CN"
          copy={copy}
          dirty={false}
          onChange={(nextDefinition) => {
            setDefinition(nextDefinition);
            onDefinitionChange(nextDefinition);
          }}
          onEditNode={() => {}}
          onSave={() => {}}
        />
      );
    }

    const view = render(<Harness />);
    fireEvent.change(view.getByDisplayValue("审计程序——递延收入"), {
      target: { value: "递延收入审计程序（模板版）" },
    });
    fireEvent.change(
      view.getByDisplayValue(
        "由原始递延收入审计程序工作表转换而成的中英双语 SmartForm V2。"
      ),
      { target: { value: "模板设计者维护的递延收入审计程序说明。" } }
    );

    expect(onDefinitionChange).toHaveBeenCalledTimes(2);
    const latest = onDefinitionChange.mock.calls.at(-1)?.[0];
    expect(latest.title.values["zh-CN"].content[0].content[0].text).toBe(
      "递延收入审计程序（模板版）"
    );
    expect(latest.description.values["zh-CN"].content[0].content[0].text).toBe(
      "模板设计者维护的递延收入审计程序说明。"
    );
    expect(latest.title.values["en-US"]).toStrictEqual(originalEnglishTitle);
    expect(latest.description.values["en-US"]).toStrictEqual(
      originalEnglishDescription
    );
  });

  it("removes only the English optional description and keeps the Chinese source", () => {
    const onDefinitionChange = vi.fn();

    function Harness() {
      const [definition, setDefinition] = useState(() =>
        structuredClone(DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE)
      );
      return (
        <SmartFormV2PuckEditor
          definition={definition}
          compiledDefinition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          locale="en-US"
          copy={copy}
          dirty={false}
          onChange={(nextDefinition) => {
            setDefinition(nextDefinition);
            onDefinitionChange(nextDefinition);
          }}
          onEditNode={() => {}}
          onSave={() => {}}
        />
      );
    }

    const view = render(<Harness />);
    const descriptionFields = view.getAllByDisplayValue(
      "Bilingual SmartForm V2 converted from the source deferred income audit programme worksheet."
    );
    fireEvent.change(
      descriptionFields.at(-1) ??
        (() => {
          throw new Error("Description field is missing");
        })(),
      { target: { value: "" } }
    );

    const latest = onDefinitionChange.mock.calls.at(-1)?.[0];
    expect(latest.description.values["en-US"]).toBeUndefined();
    expect(latest.description.values["zh-CN"]).toBeDefined();
  });

  it("hides structural insertion controls in English translation mode", () => {
    const view = render(
      <SmartFormV2PuckEditor
        definition={DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE}
        compiledDefinition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
        locale="en-US"
        copy={copy}
        dirty={false}
        onChange={() => {}}
        onEditNode={() => {}}
        onSave={() => {}}
      />
    );
    const buttons = [...view.container.querySelectorAll("button")];
    const undoButtons = buttons.filter((button) =>
      button.textContent?.includes("Undo")
    );
    const redoButtons = buttons.filter((button) =>
      button.textContent?.includes("Redo")
    );
    expect(undoButtons.length).toBeGreaterThan(0);
    expect(redoButtons.length).toBeGreaterThan(0);
    expect(undoButtons.every((button) => button.disabled)).toBeTruthy();
    expect(redoButtons.every((button) => button.disabled)).toBeTruthy();
    expect(
      buttons.some((button) => button.textContent?.includes("English"))
    ).toBeTruthy();

    const englishButton = buttons.find((button) =>
      button.textContent?.includes("English")
    );
    if (!englishButton) {
      throw new Error("English language button is missing");
    }
    fireEvent.click(englishButton);
    expect(view.getByText("Language")).toBeInTheDocument();
    expect(
      view.getByRole("menuitemradio", { name: "中文" })
    ).toBeInTheDocument();
    expect(
      view.getByRole("menuitemradio", { name: "English" })
    ).toBeInTheDocument();
  });

  it("refreshes every localized block when the designer locale changes", async () => {
    const englishData = definitionToPuckData(
      DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
      DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      "en-US",
      copy
    );
    const collectLocalizedText = (component: unknown): string[] => {
      if (!component || typeof component !== "object") {
        return [];
      }
      const { props } = component as { props?: Record<string, unknown> };
      if (!props) {
        return [];
      }
      const directText = [props.text, props.title, props.description].filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0
      );
      const rowText = Array.isArray(props.rows)
        ? props.rows.flatMap((row) =>
            row && typeof row === "object" && "label" in row
              ? [String(row.label)]
              : []
          )
        : [];
      const childText = Array.isArray(props.content)
        ? props.content.flatMap(collectLocalizedText)
        : [];
      return [...directText, ...rowText, ...childText];
    };
    const expectedLocalizedText =
      englishData.content.flatMap(collectLocalizedText);
    const editor = (locale: string) => (
      <SmartFormV2PuckEditor
        definition={DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE}
        compiledDefinition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
        locale={locale}
        copy={copy}
        dirty={false}
        onChange={() => {}}
        onEditNode={() => {}}
        onSave={() => {}}
      />
    );
    const view = render(editor("zh-CN"));

    view.rerender(editor("en-US"));

    await waitFor(() => {
      const canvasText = view.container.textContent ?? "";
      expect(
        expectedLocalizedText.every((value) => canvasText.includes(value))
      ).toBeTruthy();
    });
  });

  it.each(DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE.children)(
    "mounts top-level node $id",
    (node) => {
      expect(() =>
        render(
          <SmartFormV2PuckEditor
            definition={{
              ...DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
              children: [node],
            }}
            locale="en-US"
            copy={copy}
            dirty={false}
            onChange={() => {}}
            onEditNode={() => {}}
            onSave={() => {}}
          />
        )
      ).not.toThrow();
    }
  );

  it("mounts an empty section", () => {
    const section =
      DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE.children.find(
        (node) => node.kind === "section"
      );
    expect(section?.kind).toBe("section");
    if (!section || section.kind !== "section") {
      return;
    }
    expect(() =>
      render(
        <SmartFormV2PuckEditor
          definition={{
            ...DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
            children: [{ ...section, children: [] }],
          }}
          locale="en-US"
          copy={copy}
          dirty={false}
          onChange={() => {}}
          onEditNode={() => {}}
          onSave={() => {}}
        />
      )
    ).not.toThrow();
  });

  it("emits complete component records for every nested slot", () => {
    const data = definitionToPuckData(
      DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
      DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      "en-US",
      copy
    );
    const visit = (content: SmartFormPuckData["content"], path = "root") => {
      content.forEach((component, index) => {
        expect(component, `${path}[${index}]`).toBeDefined();
        expect(component.props.id, `${path}[${index}].props.id`).toBeTruthy();
        if (component.type === "Section") {
          visit(
            component.props.content as SmartFormPuckData["content"],
            `${path}[${index}].content`
          );
        }
      });
    };

    visit(data.content);
  });

  it("round-trips the authored AST without losing semantic metadata", () => {
    const data = definitionToPuckData(
      DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
      DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      "en-US",
      copy
    );

    expect(
      puckDataToDefinition(
        data,
        DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
        copy
      )
    ).toStrictEqual(DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE);
  });

  it("preserves recursively nested sections", () => {
    const outer = DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE.children.find(
      (node) => node.kind === "section"
    );
    expect(outer?.kind).toBe("section");
    if (!outer || outer.kind !== "section") {
      return;
    }

    const nested: SmartFormV2Definition = {
      ...DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
      children: [
        {
          ...outer,
          children: [
            {
              ...outer,
              id: "nested-section",
              title: {
                values: {
                  "en-US": {
                    type: "doc",
                    version: 1,
                    content: [
                      {
                        type: "paragraph",
                        id: "nested-title",
                        content: [{ type: "text", text: "Nested section" }],
                      },
                    ],
                  },
                },
              },
              children: outer.children.slice(0, 1),
            },
          ],
        },
      ],
    };
    const data = definitionToPuckData(nested, undefined, "en-US", copy);
    const [outerData] = data.content;
    expect(outerData.type).toBe("Section");
    if (outerData.type !== "Section") {
      return;
    }
    expect(
      (outerData.props.content as SmartFormPuckData["content"])[0]?.type
    ).toBe("Section");
    expect(puckDataToDefinition(data, nested, copy)).toStrictEqual(nested);
  });

  it("moves a block into a section according to the Puck slot tree", () => {
    const data = definitionToPuckData(
      DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
      DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      "en-US",
      copy
    );
    const section = data.content.find(
      (component) => component.type === "Section"
    );
    const staticText = data.content.find(
      (component) => component.type === "StaticText"
    );
    expect(section).toBeDefined();
    expect(staticText).toBeDefined();
    if (!section || !staticText) {
      return;
    }

    const moved: SmartFormPuckData = {
      ...data,
      content: data.content.filter(
        (component) => component.props.id !== staticText.props.id
      ),
    };
    const movedSection = moved.content.find(
      (component) => component.props.id === section.props.id
    );
    if (!movedSection || movedSection.type !== "Section") {
      return;
    }
    movedSection.props.content = [
      ...((movedSection.props.content as SmartFormPuckData["content"]) ?? []),
      staticText,
    ];

    const definition = puckDataToDefinition(
      moved,
      DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
      copy
    );
    const authoredSection = definition.children.find(
      (node) => node.id === section.props.id
    );
    expect(
      authoredSection?.kind === "section" || authoredSection?.kind === "group"
        ? authoredSection.children.at(-1)?.id
        : undefined
    ).toBe(staticText.props.id);
  });
});
