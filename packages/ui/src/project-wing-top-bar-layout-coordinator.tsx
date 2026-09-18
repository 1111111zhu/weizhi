"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, ReactNode, RefObject } from "react";

import {
  useSearchInteraction,
  useSideInteraction,
} from "./project-wing-top-bar-interactions";
import type { TopBarSide } from "./project-wing-top-bar-interactions";
import {
  PROJECT_WING_TOP_BAR_MIN_SEARCH_WIDTH,
  calculateResponsiveTopBarLayout,
  calculateResponsiveTopBarTrackWidths,
  shouldCoordinateResponsiveTopBar,
} from "./project-wing-top-bar-layout";
import type {
  ResponsiveTopBarLayout,
  TopBarLayoutIntent,
} from "./project-wing-top-bar-layout";
import { ProjectWingTopBarLayoutContext } from "./project-wing-top-bar-layout-context";
import {
  measureTopBarLayoutMetrics,
  topBarMetricsEqual,
} from "./project-wing-top-bar-measurement";
import type { TopBarLayoutMetrics } from "./project-wing-top-bar-measurement";

type CoordinatorProps = {
  leading?: ReactNode;
  center?: ReactNode;
  actions?: ReactNode;
  overlays?: ReactNode;
  centerOnMobile: boolean;
  centerPriority: boolean;
  independentHover?: boolean;
  className?: string;
} & Omit<ComponentProps<"header">, "children">;

function useTopBarMetrics(headerRef: RefObject<HTMLElement | null>) {
  const [metrics, setMetrics] = useState<TopBarLayoutMetrics | null>(null);
  const [hasSearch, setHasSearch] = useState(false);
  const update = useCallback(() => {
    const header = headerRef.current;
    if (!header) {
      return;
    }
    const nextHasSearch = Boolean(
      header.querySelector("[data-top-bar-search]")
    );
    setHasSearch(nextHasSearch);
    const next = measureTopBarLayoutMetrics(header);
    setMetrics((current) =>
      topBarMetricsEqual(current, next) ? current : next
    );
  }, [headerRef]);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) {
      return;
    }
    update();
    const resize =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(update);
    resize?.observe(header);
    if (resize) {
      header
        .querySelectorAll<HTMLElement>(
          "[data-top-bar-action-measure] [data-slot='expandable-action-bar']"
        )
        .forEach((node) => resize.observe(node));
    }
    const mutation = new MutationObserver(update);
    mutation.observe(header, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    void document.fonts?.ready.then(update);
    return () => {
      resize?.disconnect();
      mutation.disconnect();
    };
  }, [headerRef, update]);
  return { metrics, hasSearch };
}

function useResolvedLayout({
  headerRef,
  metrics,
  coordinated,
  centerAbsent,
  intent,
  independentHover,
}: {
  headerRef: RefObject<HTMLElement | null>;
  metrics: TopBarLayoutMetrics | null;
  coordinated: boolean;
  centerAbsent: boolean;
  intent: TopBarLayoutIntent;
  independentHover: boolean;
}) {
  const [ready, setReady] = useState(false);
  const layout = useMemo(() => {
    if (!metrics || !coordinated) {
      return null;
    }
    return calculateResponsiveTopBarLayout({
      ...metrics,
      expandedCenterWidth: centerAbsent ? 0 : metrics.expandedCenterWidth,
      minimumCenterWidth: centerAbsent
        ? 0
        : PROJECT_WING_TOP_BAR_MIN_SEARCH_WIDTH,
      intent,
      independentHover,
    });
  }, [centerAbsent, coordinated, independentHover, intent, metrics]);
  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header || !layout || !metrics || !coordinated) {
      return;
    }
    const { leadingWidth, actionsWidth } = resolveTrackWidths(layout, metrics);
    header.style.setProperty(
      "--project-wing-top-bar-leading-layout-width",
      `${leadingWidth}px`
    );
    header.style.setProperty(
      "--project-wing-top-bar-center-layout-width",
      `${layout.centerWidth}px`
    );
    header.style.setProperty(
      "--project-wing-top-bar-actions-layout-width",
      `${actionsWidth}px`
    );
    if (ready) {
      return;
    }
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, [coordinated, headerRef, layout, metrics, ready]);
  return { layout, ready };
}

