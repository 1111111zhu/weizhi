import { describe, expect, it } from "vitest";

import {
  buildProjectGridSlots,
  getProjectGridDimensions,
  getProjectGridPlacementUpdates,
  moveProjectGridSlot,
} from "./project-icon-grid";

type Placement = {
  desktopX: number;
  desktopY: number;
  projectId: string;
  sortOrder: number;
};

const orchid: Placement = {
  desktopX: 24,
  desktopY: 24,
  projectId: "orchid",
  sortOrder: 0,
};
const harbor: Placement = {
  desktopX: 180,
  desktopY: 24,
  projectId: "harbor",
  sortOrder: 1,
};

describe("project icon spatial grid", () => {
  it("fills the complete visible canvas with equal-sized grid slots", () => {
    expect(getProjectGridDimensions(1218, 771, [orchid])).toStrictEqual({
      columns: 7,
      rows: 5,
    });
  });

  it("keeps empty cells addressable when there is only one project", () => {
    const slots = buildProjectGridSlots([orchid], {}, 7, 5);

    expect(slots).toHaveLength(35);
    expect(slots[0]?.placement?.projectId).toBe("orchid");
    expect(slots[20]?.placement).toBeNull();
  });

  it("moves a project into any empty cell without collapsing the grid", () => {
    const slots = buildProjectGridSlots([orchid], {}, 7, 5);
    const next = moveProjectGridSlot(slots, 0, 20);

    expect(next[0]?.placement).toBeNull();
    expect(next[20]?.placement?.projectId).toBe("orchid");
    expect(next).toHaveLength(35);
  });

  it("swaps projects when the destination cell is occupied", () => {
    const slots = buildProjectGridSlots([orchid, harbor], {}, 7, 5);
    const next = moveProjectGridSlot(slots, 0, 1);

    expect(next[0]?.placement?.projectId).toBe("harbor");
    expect(next[1]?.placement?.projectId).toBe("orchid");
  });

  it("converts the selected cell back to persistent desktop coordinates", () => {
    const slots = moveProjectGridSlot(
      buildProjectGridSlots([orchid], {}, 7, 5),
      0,
      20
    );

    expect(getProjectGridPlacementUpdates(slots, 7)).toStrictEqual([
      {
        placement: orchid,
        position: { x: 960, y: 336 },
        sortOrder: 20,
      },
    ]);
  });
});
