"use client";

import { motion, useIsPresent } from "motion/react";
import type { Variants } from "motion/react";
import type { ReactNode, RefObject } from "react";
import { useEffect } from "react";

import { cn } from "./utils";

export function MorphPopoverPresence({
  children,
  className,
  clipVariants,
  contentId,
  contentRef,
  layoutReady,
  portalRef,
  reduce,
  triggerId,
  wrapperVariants,
}: {
  children: ReactNode;
  className?: string;
  clipVariants?: Variants;
  contentId: string;
  contentRef: RefObject<HTMLDivElement | null>;
  layoutReady: boolean;
  portalRef: RefObject<HTMLDivElement | null>;
  reduce: boolean;
  triggerId: string;
  wrapperVariants?: Variants;
}) {
  const isPresent = useIsPresent();
  useEffect(() => {
    const content = contentRef.current;
    if (
      !isPresent ||
      !layoutReady ||
      !content ||
      content.contains(document.activeElement)
    ) {
      return;
    }
    const firstControl = content.querySelector<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
    );
    (firstControl ?? content).focus({ preventScroll: true });
  }, [contentRef, isPresent, layoutReady]);
  return (
    <motion.div
      ref={portalRef}
      data-morph-popover-portal=""
      variants={wrapperVariants}
      initial={reduce ? { opacity: 0 } : "hidden"}
      animate={reduce ? { opacity: 1 } : "show"}
      exit={reduce ? { opacity: 0 } : "hidden"}
      transition={reduce ? { duration: 0.12 } : undefined}
      aria-hidden={isPresent ? undefined : true}
      className={cn(
        "pointer-events-none fixed z-50 drop-shadow-xl",
        layoutReady ? "visible" : "invisible"
      )}
    >
      <motion.div
        ref={contentRef}
        id={contentId}
        role="dialog"
        tabIndex={-1}
        aria-labelledby={triggerId}
        variants={clipVariants}
        className={cn(
          "overflow-hidden rounded-[10px] border border-border bg-popover",
          isPresent ? "pointer-events-auto" : "pointer-events-none",
          className
        )}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
