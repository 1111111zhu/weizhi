import { renderWorkItemSentence } from "@project-wing/shared";
import type { WorkItem } from "@project-wing/shared";

import type { RequestUser } from "../auth/request-user";
import type { PrismaService } from "../prisma/prisma.service";
import { copy, person, workItem } from "./work-item-common";
import type { WorkItemLocale } from "./work-item-common";

const TMS_PERIOD_SENTENCES = {
  pending: {
    "zh-CN": "您还没有填报 {{period}}的工时，请尽快填报。",
    "en-US":
      "You have not completed your timesheet for {{period}}. Please complete it as soon as possible.",
  },
  overdue: {
    "zh-CN": "您还没有填报 {{period}}的工时，当前已经逾期，请尽快填报。",
    "en-US":
      "Your timesheet for {{period}} is overdue. Please complete it as soon as possible.",
  },
} as const;

const TMS_BUSINESS_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const TMS_PERIOD_WORK_ITEMS_EFFECTIVE_YEAR = 2026;
const TMS_PERIOD_WORK_ITEMS_EFFECTIVE_MONTH = 8;
const TMS_PERIOD_WORK_ITEMS_EFFECTIVE_AT = tmsBusinessDayStart(
  TMS_PERIOD_WORK_ITEMS_EFFECTIVE_YEAR,
  TMS_PERIOD_WORK_ITEMS_EFFECTIVE_MONTH,
  31
);

