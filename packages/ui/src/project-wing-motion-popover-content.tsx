"use client";

import { useMotionValueEvent } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { useProjectWingMotionPopoverContext } from "./project-wing-motion-popover";
import {
  PROJECT_WING_MOTION_POPOVER_ALIGN_ORIGIN,
  buildProjectWingMotionPopoverGeo,
  clipProjectWingMotionPopover,
} from "./project-wing-motion-popover-geometry";
import { useProjectWingMotionPopoverPosition } from "./project-wing-motion-popover-position";

export interface ProjectWingTopBarMotionPopoverContentProps {
  "aria-label"?: string;
  children: ReactNode;
  className?: string;
  "data-slot"?: string;
  "data-testid"?: string;
}

function cn(...values: (string | false | null | undefined)[]) {
  return values.filter(Boolean).join(" ");
}

export function ProjectWingTopBarMotionPopoverContent({
  "aria-label": ariaLabel,
  children,
  className,
  "data-slot": slot,
  "data-testid": testId,
}: ProjectWingTopBarMotionPopoverContentProps) {
  const context = useProjectWingMotionPopoverContext(
    "ProjectWingTopBarMotionPopoverContent"
  );
  const [portalReady, setPortalReady] = useState(false);
  const {
    align,
    contentId,
    contentRef,
    gap,
    gooId,
    gooStrength,
    open,
    present,
    panelRadius,
    progress,
    reduce,
    side,
    triggerMode,
    triggerRef,
    openHover,
    scheduleClose,
  } = context;
  const blobRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const geoRef = useRef<ReturnType<
    typeof buildProjectWingMotionPopoverGeo
  > | null>(null);
  const supportsShapeRef = useRef(false);
  const layout = useProjectWingMotionPopoverPosition(
    triggerRef,
    contentRef,
    portalReady && present
  );

  useEffect(() => setPortalReady(true), []);

  const geo = useMemo(
    () =>
      buildProjectWingMotionPopoverGeo(
        layout?.trigger.width ?? 0,
        layout?.trigger.height ?? 0,
        layout?.content.width ?? 0,
        layout?.content.height ?? 0,
        side,
        align,
        gap,
        panelRadius
      ),
    [align, gap, layout, panelRadius, side]
  );
  const renderClip = useCallback(
    (currentGeo: typeof geoRef.current, value: number) => {
      if (!currentGeo || currentGeo.layerW === 0) {
        return;
      }
      const clip = clipProjectWingMotionPopover(
        currentGeo,
        value,
        supportsShapeRef.current
      );
      if (blobRef.current) {
        blobRef.current.style.clipPath = clip;
      }
      if (clipRef.current) {
        clipRef.current.style.clipPath = clip;
      }
    },
    []
  );

  useLayoutEffect(() => {
    supportsShapeRef.current =
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("clip-path", "shape(from 0px 0px, line to 1px 1px, close)");
    geoRef.current = geo;
    renderClip(geo, progress.get());
  }, [geo, progress, renderClip]);

  useMotionValueEvent(progress, "change", (value) =>
    renderClip(geoRef.current, value)
  );

  const hoverHandlers =
    triggerMode === "hover"
      ? {
          onMouseEnter: openHover,
          onMouseLeave: scheduleClose,
          onPointerEnter: openHover,
          onPointerLeave: scheduleClose,
        }
      : {};
  const maskId = `${gooId}-trigger-cutout`;

  if (!portalReady || !present) {
    return null;
  }

  return createPortal(
    <div
      data-popover-portal=""
      className="project-wing-motion-popover-portal"
      style={{
        visibility: layout ? "visible" : "hidden",
        transform: `translate3d(${layout?.trigger.left ?? 0}px, ${layout?.trigger.top ?? 0}px, 0)`,
      }}
    >
      <svg
        aria-hidden
        width="0"
        height="0"
        className="project-wing-motion-popover-definitions"
      >
        <defs>
          <filter id={gooId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation={gooStrength}
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={geo.layerW}
            height={geo.layerH}
          >
            <rect width={geo.layerW} height={geo.layerH} fill="white" />
            <rect
              x={geo.trigger.x}
              y={geo.trigger.y}
              width={geo.trigger.w}
              height={geo.trigger.h}
              rx={geo.trigger.r}
              fill="black"
            />
          </mask>
        </defs>
      </svg>

      <div
        aria-hidden
        className="project-wing-motion-popover-blob-layer"
        style={{
          left: geo.left,
          top: geo.top,
          width: geo.layerW,
          height: geo.layerH,
          filter: reduce ? undefined : `url(#${gooId})`,
          mask: `url(#${maskId})`,
          WebkitMask: `url(#${maskId})`,
        }}
      >
        <div
          className="project-wing-motion-popover-trigger-blob"
          style={{
            left: geo.trigger.x,
            top: geo.trigger.y,
            width: geo.trigger.w,
            height: geo.trigger.h,
            borderRadius: geo.trigger.r,
          }}
        />
        <div
          ref={blobRef}
          className="project-wing-motion-popover-blob"
          style={{
            clipPath: clipProjectWingMotionPopover(geo, progress.get(), false),
          }}
        />
      </div>

      <div
        className="project-wing-motion-popover-content-layer"
        style={{
          left: geo.left,
          top: geo.top,
          width: geo.layerW,
          height: geo.layerH,
        }}
      >
        <div
          ref={clipRef}
          inert={!open}
          className="project-wing-motion-popover-clip"
          style={{
            clipPath: clipProjectWingMotionPopover(geo, progress.get(), false),
            pointerEvents: "none",
          }}
        >
          <div
            ref={contentRef}
            aria-label={ariaLabel}
            data-slot={slot ?? "project-wing-top-bar-motion-popover-content"}
            data-testid={testId}
            id={contentId}
            role="dialog"
            {...hoverHandlers}
            style={{
              position: "absolute",
              left: geo.panel.x,
              top: geo.panel.y,
              pointerEvents: open ? "auto" : "none",
              transformOrigin: `${PROJECT_WING_MOTION_POPOVER_ALIGN_ORIGIN[align]} ${side === "bottom" ? "top" : "bottom"}`,
            }}
            className={cn(
              "w-max max-w-[min(92vw,20rem)] p-4 text-popover-foreground outline-none",
              className
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
