"use client";

import { useId } from "react";
import type { ComponentProps } from "react";

import { cn } from "./utils";

export type TextareaProps = ComponentProps<"textarea"> & { label?: string };
export function Textarea({ className, id, label, ...props }: TextareaProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <>
      {label ? (
        <label htmlFor={controlId} className="sr-only">
          {label}
        </label>
      ) : null}
      <textarea
        {...props}
        id={controlId}
        data-slot="textarea"
        className={cn(
          "field-sizing-content min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base shadow-(--pw-field-shadow) outline-none transition-[background-color,border-color,box-shadow] placeholder:text-muted-foreground/80 hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive md:text-sm",
          className
        )}
      />
    </>
  );
}
