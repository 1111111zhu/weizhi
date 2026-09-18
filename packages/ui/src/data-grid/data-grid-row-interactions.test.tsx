// @vitest-environment happy-dom
// oxlint-disable react/incompatible-library -- This test harness intentionally exercises TanStack's hook API.
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { act } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataGrid, DataGridContainer } from "./data-grid";
import {
  DataGridTableBodyRow,
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "./data-grid-table";

const record = { id: "record-1", name: "Evidence" };
const records = [record];
const columns = [{ accessorKey: "name" }];
const DEFAULT_ROW_PROPS: ComponentPropsWithoutRef<"tr"> = {};

function requireValue<T>(value: T | null | undefined): T {
  if (!value) {
    throw new Error("Expected test value");
  }
  return value;
}

function Harness({
  onActivate,
  onAction,
  selectable,
  rowProps = DEFAULT_ROW_PROPS,
}: {
  onActivate?: (row: typeof record) => void;
  onAction?: () => void;
  selectable?: boolean;
  rowProps?: ComponentPropsWithoutRef<"tr">;
}) {
  const table = useReactTable({
    data: records,
    columns,
    enableRowSelection: selectable,
    getCoreRowModel: getCoreRowModel(),
  });
  const row = requireValue(table.getRowModel().rows[0]);
  return (
    <DataGrid table={table} recordCount={1} onRowClick={onActivate}>
      <DataGridContainer>
        <table>
          {selectable === undefined ? null : (
            <thead>
              <tr>
                <th>
                  <DataGridTableRowSelectAll />
                </th>
              </tr>
            </thead>
          )}
          <tbody>
            <DataGridTableBodyRow row={row} {...rowProps}>
              <td>{record.name}</td>
              <td>
                <button type="button" onClick={onAction}>
                  Row action
                </button>
                <input aria-label="Inline edit" />
              </td>
              {selectable === undefined ? null : (
                <td>
                  <DataGridTableRowSelect row={row} />
                </td>
              )}
            </DataGridTableBodyRow>
          </tbody>
        </table>
      </DataGridContainer>
    </DataGrid>
  );
}

describe("DataGrid row activation", () => {
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
  async function render(props: Parameters<typeof Harness>[0]) {
    await act(() => root.render(<Harness {...props} />));
    return requireValue(
      container.querySelector<HTMLTableRowElement>("tbody tr")
    );
  }
  async function key(
    target: Element,
    pressedKey: string,
    extra: KeyboardEventInit = {}
  ) {
    const event = new KeyboardEvent("keydown", {
      key: pressedKey,
      bubbles: true,
      cancelable: true,
      ...extra,
    });
    await act(() => {
      target.dispatchEvent(event);
    });
    return event;
  }

  it.each(["Enter", " "])(
    "activates a focusable row once with %s",
    async (value) => {
      const activate = vi.fn();
      const row = await render({ onActivate: activate });
      expect(row.tabIndex).toBe(0);
      row.focus();
      expect(document.activeElement).toBe(row);
      const event = await key(row, value);
      expect(event.defaultPrevented).toBeTruthy();
      expect(activate).toHaveBeenCalledExactlyOnceWith(record);
    }
  );

  it("keeps content and selected-row surfaces on the shared palette contract", async () => {
    const row = await render({ selectable: true });
    expect(
      container.querySelector('[data-slot="data-grid"]')?.className
    ).toContain("bg-card");
    expect(row.className).toContain("data-[state=selected]:bg-accent");
  });

  it("does not hijack keys or clicks from nested controls", async () => {
    const action = vi.fn();
    const activate = vi.fn();
    const row = await render({ onActivate: activate, onAction: action });
    const button = requireValue(row.querySelector<HTMLButtonElement>("button"));
    const input = requireValue(row.querySelector<HTMLInputElement>("input"));
    await key(input, "Enter");
    await key(button, " ");
    await act(() => button.click());
    expect(action).toHaveBeenCalledOnce();
    expect(activate).not.toHaveBeenCalled();
  });

  it("ignores held keys, composition and modified shortcuts", async () => {
    const activate = vi.fn();
    const row = await render({ onActivate: activate });
    const modifiedEvents = [
      { repeat: true },
      { isComposing: true },
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
      { shiftKey: true },
    ];
    for (const eventOptions of modifiedEvents) {
      await key(row, "Enter", eventOptions);
    }
    await key(row, "ArrowDown");
    expect(activate).not.toHaveBeenCalled();
  });

  it("respects a consumer's cancelled key handler and explicit tab order", async () => {
    const activate = vi.fn();
    const row = await render({
      onActivate: activate,
      rowProps: { tabIndex: -1, onKeyDown: (event) => event.preventDefault() },
    });
    await key(row, "Enter");
    expect(row.tabIndex).toBe(-1);
    expect(activate).not.toHaveBeenCalled();
  });

  it("keeps plain and disabled rows out of automatic keyboard activation", async () => {
    const plain = await render({});
    expect(plain.hasAttribute("tabindex")).toBeFalsy();
    const activate = vi.fn();
    const disabled = await render({
      onActivate: activate,
      rowProps: { "aria-disabled": true },
    });
    await key(disabled, "Enter");
    await act(() => disabled.click());
    expect(disabled.hasAttribute("tabindex")).toBeFalsy();
    expect(activate).not.toHaveBeenCalled();
  });

  it("renders unavailable row selection and select-all as disabled controls", async () => {
    await render({ selectable: false });
    const checkboxes = [
      ...container.querySelectorAll<HTMLElement>('[role="checkbox"]'),
    ];
    expect(checkboxes).toHaveLength(2);
    expect(
      checkboxes.every(
        (control) => control.getAttribute("aria-disabled") === "true"
      )
    ).toBeTruthy();
    await act(() => checkboxes.forEach((control) => control.click()));
    expect(
      checkboxes.every(
        (control) => control.getAttribute("aria-checked") === "false"
      )
    ).toBeTruthy();
  });

  it("keeps selection available when at least one row is selectable", async () => {
    await render({ selectable: true });
    const checkboxes = [
      ...container.querySelectorAll<HTMLElement>('[role="checkbox"]'),
    ];
    expect(checkboxes).toHaveLength(2);
    expect(
      checkboxes.every(
        (control) => control.getAttribute("aria-disabled") !== "true"
      )
    ).toBeTruthy();
  });
});
