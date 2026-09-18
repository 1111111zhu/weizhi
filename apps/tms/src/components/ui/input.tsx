import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

import { cn } from "@/lib/utils";

function Input({
  className,
  id,
  label,
  type,
  ...props
}: React.ComponentProps<"input"> & { label?: React.ReactNode }) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;

  return (
    <>
      {label ? (
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
      ) : null}
      <InputPrimitive
        id={inputId}
        type={type}
        data-slot="input"
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-[background-color,border-color,box-shadow,opacity] duration-[var(--motion-fast)] ease-[var(--motion-ease)] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
          className
        )}
        {...props}
      />
    </>
  );
}

export { Input };
