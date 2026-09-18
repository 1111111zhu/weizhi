"use client";

import { AnimatePresence, motion } from "motion/react";

import { EASE_OUT } from "./lib/ease";
import type { OtpStatus } from "./otp-input";
import { cn } from "./utils";

export function OtpSlot({
  active,
  character,
  disabled,
  mask,
  reduce,
  status,
}: {
  active: boolean;
  character: string;
  disabled: boolean;
  mask: boolean;
  reduce: boolean | null;
  status: OtpStatus;
}) {
  const success = status === "success";
  return (
    <div
      data-active={active}
      data-filled={character !== ""}
      data-status={status}
      className={cn(
        "pw-otp-input-slot relative grid h-14 w-12 place-items-center overflow-hidden rounded-xl border text-xl font-semibold tabular-nums transition-colors duration-200",
        success
          ? "border-emerald-500/60 text-foreground"
          : status === "error"
            ? "border-destructive/60 text-foreground"
            : character
              ? "border-border-strong text-foreground"
              : "border-border text-muted-foreground",
        active && !success && status !== "error" && "border-foreground",
        disabled && "opacity-50"
      )}
    >
      {active && !success ? (
        <motion.span
          aria-hidden
          animate={reduce ? undefined : { opacity: [1, 1, 0, 0] }}
          transition={
            reduce
              ? undefined
              : {
                  duration: 1,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                }
          }
          className={cn(
            "pw-otp-input-caret pointer-events-none absolute top-1/2 h-6 w-px -translate-y-1/2 bg-foreground",
            character ? "right-3" : "left-1/2 -translate-x-1/2"
          )}
        />
      ) : null}
      <AnimatePresence initial={false}>
        {character ? (
          <motion.span
            key={character}
            initial={
              reduce
                ? { opacity: 0 }
                : { y: 14, opacity: 0, filter: "blur(4px)" }
            }
            animate={
              reduce
                ? { opacity: 1 }
                : { y: 0, opacity: 1, filter: "blur(0px)" }
            }
            exit={
              reduce
                ? { opacity: 0 }
                : { y: -14, opacity: 0, filter: "blur(4px)" }
            }
            transition={
              reduce ? { duration: 0 } : { duration: 0.22, ease: EASE_OUT }
            }
            className="pw-otp-input-character absolute inset-0 grid place-items-center leading-none"
          >
            {mask ? "•" : character}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
