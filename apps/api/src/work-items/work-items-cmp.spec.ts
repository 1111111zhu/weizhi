import { describe, expect, it, vi } from "vitest";

import type { RequestUser } from "../auth/request-user";
import type { PrismaService } from "../prisma/prisma.service";
import { buildCmpPersonalWorkItems } from "./work-items-cmp";

describe(buildCmpPersonalWorkItems, () => {
  it("describes a pending MIC approval as the user's action and uses parentheses for context", async () => {
    const user: RequestUser = {
      id: "user-mic",
      email: "mic@example.com",
      name: "Engagement MIC",
      globalRole: "MANAGER",
    };
    const request = {
      id: "acceptance-1",
      requestNo: "CA-MS35WHDA-LD8B",
      draftName: "CLIENT CA-MS35WHDA-LD8B",
      type: "CLIENT",
      status: "PENDING_MIC",
      submittedAt: new Date("2026-07-27T11:00:00.000Z"),
      draftCompletedAt: new Date("2026-07-27T10:00:00.000Z"),
      submittedById: "user-staff",
      draftAssigneeId: "user-staff",
      micApproverId: user.id,
      picApproverId: null,
      itApproverId: null,
      returnReason: null,
      submittedBy: {
        id: "user-staff",
        email: "staff@example.com",
        name: "Engagement Staff",
      },
      draftAssignee: {
        id: "user-staff",
        email: "staff@example.com",
        name: "Engagement Staff",
      },
      micApprover: user,
      picApprover: null,
      itApprover: null,
      createdAt: new Date("2026-07-27T09:00:00.000Z"),
      updatedAt: new Date("2026-07-27T11:00:00.000Z"),
    };
    const prisma = {
      cmpAcceptanceRequest: {
        findMany: vi.fn().mockResolvedValue([request]),
      },
      cmpEngagementArchiveDraft: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      cmpBilling: { findMany: vi.fn().mockResolvedValue([]) },
      cmpExchangeRateBatch: {
        findFirst: vi.fn().mockResolvedValue({
          fetchedAt: new Date(),
        }),
      },
    } as unknown as PrismaService;

    const items = await buildCmpPersonalWorkItems(prisma, user, "zh-CN");

    expect(items).toContainEqual(
      expect.objectContaining({
        id: "CMP-003:acceptance-1",
        title: "审批承接申请（客户承接申请，CA-MS35WHDA-LD8B）",
        description: "该申请正在等待你的 MIC 审批。",
      })
    );
    expect(items[0]?.title).not.toContain("·");
    expect(items[0]?.title).not.toContain("等待 MIC 审批");
  });

  it("loads the billing creator through the CmpBilling createdBy relation", async () => {
    const user: RequestUser = {
      id: "user-pic",
      email: "pic@example.com",
      name: "Project PIC",
      globalRole: "STAFF",
    };
    const billingCreator = {
      id: "user-creator",
      email: "creator@example.com",
      name: "Billing Creator",
    };
    const cmpBillingFindMany = vi.fn().mockResolvedValue([
      {
        id: "billing-1",
        engagementId: "engagement-1",
        billNumber: "BILL-2026-0001",
        status: "SUBMITTED",
        returnedAt: null,
        returnReason: null,
        createdById: billingCreator.id,
        createdBy: billingCreator,
        totalAmount: { toNumber: () => 100 },
        financeReceipts: [],
        createdAt: new Date("2026-08-31T00:00:00.000Z"),
        updatedAt: new Date("2026-08-31T01:00:00.000Z"),
        engagement: {
          engagementCode: "ENG-2026-0001",
          picUserId: user.id,
          micUserId: null,
          picUser: user,
          micUser: null,
          client: {
            clientCode: "CLIENT-1",
            nameEn: "Example Client",
            nameZh: null,
          },
        },
      },
    ]);
    const prisma = {
      cmpAcceptanceRequest: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      cmpEngagementArchiveDraft: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      cmpBilling: { findMany: cmpBillingFindMany },
    } as unknown as PrismaService;

    const items = await buildCmpPersonalWorkItems(prisma, user, "zh-CN");

    expect(cmpBillingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        }),
      })
    );
    expect(items).toContainEqual(
      expect.objectContaining({
        id: "CMP-010:billing-1",
        createdBy: billingCreator,
      })
    );
  });
});
