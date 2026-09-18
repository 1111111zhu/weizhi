"use client";

import type { Ref } from "react";

import { Button } from "./button";
import { cn } from "./utils";

export type SelectionCardProps = {
  label: string;
  description?: string;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
};
export function SelectionCard({
  label,
  description,
  selected,
  onSelectedChange,
  disabled,
  ref,
}: SelectionCardProps) {
  return (
    <Button
      ref={ref}
      type="button"
      variant={selected ? "secondary" : "outline"}
      disabled={disabled}
      fullWidth
      aria-pressed={selected}
      onClick={() => onSelectedChange(!selected)}
      className={cn("pw-selection-card", selected && "border-primary")}
    >
      <span className="grid min-w-0 gap-1 text-left">
        <span className="font-semibold">{label}</span>
        {description ? (
          <span className="text-muted-foreground text-sm font-normal">
            {description}
          </span>
        ) : null}
      </span>
    </Button>
  );
}
