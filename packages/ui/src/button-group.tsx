import * as React from "react";

import { cn } from "./utils";

function ButtonGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="button-group"
      className={cn("flex w-fit items-stretch gap-2", className)}
      {...props}
    />
  );
}

export { ButtonGroup };
