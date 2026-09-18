import { describe, expect, it } from "vitest";

import {
  createDataGridAutoSizeController,
  distributeDataGridAutoSize,
} from "./data-grid-auto-size";

describe(distributeDataGridAutoSize, () => {
  it("restores authored column widths on phones instead of squeezing labels to a few pixels", () => {
    let sizing: Record<string, number> = { name: 40, code: 40 };
    const columns = [
      {
        id: "name",
        columnDef: { size: 260, minSize: 20, meta: { autoSize: true } },
        getCanResize: () => true,
        getSize: () => sizing.name,
      },
      {
        id: "code",
        columnDef: { size: 180, minSize: 120, meta: { autoSize: true } },
        getCanResize: () => true,
        getSize: () => sizing.code,
      },
    ];
    const table = {
      getState: () => ({ columnSizing: sizing }),
      getVisibleLeafColumns: () => columns,
      getTotalSize: () =>
        80 + columns.reduce((total, column) => total + column.getSize(), 0),
      setColumnSizing: (
        update: (old: Record<string, number>) => Record<string, number>
      ) => {
        sizing = update(sizing);
      },
    };
    const controller = createDataGridAutoSizeController(table as never, true);
    expect(controller.apply(320)).toBeTruthy();
    expect(sizing.name).toBe(260);
    expect(sizing.code).toBe(180);
    expect(controller.apply(320)).toBeFalsy();
    expect(table.getTotalSize()).toBeGreaterThan(320);
  });

  const entries = [
    { columnId: "client", base: 260, grown: 260 },
    { columnId: "code", base: 150, grown: 150 },
  ];

  it("keeps base widths when the viewport has no free space", () => {
    expect(distributeDataGridAutoSize(entries, 400)).toStrictEqual(entries);
  });

  it("shares free space in proportion to each column base width", () => {
    const result = distributeDataGridAutoSize(entries, 820);

    expect(result[0]?.grown).toBeCloseTo(520);
    expect(result[1]?.grown).toBeCloseTo(300);
  });

  it("preserves a manually widened column and contracts the other flexible columns", () => {
    const result = distributeDataGridAutoSize(
      [
        { columnId: "client", base: 430, grown: 430 },
        { columnId: "code", base: 150, grown: 260 },
        { columnId: "group", base: 140, grown: 240 },
      ],
      820,
      new Set(["client"])
    );

    expect(result[0]?.grown).toBe(430);
    expect(result[1]?.grown).toBeCloseTo(201.724);
    expect(result[2]?.grown).toBeCloseTo(188.276);
  });

  it("stops contracting at designed base widths before allowing overflow", () => {
    const result = distributeDataGridAutoSize(
      [
        { columnId: "client", base: 650, grown: 650 },
        { columnId: "code", base: 150, grown: 260 },
        { columnId: "group", base: 140, grown: 240 },
      ],
      820,
      new Set(["client"])
    );

    expect(result).toStrictEqual([
      { columnId: "client", base: 650, grown: 650 },
      { columnId: "code", base: 150, grown: 150 },
      { columnId: "group", base: 140, grown: 140 },
    ]);
  });

  it("changes only the manually resized column at a stable viewport width", () => {
    let sizing: Record<string, number> = {};
    const defaults = { client: 260, code: 150 };
    const columns = Object.entries(defaults).map(([id, size]) => ({
      id,
      columnDef: { meta: { autoSize: true } },
      getCanResize: () => true,
      getSize: () => sizing[id] ?? size,
    }));
    const table = {
      getState: () => ({ columnSizing: sizing }),
      getVisibleLeafColumns: () => columns,
      getTotalSize: () =>
        200 + columns.reduce((total, column) => total + column.getSize(), 0),
      setColumnSizing: (
        update: (old: Record<string, number>) => Record<string, number>
      ) => {
        sizing = update(sizing);
      },
    };
    const controller = createDataGridAutoSizeController(table as never);

    expect(controller.apply(1000)).toBeTruthy();
    const codeWidthAfterInitialLayout = sizing.code;
    sizing = { ...sizing, client: 550 };
    expect(controller.apply(1000)).toBeFalsy();
    expect(sizing.client).toBe(550);
    expect(sizing.code).toBe(codeWidthAfterInitialLayout);

    expect(controller.apply(1000)).toBeFalsy();
    expect(sizing.client).toBe(550);
    expect(sizing.code).toBe(codeWidthAfterInitialLayout);
  });

  it("does not redistribute auto-sized columns when a fixed column is dragged", () => {
    let sizing: Record<string, number> = {};
    const columns = [
      {
        id: "client",
        columnDef: { meta: { autoSize: true } },
        getCanResize: () => true,
        getSize: () => sizing.client ?? 260,
      },
      {
        id: "lastOpened",
        columnDef: { meta: {} },
        getCanResize: () => true,
        getSize: () => sizing.lastOpened ?? 150,
      },
    ];
    const table = {
      getState: () => ({ columnSizing: sizing }),
      getVisibleLeafColumns: () => columns,
      getTotalSize: () =>
        200 + columns.reduce((total, column) => total + column.getSize(), 0),
      setColumnSizing: (
        update: (old: Record<string, number>) => Record<string, number>
      ) => {
        sizing = update(sizing);
      },
    };
    const controller = createDataGridAutoSizeController(table as never);

    expect(controller.apply(1000)).toBeTruthy();
    const clientWidthAfterInitialLayout = sizing.client;
    sizing = { ...sizing, lastOpened: 200 };

    expect(controller.apply(1000)).toBeFalsy();
    expect(sizing.client).toBe(clientWidthAfterInitialLayout);
    expect(sizing.lastOpened).toBe(200);
  });

  it("does not resize columns when their order changes", () => {
    let sizing: Record<string, number> = {};
    let order = ["client", "code"];
    const defaults = { client: 260, code: 150 };
    const columns = Object.entries(defaults).map(([id, size]) => ({
      id,
      columnDef: { meta: { autoSize: true } },
      getCanResize: () => true,
      getSize: () => sizing[id] ?? size,
    }));
    const table = {
      getState: () => ({ columnSizing: sizing }),
      getVisibleLeafColumns: () =>
        order.map((id) => {
          const column = columns.find((item) => item.id === id);
          if (!column) {
            throw new Error(`Missing column ${id}`);
          }
          return column;
        }),
      getTotalSize: () =>
        200 + columns.reduce((total, column) => total + column.getSize(), 0),
      setColumnSizing: (
        update: (old: Record<string, number>) => Record<string, number>
      ) => {
        sizing = update(sizing);
      },
    };
    const controller = createDataGridAutoSizeController(table as never);

    expect(controller.apply(1000)).toBeTruthy();
    const before = { ...sizing };
    order = ["code", "client"];

    expect(controller.apply(1000)).toBeFalsy();
    expect(sizing).toStrictEqual(before);
  });
});
