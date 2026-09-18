"use client";

import type { ComponentProps } from "react";

import { cn } from "./utils";

/** Native color inputs start with the standard sRGB black value, not a brand color. */
export const DEFAULT_COLOR_INPUT_VALUE = "#000000";

export type ColorInputProps = Omit<
  ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "readOnly"
> & { value: string; onValueChange: (value: string) => void };
export function ColorInput({
  value,
  onValueChange,
  disabled,
  className,
  ...props
}: ColorInputProps) {
  return (
    <input
      {...props}
      type="color"
      value={value}
      disabled={disabled}
      onChange={(event) => {
        if (!disabled) {
          onValueChange(event.target.value);
        }
      }}
      data-slot="color-input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-background p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:h-9",
        className
      )}
    />
  );
}
