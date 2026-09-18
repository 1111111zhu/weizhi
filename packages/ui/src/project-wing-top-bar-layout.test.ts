import { describe, expect, it } from "vitest";

import {
  PROJECT_WING_TOP_BAR_MIN_SEARCH_WIDTH,
  calculateResponsiveTopBarLayout,
  calculateResponsiveTopBarTrackWidths,
  calculateTopBarExpansionCapacity,
} from "./project-wing-top-bar-layout";

const homeLayout = {
  availableWidth: 1216,
  leadingExpandedWidth: 118,
  leadingCollapsedWidth: 118,
  actionsExpandedWidth: 484,
  actionsCollapsedWidth: 160,
  expandedCenterWidth: 512,
  minimumCenterWidth: 256,
} as const;

describe("independent project header regions", () => {
  const harbour = {
    ...homeLayout,
    independentHover: true,
    availableWidth: 1634,
    leadingExpandedWidth: 812,
    leadingCollapsedWidth: 490,
    actionsExpandedWidth: 392,
    minimumCenterWidth: 192,
  };

  it("opens project details without overlapping the search or hiding action labels", () => {
    const layout = calculateResponsiveTopBarLayout({
      ...harbour,
      intent: "leading",
    });
    const tracks = calculateResponsiveTopBarTrackWidths({
      layout,
      availableWidth: harbour.availableWidth,
    });
    expect(layout.leadingMode).toBe("expanded");
    expect(layout.actionsMode).toBe("expanded");
    expect(tracks.leadingWidth).toBeGreaterThanOrEqual(
      harbour.leadingExpandedWidth
    );
    expect(tracks.actionsWidth).toBeGreaterThanOrEqual(
      harbour.actionsExpandedWidth
    );
    expect(layout.overlaySide).toBeUndefined();
  });

  it("keeps labels when search can expand to a slightly smaller width", () => {
    const layout = calculateResponsiveTopBarLayout({
      ...harbour,
      availableWidth: 1300,
      intent: "search",
    });
    expect(layout.actionsMode).toBe("expanded");
    expect(layout.centerWidth).toBe(320);
  });

  it("does not overlay project details when there is insufficient space", () => {
    const layout = calculateResponsiveTopBarLayout({
      ...harbour,
      availableWidth: 1200,
      intent: "leading",
    });
    expect(layout.leadingMode).toBe("collapsed");
    expect(layout.overlaySide).toBeUndefined();
  });
});
const projectLayout = {
  availableWidth: 1216,
  leadingExpandedWidth: 564,
  leadingCollapsedWidth: 249,
  actionsExpandedWidth: 613,
  actionsCollapsedWidth: 160,
  expandedCenterWidth: 512,
  minimumCenterWidth: 256,
} as const;

