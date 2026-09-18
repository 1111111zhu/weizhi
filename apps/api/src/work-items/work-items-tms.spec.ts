import { afterEach, describe, expect, it, vi } from "vitest";

import type { RequestUser } from "../auth/request-user";
import type { PrismaService } from "../prisma/prisma.service";
import { buildTmsPersonalWorkItems } from "./work-items-tms";

const user: RequestUser = {
  id: "user-1",
  email: "staff@example.com",
  name: "Staff User",
  globalRole: "STAFF",
};

function prismaWithMonths(months: unknown[]) {
  return {
    tmsTimesheetMonth: {
      findMany: vi.fn().mockResolvedValue(months),
    },
    tmsApprovalSubmission: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    tmsProjectLink: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService;
}

describe(buildTmsPersonalWorkItems, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not turn pre-rollout historical drafts into active work items", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T08:00:00.000Z"));
    const prisma = prismaWithMonths([
      {
        id: "historical-month",
        userId: user.id,
        year: 2023,
        month: 9,
        draftRows: [],
        firstStatus: "DRAFT",
        secondStatus: "DRAFT",
        updatedAt: new Date("2026-08-16T09:00:00.000Z"),
      },
    ]);

    const items = await buildTmsPersonalWorkItems(prisma, user, "zh-CN");

    expect(items.map((item) => item.ruleId)).toStrictEqual(["TMS-001"]);
    expect(
      items.every((item) => item.title.includes("2026 年 8 月下半月"))
    ).toBeTruthy();
    expect(items.some((item) => item.title.includes("2023"))).toBeFalsy();
    expect(items[0]?.description).toContain("工作日未填报");
    expect(prisma.tmsTimesheetMonth.findMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        OR: [{ year: 2026, month: { gte: 8 } }, { year: { gt: 2026 } }],
      },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });
  });

  it("creates the first-half work item on the fifteenth, not before", async () => {
    vi.useFakeTimers();
    const prisma = prismaWithMonths([submittedMonth(8), draftMonth(9)]);

    vi.setSystemTime(new Date("2026-09-14T15:59:59.000Z"));
    await expect(
      buildTmsPersonalWorkItems(prisma, user, "zh-CN")
    ).resolves.toStrictEqual([]);

    vi.setSystemTime(new Date("2026-09-14T16:00:00.000Z"));
    const items = await buildTmsPersonalWorkItems(prisma, user, "zh-CN");

    expect(items).toHaveLength(1);
    expect(
      items.every((item) => item.title.includes("2026 年 9 月上半月"))
    ).toBeTruthy();
  });

  it("keeps a born first-half item open after the sixteenth", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T08:00:00.000Z"));
    const prisma = prismaWithMonths([submittedMonth(8), draftMonth(9)]);

    const items = await buildTmsPersonalWorkItems(prisma, user, "zh-CN");

    expect(items).toHaveLength(1);
    expect(
      items.every((item) => item.title.includes("2026 年 9 月上半月"))
    ).toBeTruthy();
    expect(items.every((item) => !item.title.includes("下半月"))).toBeTruthy();
  });

  it("closes born reminders after that half is submitted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T08:00:00.000Z"));
    const prisma = prismaWithMonths([
      submittedMonth(8),
      { ...draftMonth(9), firstStatus: "SUBMITTED" },
    ]);

    await expect(
      buildTmsPersonalWorkItems(prisma, user, "zh-CN")
    ).resolves.toStrictEqual([]);
  });
});

function draftMonth(month: number) {
  return {
    id: `month-${month}`,
    userId: user.id,
    year: 2026,
    month,
    draftRows: [],
    firstStatus: "DRAFT",
    secondStatus: "DRAFT",
    updatedAt: new Date(
      `2026-${String(month).padStart(2, "0")}-01T09:00:00.000Z`
    ),
  };
}

function submittedMonth(month: number) {
  return {
    ...draftMonth(month),
    firstStatus: "SUBMITTED",
    secondStatus: "SUBMITTED",
  };
}
