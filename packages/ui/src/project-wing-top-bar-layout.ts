export type TopBarExpansionLayout = {
  expanded: boolean;
  yieldWidth: number;
};

export type TopBarExpansionCapacity = {
  allowed: boolean;
  yieldWidth: number;
};

export type TopBarIdentityCapacity = TopBarExpansionCapacity & {
  collapsed: boolean;
};

export type TopBarSideMode = "expanded" | "collapsed";
export type TopBarLayoutIntent = "resting" | "search" | "leading" | "actions";

const RESPONSIVE_TOP_BAR_MIN_WIDTH = 768;
export const PROJECT_WING_TOP_BAR_MIN_SEARCH_WIDTH = 192;

export type ResponsiveTopBarLayout = {
  leadingMode: TopBarSideMode;
  actionsMode: TopBarSideMode;
  centerWidth: number;
  overlaySide?: "leading" | "actions";
  leadingTrackWidth?: number;
};

export type ResponsiveTopBarTrackWidths = {
  leadingWidth: number;
  actionsWidth: number;
};

type ResponsiveTopBarLayoutInput = {
  availableWidth: number;
  regionGap?: number;
  leadingExpandedWidth: number;
  leadingCollapsedWidth: number;
  actionsExpandedWidth: number;
  actionsCollapsedWidth: number;
  expandedCenterWidth: number;
  minimumCenterWidth: number;
  intent: TopBarLayoutIntent;
  independentHover?: boolean;
};

const RESTING_SIDE_COMBINATIONS: (readonly [TopBarSideMode, TopBarSideMode])[] =
  [
    ["expanded", "expanded"],
    ["collapsed", "expanded"],
    ["expanded", "collapsed"],
    ["collapsed", "collapsed"],
  ];

function getSideWidth(
  mode: TopBarSideMode,
  expandedWidth: number,
  collapsedWidth: number
) {
  return mode === "expanded" ? expandedWidth : collapsedWidth;
}

function getCenteredRemainingWidth(
  availableWidth: number,
  leadingWidth: number,
  actionsWidth: number
) {
  return Math.max(0, availableWidth - Math.max(leadingWidth, actionsWidth) * 2);
}

function getCombinationRemainingWidth(
  input: Omit<ResponsiveTopBarLayoutInput, "intent">,
  [leadingMode, actionsMode]: readonly [TopBarSideMode, TopBarSideMode]
) {
  return getCenteredRemainingWidth(
    input.availableWidth,
    getSideWidth(
      leadingMode,
      input.leadingExpandedWidth,
      input.leadingCollapsedWidth
    ),
    getSideWidth(
      actionsMode,
      input.actionsExpandedWidth,
      input.actionsCollapsedWidth
    )
  );
}

function resolveCenteredLayoutFromCombinations(
  input: Omit<ResponsiveTopBarLayoutInput, "intent">,
  requirePreferredWidth: boolean,
  combinations: (readonly [TopBarSideMode, TopBarSideMode])[]
): ResponsiveTopBarLayout | null {
  for (const [leadingMode, actionsMode] of combinations) {
    const leadingWidth = getSideWidth(
      leadingMode,
      input.leadingExpandedWidth,
      input.leadingCollapsedWidth
    );
    const actionsWidth = getSideWidth(
      actionsMode,
      input.actionsExpandedWidth,
      input.actionsCollapsedWidth
    );
    const remainingWidth = getCenteredRemainingWidth(
      input.availableWidth,
      leadingWidth,
      actionsWidth
    );
    const centerWidth = Math.min(input.expandedCenterWidth, remainingWidth);
    const fits = requirePreferredWidth
      ? centerWidth === input.expandedCenterWidth
      : centerWidth >= input.minimumCenterWidth;
    if (fits) {
      return { leadingMode, actionsMode, centerWidth };
    }
  }
  return null;
}

function resolveCenteredLayout(
  input: Omit<ResponsiveTopBarLayoutInput, "intent">,
  requirePreferredWidth: boolean,
  combinations = RESTING_SIDE_COMBINATIONS
): ResponsiveTopBarLayout {
  const layout = resolveCenteredLayoutFromCombinations(
    input,
    requirePreferredWidth,
    combinations
  );
  if (layout) {
    return layout;
  }
  const centeredRemainingWidth = getCenteredRemainingWidth(
    input.availableWidth,
    input.leadingCollapsedWidth,
    input.actionsCollapsedWidth
  );
  return {
    leadingMode: "collapsed",
    actionsMode: "collapsed",
    centerWidth: Math.min(
      input.expandedCenterWidth,
      input.availableWidth,
      Math.max(input.minimumCenterWidth, centeredRemainingWidth)
    ),
  };
}

