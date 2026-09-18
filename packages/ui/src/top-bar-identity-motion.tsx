"use client";

import { clsx } from "clsx";
import { motion, useReducedMotion } from "motion/react";
import { createContext, useContext } from "react";
import type { ComponentProps } from "react";

import {
  ACTION_BAR_TRANSITION,
  REDUCED_ACTION_BAR_TRANSITION,
} from "./expandable-action-bar";
import { useProjectWingTopBarLayout } from "./project-wing-top-bar-layout-context";

export const TopBarIdentityMotionContext = createContext({
  collapsed: true,
  expanded: false,
});

export function TopBarIdentitySide({
  className,
  ...props
}: ComponentProps<typeof motion.li>) {
  const reduce = useReducedMotion();
  const topBarLayout = useProjectWingTopBarLayout();
  const { collapsed, expanded } = useContext(TopBarIdentityMotionContext);
  const visible = !collapsed || expanded;

  return (
    <motion.li
      {...props}
      initial={false}
      animate={{
        width: visible ? "auto" : 0,
        opacity: visible ? 1 : 0,
        x: reduce || visible ? 0 : -4,
        filter: reduce || visible ? "blur(0px)" : "blur(3px)",
      }}
      aria-hidden={visible ? undefined : true}
      inert={visible ? undefined : true}
      layout="position"
      transition={
        topBarLayout.ready
          ? reduce
            ? REDUCED_ACTION_BAR_TRANSITION
            : ACTION_BAR_TRANSITION
          : { duration: 0 }
      }
      className={clsx(
        "project-wing-top-bar-identity-side inline-flex overflow-hidden",
        className
      )}
      data-identity-collapsible=""
      data-identity-visible={visible}
      data-slot="breadcrumb-item"
    />
  );
}
