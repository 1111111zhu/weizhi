import { describe, expect, it } from "vitest";

import {
  getTrayFlyoutPosition,
  isPointInsideRectangle,
} from "./tray-window-position";

const flyout = { width: 432, height: 572 };
const workArea = { x: 0, y: 0, width: 1920, height: 1040 };

describe(getTrayFlyoutPosition, () => {
  it("places the flyout above a bottom taskbar icon", () => {
    expect(
      getTrayFlyoutPosition(
        { x: 1800, y: 1040, width: 32, height: 40 },
        workArea,
        flyout
      )
    ).toStrictEqual({ x: 1480, y: 460 });
  });

  it("places the flyout below a top taskbar icon", () => {
    expect(
      getTrayFlyoutPosition(
        { x: 900, y: -48, width: 32, height: 48 },
        workArea,
        flyout
      )
    ).toStrictEqual({ x: 700, y: 8 });
  });

  it("places the flyout beside a right taskbar icon", () => {
    expect(
      getTrayFlyoutPosition(
        { x: 1920, y: 700, width: 48, height: 32 },
        workArea,
        flyout
      )
    ).toStrictEqual({ x: 1480, y: 430 });
  });

  it("keeps a flyout inside an offset display work area", () => {
    expect(
      getTrayFlyoutPosition(
        { x: -1200, y: 860, width: 32, height: 40 },
        { x: -1280, y: -120, width: 1280, height: 980 },
        flyout
      )
    ).toStrictEqual({ x: -1272, y: 280 });
  });
});

describe(isPointInsideRectangle, () => {
  const trayBounds = { x: 1800, y: 1040, width: 32, height: 40 };

  it("recognizes a pointer over the tray icon", () => {
    expect(
      isPointInsideRectangle({ x: 1816, y: 1060 }, trayBounds)
    ).toBeTruthy();
  });

  it("rejects points outside or on the exclusive far edge", () => {
    expect(
      isPointInsideRectangle({ x: 1799, y: 1060 }, trayBounds)
    ).toBeFalsy();
    expect(
      isPointInsideRectangle({ x: 1832, y: 1060 }, trayBounds)
    ).toBeFalsy();
  });
});
