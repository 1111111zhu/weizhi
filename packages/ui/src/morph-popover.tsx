"use client";

// Adapted from the official @beui/popover-morph shadcn registry source.

import { AnimatePresence, useReducedMotion } from "motion/react";
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
import type {
  ReactElement,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
  Ref,
} from "react";
import { createPortal } from "react-dom";

import {
  getMorphPopoverPosition,
  getMorphPopoverVariants,
} from "./morph-popover-motion";
import type {
  MorphPopoverAlign as Align,
  MorphPopoverSide as Side,
} from "./morph-popover-motion";
import { useMorphPopoverPosition } from "./morph-popover-position";
import { MorphPopoverPresence } from "./morph-popover-presence";
import { cn } from "./utils";

type MorphContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  triggerId: string;
  contentId: string;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
};
type MorphPopoverProps = {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};
type MorphPopoverContentProps = {
  children: ReactNode;
  side?: Side;
  align?: Align;
  sideOffset?: number;
  radius?: number;
  className?: string;
};

const MorphContext = createContext<MorphContextValue | null>(null);

function useMorphContext(component: string) {
  const context = useContext(MorphContext);
  if (!context) {
    throw new Error(`${component} must be used within MorphPopover`);
  }
  return context;
}

export function MorphPopover({
  children,
  className,
  ...props
}: MorphPopoverProps) {
  const { rootRef, value } = useMorphPopoverState(props);
  useDismissPopover(rootRef, value);
  return (
    <MorphContext.Provider value={value}>
      <div ref={rootRef} className={cn("relative inline-flex", className)}>
        {children}
      </div>
    </MorphContext.Provider>
  );
}

function useMorphPopoverState({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}: Pick<MorphPopoverProps, "open" | "defaultOpen" | "onOpenChange">) {
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) {
        setInternalOpen(next);
      }
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange]
  );
  const toggle = useCallback(() => {
    if (controlledOpen !== undefined) {
      onOpenChange?.(!controlledOpen);
      return;
    }
    setInternalOpen((current) => {
      const next = !current;
      onOpenChange?.(next);
      return next;
    });
  }, [controlledOpen, onOpenChange]);
  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle,
      triggerId: `${baseId}-trigger`,
      contentId: `${baseId}-content`,
      triggerRef,
      contentRef,
    }),
    [baseId, open, setOpen, toggle]
  );

  return { rootRef, value };
}

function useDismissPopover(
  rootRef: React.RefObject<HTMLDivElement | null>,
  value: MorphContextValue
) {
  useEffect(() => {
    if (!value.open) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        value.setOpen(false);
        value.triggerRef.current?.focus({ preventScroll: true });
      }
    };
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !value.contentRef.current?.contains(target)
      ) {
        value.setOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOutside);
    };
  }, [rootRef, value]);
}

function mergeRefs<T>(...refs: (Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref && typeof ref === "object") {
        ref.current = node;
      }
    }
  };
}

export function MorphPopoverTrigger({ children }: { children: ReactElement }) {
  const context = useMorphContext("MorphPopoverTrigger");
  if (!isValidElement(children)) {
    return children;
  }
  const child = children as ReactElement<Record<string, unknown>>;
  const childOnClick = child.props.onClick as
    | ((event: ReactMouseEvent<HTMLElement>) => void)
    | undefined;
  const childOnPointerDown = child.props.onPointerDown as
    | ((event: ReactPointerEvent<HTMLElement>) => void)
    | undefined;
  const childRef = (child.props as { ref?: Ref<HTMLElement> }).ref;
  return cloneElement(child, {
    id: context.triggerId,
    ref: mergeRefs(childRef, (node: HTMLElement | null) => {
      context.triggerRef.current = node;
    }),
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      childOnPointerDown?.(event);
      if (!event.defaultPrevented && event.button === 0) {
        context.toggle();
      }
    },
    onClick: (event: ReactMouseEvent<HTMLElement>) => {
      childOnClick?.(event);
      if (!event.defaultPrevented && event.detail === 0) {
        context.toggle();
      }
    },
    "aria-haspopup": "dialog",
    "aria-expanded": context.open,
    "aria-controls": context.open ? context.contentId : undefined,
  });
}

export function MorphPopoverContent({
  children,
  side = "bottom",
  align = "end",
  sideOffset = 8,
  radius = 10,
  className,
}: MorphPopoverContentProps) {
  const context = useMorphContext("MorphPopoverContent");
  const reduce = useReducedMotion() ?? false;
  const { layout, portalReady, portalRef } = useMorphContentPosition(context, {
    align,
    side,
    sideOffset,
  });
  if (!portalReady) {
    return null;
  }
  const { clipVariants, wrapperVariants } = getMorphPopoverVariants(
    reduce,
    side,
    align,
    radius
  );
  return createPortal(
    <AnimatePresence>
      {context.open ? (
        <MorphPopoverPresence
          className={className}
          clipVariants={clipVariants}
          contentId={context.contentId}
          contentRef={context.contentRef}
          layoutReady={Boolean(layout)}
          portalRef={portalRef}
          reduce={reduce}
          triggerId={context.triggerId}
          wrapperVariants={wrapperVariants}
        >
          {children}
        </MorphPopoverPresence>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function useMorphContentPosition(
  context: MorphContextValue,
  {
    align,
    side,
    sideOffset,
  }: Required<Pick<MorphPopoverContentProps, "align" | "side" | "sideOffset">>
) {
  const portalRef = useRef<HTMLDivElement>(null);
  const [portalReady, setPortalReady] = useState(false);
  const layout = useMorphPopoverPosition(
    context.triggerRef,
    context.contentRef,
    portalReady && context.open
  );
  useEffect(() => setPortalReady(true), []);
  useEffect(() => {
    if (!(layout && portalRef.current)) {
      return;
    }
    const position = getMorphPopoverPosition(layout, side, align, sideOffset);
    portalRef.current.style.left = `${position.left}px`;
    portalRef.current.style.top = `${position.top}px`;
    portalRef.current.style.transformOrigin = `${side === "bottom" ? "top" : "bottom"} ${align === "end" ? "right" : "left"}`;
  }, [align, layout, side, sideOffset]);
  return { layout, portalReady, portalRef };
}
