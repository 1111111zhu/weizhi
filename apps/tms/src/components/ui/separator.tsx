import type * as React from "react";

import { cn } from "@/lib/utils";

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"hr"> & {
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <hr
      data-orientation={orientation}
      className={cn(
        orientation === "vertical" ? "h-full w-px" : "h-px w-full",
        "bg-border",
        className
      )}
      {...props}
    />
  );
}

export { Separator };
