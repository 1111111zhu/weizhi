// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { Button } from "../button";
import { DataGridColumnHeader } from "./data-grid-column-header";
import { ProjectWingMasterDataGrid } from "./master-data-grid";
import type { ProjectWingMasterDataGridProps } from "./master-data-grid";

type Record = { id: string; name: string };
const records: Record[] = [
  { id: "one", name: "Zoe" },
  { id: "two", name: "Amy" },
];
const columns: ProjectWingMasterDataGridProps<Record>["columns"] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Name" />
    ),
    meta: { headerTitle: "Name" },
    size: 180,
  },
  { accessorKey: "id", header: "System ID", size: 140 },
];

describe("shared grid recovery controls", () => {
  const animationsDescriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "getAnimations"
  );
  beforeAll(() =>
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    })
  );

  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    if (animationsDescriptor) {
      Object.defineProperty(
        Element.prototype,
        "getAnimations",
        animationsDescriptor
      );
    } else {
      Reflect.deleteProperty(Element.prototype, "getAnimations");
    }
  });
  const EMPTY_GRID_PROPS: Partial<ProjectWingMasterDataGridProps<Record>> = {};
  async function render(
    extra: Partial<ProjectWingMasterDataGridProps<Record>> = EMPTY_GRID_PROPS
  ) {
    await act(() =>
      root.render(
        <ProjectWingMasterDataGrid
          columns={columns}
          data={records}
          title="Records"
          tableLabel="Records"
          testId="records"
          getRowId={(row) => row.id}
          initialVisibility={{ id: false }}
          columnVisibilityLabel="Columns"
          emptyMessage="Empty"
          {...extra}
        />
      )
    );
  }
  function button(name: string) {
    const found = [
      ...document.querySelectorAll<HTMLElement>(
        'button, [role="menuitem"], [role="menuitemcheckbox"]'
      ),
    ].find((e) => {
      const labelledBy = e
        .getAttribute("aria-labelledby")
        ?.split(/\s+/)
        .map((id) => document.querySelector(`#${id}`)?.textContent ?? "")
        .join(" ")
        .trim();
      return (
        labelledBy === name ||
        e.getAttribute("aria-label") === name ||
        e.textContent?.trim() === name
      );
    });
    if (!found) {
      throw new Error(`Missing control: ${name}`);
    }
    return found;
  }
  async function click(element: HTMLElement) {
    await act(() => element.click());
  }

  it("keeps mobile toolbar actions reachable in a dismissible bottom sheet", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const exportRecords = vi.fn();
    await render({
      actions: <Button onClick={exportRecords}>Export records</Button>,
    });
    await click(button("More actions"));
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await click(button("Export records"));
    expect(exportRecords).toHaveBeenCalledOnce();
    await click(button("Close actions"));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("clears selection explicitly without changing rows or calling row actions", async () => {
    const onRow = vi.fn();
    const onSelection = vi.fn();
    await render({ onRowSelectionChange: onSelection, onRowClick: onRow });
    const rowCheckbox = container.querySelector<HTMLElement>(
      'tbody [role="checkbox"]'
    );
    if (!rowCheckbox) {
      throw new Error("Expected a row checkbox");
    }
    await click(rowCheckbox);
    expect(button("Clear selection")).toBeTruthy();
    expect(onSelection).toHaveBeenLastCalledWith({ one: true });
    await click(button("Clear selection"));
    expect(onSelection).toHaveBeenLastCalledWith({});
    expect(onRow).not.toHaveBeenCalled();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("restores visibility and width defaults while retaining sorting and selection", async () => {
    await render();
    await click(button("Name"));
    expect(container.querySelector("tbody tr")?.textContent).toContain("Amy");
    const rowCheckbox = container.querySelector<HTMLElement>(
      'tbody [role="checkbox"]'
    );
    if (!rowCheckbox) {
      throw new Error("Expected a row checkbox");
    }
    await click(rowCheckbox);
    const handle = container.querySelector<HTMLElement>(
      '[role="separator"][aria-label="Resize Name column"]'
    );
    if (!handle) {
      throw new Error("Expected a resize handle");
    }
    const originalWidth = handle.getAttribute("aria-valuenow");
    await act(() => {
      handle.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
    });
    expect(handle.getAttribute("aria-valuenow")).not.toBe(originalWidth);
    await click(button("Columns"));
    await click(button("System ID"));
    expect(
      [...container.querySelectorAll("th")].some(
        (e) => e.textContent === "System ID"
      )
    ).toBeTruthy();
    await click(button("Restore default columns"));
    expect(
      [...container.querySelectorAll("th")].some(
        (e) => e.textContent === "System ID"
      )
    ).toBeFalsy();
    expect(handle.getAttribute("aria-valuenow")).toBe(originalWidth);
    expect(container.querySelector("tbody tr")?.textContent).toContain("Amy");
    expect(
      container
        .querySelector('tbody [role="checkbox"]')
        ?.getAttribute("aria-checked")
    ).toBe("true");
  });

  it("uses explicit Chinese control copy when the owning page provides its locale", async () => {
    await render({
      locale: "zh-CN",
      paginationPageSize: 1,
      paginationPageSizeOptions: [1, 2],
      columnVisibilityLabel: "显示列",
    });
    expect(button("下一页")).toBeTruthy();
    expect(
      container.querySelector('[aria-label="选择本页全部"]')
    ).not.toBeNull();
    const rowCheckbox = container.querySelector<HTMLElement>(
      'tbody [role="checkbox"]'
    );
    if (!rowCheckbox) {
      throw new Error("Expected a row checkbox");
    }
    await click(rowCheckbox);
    expect(button("取消选择")).toBeTruthy();
    await click(button("显示列"));
    expect(button("恢复默认列")).toBeTruthy();
  });
});
