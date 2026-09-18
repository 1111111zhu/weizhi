import {
  SmartFormV2ResponseSchema,
  SmartFormV2SheetNodeSchema,
} from "@project-wing/shared";
// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MOBILE_STRUCTURE_DEFINITION,
  MOBILE_STRUCTURE_SHEET,
} from "./smart-form-v2-mobile-sheet.fixture";
import { SmartFormV2Readonly } from "./smart-form-v2-readonly";
import type { SmartFormV2ReadonlyCopy } from "./smart-form-v2-readonly";

const copy: SmartFormV2ReadonlyCopy = {
  readOnly: "Read only",
  schemaVersion: "Schema",
  emptyValue: "Not provided",
  unresolvedComponent: "Uncompiled",
  attachment: "Attachment",
  reference: "Reference",
  tableLabel: "Data table",
  expand: "Expand rows",
  collapse: "Collapse rows",
  expandSection: "Expand section",
  collapseSection: "Collapse section",
  expansionControls: "Expansion",
  expandAll: "Expand all",
  collapseAll: "Collapse all",
  conditionPending: "Pending",
  conditionMatched: "Matched",
  conditionOtherwise: "Otherwise",
  required: "Required",
  optional: "Optional",
};
const response = SmartFormV2ResponseSchema.parse({
  kind: "smartFormResponse",
  schemaVersion: 2,
  definitionVersionId: MOBILE_STRUCTURE_DEFINITION.id,
  responseLocale: "zh-CN",
  updatedAt: "2026-09-11T00:00:00Z",
  fields: {},
  sheets: {
    "stock-observation": {
      rows: [
        {
          id: "answer-a",
          sourceRowId: "shelf-a",
          order: 0,
          cells: {
            actual: { type: "number", decimal: "42" },
            ledger: { type: "number", decimal: "43" },
            condition: {
              type: "choice",
              selectedOptionIds: ["damage", "slow"],
            },
          },
        },
      ],
    },
  },
});

describe("mobile records use the real readonly pipeline", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows all content without disclosure controls on phones after desktop collapse", async () => {
    let mobile = false;
    const listeners = new Set<() => void>();
    vi.stubGlobal("matchMedia", () => ({
      matches: mobile,
      addEventListener: (_event: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) =>
        listeners.delete(listener),
    }));
    const { container } = render(
      <SmartFormV2Readonly
        definition={MOBILE_STRUCTURE_DEFINITION}
        response={response}
        locale="zh-CN"
        copy={copy}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(
      container.querySelector(
        '[data-smart-form-mobile-records] [data-smart-form-row-id="shelf-a"]'
      )
    ).toBeNull();
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
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: /Expand|Collapse/ })
    ).not.toBeInTheDocument();
    act(() => {
      mobile = false;
      for (const listener of listeners) {
        listener();
      }
    });
    expect(
      container.querySelector(
        '[data-smart-form-mobile-records] [data-smart-form-row-id="shelf-a"]'
      )
    ).toBeNull();
  });

  it("preserves grouped labels, values, overrides, visibility and row review identity", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    expect(
      SmartFormV2SheetNodeSchema.safeParse(MOBILE_STRUCTURE_SHEET).success
    ).toBeTruthy();
    const onOpen = vi.fn();
    const { container } = render(
      <SmartFormV2Readonly
        definition={MOBILE_STRUCTURE_DEFINITION}
        response={response}
        locale="zh-CN"
        copy={copy}
        reviewQuestions={{
          buttonLabel: "Review",
          getQuestionCount: () => 0,
          onOpen,
        }}
      />
    );
    const record = container.querySelector<HTMLElement>(
      '[data-smart-form-mobile-records] [data-smart-form-row-id="shelf-a"]'
    );
    if (!record) {
      throw new Error("Missing mobile record");
    }
    expect(
      record.querySelector('[data-smart-form-column-id="actual"] dt')
    ).toHaveTextContent("实盘");
    expect(
      record.querySelector('[data-smart-form-column-id="ledger"] dt')
    ).toHaveTextContent("账面");
    expect(record).toHaveTextContent("42");
    expect(record).toHaveTextContent("43");
    expect(record).toHaveTextContent("破损");
    expect(record).toHaveTextContent("滞销");
    expect(
      record.querySelector('[data-smart-form-column-id="when"]')
    ).toBeNull();
    expect(
      record.querySelector('[data-smart-form-column-id="narrative"]')
    ).toHaveTextContent("外包装受潮");
    const other = container.querySelector(
      '[data-smart-form-mobile-records] [data-smart-form-row-id="shelf-b"]'
    );
    expect(
      other?.querySelector('[data-smart-form-column-id="ledger"]')
    ).toBeNull();
    expect(
      other?.querySelector('[data-smart-form-required-state="required"]')
    ).toBeNull();
    await userEvent.click(
      within(record).getByRole("button", { name: /Review:/ })
    );
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: "stock-observation", rowId: "shelf-a" })
    );
    // Explicit scroll presentation does not get a second, lossy record renderer.
    expect(
      container.querySelector(
        '[data-smart-form-mobile-records] [data-smart-form-node-id="stock-comparison"]'
      )
    ).toBeNull();
  });

  it("retains desktop group expansion without mounting a hidden mobile editor", async () => {
    const { container } = render(
      <SmartFormV2Readonly
        definition={MOBILE_STRUCTURE_DEFINITION}
        response={response}
        locale="zh-CN"
        copy={copy}
      />
    );
    const group = container.querySelector<HTMLElement>(
      'table [data-smart-form-node-id="stock-observation"][data-smart-form-row-id="area-a"]'
    );
    if (!group) {
      throw new Error("Missing group");
    }
    expect(
      container.querySelector("[data-smart-form-mobile-records]")
    ).toBeNull();
    await userEvent.click(
      within(group).getByRole("button", { name: "Collapse rows" })
    );
    expect(
      container.querySelector(
        'table [data-smart-form-node-id="stock-observation"][data-smart-form-row-id="shelf-a"]'
      )
    ).toBeNull();
    await userEvent.click(
      within(group).getByRole("button", { name: "Expand rows" })
    );
    expect(
      container.querySelector(
        'table [data-smart-form-node-id="stock-observation"][data-smart-form-row-id="shelf-a"]'
      )
    ).not.toBeNull();
  });
});
