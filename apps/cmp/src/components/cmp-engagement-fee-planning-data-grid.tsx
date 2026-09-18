"use client";

import {
  CMP_ENGAGEMENT_FEE_PLAN_ACTIVE_GRADES,
  CMP_ENGAGEMENT_FEE_PLAN_GRADE_LABELS,
  CMP_ENGAGEMENT_FEE_PLAN_GRADE_RATES,
  getCmpHongKongWorkdaySummary,
} from "@project-wing/shared";
import type {
  CmpBudgetCurrency,
  CmpEngagementFeePlanGrade,
} from "@project-wing/shared";
import type {
  DataGridColumnHeaderProps,
  ProjectWingMasterDataGridProps,
} from "@project-wing/ui";
import { enUS, zhCN } from "date-fns/locale";
import { CalendarDays, Plus, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useCmpI18n } from "../i18n/client";
import { calculateFeePlanningTotals } from "./cmp-engagement-fee-planning-model";
import type { CmpFeePlanningFormLine } from "./cmp-engagement-fee-planning-model";
import {
  CmpMasterDataGrid,
  CmpMasterDataGridColumnHeader,
  cmpSelectedValuesFilter,
} from "./cmp-master-data-grid";

type FeePlanningColumn =
  ProjectWingMasterDataGridProps<CmpFeePlanningFormLine>["columns"][number];

