"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

type HoursInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "onBlur" | "onChange" | "onFocus" | "type" | "value"
> & {
  max?: number;
  value: number;
  onChange: (value: string) => void;
};

export function HoursInput({
  max = 24,
  onChange,
  value,
  ...props
}: HoursInputProps) {
  const [draft, setDraft] = useState(() => formatHours(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(formatHours(value));
    }
  }, [value]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = event.currentTarget.value;
    setDraft(nextValue);
    if (nextValue === "" || parseHours(nextValue) !== null) {
      onChange(nextValue);
    }
  }

  function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
    focusedRef.current = true;
    setDraft(formatHours(value));
    event.currentTarget.select();
  }

  function handleBlur() {
    focusedRef.current = false;
    const parsed = parseHours(draft, max);
    if (parsed === null) {
      setDraft(formatHours(value));
      return;
    }
    onChange(String(parsed));
    setDraft(formatHours(parsed));
  }

  return (
    <Input
      {...props}
      autoComplete="off"
      inputMode="decimal"
      max={max}
      type="text"
      value={draft}
      onBlur={handleBlur}
      onChange={handleChange}
      onFocus={handleFocus}
    />
  );
}

function parseHours(value: string, max = 24) {
  if (!value.trim()) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= max
    ? parsed
    : null;
}

function formatHours(value: number) {
  if (value === 0) {
    return "0";
  }
  if (Number.isInteger(value * 10)) {
    return value.toFixed(1);
  }
  return value.toFixed(2).replace(/0$/, "");
}
