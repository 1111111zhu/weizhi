import type { TmsApprovalRecord } from "@project-wing/shared";
import { useMemo } from "react";

import {
  BodyCell,
  DashboardPanel,
  HeaderCell,
  daySurfaceClass,
  formatPeriodHours,
} from "@/components/timesheet-workspace";
import { getTmsWorkspaceCopy } from "@/i18n/dictionaries";
import type { TmsWorkspaceCopy } from "@/i18n/dictionaries";
import type { TmsLocale } from "@/i18n/settings";
import {
  buildApprovalReviewModel,
  isApprovalReviewException,
} from "@/lib/approval-review";
import type { ApprovalReviewModel } from "@/lib/approval-review";
import type { PeriodDay, PeriodKey } from "@/lib/timesheet";

import { ApprovalColumnFilterHeader } from "./approval-column-filter-header";
import { ResizableReviewPanel } from "./resizable-review-panel";

const EMPTY_NAME_FILTERS: string[] = [];

type ApprovalReviewDashboardProps = {
  userId: string;
  records: TmsApprovalRecord[];
  days: PeriodDay[];
  period: PeriodKey;
  nameFilters?: string[];
  onNameFiltersChange?: (values: string[]) => void;
  locale?: TmsLocale;
};

function displayDay(
  day: ApprovalReviewModel["employees"][number]["daily"][number],
  copy: TmsWorkspaceCopy
) {
  if (day.state === "weekend") {
    return "—";
  }
  if (day.state === "missing") {
    return copy.missing;
  }
  return formatPeriodHours(day.hours);
}

function reviewDayClass(
  day: ApprovalReviewModel["employees"][number]["daily"][number]
) {
  if (day.state === "missing") {
    return "border-b-2 border-b-destructive-accent bg-destructive-subtle text-foreground";
  }
  if (day.state === "underfilled") {
    return "border-b-2 border-b-warning-accent bg-warning-subtle text-foreground";
  }
  if (day.state === "overfilled") {
    return "border-b-2 border-b-destructive-accent bg-destructive-subtle text-foreground";
  }
  return daySurfaceClass(day);
}

function SubmissionNotice({
  copy,
  missingNames,
}: {
  copy: TmsWorkspaceCopy;
  missingNames: string[];
}) {
  if (missingNames.length === 0) {
    return (
      <div className="mt-2 rounded-md border border-l-2 border-border border-l-success-accent bg-success-subtle px-2 py-1 text-[0.68rem] font-medium text-foreground">
        {copy.allEmployeesSubmitted}
      </div>
    );
  }

  return (
    <div className="mt-1.5 rounded-md border border-l-2 border-border border-l-warning-accent bg-warning-subtle px-2 py-1">
      <div className="flex items-center justify-between gap-2 text-[0.68rem] font-semibold text-foreground">
        <span>{copy.statusNotSubmitted}</span>
        <span>{missingNames.length}</span>
      </div>
      <p className="mt-1 text-[0.68rem] break-words text-foreground">
        {missingNames.join("、")}
      </p>
    </div>
  );
}

