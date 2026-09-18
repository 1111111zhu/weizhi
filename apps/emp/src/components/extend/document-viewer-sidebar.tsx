"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const DOCUMENT_VIEWER_HORIZONTAL_PADDING_RATIO = 0.03;
const DOCUMENT_VIEWER_MAX_HORIZONTAL_PADDING = 32;
const DOCUMENT_VIEWER_MIN_HORIZONTAL_PADDING = 8;
const INLINE_THUMBNAIL_SIDEBAR_MIN_WIDTH = 768;

export function getDocumentViewerHorizontalPadding(width: number) {
  return Math.min(
    DOCUMENT_VIEWER_MAX_HORIZONTAL_PADDING,
    Math.max(
      DOCUMENT_VIEWER_MIN_HORIZONTAL_PADDING,
      width * DOCUMENT_VIEWER_HORIZONTAL_PADDING_RATIO
    )
  );
}

export function getDocumentViewerContentWidth({
  shellWidth,
  sidebarInline,
  sidebarVisible,
  sidebarWidth,
}: {
  shellWidth: number;
  sidebarInline: boolean;
  sidebarVisible: boolean;
  sidebarWidth: number;
}) {
  const inlineSidebarWidth = sidebarInline && sidebarVisible ? sidebarWidth : 0;
  const viewportWidth = Math.max(0, shellWidth - inlineSidebarWidth);
  const horizontalPadding = getDocumentViewerHorizontalPadding(viewportWidth);

  return Math.max(0, viewportWidth - horizontalPadding * 2);
}

export function useElementWidth<TElement extends HTMLElement>() {
  const ref = React.useRef<TElement | null>(null);
  const [width, setWidth] = React.useState(0);

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      const nextWidth = element.getBoundingClientRect().width;

      // Keep the last real measurement while the element is hidden or
      // Detached (keep-alive preview pools, display:none ancestors): a
      // Zero-width pass would re-lay-out the viewer for nothing, clearing
      // Its rendered canvases, and force a blank-then-repaint flash when
      // The element comes back at its old size.
      if (nextWidth === 0) {
        return;
      }
      setWidth(nextWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

export function useInlineThumbnailSidebar(width: number) {
  return width >= INLINE_THUMBNAIL_SIDEBAR_MIN_WIDTH;
}

export function DocumentViewerThumbnailSidebar({
  children,
  className,
  closedInlineClassName = "-ml-40",
  inline,
  open,
  widthClassName = "w-40",
}: {
  children?: React.ReactNode;
  className?: string;
  closedInlineClassName?: string;
  inline: boolean;
  open: boolean;
  widthClassName?: string;
}) {
  const [transitionsReady, setTransitionsReady] = React.useState(false);
  const shouldAnimateSidebar = transitionsReady;

  React.useEffect(() => {
    let secondFrameId = 0;
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        setTransitionsReady(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      window.cancelAnimationFrame(secondFrameId);
    };
  }, []);

  return (
    <aside
      data-document-thumbnail-sidebar=""
      data-sidebar-mode={inline ? "inline" : "overlay"}
      data-sidebar-open={open ? "true" : "false"}
      className={cn(
        "absolute inset-y-0 left-0 z-30 shrink-0 overflow-hidden border-r border-[var(--pw-color-border)] bg-workbench-sidebar text-[var(--pw-color-foreground)] shadow-lg",
        widthClassName,
        shouldAnimateSidebar
          ? "transition-[translate,margin-left,border-color] duration-200 ease-out motion-reduce:transition-none"
          : "transition-none",
        inline && "relative z-20 translate-x-0 shadow-md",
        open
          ? "ml-0 translate-x-0"
          : inline
            ? cn(
                "pointer-events-auto border-r-0 shadow-none",
                closedInlineClassName
              )
            : "pointer-events-none -translate-x-full border-r-0 shadow-none",
        className
      )}
    >
      {children}
    </aside>
  );
}
