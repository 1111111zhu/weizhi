import * as React from "react";

import { cn } from "@/lib/utils";

function ButtonGroup({
  children,
  className,
  label,
  ...props
}: React.ComponentProps<"fieldset"> & { label?: React.ReactNode }) {
  return (
    <fieldset
      data-slot="button-group"
      className={cn(
        "m-0 flex w-fit min-w-0 items-stretch gap-2 border-0 p-0",
        className
      )}
      {...props}
    >
      {label ? <legend className="sr-only">{label}</legend> : null}
      {children}
    </fieldset>
  );
}

export { ButtonGroup };
