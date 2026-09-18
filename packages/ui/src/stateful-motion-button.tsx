"use client";
// Adapted from the official @beui/button-stateful registry source.

import { CircleCheck, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { MotionButton } from "./motion-button";
import type { MotionButtonProps } from "./motion-button";
import { Skeleton } from "./skeleton";

export type MotionButtonState = "idle" | "loading" | "success" | "error";

export interface StatefulMotionButtonProps extends Omit<
  MotionButtonProps,
  "children"
> {
  children: ReactNode;
  errorText?: ReactNode;
  icon?: ReactNode;
  loadingText?: ReactNode;
  state?: MotionButtonState;
  successIcon?: ReactNode;
  successText?: ReactNode;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const DEFAULT_SUCCESS_ICON = <CircleCheck className="text-success h-4 w-4" />;
const SPRING_SWAP = {
  type: "spring",
  stiffness: 460,
  damping: 30,
  mass: 0.55,
} as const;
const CASCADE_STAGGER = 0.025;
const ROLL_BLUR = "blur(6px)";
const LETTER_VARIANTS: Variants = {
  initial: { opacity: 0, y: "105%", filter: ROLL_BLUR },
  animate: (delay = 0) => ({
    opacity: 1,
    y: "0%",
    filter: "blur(0px)",
    transition: { ...SPRING_SWAP, delay },
  }),
  exit: (delay = 0) => ({
    opacity: 0,
    y: "-105%",
    filter: ROLL_BLUR,
    transition: { duration: 0.16, ease: EASE_OUT, delay: delay * 0.5 },
  }),
};
const ICON_VARIANTS: Variants = {
  initial: { opacity: 0, width: 0, scale: 0.7, filter: ROLL_BLUR },
  animate: (width = "1.5rem") => ({
    opacity: 1,
    width,
    scale: 1,
    filter: "blur(0px)",
    transition: SPRING_SWAP,
  }),
  exit: {
    opacity: 0,
    width: 0,
    scale: 0.7,
    filter: ROLL_BLUR,
    transition: { duration: 0.16, ease: EASE_OUT },
  },
};

function IconSlot({
  children,
  keyId,
  width,
}: {
  children: ReactNode;
  keyId: string;
  width: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      key={keyId}
      custom={width}
      variants={ICON_VARIANTS}
      initial={reduce ? { opacity: 0 } : "initial"}
      animate={reduce ? { opacity: 1, width } : "animate"}
      exit={reduce ? { opacity: 0, width: 0 } : "exit"}
      transition={reduce ? { duration: 0.15 } : undefined}
      className="inline-grid h-4 shrink-0 translate-y-px place-items-center overflow-hidden"
    >
      {children}
    </motion.span>
  );
}

function TextSlot({
  cascade = true,
  children,
  value,
}: {
  cascade?: boolean;
  children: ReactNode;
  value: string;
}) {
  const reduce = useReducedMotion();
  const measureRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number>();
  const label = typeof children === "string" ? children : null;
  const shouldCascade = cascade && label !== null && !reduce;

  useLayoutEffect(() => {
    const measuredWidth = measureRef.current?.getBoundingClientRect().width;
    const nextWidth = measuredWidth ? Math.ceil(measuredWidth) : 0;
    if (!nextWidth) {
      return;
    }
    setWidth((current) => (current === nextWidth ? current : nextWidth));
  }, [value]);

  return (
    <motion.span
      initial={false}
      animate={{ width }}
      transition={reduce ? { duration: 0 } : SPRING_SWAP}
      className="relative inline-grid h-4 place-items-center overflow-hidden whitespace-nowrap"
    >
      <span
        ref={measureRef}
        aria-hidden
        className="invisible inline-flex h-4 items-center whitespace-nowrap"
      >
        {shouldCascade
          ? [...label].map((character, index) => (
              <span
                key={`${character}-${index}`}
                className="inline-block whitespace-pre"
              >
                {character}
              </span>
            ))
          : children}
      </span>
      {shouldCascade ? (
        <>
          <span className="sr-only">{label}</span>
          <AnimatePresence initial={false}>
            <motion.span
              key={`cascade-${value}`}
              aria-hidden
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-y-0 left-0 inline-flex items-center whitespace-pre"
            >
              {[...label].map((character, index) => (
                <motion.span
                  key={`${character}-${index}`}
                  custom={index * CASCADE_STAGGER}
                  variants={LETTER_VARIANTS}
                  className="inline-block whitespace-pre will-change-[opacity,filter,transform]"
                >
                  {character}
                </motion.span>
              ))}
            </motion.span>
          </AnimatePresence>
        </>
      ) : (
        <AnimatePresence initial={false}>
          <motion.span
            key={`text-${value}`}
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, y: 14, filter: ROLL_BLUR }
            }
            animate={
              reduce
                ? { opacity: 1 }
                : { opacity: 1, y: 0, filter: "blur(0px)" }
            }
            exit={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, y: -14, filter: ROLL_BLUR }
            }
            transition={reduce ? { duration: 0.15 } : SPRING_SWAP}
            className="absolute inset-y-0 left-0 inline-flex items-center will-change-[opacity,filter,transform]"
          >
            {children}
          </motion.span>
        </AnimatePresence>
      )}
    </motion.span>
  );
}

export const StatefulMotionButton = forwardRef<
  HTMLButtonElement,
  StatefulMotionButtonProps
>(
  (
    {
      state = "idle",
      children,
      loadingText = "Loading",
      successText = "Done",
      successIcon = DEFAULT_SUCCESS_ICON,
      errorText = "Try again",
      icon,
      disabled,
      size,
      ...rest
    },
    ref
  ) => {
    const isBusy = state === "loading";
    const text =
      state === "loading"
        ? loadingText
        : state === "success"
          ? successText
          : state === "error"
            ? errorText
            : children;
    const textKey = typeof text === "string" ? `${state}-${text}` : state;
    const iconSlotWidth = size === "sm" ? "1.25rem" : "1.5rem";
    return (
      <MotionButton
        ref={ref}
        size={size}
        disabled={disabled || isBusy}
        aria-busy={isBusy}
        data-stateful-motion-button="true"
        whileHover={undefined}
        {...rest}
      >
        <span
          aria-live="polite"
          className="relative inline-flex items-center justify-center overflow-hidden leading-4"
        >
          <AnimatePresence initial={false}>
            {state === "loading" ? (
              <IconSlot keyId="loading-icon" width={iconSlotWidth}>
                <Skeleton className="h-4 w-4 rounded-full" />
              </IconSlot>
            ) : null}
            {state === "success" ? (
              <IconSlot keyId="success-icon" width={iconSlotWidth}>
                {successIcon}
              </IconSlot>
            ) : null}
            {state === "error" ? (
              <IconSlot keyId="error-icon" width={iconSlotWidth}>
                <X className="h-4 w-4" />
              </IconSlot>
            ) : null}
          </AnimatePresence>
          <TextSlot value={textKey} cascade={state !== "error"}>
            {text}
          </TextSlot>
          <AnimatePresence initial={false}>
            {state === "idle" && icon ? (
              <IconSlot keyId="idle-icon" width={iconSlotWidth}>
                {icon}
              </IconSlot>
            ) : null}
          </AnimatePresence>
        </span>
      </MotionButton>
    );
  }
);

StatefulMotionButton.displayName = "StatefulMotionButton";
