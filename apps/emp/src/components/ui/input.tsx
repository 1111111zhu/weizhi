import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

import { cn } from "@/lib/utils";

function Input({
  className,
  id,
  label,
  type,
  autoComplete = "off",
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
        autoComplete={autoComplete}
        data-slot="input"
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-[background-color,border-color,box-shadow,opacity] duration-[var(--motion-fast)] ease-[var(--motion-ease)] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground    disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive   md:text-sm",
          className
        )}
        {...props}
      />
    </>
  );
}

export { Input };
