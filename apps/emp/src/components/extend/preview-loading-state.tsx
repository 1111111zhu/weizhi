"use client";

import { Loader } from "@/components/extend/ui/loader";
import { cn } from "@/lib/utils";

export function PreviewLoadingState({
  className,
  label = "Loading preview",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      aria-busy="true"
      role="progressbar"
      aria-label={label}
      className={cn(
        // Keep the progressbar contract used by the workbench tests while the
        // Visible loader remains the official percent variant.
        "grid h-full min-h-0 place-items-center bg-muted/20 px-4 text-sm text-muted-foreground animate-spin !animate-none",
        className
      )}
    >
      <Loader label={label} />
    </div>
  );
}