export async function buildTmsPersonalWorkItems(
  prisma: PrismaService,
  user: RequestUser,
  locale: WorkItemLocale
): Promise<WorkItem[]> {
  const now = new Date();
  const [storedMonths, returnedRecords, approvalEngagements, pendingLinks] =
    await Promise.all([
      prisma.tmsTimesheetMonth.findMany({
        where: {
          userId: user.id,
          OR: [
            {
              year: TMS_PERIOD_WORK_ITEMS_EFFECTIVE_YEAR,
              month: {
                gte: TMS_PERIOD_WORK_ITEMS_EFFECTIVE_MONTH,
              },
            },
            {
              year: { gt: TMS_PERIOD_WORK_ITEMS_EFFECTIVE_YEAR },
            },
          ],
        },
        orderBy: [{ year: "asc" }, { month: "asc" }],
      }),
      prisma.tmsApprovalSubmission.findMany({
        where: { ownerUserId: user.id },
        orderBy: { revision: "desc" },
      }),
      canApprove(user)
        ? prisma.cmpEngagement.findMany({
            where: { OR: [{ picUserId: user.id }, { micUserId: user.id }] },
            select: {
              id: true,
              engagementCode: true,
              picUserId: true,
              micUserId: true,
              updatedAt: true,
              client: {
                select: { clientCode: true, nameEn: true, nameZh: true },
              },
              projects: {
                where: { status: { not: "DELETED" } },
                select: { id: true },
              },
            },
          })
        : Promise.resolve([]),
      prisma.tmsProjectLink.findMany({
        where: { ownerUserId: user.id, status: "PENDING" },
        include: { owner: { select: { id: true, name: true, email: true } } },
      }),
    ]);

  const items: WorkItem[] = [];
  const storedMonthByPeriod = new Map(
    storedMonths.map((month) => [`${month.year}:${month.month}`, month])
  );
  for (const period of tmsMonthsThroughNow(now)) {
    const month = storedMonthByPeriod.get(`${period.year}:${period.month}`);
    for (const half of ["FIRST_HALF", "SECOND_HALF"] as const) {
      const openedAt = periodBornAt(period.year, period.month, half);
      if (openedAt < TMS_PERIOD_WORK_ITEMS_EFFECTIVE_AT || now < openedAt) {
        continue;
      }
      const status =
        half === "FIRST_HALF"
          ? (month?.firstStatus ?? "DRAFT")
          : (month?.secondStatus ?? "DRAFT");
      if (status !== "DRAFT") {
        continue;
      }
      const monthId =
        month?.id ?? `period:${user.id}:${period.year}:${period.month}`;
      const due = periodDue(period.year, period.month, half);
      const label = periodLabel(locale, period.year, period.month, half);
      const overdue = now > due;
      const updatedAt = month?.updatedAt ?? openedAt;
      const missingDays = missingWorkdays(
        month?.draftRows ?? [],
        period.year,
        period.month,
        half,
        now
      );
      items.push(
        workItem({
          id: `TMS-001:${user.id}:${period.year}:${period.month}:${half}`,
          ruleId: "TMS-001",
          domain: "TMS",
          view: "PERSONAL",
          category: "TIMESHEET",
          state: overdue ? "BLOCKED" : "OPEN",
          severity: overdue ? "BLOCKER" : "ACTION_REQUIRED",
          priority: overdue ? "URGENT" : "HIGH",
          title: renderWorkItemSentence(
            locale,
            overdue
              ? TMS_PERIOD_SENTENCES.overdue
              : TMS_PERIOD_SENTENCES.pending,
            { period: label }
          ),
          description: tmsPeriodDescription(locale, overdue, missingDays),
          subjectType: "TMS_PERIOD",
          subjectId: `${monthId}:${half}`,
          project: null,
          reference: `${period.year}-${String(period.month).padStart(2, "0")}`,
          objectLabel: label,
          responsibleLabel: user.name,
          assignedTo: person(user),
          createdBy: null,
          dueAt: due.toISOString(),
          openedAt: openedAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
          actionTarget: {
            app: "TMS",
            resourceType: "TMS_PERIOD",
            resourceId: monthId,
            params: { year: period.year, month: period.month, half },
          },
        })
      );
    }
  }

  const latestReturned = latestSubmissions(returnedRecords).filter(
    (record) => record.status === "RETURNED"
  );
  for (const record of latestReturned) {
    items.push(
      workItem({
        id: `TMS-004:${record.ownerUserId}:${record.year}:${record.month}:${record.half}`,
        ruleId: "TMS-004",
        domain: "TMS",
        view: "PERSONAL",
        category: "TIMESHEET",
        state: "BLOCKED",
        severity: "BLOCKER",
        priority: "URGENT",
        title: copy(
          locale,
          `您提交的${periodLabel(locale, record.year, record.month, record.half)}工时已被退回，请修改后重新提交。`,
          `Your ${periodLabel(locale, record.year, record.month, record.half)} timesheet was returned. Please revise and resubmit it.`
        ),
        description:
          record.returnReason ??
          copy(locale, "请修改后重新提交", "Revise and submit again"),
        subjectType: "TMS_APPROVAL_SUBMISSION",
        subjectId: record.id,
        project: null,
        reference: `${record.year}-${String(record.month).padStart(2, "0")}`,
        objectLabel: periodLabel(
          locale,
          record.year,
          record.month,
          record.half
        ),
        responsibleLabel: user.name,
        assignedTo: person(user),
        createdBy: null,
        dueAt: null,
        openedAt: record.updatedAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        actionTarget: {
          app: "TMS",
          resourceType: "TMS_PERIOD",
          resourceId: record.id,
          params: { year: record.year, month: record.month, half: record.half },
        },
      })
    );
  }

  if (approvalEngagements.length > 0) {
    const submissions = await prisma.tmsApprovalSubmission.findMany({
      where: {
        engagementId: { in: approvalEngagements.map((item) => item.id) },
      },
      orderBy: { revision: "desc" },
    });
    const latest = latestSubmissions(submissions).filter((submission) =>
      ["SUBMITTED", "PENDING_CONFIRMATION"].includes(submission.status)
    );
    const engagementMap = new Map(
      approvalEngagements.map((engagement) => [engagement.id, engagement])
    );
    for (const submission of latest) {
      const engagement = engagementMap.get(submission.engagementId);
      if (!engagement) {
        continue;
      }
      const pendingConfirmation = submission.status === "PENDING_CONFIRMATION";
      const engagementLabel =
        engagement.client.nameZh ??
        engagement.client.nameEn ??
        engagement.client.clientCode;
      const submissionPeriod = periodLabel(
        locale,
        submission.year,
        submission.month,
        submission.half
      );
      items.push(
        workItem({
          id: `${pendingConfirmation ? "TMS-006" : "TMS-005"}:${submission.id}`,
          ruleId: pendingConfirmation ? "TMS-006" : "TMS-005",
          domain: "TMS",
          view: "PERSONAL",
          category: "APPROVAL",
          state: "OPEN",
          severity: "ACTION_REQUIRED",
          priority: "HIGH",
          title: copy(
            locale,
            pendingConfirmation
              ? `最终确认工时（${engagementLabel}，${engagement.engagementCode}，${submissionPeriod}）`
              : `审批工时（${engagementLabel}，${engagement.engagementCode}，${submissionPeriod}）`,
            pendingConfirmation
              ? `Confirm edited timesheet (${engagementLabel}, ${engagement.engagementCode}, ${submissionPeriod})`
              : `Approve timesheet (${engagementLabel}, ${engagement.engagementCode}, ${submissionPeriod})`
          ),
          description: copy(
            locale,
            pendingConfirmation
              ? "工时已按退回意见修改，正在等待你的最终确认。"
              : "该工时正在等待你的 PIC/MIC 审批。",
            pendingConfirmation
              ? "The timesheet was revised after return and is waiting for your final confirmation."
              : "This timesheet is waiting for your approval as PIC/MIC."
          ),
          subjectType: "TMS_APPROVAL_SUBMISSION",
          subjectId: submission.id,
          project: null,
          reference: engagement.engagementCode,
          objectLabel: engagementLabel,
          responsibleLabel: copy(
            locale,
            "Engagement PIC/MIC",
            "Engagement PIC/MIC"
          ),
          assignedTo: null,
          createdBy: null,
          dueAt: null,
          openedAt: submission.submittedAt.toISOString(),
          updatedAt: submission.updatedAt.toISOString(),
          actionTarget: {
            app: "TMS",
            resourceType: "TMS_APPROVAL",
            resourceId: submission.id,
            params: {
              engagementId: submission.engagementId,
              year: submission.year,
              month: submission.month,
              half: submission.half,
            },
          },
        })
      );
    }

    const engagementIdsWithSubmissions = new Set(
      submissions.map((submission) => submission.engagementId)
    );
    for (const engagement of approvalEngagements) {
      if (
        engagement.projects.length > 0 ||
        !engagementIdsWithSubmissions.has(engagement.id)
      ) {
        continue;
      }
      const engagementLabel =
        engagement.client.nameZh ??
        engagement.client.nameEn ??
        engagement.client.clientCode;
      items.push(
        workItem({
          id: `TMS-009:${engagement.id}`,
          ruleId: "TMS-009",
          domain: "TMS",
          view: "PERSONAL",
          category: "PROJECT_LINK",
          state: "BLOCKED",
          severity: "BLOCKER",
          priority: "HIGH",
          title: copy(
            locale,
            `建立并绑定 EMP 项目（${engagementLabel}，${engagement.engagementCode}）`,
            `Create and link EMP project (${engagementLabel}, ${engagement.engagementCode})`
          ),
          description: copy(
            locale,
            "你是该业务的 PIC 或 MIC；该业务已有工时记录，但尚未关联 EMP 项目。",
            "You are this Engagement's PIC or MIC. It has timesheet records but is not linked to an EMP project."
          ),
          subjectType: "CMP_ENGAGEMENT",
          subjectId: engagement.id,
          project: null,
          reference: engagement.engagementCode,
          objectLabel: engagementLabel,
          responsibleLabel: copy(
            locale,
            "Engagement PIC/MIC",
            "Engagement PIC/MIC"
          ),
          assignedTo: null,
          createdBy: null,
          dueAt: null,
          openedAt: engagement.updatedAt.toISOString(),
          updatedAt: engagement.updatedAt.toISOString(),
          actionTarget: {
            app: "TMS",
            resourceType: "CMP_ENGAGEMENT",
            resourceId: engagement.id,
            params: { engagementId: engagement.id },
          },
        })
      );
    }
  }

  for (const link of pendingLinks) {
    items.push(
      workItem({
        id: `TMS-007:${link.id}`,
        ruleId: "TMS-007",
        domain: "TMS",
        view: "PERSONAL",
        category: "PROJECT_LINK",
        state: "BLOCKED",
        severity: "ACTION_REQUIRED",
        priority: "HIGH",
        title: copy(
          locale,
          `关联 TMS 工时项目（${link.label}，TMS-${String(link.referenceNumber).padStart(5, "0")}）`,
          `Link TMS timesheet project (${link.label}, TMS-${String(link.referenceNumber).padStart(5, "0")})`
        ),
        description: copy(
          locale,
          "这是你创建但尚未关联项目的工时行，请选择对应项目。",
          "You created this timesheet row, but it is not linked to a project. Select the corresponding project."
        ),
        subjectType: "TMS_PROJECT_LINK",
        subjectId: link.id,
        project: null,
        reference: `TMS-${String(link.referenceNumber).padStart(5, "0")}`,
        objectLabel: link.label,
        responsibleLabel: user.name,
        assignedTo: person(link.owner),
        createdBy: person(link.owner),
        dueAt: null,
        openedAt: link.createdAt.toISOString(),
        updatedAt: link.updatedAt.toISOString(),
        actionTarget: {
          app: "TMS",
          resourceType: "TMS_PROJECT_LINK",
          resourceId: link.id,
          params: { rowId: link.rowId },
        },
      })
    );
  }
  return items;
}

