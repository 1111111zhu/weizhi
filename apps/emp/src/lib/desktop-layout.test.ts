import { describe, expect, it } from "vitest";

import {
  clampDesktopPosition,
  findNextAvailableDesktopPosition,
  getDefaultIconPosition,
  matchesDesktopSearch,
  snapDesktopPosition,
} from "./desktop-layout";

describe("desktop layout utilities", () => {
  it("returns deterministic grid positions for unplaced icons", () => {
    expect(getDefaultIconPosition(0)).toStrictEqual({ x: 24, y: 24 });
    expect(getDefaultIconPosition(5)).toStrictEqual({ x: 684, y: 24 });
    expect(getDefaultIconPosition(6)).toStrictEqual({ x: 24, y: 172 });
  });

  it("clamps icon positions inside the desktop canvas", () => {
    expect(
      clampDesktopPosition(
        { x: -20, y: 500 },
        { width: 420, height: 320, iconWidth: 108, iconHeight: 120 }
      )
    ).toStrictEqual({ x: 0, y: 200 });
  });

  it("snaps arbitrary icon positions to the hidden desktop grid", () => {
    expect(
      snapDesktopPosition(
        { x: 124, y: 74 },
        { width: 420, height: 320, iconWidth: 116, iconHeight: 116 }
      )
    ).toStrictEqual({ x: 156, y: 24 });
  });

  it("keeps snapped positions inside the visible desktop canvas", () => {
    expect(
      snapDesktopPosition(
        { x: 5000, y: 5000 },
        { width: 420, height: 320, iconWidth: 116, iconHeight: 116 }
      )
    ).toStrictEqual({ x: 288, y: 172 });
  });

  it("moves a snapped icon to the next available grid cell when occupied", () => {
    expect(
      findNextAvailableDesktopPosition({
        desired: { x: 156, y: 24 },
        occupied: [
          { x: 24, y: 24 },
          { x: 156, y: 24 },
        ],
        bounds: { width: 720, height: 480, iconWidth: 132, iconHeight: 132 },
      })
    ).toStrictEqual({ x: 288, y: 24 });
  });

  it("treats old close row spacing as overlapping", () => {
    expect(
      findNextAvailableDesktopPosition({
        desired: { x: 24, y: 152 },
        occupied: [{ x: 24, y: 24 }],
        bounds: { width: 720, height: 480, iconWidth: 132, iconHeight: 132 },
      })
    ).toStrictEqual({ x: 24, y: 172 });
  });

  it("matches search against visible fields", () => {
    expect(
      matchesDesktopSearch(
        { visibleFields: ["AUD-2026-0004", "ABC Group"] },
        "0004"
      )
    ).toBeTruthy();
  });

  it("does not match hidden paths or metadata", () => {
    expect(
      matchesDesktopSearch(
        {
          visibleFields: ["Orchid Holdings"],
          hiddenFields: ["Planning / A01 / phase_4", "workspace-4"],
        },
        "4"
      )
    ).toBeFalsy();
  });
});
