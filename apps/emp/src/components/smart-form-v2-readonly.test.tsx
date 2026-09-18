import {
  CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
} from "@project-wing/shared";
// @vitest-environment jsdom
import type {
  SmartFormV2CompiledDefinition,
  SmartFormV2CoreNode,
  SmartFormV2SheetNode,
} from "@project-wing/shared";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MOBILE_STRUCTURE_DEFINITION } from "./smart-form-v2-mobile-sheet.fixture";
import { SmartFormV2Readonly } from "./smart-form-v2-readonly";
import type { SmartFormV2ReadonlyCopy } from "./smart-form-v2-readonly";

const copy: SmartFormV2ReadonlyCopy = {
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
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe(SmartFormV2Readonly, () => {
    it("server-renders readable mobile and desktop content before hydration knows the viewport", () => {
      const markup = renderToString(
        <SmartFormV2Readonly
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          response={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
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

    it("mounts only mobile records while retaining explicit comparison tables", () => {
      vi.stubGlobal("matchMedia", () => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      const view = render(
        <SmartFormV2Readonly
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          response={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
        />
      );
      expect(view.container.querySelector("table")).toBeNull();
      expect(
        view.container.querySelector("[data-smart-form-mobile-records]")
      ).not.toBeNull();
      expect(
        screen.getByText("将本期数据与以前期间数据进行比较；")
      ).toBeInTheDocument();

      view.rerender(
        <SmartFormV2Readonly
          definition={MOBILE_STRUCTURE_DEFINITION}
          locale="zh-CN"
          copy={copy}
        />
      );
      expect(screen.getAllByRole("table")).toHaveLength(1);
      expect(
        view.container.querySelector("[data-smart-form-mobile-records]")
      ).not.toBeNull();
    });

    it("renders a conditional question like an ordinary question", () => {
      const response = {
        kind: "smartFormResponse" as const,
        schemaVersion: 2 as const,
        definitionVersionId: "conditional-content-smart-form-v2",
        responseLocale: "zh-CN",
        updatedAt: "2026-08-28T00:00:00.000Z",
        fields: {
          "inventory-applicability-question": {
            type: "choice" as const,
            selectedOptionIds: ["yes"],
          },
        },
        sheets: {},
      };
      const view = render(
        <SmartFormV2Readonly
          definition={CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE}
          response={response}
          locale="zh-CN"
          copy={copy}
        />
      );

      expect(screen.getByText("执行存货监盘及计价测试。")).toBeInTheDocument();
      expect(
        screen.queryByText("记录不适用存货程序的理由。")
      ).not.toBeInTheDocument();

      view.rerender(
        <SmartFormV2Readonly
          definition={CONDITIONAL_CONTENT_SMART_FORM_V2_COMPILED_FIXTURE}
          locale="zh-CN"
          copy={copy}
        />
      );
      expect(screen.queryByText(copy.conditionPending)).not.toBeInTheDocument();
    });

    it("renders the compiled Deferred Income hierarchy and response values", () => {
      render(
        <SmartFormV2Readonly
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          response={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
        />
      );

      expect(
        screen.getByRole("heading", { name: "审计程序——递延收入", level: 1 })
      ).toBeInTheDocument();

      const [childNumber] = screen.getAllByText("2(a)");
      const childRow = childNumber.closest("tr");
      expect(childRow).not.toBeNull();
      expect(
        within(childRow as HTMLTableRowElement).getByText(
          "将本期数据与以前期间数据进行比较；"
        )
      ).toBeInTheDocument();
      expect(
        within(childRow as HTMLTableRowElement).getByText(
          "3200.2 Deferred income analytics"
        )
      ).toBeInTheDocument();
      expect(screen.getAllByText("2(b)").length).toBeGreaterThan(0);
      const sheetContainer = screen
        .getAllByRole("table")[0]
        .closest('[data-smart-form-node-kind="sheet"]');
      expect(sheetContainer).toHaveClass(
        "md:ms-9",
        "w-full",
        "md:w-[calc(100%-2.25rem)]"
      );
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
    });

    it("resolves definition and localized answers in English", () => {
      render(
        <SmartFormV2Readonly
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          response={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="en-US"
          copy={copy}
        />
      );

      expect(
        screen.getByRole("heading", {
          name: "Audit Programme — Deferred Income",
          level: 1,
        })
      ).toBeInTheDocument();
      expect(
        screen.getAllByText(
          "Compare the current figures with those of prior periods;"
        ).length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText(
          "The balance increased by 8.4%; the movement is consistent with new contracts."
        ).length
      ).toBeGreaterThan(0);
    });

    it("styles procedure rows by hierarchy depth instead of child ownership", () => {
      render(
        <SmartFormV2Readonly
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          response={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
        />
      );

      const [leafAtDepthZero] = screen.getAllByText(
        "取得并检查（或编制）本年度数据主表，并与总账核对。"
      );
      const [parentAtDepthZero] = screen.getAllByText("执行分析程序，例如：");
      const [childAtDepthOne] = screen.getAllByText(
        "将本期数据与以前期间数据进行比较；"
      );

      expect(parentAtDepthZero.parentElement?.parentElement?.className).toBe(
        leafAtDepthZero.parentElement?.parentElement?.className
      );
      const groupRow = parentAtDepthZero.closest("tr");
      expect(groupRow?.className).not.toBe(
        leafAtDepthZero.closest("tr")?.className
      );
      expect(groupRow?.querySelectorAll("td")).toHaveLength(1);
      expect(childAtDepthOne.parentElement?.parentElement?.className).not.toBe(
        parentAtDepthZero.parentElement?.parentElement?.className
      );
    });

    it("collapses and expands nested procedure rows", async () => {
      const user = userEvent.setup();
      render(
        <SmartFormV2Readonly
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          response={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
        />
      );

      expect(screen.getAllByText("2(a)").length).toBeGreaterThan(0);
      await user.click(
        screen.getAllByRole("button", { name: "Collapse sub-procedures" })[0]
      );
      expect(screen.queryByText("2(a)")).not.toBeInTheDocument();

      await user.click(
        screen.getAllByRole("button", { name: "Expand sub-procedures" })[0]
      );
      expect(screen.getAllByText("2(a)").length).toBeGreaterThan(0);
    });

    it("collapses and expands complete sections", async () => {
      const user = userEvent.setup();
      render(
        <SmartFormV2Readonly
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          response={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
        />
      );

      const [firstSectionToggle] = screen.getAllByRole("button", {
        name: "Collapse section",
      });
      await user.click(firstSectionToggle);
      expect(
        screen.queryByText("取得并检查（或编制）本年度数据主表，并与总账核对。")
      ).not.toBeInTheDocument();

      await user.click(
        screen.getAllByRole("button", { name: "Expand section" })[0]
      );
      expect(
        screen.getAllByText(
          "取得并检查（或编制）本年度数据主表，并与总账核对。"
        ).length
      ).toBeGreaterThan(0);
    });

    it("expands and collapses the read-only document from the toolbar", async () => {
      const user = userEvent.setup();
      render(
        <SmartFormV2Readonly
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          response={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
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
    });

    it("exposes review-question anchors for fields and every table row", async () => {
      const user = userEvent.setup();
      const onOpen = vi.fn();
      render(
        <SmartFormV2Readonly
          definition={DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE}
          response={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
          reviewQuestions={{
            buttonLabel: "Add review question",
            getQuestionCount: (target) =>
              target.label.includes("取得并检查") ? 1 : 0,
            onOpen,
          }}
        />
      );

      const [rowButton] = screen.getAllByRole("button", {
        name: /Add review question: 取得并检查/,
      });
      expect(rowButton).toHaveTextContent("1");
      expect(rowButton).not.toHaveTextContent("Q");
      await user.click(rowButton);
      expect(onOpen).toHaveBeenCalledWith(
        expect.objectContaining({ rowId: expect.any(String) })
      );

      await user.click(
        screen.getAllByRole("button", {
          name: /Add review question: 最终结论/,
        })[0]
      );
      expect(onOpen).toHaveBeenLastCalledWith(
        expect.objectContaining({ label: "最终结论" })
      );
    }, 30_000);

    it("hides conditional nodes and fixed sheet cells", () => {
      const definition = structuredClone(
        DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE
      );
      const hiddenSection = definition.children.find(
        (node) => node.id === "deferred-income-presentation"
      );
      if (!hiddenSection) {
        throw new Error("Missing presentation section");
      }
      hiddenSection.visibleWhen = { op: "literal", value: false };
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
        <SmartFormV2Readonly
          definition={definition}
          response={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
          locale="zh-CN"
          copy={copy}
        />
      );

      expect(screen.queryByText("列报与披露")).not.toBeInTheDocument();
      expect(
        screen.queryByText("主表已与总账核对，无差异。")
      ).not.toBeInTheDocument();
      expect(
        screen.getAllByText(
          "取得并检查（或编制）本年度数据主表，并与总账核对。"
        ).length
      ).toBeGreaterThan(0);
    });

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
        <SmartFormV2Readonly
          definition={definition}
          response={DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE}
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

  function _findField(
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
