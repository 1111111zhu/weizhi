"use client";

import { useState } from "react";
import type { ComponentProps } from "react";

import { cn } from "./utils";

/** File values remain browser-owned; non-empty file values cannot be controlled by React. */
export type FileInputProps = Omit<
  ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "readOnly" | "checked" | "defaultChecked"
>;
export function FileInput({
  className,
  disabled,
  onDragEnter,
  onDragLeave,
  onDrop,
  onChange,
  ...props
}: FileInputProps) {
  const [dragging, setDragging] = useState(false);
  return (
    <input
      {...props}
      type="file"
      disabled={disabled}
      data-slot="file-input"
      data-dragging={dragging || undefined}
      onChange={(event) => {
        if (!disabled) {
          onChange?.(event);
        }
      }}
      onDragEnter={(event) => {
        if (!disabled) {
          setDragging(true);
          onDragEnter?.(event);
        }
      }}
      onDragLeave={(event) => {
        setDragging(false);
        if (!disabled) {
          onDragLeave?.(event);
        }
      }}
      onDrop={(event) => {
        setDragging(false);
        if (!disabled) {
          onDrop?.(event);
        }
      }}
      className={cn(
        "w-full min-w-0 rounded-lg border border-input bg-background text-sm text-foreground file:mr-3 file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive data-dragging:border-primary data-dragging:bg-accent",
        className
      )}
    />
  );
}
