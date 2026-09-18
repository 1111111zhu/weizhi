"use client";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import * as React from "react";

import { cn } from "@/lib/utils";

function Avatar({
  children,
  className,
  label,
  size = "default",
  ...props
}: AvatarPrimitive.Root.Props & {
  label?: React.ReactNode;
  size?: "default" | "sm" | "lg";
}) {
  const labelId = React.useId();

  return (
    <AvatarPrimitive.Root
      aria-labelledby={label ? labelId : undefined}
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6",
        className
      )}
      {...props}
    >
      {label ? (
        <span id={labelId} hidden>
          {label}
        </span>
      ) : null}
      {children}
    </AvatarPrimitive.Root>
  );
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        className
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback };
