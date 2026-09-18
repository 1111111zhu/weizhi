"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import * as React from "react";

import { cn } from "@/lib/utils";

function Progress({
  className,
  children,
  label,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  label?: React.ReactNode;
}) {
  const labelId = React.useId();

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      aria-labelledby={label ? labelId : undefined}
      className={cn(
        "relative flex h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      {label ? (
        <span id={labelId} hidden>
          {label}
        </span>
      ) : null}
      {children ?? (
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      )}
    </ProgressPrimitive.Root>
  );
}

function ProgressTrack({
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Track>) {
  return (
    <ProgressPrimitive.Track
      data-slot="progress-track"
      className={cn("relative h-full w-full overflow-hidden", className)}
      {...props}
    />
  );
}

function ProgressIndicator({
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Indicator>) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn(
        "h-full bg-primary transition-[width,transform] duration-[var(--motion-normal)] ease-[var(--motion-ease)] data-[indeterminate]:absolute data-[indeterminate]:inset-y-0 data-[indeterminate]:left-0 data-[indeterminate]:w-1/2 data-[indeterminate]:animate-progress-indeterminate",
        className
      )}
      {...props}
    />
  );
}

function ProgressLabel({
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Label>) {
  return (
    <ProgressPrimitive.Label
      data-slot="progress-label"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  );
}

function ProgressValue({
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Value>) {
  return (
    <ProgressPrimitive.Value
      data-slot="progress-value"
      className={cn("text-sm tabular-nums text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
  ProgressValue,
};
