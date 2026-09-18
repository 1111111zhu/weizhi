"use client";

import { useId } from "react";
import type { AriaAttributes, ReactNode } from "react";

import { joinFieldDescriptionIds } from "./field-metadata";
import { cn } from "./utils";

export type FieldControlProps = {
  id: string;
  "aria-labelledby": string;
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
};
export type FieldProps = {
  label: string;
  labelVisibility?: "visible" | "hidden";
  id?: string;
  description?: string;
  descriptionId?: string;
  error?: string;
  invalid?: boolean;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  /** Use a render function for compound controls and spread these props on their focusable part. */
  children: (props: FieldControlProps) => ReactNode;
};

export function Field({
  label,
  labelVisibility = "visible",
  id,
  description,
  descriptionId,
  error,
  invalid,
  required,
  disabled,
  readOnly,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const describedBy = joinFieldDescriptionIds(
    descriptionId,
    description ? `${controlId}-description` : undefined,
    error ? `${controlId}-error` : undefined
  );
  const controlProps: FieldControlProps = {
    id: controlId,
    "aria-labelledby": `${controlId}-label`,
    "aria-describedby": describedBy,
    "aria-invalid": invalid ?? (error ? true : undefined),
    disabled,
    readOnly,
    required,
  };
  const Wrapper = labelVisibility === "hidden" ? "span" : "div";
  return (
    <Wrapper
      data-slot="field"
      className={cn("grid min-w-0 gap-1.5", className)}
    >
      {labelVisibility === "hidden" ? (
        <span id={`${controlId}-label`} className="sr-only">
          {label}
        </span>
      ) : (
        <label
          id={`${controlId}-label`}
          htmlFor={controlId}
          className={cn(
            "text-sm font-medium text-foreground",
            controlProps.disabled && "text-muted-foreground"
          )}
        >
          {label}
          {controlProps.required ? (
            <span aria-hidden="true" className="text-destructive ml-1">
              *
            </span>
          ) : null}
        </label>
      )}
      {children(controlProps)}
      {description ? (
        <span
          id={`${controlId}-description`}
          className="text-muted-foreground text-sm"
        >
          {description}
        </span>
      ) : null}
      {error ? (
        <span
          id={`${controlId}-error`}
          role="alert"
          className="text-destructive text-sm"
        >
          {error}
        </span>
      ) : null}
    </Wrapper>
  );
}
