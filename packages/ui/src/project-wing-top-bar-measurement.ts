import {
  measureTopBarCollapsedIdentityWidth,
  measureTopBarIdentityWidth,
} from "./project-wing-top-bar-layout";

const CENTER_EXPANDED_MAX_WIDTH = 512;
const CENTER_EXPANDED_MIN_WIDTH = 384;
const TOP_BAR_GAP_COUNT = 2;

export type TopBarLayoutMetrics = {
  headerWidth: number;
  availableWidth: number;
  regionGap: number;
  leadingExpandedWidth: number;
  leadingCollapsedWidth: number;
  actionsExpandedWidth: number;
  actionsCollapsedWidth: number;
  expandedCenterWidth: number;
};

function sumWidths(elements: Element[], gap: number) {
  return (
    elements.reduce(
      (total, element) => total + element.getBoundingClientRect().width,
      0
    ) +
    gap * Math.max(0, elements.length - 1)
  );
}

function measureIdentityWidth(
  root: HTMLElement,
  mode: "expanded" | "collapsed"
) {
  if (mode === "expanded") {
    return measureTopBarIdentityWidth(root);
  }
  return measureTopBarCollapsedIdentityWidth(root);
}

function measureLeadingWidth(
  header: HTMLElement,
  mode: "expanded" | "collapsed"
) {
  const leading = header.querySelector<HTMLElement>(
    ".project-wing-top-bar-leading"
  );
  if (!leading) {
    return 0;
  }
  const content =
    leading.querySelector<HTMLElement>(
      '[data-top-bar-side-trigger="leading"]'
    ) ?? leading;
  const identity = content.querySelector<HTMLElement>(
    '[data-slot="constrained-top-bar-identity"]'
  );
  if (!identity) {
    const children = [...content.children];
    const gap = Number.parseFloat(getComputedStyle(content).columnGap) || 0;
    return sumWidths(children, gap);
  }
  const context = identity.closest<HTMLElement>(
    ".project-wing-top-bar-context"
  );
  if (!context) {
    return measureIdentityWidth(identity, mode);
  }
  const siblings = [...context.children].filter(
    (child) => !child.contains(identity)
  );
  const gap = Number.parseFloat(getComputedStyle(context).columnGap) || 0;
  return (
    measureIdentityWidth(identity, mode) +
    sumWidths(siblings, gap) +
    (siblings.length > 0 ? gap : 0)
  );
}

function measureActionBar(
  wrapper: HTMLElement,
  mode: "expanded" | "collapsed"
) {
  return (
    wrapper
      .querySelector<HTMLElement>(
        `[data-top-bar-action-measure="${mode}"] [data-slot="expandable-action-bar"]`
      )
      ?.getBoundingClientRect().width ?? 0
  );
}

function measureActionsWidth(
  header: HTMLElement,
  mode: "expanded" | "collapsed"
) {
  const actions = header.querySelector<HTMLElement>(
    ".project-wing-top-bar-actions"
  );
  const content =
    actions?.querySelector<HTMLElement>(
      '[data-top-bar-side-trigger="actions"]'
    ) ?? actions;
  const wrapper = content?.querySelector<HTMLElement>(
    '[data-slot="constrained-expandable-action-bar"]'
  );
  if (!actions || !content || !wrapper) {
    return content?.scrollWidth ?? 0;
  }
  const cluster = wrapper.closest<HTMLElement>(
    '[data-slot="project-wing-top-bar-action-cluster"]'
  );
  if (!cluster) {
    return actions.scrollWidth;
  }
  const clusterSiblings = [...cluster.children].filter(
    (child) => child !== wrapper
  );
  const clusterGap =
    Number.parseFloat(getComputedStyle(cluster).columnGap) || 0;
  const clusterWidth =
    measureActionBar(wrapper, mode) +
    sumWidths(clusterSiblings, clusterGap) +
    (clusterSiblings.length > 0 ? clusterGap : 0);
  const actionSiblings = [...content.children].filter(
    (child) => child !== cluster
  );
  const actionGap = Number.parseFloat(getComputedStyle(content).columnGap) || 0;
  return (
    clusterWidth +
    sumWidths(actionSiblings, actionGap) +
    (actionSiblings.length > 0 ? actionGap : 0)
  );
}

function clamp(minimum: number, value: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function measureTopBarLayoutMetrics(
  header: HTMLElement
): TopBarLayoutMetrics {
  const style = getComputedStyle(header);
  const horizontalPadding =
    Number.parseFloat(style.paddingLeft) +
    Number.parseFloat(style.paddingRight);
  const gap = Number.parseFloat(style.columnGap) || 0;
  const { width } = header.getBoundingClientRect();
  return {
    headerWidth: width,
    availableWidth: Math.max(
      0,
      width - horizontalPadding - gap * TOP_BAR_GAP_COUNT
    ),
    regionGap: gap,
    leadingExpandedWidth: measureLeadingWidth(header, "expanded"),
    leadingCollapsedWidth: measureLeadingWidth(header, "collapsed"),
    actionsExpandedWidth: measureActionsWidth(header, "expanded"),
    actionsCollapsedWidth: measureActionsWidth(header, "collapsed"),
    expandedCenterWidth: clamp(
      CENTER_EXPANDED_MIN_WIDTH,
      width * 0.42,
      CENTER_EXPANDED_MAX_WIDTH
    ),
  };
}

export function topBarMetricsEqual(
  left: TopBarLayoutMetrics | null,
  right: TopBarLayoutMetrics
) {
  return (
    left !== null &&
    Object.keys(right).every(
      (key) =>
        left[key as keyof TopBarLayoutMetrics] ===
        right[key as keyof TopBarLayoutMetrics]
    )
  );
}