function periodBornAt(
  year: number,
  month: number,
  half: "FIRST_HALF" | "SECOND_HALF"
) {
  const day =
    half === "FIRST_HALF"
      ? 15
      : new Date(Date.UTC(year, month, 0)).getUTCDate();
  return tmsBusinessDayStart(year, month, day);
}

function tmsMonthsThroughNow(now: Date) {
  const periods: { year: number; month: number }[] = [];
  const current = tmsBusinessDateParts(now);
  let year = TMS_PERIOD_WORK_ITEMS_EFFECTIVE_YEAR;
  let month = TMS_PERIOD_WORK_ITEMS_EFFECTIVE_MONTH;
  while (
    year < current.year ||
    (year === current.year && month <= current.month)
  ) {
    periods.push({ year, month });
    month += 1;
    if (month > 12) {
      year += 1;
      month = 1;
    }
  }
  return periods;
}

function periodDue(
  year: number,
  month: number,
  half: "FIRST_HALF" | "SECOND_HALF"
) {
  return new Date(periodBornAt(year, month, half).getTime() + 86_400_000 - 1);
}

function tmsBusinessDayStart(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day) - TMS_BUSINESS_UTC_OFFSET_MS);
}

function tmsBusinessDateParts(value: Date) {
  const businessTime = new Date(value.getTime() + TMS_BUSINESS_UTC_OFFSET_MS);
  return {
    year: businessTime.getUTCFullYear(),
    month: businessTime.getUTCMonth() + 1,
  };
}