function resolveActiveSideLayout(
  input: Omit<ResponsiveTopBarLayoutInput, "intent">,
  restingLayout: ResponsiveTopBarLayout,
  intent: Exclude<TopBarLayoutIntent, "resting" | "search">
): ResponsiveTopBarLayout {
  const targetExpandedWidth =
    intent === "leading"
      ? input.leadingExpandedWidth
      : input.actionsExpandedWidth;
  if (targetExpandedWidth > input.availableWidth) {
    return restingLayout;
  }
  const preferredCombination: readonly [TopBarSideMode, TopBarSideMode] =
    intent === "leading"
      ? ["expanded", restingLayout.actionsMode]
      : [restingLayout.leadingMode, "expanded"];
  const preferredLayout = resolveCenteredLayoutFromCombinations(input, false, [
    preferredCombination,
  ]);
  if (preferredLayout) {
    return preferredLayout;
  }
  const fallbackCombination: readonly [TopBarSideMode, TopBarSideMode] =
    intent === "leading"
      ? ["expanded", restingLayout.actionsMode]
      : ["collapsed", "expanded"];
  const remainingWidth = getCombinationRemainingWidth(
    input,
    fallbackCombination
  );
  const fallbackLayout = {
    leadingMode: fallbackCombination[0],
    actionsMode: fallbackCombination[1],
    centerWidth: Math.min(
      input.expandedCenterWidth,
      input.availableWidth,
      Math.max(input.minimumCenterWidth, remainingWidth)
    ),
  };
  const trackWidth = Math.max(
    0,
    (input.availableWidth - fallbackLayout.centerWidth) / 2
  );
  const safeWidth = trackWidth + (input.regionGap ?? 0);
  const requiredSafeWidth =
    intent === "leading"
      ? input.leadingExpandedWidth
      : input.actionsExpandedWidth;
  return requiredSafeWidth <= safeWidth
    ? fallbackLayout
    : { ...fallbackLayout, overlaySide: intent };
}

export function calculateResponsiveTopBarLayout(
  input: ResponsiveTopBarLayoutInput
): ResponsiveTopBarLayout {
  if (input.independentHover) {
    const passiveCombinations: (readonly [TopBarSideMode, TopBarSideMode])[] = [
      ["collapsed", "expanded"],
      ["collapsed", "collapsed"],
    ];
    if (input.intent === "search") {
      return resolveCenteredLayout(input, false, passiveCombinations);
    }
    const passiveInput = {
      ...input,
      expandedCenterWidth: input.minimumCenterWidth,
    };
    const restingLayout = resolveCenteredLayout(
      passiveInput,
      false,
      passiveCombinations
    );
    if (input.intent === "leading") {
      const remainingWidth =
        input.availableWidth -
        input.leadingExpandedWidth -
        input.actionsExpandedWidth;
      return remainingWidth >= input.minimumCenterWidth
        ? {
            leadingMode: "expanded",
            actionsMode: "expanded",
            centerWidth: input.minimumCenterWidth,
            leadingTrackWidth: Math.max(
              input.leadingExpandedWidth,
              (input.availableWidth - input.minimumCenterWidth) / 2
            ),
          }
        : restingLayout;
    }
    return input.intent === "resting"
      ? restingLayout
      : resolveActiveSideLayout(passiveInput, restingLayout, input.intent);
  }
  if (input.intent === "search") {
    return resolveCenteredLayout(input, true);
  }
  const restingLayout = resolveCenteredLayout(input, false);
  if (input.intent === "resting") {
    return restingLayout;
  }
  return resolveActiveSideLayout(input, restingLayout, input.intent);
}

export function calculateResponsiveTopBarTrackWidths({
  layout,
  availableWidth,
}: {
  layout: ResponsiveTopBarLayout;
  availableWidth: number;
}): ResponsiveTopBarTrackWidths {
  const width = Math.max(0, (availableWidth - layout.centerWidth) / 2);
  if (layout.leadingTrackWidth !== undefined) {
    return {
      leadingWidth: layout.leadingTrackWidth,
      actionsWidth: Math.max(
        0,
        availableWidth - layout.centerWidth - layout.leadingTrackWidth
      ),
    };
  }
  return { leadingWidth: width, actionsWidth: width };
}

export function shouldCoordinateResponsiveTopBar({
  centerAbsent,
  centerPriority,
  hasSearch,
  headerWidth,
}: {
  centerAbsent: boolean;
  centerPriority: boolean;
  hasSearch: boolean;
  headerWidth: number;
}) {
  if (headerWidth < RESPONSIVE_TOP_BAR_MIN_WIDTH) {
    return false;
  }
  return centerAbsent || (centerPriority && hasSearch);
}

