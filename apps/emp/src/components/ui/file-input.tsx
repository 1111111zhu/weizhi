import * as React from "react";

import { cn } from "@/lib/utils";

const FileInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="file"
    data-slot="file-input"
    className={cn("hidden", className)}
    {...props}
  />
));
FileInput.displayName = "FileInput";

export { FileInput };
