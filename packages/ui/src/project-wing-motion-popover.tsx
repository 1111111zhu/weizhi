"use client";

import { animate, useMotionValue, useReducedMotion } from "motion/react";
import type { MotionValue } from "motion/react";
import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MutableRefObject, ReactElement, ReactNode, Ref } from "react";

import type {
  ProjectWingMotionPopoverAlign,
  ProjectWingMotionPopoverSide,
} from "./project-wing-motion-popover-geometry";

const GOO_OPEN_SPRING = {
  type: "spring",
  visualDuration: 0.3,
  bounce: 0.15,
} as const;
const GOO_CLOSE_SPRING = {
  type: "spring",
  visualDuration: 0.21,
  bounce: 0.15,
} as const;
const HOVER_CLOSE_DELAY = 120;

type ProjectWingMotionPopoverTriggerMode = "click" | "hover";

export interface ProjectWingMotionPopoverContextValue {
  open: boolean;
  present: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  openHover: () => void;
  scheduleClose: () => void;
  triggerMode: ProjectWingMotionPopoverTriggerMode;
  side: ProjectWingMotionPopoverSide;
  align: ProjectWingMotionPopoverAlign;
  gap: number;
  panelRadius: number;
  gooStrength: number;
  reduce: boolean;
  gooId: string;
  contentId: string;
  progress: MotionValue<number>;
  triggerRef: MutableRefObject<HTMLElement | null>;
  contentRef: MutableRefObject<HTMLDivElement | null>;
}

export const ProjectWingMotionPopoverContext =
  createContext<ProjectWingMotionPopoverContextValue | null>(null);

export function useProjectWingMotionPopoverContext(component: string) {
  const context = useContext(ProjectWingMotionPopoverContext);
  if (!context) {
    throw new Error(
      `${component} must be used within <ProjectWingTopBarMotionPopover>`
    );
  }
  return context;
}

export interface ProjectWingTopBarMotionPopoverProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ProjectWingMotionPopoverTriggerMode;
  side?: ProjectWingMotionPopoverSide;
  align?: ProjectWingMotionPopoverAlign;
  sideOffset?: number;
  panelRadius?: number;
  gooStrength?: number;
  className?: string;
}

function cn(...values: (string | false | null | undefined)[]) {
  return values.filter(Boolean).join(" ");
}

export function ProjectWingTopBarMotionPopover({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  trigger = "click",
  side = "bottom",
  align = "center",
  sideOffset = 14,
  panelRadius = 16,
  gooStrength = 8,
  className,
}: ProjectWingTopBarMotionPopoverProps) {
  const reduce = useReducedMotion() ?? false;
  const gooId = useId().replaceAll(":", "");
  const contentId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationSequence = useRef(0);
  const openRef = useRef(defaultOpen);
  const progress = useMotionValue(defaultOpen ? 1 : 0);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [contentMounted, setContentMounted] = useState(defaultOpen);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;
  const present = open || contentMounted;
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const setOpen = useCallback(
    (next: boolean) => {
      if (openRef.current === next) {
        return;
      }
      openRef.current = next;
      if (!controlled) {
        setInternalOpen(next);
      }
      onOpenChange?.(next);
    },
    [controlled, onOpenChange]
  );
  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  const openHover = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose, setOpen]);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setOpen(false);
    }, HOVER_CLOSE_DELAY);
  }, [cancelClose, setOpen]);
  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  useEffect(() => () => cancelClose(), [cancelClose]);
  useEffect(() => {
    const sequence = animationSequence.current + 1;
    animationSequence.current = sequence;
    if (open) {
      setContentMounted(true);
    }
    const animation = animate(
      progress,
      open ? 1 : 0,
      reduce ? { duration: 0 } : open ? GOO_OPEN_SPRING : GOO_CLOSE_SPRING
    );
    if (!open) {
      void animation.then(() => {
        if (animationSequence.current === sequence && !openRef.current) {
          setContentMounted(false);
        }
      });
    }
    return () => animation.stop();
  }, [open, progress, reduce]);
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        !contentRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    if (trigger === "click") {
      window.addEventListener("pointerdown", onPointer);
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open, setOpen, trigger]);

  const context = useMemo<ProjectWingMotionPopoverContextValue>(
    () => ({
      open,
      present,
      setOpen,
      toggle,
      openHover,
      scheduleClose,
      triggerMode: trigger,
      side,
      align,
      gap: sideOffset,
      panelRadius,
      gooStrength,
      reduce,
      gooId,
      contentId,
      progress,
      triggerRef,
      contentRef,
    }),
    [
      align,
      contentId,
      gooId,
      gooStrength,
      open,
      openHover,
      panelRadius,
      present,
      progress,
      reduce,
      scheduleClose,
      setOpen,
      side,
      sideOffset,
      toggle,
      trigger,
    ]
  );
  const hoverHandlers =
    trigger === "hover"
      ? {
          onMouseEnter: openHover,
          onMouseLeave: scheduleClose,
          onPointerEnter: openHover,
          onPointerLeave: scheduleClose,
        }
      : {};

  return (
    <ProjectWingMotionPopoverContext.Provider value={context}>
      <div
        ref={rootRef}
        className={cn("relative inline-flex isolate", className)}
        {...hoverHandlers}
      >
        {children}
      </div>
    </ProjectWingMotionPopoverContext.Provider>
  );
}

function mergeRefs<T>(...refs: (Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref && typeof ref === "object") {
        (ref as MutableRefObject<T | null>).current = node;
      }
    }
  };
}

export interface ProjectWingTopBarMotionPopoverTriggerProps {
  children: ReactElement;
}

export function ProjectWingTopBarMotionPopoverTrigger({
  children,
}: ProjectWingTopBarMotionPopoverTriggerProps) {
  const context = useProjectWingMotionPopoverContext(
    "ProjectWingTopBarMotionPopoverTrigger"
  );
  if (!isValidElement(children)) {
    return children;
  }

  const child = children as ReactElement<Record<string, unknown>>;
  const childProps = child.props;
  const childRef = (childProps as { ref?: Ref<HTMLElement> }).ref;
  const compose =
    (name: string, handler: () => void) =>
    (event: { defaultPrevented?: boolean }) => {
      (childProps[name] as ((event: unknown) => void) | undefined)?.(event);
      if (!event.defaultPrevented) {
        handler();
      }
    };
  const handlers: Record<string, unknown> =
    context.triggerMode === "hover"
      ? {
          onFocus: compose("onFocus", context.openHover),
          onBlur: compose("onBlur", context.scheduleClose),
        }
      : { onClick: compose("onClick", context.toggle) };

  return cloneElement(child, {
    ...handlers,
    ref: mergeRefs(childRef, (node: HTMLElement | null) => {
      context.triggerRef.current = node;
    }),
    className: cn("relative z-0", childProps.className as string | undefined),
    "aria-haspopup": "dialog",
    "aria-expanded": context.open,
    "aria-controls": context.open ? context.contentId : undefined,
    "data-state": context.open ? "open" : "closed",
  });
}
