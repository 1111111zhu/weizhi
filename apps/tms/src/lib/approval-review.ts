import type {
  TmsApprovalRecord,
  TmsApprovalStatus,
  TmsTimesheetHalf,
} from "@project-wing/shared";

import type { PeriodDay, PeriodKey } from "./timesheet";

export const APPROVAL_REVIEW_STATUSES: TmsApprovalStatus[] = [
  "NOT_SUBMITTED",
  "RETURNED",
  "PENDING_CONFIRMATION",
  "SUBMITTED",
  "APPROVED",
];

const APPROVAL_REVIEW_STATUS_PRIORITY: Record<TmsApprovalStatus, number> = {
  NOT_SUBMITTED: 0,
  RETURNED: 1,
  PENDING_CONFIRMATION: 2,
  SUBMITTED: 3,
  APPROVED: 4,
};

export type ApprovalReviewDayState =
  | "weekend"
  | "missing"
  | "underfilled"
  | "overfilled"
  | "complete";

export type ApprovalReviewDay = PeriodDay & {
  half: TmsTimesheetHalf;
  hours: number;
  state: ApprovalReviewDayState;
};

export type ApprovalReviewEmployee = {
  ownerUserId: string;
  ownerName: string;
  status: TmsApprovalStatus;
  daily: ApprovalReviewDay[];
};

export type ApprovalReviewModel = {
  employees: ApprovalReviewEmployee[];
  statusCounts: Record<TmsApprovalStatus, number>;
  attentionEmployeeNames: string[];
  attentionDateCount: number;
};

export type ApprovalReviewOptions = {
  period: PeriodKey;
  nameFilters?: string[];
};

export function isApprovalReviewException(
  day: Pick<ApprovalReviewDay, "state">
) {
  return (
    day.state === "missing" ||
    day.state === "underfilled" ||
    day.state === "overfilled"
  );
}

function selectedHalves(period: PeriodKey): TmsTimesheetHalf[] {
  if (period === "first") {
    return ["FIRST_HALF"];
  }
  if (period === "second") {
    return ["SECOND_HALF"];
  }
  return ["FIRST_HALF", "SECOND_HALF"];
}

function halfForDay(day: PeriodDay): TmsTimesheetHalf {
  return day.dayOfMonth <= 15 ? "FIRST_HALF" : "SECOND_HALF";
}

function sumHoursForDate(record: TmsApprovalRecord, date: string) {
  return record.submittedRows.reduce(
    (total, row) => total + (row.hoursByDate[date] ?? 0),
    0
  );
}

function aggregateStatus(statuses: TmsApprovalStatus[]) {
  return statuses.reduce<TmsApprovalStatus>(
    (current, status) =>
      APPROVAL_REVIEW_STATUS_PRIORITY[status] <
      APPROVAL_REVIEW_STATUS_PRIORITY[current]
        ? status
        : current,
    "APPROVED"
  );
}

function createStatusCounts(): Record<TmsApprovalStatus, number> {
  return {
    NOT_SUBMITTED: 0,
    SUBMITTED: 0,
    APPROVED: 0,
    RETURNED: 0,
    PENDING_CONFIRMATION: 0,
  };
}

export function buildApprovalReviewModel(
  records: TmsApprovalRecord[],
  days: PeriodDay[],
  { period, nameFilters = [] }: ApprovalReviewOptions
): ApprovalReviewModel {
  const halves = selectedHalves(period);
  const filteredRecords = records.filter(
    (record) =>
      (nameFilters.length === 0 || nameFilters.includes(record.ownerName)) &&
      halves.includes(record.half)
  );
  const employeesById = new Map<string, TmsApprovalRecord[]>();

  for (const record of filteredRecords) {
    const ownerRecords = employeesById.get(record.ownerUserId) ?? [];
    ownerRecords.push(record);
    employeesById.set(record.ownerUserId, ownerRecords);
  }

  const statusCounts = createStatusCounts();
  const employees = [...employeesById.values()].map((ownerRecords) => {
    const ownerByHalf = new Map(
      ownerRecords.map((record) => [record.half, record] as const)
    );
    const statuses = halves.map(
      (half) => ownerByHalf.get(half)?.status ?? "NOT_SUBMITTED"
    );
    const status = aggregateStatus(statuses);
    statusCounts[status] += 1;

    const daily = days.map((day) => {
      const half = halfForDay(day);
      const record = ownerByHalf.get(half);
      const hours = record ? sumHoursForDate(record, day.date) : 0;
      let state: ApprovalReviewDayState = "weekend";

      if (day.isWorkday) {
        state =
          !record || hours === 0
            ? "missing"
            : hours < 8
              ? "underfilled"
              : hours > 24
                ? "overfilled"
                : "complete";
      }

      return { ...day, half, hours, state };
    });

    return {
      ownerUserId: ownerRecords[0].ownerUserId,
      ownerName: ownerRecords[0].ownerName,
      status,
      daily,
    };
  });
  const attentionEmployees = employees.filter(
    (employee) =>
      employee.status !== "APPROVED" ||
      employee.daily.some(isApprovalReviewException)
  );

  return {
    employees,
    statusCounts,
    attentionEmployeeNames: attentionEmployees.map(
      (employee) => employee.ownerName
    ),
    attentionDateCount: employees.reduce(
      (total, employee) =>
        total + employee.daily.filter(isApprovalReviewException).length,
      0
    ),
  };
}
