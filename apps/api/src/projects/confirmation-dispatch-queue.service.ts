import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  ClaimConfirmationDispatchQueueInput,
  ConfirmationDispatchQueueQuery,
  ReleaseConfirmationDispatchQueueInput,
  ReturnConfirmationDispatchQueueInput,
} from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import type { RequestUser } from "../auth/request-user";
import {
  ApiConflictException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";

const QUEUE_ROW_SELECT = {
  id: true,
  projectId: true,
  type: true,
  status: true,
  confirmationCode: true,
  counterpartyName: true,
  draftTemplateCode: true,
  plannedSendDate: true,
  queuedAt: true,
  updatedAt: true,
  preparedDispatchMethod: true,
  queueClaimedBy: true,
  queueClaimedAt: true,
  revisionReason: true,
  revisionRequestedAt: true,
  responsibleUser: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true, projectCode: true } },
  currentArtifact: {
    select: {
      id: true,
      version: true,
      disposition: true,
      templateCode: true,
      templateVersion: true,
      pdfSha256: true,
      submittedAt: true,
    },
  },
  dispatches: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      id: true,
      method: true,
      executionStatus: true,
      sentAt: true,
      deliveredAt: true,
      courierName: true,
      trackingNumber: true,
      providerName: true,
      providerReference: true,
    },
  },
} satisfies Prisma.ProjectConfirmationSelect;

type QueueRowRecord = Prisma.ProjectConfirmationGetPayload<{
  select: typeof QUEUE_ROW_SELECT;
}>;

export type ConfirmationDispatchQueueRow = {
  confirmationId: string;
  project: { id: string; name: string; projectCode: string };
  type: QueueRowRecord["type"];
  confirmationCode: string | null;
  counterpartyName: string;
  templateCode: string | null;
  plannedSendDate: Date | null;
  queuedAt: Date | null;
  updatedAt: Date;
  preparedDispatchMethod: QueueRowRecord["preparedDispatchMethod"];
  stage: "AWAITING_CLAIM" | "PENDING_DISPATCH" | "SENT" | "OUT_OF_SCOPE";
  queueStatus: "UNCLAIMED" | "CLAIMED" | "RETURNED";
  validationStatus: "READY" | "NEEDS_REVISION";
  claim: { userId: string; claimedAt: Date } | null;
  pic: { id: string; name: string; email: string } | null;
  artifact: {
    id: string;
    version: number;
    disposition: string;
    templateCode: string;
    templateVersion: string;
    pdfSha256: string;
    submittedAt: Date;
  } | null;
  revisionReason: string | null;
  latestDispatch: {
    id: string;
    method: string;
    executionStatus: string;
    sentAt: Date | null;
    deliveredAt: Date | null;
    courierName: string | null;
    trackingNumber: string | null;
    providerName: string | null;
    providerReference: string | null;
  } | null;
};

