import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { getTmsWorkspaceCopy } from "@/i18n/dictionaries";
import { cn } from "@/lib/utils";

import { RESIZE_GRIP_CLASS, RESIZE_RAIL_CLASS } from "./resize-handle";
import { Button } from "./ui/button";

export const MIN_REVIEW_PANEL_HEIGHT = 160;
export const DEFAULT_REVIEW_PANEL_HEIGHT = MIN_REVIEW_PANEL_HEIGHT;
export const MAX_REVIEW_PANEL_HEIGHT = 320;
export const COMPACT_REVIEW_PANEL_HEIGHT = 16;
const REVIEW_PANEL_COLLAPSE_THRESHOLD = 48;
const REVIEW_PANEL_DRAG_THRESHOLD = 1;
const REVIEW_PANEL_EXPAND_THRESHOLD = 48;
const REVIEW_PANEL_RAIL_SLOT_HEIGHT = 16;

type ReviewPanelLayout = {
  height: number;
  collapsed: boolean;
};

type ReviewPanelPointerLike = {
  clientY: number;
  pointerId: number;
  preventDefault: () => void;
};

type ReviewPanelDrag = {
  pointerId: number;
  startY: number;
  startHeight: number;
  currentHeight: number;
  restoreHeight: number;
  maxHeight: number;
  startCollapsed: boolean;
  previewExpanded: boolean;
  moved: boolean;
};

export type ResizableReviewPanelProps = {
  children: ReactNode;
  storageKey: string;
  resizeLabel?: string;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
};

function clampHeight(height: number, minHeight: number, maxHeight: number) {
  return Math.min(maxHeight, Math.max(minHeight, height));
}

function readLayout(
  storageKey: string,
  defaultHeight: number,
  minHeight: number,
  maxHeight: number
): ReviewPanelLayout {
  if (typeof window === "undefined") {
    return { height: defaultHeight, collapsed: false };
  }

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "null"
    );
    if (
      !stored ||
      typeof stored.height !== "number" ||
      !Number.isFinite(stored.height) ||
      typeof stored.collapsed !== "boolean"
    ) {
      return { height: defaultHeight, collapsed: false };
    }
    return {
      height: clampHeight(stored.height, minHeight, maxHeight),
      collapsed: stored.collapsed,
    };
  } catch {
    return { height: defaultHeight, collapsed: false };
  }
}

