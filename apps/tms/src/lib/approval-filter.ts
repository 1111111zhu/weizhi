import type {
  TmsApprovalProject,
  TmsApprovalRecord,
} from "@project-wing/shared";

import { buildPeriodDays } from "@/lib/timesheet";
import type { PeriodKey } from "@/lib/timesheet";

export type ApprovalRecordGroup = {
  id: string;
  projectId: string | null | undefined;
  projectCode: string | null | undefined;
  projectName: string | null | undefined;
  ownerUserId: string;
  ownerName: string;
  allRecords: TmsApprovalRecord[];
  records: TmsApprovalRecord[];
  matchedHalves: ("FIRST_HALF" | "SECOND_HALF")[];
  status: TmsApprovalRecord["status"];
};

const APPROVAL_GROUP_STATUS_PRIORITY: TmsApprovalRecord["status"][] = [
  "PENDING_CONFIRMATION",
  "SUBMITTED",
  "RETURNED",
  "APPROVED",
  "NOT_SUBMITTED",
];
const APPROVAL_HALVES = ["FIRST_HALF", "SECOND_HALF"] as const;

export function selectApprovalProjects(projects: TmsApprovalProject[]) {
  return projects.filter((project) => project.status !== "ARCHIVED");
}

function getApprovalGroupStatus(records: TmsApprovalRecord[]) {
  return (
    APPROVAL_GROUP_STATUS_PRIORITY.find((status) =>
      records.some((record) => record.status === status)
    ) ?? "NOT_SUBMITTED"
  );
}

function matchesPeriod(record: TmsApprovalRecord, period: PeriodKey) {
  return (
    period === "all" ||
    (period === "first" && record.half === "FIRST_HALF") ||
    (period === "second" && record.half === "SECOND_HALF")
  );
}

function getRecordForHalf(
  records: TmsApprovalRecord[],
  half: (typeof APPROVAL_HALVES)[number]
) {
  return records.find((record) => record.half === half);
}

function recordHasMissingWorkday(record: TmsApprovalRecord) {
  const period = record.half === "FIRST_HALF" ? "first" : "second";
  const days = buildPeriodDays(record.year, record.month, period);
  return days.some(
    (day) =>
      day.isWorkday &&
      record.submittedRows.reduce(
        (total, row) => total + (row.hoursByDate[day.date] ?? 0),
        0
      ) === 0
  );
}

function recordMatchesStatus(
  record: TmsApprovalRecord,
  status: TmsApprovalRecord["status"]
) {
  if (status === "NOT_SUBMITTED") {
    return record.status === "NOT_SUBMITTED" || recordHasMissingWorkday(record);
  }
  return record.status === status;
}

function getMatchingHalves(
  records: TmsApprovalRecord[],
  statusFilters: TmsApprovalRecord["status"][],
  period: PeriodKey
) {
  const allowedHalves =
    period === "first"
      ? new Set(["FIRST_HALF"])
      : period === "second"
        ? new Set(["SECOND_HALF"])
        : new Set(APPROVAL_HALVES);
  if (statusFilters.length === 0) {
    return records
      .map((record) => record.half)
      .filter((half) => allowedHalves.has(half));
  }

  return APPROVAL_HALVES.filter((half) => {
    if (!allowedHalves.has(half)) {
      return false;
    }
    const record = getRecordForHalf(records, half);
    return record
      ? statusFilters.some((status) => recordMatchesStatus(record, status))
      : statusFilters.includes("NOT_SUBMITTED");
  });
}

export function selectApprovalGroups(
  records: TmsApprovalRecord[],
  period: PeriodKey,
  statusFilters: TmsApprovalRecord["status"][],
  nameFilters: string[]
): ApprovalRecordGroup[] {
  const grouped = new Map<string, TmsApprovalRecord[]>();

  for (const record of records) {
    if (nameFilters.length > 0 && !nameFilters.includes(record.ownerName)) {
      continue;
    }
    const groupKey = `${record.projectId ?? "legacy"}:${record.ownerUserId}`;
    const current = grouped.get(groupKey) ?? [];
    current.push(record);
    grouped.set(groupKey, current);
  }

  return [...grouped.values()]
    .map((ownerRecords) => {
      const allRecords = ownerRecords.filter((record) =>
        matchesPeriod(record, period)
      );
      const matchedHalves = getMatchingHalves(
        allRecords,
        statusFilters,
        period
      );
      const matchingRecords =
        statusFilters.length > 0
          ? allRecords.filter((record) => matchedHalves.includes(record.half))
          : allRecords;
      const groupId =
        period === "all" && allRecords.length > 1
          ? `approval-group-${ownerRecords[0].projectId ?? "legacy"}-${ownerRecords[0].ownerUserId}`
          : (allRecords[0]?.id ??
            `approval-missing-${ownerRecords[0].ownerUserId}-${period}`);

      return {
        id: groupId,
        projectId: ownerRecords[0].projectId,
        projectCode: ownerRecords[0].projectCode,
        projectName: ownerRecords[0].projectName,
        ownerUserId: ownerRecords[0].ownerUserId,
        ownerName: ownerRecords[0].ownerName,
        allRecords,
        records: matchingRecords,
        matchedHalves,
        status: getApprovalGroupStatus(matchingRecords),
      };
    })
    .filter((group) =>
      statusFilters.length > 0
        ? group.matchedHalves.length > 0
        : group.allRecords.length > 0
    );
}

export function recommendApprovalPeriod(
  records: TmsApprovalRecord[],
  statusFilters: TmsApprovalRecord["status"][],
  nameFilters: string[]
): Extract<PeriodKey, "all" | "first" | "second"> {
  if (statusFilters.length === 0) {
    return "all";
  }

  const groups = selectApprovalGroups(
    records,
    "all",
    statusFilters,
    nameFilters
  );
  const matchedHalves = new Set(groups.flatMap((group) => group.matchedHalves));
  if (matchedHalves.size !== 1) {
    return "all";
  }
  return matchedHalves.has("FIRST_HALF") ? "first" : "second";
}