@Injectable()
export class ConfirmationDispatchQueueService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ConfirmationDispatchQueueQuery,
    user: RequestUser
  ): Promise<ConfirmationDispatchQueueRow[]> {
    this.requireOfficeAccess(user);
    const where = this.buildQueueWhere(query);
    const rows = await this.prisma.projectConfirmation.findMany({
      where,
      orderBy: [{ plannedSendDate: "asc" }, { queuedAt: "asc" }],
      select: QUEUE_ROW_SELECT,
    });
    return rows.map(toQueueRow);
  }

  async claim(
    confirmationId: string,
    input: ClaimConfirmationDispatchQueueInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await Promise.resolve();
    this.requireOfficeAccess(user);
    const expectedQueuedAt = new Date(input.expectedQueuedAt);
    const claimedAt = new Date();
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.projectConfirmation.findUnique({
          where: { id: confirmationId },
          select: QUEUE_ROW_SELECT,
        });
        if (!existing) {
          this.notFound();
        }
        if (this.isExactSelfClaim(existing, input, user.id, expectedQueuedAt)) {
          return toQueueRow(existing);
        }

        const claimed = await tx.projectConfirmation.updateMany({
          where: {
            id: confirmationId,
            status: "PREPARED",
            currentArtifactId: input.artifactId,
            queuedAt: expectedQueuedAt,
            queueClaimedBy: null,
            currentArtifact: { is: { disposition: "ACTIVE" } },
            dispatches: { none: {} },
          },
          data: { queueClaimedBy: user.id, queueClaimedAt: claimedAt },
        });
        if (claimed.count !== 1) {
          throw new ApiConflictException(
            "QUEUE_ITEM_ALREADY_CLAIMED",
            "Queue item is already claimed or changed"
          );
        }

        const row = await tx.projectConfirmation.findUnique({
          where: { id: confirmationId },
          select: QUEUE_ROW_SELECT,
        });
        if (!row) {
          this.notFound();
        }
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "CONFIRMATION_QUEUE_CLAIMED",
            targetType: "PROJECT_CONFIRMATION",
            targetId: confirmationId,
            projectId: row.projectId,
            description: `Claimed confirmation queue item ${row.confirmationCode ?? confirmationId}`,
            ipAddress: source.ipAddress,
            userAgent: source.userAgent,
          },
        });
        return toQueueRow(row);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async release(
    confirmationId: string,
    input: ReleaseConfirmationDispatchQueueInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await Promise.resolve();
    this.requireOfficeAccess(user);
    return this.prisma.$transaction(async (tx) => {
      const confirmation = await tx.projectConfirmation.findUnique({
        where: { id: confirmationId },
        select: QUEUE_ROW_SELECT,
      });
      if (!confirmation) {
        this.notFound();
      }
      this.requireOwnActiveClaim(confirmation, input.artifactId, user.id);

      const released = await tx.projectConfirmation.updateMany({
        where: {
          id: confirmationId,
          status: "PREPARED",
          currentArtifactId: input.artifactId,
          queueClaimedBy: user.id,
          currentArtifact: { is: { disposition: "ACTIVE" } },
          dispatches: { none: {} },
        },
        data: { queueClaimedBy: null, queueClaimedAt: null },
      });
      if (released.count !== 1) {
        this.stateConflict();
      }

      const row = await tx.projectConfirmation.findUnique({
        where: { id: confirmationId },
        select: QUEUE_ROW_SELECT,
      });
      if (!row) {
        this.notFound();
      }
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "CONFIRMATION_QUEUE_RELEASED",
          targetType: "PROJECT_CONFIRMATION",
          targetId: confirmationId,
          projectId: row.projectId,
          description: `Released confirmation queue item ${row.confirmationCode ?? confirmationId}`,
          ipAddress: source.ipAddress,
          userAgent: source.userAgent,
        },
      });
      return toQueueRow(row);
    });
  }

  async returnToProject(
    confirmationId: string,
    input: ReturnConfirmationDispatchQueueInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await Promise.resolve();
    this.requireOfficeAccess(user);
    const returnedAt = new Date();
    return this.prisma.$transaction(
      async (tx) => {
        const confirmation = await tx.projectConfirmation.findUnique({
          where: { id: confirmationId },
          select: QUEUE_ROW_SELECT,
        });
        if (!confirmation) {
          this.notFound();
        }
        this.requireOwnActiveClaim(confirmation, input.artifactId, user.id);

        const returnedArtifact = await tx.confirmationArtifact.updateMany({
          where: {
            id: input.artifactId,
            confirmationId,
            disposition: "ACTIVE",
          },
          data: {
            disposition: "RETURNED",
            invalidatedBy: user.id,
            invalidatedAt: returnedAt,
            invalidationReason: `RETURNED: ${input.reason}`,
          },
        });
        if (returnedArtifact.count !== 1) {
          this.stateConflict();
        }

        const returned = await tx.projectConfirmation.updateMany({
          where: {
            id: confirmationId,
            status: "PREPARED",
            currentArtifactId: input.artifactId,
            queueClaimedBy: user.id,
          },
          data: {
            status: "DRAFT",
            currentArtifactId: null,
            queuedAt: null,
            queueClaimedBy: null,
            queueClaimedAt: null,
            revisionReason: input.reason,
            revisionRequestedBy: user.id,
            revisionRequestedAt: returnedAt,
          },
        });
        if (returned.count !== 1) {
          this.stateConflict();
        }

        const row = await tx.projectConfirmation.findUnique({
          where: { id: confirmationId },
          select: QUEUE_ROW_SELECT,
        });
        if (!row) {
          this.notFound();
        }
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "CONFIRMATION_QUEUE_RETURNED",
            targetType: "PROJECT_CONFIRMATION",
            targetId: confirmationId,
            projectId: row.projectId,
            description: `Returned confirmation ${row.confirmationCode ?? confirmationId} for revision`,
            ipAddress: source.ipAddress,
            userAgent: source.userAgent,
          },
        });
        return toQueueRow(row);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  private buildQueueWhere(
    query: ConfirmationDispatchQueueQuery
  ): Prisma.ProjectConfirmationWhereInput {
    const filters: Prisma.ProjectConfirmationWhereInput[] = [
      this.stageWhere(query.stage, query.queueStatus),
    ];
    if (query.channelIntent) {
      filters.push({ preparedDispatchMethod: query.channelIntent });
    }
    if (query.templateCode) {
      filters.push({ draftTemplateCode: query.templateCode });
    }
    if (query.type) {
      filters.push({ type: query.type });
    }
    if (query.projectId) {
      filters.push({ projectId: query.projectId });
    }
    if (query.picUserId) {
      filters.push({ responsibleUserId: query.picUserId });
    }
    if (query.claimOwnerId) {
      filters.push({ queueClaimedBy: query.claimOwnerId });
    }
    if (query.queueStatus === "UNCLAIMED" && !query.stage) {
      filters.push({ queueClaimedBy: null });
    }
    if (query.queueStatus === "CLAIMED" && !query.stage) {
      filters.push({ queueClaimedBy: { not: null } });
    }
    if (query.validationStatus === "READY") {
      filters.push({ revisionRequestedAt: null });
    }
    if (query.validationStatus === "NEEDS_REVISION") {
      filters.push({ revisionRequestedAt: { not: null } });
    }
    if (query.plannedSendFrom || query.plannedSendTo) {
      filters.push({
        plannedSendDate: {
          ...(query.plannedSendFrom
            ? { gte: new Date(query.plannedSendFrom) }
            : {}),
          ...(query.plannedSendTo
            ? { lte: new Date(query.plannedSendTo) }
            : {}),
        },
      });
    }
    return { AND: filters };
  }

  private stageWhere(
    stage: ConfirmationDispatchQueueQuery["stage"],
    legacyStatus: ConfirmationDispatchQueueQuery["queueStatus"]
  ): Prisma.ProjectConfirmationWhereInput {
    if (stage === "AWAITING_CLAIM") {
      return {
        status: "PREPARED",
        queueClaimedBy: null,
        currentArtifact: { is: { disposition: "ACTIVE" } },
        dispatches: { none: {} },
      };
    }
    if (stage === "PENDING_DISPATCH") {
      return {
        status: "PREPARED",
        queueClaimedBy: { not: null },
        currentArtifact: { is: { disposition: "ACTIVE" } },
        dispatches: { none: {} },
      };
    }
    if (stage === "SENT") {
      return {
        status: "AWAITING_RESPONSE",
        dispatches: { some: {} },
      };
    }
    if (legacyStatus === "RETURNED") {
      return { status: "DRAFT", revisionRequestedAt: { not: null } };
    }
    return {
      status: "PREPARED",
      currentArtifact: { is: { disposition: "ACTIVE" } },
      dispatches: { none: {} },
    };
  }

  private isExactSelfClaim(
    row: QueueRowRecord,
    input: ClaimConfirmationDispatchQueueInput,
    userId: string,
    expectedQueuedAt: Date
  ) {
    return (
      row.status === "PREPARED" &&
      row.currentArtifact?.id === input.artifactId &&
      row.currentArtifact?.disposition === "ACTIVE" &&
      row.queueClaimedBy === userId &&
      row.queuedAt?.getTime() === expectedQueuedAt.getTime()
    );
  }

  private requireOwnActiveClaim(
    row: QueueRowRecord,
    artifactId: string,
    userId: string
  ) {
    if (!row.queueClaimedBy) {
      throw new ApiConflictException(
        "QUEUE_CLAIM_REQUIRED",
        "An active queue claim is required"
      );
    }
    if (row.queueClaimedBy !== userId) {
      throw new ApiConflictException(
        "QUEUE_CLAIM_NOT_OWNED",
        "Queue claim belongs to another officer"
      );
    }
    if (
      row.status !== "PREPARED" ||
      row.currentArtifact?.id !== artifactId ||
      row.currentArtifact.disposition !== "ACTIVE"
    ) {
      this.stateConflict();
    }
  }

  private requireOfficeAccess(user: RequestUser) {
    if (
      user.globalRole !== "CONFIRMATION_OFFICER" &&
      user.globalRole !== "SUPER_ADMIN"
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Confirmation office access is required"
      );
    }
  }

  private notFound(): never {
    throw new ApiNotFoundException(
      "NOT_FOUND",
      "Confirmation queue item was not found"
    );
  }

  private stateConflict(): never {
    throw new ApiConflictException(
      "CONFIRMATION_STATE_CONFLICT",
      "Confirmation queue item changed"
    );
  }
}

