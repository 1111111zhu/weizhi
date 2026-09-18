"use client";

import type {
  TmsApprovalStatus,
  TmsEngagementSummary,
  TmsEngagementSummaryPeriod,
  TmsEngagementSummaryRow,
} from "@project-wing/shared";
import type {
  DataGridColumnHeaderProps,
  ProjectWingMasterDataGridProps,
} from "@project-wing/ui";
import { Badge } from "@project-wing/ui";
import { useMemo } from "react";

import { useCmpI18n } from "../i18n/client";
import {
  CmpMasterDataGrid,
  CmpMasterDataGridColumnHeader,
} from "./cmp-master-data-grid";

type ContributionRow = {
  id: string;
  kind: "DETAIL" | "SUMMARY";
  userId: string;
  name: string;
  displayName: string;
  period: string;
  status: TmsApprovalStatus | null;
  bucket: "APPROVED" | "DRAFT" | null;
  normal: number;
  ot: number;
  absent: number;
  total: number;
};

type ContributionColumn =
  ProjectWingMasterDataGridProps<ContributionRow>["columns"][number];

export function CmpTmsSummary({ summary }: { summary: TmsEngagementSummary }) {
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
  const rows = useMemo(
    () => buildContributionRows(summary, copy),
    [copy, summary]
  );
  const columns = useMemo<ContributionColumn[]>(() => {
    const header = (title: string) =>
      function ContributionColumnHeader({
        column,
      }: {
        column: DataGridColumnHeaderProps<ContributionRow, unknown>["column"];
      }) {
        return (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={title}
          />
        );
      };
    const hoursColumn = (
      key: "normal" | "ot" | "absent" | "total",
      title: string
    ): ContributionColumn => ({
      accessorKey: key,
      id: key,
      header: header(title),
      cell: ({ row }) => (
        <span className="block text-right text-foreground tabular-nums">
          {row.original.kind === "SUMMARY"
            ? row.original[key].toFixed(1)
            : formatHours(row.original[key])}
        </span>
      ),
      enableHiding: false,
      enableResizing: true,
      enableSorting: false,
      meta: { autoSize: true, headerTitle: title },
      size: 130,
    });
    return [
      {
        accessorKey: "displayName",
        id: "name",
        header: header(copy.tmsSummaryName),
        cell: ({ row }) =>
          row.original.displayName ? (
            <strong className="block truncate font-medium text-foreground">
              {row.original.displayName}
            </strong>
          ) : null,
        enableHiding: false,
        enableResizing: true,
        enableSorting: false,
        meta: { autoSize: true, headerTitle: copy.tmsSummaryName },
        size: 180,
      },
      {
        accessorKey: "period",
        id: "period",
        header: header(copy.tmsSummaryPeriod),
        cell: ({ row }) => (
          <span
            className={
              row.original.kind === "SUMMARY"
                ? "font-medium text-foreground"
                : "font-mono text-xs text-foreground"
            }
          >
            {row.original.period}
          </span>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: false,
        meta: { autoSize: true, headerTitle: copy.tmsSummaryPeriod },
        size: 190,
      },
      {
        id: "status",
        header: header(copy.tmsSummaryStatus),
        cell: ({ row }) =>
          row.original.kind === "SUMMARY" ? (
            <Badge
              variant={
                row.original.bucket === "APPROVED"
                  ? "success-light"
                  : "warning-light"
              }
            >
              {row.original.bucket === "APPROVED"
                ? copy.tmsSummaryStatusApproved
                : copy.tmsSummaryStatusUnapproved}
            </Badge>
          ) : row.original.status ? (
            <Badge variant={statusVariant(row.original.status)}>
              {statusLabel(row.original.status, copy)}
            </Badge>
          ) : null,
        enableHiding: false,
        enableResizing: true,
        enableSorting: false,
        meta: { autoSize: true, headerTitle: copy.tmsSummaryStatus },
        size: 290,
      },
      hoursColumn("normal", copy.tmsSummaryNormalHours),
      hoursColumn("ot", copy.tmsSummaryOtHours),
      hoursColumn("absent", copy.tmsSummaryAbsent),
      hoursColumn("total", copy.tmsSummaryHoursTotal),
    ];
  }, [copy, menuCopy]);

  return (
    <div className="cmp-horizontal-data-scrollbar min-w-0 overflow-x-auto overscroll-x-contain pb-2">
      <div className="min-w-[78rem]">
        <CmpMasterDataGrid
          mobile={{
            titleColumn: "name",
            summaryColumns: ["period", "status", "total"],
          }}
          columns={columns}
          data={rows}
          emptyMessage={copy.tmsSummaryEmpty}
          getRowId={(row) => row.id}
          initialSorting={[]}
          rowClassName={(row) =>
            row.kind === "SUMMARY"
              ? row.bucket === "APPROVED"
                ? "bg-success/5 font-medium"
                : "bg-muted/40 font-medium"
              : undefined
          }
          showRecordCount={false}
          showRowSelection={false}
          showToolbar={false}
          tableLabel={copy.tmsContributionSummary}
          tableLayout={{ headerSticky: false, columnsVisibility: false }}
          testId="cmp-tms-contribution-summary"
          title={copy.tmsContributionSummary}
        />
      </div>
    </div>
  );
}

function buildContributionRows(
  summary: TmsEngagementSummary,
  copy: ReturnType<typeof useCmpI18n>["dictionary"]["workspace"]
): ContributionRow[] {
  const periods =
    summary.periods && summary.periods.length > 0
      ? summary.periods
      : fallbackPeriods(summary);
  const periodsByUser = new Map<string, TmsEngagementSummaryPeriod[]>();
  for (const period of periods) {
    const userPeriods = periodsByUser.get(period.userId) ?? [];
    userPeriods.push(period);
    periodsByUser.set(period.userId, userPeriods);
  }

  return [...periodsByUser.entries()]
    .sort((left, right) =>
      (left[1][0]?.name ?? "").localeCompare(right[1][0]?.name ?? "")
    )
    .flatMap(([userId, userPeriods]) => {
      const sorted = [...userPeriods].sort(
        (left, right) =>
          left.year - right.year ||
          left.month - right.month ||
          left.half.localeCompare(right.half)
      );
      const approvedPeriods = sorted.filter(
        (period) => period.bucket === "APPROVED"
      );
      const unapprovedPeriods = sorted.filter(
        (period) => period.bucket === "DRAFT"
      );
      const details = sorted.map<ContributionRow>((period, index) => ({
        id: `${userId}:${period.year}:${period.month}:${period.half}:${period.revision}`,
        kind: "DETAIL",
        userId,
        name: period.name,
        displayName: index === 0 ? period.name : "",
        period: formatPeriod(period, copy),
        status: period.status,
        bucket: period.bucket,
        normal: period.normal,
        ot: period.ot,
        absent: period.absent,
        total: period.total,
      }));
      return [
        ...details,
        contributionSubtotalRow({
          userId,
          name: sorted[0]?.name ?? userId,
          bucket: "APPROVED",
          periods: approvedPeriods,
          periodLabel: copy.tmsSummaryApprovedSubtotal,
        }),
        contributionSubtotalRow({
          userId,
          name: sorted[0]?.name ?? userId,
          bucket: "DRAFT",
          periods: unapprovedPeriods,
          periodLabel: copy.tmsSummaryUnapprovedSubtotal,
        }),
      ];
    });
}

function contributionSubtotalRow({
  userId,
  name,
  bucket,
  periods,
  periodLabel,
}: {
  userId: string;
  name: string;
  bucket: "APPROVED" | "DRAFT";
  periods: TmsEngagementSummaryPeriod[];
  periodLabel: string;
}): ContributionRow {
  return {
    id: `${userId}:summary:${bucket}`,
    kind: "SUMMARY",
    userId,
    name,
    displayName: "",
    period: periodLabel,
    status: null,
    bucket,
    normal: sumHours(periods, "normal"),
    ot: sumHours(periods, "ot"),
    absent: sumHours(periods, "absent"),
    total: sumContributionHours(periods),
  };
}

function fallbackPeriods(
  summary: TmsEngagementSummary
): TmsEngagementSummaryPeriod[] {
  return [
    ...summary.approved.rows.flatMap((row) => fallbackPeriod(row, "APPROVED")),
    ...summary.draft.rows.flatMap((row) => fallbackPeriod(row, "DRAFT")),
  ];
}

function fallbackPeriod(
  row: TmsEngagementSummaryRow,
  bucket: "APPROVED" | "DRAFT"
): TmsEngagementSummaryPeriod[] {
  const normal = row.finalNormal ?? 0;
  const ot = row.finalOt ?? 0;
  const absent = row.absent ?? 0;
  if (normal + ot + absent === 0) {
    return [];
  }
  return [
    {
      userId: row.userId,
      name: row.name,
      year: 2000,
      month: 1,
      half: "FIRST_HALF",
      revision: 1,
      status: bucket === "APPROVED" ? "APPROVED" : "NOT_SUBMITTED",
      bucket,
      normal,
      ot,
      absent,
      total: normal + ot,
    },
  ];
}

function formatPeriod(
  period: TmsEngagementSummaryPeriod,
  copy: ReturnType<typeof useCmpI18n>["dictionary"]["workspace"]
) {
  if (period.year === 2000) {
    return copy.tmsSummaryPeriodUnavailable;
  }
  const half =
    period.half === "FIRST_HALF"
      ? copy.tmsSummaryFirstHalf
      : copy.tmsSummarySecondHalf;
  return `${period.year}/${String(period.month).padStart(2, "0")} · ${half}`;
}

function sumHours(
  periods: TmsEngagementSummaryPeriod[],
  key: "normal" | "ot" | "absent"
) {
  return periods.reduce((total, period) => total + period[key], 0);
}

function sumContributionHours(periods: TmsEngagementSummaryPeriod[]) {
  return periods.reduce((total, period) => total + period.total, 0);
}

function statusVariant(status: TmsApprovalStatus) {
  if (status === "APPROVED") {
    return "success-light" as const;
  }
  if (status === "RETURNED") {
    return "destructive-light" as const;
  }
  if (status === "SUBMITTED") {
    return "info-light" as const;
  }
  if (status === "PENDING_CONFIRMATION") {
    return "warning-light" as const;
  }
  return "outline" as const;
}

function statusLabel(
  status: TmsApprovalStatus,
  copy: ReturnType<typeof useCmpI18n>["dictionary"]["workspace"]
) {
  const labels = {
    APPROVED: copy.tmsSummaryStatusApproved,
    NOT_SUBMITTED: copy.tmsSummaryStatusDraft,
    PENDING_CONFIRMATION: copy.tmsSummaryStatusPendingConfirmation,
    RETURNED: copy.tmsSummaryStatusReturned,
    SUBMITTED: copy.tmsSummaryStatusSubmitted,
  } satisfies Record<TmsApprovalStatus, string>;
  return labels[status];
}

function formatHours(value: number) {
  return value > 0 ? value.toFixed(1) : "—";
}
