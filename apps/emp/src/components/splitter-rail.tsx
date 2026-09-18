"use client";

import "./splitter-motion.css";

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type {
  PointerEventHandler,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";

import {
  RESIZE_GRIP_CLASS,
  RESIZE_RAIL_CLASS,
} from "@/components/resize-handle";
import { cn } from "@/lib/utils";

const POINTER_DRAG_THRESHOLD = 3;

type SplitterRailProps = {
  className?: string;
  "data-testid"?: string;
  expanded: boolean;
  hitAreaTestId?: string;
  label: ReactNode;
  max?: number;
  min?: number;
  onDrag?: (delta: number) => void;
  onDragCancel?: () => void;
  onDragEnd?: () => void;
  onDragStart?: () => void;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
  onToggle: () => void;
  orientation?: "vertical" | "horizontal";
  value?: number;
};

type PointerSession = {
  moved: boolean;
  pointerId: number;
  startPosition: number;
};

export const SplitterRail = forwardRef<HTMLDivElement, SplitterRailProps>(
  (
    {
      className,
      "data-testid": dataTestId,
      expanded,
      hitAreaTestId,
      label,
      max,
      min,
      onDrag,
      onDragCancel,
      onDragEnd,
      onDragStart,
      onPointerDown,
      onToggle,
      orientation = "vertical",
      value,
    },
    forwardedRef
  ) => {
    const pointerSessionRef = useRef<PointerSession | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);
    const suppressClickRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const labelId = useId();
    const expandedAriaProps = { "aria-expanded": expanded };

    useEffect(
      () => () => {
        cleanupRef.current?.();
      },
      []
    );

    const cleanupPointerSession = () => {
      cleanupRef.current?.();
    };
    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      onPointerDown?.(event);

      cleanupPointerSession();
      setIsDragging(false);

      const target = event.currentTarget;
      const { pointerId } = event;
      const startPosition =
        orientation === "horizontal" ? event.clientY : event.clientX;
      const session: PointerSession = {
        moved: false,
        pointerId,
        startPosition,
      };
      pointerSessionRef.current = session;
      suppressClickRef.current = false;

      target.setPointerCapture?.(pointerId);

      const handleMove = (moveEvent: PointerEvent) => {
        if (
          pointerSessionRef.current !== session ||
          moveEvent.pointerId !== pointerId
        ) {
          return;
        }

        const currentPosition =
          orientation === "horizontal" ? moveEvent.clientY : moveEvent.clientX;
        const delta = currentPosition - session.startPosition;

        if (Math.abs(delta) > POINTER_DRAG_THRESHOLD) {
          if (!session.moved) {
            session.moved = true;
            setIsDragging(true);
            onDragStart?.();
          }
          onDrag?.(delta);
        }
      };
      const finish = (cancelled = false) => {
        if (pointerSessionRef.current !== session) {
          return;
        }
        suppressClickRef.current = session.moved;
        setIsDragging(false);
        if (cancelled) {
          onDragCancel?.();
        } else if (session.moved) {
          onDragEnd?.();
        }
        cleanupPointerSession();
      };
      const handleBlur = () => {
        finish(true);
      };
      const handleUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) {
          return;
        }
        finish(false);
      };
      const handleCancel = (cancelEvent: PointerEvent) => {
        if (cancelEvent.pointerId !== pointerId) {
          return;
        }
        finish(true);
      };
      const handleLostPointerCapture = (lostEvent: PointerEvent) => {
        if (lostEvent.pointerId !== pointerId) {
          return;
        }
        finish(true);
      };
      const cleanup = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleCancel);
        window.removeEventListener("blur", handleBlur);
        target.removeEventListener(
          "lostpointercapture",
          handleLostPointerCapture
        );
        if (target.hasPointerCapture?.(pointerId)) {
          target.releasePointerCapture?.(pointerId);
        }
        if (cleanupRef.current === cleanup) {
          cleanupRef.current = null;
        }
        pointerSessionRef.current = null;
      };

      cleanupRef.current = cleanup;
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleCancel);
      window.addEventListener("blur", handleBlur);
      target.addEventListener("lostpointercapture", handleLostPointerCapture);
    };
    const handleClick = () => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      onToggle();
    };
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      onToggle();
    };

    return (
      <div
        ref={forwardedRef}
        {...expandedAriaProps}
        aria-labelledby={labelId}
        aria-orientation={orientation}
        aria-valuemax={max}
        aria-valuemin={expanded ? min : 0}
        aria-valuenow={expanded ? value : 0}
        className={cn(
          RESIZE_RAIL_CLASS,
          "relative z-20 shrink-0 cursor-pointer touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          orientation === "horizontal"
            ? "h-3 w-full active:cursor-row-resize"
            : "h-full w-3 active:cursor-col-resize",
          isDragging &&
            (orientation === "horizontal"
              ? "cursor-row-resize"
              : "cursor-col-resize"),
          className,
          "mx-0"
        )}
        data-state={expanded ? "expanded" : "collapsed"}
        data-testid={dataTestId}
        data-resize-state={isDragging ? "dragging" : "idle"}
        data-slot="splitter-rail"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        role="separator"
        tabIndex={0}
      >
        <span id={labelId} className="sr-only">
          {label}
        </span>
        <span
          aria-hidden="true"
          data-testid={hitAreaTestId}
          className={cn(
            "absolute z-10 cursor-pointer touch-none select-none",
            orientation === "horizontal"
              ? "inset-x-0 -inset-y-3 active:cursor-row-resize"
              : "inset-y-0 -inset-x-3 active:cursor-col-resize",
            !expanded &&
              (orientation === "horizontal" ? "inset-y-0" : "inset-x-0"),
            isDragging &&
              (orientation === "horizontal"
                ? "cursor-row-resize"
                : "cursor-col-resize")
          )}
        />
        <span
          aria-hidden="true"
          data-slot="splitter-rail-grip"
          className={cn(
            RESIZE_GRIP_CLASS,
            "z-10 shrink-0",
            orientation === "horizontal" ? "h-1 w-12" : "h-12 w-1"
          )}
        />
      </div>
    );
  }
);
SplitterRail.displayName = "SplitterRail";