function toQueueRow(row: QueueRowRecord): ConfirmationDispatchQueueRow {
  return {
    confirmationId: row.id,
    project: row.project,
    type: row.type,
    confirmationCode: row.confirmationCode,
    counterpartyName: row.counterpartyName,
    templateCode: row.draftTemplateCode,
    plannedSendDate: row.plannedSendDate,
    queuedAt: row.queuedAt,
    updatedAt: row.updatedAt,
    preparedDispatchMethod: row.preparedDispatchMethod,
    stage: getQueueStage(row),
    queueStatus:
      row.status === "DRAFT"
        ? "RETURNED"
        : row.queueClaimedBy
          ? "CLAIMED"
          : "UNCLAIMED",
    validationStatus: row.revisionRequestedAt ? "NEEDS_REVISION" : "READY",
    claim:
      row.queueClaimedBy && row.queueClaimedAt
        ? { userId: row.queueClaimedBy, claimedAt: row.queueClaimedAt }
        : null,
    pic: row.responsibleUser,
    artifact: row.currentArtifact,
    revisionReason: row.revisionReason,
    latestDispatch: row.dispatches[0] ?? null,
  };
}

function getQueueStage(
  row: QueueRowRecord
): ConfirmationDispatchQueueRow["stage"] {
  if (row.status === "AWAITING_RESPONSE" && row.dispatches.length > 0) {
    return "SENT";
  }
  if (row.status === "PREPARED" && row.queueClaimedBy) {
    return "PENDING_DISPATCH";
  }
  if (row.status === "PREPARED") {
    return "AWAITING_CLAIM";
  }
  return "OUT_OF_SCOPE";
}
