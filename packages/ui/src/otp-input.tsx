"use client";
// Beui.dev/components/blocks/otp-input

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import type {
  ChangeEvent,
  ClipboardEvent,
  KeyboardEvent,
  MouseEvent,
} from "react";

import { EASE_OUT } from "./lib/ease";
import { OtpSlot } from "./otp-input-parts";
import { cn } from "./utils";

export type OtpStatus = "idle" | "error" | "success";

export interface OtpInputProps {
  "aria-label"?: string;
  autoFocus?: boolean;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  errorMessage?: string;
  hint?: string;
  id?: string;
  label?: string;
  length?: number;
  mask?: boolean;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  status?: OtpStatus;
  successMessage?: string;
  value?: string;
}

export function OtpInput({
  length = 6,
  value: controlledValue,
  defaultValue = "",
  onChange,
  onComplete,
  label,
  hint,
  successMessage,
  errorMessage,
  status = "idle",
  mask = false,
  disabled = false,
  autoFocus = false,
  id,
  "aria-label": ariaLabel = "One-time passcode",
  className,
}: OtpInputProps) {
  const uid = useId();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);
  const controlled = controlledValue !== undefined;
  const [slots, setSlots] = useState<string[]>(() =>
    toSlots(controlled ? controlledValue : defaultValue, length)
  );
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const joined = slots.join("");
  const joinedRef = useRef(joined);
  const inputId = id ?? `${uid}-input`;

  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  useEffect(() => {
    if (!controlled) {
      return;
    }
    const incoming = sanitize(controlledValue, length);
    if (incoming !== joinedRef.current) {
      setSlots(toSlots(incoming, length));
    }
  }, [controlled, controlledValue, length]);

  useEffect(() => {
    if (!autoFocus || disabled) {
      return;
    }
    inputRef.current?.focus();
  }, [autoFocus, disabled]);

  useEffect(() => {
    if (status !== "error" || reduce || !slotsRef.current) {
      return;
    }
    animate(
      slotsRef.current,
      { x: [0, -5, 5, -3, 3, -1, 0] },
      { duration: 0.45, ease: EASE_OUT }
    );
  }, [status, reduce]);

  const commit = (next: string[]) => {
    const wasComplete = slots.every((character) => character !== "");
    setSlots(next);
    const nextValue = next.join("");
    onChange?.(nextValue);
    if (!wasComplete && next.every((character) => character !== "")) {
      onComplete?.(nextValue);
    }
  };
  const clearSlot = (index: number) => {
    const next = [...slots];
    next[index] = "";
    commit(next);
  };
  const insert = (raw: string, from = active) => {
    const digits = raw.replaceAll(/\D/g, "");
    if (!digits) {
      return;
    }
    const next = [...slots];
    let index = from;
    for (const digit of digits) {
      if (index >= length) {
        break;
      }
      next[index] = digit;
      index += 1;
    }
    commit(next);
    setActive(Math.min(index, length - 1));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      insert(event.key);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      if (slots[active]) {
        clearSlot(active);
      } else if (active > 0) {
        clearSlot(active - 1);
        setActive((current) => Math.max(current - 1, 0));
      }
    } else if (event.key === "Delete") {
      event.preventDefault();
      clearSlot(active);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, length - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(length - 1);
    }
  };
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }
    event.preventDefault();
    insert(event.clipboardData.getData("text"), active);
  };
  const onNativeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = sanitize(event.target.value, length);
    if (!digits) {
      return;
    }
    commit(toSlots(digits, length));
    setActive(Math.min(digits.length, length - 1));
  };
  const slotFromClientX = (clientX: number) => {
    const elements = slotsRef.current?.children;
    if (!elements) {
      return 0;
    }
    for (let index = 0; index < elements.length; index += 1) {
      if (clientX < elements[index].getBoundingClientRect().right) {
        return index;
      }
    }
    return length - 1;
  };
  const onSlotsMouseDown = (event: MouseEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }
    event.preventDefault();
    const firstEmpty = slots.indexOf("");
    const cap = firstEmpty === -1 ? length - 1 : firstEmpty;
    setActive(Math.min(slotFromClientX(event.clientX), cap));
    inputRef.current?.focus();
  };
  const showSuccess = status === "success";
  const activeIndex = focused ? active : -1;
  const message = showSuccess
    ? successMessage
    : status === "error"
      ? errorMessage
      : hint;

  return (
    <div className={cn("pw-otp-input inline-flex flex-col gap-2", className)}>
      {label ? (
        <label
          htmlFor={inputId}
          className="pw-otp-input-label text-foreground text-sm font-medium"
        >
          {label}
        </label>
      ) : null}
      <fieldset className="pw-otp-input-fieldset relative m-0 inline-flex w-max border-0 p-0">
        <input
          ref={inputRef}
          id={inputId}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus={autoFocus}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={status === "error"}
          value=""
          maxLength={length}
          onKeyDown={onKeyDown}
          onMouseDown={onSlotsMouseDown}
          onChange={onNativeChange}
          onPaste={onPaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="pw-otp-input-control absolute inset-0 z-20 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 outline-none disabled:cursor-not-allowed"
        />
        <div
          ref={slotsRef}
          className="pw-otp-input-slots flex items-center gap-2"
        >
          {Array.from({ length }, (_, index) => {
            const character = slots[index] ?? "";
            const isActive = index === activeIndex;
            return (
              <OtpSlot
                active={isActive}
                character={character}
                disabled={disabled}
                key={`${uid}-${index}`}
                mask={mask}
                reduce={reduce}
                status={status}
              />
            );
          })}
        </div>
      </fieldset>
      {message ? (
        <p
          aria-live="polite"
          className={cn(
            "pw-otp-input-message text-sm",
            showSuccess
              ? "text-emerald-500"
              : status === "error"
                ? "text-destructive"
                : "text-muted-foreground"
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

function sanitize(raw: string | undefined, length: number) {
  return (raw ?? "").replaceAll(/\D/g, "").slice(0, length);
}

function toSlots(raw: string | undefined, length: number) {
  const digits = sanitize(raw, length);
  return Array.from({ length }, (_, index) => digits[index] ?? "");
}
