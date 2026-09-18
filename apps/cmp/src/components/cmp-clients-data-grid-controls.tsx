"use client";

import { MotionButton } from "@project-wing/ui";
import { Plus } from "lucide-react";

import { useCmpI18n } from "@/i18n/client";

import { CMP_DATA_GRID_TOOLBAR_ACTION_CLASS } from "./cmp-data-grid-toolbar";

export function CmpClientBusinessActions({
  canCreateClient,
  onCreateClient,
}: {
  canCreateClient: boolean;
  onCreateClient: () => void;
}) {
  const copy = useCmpI18n().dictionary.workspace;

  if (!canCreateClient) {
    return null;
  }

  return (
    <MotionButton
      aria-label={copy.newClient}
      className={CMP_DATA_GRID_TOOLBAR_ACTION_CLASS}
      size="sm"
      variant="secondary"
      onClick={onCreateClient}
    >
      <Plus aria-hidden="true" className="size-3.5" />
      <span>{copy.newClient}</span>
    </MotionButton>
  );
}
