import type { WorkItem } from "@project-wing/shared";
import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import {
  WorkItemsSynchronizerService,
  inferWorkItemResponsibilities,
  workItemDedupeKey,
} from "./work-items-synchronizer.service";

describe("work-item persistence coordination", () => {
  it("does not resurrect deleted-file work from a stale projection and reevaluates restored files", async () => {
    const item = workItem({
      actionTarget: {
        app: "PROJECT",
        resourceType: "REVIEW_QUESTION",
        resourceId: "q-1",
        params: { projectId: "project-1", attachmentId: "file-1" },
      },
    });
    const stored = {
      ...item,
      id: "record-1",
      dedupeKey: workItemDedupeKey(item),
      projectId: "project-1",
      status: "CANCELLED",
      displayContent: item.title,
      sourceUpdatedAt: new Date(item.updatedAt),
      contentParams: {},
      responsibilities: [],
      actionTarget: {
        ...item.actionTarget,
        params: { ...item.actionTarget.params, unavailable: true },
      },
    };
    const transaction = {
      attachment: { findMany: vi.fn().mockResolvedValue([]) },
      workItemRecord: {
        findMany: vi.fn().mockResolvedValue([stored]),
        update: vi.fn(),
        create: vi.fn(),
      },
    };
    const service = new WorkItemsSynchronizerService({} as PrismaService);
    const reconcile = Reflect.get(service, "reconcileLocked");
    const current = new Map([
      [
        workItemDedupeKey(item),
        { item, originUserIds: new Set(["assignee-1"]) },
      ],
    ]);
    await reconcile.call(service, current, transaction);
    expect(transaction.workItemRecord.update).not.toHaveBeenCalled();
    expect(transaction.workItemRecord.create).not.toHaveBeenCalled();
    expect(transaction.attachment.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["file-1"] }, deletedAt: null },
      select: { id: true },
    });
    transaction.attachment.findMany.mockResolvedValue([{ id: "file-1" }]);
    await reconcile.call(service, new Map(), transaction);
    expect(transaction.workItemRecord.update).not.toHaveBeenCalled();
    await reconcile.call(service, current, transaction);
    expect(transaction.workItemRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACTIVE",
          resolutionReason: null,
          actionTarget: item.actionTarget,
          events: { create: expect.objectContaining({ type: "REOPENED" }) },
        }),
      })
    );
  });

  it("cancels an active record when its attachment has been permanently removed", async () => {
    const item = workItem({
      subjectType: "ATTACHMENT",
      subjectId: "missing-file",
    });
    const transaction = {
      attachment: { findMany: vi.fn().mockResolvedValue([]) },
      workItemRecord: {
        findMany: vi.fn().mockResolvedValue([
          {
            ...item,
            id: "old-file-task",
            status: "ACTIVE",
            dedupeKey: workItemDedupeKey(item),
            responsibilities: [],
          },
        ]),
        update: vi.fn(),
      },
    };
    const service = new WorkItemsSynchronizerService({} as PrismaService);
    await Reflect.get(service, "reconcileLocked").call(
      service,
      new Map(),
      transaction
    );
    expect(transaction.workItemRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CANCELLED",
          resolutionReason: "ATTACHMENT_DELETED",
          actionTarget: expect.objectContaining({
            params: expect.objectContaining({ unavailable: true }),
          }),
          events: {
            create: {
              type: "CANCELLED",
              payload: { reason: "ATTACHMENT_DELETED" },
            },
          },
        }),
      })
    );
  });

  it("retires old project preview tasks with a routing audit event instead of claiming the infrastructure recovered", async () => {
    const transaction = {
      workItemRecord: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "old-preview",
            ruleId: "PRJ-015",
            dedupeKey: "PRJ-015:ATTACHMENT:a:active",
            status: "ACTIVE",
            responsibilities: [],
          },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new WorkItemsSynchronizerService({} as PrismaService);
    const reconcile = Reflect.get(service, "reconcileLocked");
    await reconcile.call(service, new Map(), transaction);
    expect(transaction.workItemRecord.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: "old-preview" },
      data: {
        status: "RESOLVED",
        resolvedAt: expect.any(Date),
        resolutionReason: "ROUTED_TO_OPS",
        events: {
          create: { type: "RESOLVED", payload: { reason: "ROUTED_TO_OPS" } },
        },
      },
    });
  });

  it("uses a stable logical key across team and personal projections", () => {
    const team = workItem({ view: "TEAM" });
    const personal = workItem({ view: "PERSONAL" });

    expect(workItemDedupeKey(team)).toBe(workItemDedupeKey(personal));
    expect(workItemDedupeKey(team)).toBe("PRJ-005:REVIEW_QUESTION:q-1:active");
  });

  it("persists project, creator, and assignee selectors for an open Q", () => {
    const selectors = inferWorkItemResponsibilities({
      item: workItem({ view: "TEAM" }),
      originUserIds: new Set(["assignee-1"]),
    });

    expect(selectors.map((item) => item.selectorKey).sort()).toStrictEqual([
      "PROJECT_ALL_MEMBERS:project-1",
      "USER:assignee-1",
      "USER:creator-1",
    ]);
  });

  it("rejects a projected item that has no responsibility path", () => {
    const item = workItem({
      id: "CMP-001:orphan",
      ruleId: "CMP-001",
      domain: "CMP",
      view: "PERSONAL",
      project: null,
      assignedTo: null,
      createdBy: null,
    });

    expect(
      inferWorkItemResponsibilities({ item, originUserIds: new Set() })
    ).toStrictEqual([]);
  });

  it("does not block a scoped read on the full persistence projection", async () => {
    let finishSynchronization: (() => void) | undefined;
    const synchronization = new Promise<void>((resolve) => {
      finishSynchronization = resolve;
    });
    const service = new WorkItemsSynchronizerService({} as PrismaService);
    const synchronizeAll = vi.fn(() => synchronization);
    Reflect.set(service, "synchronizeAll", synchronizeAll);

    expect(service.syncForRead()).toBeUndefined();
    expect(synchronizeAll).toHaveBeenCalledOnce();

    finishSynchronization?.();
    await synchronization;
  });
});

