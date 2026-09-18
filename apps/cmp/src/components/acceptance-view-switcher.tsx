"use client";

import { MotionButton } from "@project-wing/ui";
import { BadgeCheck, FilePenLine } from "lucide-react";

import { CMP_DATA_GRID_TOOLBAR_ACTION_CLASS } from "./cmp-data-grid-toolbar";

export type AcceptanceViewTab = "requests" | "approvals";

export function AcceptanceViewSwitcher({
  activeTab,
  canAccessApprovals,
  requestsLabel,
  approvalsLabel,
  ariaLabel,
  onTabChange,
}: {
  activeTab: AcceptanceViewTab;
  canAccessApprovals: boolean;
  requestsLabel: string;
  approvalsLabel: string;
  ariaLabel: string;
  onTabChange: (tab: AcceptanceViewTab) => void;
}) {
  if (!canAccessApprovals) {
    return null;
  }

  const isApprovals = activeTab === "approvals";
  const nextTab = isApprovals ? "requests" : "approvals";
  const nextLabel = isApprovals ? requestsLabel : approvalsLabel;

  return (
    <MotionButton
      type="button"
      aria-label={`${ariaLabel}: ${nextLabel}`}
      aria-pressed={isApprovals}
      className={CMP_DATA_GRID_TOOLBAR_ACTION_CLASS}
      size="sm"
      variant="secondary"
      onClick={() => onTabChange(nextTab)}
    >
      {isApprovals ? (
        <FilePenLine aria-hidden="true" className="size-3.5" />
      ) : (
        <BadgeCheck aria-hidden="true" className="size-3.5" />
      )}
      <span>{nextLabel}</span>
    </MotionButton>
  );
}
