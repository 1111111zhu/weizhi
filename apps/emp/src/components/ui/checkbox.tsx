"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

function Checkbox({
  className,
  indeterminate,
  label,
  ...props
}: CheckboxPrimitive.Root.Props & { label?: React.ReactNode }) {
  const labelId = React.useId();

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      aria-labelledby={label ? labelId : undefined}
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-[background-color,border-color,color,scale] duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:not-disabled:scale-[0.96] motion-reduce:active:not-disabled:scale-100 motion-reduce:transition-none outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2    disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive   aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50  data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
        className
      )}
      indeterminate={indeterminate}
      {...props}
    >
      {label ? (
        <span id={labelId} hidden>
          {label}
        </span>
      ) : null}
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        {indeterminate ? <MinusIcon /> : <CheckIcon />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
