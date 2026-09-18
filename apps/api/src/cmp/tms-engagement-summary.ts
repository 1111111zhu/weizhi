import type {
  TmsApprovalStatus,
  TmsEngagementSummary,
  TmsEngagementSummaryPeriod,
  TmsEngagementSummaryRow,
  TmsTimesheetRow,
} from "@project-wing/shared";

export type TmsSummaryMember = {
  userId: string;
  name: string;
};

export type TmsSummaryApprovalRecord = {
  userId: string;
  name: string;
  year: number;
  month: number;
  half: "FIRST_HALF" | "SECOND_HALF";
  revision: number;
  status: TmsApprovalStatus;
  rows: TmsTimesheetRow[];
};

type SummaryInput = {
  engagementId: string;
  members: TmsSummaryMember[];
  approvalRecords: TmsSummaryApprovalRecord[];
  directSubmissions: TmsSummaryApprovalRecord[];
};

type Hours = {
  normal: number;
  ot: number;
  absent: number;
};

const emptyHours = (): Hours => ({ normal: 0, ot: 0, absent: 0 });

export function buildTmsEngagementSummary({
  engagementId,
  members,
  approvalRecords,
  directSubmissions,
}: SummaryInput): TmsEngagementSummary {
  const owners = new Map<string, string>();
  for (const member of members) {
    owners.set(member.userId, member.name);
  }

  const approvedHours = new Map<string, Hours>();
  const draftHours = new Map<string, Hours>();
  const directUserIds = new Set(
    directSubmissions.map((record) => record.userId)
  );
  const periods: TmsEngagementSummaryPeriod[] = [];

  for (const record of latestRecords(approvalRecords)) {
    if (directUserIds.has(record.userId)) {
      continue;
    }
    const target = record.status === "APPROVED" ? approvedHours : draftHours;
    if (record.status === "NOT_SUBMITTED") {
      continue;
    }
    const hours = readRecordHours(record, engagementId);
    if (!hours) {
      continue;
    }
    addHours(target, record.userId, hours);
    owners.set(record.userId, owners.get(record.userId) ?? record.name);
    periods.push(periodFromRecord(record, hours, record.status === "APPROVED"));
  }

  for (const record of latestRecords(directSubmissions)) {
    const hours = readRecordHours(record, engagementId);
    if (!hours) {
      continue;
    }
    addHours(approvedHours, record.userId, hours);
    owners.set(record.userId, owners.get(record.userId) ?? record.name);
    periods.push(periodFromRecord(record, hours, true));
  }

  return {
    approved: buildSection(owners, approvedHours),
    draft: buildSection(owners, draftHours),
    periods: periods.sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        left.year - right.year ||
        left.month - right.month ||
        left.half.localeCompare(right.half)
    ),
  };
}

function latestRecords(records: TmsSummaryApprovalRecord[]) {
  const latest = new Map<string, TmsSummaryApprovalRecord>();
  for (const record of records) {
    const key = `${record.userId}:${record.year}:${record.month}:${record.half}`;
    const current = latest.get(key);
    if (!current || record.revision > current.revision) {
      latest.set(key, record);
    }
  }
  return [...latest.values()];
}

function readRecordHours(
  record: TmsSummaryApprovalRecord,
  engagementId: string
) {
  const relevantRows = record.rows.filter(
    (row) => row.type === "Chargeable" && readEngagementId(row) === engagementId
  );
  if (relevantRows.length === 0) {
    return null;
  }

  const hoursByType = emptyHours();
  for (const row of relevantRows) {
    const hours = Object.values(row.hoursByDate).reduce(
      (total, value) => total + value,
      0
    );
    const workType = row.workType ?? row.details;
    if (workType === "Normal") {
      hoursByType.normal += hours;
    }
    if (workType === "OT") {
      hoursByType.ot += hours;
    }
    if (workType === "Absent") {
      hoursByType.absent += hours;
    }
  }
  return hoursByType;
}

function addHours(target: Map<string, Hours>, userId: string, hours: Hours) {
  const current = target.get(userId) ?? emptyHours();
  current.normal += hours.normal;
  current.ot += hours.ot;
  current.absent += hours.absent;
  target.set(userId, current);
}

function periodFromRecord(
  record: TmsSummaryApprovalRecord,
  hours: Hours,
  approved: boolean
): TmsEngagementSummaryPeriod {
  return {
    userId: record.userId,
    name: record.name,
    year: record.year,
    month: record.month,
    half: record.half,
    revision: record.revision,
    status: record.status,
    bucket: approved ? "APPROVED" : "DRAFT",
    normal: hours.normal,
    ot: hours.ot,
    absent: hours.absent,
    total: hours.normal + hours.ot,
  };
}

function buildSection(
  owners: Map<string, string>,
  hoursByUser: Map<string, Hours>
) {
  const rows = [...owners].map(([userId, name]) =>
    rowFromHours(userId, name, hoursByUser.get(userId) ?? emptyHours())
  );
  return {
    rows,
    total: rowFromHours("total", "Total", sumHours(hoursByUser.values())),
  } satisfies TmsEngagementSummary["approved"];
}

function sumHours(hours: Iterable<Hours>): Hours {
  const total = emptyHours();
  for (const value of hours) {
    total.normal += value.normal;
    total.ot += value.ot;
    total.absent += value.absent;
  }
  return total;
}

function rowFromHours(
  userId: string,
  name: string,
  hours: Hours
): TmsEngagementSummaryRow {
  return {
    userId,
    name,
    budgetNormal: null,
    budgetOt: null,
    finalNormal: nullableHours(hours.normal),
    finalOt: nullableHours(hours.ot),
    absent: nullableHours(hours.absent),
    rate: null,
    budgetCost: null,
    actualCost: null,
    diff: null,
  };
}

function nullableHours(value: number) {
  return value > 0 ? value : null;
}

function readEngagementId(row: TmsTimesheetRow) {
  const value = (row as TmsTimesheetRow & { engagementId?: unknown })
    .engagementId;
  return typeof value === "string" ? value : null;
}
