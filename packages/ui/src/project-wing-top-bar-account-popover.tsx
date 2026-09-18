"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  ProjectWingTopBarMotionPopover,
  ProjectWingTopBarMotionPopoverTrigger,
} from "./project-wing-motion-popover";
import { ProjectWingTopBarMotionPopoverContent as MotionPopoverContent } from "./project-wing-motion-popover-content";
import { ProjectWingTopBarAvatar } from "./project-wing-top-bar-avatar";

type ProjectWingTopBarAccountPopoverTrigger = "click" | "hover";

const SWITCH_ACCOUNT_TRANSITION: Transition = {
  bounce: 0,
  duration: 0.22,
  type: "spring",
};
const DEFAULT_ROOT_FONT_SIZE = 16;
const POPOVER_HORIZONTAL_PADDING_REM = 1.5;
const POPOVER_VIEWPORT_INSET_REM = 2;
const SWITCH_ACCOUNT_MAX_WIDTH_REM = 21;

function getExpandedAccountWidth(collapsedWidth: number) {
  const rootFontSize =
    Number.parseFloat(
      window.getComputedStyle(document.documentElement).fontSize
    ) || DEFAULT_ROOT_FONT_SIZE;
  const maxWidth = SWITCH_ACCOUNT_MAX_WIDTH_REM * rootFontSize;
  const availableWidth =
    window.innerWidth -
    (POPOVER_VIEWPORT_INSET_REM + POPOVER_HORIZONTAL_PADDING_REM) *
      rootFontSize;
  return Math.max(collapsedWidth, Math.min(maxWidth, availableWidth));
}

export function ProjectWingTopBarAccountPopover({
  accountAvatarName,
  accountDisplayName,
  accountLabel,
  accountMenuLabel,
  accountRank,
  onSignOut,
  open: controlledOpen,
  onOpenChange,
  signOutIcon,
  signOutLabel,
  switchAccountDisabled = true,
  switchAccountContent,
  switchAccountIcon,
  switchAccountLabel,
  triggerMode = "hover",
  userEmail,
  panelTestId,
  triggerTestId,
}: {
  accountAvatarName: string;
  accountDisplayName: string;
  accountLabel: string;
  accountMenuLabel: string;
  accountRank?: string;
  onSignOut: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  signOutIcon: ReactNode;
  signOutLabel: string;
  switchAccountDisabled?: boolean;
  switchAccountContent?: ReactNode;
  switchAccountIcon?: ReactNode;
  switchAccountLabel?: string;
  triggerMode?: ProjectWingTopBarAccountPopoverTrigger;
  userEmail?: string;
  panelTestId?: string;
  triggerTestId?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [showSwitchAccountContent, setShowSwitchAccountContent] =
    useState(false);
  const [switchAccountContentPresent, setSwitchAccountContentPresent] =
    useState(false);
  const [accountWidths, setAccountWidths] = useState<{
    collapsed: number;
    expanded: number;
  }>();
  const accountContentRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const switchAccountTransition: Transition = reduceMotion
    ? { duration: 0 }
    : SWITCH_ACCOUNT_TRANSITION;
  const isControlled = controlledOpen !== undefined;
  const open = controlledOpen ?? internalOpen;
  const handleOpenChange = (next: boolean) => {
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const accountContent = accountContentRef.current;
    if (!accountContent) {
      return;
    }

    const updateWidths = () => {
      const collapsed = accountContent.offsetWidth;
      const expanded = getExpandedAccountWidth(collapsed);
      setAccountWidths((current) =>
        current?.collapsed === collapsed && current.expanded === expanded
          ? current
          : { collapsed, expanded }
      );
    };
    updateWidths();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateWidths);
    observer?.observe(accountContent);
    window.addEventListener("resize", updateWidths);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateWidths);
    };
  }, [open]);

  const accountLayoutWidth = showSwitchAccountContent
    ? accountWidths?.expanded
    : accountWidths?.collapsed;

  return (
    <ProjectWingTopBarMotionPopover
      align="end"
      className="project-wing-top-bar-account-root"
      onOpenChange={handleOpenChange}
      open={open}
      panelRadius={12}
      sideOffset={8}
      trigger={triggerMode}
    >
      <ProjectWingTopBarMotionPopoverTrigger>
        <ButtonPrimitive
          aria-label={accountMenuLabel}
          className="project-wing-top-bar-account-trigger"
          data-size="icon"
          data-slot="button"
          data-variant="ghost"
          data-testid={triggerTestId}
          type="button"
        >
          <ProjectWingTopBarAvatar
            label={accountLabel}
            name={accountAvatarName}
            size="sm"
          />
        </ButtonPrimitive>
      </ProjectWingTopBarMotionPopoverTrigger>
      <MotionPopoverContent
        aria-label={accountMenuLabel}
        className={`project-wing-top-bar-account-popover${
          switchAccountContentPresent ? " is-switch-account-open" : ""
        }`}
        data-slot="project-wing-top-bar-account-popover"
        data-testid={panelTestId}
      >
        <motion.div
          animate={
            accountLayoutWidth === undefined
              ? undefined
              : { width: accountLayoutWidth }
          }
          className="project-wing-top-bar-account-layout"
          transition={switchAccountTransition}
        >
          <div
            ref={accountContentRef}
            className="project-wing-top-bar-account-content"
          >
            <ProjectWingTopBarAvatar
              label={accountLabel}
              name={accountAvatarName}
              size="sm"
            />
            <div>
              <div className="project-wing-top-bar-account-name">
                <div className="project-wing-top-bar-account-display-name">
                  {accountDisplayName}
                </div>
                {accountRank ? (
                  <div className="project-wing-top-bar-account-rank">
                    {accountRank}
                  </div>
                ) : null}
              </div>
              {userEmail ? (
                <div className="project-wing-top-bar-account-email">
                  {userEmail}
                </div>
              ) : null}
            </div>
          </div>
          <AnimatePresence
            initial={false}
            onExitComplete={() => setSwitchAccountContentPresent(false)}
          >
            {showSwitchAccountContent && switchAccountContent ? (
              <motion.div
                animate={{ height: "auto", opacity: 1, y: 0 }}
                className="project-wing-top-bar-account-switch-content"
                exit={{ height: 0, opacity: 0, y: -4 }}
                initial={
                  reduceMotion ? false : { height: 0, opacity: 0, y: -4 }
                }
                transition={switchAccountTransition}
              >
                {switchAccountContent}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
        <div
          aria-label={accountMenuLabel}
          className="project-wing-top-bar-account-actions"
          data-orientation="vertical"
          data-slot="button-group"
          role="group"
        >
          <ButtonPrimitive
            aria-label={signOutLabel}
            className="project-wing-top-bar-account-action project-wing-top-bar-account-action--destructive"
            data-slot="button"
            data-size="icon-xs"
            data-variant="ghost"
            onClick={onSignOut}
            type="button"
          >
            {signOutIcon}
          </ButtonPrimitive>
          {switchAccountIcon && switchAccountLabel ? (
            <ButtonPrimitive
              aria-label={switchAccountLabel}
              className="project-wing-top-bar-account-action"
              data-slot="button"
              data-size="icon-xs"
              data-variant="ghost"
              disabled={switchAccountDisabled}
              onClick={() => {
                setShowSwitchAccountContent((visible) => {
                  const next = !visible;
                  if (next) {
                    setSwitchAccountContentPresent(true);
                  }
                  return next;
                });
              }}
              type="button"
            >
              {switchAccountIcon}
            </ButtonPrimitive>
          ) : null}
        </div>
      </MotionPopoverContent>
    </ProjectWingTopBarMotionPopover>
  );
}
