"use client";

import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Check } from "lucide-react";
import { createElement } from "react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "./button";
import type { ButtonProps } from "./button";
import { cn } from "./utils";

export function MaterialSurface({
  as = "section",
  tone = "low",
  className,
  ...props
}: ComponentProps<"section"> & {
  as?: "section" | "article" | "div";
  tone?: "surface" | "low" | "container" | "high";
}) {
  return createElement(as, {
    ...props,
    className: cn("pw-material-surface", className),
    "data-tone": tone,
  });
}

export function SegmentedButtonGroup({
  label,
  value,
  options,
  onValueChange,
  disabled,
  invalid,
  loading,
  descriptionId,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  loading?: boolean;
  descriptionId?: string;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-busy={loading || undefined}
      aria-describedby={descriptionId}
      className="pw-segmented"
      value={[value]}
      disabled={disabled || loading}
      onValueChange={(values) => {
        const [next] = values;
        if (
          typeof next === "string" &&
          options.some((option) => option.value === next && !option.disabled)
        ) {
          onValueChange(next);
        }
      }}
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          render={<Button variant="outline" size="sm" />}
        >
          <span className="pw-segmented-indicator" aria-hidden>
            {value === option.value ? (
              loading ? (
                <span className="pw-button-spinner" />
              ) : (
                <Check />
              )
            ) : null}
          </span>
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}

export function FloatingActionButton({
  icon,
  label,
  extended = false,
  className,
  ...props
}: Omit<ButtonProps, "children" | "iconStart" | "iconEnd"> & {
  icon: ReactNode;
  label: string;
  extended?: boolean;
}) {
  return (
    <Button
      {...props}
      className={cn("pw-fab", className)}
      aria-label={label}
      iconStart={icon}
    >
      {extended ? label : null}
    </Button>
  );
}