function ApprovalReviewDetailTable({
  copy,
  filterLabel,
  days,
  employees,
  nameFilterOptions,
  nameFilters,
  onNameFiltersChange,
}: {
  copy: TmsWorkspaceCopy;
  filterLabel: string;
  days: PeriodDay[];
  employees: ApprovalReviewModel["employees"];
  nameFilterOptions: { value: string; label: string }[];
  nameFilters: string[];
  onNameFiltersChange?: (values: string[]) => void;
}) {
  const detailEmployees = employees.filter((employee) =>
    employee.daily.some(isApprovalReviewException)
  );
  const detailDays = days.filter((day) =>
    detailEmployees.some((employee) =>
      employee.daily.some(
        (employeeDay) =>
          employeeDay.date === day.date &&
          isApprovalReviewException(employeeDay)
      )
    )
  );

  return (
    <section
      data-testid="approval-review-detail"
      className="grid min-h-40 grid-rows-[1.15rem_minmax(0,1fr)] gap-1.5 p-2.5"
    >
      <h2 className="flex h-[1.15rem] items-start text-xs font-semibold">
        {copy.exceptionDetails}
      </h2>
      <div className="overflow-x-auto rounded-md border border-border">
        {detailEmployees.length > 0 && detailDays.length > 0 ? (
          <table
            data-testid="approval-review-detail-table"
            className="min-w-full table-fixed border-collapse text-xs"
          >
            <thead className="bg-muted/70 text-muted-foreground">
              <tr>
                <HeaderCell className="sticky left-0 z-10 w-[126px] bg-muted/95">
                  <ApprovalColumnFilterHeader
                    label={filterLabel}
                    options={nameFilterOptions}
                    selectedValues={nameFilters}
                    onChange={onNameFiltersChange ?? (() => {})}
                    trigger={
                      <span className="block truncate whitespace-nowrap">
                        {copy.employee}
                      </span>
                    }
                  />
                </HeaderCell>
                {detailDays.map((day) => (
                  <HeaderCell key={day.date} className="w-[46px] text-center">
                    <span className="block">{day.dayOfMonth}</span>
                    <span className="text-[0.62rem]">{day.weekdayLabel}</span>
                  </HeaderCell>
                ))}
              </tr>
            </thead>
            <tbody>
              {detailEmployees.map((employee) => (
                <tr
                  key={employee.ownerUserId}
                  className="border-t border-border"
                >
                  <BodyCell className="sticky left-0 z-10 w-[126px] bg-card text-center font-medium">
                    {employee.ownerName}
                  </BodyCell>
                  {detailDays.map((day) => {
                    const reviewDay = employee.daily.find(
                      (employeeDay) => employeeDay.date === day.date
                    );
                    const isException = reviewDay
                      ? isApprovalReviewException(reviewDay)
                      : false;

                    return (
                      <BodyCell
                        key={day.date}
                        {...(isException && reviewDay
                          ? {
                              "data-testid": `approval-review-cell-${employee.ownerUserId}-${day.date}`,
                              "data-review-cell-state": reviewDay.state,
                            }
                          : {})}
                        className={`w-[46px] text-center font-semibold tabular-nums ${isException && reviewDay ? reviewDayClass(reviewDay) : ""}`}
                      >
                        {isException && reviewDay
                          ? displayDay(reviewDay, copy)
                          : null}
                      </BodyCell>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-6 text-center text-xs text-muted-foreground">
            {copy.noExceptionData}
          </p>
        )}
      </div>
    </section>
  );
}

export function approvalReviewStorageKey(userId: string) {
  return `project-wing:tms:approval-review-panel:${userId}`;
}

export function ApprovalReviewDashboard({
  userId,
  records,
  days,
  period,
  nameFilters = EMPTY_NAME_FILTERS,
  onNameFiltersChange,
  locale,
}: ApprovalReviewDashboardProps) {
  const effectiveLocale = locale ?? "zh-CN";
  const copy = getTmsWorkspaceCopy(effectiveLocale);
  const nameFilterOptions = useMemo(
    () =>
      [...new Set(records.map((record) => record.ownerName))]
        .sort()
        .map((value) => ({ value, label: value })),
    [records]
  );
  const model = useMemo(
    () => buildApprovalReviewModel(records, days, { period, nameFilters }),
    [days, nameFilters, period, records]
  );
  const totalEmployees = model.employees.length;
  const missingEmployees = model.employees.filter((employee) =>
    employee.daily.some((day) => day.state === "missing")
  ).length;
  const submittedEmployees = totalEmployees - missingEmployees;
  const submissionPercent = totalEmployees
    ? Math.round((submittedEmployees / totalEmployees) * 100)
    : 0;
  const missingNames = model.employees
    .filter((employee) => employee.daily.some((day) => day.state === "missing"))
    .map((employee) => employee.ownerName);

  return (
    <div data-testid="approval-review-dashboard" className="min-h-0 shrink-0">
      <ResizableReviewPanel
        resizeLabel={copy.resizeReviewDashboard}
        storageKey={approvalReviewStorageKey(userId)}
      >
        <section
          data-testid="approval-review-board"
          className="grid h-full min-h-40 rounded-lg border border-border bg-card shadow-sm md:grid-cols-[1.1fr_2.8fr]"
        >
          <DashboardPanel
            title={copy.submissionOverview}
            segments={[
              {
                label: copy.statusSubmitted,
                value: submittedEmployees,
                color: "var(--success)",
              },
              {
                label: copy.statusNotSubmitted,
                value: missingEmployees,
                color: "var(--muted)",
              },
            ]}
            center={<span>{submissionPercent}%</span>}
            details={[
              {
                label: copy.statusSubmitted,
                value: String(submittedEmployees),
              },
              {
                label: copy.statusNotSubmitted,
                value: String(missingEmployees),
              },
              { label: copy.employees, value: String(totalEmployees) },
            ]}
            notice={
              <SubmissionNotice copy={copy} missingNames={missingNames} />
            }
          />
          <ApprovalReviewDetailTable
            days={days}
            employees={model.employees}
            filterLabel={locale ? copy.name : getTmsWorkspaceCopy("en-US").name}
            nameFilterOptions={nameFilterOptions}
            nameFilters={nameFilters}
            onNameFiltersChange={onNameFiltersChange}
            copy={copy}
          />
        </section>
      </ResizableReviewPanel>
    </div>
  );
}
