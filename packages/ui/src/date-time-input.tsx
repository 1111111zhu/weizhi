"use client";

import type { ComponentProps } from "react";

import { Input } from "./input";

export type DateTimeInputProps = Omit<
  ComponentProps<typeof Input>,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  mode?: "date" | "time" | "date-time";
  /** Native local date/time string. No timezone or Date conversion is performed. */
  value: string;
  onValueChange: (value: string) => void;
};
export function DateTimeInput({
  mode = "date",
  value,
  onValueChange,
  disabled,
  readOnly,
  ...props
}: DateTimeInputProps) {
  return (
    <Input
      {...props}
      disabled={disabled}
      readOnly={readOnly}
      type={mode === "date-time" ? "datetime-local" : mode}
      value={value}
      onChange={(event) => {
        if (!disabled && !readOnly) {
          onValueChange(event.target.value);
        }
      }}
    />
  );
}
