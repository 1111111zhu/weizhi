"use client";

import type {
  CmpEngagement,
  CmpEngagementServiceType,
  CmpEngagementStatus,
} from "@project-wing/shared";
import { Checkbox } from "@project-wing/ui";
import type {
  DataGridColumnHeaderProps,
  ProjectWingMasterDataGridProps,
} from "@project-wing/ui";
import { useMemo } from "react";

import { useCmpI18n } from "../i18n/client";
import { CmpDataGridStatusBadge } from "./cmp-data-grid-status-badge";
import {
  CmpMasterDataGrid,
  CmpMasterDataGridColumnHeader,
  cmpSelectedValuesFilter,
} from "./cmp-master-data-grid";

type EngagementSummaryColumn =
  ProjectWingMasterDataGridProps<CmpEngagement>["columns"][number];

export function CmpEngagementSummaryTable({
  engagements,
  emptyMessage,
  onPreviewEngagement,
  onSelectSourceEngagement,
  selectedSourceEngagementId,
}: {
  engagements: CmpEngagement[];
  emptyMessage: string;
  onPreviewEngagement?: (engagement: CmpEngagement) => void;
  onSelectSourceEngagement?: (engagement: CmpEngagement | null) => void;
  selectedSourceEngagementId?: string | null;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const menuCopy = useMemo(
    () => ({
      clear: copy.clearFilters,
      empty: copy.filterNoResults,
      filter: copy.filter,
      search: copy.filterSearch,
    }),
    [copy]
  );
  const columns = useMemo<EngagementSummaryColumn[]>(() => {
    const statusLabels: Record<CmpEngagementStatus, string> = {
      ACTIVE: copy.clientStatusActive,
      INACTIVE: copy.clientStatusInactive,
      COMPLETED: copy.engagementStatusCompleted,
      ARCHIVED: copy.engagementStatusArchived,
    };
    const serviceTypeLabels: Record<CmpEngagementServiceType, string> = {
      ACCOUNTING: copy.serviceTypeAccounting,
      ANNUAL_AUDIT: copy.serviceTypeAnnualAudit,
      AUDIT: copy.serviceTypeAudit,
      COM_SEC: copy.serviceTypeComSec,
      REVIEW: copy.serviceTypeReview,
      RISK: copy.serviceTypeRisk,
      SPECIAL_AUDIT_PRIVATE_CO: copy.serviceTypeSpecialAudit,
      TAX: copy.serviceTypeTax,
      OTHERS: copy.serviceTypeOthers,
    };
    const header = (title: string) =>
      function EngagementSummaryColumnHeader({
        column,
      }: {
        column: DataGridColumnHeaderProps<CmpEngagement, unknown>["column"];
      }) {
        return (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={title}
          />
        );
      };
    const sourceSelectionColumn: EngagementSummaryColumn[] =
      onSelectSourceEngagement
        ? [
            {
              id: "copySource",
              header: () => (
                <span className="sr-only">{copy.engagementSource}</span>
              ),
              cell: ({ row }) => {
                const isSelected =
                  row.original.id === selectedSourceEngagementId;
                return (
                  <Checkbox
                    aria-label={copy.selectEngagementAsSource.replace(
                      "{engagementCode}",
                      row.original.engagementCode
                    )}
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                      onSelectSourceEngagement(checked ? row.original : null)
                    }
                    onClick={(event) => event.stopPropagation()}
                  />
                );
              },
              enableHiding: false,
              enableResizing: false,
              enableSorting: false,
              meta: {
                headerTitle: copy.engagementSource,
              },
              size: 44,
            },
          ]
        : [];
    return [
      ...sourceSelectionColumn,
      {
        accessorKey: "engagementCode",
        id: "engagementCode",
        header: header(copy.engagementCode),
        cell: ({ row }) => (
          <strong className="block truncate font-medium text-foreground">
            {row.original.engagementCode}
          </strong>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.engagementCode },
        size: 220,
      },
      {
        id: "serviceType",
        accessorFn: (row) => serviceTypeLabels[row.serviceType],
        header: header(copy.serviceType),
        cell: ({ row }) => serviceTypeLabels[row.original.serviceType],
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.serviceType },
        size: 220,
      },
      {
        accessorKey: "pic",
        id: "pic",
        header: header(copy.pic),
        cell: ({ row }) => row.original.pic || "—",
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.pic },
        size: 180,
      },
      {
        id: "status",
        accessorFn: (row) => statusLabels[row.status],
        header: header(copy.status),
        cell: ({ row }) => (
          <CmpDataGridStatusBadge
            tone={row.original.status === "ACTIVE" ? "success" : "neutral"}
          >
            {statusLabels[row.original.status]}
          </CmpDataGridStatusBadge>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.status },
        size: 160,
      },
    ];
  }, [copy, menuCopy, onSelectSourceEngagement, selectedSourceEngagementId]);

  return (
    <CmpMasterDataGrid
      mobile={{
        titleColumn: "engagementCode",
        summaryColumns: ["serviceType", "status"],
      }}
      columns={columns}
      data={engagements}
      emptyMessage={emptyMessage}
      getRowId={(row) => row.id}
      initialSorting={[]}
      onRowClick={onPreviewEngagement}
      showRecordCount={false}
      showRowSelection={false}
      showToolbar={false}
      tableLabel={copy.engagements}
      tableLayout={{ headerSticky: true, columnsVisibility: false }}
      testId="cmp-engagement-summary-data-grid"
      title={copy.engagements}
    />
  );
}
