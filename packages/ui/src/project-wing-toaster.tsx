"use client";

import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";
import type { ToasterProps } from "sonner";

import { useCompactViewport } from "./hooks/use-compact-viewport";

export function ProjectWingToaster({ style, ...props }: ToasterProps) {
  const mobile = useCompactViewport(767);
  return (
    <Sonner
      {...props}
      position={mobile ? "bottom-center" : "top-center"}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          ...style,
        } as CSSProperties
      }
    />
  );
}
