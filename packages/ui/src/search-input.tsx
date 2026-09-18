"use client";

import { Search, X } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "./button";
import { Input } from "./input";
import { cn } from "./utils";

export type SearchInputProps = Omit<
  ComponentProps<typeof Input>,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  label: string;
  clearLabel: string;
  value: string;
  onValueChange: (value: string) => void;
};
export function SearchInput({
  label,
  clearLabel,
  value,
  onValueChange,
  disabled,
  readOnly,
  className,
  ...props
}: SearchInputProps) {
  return (
    <div className="relative min-w-0">
      <Search
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2"
      />
      <Input
        {...props}
        type="search"
        aria-label={label}
        disabled={disabled}
        readOnly={readOnly}
        value={value}
        onChange={(event) => {
          if (!disabled && !readOnly) {
            onValueChange(event.target.value);
          }
        }}
        className={cn("pr-10 pl-9", className)}
      />
      {value && !readOnly ? (
        <Button
          type="button"
          variant="quiet"
          size="icon-sm"
          aria-label={clearLabel}
          disabled={disabled}
          onClick={() => onValueChange("")}
          className="absolute top-1/2 right-1 -translate-y-1/2"
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}
