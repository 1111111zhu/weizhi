"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ExpandableActionBar } from "./expandable-action-bar";
import type {
  ExpandableActionBarClassNames,
  ExpandableActionBarItem,
  ExpandableActionBarSize,
} from "./expandable-action-bar";
import {
  calculateTopBarExpansionCapacity as calculateExpansionCapacityImpl,
  setTopBarYield,
  shouldKeepTopBarActionsExpanded,
} from "./project-wing-top-bar-layout";
import type {
  TopBarExpansionCapacity,
  TopBarExpansionLayout,
} from "./project-wing-top-bar-layout";
import { useProjectWingTopBarLayout } from "./project-wing-top-bar-layout-context";

export { calculateTopBarExpansionCapacity as calculateExpansionCapacity } from "./project-wing-top-bar-layout";

const ACTION_BAR_TRANSITION_MS = 200;

export type ActionBarExpansionLayout = TopBarExpansionLayout;
export function ConstrainedExpandableActionBar({
  items,
  label,
  onExpansionLayoutChange,
  size = "sm",
  className,
  classNames,
}: {
  items: ExpandableActionBarItem[];
  label?: string;
  onExpansionLayoutChange?: (layout: ActionBarExpansionLayout) => void;
  size?: ExpandableActionBarSize;
  className?: string;
  classNames?: ExpandableActionBarClassNames;
}) {
  const topBarLayout = useProjectWingTopBarLayout();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [keepExpanded, setKeepExpanded] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [capacity, setCapacity] = useState<TopBarExpansionCapacity>({
    allowed: true,
    yieldWidth: 0,
  });
  const measurementItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        onClick: undefined,
        tapAnimation: false,
        wrap: undefined,
      })),
    [items]
  );
  const publishLayout = useCallback(
    (layout: ActionBarExpansionLayout) => {
      setTopBarYield(
        wrapperRef.current,
        "--project-wing-top-bar-action-yield",
        layout
      );
      onExpansionLayoutChange?.(layout);
    },
    [onExpansionLayoutChange]
  );
  const measureCapacity = useCallback(() => {
    const wrapper = wrapperRef.current;
    const measureBar = measureRef.current?.querySelector<HTMLElement>(
      '[data-top-bar-action-measure="expanded"] [data-slot="expandable-action-bar"]'
    );
    const cluster = wrapper?.closest<HTMLElement>(
      '[data-slot="project-wing-top-bar-action-cluster"]'
    );
    const actions = cluster?.closest<HTMLElement>(
      ".project-wing-top-bar-actions"
    );
    const center = actions?.parentElement?.querySelector<HTMLElement>(
      ".project-wing-top-bar-center"
    );
    const header = actions?.closest<HTMLElement>(
      '[data-slot="project-wing-top-bar"]'
    );
    if (!wrapper || !measureBar || !cluster || !actions || !center || !header) {
      setLayoutReady(true);
      return;
    }
    if (header.clientWidth === 0 || actions.clientWidth === 0) {
      setLayoutReady(true);
      return;
    }
    const siblings = [...cluster.children].filter((child) => child !== wrapper);
    const siblingWidth = siblings.reduce(
      (total, child) => total + child.getBoundingClientRect().width,
      0
    );
    const gap = Number.parseFloat(getComputedStyle(cluster).columnGap) || 0;
    const clusterWidth =
      measureBar.getBoundingClientRect().width +
      siblingWidth +
      gap * Math.max(0, cluster.children.length - 1);
    const actionSiblings = [...actions.children].filter(
      (child) => child !== cluster
    );
    const actionSiblingWidth = actionSiblings.reduce(
      (total, child) => total + child.getBoundingClientRect().width,
      0
    );
    const actionGap =
      Number.parseFloat(getComputedStyle(actions).columnGap) || 0;
    const requiredWidth =
      clusterWidth +
      actionSiblingWidth +
      actionGap * Math.max(0, actions.children.length - 1);
    const headerStyle = getComputedStyle(header);
    const actionYield =
      Number(
        headerStyle.getPropertyValue("--project-wing-top-bar-action-yield")
      ) || 0;
    const centerPriority = header.classList.contains(
      "project-wing-top-bar--center-priority"
    );
    const availableWidth = centerPriority
      ? Math.max(0, actions.clientWidth - actionYield)
      : actions.clientWidth;
    const centerWidth = centerPriority
      ? center.clientWidth + actionYield
      : center.clientWidth;
    const nextCapacity = calculateExpansionCapacityImpl({
      availableWidth,
      centerWidth,
      requiredWidth,
    });
    const hasSearch = Boolean(center.querySelector("[data-top-bar-search]"));
    const nextKeepExpanded =
      nextCapacity.allowed &&
      shouldKeepTopBarActionsExpanded({
        hasSearch,
        yieldWidth: Math.max(nextCapacity.yieldWidth, actionYield),
      });
    setCapacity((current) =>
      current.allowed === nextCapacity.allowed &&
      current.yieldWidth === nextCapacity.yieldWidth
        ? current
        : nextCapacity
    );
    setKeepExpanded((current) =>
      current === nextKeepExpanded ? current : nextKeepExpanded
    );
    setLayoutReady(true);
    return nextCapacity;
  }, []);

  useEffect(() => {
    if (topBarLayout.coordinated) {
      return;
    }
    measureCapacity();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const wrapper = wrapperRef.current;
    const actions = wrapper?.closest<HTMLElement>(
      ".project-wing-top-bar-actions"
    );
    const center = actions?.parentElement?.querySelector<HTMLElement>(
      ".project-wing-top-bar-center"
    );
    const observer = new ResizeObserver(() => {
      measureCapacity();
    });
    if (actions) {
      observer.observe(actions);
    }
    if (center) {
      observer.observe(center);
    }
    if (measureRef.current) {
      observer.observe(measureRef.current);
    }
    void document.fonts?.ready.then(measureCapacity);
    return () => observer.disconnect();
  }, [measureCapacity, topBarLayout.coordinated]);

  useEffect(() => {
    if (topBarLayout.coordinated) {
      return;
    }
    const nextExpanded = keepExpanded || expanded;
    const wasExpanded = expandedRef.current;
    expandedRef.current = nextExpanded;
    if (nextExpanded && !capacity.allowed) {
      setExpanded(false);
      publishLayout({ expanded: false, yieldWidth: 0 });
    } else if (nextExpanded) {
      publishLayout({ expanded: true, yieldWidth: capacity.yieldWidth });
    } else if (wasExpanded) {
      publishLayout({ expanded: false, yieldWidth: 0 });
    }
  }, [
    capacity,
    expanded,
    keepExpanded,
    publishLayout,
    topBarLayout.coordinated,
  ]);

  useEffect(
    () => () => publishLayout({ expanded: false, yieldWidth: 0 }),
    [publishLayout]
  );

  const handleExpandedChange = (nextExpanded: boolean) => {
    if (topBarLayout.coordinated) {
      return;
    }
    if (keepExpanded) {
      publishLayout({ expanded: true, yieldWidth: capacity.yieldWidth });
      return;
    }
    const nextCapacity = nextExpanded
      ? (measureCapacity() ?? capacity)
      : capacity;
    if (nextExpanded && !nextCapacity.allowed) {
      return;
    }
    expandedRef.current = nextExpanded;
    setExpanded(nextExpanded);
    publishLayout({
      expanded: nextExpanded,
      yieldWidth: nextExpanded ? nextCapacity.yieldWidth : 0,
    });
    if (!nextExpanded) {
      window.setTimeout(measureCapacity, ACTION_BAR_TRANSITION_MS);
    }
  };
  const visibleReady = topBarLayout.coordinated
    ? topBarLayout.ready
    : layoutReady;
  const visibleExpanded = topBarLayout.coordinated
    ? topBarLayout.actionsMode === "expanded"
    : keepExpanded || expanded;

  return (
    <div
      ref={wrapperRef}
      className="min-w-0 shrink-0"
      data-expansion-allowed={
        topBarLayout.coordinated ? true : capacity.allowed
      }
      data-layout-ready={visibleReady}
      data-expansion-pinned={
        topBarLayout.coordinated ? visibleExpanded : keepExpanded
      }
      data-slot="constrained-expandable-action-bar"
    >
      <ExpandableActionBar
        className={visibleReady ? className : `${className ?? ""} invisible`}
        classNames={classNames}
        expanded={visibleReady && visibleExpanded}
        expandOnFocus={
          !topBarLayout.coordinated && visibleReady && capacity.allowed
        }
        expandOnHover={
          !topBarLayout.coordinated && visibleReady && capacity.allowed
        }
        items={items}
        label={label}
        onExpandedChange={handleExpandedChange}
        size={size}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none invisible fixed inset-0 overflow-hidden"
      >
        <div ref={measureRef} className="w-max">
          <div data-top-bar-action-measure="expanded">
            <ExpandableActionBar
              className={`${className ?? ""} !max-w-none`}
              classNames={classNames}
              expanded
              disableMotion
              expandOnFocus={false}
              expandOnHover={false}
              items={measurementItems}
              label={label}
              size={size}
              testId={null}
            />
          </div>
          <div data-top-bar-action-measure="collapsed">
            <ExpandableActionBar
              className={`${className ?? ""} !max-w-none`}
              classNames={classNames}
              disableMotion
              expanded={false}
              expandOnFocus={false}
              expandOnHover={false}
              items={measurementItems}
              label={label}
              size={size}
              testId={null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
