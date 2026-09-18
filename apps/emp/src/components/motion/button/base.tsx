"use client";
// Beui.dev/components/motion/button

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { HTMLMotionProps } from "motion/react";
import { forwardRef, useCallback, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";

import { EASE_OUT, SPRING_PRESS } from "@/lib/ease";
import { useHoverCapable } from "@/lib/hooks/use-hover-capable";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends Omit<
  HTMLMotionProps<"button">,
  "children"
> {
  size?: ButtonSize;
  variant?: ButtonVariant;
  pressScale?: number;
  ripple?: boolean;
  children?: ReactNode;
}

type Ripple = { id: number; x: number; y: number; size: number };

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "border border-border bg-card text-foreground hover:border-border",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-primary/5",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-primary/5",
};
const SIZE_CLASS: Record<ButtonSize, string> = {
  xs: "h-6.5 gap-1 rounded-full px-2 text-[0.7rem]! [&_svg]:size-3",
  sm: "h-8 gap-1.5 rounded-full px-3 text-xs!",
  md: "h-10 px-5 text-sm gap-2 rounded-full",
  lg: "h-12 px-6 text-base gap-2 rounded-full",
  icon: "h-8 w-8 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
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
          const id = nextId.current + 1;
          nextId.current = id;
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
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap font-medium! select-none [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]",
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
Button.displayName = "Button";
