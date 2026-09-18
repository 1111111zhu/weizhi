import { describe, expect, it } from "vitest";

import { RESIZE_RAIL_CLASS } from "./resize-handle";

describe("shared resize handle styles", () => {
  it("keeps the rail transparent while preserving grip feedback", () => {
    expect(RESIZE_RAIL_CLASS).not.toMatch(/hover:bg-|dragging\]:bg-/);
  });
});