const runWorkItemsDatabaseTest =
  process.env.RUN_WORK_ITEMS_DB_TEST === "1" &&
  /(?:127\.0\.0\.1|localhost):55432\/emp_qa_[^/?#]+(?:[/?#]|$)/.test(
    process.env.DATABASE_URL ?? ""
  );

(runWorkItemsDatabaseTest ? describe : describe.skip)(
  "work-item persistence coordination against PostgreSQL",
  () => {
    it("reconciles an empty projection without deserializing the advisory lock result", async () => {
      const prisma = new PrismaService();
      await prisma.$connect();
      try {
        const service = new WorkItemsSynchronizerService(prisma);
        const reconcile = Reflect.get(service, "reconcile") as (
          current: Map<string, unknown>
        ) => Promise<void>;

        await expect(
          reconcile.call(service, new Map())
        ).resolves.toBeUndefined();
      } finally {
        await prisma.$disconnect();
      }
    });
  }
);

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "PRJ-005:q-1",
    ruleId: "PRJ-005",
    domain: "PROJECT",
    view: "TEAM",
    category: "REVIEW",
    state: "OPEN",
    severity: "BLOCKER",
    priority: "HIGH",
    title: "Question remains open",
    description: "Question remains open",
    subjectType: "REVIEW_QUESTION",
    subjectId: "q-1",
    project: {
      id: "project-1",
      projectCode: "AUD-1",
      name: "Audit",
    },
    reference: "A1",
    objectLabel: "Audit programme",
    responsibleLabel: "Creator",
    assignedTo: {
      id: "assignee-1",
      name: "Assignee",
      email: "assignee@example.com",
    },
    createdBy: {
      id: "creator-1",
      name: "Creator",
      email: "creator@example.com",
    },
    dueAt: null,
    openedAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    actionTarget: {
      app: "PROJECT",
      resourceType: "REVIEW_QUESTION",
      resourceId: "q-1",
      params: { projectId: "project-1" },
    },
    ...overrides,
  };
}
