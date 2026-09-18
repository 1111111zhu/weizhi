"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

import { useCompactViewport } from "./hooks/use-compact-viewport";
import { useMobileKeyboardViewport } from "./mobile-keyboard-viewport";

/** Responsive surface only. The owning Dialog keeps focus, dismissal and state. */
export const ResponsiveDialogSurface = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div">
>((props, forwardedRef) => {
  const element = useRef<HTMLDivElement>(null);
  const mobile = useCompactViewport(767);
  useMobileKeyboardViewport(element, mobile);
  useImperativeHandle(forwardedRef, () => element.current as HTMLDivElement);
  return <div {...props} ref={element} data-responsive-dialog="" />;
});
ResponsiveDialogSurface.displayName = "ResponsiveDialogSurface";
