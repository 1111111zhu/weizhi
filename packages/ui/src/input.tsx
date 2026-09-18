import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

import { cn } from "./utils";

function Input({
  className,
  id,
  type,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      {...props}
      id={id}
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1.5 text-base shadow-[0_1px_2px_rgb(15_23_42/0.03)] outline-none transition-[background-color,border-color,box-shadow,opacity] placeholder:text-muted-foreground/80 hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive md:text-sm",
        className
      )}
    />
  );
}

export { Input };
