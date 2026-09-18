import { Prisma } from "@prisma/client";

type AttachmentDependentItem = {
  subjectType: string;
  subjectId: string;
  actionTarget: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Only ownership/dependency links count; message references are not dependencies. */
export function workItemAttachmentId(
  item: AttachmentDependentItem
): string | null {
  if (["ATTACHMENT", "ATTACHMENT_PREVIEW"].includes(item.subjectType)) {
    return item.subjectId;
  }
  if (!["REVIEW_QUESTION", "ZIP_MASTER_SESSION"].includes(item.subjectType)) {
    return null;
  }
  const { attachmentId } = record(record(item.actionTarget).params);
  return typeof attachmentId === "string" && attachmentId ? attachmentId : null;
}

export function unavailableWorkItemTarget(
  target: unknown
): Prisma.InputJsonObject {
  const value = record(target);
  return {
    ...value,
    params: { ...record(value.params), unavailable: true },
  } as Prisma.InputJsonObject;
}

export async function cancelAttachmentWorkItems(
  transaction: Prisma.TransactionClient,
  input: {
    projectId: string;
    attachmentId: string;
    actorId: string;
    deletedAt: Date;
  }
) {
  // Serialize against projection reconciliation so deletion cannot lose its audit event.
  await transaction.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(78451239)`
  );
  const items = await transaction.workItemRecord.findMany({
    where: {
      projectId: input.projectId,
      status: "ACTIVE",
      OR: [
        {
          subjectType: { in: ["ATTACHMENT", "ATTACHMENT_PREVIEW"] },
          subjectId: input.attachmentId,
        },
        {
          subjectType: { in: ["REVIEW_QUESTION", "ZIP_MASTER_SESSION"] },
          actionTarget: {
            path: ["params", "attachmentId"],
            equals: input.attachmentId,
          },
        },
      ],
    },
    select: { id: true, actionTarget: true },
  });
  for (const item of items) {
    await transaction.workItemRecord.update({
      where: { id: item.id },
      data: {
        status: "CANCELLED",
        resolvedAt: input.deletedAt,
        resolutionReason: "ATTACHMENT_DELETED",
        actionTarget: unavailableWorkItemTarget(item.actionTarget),
        events: {
          create: {
            type: "CANCELLED",
            actorUserId: input.actorId,
            payload: {
              reason: "ATTACHMENT_DELETED",
              attachmentId: input.attachmentId,
            },
          },
        },
      },
    });
  }
}
