"use client";
// Beui.dev/components/motion/button

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { HTMLMotionProps } from "motion/react";
import { forwardRef, useCallback, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";

import { useHoverCapable } from "./hooks/use-hover-capable";
import { EASE_OUT, SPRING_PRESS } from "./lib/ease";
import { cn } from "./utils";

export type MotionButtonVariant = "primary" | "secondary" | "ghost" | "outline";
export type MotionButtonSize = "sm" | "md" | "lg" | "icon";

export interface MotionButtonProps extends Omit<
  HTMLMotionProps<"button">,
  "children"
> {
  children?: ReactNode;
  pressScale?: number;
  ripple?: boolean;
  size?: MotionButtonSize;
  variant?: MotionButtonVariant;
}

type Ripple = { id: number; x: number; y: number; size: number };

const VARIANT_CLASS: Record<MotionButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "border border-border bg-card text-foreground hover:border-border",
  ghost: "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-primary/5",
};
const SIZE_CLASS: Record<MotionButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-full px-3 text-xs",
  md: "h-10 gap-2 rounded-full px-5 text-sm",
  lg: "h-12 gap-2 rounded-full px-6 text-base",
  icon: "h-8 w-8 rounded-lg",
};

export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      pressScale = 0.93,
      ripple = false,
      className,
      children,
      onPointerDown,
      tabIndex,
      ...rest
    },
    ref
  ) => {
    const reduce = useReducedMotion();
    const canHover = useHoverCapable();
    const [ripples, setRipples] = useState<Ripple[]>([]);
    const nextId = useRef(0);
    const handlePointerDown = useCallback(
      (event: PointerEvent<HTMLButtonElement>) => {
        if (ripple && !reduce) {
          const rect = event.currentTarget.getBoundingClientRect();
          const rippleSize = Math.max(rect.width, rect.height) * 2;
          const id = nextId.current;
          nextId.current += 1;
          setRipples((previous) => [
            ...previous,
            {
              id,
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              size: rippleSize,
            },
          ]);
        }
        onPointerDown?.(event);
      },
      [onPointerDown, reduce, ripple]
    );

    return (
      <motion.button
        ref={ref}
        type="button"
        whileTap={reduce ? undefined : { scale: pressScale }}
        whileHover={reduce || !canHover ? undefined : { scale: 1.02 }}
        transition={SPRING_PRESS}
        onPointerDown={handlePointerDown}
        data-size={size}
        data-variant={variant}
        className={cn(
          "pw-motion-button inline-flex items-center justify-center font-medium select-none",
          "transition-colors",
          "disabled:pointer-events-none disabled:opacity-50",
          ripple && "relative overflow-hidden",
          VARIANT_CLASS[variant],
          SIZE_CLASS[size],
          className
        )}
        {...rest}
        tabIndex={tabIndex ?? 0}
      >
        {ripple && !reduce ? (
          <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <AnimatePresence>
              {ripples.map((rippleState) => (
                <motion.span
                  key={rippleState.id}
                  className="absolute rounded-full bg-current"
                  style={{
                    left: rippleState.x,
                    top: rippleState.y,
                    width: rippleState.size,
                    height: rippleState.size,
                    x: "-50%",
                    y: "-50%",
                  }}
                  initial={{ scale: 0.05, opacity: 0.3 }}
                  animate={{ scale: 1, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.6, ease: EASE_OUT }}
                  onAnimationComplete={() =>
                    setRipples((previous) =>
                      previous.filter((item) => item.id !== rippleState.id)
                    )
                  }
                />
              ))}
            </AnimatePresence>
          </span>
        ) : null}
        {children}
      </motion.button>
    );
  }
);

MotionButton.displayName = "MotionButton";
