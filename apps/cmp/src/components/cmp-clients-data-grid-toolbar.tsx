"use client";

import type { CmpClient } from "@project-wing/shared";
import type { ProjectWingDataGridToolbarProps } from "@project-wing/ui";
import type { ReactNode } from "react";

import { useCmpI18n } from "@/i18n/client";

import { CmpClientBusinessActions } from "./cmp-clients-data-grid-controls";
import { CmpDataGridToolbar } from "./cmp-data-grid-toolbar";

export function CmpClientsDataGridToolbar({
  canCreateClient,
  draftToggle,
  isDraftView = false,
  onCreateClient,
  recordCount,
  table,
}: {
  canCreateClient: boolean;
  draftToggle?: ReactNode;
  isDraftView?: boolean;
  onCreateClient: () => void;
  recordCount?: number;
  table: ProjectWingDataGridToolbarProps<CmpClient>["table"];
}) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.workspace;

  return (
    <CmpDataGridToolbar
      draftToggle={draftToggle}
      recordCount={recordCount}
      trailingActions={
        isDraftView ? null : (
          <CmpClientBusinessActions
            canCreateClient={canCreateClient}
            onCreateClient={onCreateClient}
          />
        )
      }
      table={table}
      title={
        isDraftView ? (locale === "zh-CN" ? "草稿" : "Drafts") : copy.client
      }
    />
  );
}