function periodLabel(
  locale: WorkItemLocale,
  year: number,
  month: number,
  half: "FIRST_HALF" | "SECOND_HALF"
) {
  return copy(
    locale,
    `${year} 年 ${month} 月${half === "FIRST_HALF" ? "上半月" : "下半月"}`,
    `${year}-${String(month).padStart(2, "0")} ${half === "FIRST_HALF" ? "first half" : "second half"}`
  );
}

function tmsPeriodDescription(
  locale: WorkItemLocale,
  overdue: boolean,
  missingDays: string[]
) {
  const state = copy(
    locale,
    overdue ? "当前期间已经逾期未提交" : "当前期间尚未提交",
    overdue
      ? "This period is overdue and not submitted"
      : "This period has not been submitted"
  );
  if (missingDays.length === 0) {
    return state;
  }
  const visibleDays = missingDays.slice(0, 5);
  const suffix = missingDays.length > visibleDays.length ? "…" : "";
  return copy(
    locale,
    `${state}；还有 ${missingDays.length} 个工作日未填报：${visibleDays.join("、")}${suffix}`,
    `${state}; ${missingDays.length} workdays are missing: ${visibleDays.join(", ")}${suffix}`
  );
}

function missingWorkdays(
  rawRows: unknown,
  year: number,
  month: number,
  half: "FIRST_HALF" | "SECOND_HALF",
  now: Date
) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const days: string[] = [];
  const first = half === "FIRST_HALF" ? 1 : 16;
  const last =
    half === "FIRST_HALF"
      ? 15
      : new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = first; day <= last; day += 1) {
    const date = tmsBusinessDayStart(year, month, day);
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (date > now || dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const total = rows.reduce((sum, row) => {
      if (!row || typeof row !== "object") {
        return sum;
      }
      const hours = (row as { hoursByDate?: Record<string, unknown> })
        .hoursByDate?.[key];
      return sum + (typeof hours === "number" ? hours : 0);
    }, 0);
    if (total === 0) {
      days.push(key);
    }
  }
  return days;
}

function latestSubmissions<
  T extends {
    ownerUserId: string;
    engagementId: string;
    year: number;
    month: number;
    half: string;
    revision: number;
  },
>(records: T[]) {
  const latest = new Map<string, T>();
  for (const record of records) {
    const key = `${record.ownerUserId}:${record.engagementId}:${record.year}:${record.month}:${record.half}`;
    const current = latest.get(key);
    if (!current || current.revision < record.revision) {
      latest.set(key, record);
    }
  }
  return [...latest.values()];
}

function canApprove(user: RequestUser) {
  return ["PARTNER", "SENIOR_MANAGER", "MANAGER"].includes(user.globalRole);
}
