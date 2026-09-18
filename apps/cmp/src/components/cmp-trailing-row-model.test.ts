import { createRowModelWithTrailingRows } from "@project-wing/ui";
import type { RowModel } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";

describe(createRowModelWithTrailingRows, () => {
  it("keeps the reordered row model referentially stable", () => {
    const rows = [
      { id: "draft", original: { kind: "draft" } },
      { id: "record", original: { kind: "record" } },
    ];
    const source = {
      flatRows: rows,
      rows,
      rowsById: Object.fromEntries(rows.map((row) => [row.id, row])),
    } as unknown as RowModel<{ kind: string }>;
    const getSource = vi.fn(() => source);
    const getRows = createRowModelWithTrailingRows(
      getSource,
      (row: { kind: string }) => row.kind === "draft"
    );

    const first = getRows();
    const second = getRows();

    expect(first.rows.map((row: { id: string }) => row.id)).toStrictEqual([
      "record",
      "draft",
    ]);
    expect(second).toBe(first);
    expect(second.rows).toBe(first.rows);
    expect(getSource).toHaveBeenCalledTimes(2);
  });
});
