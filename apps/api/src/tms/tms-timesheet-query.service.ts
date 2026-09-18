import { Injectable } from "@nestjs/common";
import type {
  TmsApprovalStatus,
  TmsTimesheetQueryDetailRow,
  TmsTimesheetQueryInput,
  TmsTimesheetQueryResponse,
  TmsTimesheetRow,
} from "@project-wing/shared";
import { TmsTimesheetQueryResponseSchema } from "@project-wing/shared";

import type { RequestUser } from "../auth/request-user";
import { ApiForbiddenException } from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";

type QuerySource = {
  engagementId: string;
  half: "FIRST_HALF" | "SECOND_HALF";
  month: QueryMonth;
  rows: TmsTimesheetRow[];
  status: TmsApprovalStatus | undefined;
};

type QueryMonth = {
  userId: string;
  year: number;
  month: number;
  draftRows: unknown;
  user: {
    id: string;
    name: string;
    staffNo: string | null;
    hourlyRate: unknown;
    status: "ACTIVE" | "DISABLED";
    authSessions: { id: string }[];
  };
};

@Injectable()
export class TmsTimesheetQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async query(
    actor: RequestUser,
    input: TmsTimesheetQueryInput
  ): Promise<TmsTimesheetQueryResponse> {
    this.assertRole(actor);
    const rows = await this.buildDetailRows(input);
    const output =
      input.mode === "SUMMARY" ? this.summarize(rows, input) : rows;
    const start = (input.page - 1) * input.pageSize;
    return TmsTimesheetQueryResponseSchema.parse({
      mode: input.mode,
      rows: output.slice(start, start + input.pageSize),
      total: output.length,
      page: input.page,
      pageSize: input.pageSize,
    });
  }

  async queryAll(actor: RequestUser, input: TmsTimesheetQueryInput) {
    this.assertRole(actor);
    const rows = await this.buildDetailRows(input);
    return input.mode === "SUMMARY" ? this.summarize(rows, input) : rows;
  }

  private async buildDetailRows(input: TmsTimesheetQueryInput) {
    const now = new Date();
    const months = (await this.prisma.tmsTimesheetMonth.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            staffNo: true,
            hourlyRate: true,
            status: true,
            authSessions: {
              where: { expiresAt: { gt: now } },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    })) as unknown as QueryMonth[];
    const submissions = await this.prisma.tmsApprovalSubmission.findMany({
      where: { ownerUserId: { in: months.map((item) => item.userId) } },
      orderBy: { revision: "desc" },
    });
    const latest = new Map<string, (typeof submissions)[number]>();
    for (const record of submissions) {
      const key = submissionKey(record);
      if (!latest.has(key)) {
        latest.set(key, record);
      }
    }
    const sources: QuerySource[] = [];
    for (const month of months) {
      const draftRows = readRows(month.draftRows);
      for (const half of ["FIRST_HALF", "SECOND_HALF"] as const) {
        const periodRecords = [...latest.values()].filter(
          (record) =>
            record.ownerUserId === month.userId &&
            record.year === month.year &&
            record.month === month.month &&
            record.half === half
        );
        const submittedEngagementIds = new Set(
          periodRecords.map((record) => record.engagementId)
        );
        for (const record of periodRecords) {
          sources.push({
            engagementId: record.engagementId,
            half,
            month,
            rows: readRows(record.submittedRows),
            status: record.status,
          });
        }
        const draftEngagementIds = new Set(
          draftRows
            .map(getEngagementId)
            .filter((value): value is string => Boolean(value))
        );
        for (const engagementId of draftEngagementIds) {
          if (submittedEngagementIds.has(engagementId)) {
            continue;
          }
          sources.push({
            engagementId,
            half,
            month,
            rows: draftRows,
            status: undefined,
          });
        }
      }
    }
    const engagementIds = [
      ...new Set(sources.map((item) => item.engagementId)),
    ];
    const engagements = await this.prisma.cmpEngagement.findMany({
      where: { id: { in: engagementIds } },
      select: {
        id: true,
        engagementCode: true,
        agreedFee: true,
        picUser: { select: { name: true } },
        micUser: { select: { name: true } },
        client: { select: { nameEn: true } },
      },
    });
    const engagementById = new Map(
      engagements.map((engagement) => [engagement.id, engagement])
    );
    const grouped = new Map<
      string,
      TmsTimesheetQueryDetailRow & { userId: string }
    >();
    for (const source of sources) {
      const engagement = engagementById.get(source.engagementId);
      if (!engagement) {
        continue;
      }
      for (const row of source.rows) {
        if (
          row.type !== "Chargeable" ||
          getEngagementId(row) !== source.engagementId
        ) {
          continue;
        }
        const workType = row.workType ?? row.details;
        for (const [date, hours] of Object.entries(row.hoursByDate)) {
          if (!isDateInHalf(date, source.half) || hours <= 0) {
            continue;
          }
          if (input.dateFrom && date < input.dateFrom) {
            continue;
          }
          if (input.dateTo && date > input.dateTo) {
            continue;
          }
          const status = toQueryStatus(source.status);
          const key = `${source.month.userId}:${source.engagementId}:${date}:${status}`;
          const rate = decimalString(source.month.user.hourlyRate);
          const current = grouped.get(key) ?? {
            userId: source.month.userId,
            jobCode: engagement.engagementCode,
            staffNo: source.month.user.staffNo,
            staffName: source.month.user.name,
            timesheetDate: date,
            rate,
            normal: 0,
            ot: 0,
            absent: 0,
            total: rate ? "0.00" : null,
            clientName: engagement.client.nameEn ?? "",
            netBudgetFee: decimalString(engagement.agreedFee),
            pic: engagement.picUser?.name ?? null,
            mic: engagement.micUser?.name ?? null,
            timesheetStatus: status,
            activeStatus: toActiveStatus(
              source.month.user.status,
              source.month.user.authSessions.length > 0
            ),
          };
          if (workType === "Normal") {
            current.normal += hours;
          }
          if (workType === "OT") {
            current.ot += hours;
          }
          if (workType === "Absent") {
            current.absent += hours;
          }
          current.total = rate
            ? (Number(rate) * (current.normal + current.ot)).toFixed(2)
            : null;
          grouped.set(key, current);
        }
      }
    }
    return [...grouped.values()]
      .filter((row) => matchesFilters(row, input))
      .sort((left, right) => compareRows(left, right, input));
  }

  private summarize(
    rows: (TmsTimesheetQueryDetailRow & { userId: string })[],
    input: TmsTimesheetQueryInput
  ) {
    const grouped = new Map<
      string,
      ReturnType<typeof makeSummaryRow> & { userId: string }
    >();
    for (const row of rows) {
      const key = `${row.userId}:${row.jobCode}`;
      const current = grouped.get(key) ?? makeSummaryRow(row, input);
      current.normal += row.normal;
      current.ot += row.ot;
      current.absent += row.absent;
      current.total = row.rate
        ? (Number(row.rate) * (current.normal + current.ot)).toFixed(2)
        : null;
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((left, right) =>
      compareRows(left, right, input)
    );
  }

  private assertRole(actor: RequestUser) {
    if (actor.globalRole !== "PARTNER" && actor.globalRole !== "MANAGER") {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "只有 Partner 或 Manager 可以查询工时"
      );
    }
  }
}

