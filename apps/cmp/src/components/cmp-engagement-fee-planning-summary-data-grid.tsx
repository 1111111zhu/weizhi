"use client";

import { CMP_ENGAGEMENT_FEE_PLAN_GRADE_LABELS } from "@project-wing/shared";
import type {
  CmpBudgetCurrency,
  CmpEngagementFeePlanGrade,
} from "@project-wing/shared";
import type {
  DataGridColumnHeaderProps,
  ProjectWingMasterDataGridProps,
} from "@project-wing/ui";
import { useMemo } from "react";

import type { DirectoryUser } from "../api/client";
import { useCmpI18n } from "../i18n/client";
import { calculateFeePlanningTotals } from "./cmp-engagement-fee-planning-model";
import type { CmpFeePlanningFormLine } from "./cmp-engagement-fee-planning-model";
import {
  CmpMasterDataGrid,
  CmpMasterDataGridColumnHeader,
  cmpSelectedValuesFilter,
} from "./cmp-master-data-grid";

type SummaryColumn =
  ProjectWingMasterDataGridProps<CmpFeePlanningFormLine>["columns"][number];
const EMPTY_DIRECTORY_USERS: DirectoryUser[] = [];

export function CmpEngagementFeePlanningSummaryDataGrid({
  lines,
  currency,
  users = EMPTY_DIRECTORY_USERS,
}: {
  lines: CmpFeePlanningFormLine[];
  currency: CmpBudgetCurrency;
  users?: DirectoryUser[];
}) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.workspace;
  const language = locale === "zh-CN" ? "zh" : "en";
  const menuCopy = useMemo(
    () => ({
      clear: copy.clearFilters,
      empty: copy.filterNoResults,
      filter: copy.filter,
      search: copy.filterSearch,
    }),
    [copy]
  );
  const columns = useMemo<SummaryColumn[]>(() => {
    const header = (title: string) =>
      function FeePlanningSummaryColumnHeader({
        column,
      }: {
        column: DataGridColumnHeaderProps<
          CmpFeePlanningFormLine,
          unknown
        >["column"];
      }) {
        return (
          <CmpMasterDataGridColumnHeader
            column={column}
            copy={menuCopy}
            title={title}
          />
        );
      };
    const textColumn = (
      id: string,
      title: string,
      accessor: (line: CmpFeePlanningFormLine) => string,
      size = 150
    ): SummaryColumn => ({
      id,
      accessorFn: accessor,
      header: header(title),
      cell: ({ row }) => (
        <span className="block truncate text-foreground">
          {accessor(row.original)}
        </span>
      ),
      enableHiding: false,
      enableResizing: true,
      enableSorting: true,
      filterFn: cmpSelectedValuesFilter,
      meta: { autoSize: true, headerTitle: title },
      size,
    });
    return [
      textColumn(
        "grade",
        copy.feePlanningGrade,
        (line) =>
          CMP_ENGAGEMENT_FEE_PLAN_GRADE_LABELS[
            line.grade as CmpEngagementFeePlanGrade
          ][language],
        180
      ),
      textColumn(
        "staff",
        copy.feePlanningStaffName,
        (line) =>
          line.assignmentType === "TBC"
            ? "TBC"
            : (users.find((user) => user.id === line.staffUserId)?.name ??
              line.staffUserId ??
              "—"),
        160
      ),
      textColumn(
        "dateFrom",
        copy.feePlanningDateFrom,
        (line) => line.dateFrom || "—",
        140
      ),
      textColumn(
        "dateTo",
        copy.feePlanningDateTo,
        (line) => line.dateTo || "—",
        140
      ),
      textColumn(
        "hourlyRate",
        copy.feePlanningFixedHourlyRate,
        (line) => formatMoney(locale, currency, Number(line.hourlyRate)),
        170
      ),
      textColumn(
        "budgetHours",
        copy.feePlanningRequiredHoursPerPerson,
        (line) => Number(line.budgetHours || 0).toFixed(2),
        150
      ),
      textColumn(
        "total",
        copy.feePlanningTotal,
        (line) =>
          formatMoney(
            locale,
            currency,
            Number(line.hourlyRate || 0) * Number(line.budgetHours || 0)
          ),
        180
      ),
    ];
  }, [copy, currency, language, locale, menuCopy, users]);
  const { totalHours, standardValue } = calculateFeePlanningTotals(lines);

  return (
    <div className="grid gap-3">
      <div className="cmp-horizontal-data-scrollbar min-w-0 overflow-x-auto overscroll-x-contain pb-2">
        <div className="min-w-[68rem]">
          <CmpMasterDataGrid
            mobile={{
              titleColumn: "staff",
              summaryColumns: ["grade", "budgetHours", "total"],
            }}
            columns={columns}
            data={lines}
            emptyMessage={copy.feePlanningEmpty}
            getRowId={(row) => row.key}
            initialSorting={[]}
            showRecordCount={false}
            showRowSelection={false}
            showToolbar={false}
            tableLabel={copy.feePlanningDetails}
            tableLayout={{ headerSticky: false, columnsVisibility: false }}
            testId="cmp-engagement-fee-planning-summary-data-grid"
            title={copy.feePlanningDetails}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 rounded-md bg-muted/45 px-3 py-2 text-sm">
        <span className="text-muted-foreground">
          {copy.feePlanningTotalHours}
        </span>
        <strong className="tabular-nums">{totalHours.toFixed(2)}</strong>
        <span className="text-muted-foreground">
          {copy.feePlanningTotalAmount}
        </span>
        <strong className="tabular-nums">
          {formatMoney(locale, currency, standardValue)}
        </strong>
      </div>
    </div>
  );
}

function formatMoney(
  locale: string,
  currency: CmpBudgetCurrency,
  value: number
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
