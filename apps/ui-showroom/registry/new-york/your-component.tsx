import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export type YourComponentProps = HTMLAttributes<HTMLDivElement>;

/**
 * Registry authoring example.
 *
 * This example is intentionally excluded from the published registry. It
 * documents the local authoring shape without claiming to be a production
 * Project Wing component.
 */
const YourComponent = forwardRef<HTMLDivElement, YourComponentProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "p-4 rounded-md text-center bg-muted/20 space-y-2 border border-muted h-48 flex items-center flex-col justify-center",
        className
      )}
      {...props}
    >
      <p className="text-sm text-muted-foreground/70">
        Non-published registry authoring example
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Edit{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
          registry/new-york/your-component.tsx
        </code>{" "}
        is retained as authoring documentation only
      </p>
    </div>
  )
);

YourComponent.displayName = "YourComponent";

export { YourComponent };
