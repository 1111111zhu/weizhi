"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import {
  ACTION_BAR_TRANSITION,
  REDUCED_ACTION_BAR_TRANSITION,
} from "./expandable-action-bar";
import {
  calculateTopBarIdentityCapacity,
  getTopBarIdentityAvailableWidth,
  measureTopBarIdentityWidth,
  setTopBarYield,
} from "./project-wing-top-bar-layout";
import type {
  TopBarExpansionLayout,
  TopBarIdentityCapacity,
} from "./project-wing-top-bar-layout";
import { useProjectWingTopBarLayout } from "./project-wing-top-bar-layout-context";
import { TopBarIdentityMotionContext } from "./top-bar-identity-motion";

const COLLAPSE_DELAY_MS = 90;
const IDENTITY_TRANSITION_MS = 200;

export type TopBarIdentityExpansionLayout = TopBarExpansionLayout;

export function ConstrainedTopBarIdentity({
  children,
  onExpansionLayoutChange,
}: {
  children: ReactNode;
  onExpansionLayoutChange?: (layout: TopBarIdentityExpansionLayout) => void;
}) {
  const topBarLayout = useProjectWingTopBarLayout();
  const rootRef = useRef<HTMLDivElement>(null);
  const collapseTimer = useRef<number | null>(null);
  const transitionTimer = useRef<number | null>(null);
  const resizeTimer = useRef<number | null>(null);
  const readyRef = useRef(false);
  const measurementPausedRef = useRef(false);
  const expandedRef = useRef(false);
  const yieldWidthRef = useRef(0);
  const stopPointerTracking = useRef<(() => void) | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [capacity, setCapacity] = useState<TopBarIdentityCapacity>({
    allowed: false,
    collapsed: true,
    yieldWidth: 0,
  });
  const layoutId = useId();
  const reduce = useReducedMotion();
  const clearCollapseTimer = useCallback(() => {
    if (collapseTimer.current) {
      window.clearTimeout(collapseTimer.current);
    }
    collapseTimer.current = null;
  }, []);
  const publishLayout = useCallback(
    (layout: TopBarIdentityExpansionLayout) => {
      setTopBarYield(
        rootRef.current,
        "--project-wing-top-bar-leading-yield",
        layout
      );
      onExpansionLayoutChange?.(layout);
    },
    [onExpansionLayoutChange]
  );
  const measureCapacity = useCallback(() => {
    if (measurementPausedRef.current) {
      return;
    }
    const root = rootRef.current;
    const header = root?.closest<HTMLElement>(
      '[data-slot="project-wing-top-bar"]'
    );
    const center = header?.querySelector<HTMLElement>(
      ".project-wing-top-bar-center"
    );
    if (!root || !center) {
      return;
    }
    const activeYield = expandedRef.current ? yieldWidthRef.current : 0;
    const nextCapacity = calculateTopBarIdentityCapacity({
      availableWidth: Math.max(
        0,
        getTopBarIdentityAvailableWidth(root) - activeYield
      ),
      centerWidth: center.clientWidth + activeYield,
      requiredWidth: measureTopBarIdentityWidth(root),
    });
    setCapacity(nextCapacity);
    return nextCapacity;
  }, []);
  const pauseMeasurements = useCallback(() => {
    if (transitionTimer.current) {
      window.clearTimeout(transitionTimer.current);
    }
    measurementPausedRef.current = true;
    transitionTimer.current = window.setTimeout(
      () => {
        measurementPausedRef.current = false;
        measureCapacity();
      },
      reduce ? 120 : IDENTITY_TRANSITION_MS
    );
  }, [measureCapacity, reduce]);
  const collapse = useCallback(() => {
    clearCollapseTimer();
    collapseTimer.current = window.setTimeout(() => {
      if (rootRef.current?.querySelector('[aria-expanded="true"]')) {
        return;
      }
      pauseMeasurements();
      expandedRef.current = false;
      yieldWidthRef.current = 0;
      setExpanded(false);
      publishLayout({ expanded: false, yieldWidth: 0 });
      window.setTimeout(measureCapacity, IDENTITY_TRANSITION_MS);
    }, COLLAPSE_DELAY_MS);
  }, [clearCollapseTimer, measureCapacity, pauseMeasurements, publishLayout]);
  const finishPointerTracking = useCallback(() => {
    stopPointerTracking.current?.();
    collapse();
  }, [collapse]);
  const trackPointerUntilLeave = useCallback(() => {
    stopPointerTracking.current?.();
    const handlePointerMove = (event: PointerEvent) => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (
        rect &&
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        return;
      }
      finishPointerTracking();
    };
    const handlePointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null) {
        finishPointerTracking();
      }
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerout", handlePointerOut);
    stopPointerTracking.current = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerout", handlePointerOut);
      stopPointerTracking.current = null;
    };
  }, [finishPointerTracking]);

  useLayoutEffect(() => {
    if (topBarLayout.coordinated) {
      return;
    }
    measureCapacity();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const root = rootRef.current;
    const context = root?.closest<HTMLElement>(".project-wing-top-bar-context");
    const center = context
      ?.closest<HTMLElement>('[data-slot="project-wing-top-bar"]')
      ?.querySelector<HTMLElement>(".project-wing-top-bar-center");
    const observer = new ResizeObserver(() => {
      if (!expandedRef.current) {
        measureCapacity();
      }
    });
    if (context) {
      observer.observe(context);
    }
    if (center) {
      observer.observe(center);
    }
    if (root) {
      observer.observe(root);
    }
    const handleResize = () => {
      if (resizeTimer.current) {
        window.clearTimeout(resizeTimer.current);
      }
      resizeTimer.current = window.setTimeout(
        measureCapacity,
        expandedRef.current ? IDENTITY_TRANSITION_MS : 0
      );
    };
    window.addEventListener("resize", handleResize);
    void document.fonts?.ready.then(measureCapacity);
    let readyFrame = window.requestAnimationFrame(() => {
      readyFrame = window.requestAnimationFrame(() => {
        measureCapacity();
        readyRef.current = true;
      });
    });
    return () => {
      readyRef.current = false;
      observer.disconnect();
      window.cancelAnimationFrame(readyFrame);
      window.removeEventListener("resize", handleResize);
      if (resizeTimer.current) {
        window.clearTimeout(resizeTimer.current);
      }
      if (transitionTimer.current) {
        window.clearTimeout(transitionTimer.current);
      }
    };
  }, [measureCapacity, topBarLayout.coordinated]);

  useLayoutEffect(() => {
    if (topBarLayout.coordinated) {
      return;
    }
    if (!expanded) {
      return;
    }
    if (!capacity.allowed) {
      expandedRef.current = false;
      yieldWidthRef.current = 0;
      setExpanded(false);
      publishLayout({ expanded: false, yieldWidth: 0 });
      return;
    }
    yieldWidthRef.current = capacity.yieldWidth;
    publishLayout({ expanded: true, yieldWidth: capacity.yieldWidth });
  }, [
    capacity.allowed,
    capacity.yieldWidth,
    expanded,
    publishLayout,
    topBarLayout.coordinated,
  ]);

  useLayoutEffect(
    () => () => {
      clearCollapseTimer();
      stopPointerTracking.current?.();
      publishLayout({ expanded: false, yieldWidth: 0 });
    },
    [clearCollapseTimer, publishLayout]
  );

  const open = () => {
    if (topBarLayout.coordinated) {
      return;
    }
    if (!readyRef.current) {
      return;
    }
    clearCollapseTimer();
    const nextCapacity = measureCapacity() ?? capacity;
    if (!nextCapacity.collapsed || !nextCapacity.allowed) {
      return;
    }
    pauseMeasurements();
    expandedRef.current = true;
    yieldWidthRef.current = nextCapacity.yieldWidth;
    setExpanded(true);
    publishLayout({ expanded: true, yieldWidth: nextCapacity.yieldWidth });
    trackPointerUntilLeave();
  };
  const visibleExpanded = topBarLayout.coordinated
    ? topBarLayout.leadingMode === "expanded"
    : expanded;
  const visibleCollapsed = topBarLayout.coordinated
    ? topBarLayout.leadingMode === "collapsed"
    : capacity.collapsed;
  const expansionAllowed = topBarLayout.coordinated ? true : capacity.allowed;
  const motionContextValue = useMemo(
    () => ({ collapsed: visibleCollapsed, expanded: visibleExpanded }),
    [visibleCollapsed, visibleExpanded]
  );

  return (
    <LayoutGroup id={layoutId}>
      <motion.div
        ref={rootRef}
        layout="size"
        transition={
          reduce ? REDUCED_ACTION_BAR_TRANSITION : ACTION_BAR_TRANSITION
        }
        className="project-wing-top-bar-identity"
        data-collapsed={visibleCollapsed}
        data-expanded={visibleExpanded}
        data-expansion-allowed={expansionAllowed}
        data-slot="constrained-top-bar-identity"
        onMouseEnter={open}
        onMouseLeave={() => {
          if (!topBarLayout.coordinated && expanded) {
            collapse();
          }
        }}
      >
        <TopBarIdentityMotionContext.Provider value={motionContextValue}>
          {children}
        </TopBarIdentityMotionContext.Provider>
      </motion.div>
    </LayoutGroup>
  );
}