function resolveTrackWidths(
  layout: ResponsiveTopBarLayout,
  metrics: TopBarLayoutMetrics
) {
  return calculateResponsiveTopBarTrackWidths({ layout, ...metrics });
}

function resolveIntent(
  searchEngaged: boolean,
  sideEngaged: TopBarSide | null
): TopBarLayoutIntent {
  if (searchEngaged) {
    return "search";
  }
  if (sideEngaged === "actions") {
    return "actions";
  }
  if (sideEngaged === "leading") {
    return "leading";
  }
  return "resting";
}

function TopBarRegions({
  leading,
  center,
  actions,
  searchProps,
  sideProps,
}: Pick<CoordinatorProps, "leading" | "center" | "actions"> & {
  searchProps: ComponentProps<"div">;
  sideProps: (side: TopBarSide) => ComponentProps<"div">;
}) {
  return (
    <>
      <div className="project-wing-top-bar-leading">
        <div
          className="project-wing-top-bar-side-trigger"
          data-top-bar-side-trigger="leading"
          {...sideProps("leading")}
        >
          {leading}
        </div>
      </div>
      <div className="project-wing-top-bar-center" {...searchProps}>
        {center}
      </div>
      <div className="project-wing-top-bar-actions">
        <div
          className="project-wing-top-bar-side-trigger"
          data-top-bar-side-trigger="actions"
          {...sideProps("actions")}
        >
          {actions}
        </div>
      </div>
    </>
  );
}

export function ProjectWingTopBarLayoutCoordinator({
  leading,
  center,
  actions,
  overlays,
  centerOnMobile,
  centerPriority,
  independentHover = false,
  className,
  ...props
}: CoordinatorProps) {
  const headerRef = useRef<HTMLElement>(null);
  const { metrics, hasSearch } = useTopBarMetrics(headerRef);
  const search = useSearchInteraction(headerRef);
  const sides = useSideInteraction(independentHover);
  const intent = resolveIntent(search.engaged, sides.engaged);
  const centerAbsent = center === null || center === undefined;
  const coordinated = shouldCoordinateResponsiveTopBar({
    centerAbsent,
    centerPriority,
    hasSearch,
    headerWidth: metrics?.headerWidth ?? 0,
  });
  const { layout, ready } = useResolvedLayout({
    headerRef,
    metrics,
    coordinated,
    centerAbsent,
    intent,
    independentHover,
  });
  const contextValue = useMemo(
    () => ({
      coordinated,
      ready,
      leadingMode: layout?.leadingMode ?? "collapsed",
      actionsMode: layout?.actionsMode ?? "collapsed",
    }),
    [coordinated, layout?.actionsMode, layout?.leadingMode, ready]
  );
  const classes = `project-wing-top-bar${centerOnMobile ? " project-wing-top-bar--center-on-mobile" : ""}${centerPriority ? " project-wing-top-bar--center-priority" : ""}${className ? ` ${className}` : ""}`;
  return (
    <ProjectWingTopBarLayoutContext.Provider value={contextValue}>
      <header
        ref={headerRef}
        className={classes}
        data-slot="project-wing-top-bar"
        data-top-bar-layout-coordinated={coordinated}
        data-top-bar-layout-intent={intent}
        data-top-bar-layout-ready={ready}
        data-top-bar-leading-mode={layout?.leadingMode ?? "collapsed"}
        data-top-bar-actions-mode={layout?.actionsMode ?? "collapsed"}
        data-top-bar-active-overlay={layout?.overlaySide ?? "none"}
        data-top-bar-search-engaged={search.engaged}
        {...props}
      >
        <TopBarRegions
          leading={leading}
          center={center}
          actions={actions}
          searchProps={search.regionProps}
          sideProps={sides.propsFor}
        />
        {overlays}
      </header>
    </ProjectWingTopBarLayoutContext.Provider>
  );
}
