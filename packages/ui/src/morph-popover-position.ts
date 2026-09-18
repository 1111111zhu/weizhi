"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import type { MutableRefObject } from "react";

export type PortalLayout = {
  trigger: { left: number; top: number; width: number; height: number };
  content: { width: number; height: number };
};

function sameLayout(current: PortalLayout | null, next: PortalLayout) {
  return (
    current?.trigger.left === next.trigger.left &&
    current.trigger.top === next.trigger.top &&
    current.trigger.width === next.trigger.width &&
    current.trigger.height === next.trigger.height &&
    current.content.width === next.content.width &&
    current.content.height === next.content.height
  );
}

export function useMorphPopoverPosition<
  TriggerElement extends HTMLElement,
  ContentElement extends HTMLElement,
>(
  triggerRef: MutableRefObject<TriggerElement | null>,
  contentRef: MutableRefObject<ContentElement | null>,
  active: boolean
) {
  const [layout, setLayout] = useState<PortalLayout | null>(null);
  const update = useCallback(() => {
    const trigger = triggerRef.current;
    const content = contentRef.current;
    if (!(trigger && content)) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const next = {
      trigger: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
      content: { width: content.offsetWidth, height: content.offsetHeight },
    };
    setLayout((current) => (sameLayout(current, next) ? current : next));
  }, [contentRef, triggerRef]);

  useLayoutEffect(() => {
    update();
    if (!active) {
      return;
    }
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (triggerRef.current) {
      observer?.observe(triggerRef.current);
    }
    if (contentRef.current) {
      observer?.observe(contentRef.current);
    }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [active, contentRef, triggerRef, update]);

  return layout;
}