export function CmpEngagementFeePlanningDataGrid({
  value,
  currency,
  hkdPerUnit,
  rateAvailable,
  disabled,
  onUpdate,
  onDelete,
  onAdd,
  onOpenStaff,
  staffNameById,
  onUpdateDate,
}: {
  value: CmpFeePlanningFormLine[];
  currency: CmpBudgetCurrency;
  hkdPerUnit: number;
  rateAvailable: boolean;
  disabled: boolean;
  onUpdate: (key: string, patch: Partial<CmpFeePlanningFormLine>) => void;
  onDelete: (key: string) => void;
  onAdd: () => void;
  onOpenStaff: (key: string) => void;
  staffNameById: ReadonlyMap<string, string>;
  onUpdateDate: (
    key: string,
    field: "dateFrom" | "dateTo",
    value: string
  ) => void;
}) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.workspace;
  const language = locale === "zh-CN" ? "zh" : "en";
  const [datePicker, setDatePicker] = useState<{
    key: string;
    field: "dateFrom" | "dateTo";
  } | null>(null);
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuCopy = useMemo(
    () => ({
      clear: copy.clearFilters,
      empty: copy.filterNoResults,
      filter: copy.filter,
      search: copy.filterSearch,
    }),
    [copy]
  );
  const { totalHours, standardValue } = calculateFeePlanningTotals(value);
  const openDatePicker = useCallback(
    (next: { key: string; field: "dateFrom" | "dateTo" } | null) => {
      setDatePicker(next);
      setOpen(Boolean(next));
    },
    []
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOnOutsideInteraction = (event: PointerEvent | MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        contentRef.current?.contains(target) ||
        triggerRef.current?.contains(target) ||
        target.closest('[data-slot="select-content"]')
      ) {
        return;
      }
      setDatePicker(null);
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideInteraction);
    document.addEventListener("click", closeOnOutsideInteraction);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideInteraction);
      document.removeEventListener("click", closeOnOutsideInteraction);
    };
  }, [open]);

  const columns = useMemo<FeePlanningColumn[]>(() => {
    const header = (title: string) =>
      function FeePlanningColumnHeader({
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
    const dateColumn = (
      field: "dateFrom" | "dateTo",
      title: string
    ): FeePlanningColumn => ({
      accessorKey: field,
      id: field,
      header: header(title),
      cell: ({ row }) => {
        const line = row.original;
        const isOpen =
          datePicker?.key === line.key && datePicker.field === field && open;
        const selectedDate = parseIsoDate(line[field]);
        const workdaySummary = getCmpHongKongWorkdaySummary(
          line.dateFrom,
          line.dateTo
        );
        const dateSummary = workdaySummary
          ? copy.feePlanningDateSummary
              .replace("{workdays}", String(workdaySummary.workdays))
              .replace("{leaveDays}", String(workdaySummary.leaveDays))
          : line.dateFrom && line.dateTo
            ? copy.feePlanningDateSummaryUnavailable
            : undefined;
        return (
          <Popover
            open={isOpen}
            onOpenChange={(nextOpen) =>
              openDatePicker(nextOpen ? { key: line.key, field } : null)
            }
          >
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex w-full" />}>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-description={dateSummary}
                      disabled={disabled}
                      className="w-full justify-start truncate font-normal"
                      ref={triggerRef}
                    />
                  }
                >
                  <CalendarDays className="size-3.5" />
                  {selectedDate
                    ? selectedDate.toLocaleDateString(locale)
                    : copy.feePlanningDateEmpty}
                </PopoverTrigger>
              </TooltipTrigger>
              {dateSummary ? (
                <TooltipContent>{dateSummary}</TooltipContent>
              ) : null}
            </Tooltip>
            <PopoverContent
              side="bottom"
              align="start"
              className="w-fit p-0"
              data-slot="budget-calendar-preset-surface"
              ref={contentRef}
            >
              <Calendar
                mode="single"
                selected={selectedDate}
                captionLayout="dropdown"
                className="[--cell-size:--spacing(9.5)]"
                locale={locale === "zh-CN" ? zhCN : enUS}
                onSelect={(date) => {
                  if (!date) {
                    return;
                  }
                  onUpdateDate(line.key, field, formatIsoDate(date));
                }}
              />
              <ButtonGroup
                data-slot="budget-calendar-preset-footer"
                className="w-full border-t border-border/40 bg-card"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  data-action="today"
                  onClick={() =>
                    onUpdateDate(line.key, field, formatIsoDate(new Date()))
                  }
                >
                  {copy.feePlanningToday}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => onUpdateDate(line.key, field, "")}
                >
                  {copy.clear}
                </Button>
              </ButtonGroup>
            </PopoverContent>
          </Popover>
        );
      },
      enableHiding: false,
      enableResizing: true,
      enableSorting: true,
      filterFn: cmpSelectedValuesFilter,
      meta: { autoSize: true, headerTitle: title },
      size: 180,
    });
    return [
      {
        id: "grade",
        accessorFn: (row) =>
          row.grade
            ? CMP_ENGAGEMENT_FEE_PLAN_GRADE_LABELS[row.grade][language]
            : "",
        header: header(copy.feePlanningGrade),
        cell: ({ row }) => {
          const line = row.original;
          const availableGrades =
            line.grade &&
            !CMP_ENGAGEMENT_FEE_PLAN_ACTIVE_GRADES.some(
              (grade) => grade === line.grade
            )
              ? [...CMP_ENGAGEMENT_FEE_PLAN_ACTIVE_GRADES, line.grade]
              : CMP_ENGAGEMENT_FEE_PLAN_ACTIVE_GRADES;
          return (
            <Select
              value={line.grade}
              disabled={disabled || !rateAvailable}
              onValueChange={(selectedValue) => {
                const grade = selectedValue as CmpEngagementFeePlanGrade;
                onUpdate(line.key, {
                  grade,
                  hourlyRate: hourlyRate(grade, hkdPerUnit),
                });
              }}
            >
              <SelectTrigger
                aria-label={copy.feePlanningGrade}
                size="sm"
                className="w-full min-w-0"
              >
                <SelectValue placeholder={copy.feePlanningSelectGrade}>
                  {line.grade
                    ? CMP_ENGAGEMENT_FEE_PLAN_GRADE_LABELS[line.grade][language]
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableGrades.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {CMP_ENGAGEMENT_FEE_PLAN_GRADE_LABELS[grade][language]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.feePlanningGrade },
        size: 170,
      },
      {
        id: "staff",
        accessorFn: (row) =>
          row.assignmentType === "TBC"
            ? "TBC"
            : (staffNameById.get(row.staffUserId) ?? ""),
        header: header(copy.feePlanningStaffName),
        cell: ({ row }) => {
          const staffLabel =
            row.original.assignmentType === "TBC"
              ? "TBC"
              : row.original.staffUserId
                ? (staffNameById.get(row.original.staffUserId) ??
                  row.original.staffUserId)
                : copy.feePlanningAssignStaff;
          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onOpenStaff(row.original.key)}
            >
              <UserRound className="size-4" />
              <span className="max-w-40 truncate">{staffLabel}</span>
            </Button>
          );
        },
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.feePlanningStaffName },
        size: 170,
      },
      dateColumn("dateFrom", copy.feePlanningDateFrom),
      dateColumn("dateTo", copy.feePlanningDateTo),
      {
        id: "hourlyRate",
        accessorFn: (row) => Number(row.hourlyRate || 0),
        header: header(copy.feePlanningFixedHourlyRate),
        cell: ({ row }) => (
          <span className="block truncate text-right text-foreground tabular-nums">
            {row.original.hourlyRate
              ? formatMoney(locale, currency, Number(row.original.hourlyRate))
              : "—"}
          </span>
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.feePlanningFixedHourlyRate },
        size: 170,
      },
      {
        accessorKey: "budgetHours",
        id: "budgetHours",
        header: header(copy.feePlanningRequiredHoursPerPerson),
        cell: ({ row }) => (
          <Input
            aria-label={copy.feePlanningRequiredHoursPerPerson}
            type="number"
            min="0"
            step="0.01"
            value={row.original.budgetHours}
            disabled={disabled}
            onChange={(event) =>
              onUpdate(row.original.key, {
                budgetHours: event.target.value,
              })
            }
          />
        ),
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: {
          autoSize: true,
          headerTitle: copy.feePlanningRequiredHoursPerPerson,
        },
        size: 160,
      },
      {
        id: "total",
        accessorFn: (row) =>
          Number(row.hourlyRate || 0) * Number(row.budgetHours || 0),
        header: header(copy.feePlanningTotal),
        cell: ({ row }) => {
          const lineTotal =
            Number(row.original.hourlyRate || 0) *
            Number(row.original.budgetHours || 0);
          return (
            <span className="block truncate text-right text-foreground tabular-nums">
              {Number.isFinite(lineTotal)
                ? formatMoney(locale, currency, lineTotal)
                : "—"}
            </span>
          );
        },
        enableHiding: false,
        enableResizing: true,
        enableSorting: true,
        filterFn: cmpSelectedValuesFilter,
        meta: { autoSize: true, headerTitle: copy.feePlanningTotal },
        size: 170,
      },
      {
        id: "actions",
        header: copy.action,
        cell: ({ row }) => (
          <ButtonGroup>
            <Button
              type="button"
              size="icon-sm"
              variant="quiet"
              aria-label={copy.feePlanningDeleteRow}
              disabled={disabled}
              onClick={() => onDelete(row.original.key)}
            >
              <Trash2 />
            </Button>
          </ButtonGroup>
        ),
        enableHiding: false,
        enableResizing: false,
        enableSorting: false,
        meta: { headerTitle: copy.action },
        size: 72,
      },
    ];
  }, [
    copy,
    currency,
    datePicker,
    disabled,
    hkdPerUnit,
    language,
    locale,
    menuCopy,
    onDelete,
    onOpenStaff,
    onUpdate,
    onUpdateDate,
    openDatePicker,
    open,
    rateAvailable,
    staffNameById,
  ]);

  return (
    <div className="grid gap-3" data-validation-field="feePlanningLines">
      <header className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">{copy.feePlanningDetails}</h4>
          <span className="text-xs text-muted-foreground">{value.length}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !rateAvailable}
          onClick={onAdd}
        >
          <Plus className="size-4" />
          {copy.feePlanningAddRow}
        </Button>
      </header>
      <div className="cmp-horizontal-data-scrollbar min-w-0 overflow-x-auto overscroll-x-contain pb-2">
        <div className="min-w-[74rem]">
          <CmpMasterDataGrid
            mobile={{ titleColumn: "staff", editable: true }}
            columns={columns}
            data={value}
            emptyMessage={copy.feePlanningEmpty}
            getRowId={(row) => row.key}
            initialSorting={[]}
            showRecordCount={false}
            showRowSelection={false}
            showToolbar={false}
            tableLabel={copy.feePlanningDetails}
            tableLayout={{ headerSticky: false, columnsVisibility: false }}
            testId="cmp-engagement-fee-planning-data-grid"
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
          {formatMoney(locale, currency, standardValue || 0)}
        </strong>
      </div>
    </div>
  );
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return;
  }
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function hourlyRate(grade: CmpEngagementFeePlanGrade, hkdPerUnit: number) {
  return hkdPerUnit > 0
    ? (CMP_ENGAGEMENT_FEE_PLAN_GRADE_RATES[grade] / hkdPerUnit).toFixed(2)
    : "";
}
