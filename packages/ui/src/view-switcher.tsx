"use client";

import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

export type ViewSwitcherOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  count?: number;
};
export type ViewSwitcherProps = {
  label: string;
  value: string;
  options: readonly ViewSwitcherOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  descriptionId?: string;
  wrapOptions?: boolean;
  mobilePresentation?: "anchored" | "sheet";
};

/** Compact alternative to a persistent view/category rail. Keeps one controlled selection. */
export function ViewSwitcher({
  label,
  value,
  options,
  onValueChange,
  disabled,
  invalid,
  descriptionId,
  wrapOptions,
  mobilePresentation,
}: ViewSwitcherProps) {
  const current = options.find((option) => option.value === value);
  return (
    <Select
      disabled={disabled}
      value={value}
      onValueChange={(next) => {
        if (
          typeof next === "string" &&
          options.some((option) => option.value === next)
        ) {
          onValueChange(next);
        }
      }}
    >
      <SelectTrigger
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={descriptionId}
        className="bg-card w-full min-w-0 shadow-none"
      >
        <SelectValue>
          {current?.icon ? (
            <span aria-hidden="true" className="text-muted-foreground shrink-0">
              {current.icon}
            </span>
          ) : null}
          <span className="truncate">{current?.label ?? label}</span>
          {current?.count === undefined ? null : (
            <span className="text-muted-foreground ml-auto text-xs tabular-nums">
              {current.count}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        align="start"
        alignItemWithTrigger={false}
        mobilePresentation={mobilePresentation}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className={
              wrapOptions
                ? "min-h-12 [&>span]:min-w-0 [&>span]:shrink"
                : undefined
            }
          >
            {option.icon ? (
              <span
                aria-hidden="true"
                className="text-muted-foreground shrink-0"
              >
                {option.icon}
              </span>
            ) : null}
            <span
              className={
                wrapOptions
                  ? "min-w-0 break-words whitespace-normal"
                  : "truncate"
              }
            >
              {option.label}
            </span>
            {option.count === undefined ? null : (
              <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                {option.count}
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