describe(calculateResponsiveTopBarLayout, () => {
  it("collapses actions and lets search rebound after expanded actions hit minimum width", () => {
    expect(
      calculateResponsiveTopBarLayout({ ...homeLayout, intent: "resting" })
    ).toStrictEqual({
      leadingMode: "expanded",
      actionsMode: "collapsed",
      centerWidth: 512,
    });
  });

  it("keeps the search centered when engaged", () => {
    expect(
      calculateResponsiveTopBarLayout({ ...homeLayout, intent: "search" })
    ).toStrictEqual({
      leadingMode: "expanded",
      actionsMode: "collapsed",
      centerWidth: 512,
    });
  });

  it("collapses both project sides when neither fits its half", () => {
    expect(
      calculateResponsiveTopBarLayout({ ...projectLayout, intent: "resting" })
    ).toStrictEqual({
      leadingMode: "collapsed",
      actionsMode: "collapsed",
      centerWidth: 512,
    });
  });

  it("collapses both sides before shrinking an engaged search", () => {
    expect(
      calculateResponsiveTopBarLayout({ ...projectLayout, intent: "search" })
    ).toStrictEqual({
      leadingMode: "collapsed",
      actionsMode: "collapsed",
      centerWidth: 512,
    });
  });

  it("opens engaged actions as an overlay when minimum search cannot yield", () => {
    expect(
      calculateResponsiveTopBarLayout({ ...projectLayout, intent: "actions" })
    ).toStrictEqual({
      leadingMode: "collapsed",
      actionsMode: "expanded",
      centerWidth: 256,
      overlaySide: "actions",
    });
  });

  it("marks oversized active actions as an overlay", () => {
    expect(
      calculateResponsiveTopBarLayout({
        ...homeLayout,
        actionsExpandedWidth: 862,
        intent: "actions",
      })
    ).toStrictEqual({
      leadingMode: "collapsed",
      actionsMode: "expanded",
      centerWidth: 256,
      overlaySide: "actions",
    });
  });

  it("shrinks search safely when a focused action bar has enough room", () => {
    expect(
      calculateResponsiveTopBarLayout({
        ...homeLayout,
        actionsExpandedWidth: 460,
        intent: "actions",
      })
    ).toStrictEqual({
      leadingMode: "expanded",
      actionsMode: "expanded",
      centerWidth: 296,
    });
  });

  it("shrinks the resting search only when expanded sides enter its space", () => {
    expect(
      calculateResponsiveTopBarLayout({
        ...homeLayout,
        leadingExpandedWidth: 400,
        actionsExpandedWidth: 400,
        intent: "resting",
      })
    ).toStrictEqual({
      leadingMode: "expanded",
      actionsMode: "expanded",
      centerWidth: 416,
    });
  });

  it("uses the expanded width initially when both sides leave enough space", () => {
    expect(
      calculateResponsiveTopBarLayout({
        ...homeLayout,
        leadingExpandedWidth: 300,
        actionsExpandedWidth: 300,
        intent: "resting",
      })
    ).toStrictEqual({
      leadingMode: "expanded",
      actionsMode: "expanded",
      centerWidth: 512,
    });
  });

  it("keeps actions expanded when the centered search is exactly minimum width", () => {
    expect(
      calculateResponsiveTopBarLayout({
        ...homeLayout,
        availableWidth: 1224,
        intent: "resting",
      })
    ).toStrictEqual({
      leadingMode: "expanded",
      actionsMode: "expanded",
      centerWidth: 256,
    });
  });

  it("collapses leading information before actions in the reported project layout", () => {
    expect(
      calculateResponsiveTopBarLayout({
        ...projectLayout,
        availableWidth: 1472,
        leadingExpandedWidth: 692,
        actionsExpandedWidth: 488,
        minimumCenterWidth: PROJECT_WING_TOP_BAR_MIN_SEARCH_WIDTH,
        intent: "resting",
      })
    ).toStrictEqual({
      leadingMode: "collapsed",
      actionsMode: "expanded",
      centerWidth: 496,
    });
  });

  it("collapses actions one pixel below the minimum and restores preferred search width", () => {
    expect(
      calculateResponsiveTopBarLayout({
        ...homeLayout,
        availableWidth: 1223,
        intent: "resting",
      })
    ).toStrictEqual({
      leadingMode: "expanded",
      actionsMode: "collapsed",
      centerWidth: 512,
    });
  });

  it("collapses leading information before actions", () => {
    const input = {
      ...homeLayout,
      availableWidth: 1000,
      leadingExpandedWidth: 500,
      leadingCollapsedWidth: 100,
      actionsExpandedWidth: 300,
      actionsCollapsedWidth: 100,
      intent: "resting" as const,
    };

    expect(calculateResponsiveTopBarLayout(input)).toStrictEqual({
      leadingMode: "collapsed",
      actionsMode: "expanded",
      centerWidth: 400,
    });
  });

  it("keeps a minimum centered search and equal tracks in the compact fallback", () => {
    const input = {
      ...homeLayout,
      availableWidth: 831,
      leadingExpandedWidth: 564,
      leadingCollapsedWidth: 377,
      actionsExpandedWidth: 448,
      actionsCollapsedWidth: 160,
      intent: "resting" as const,
    };
    const layout = calculateResponsiveTopBarLayout(input);

    expect(layout).toStrictEqual({
      leadingMode: "collapsed",
      actionsMode: "collapsed",
      centerWidth: 256,
    });
    expect(
      calculateResponsiveTopBarTrackWidths({
        layout,
        availableWidth: input.availableWidth,
      })
    ).toStrictEqual({
      leadingWidth: 287.5,
      actionsWidth: 287.5,
    });
  });

  it("keeps resting actions expanded when leading information opens as an overlay", () => {
    expect(
      calculateResponsiveTopBarLayout({
        ...projectLayout,
        actionsExpandedWidth: 400,
        intent: "leading",
      })
    ).toStrictEqual({
      leadingMode: "expanded",
      actionsMode: "expanded",
      centerWidth: 256,
      overlaySide: "leading",
    });
  });

  it("uses the real region gap for safe temporary leading expansion", () => {
    expect(
      calculateResponsiveTopBarLayout({
        ...projectLayout,
        availableWidth: 1466,
        regionGap: 12,
        leadingExpandedWidth: 608,
        leadingCollapsedWidth: 377,
        actionsExpandedWidth: 613,
        actionsCollapsedWidth: 172,
        intent: "leading",
      })
    ).toStrictEqual({
      leadingMode: "expanded",
      actionsMode: "collapsed",
      centerWidth: 256,
    });
  });

  it("marks active actions as an overlay at a zoomed viewport", () => {
    expect(
      calculateResponsiveTopBarLayout({
        ...projectLayout,
        availableWidth: 1160,
        regionGap: 12,
        leadingExpandedWidth: 608,
        leadingCollapsedWidth: 377,
        actionsExpandedWidth: 613,
        actionsCollapsedWidth: 172,
        intent: "actions",
      })
    ).toStrictEqual({
      leadingMode: "collapsed",
      actionsMode: "expanded",
      centerWidth: 256,
      overlaySide: "actions",
    });
  });
});

describe("responsive top bar coordination", () => {
  it("coordinates desktop top bars without a center region", () => {
    expect(
      calculateResponsiveTopBarLayout({
        ...homeLayout,
        expandedCenterWidth: 0,
        minimumCenterWidth: 0,
        intent: "resting",
      })
    ).toStrictEqual({
      leadingMode: "expanded",
      actionsMode: "expanded",
      centerWidth: 0,
    });
  });
});

describe("interactive expansion capacity", () => {
  it("keeps hover expansion available when it can borrow center width", () => {
    const capacity = calculateTopBarExpansionCapacity({
      availableWidth: 255,
      centerWidth: 512,
      requiredWidth: 512,
    });

    expect(capacity).toStrictEqual({ allowed: true, yieldWidth: 257 });
  });
});
