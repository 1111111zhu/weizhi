"use client";

import * as React from "react";
import * as ResizablePrimitive from "react-resizable-panels";

import {
  RESIZE_GRIP_CLASS,
  RESIZE_RAIL_CLASS,
} from "@/components/resize-handle";
import { cn } from "@/lib/utils";

function ResizablePanelGroup({
  className,
  disableCursor = true,
  ...props
}: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full aria-[orientation=vertical]:flex-col",
        className
      )}
      disableCursor={disableCursor}
      {...props}
    />
  );
}

function ResizablePanel({ onResize, ...props }: ResizablePrimitive.PanelProps) {
  type ResizeArgs = Parameters<NonNullable<ResizablePrimitive.PanelProps["onResize"]>>;
  const pendingResize = React.useRef<ResizeArgs | null>(null);
  const frame = React.useRef<number | null>(null);
  const resizeCallback = React.useRef(onResize);
  resizeCallback.current = onResize;

  React.useEffect(() => () => {
    if (frame.current !== null) {
      window.cancelAnimationFrame(frame.current);
    }
  }, []);

  const flushResize = () => {
    frame.current = null;
    const args = pendingResize.current;
    if (!args) {
      return;
    }
    const element = document.getElementById(String(args[1]));
    const transitioning = element?.getAnimations?.().some((animation) =>
      animation.playState === "running" &&
      "transitionProperty" in animation &&
      (animation.transitionProperty === "flex-grow" ||
        animation.transitionProperty === "flex-basis")
    );
    if (transitioning) {
      frame.current = window.requestAnimationFrame(flushResize);
      return;
    }
    pendingResize.current = null;
    resizeCallback.current?.(...args);
  };

  return (
    <ResizablePrimitive.Panel
      data-slot="resizable-panel"
      {...props}
      onResize={onResize ? (...args) => {
        // ResizeObserver sees animation frames too. Only settled sizes may
        // update the remembered expanded size or the collapsed state.
        pendingResize.current = args;
        if (frame.current === null) {
          flushResize();
        }
      } : undefined}
    />
  );
}

function ResizableHandle({
  withHandle,
  children,
  className,
  label,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  label?: React.ReactNode;
  withHandle?: boolean;
}) {
  const labelId = React.useId();

  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      aria-labelledby={label ? labelId : undefined}
      className={cn(
        RESIZE_RAIL_CLASS,
        "relative z-20 h-full w-2 shrink-0 cursor-pointer touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[orientation=horizontal]:h-2 aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:active:cursor-row-resize [&[aria-orientation=horizontal]>[data-slot=resizable-grip]]:rotate-90 [&[aria-orientation=horizontal]>[data-slot=resizable-hit-area]]:inset-x-0 [&[aria-orientation=horizontal]>[data-slot=resizable-hit-area]]:-inset-y-3 [&[aria-orientation=horizontal]>[data-slot=resizable-hit-area]]:active:cursor-row-resize",
        className
      )}
      {...props}
    >
      {label ? (
        <span id={labelId} className="sr-only">
          {label}
        </span>
      ) : null}
      <span
        data-slot="resizable-hit-area"
        aria-hidden="true"
        className="absolute -inset-x-3 inset-y-0 z-10 cursor-pointer touch-none select-none active:cursor-col-resize"
      />
      {withHandle && (
        <span
          data-slot="resizable-grip"
          aria-hidden="true"
          className={cn(RESIZE_GRIP_CLASS, "z-10 h-12 w-1 shrink-0")}
        />
      )}
      {children}
    </ResizablePrimitive.Separator>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
