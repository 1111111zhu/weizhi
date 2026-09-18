import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  cancelAttachmentWorkItems,
  workItemAttachmentId,
} from "./work-item-attachment-lifecycle";

describe("attachment-dependent work lifecycle", () => {
  it.each(["ATTACHMENT", "ATTACHMENT_PREVIEW"])(
    "recognizes a direct %s dependency",
    (subjectType) => {
      expect(
        workItemAttachmentId({
          subjectType,
          subjectId: "file-1",
          actionTarget: {},
        })
      ).toBe("file-1");
    }
  );

  it("distinguishes a file-bound review question from a mere reference", () => {
    const actionTarget = { params: { attachmentId: "file-1" } };
    expect(
      workItemAttachmentId({
        subjectType: "REVIEW_QUESTION",
        subjectId: "question-1",
        actionTarget,
      })
    ).toBe("file-1");
    expect(
      workItemAttachmentId({
        subjectType: "PROJECT",
        subjectId: "project-1",
        actionTarget,
      })
    ).toBeNull();
    expect(
      workItemAttachmentId({
        subjectType: "REVIEW_QUESTION",
        subjectId: "question-2",
        actionTarget: { params: { workingPaperId: "paper-1" } },
      })
    ).toBeNull();
  });

  it("cancels active dependent records in the deletion transaction and preserves their audit snapshots", async () => {
    const target = {
      app: "PROJECT",
      resourceType: "REVIEW_QUESTION",
      resourceId: "q-1",
      params: { projectId: "p-1", attachmentId: "file-1" },
    };
    const transaction = {
      $executeRaw: vi.fn(),
      workItemRecord: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "task-1", actionTarget: target }]),
        update: vi.fn(),
      },
    };
    const deletedAt = new Date("2026-09-06T00:00:00Z");
    await cancelAttachmentWorkItems(
      transaction as unknown as Prisma.TransactionClient,
      { projectId: "p-1", attachmentId: "file-1", actorId: "user-1", deletedAt }
    );
    expect(transaction.$executeRaw).toHaveBeenCalledOnce();
    expect(transaction.workItemRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACTIVE",
          projectId: "p-1",
          OR: expect.arrayContaining([
            expect.objectContaining({
              subjectType: { in: ["REVIEW_QUESTION", "ZIP_MASTER_SESSION"] },
              actionTarget: {
                path: ["params", "attachmentId"],
                equals: "file-1",
              },
            }),
          ]),
        }),
      })
    );
    expect(transaction.workItemRecord.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: "task-1" },
      data: {
        status: "CANCELLED",
        resolvedAt: deletedAt,
        resolutionReason: "ATTACHMENT_DELETED",
        actionTarget: {
          ...target,
          params: { ...target.params, unavailable: true },
        },
        events: {
          create: {
            type: "CANCELLED",
            actorUserId: "user-1",
            payload: { reason: "ATTACHMENT_DELETED", attachmentId: "file-1" },
          },
        },
      },
    });
  });
});
