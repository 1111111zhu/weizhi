"use client";
// Beui.dev/components/motion/action-swap

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { HTMLMotionProps, Variants } from "motion/react";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import { EASE_OUT_CSS, SPRING_PRESS } from "./lib/ease";
import { cn } from "./utils";

export type ActionSwapItem = {
  ariaLabel?: string;
  icon?: ReactNode;
  id: string;
  label: ReactNode;
};

export interface ActionSwapButtonProps extends Omit<
  HTMLMotionProps<"button">,
  "children" | "onChange"
> {
  cycle?: boolean;
  defaultValue?: string;
  items: ActionSwapItem[];
  onValueChange?: (value: string, item: ActionSwapItem) => void;
  value?: string;
}

const BLUR_TRANSITION = { duration: 0.2, ease: "easeInOut" } as const;
const SWAP_BLUR = "blur(8px)";
const TEXT_VARIANTS: Variants = {
  initial: { opacity: 0, scale: 0.94, filter: SWAP_BLUR },
  animate: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: BLUR_TRANSITION,
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    filter: SWAP_BLUR,
    transition: BLUR_TRANSITION,
  },
};

function useActionSwapReducedMotion() {
  const reduce = useReducedMotion();
  return useSyncExternalStore(
    () => () => {},
    () => reduce === true,
    () => false
  );
}

function ActionSwapText({
  children,
  value,
}: {
  children: ReactNode;
  value: string;
}) {
  const reduce = useActionSwapReducedMotion();
  const measureRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number>();

  useLayoutEffect(() => {
    const measure = measureRef.current;
    if (!measure) {
      return;
    }
    const syncWidth = () => {
      const nextWidth = measure.offsetWidth;
      if (!nextWidth) {
        return;
      }
      setWidth((currentWidth) =>
        currentWidth === nextWidth ? currentWidth : nextWidth
      );
    };
    syncWidth();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(syncWidth);
    observer.observe(measure);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      className="pw-action-swap-text relative inline-flex h-6 items-center justify-center overflow-hidden align-middle whitespace-nowrap"
      style={{
        width,
        transition: reduce ? undefined : `width 220ms ${EASE_OUT_CSS}`,
      }}
    >
      <span
        ref={measureRef}
        aria-hidden
        className="pw-action-swap-measure invisible inline-flex items-center whitespace-nowrap"
      >
        {children}
      </span>
      <AnimatePresence initial={false}>
        <motion.span
          aria-hidden
          key={`blur-${value}`}
          variants={TEXT_VARIANTS}
          initial={reduce ? false : "initial"}
          animate={
            reduce ? { opacity: 1, filter: "blur(0px)", scale: 1 } : "animate"
          }
          exit={reduce ? undefined : "exit"}
          className="pw-action-swap-value absolute inset-0 inline-flex items-center justify-center will-change-[opacity,filter,transform]"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function ActionSwapButton({
  items,
  value,
  defaultValue,
  onValueChange,
  cycle = true,
  className,
  disabled,
  onClick,
  tabIndex,
  ...rest
}: ActionSwapButtonProps) {
  const reduce = useActionSwapReducedMotion();
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? items[0]?.id
  );
  const currentValue = value ?? internalValue;
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === currentValue)
  );
  const activeItem = items[activeIndex] ?? items[0];
  const nextItem =
    cycle && items.length > 0
      ? items[(activeIndex + 1) % items.length]
      : undefined;

  if (!activeItem) {
    return null;
  }

  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileTap={reduce || disabled ? undefined : { scale: 0.97 }}
      transition={SPRING_PRESS}
      className={cn(
        "pw-action-swap inline-flex h-12 items-center justify-center overflow-hidden rounded-full bg-primary px-5 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      aria-label={
        activeItem.ariaLabel ??
        (typeof activeItem.label === "string" ? activeItem.label : undefined)
      }
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled || !cycle || !nextItem) {
          return;
        }
        if (value === undefined) {
          setInternalValue(nextItem.id);
        }
        onValueChange?.(nextItem.id, nextItem);
      }}
      {...rest}
      tabIndex={tabIndex ?? 0}
    >
      <ActionSwapText value={activeItem.id}>{activeItem.label}</ActionSwapText>
    </motion.button>
  );
}