function readRows(value: unknown): TmsTimesheetRow[] {
  return Array.isArray(value) ? (value as TmsTimesheetRow[]) : [];
}

function getEngagementId(row: TmsTimesheetRow) {
  const value = (row as TmsTimesheetRow & { engagementId?: unknown })
    .engagementId;
  return typeof value === "string" ? value : null;
}

function submissionKey(record: {
  ownerUserId: string;
  engagementId: string;
  year: number;
  month: number;
  half: string;
}) {
  return `${record.ownerUserId}:${record.engagementId}:${record.year}:${record.month}:${record.half}`;
}

function isDateInHalf(date: string, half: "FIRST_HALF" | "SECOND_HALF") {
  const day = Number(date.slice(8, 10));
  return half === "FIRST_HALF" ? day <= 15 : day >= 16;
}

function toQueryStatus(status: TmsApprovalStatus | undefined) {
  if (status === "APPROVED") {
    return "APPROVED" as const;
  }
  if (status === "RETURNED") {
    return "RETURNED" as const;
  }
  if (status === "SUBMITTED" || status === "PENDING_CONFIRMATION") {
    return "SUBMITTED" as const;
  }
  return "DRAFT" as const;
}

function toActiveStatus(
  status: "ACTIVE" | "DISABLED",
  hasValidSession: boolean
) {
  if (status === "DISABLED") {
    return "LEAVE" as const;
  }
  return hasValidSession ? ("ACTIVE" as const) : ("OFF_LINE" as const);
}

function decimalString(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(String(value));
  return Number.isFinite(number) ? number.toFixed(2) : null;
}

function matchesFilters(
  row: TmsTimesheetQueryDetailRow,
  input: TmsTimesheetQueryInput
) {
  return (
    includes(row.staffName, input.staffName) &&
    includes(row.staffNo ?? "", input.staffNo) &&
    includes(row.jobCode, input.jobCode) &&
    includes(row.pic ?? "", input.pic) &&
    includes(row.mic ?? "", input.mic) &&
    (!input.timesheetStatus || row.timesheetStatus === input.timesheetStatus) &&
    (!input.activeStatus || row.activeStatus === input.activeStatus)
  );
}

function includes(value: string, query: string | undefined) {
  return (
    !query || normalizeSearchText(value).includes(normalizeSearchText(query))
  );
}

function normalizeSearchText(value: string) {
  return value.replaceAll(/\s+/g, "").toLowerCase();
}

function compareRows(
  left: Pick<
    TmsTimesheetQueryDetailRow,
    "jobCode" | "staffName" | "clientName"
  > & { timesheetDate?: string },
  right: Pick<
    TmsTimesheetQueryDetailRow,
    "jobCode" | "staffName" | "clientName"
  > & { timesheetDate?: string },
  input: TmsTimesheetQueryInput
) {
  const key =
    input.sortBy === "STAFF_NAME"
      ? "staffName"
      : input.sortBy === "TIMESHEET_DATE"
        ? "timesheetDate"
        : input.sortBy === "CLIENT_NAME"
          ? "clientName"
          : "jobCode";
  const result = String(left[key] ?? "").localeCompare(
    String(right[key] ?? "")
  );
  return input.sortDirection === "desc" ? -result : result;
}

function makeSummaryRow(
  row: TmsTimesheetQueryDetailRow & { userId: string },
  input: TmsTimesheetQueryInput
) {
  return {
    userId: row.userId,
    jobCode: row.jobCode,
    staffNo: row.staffNo,
    staffName: row.staffName,
    rate: row.rate,
    normal: 0,
    ot: 0,
    absent: 0,
    total: row.rate ? "0.00" : null,
    clientName: row.clientName,
    netBudgetFee: row.netBudgetFee,
    pic: row.pic,
    mic: row.mic,
    timesheetStatus: row.timesheetStatus,
    activeStatus: row.activeStatus,
    dateFrom: input.dateFrom || null,
    dateTo: input.dateTo || null,
  };
}
