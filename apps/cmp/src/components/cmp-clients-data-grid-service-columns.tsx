"use client";

import type { CmpClient } from "@project-wing/shared";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";

import { CmpBooleanIndicator } from "./cmp-boolean-indicator";
import {
  CmpClientColumnHeader,
  selectedValuesFilter,
} from "./cmp-clients-data-grid-column-filter";
import type { WorkspaceCopy } from "./cmp-clients-data-grid-column-filter";
import { hasCmpClientServiceType } from "./cmp-clients-data-grid-utils";
import { CmpDataGridStatusBadge } from "./cmp-data-grid-status-badge";
import { isCmpClientDraftRow } from "./cmp-master-drafts-section";

type CmpClientColumn =
  ProjectWingMasterDataGridProps<CmpClient>["columns"][number];

export function createServiceColumn(
  id: "audit" | "tax" | "risk",
  service: "Audit" | "Tax" | "Risk",
  title: string,
  copy: WorkspaceCopy
): CmpClientColumn {
  return {
    accessorFn: (client) => hasCmpClientServiceType(client, service),
    id,
    header: ({ column }) => (
      <CmpClientColumnHeader column={column} copy={copy} title={title} />
    ),
    cell: ({ row }) => (
      <CmpBooleanIndicator
        label={title}
        noLabel={copy.no}
        value={hasCmpClientServiceType(row.original, service)}
        yesLabel={copy.yes}
      />
    ),
    enableHiding: true,
    enableResizing: false,
    enableSorting: true,
    filterFn: selectedValuesFilter,
    meta: {
      filterValueLabel: (value) => (value === true ? copy.yes : copy.no),
      headerTitle: title,
    },
    size: 76,
  };
}

export function createStatusColumn(copy: WorkspaceCopy): CmpClientColumn {
  return {
    accessorKey: "status",
    id: "status",
    header: ({ column }) => (
      <CmpClientColumnHeader column={column} copy={copy} title={copy.status} />
    ),
    cell: ({ row }) => {
      if (isCmpClientDraftRow(row.original)) {
        return (
          <CmpDataGridStatusBadge tone="warning">
            {copy.clientFormDraftStatus}
          </CmpDataGridStatusBadge>
        );
      }
      const { status } = row.original;
      const label =
        status === "ACTIVE"
          ? copy.clientStatusActive
          : status === "INACTIVE"
            ? copy.clientStatusInactive
            : copy.clientStatusResigned;
      const tone =
        status === "ACTIVE"
          ? "success"
          : status === "INACTIVE"
            ? "destructive"
            : "warning";
      return (
        <CmpDataGridStatusBadge tone={tone}>{label}</CmpDataGridStatusBadge>
      );
    },
    enableHiding: true,
    enableResizing: true,
    enableSorting: true,
    filterFn: selectedValuesFilter,
    meta: {
      filterValueLabel: (value) =>
        value === "DRAFT"
          ? copy.clientFormDraftStatus
          : value === "ACTIVE"
            ? copy.clientStatusActive
            : value === "INACTIVE"
              ? copy.clientStatusInactive
              : copy.clientStatusResigned,
      headerTitle: copy.status,
    },
    minSize: 136,
    size: 136,
  };
}
