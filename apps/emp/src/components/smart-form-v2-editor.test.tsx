import {
  CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
  SmartFormV2ResponseSchema,
} from "@project-wing/shared";
// @vitest-environment jsdom
import type {
  SmartFormV2CompiledDefinition,
  SmartFormV2CoreNode,
  SmartFormV2SheetNode,
} from "@project-wing/shared";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SmartFormV2Editor,
  editorJsonToSmartFormDocument,
  markdownToSmartFormDocument,
} from "./smart-form-v2-editor";
import type { SmartFormV2EditorCopy } from "./smart-form-v2-editor";
import { MOBILE_STRUCTURE_DEFINITION } from "./smart-form-v2-mobile-sheet.fixture";

const copy: SmartFormV2EditorCopy = {
  editorLabel: "Fill SmartForm V2",
  entryMode: "Fill",
  previewMode: "Read only",
  draft: "Draft",
  saved: "Saved",
  unsaved: "Unsaved changes",
  save: "Save",
  select: "Select",
  unselected: "Not selected",
  emptyValue: "Not provided",
  tableLabel: "SmartForm entry table",
  expand: "Expand sub-procedures",
  collapse: "Collapse sub-procedures",
  expandSection: "Expand section",
  collapseSection: "Collapse section",
  expansionControls: "Expansion controls",
  expandAll: "Expand all",
  collapseAll: "Collapse all",
  reset: "Reset",
  resetTitle: "Reset this SmartForm?",
  resetDescription: "This clears every response.",
  cancelReset: "Cancel",
  confirmReset: "Reset form",
  addReference: "Add reference",
  searchReferences: "Search working papers",
  noReferences: "No matching working papers",
  removeReference: "Remove working paper reference",
  editRichText: "Edit rich text",
  richTextPlaceholder: "Enter a response…",
  uploadAttachment: "Upload attachment",
  removeAttachment: "Remove attachment",
  attachment: "Attachment",
  reference: "Reference",
  validationSummary: "{count} responses need attention.",
  draftValidationSummary:
    "{count} responses are incomplete. Draft saving is available.",
  requiredError: "Required.",
  invalidError: "Invalid.",
  required: "Required",
  optional: "Optional",
  structuredRichTextReadOnly: "Structured rich text is read-only.",
  conditionPending: "Answer the branch question first",
  conditionMatched: "Condition matched",
  conditionOtherwise: "Otherwise",
  richText: {
    formattingToolbar: "Formatting toolbar",
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

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function completeResponseFixture() {
    const response = structuredClone(
      DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE
    );
    for (const node of DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE.children) {
      if (node.kind !== "section") {
        continue;
      }
      for (const child of node.children) {
        if (child.kind !== "sheet" || child.rows.mode !== "fixed") {
          continue;
        }
        const answerSheet = response.sheets[child.id] ?? { rows: [] };
        response.sheets[child.id] = answerSheet;
        const visitRows = (
          rows: typeof child.rows.items,
          order?: { value: number }
        ) => {
          const resolvedOrder = order ?? { value: 0 };
          for (const row of rows) {
            if (row.role !== "group") {
              let answerRow = answerSheet.rows.find(
                (item) => item.sourceRowId === row.id
              );
              if (!answerRow) {
                answerRow = {
                  id: `${row.id}-response`,
                  sourceRowId: row.id,
                  order: resolvedOrder.value,
                  cells: {},
                };
                answerSheet.rows.push(answerRow);
              }
              answerRow.cells["test-required"] ??= {
                type: "choice",
                selectedOptionIds: ["yes"],
              };
              answerRow.cells.result ??= {
                type: "choice",
                selectedOptionIds: ["satisfactory"],
              };
            }
            resolvedOrder.value += 1;
            if (row.children) {
              visitRows(row.children, resolvedOrder);
            }
          }
        };
        visitRows(child.rows.items);
      }
    }
    return response;
  }

  describe(SmartFormV2Editor, () => {
    it("keeps mobile sheet content in server markup before the viewport is known", () => {
      const markup = renderToString(
        <SmartFormV2Editor
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          initialResponse={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
        />
      );
      const document = new DOMParser().parseFromString(markup, "text/html");
      expect(
        document.querySelector("[data-smart-form-mobile-records]")?.textContent
      ).toContain("将本期数据与以前期间数据进行比较；");
      expect(document.querySelector("table")?.textContent).toContain(
        "将本期数据与以前期间数据进行比较；"
      );
    });

    it("opens a mobile choice from its full value surface and describes the current answer", async () => {
      vi.stubGlobal("matchMedia", () => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      const { container } = render(
        <SmartFormV2Editor
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          initialResponse={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
          onSave={vi.fn()}
        />
      );
      const field = container.querySelector<HTMLElement>(
        '[data-smart-form-mobile-records] [data-inline-choice="true"]'
      );
      expect(container.querySelector("table")).toBeNull();
      if (!field) {
        throw new Error("Missing choice surface");
      }
      const trigger = within(field).getByRole("button");
      const valueId = trigger.getAttribute("aria-describedby");
      expect(valueId).toBeTruthy();
      expect(field.querySelector(`[id="${valueId}"]`)?.textContent).toContain(
        "是"
      );
      const user = userEvent.setup();
      await user.click(trigger);
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "否" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(field.querySelector(`[id="${valueId}"]`)?.textContent).toContain(
        "否"
      );
      await user.click(trigger);
      expect(
        within(await screen.findByRole("dialog"))
          .getByRole("button", { name: "否" })
          .getAttribute("aria-pressed")
      ).toBe("true");
      await user.keyboard("{Escape}");
      expect(field.querySelector(`[id="${valueId}"]`)?.textContent).toContain(
        "否"
      );
      await user.click(screen.getByRole("button", { name: copy.save }));
      await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
        "Draft saving is available."
      );
    });

    it("saves a mobile grouped field through its original sheet/row/column identity", async () => {
      let mobile = true;
      const listeners = new Set<() => void>();
      vi.stubGlobal("matchMedia", () => ({
        matches: mobile,
        addEventListener: (_event: string, listener: () => void) =>
          listeners.add(listener),
        removeEventListener: (_event: string, listener: () => void) =>
          listeners.delete(listener),
      }));
      const onSave = vi.fn();
      const { container } = render(
        <SmartFormV2Editor
          definition={MOBILE_STRUCTURE_DEFINITION}
          locale="zh-CN"
          copy={copy}
          onSave={onSave}
        />
      );
      const record = container.querySelector<HTMLElement>(
        '[data-smart-form-mobile-records] [data-smart-form-row-id="shelf-a"]'
      );
      if (!record) {
        throw new Error("Missing mobile record");
      }
      const actual = within(record).getByRole("group", { name: /实盘.*数量/ });
      await userEvent.click(
        within(actual).getByRole("button", { name: /Edit:/ })
      );
      const inputSheet = await screen.findByRole("dialog", {
        name: "实盘 / 数量",
      });
      await userEvent.type(within(inputSheet).getByRole("spinbutton"), "42");
      await userEvent.click(
        within(inputSheet).getByRole("button", { name: "Close editor" })
      );
      expect(actual).toHaveTextContent("42");
      act(() => {
        mobile = false;
        for (const listener of listeners) {
          listener();
        }
      });
      expect(
        container.querySelector("[data-smart-form-mobile-records]")
      ).toBeNull();
      expect(screen.getByDisplayValue("42")).toBeInTheDocument();
      act(() => {
        mobile = true;
        for (const listener of listeners) {
          listener();
        }
      });
      expect(
        container.querySelector(
          '[data-smart-form-mobile-records] [data-smart-form-row-id="shelf-a"]'
        )
      ).toHaveTextContent("42");
      expect(
        screen.queryByRole("button", { name: copy.collapseAll })
      ).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: copy.save }));
      await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
      const saved = SmartFormV2ResponseSchema.parse(onSave.mock.calls[0][0]);
      expect(
        saved.sheets["stock-observation"].rows.find(
          (row) => row.sourceRowId === "shelf-a"
        )?.cells.actual
      ).toStrictEqual({ type: "number", decimal: "42" });
    });

    it("shows required progress and keeps top-level guidance collapsed by default", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <SmartFormV2Editor
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          initialResponse={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
        />
      );

      expect(
        container.querySelector("[data-smart-form-mobile-records]")
      ).toBeNull();
      expect(screen.getAllByRole("table").length).toBeGreaterThan(0);
      const progress = screen.getByRole("progressbar");
      expect(Number(progress.getAttribute("aria-valuemax"))).toBeGreaterThan(0);
      expect(
        Number(progress.getAttribute("aria-valuenow"))
      ).toBeGreaterThanOrEqual(0);

      const guidance = screen.getByRole("button", { name: "审计目标" });
      expect(guidance).toHaveAttribute("aria-expanded", "false");
      expect(
        screen.queryByText("确保递延收入已正确核算且记录完整。")
      ).not.toBeInTheDocument();

      await user.click(guidance);
      expect(guidance).toHaveAttribute("aria-expanded", "true");
      expect(
        screen.getByText("确保递延收入已正确核算且记录完整。")
      ).toBeInTheDocument();
    });

    it("switches conditional content after its branch question is answered", async () => {
      const user = userEvent.setup();
      render(
        <SmartFormV2Editor
          definition={CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE}
          initialResponse={{
            kind: "smartFormResponse",
            schemaVersion: 2,
            definitionVersionId: "conditional-content-smart-form-v2",
            responseLocale: "zh-CN",
            updatedAt: "2026-08-28T00:00:00.000Z",
            fields: {},
            sheets: {},
          }}
          locale="zh-CN"
          copy={copy}
        />
      );

      expect(screen.queryByText(copy.conditionPending)).not.toBeInTheDocument();
      await user.click(screen.getByRole("combobox", { name: copy.select }));
      await user.click(await screen.findByRole("option", { name: "是" }));
      expect(screen.getByText("执行存货监盘及计价测试。")).toBeInTheDocument();
      expect(
        screen.queryByText("记录不适用存货程序的理由。")
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole("combobox", { name: copy.select }));
      await user.click(await screen.findByRole("option", { name: "否" }));
      expect(
        screen.getByText("记录不适用存货程序的理由。")
      ).toBeInTheDocument();
      expect(
        screen.queryByText("执行存货监盘及计价测试。")
      ).not.toBeInTheDocument();
    });

    it("edits a sheet cell and saves a valid V2 response", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(
        <SmartFormV2Editor
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          initialResponse={completeResponseFixture()}
          locale="zh-CN"
          copy={copy}
          onSave={onSave}
        />
      );

      const save = screen.getByRole("button", { name: "Save" });
      expect(save).toBeDisabled();

      await user.click(
        screen.getAllByRole("button", {
          name: "Remove working paper reference",
        })[0]
      );
      expect(screen.getAllByText("Unsaved changes").length).toBeGreaterThan(0);
      expect(save).toBeEnabled();

      await user.click(save);
      expect(onSave).toHaveBeenCalledOnce();
      const [[nextResponse]] = onSave.mock.calls;
      expect(
        SmartFormV2ResponseSchema.safeParse(nextResponse).success
      ).toBeTruthy();
      expect(
        nextResponse.sheets["deferred-income-general-procedures"].rows[0].cells[
          "working-paper-reference"
        ]
      ).toStrictEqual({ type: "reference", references: [] });
    }, 30_000);

    it("keeps a failed save dirty so it can be retried", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockRejectedValue(new Error("Save failed"));
      render(
        <SmartFormV2Editor
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          initialResponse={completeResponseFixture()}
          locale="zh-CN"
          copy={copy}
          onSave={onSave}
        />
      );

      await user.click(
        screen.getAllByRole("button", {
          name: "Remove working paper reference",
        })[0]
      );
      const save = screen.getByRole("button", { name: "Save" });
      await user.click(save);

      await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
      expect(screen.getAllByText("Unsaved changes").length).toBeGreaterThan(0);
      expect(save).toBeEnabled();
    }, 30_000);

    it("saves an incomplete draft while showing required-field issues", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(
        <SmartFormV2Editor
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          initialResponse={completeResponseFixture()}
          locale="zh-CN"
          copy={copy}
          onSave={onSave}
        />
      );

      const save = screen.getByRole("button", { name: "Save" });
      await user.click(screen.getAllByRole("combobox", { name: "Select" })[0]);
      await user.click(
        await screen.findByRole("option", { name: "Not selected" })
      );
      await user.click(save);

      expect(onSave).toHaveBeenCalledOnce();
      expect(screen.getAllByText("Required.").length).toBeGreaterThan(0);
      expect(
        screen.getByText("1 responses need attention.")
      ).toBeInTheDocument();
    }, 30_000);

    it("uses the shared rich text composer for non-compact rich text fields", () => {
      render(
        <SmartFormV2Editor
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          initialResponse={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
        />
      );

      expect(
        screen.getByRole("textbox", { name: "Edit rich text" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("toolbar", { name: "Formatting toolbar" })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Inline code" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Link" })
      ).not.toBeInTheDocument();
    }, 30_000);

    it("preserves unsupported structured rich text as read-only content", () => {
      const response = structuredClone(
        DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE
      );
      response.fields["deferred-income-final-conclusion-details"] = {
        type: "richText",
        document: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "heading",
              id: "structured-heading",
              level: 4,
              content: [{ type: "text", text: "Preserve this heading" }],
            },
          ],
        },
      };

      render(
        <SmartFormV2Editor
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          initialResponse={response}
          locale="zh-CN"
          copy={copy}
        />
      );

      expect(screen.getByText("Preserve this heading")).toBeInTheDocument();
      expect(
        screen.getByText("Structured rich text is read-only.")
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("textbox", { name: "Edit rich text" })
      ).not.toBeInTheDocument();
    });

    it("preserves stable rich text block IDs while editing", () => {
      const previous = {
        type: "doc" as const,
        version: 1 as const,
        content: [
          {
            type: "paragraph" as const,
            id: "stable-paragraph-a",
            content: [{ type: "text" as const, text: "第一段" }],
          },
          {
            type: "paragraph" as const,
            id: "stable-paragraph-b",
            content: [{ type: "text" as const, text: "第二段" }],
          },
        ],
      };
      const next = markdownToSmartFormDocument(
        "第一段\n第二段补充",
        "field-id",
        previous
      );

      expect(next.content.map((block) => block.id)).toStrictEqual([
        "stable-paragraph-a",
        "stable-paragraph-b",
      ]);
    });

    it("does not migrate an ID when an earlier rich text block is deleted", () => {
      const previous = {
        type: "doc" as const,
        version: 1 as const,
        content: [
          {
            type: "paragraph" as const,
            id: "paragraph-a",
            content: [{ type: "text" as const, text: "A" }],
          },
          {
            type: "paragraph" as const,
            id: "paragraph-b",
            content: [{ type: "text" as const, text: "B" }],
          },
        ],
      };
      const next = editorJsonToSmartFormDocument(
        {
          type: "doc",
          content: [
            {
              type: "paragraph",
              attrs: { smartFormNodeId: "paragraph-b" },
              content: [{ type: "text", text: "B edited" }],
            },
          ],
        },
        "field-id",
        previous
      );

      expect(next.content).toMatchObject([
        { id: "paragraph-b", content: [{ text: "B edited" }] },
      ]);
    });

    it("preserves nested rich text list IDs from editor node attributes", () => {
      const next = editorJsonToSmartFormDocument(
        {
          type: "doc",
          content: [
            {
              type: "bulletList",
              attrs: { smartFormNodeId: "list-a" },
              content: [
                {
                  type: "listItem",
                  attrs: { smartFormNodeId: "item-a" },
                  content: [
                    {
                      type: "paragraph",
                      attrs: { smartFormNodeId: "item-a-paragraph" },
                      content: [{ type: "text", text: "Updated item" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        "field-id"
      );

      expect(next.content).toMatchObject([
        {
          id: "list-a",
          items: [
            {
              id: "item-a",
              content: [{ id: "item-a-paragraph" }],
            },
          ],
        },
      ]);
    });

    it("does not render a fixed sheet cell whose condition is false", () => {
      const definition = structuredClone(
        DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE
      );
      const sheet = findFirstSheet(definition);
      if (sheet.rows.mode !== "fixed") {
        throw new Error("Expected fixed sheet");
      }
      const [firstRow] = sheet.rows.items;
      firstRow.cells = {
        ...firstRow.cells,
        comments: {
          kind: "field",
          visibleWhen: { op: "literal", value: false },
        },
      };

      render(
        <SmartFormV2Editor
          definition={definition}
          initialResponse={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
        />
      );

      expect(
        screen.queryByText("主表已与总账核对，无差异。")
      ).not.toBeInTheDocument();
    });

    it("keeps fields optional when required and requiredWhen are absent", () => {
      const definition = structuredClone(
        DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE
      );
      const optionalField = findField(
        definition,
        "deferred-income-final-conclusion-details"
      );
      delete optionalField.required;
      delete optionalField.requiredWhen;

      render(
        <SmartFormV2Editor
          definition={definition}
          initialResponse={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
        />
      );

      const standaloneLabel = screen
        .getByText("例外事项或补充说明（可选）")
        .closest("label");
      expect(standaloneLabel).not.toBeNull();
      expect(
        (standaloneLabel as HTMLLabelElement).querySelector(
          '[data-smart-form-required-state="optional"]'
        )
      ).toHaveClass("sr-only");
      expect(
        screen
          .getAllByRole("columnheader")
          .some((header) =>
            Boolean(
              header.querySelector(
                '[data-smart-form-required-state="required"]'
              )
            )
          )
      ).toBeTruthy();
      expect(
        screen
          .getAllByRole("columnheader")
          .some((header) =>
            Boolean(
              header.querySelector(
                '[data-smart-form-required-state="optional"]'
              )
            )
          )
      ).toBeTruthy();
      screen
        .getAllByRole("group", {
          name: "取得并检查（或编制）本年度数据主表，并与总账核对。: 备注",
        })
        .forEach((group) => expect(group).not.toHaveAttribute("aria-required"));
    });

    it("collapses complete sections in entry mode", async () => {
      const user = userEvent.setup();
      render(
        <SmartFormV2Editor
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          initialResponse={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
        />
      );

      await user.click(
        screen.getAllByRole("button", { name: "Collapse section" })[0]
      );
      expect(
        screen.queryByText("取得并检查（或编制）本年度数据主表，并与总账核对。")
      ).not.toBeInTheDocument();
    });

    it("expands and collapses the complete form from the document toolbar", async () => {
      const user = userEvent.setup();
      render(
        <SmartFormV2Editor
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          initialResponse={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
        />
      );

      await user.click(screen.getByRole("button", { name: "Collapse all" }));
      expect(
        screen.queryByText("取得并检查（或编制）本年度数据主表，并与总账核对。")
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Expand all" }));
      expect(
        screen.getAllByText(
          "取得并检查（或编制）本年度数据主表，并与总账核对。"
        ).length
      ).toBeGreaterThan(0);
    }, 30_000);

    it("opens the shared review-question flow from fields and table rows", async () => {
      const user = userEvent.setup();
      const onOpen = vi.fn();
      render(
        <SmartFormV2Editor
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          initialResponse={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
          reviewQuestions={{
            buttonLabel: "Add review question",
            getQuestionCount: (target) =>
              target.label.includes("取得并检查") ? 2 : 0,
            onOpen,
          }}
        />
      );

      const [rowButton] = screen.getAllByRole("button", {
        name: /Add review question: 取得并检查/,
      });
      expect(rowButton).toHaveTextContent("2");
      expect(rowButton).not.toHaveTextContent("Q");
      await user.click(rowButton);
      expect(onOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          rowId: expect.any(String),
          label: expect.stringContaining("取得并检查"),
        })
      );

      await user.click(
        screen.getAllByRole("button", {
          name: /Add review question: 最终结论/,
        })[0]
      );
      expect(onOpen).toHaveBeenLastCalledWith(
        expect.objectContaining({
          nodeId: expect.any(String),
          label: "最终结论",
        })
      );
    }, 30_000);

    it("reveals a conditionally hidden row when a review question targets it", async () => {
      const definition = structuredClone(
        DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE
      );
      const hiddenSection = definition.children.find(
        (node) => node.id === "deferred-income-presentation"
      );
      if (!hiddenSection || hiddenSection.kind !== "section") {
        throw new Error("Missing presentation section");
      }
      hiddenSection.visibleWhen = { op: "literal", value: false };
      const hiddenSheet = hiddenSection.children.find(
        (node) => node.kind === "sheet"
      );
      if (!hiddenSheet || hiddenSheet.kind !== "sheet") {
        throw new Error("Missing presentation sheet");
      }
      if (hiddenSheet.rows.mode !== "fixed") {
        throw new Error("Expected fixed presentation sheet");
      }
      const targetRowId = hiddenSheet.rows.items[0].id;
      const { container: _container } = render(
        <SmartFormV2Editor
          definition={definition}
          initialResponse={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
          focusTarget={{
            nodeId: hiddenSheet.id,
            rowId: targetRowId,
            label: "Hidden presentation procedure",
          }}
        />
      );

      expect(screen.getByText("列报与披露")).toBeInTheDocument();
      await waitFor(() => {});
    });

    it("requires confirmation before resetting every response", async () => {
      const user = userEvent.setup();
      render(
        <SmartFormV2Editor
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          initialResponse={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
        />
      );

      expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
      expect(
        screen.getAllByRole("combobox", { name: "Select" })[0]
      ).not.toHaveTextContent("Not selected");

      await user.click(screen.getByRole("button", { name: "Reset" }));
      expect(
        screen.getByRole("alertdialog", { name: "Reset this SmartForm?" })
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Reset" }));
      await user.click(screen.getByRole("button", { name: "Reset form" }));

      expect(
        screen.queryByRole("alertdialog", { name: "Reset this SmartForm?" })
      ).not.toBeInTheDocument();
      expect(
        screen.getAllByRole("combobox", { name: "Select" })[0]
      ).toHaveTextContent("Not selected");
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    }, 30_000);
  });

  function findFirstSheet(
    definition: SmartFormV2CompiledDefinition
  ): SmartFormV2SheetNode {
    const visit = (
      nodes: SmartFormV2CoreNode[]
    ): SmartFormV2SheetNode | undefined => {
      for (const node of nodes) {
        if (node.kind === "sheet") {
          return node;
        }
        if (node.kind === "section" || node.kind === "group") {
          const nested = visit(node.children);
          if (nested) {
            return nested;
          }
        }
      }
      return undefined;
    };
    const sheet = visit(definition.children);
    if (!sheet) {
      throw new Error("Missing sheet fixture");
    }
    return sheet;
  }

  function findField(
    definition: SmartFormV2CompiledDefinition,
    fieldId: string
  ): Extract<SmartFormV2CoreNode, { kind: "field" }> {
    const visit = (
      nodes: SmartFormV2CoreNode[]
    ): Extract<SmartFormV2CoreNode, { kind: "field" }> | undefined => {
      for (const node of nodes) {
        if (node.kind === "field" && node.id === fieldId) {
          return node;
        }
        if (node.kind === "section" || node.kind === "group") {
          const nested = visit(node.children);
          if (nested) {
            return nested;
          }
        }
      }
      return undefined;
    };
    const field = visit(definition.children);
    if (!field) {
      throw new Error(`Missing field fixture: ${fieldId}`);
    }
    return field;
  }
});