export function ResizableReviewPanel({
  children,
  resizeLabel = getTmsWorkspaceCopy("zh-CN").resizeReviewDashboard,
  storageKey,
  defaultHeight = DEFAULT_REVIEW_PANEL_HEIGHT,
  minHeight = MIN_REVIEW_PANEL_HEIGHT,
  maxHeight = MAX_REVIEW_PANEL_HEIGHT,
}: ResizableReviewPanelProps) {
  const safeDefaultHeight = clampHeight(defaultHeight, minHeight, maxHeight);
  const [layout, setLayout] = useState<ReviewPanelLayout>({
    height: safeDefaultHeight,
    collapsed: false,
  });
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(
    null
  );
  const [dragging, setDragging] = useState(false);
  const [dragPreviewExpanded, setDragPreviewExpanded] = useState(false);
  const [dragPreviewHeight, setDragPreviewHeight] = useState<number | null>(
    null
  );
  const panelRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<ReviewPanelDrag | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const dragMovedRef = useRef(false);
  const panelPaintFrameRef = useRef<number | null>(null);
  const pendingPanelHeightRef = useRef<number | null>(null);

  useEffect(() => {
    setLayout(readLayout(storageKey, safeDefaultHeight, minHeight, maxHeight));
    setHydratedStorageKey(storageKey);
  }, [maxHeight, minHeight, safeDefaultHeight, storageKey]);

  useEffect(() => {
    if (hydratedStorageKey !== storageKey) {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(layout));
  }, [hydratedStorageKey, layout, storageKey]);

  useEffect(
    () => () => {
      dragCleanupRef.current?.();
      if (
        panelPaintFrameRef.current !== null &&
        typeof window.cancelAnimationFrame === "function"
      ) {
        window.cancelAnimationFrame(panelPaintFrameRef.current);
      }
    },
    []
  );

  function applyPanelHeight(height: number) {
    if (!panelRef.current) {
      return;
    }
    const drag = dragRef.current;
    const collapsed = drag
      ? drag.startCollapsed && !drag.previewExpanded
      : layout.collapsed;
    panelRef.current.style.height = `${
      collapsed ? height : height + REVIEW_PANEL_RAIL_SLOT_HEIGHT
    }px`;
  }

  function schedulePanelHeightPaint(height: number) {
    pendingPanelHeightRef.current = height;
    if (panelPaintFrameRef.current !== null) {
      return;
    }

    if (typeof window.requestAnimationFrame !== "function") {
      pendingPanelHeightRef.current = null;
      applyPanelHeight(height);
      setDragPreviewHeight(height);
      return;
    }

    let completedSynchronously = false;
    const frameId = window.requestAnimationFrame(() => {
      completedSynchronously = true;
      panelPaintFrameRef.current = null;
      const pendingHeight = pendingPanelHeightRef.current;
      pendingPanelHeightRef.current = null;
      if (pendingHeight !== null) {
        applyPanelHeight(pendingHeight);
        setDragPreviewHeight(pendingHeight);
      }
    });
    panelPaintFrameRef.current = completedSynchronously ? null : frameId;
  }

  function flushPanelHeightPaint(height?: number) {
    if (
      panelPaintFrameRef.current !== null &&
      typeof window.cancelAnimationFrame === "function"
    ) {
      window.cancelAnimationFrame(panelPaintFrameRef.current);
    }
    panelPaintFrameRef.current = null;
    const pendingHeight = height ?? pendingPanelHeightRef.current;
    pendingPanelHeightRef.current = null;
    if (pendingHeight !== undefined && pendingHeight !== null) {
      applyPanelHeight(pendingHeight);
      setDragPreviewHeight(pendingHeight);
    }
  }

  function stopDragging() {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    setDragging(false);
    setDragPreviewHeight(null);
  }

  function handleResizePointerMove(pointerEvent: ReviewPanelPointerLike) {
    const drag = dragRef.current;
    if (
      !drag ||
      pointerEvent.pointerId !== drag.pointerId ||
      Math.abs(pointerEvent.clientY - drag.startY) <=
        REVIEW_PANEL_DRAG_THRESHOLD
    ) {
      return;
    }

    drag.moved = true;
    pointerEvent.preventDefault();
    drag.currentHeight = Math.min(
      drag.maxHeight,
      Math.max(0, drag.startHeight + drag.startY - pointerEvent.clientY)
    );
    if (drag.currentHeight >= minHeight) {
      drag.restoreHeight = clampHeight(
        drag.currentHeight,
        minHeight,
        drag.maxHeight
      );
    }
    schedulePanelHeightPaint(
      Math.max(COMPACT_REVIEW_PANEL_HEIGHT, drag.currentHeight)
    );
    const previewExpanded =
      drag.startCollapsed &&
      drag.currentHeight >= REVIEW_PANEL_EXPAND_THRESHOLD;
    if (previewExpanded !== drag.previewExpanded) {
      drag.previewExpanded = previewExpanded;
      setDragPreviewExpanded(previewExpanded);
    }
  }

  function finishResize(pointerEvent: ReviewPanelPointerLike) {
    const drag = dragRef.current;
    if (!drag || pointerEvent.pointerId !== drag.pointerId) {
      return;
    }
    handleResizePointerMove(pointerEvent);
    const currentDrag = dragRef.current;
    if (!currentDrag) {
      return;
    }

    dragMovedRef.current = currentDrag.moved;
    if (currentDrag.moved) {
      const shouldCollapse = currentDrag.startCollapsed
        ? currentDrag.currentHeight < REVIEW_PANEL_EXPAND_THRESHOLD
        : currentDrag.currentHeight < REVIEW_PANEL_COLLAPSE_THRESHOLD;
      const nextHeight = shouldCollapse
        ? currentDrag.restoreHeight
        : clampHeight(
            currentDrag.currentHeight,
            minHeight,
            currentDrag.maxHeight
          );
      flushPanelHeightPaint(
        shouldCollapse ? COMPACT_REVIEW_PANEL_HEIGHT : nextHeight
      );
      setLayout((current) => ({
        ...current,
        collapsed: shouldCollapse,
        height: nextHeight,
      }));
    }
    dragRef.current = null;
    setDragPreviewExpanded(false);
    setDragPreviewHeight(null);
    stopDragging();
  }

  function cancelResize() {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    dragMovedRef.current = drag.moved;
    flushPanelHeightPaint(drag.startHeight);
    setLayout((current) => ({
      ...current,
      collapsed: drag.startCollapsed,
      height: drag.startHeight,
    }));
    dragRef.current = null;
    setDragPreviewExpanded(false);
    setDragPreviewHeight(null);
    stopDragging();
  }

  function startDragging(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    stopDragging();
    setDragPreviewHeight(null);
    dragMovedRef.current = false;
    event.preventDefault();

    const pointerTarget = event.currentTarget;
    const container = panelRef.current?.closest<HTMLElement>(
      "[data-resizable-review-container]"
    );
    const availableHeight = container?.getBoundingClientRect().height ?? 0;
    const dragMaxHeight = Math.max(
      minHeight,
      Math.min(maxHeight, availableHeight > 0 ? availableHeight : maxHeight)
    );
    const startHeight = layout.collapsed
      ? COMPACT_REVIEW_PANEL_HEIGHT
      : layout.height;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight,
      currentHeight: startHeight,
      restoreHeight: startHeight,
      maxHeight: dragMaxHeight,
      startCollapsed: layout.collapsed,
      previewExpanded: false,
      moved: false,
    };
    const handleWindowPointerMove = (pointerEvent: Event) =>
      handleResizePointerMove(pointerEvent as PointerEvent);
    const handleWindowPointerUp = (pointerEvent: Event) =>
      finishResize(pointerEvent as PointerEvent);
    const handleWindowPointerCancel = () => cancelResize();
    const handleWindowBlur = () => cancelResize();
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerCancel);
    window.addEventListener("blur", handleWindowBlur);
    dragCleanupRef.current = () => {
      if (pointerTarget.hasPointerCapture?.(event.pointerId)) {
        pointerTarget.releasePointerCapture(event.pointerId);
      }
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerCancel);
      window.removeEventListener("blur", handleWindowBlur);
    };
    pointerTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  }

  function toggleCollapsed() {
    stopDragging();
    flushPanelHeightPaint();
    setDragPreviewExpanded(false);
    setDragPreviewHeight(null);
    setLayout((current) => ({ ...current, collapsed: !current.collapsed }));
  }

  function handleRailClick() {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    toggleCollapsed();
  }

  function handleRailKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleCollapsed();
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }
    event.preventDefault();
    const direction = event.key === "ArrowUp" ? 1 : -1;
    setLayout((current) => ({
      ...current,
      collapsed: false,
      height: clampHeight(
        current.height + direction * 16,
        minHeight,
        maxHeight
      ),
    }));
  }

  const visibleHeight =
    dragging && dragPreviewHeight !== null
      ? Math.max(COMPACT_REVIEW_PANEL_HEIGHT, dragPreviewHeight)
      : layout.collapsed && !dragPreviewExpanded
        ? COMPACT_REVIEW_PANEL_HEIGHT
        : layout.height;
  const isCollapsed =
    layout.collapsed && !dragPreviewExpanded && dragPreviewHeight === null;
  const panelHeight = isCollapsed
    ? visibleHeight
    : visibleHeight + REVIEW_PANEL_RAIL_SLOT_HEIGHT;

  return (
    <section
      data-testid="resizable-review-panel"
      className="flex min-h-0 shrink-0 flex-col overflow-hidden"
      ref={panelRef}
      style={{ height: `${panelHeight}px` }}
    >
      <div
        data-testid="resizable-review-panel-rail-slot"
        className="shrink-0 py-1"
      >
        <Button
          type="button"
          accessibleName={resizeLabel}
          data-timesheet-resize-handle
          data-testid="resizable-review-panel-handle"
          data-state={isCollapsed ? "collapsed" : "expanded"}
          data-resize-state={dragging ? "dragging" : "idle"}
          showTooltip={false}
          size="icon"
          variant="ghost"
          className={cn(
            RESIZE_RAIL_CLASS,
            "relative z-20 h-2 w-full shrink-0 cursor-pointer touch-none select-none active:cursor-row-resize"
          )}
          onPointerDown={startDragging}
          onPointerMove={(event) =>
            handleResizePointerMove(event as unknown as PointerEvent)
          }
          onPointerUp={(event) =>
            finishResize(event as unknown as PointerEvent)
          }
          onPointerCancel={cancelResize}
          onClick={handleRailClick}
          onKeyDown={handleRailKeyDown}
        >
          <span
            data-testid="resizable-review-panel-hit-area"
            aria-hidden="true"
            className="absolute inset-x-0 -inset-y-3 z-10 cursor-pointer touch-none select-none active:cursor-row-resize"
          />
          <span
            data-slot="resizable-grip"
            className={cn(RESIZE_GRIP_CLASS, "h-1 w-12")}
          />
        </Button>
      </div>
      {isCollapsed ? null : (
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      )}
    </section>
  );
}