export function shouldKeepTopBarActionsExpanded({
  hasSearch,
  yieldWidth,
}: {
  hasSearch: boolean;
  yieldWidth: number;
}) {
  return !hasSearch || yieldWidth === 0;
}

export function calculateTopBarExpansionCapacity({
  availableWidth,
  centerWidth,
  requiredWidth,
}: {
  availableWidth: number;
  centerWidth: number;
  requiredWidth: number;
}): TopBarExpansionCapacity {
  const yieldWidth = Math.max(0, Math.ceil(requiredWidth - availableWidth));
  return {
    allowed: yieldWidth <= Math.max(0, centerWidth),
    yieldWidth,
  };
}

export function calculateTopBarCollapsedSideWidth({
  leadingWidth,
  leadingYield,
}: {
  leadingWidth: number;
  leadingYield: number;
}) {
  return Math.max(0, leadingWidth - leadingYield);
}

export function calculateTopBarIdentityCapacity({
  availableWidth,
  centerWidth,
  requiredWidth,
}: {
  availableWidth: number;
  centerWidth: number;
  requiredWidth: number;
}): TopBarIdentityCapacity {
  const capacity = calculateTopBarExpansionCapacity({
    availableWidth,
    centerWidth,
    requiredWidth,
  });
  return {
    ...capacity,
    collapsed: capacity.yieldWidth > 0,
  };
}

export function setTopBarYield(
  source: HTMLElement | null,
  property:
    | "--project-wing-top-bar-leading-yield"
    | "--project-wing-top-bar-action-yield",
  layout: TopBarExpansionLayout
) {
  const header = source?.closest<HTMLElement>(
    '[data-slot="project-wing-top-bar"]'
  );
  header?.style.setProperty(
    property,
    `${layout.expanded ? layout.yieldWidth : 0}px`
  );
  if (header && property === "--project-wing-top-bar-action-yield") {
    header.dataset.actionExpanded = String(layout.expanded);
  }
}

function measureTopBarIdentitySegments(
  root: HTMLElement,
  segments: HTMLElement[]
) {
  const breadcrumb = root.querySelector<HTMLElement>(
    '[data-slot="breadcrumb"]'
  );
  if (!breadcrumb) {
    return 0;
  }
  const breadcrumbStyle = getComputedStyle(breadcrumb);
  const borderWidth =
    Number.parseFloat(breadcrumbStyle.borderLeftWidth) +
    Number.parseFloat(breadcrumbStyle.borderRightWidth);
  return segments.reduce((total, segment) => {
    const surface = segment.querySelector<HTMLElement>(
      'button, [data-slot="breadcrumb-page"]'
    );
    const label = surface?.querySelector<HTMLElement>("[data-identity-label]");
    if (!surface || !label) {
      return total;
    }
    const style = getComputedStyle(surface);
    const otherWidth = [...surface.children]
      .filter((child) => child !== label)
      .reduce((width, child) => width + child.getBoundingClientRect().width, 0);
    const gap = Number.parseFloat(style.columnGap) || 0;
    return (
      total +
      label.scrollWidth +
      otherWidth +
      gap * Math.max(0, surface.children.length - 1) +
      Number.parseFloat(style.paddingLeft) +
      Number.parseFloat(style.paddingRight) +
      Number.parseFloat(style.borderLeftWidth) +
      Number.parseFloat(style.borderRightWidth)
    );
  }, borderWidth);
}

export function measureTopBarIdentityWidth(root: HTMLElement) {
  return measureTopBarIdentitySegments(root, [
    ...root.querySelectorAll<HTMLElement>("[data-identity-segment]"),
  ]);
}

export function measureTopBarCollapsedIdentityWidth(root: HTMLElement) {
  return measureTopBarIdentitySegments(
    root,
    [...root.querySelectorAll<HTMLElement>("[data-identity-segment]")].filter(
      (segment) => !Object.hasOwn(segment.dataset, "identityCollapsible")
    )
  );
}

export function getTopBarIdentityAvailableWidth(root: HTMLElement) {
  const context = root.closest<HTMLElement>(".project-wing-top-bar-context");
  if (!context) {
    return 0;
  }
  const siblings = [...context.children].filter((child) => child !== root);
  const siblingWidth = siblings.reduce(
    (total, child) => total + child.getBoundingClientRect().width,
    0
  );
  const gap = Number.parseFloat(getComputedStyle(context).columnGap) || 0;
  return Math.max(
    0,
    context.clientWidth -
      siblingWidth -
      gap * Math.max(0, context.children.length - 1)
  );
}
