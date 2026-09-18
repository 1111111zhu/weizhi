import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  CompleteMockCourierDeliveryInput,
  CreateConfirmationDispatchBatchInput,
  ExecuteConfirmationDispatchBatchInput,
} from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiConflictException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { ConfirmationManualChannelService } from "./confirmation-manual-channel.service";
import { ConfirmationMockCourierChannelService } from "./confirmation-mock-courier-channel.service";
import type { MockCourierMode } from "./confirmation-mock-courier-channel.service";

const BATCH_INCLUDE = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      confirmation: {
        select: {
          id: true,
          projectId: true,
          confirmationCode: true,
          counterpartyName: true,
        },
      },
      artifact: {
        select: {
          id: true,
          version: true,
          disposition: true,
          templateCode: true,
        },
      },
      dispatch: { select: { id: true, executionStatus: true } },
    },
  },
} satisfies Prisma.ConfirmationDispatchBatchInclude;

type BatchSnapshot = Prisma.ConfirmationDispatchBatchGetPayload<{
  include: typeof BATCH_INCLUDE;
}>;

@Injectable()
export class ConfirmationDispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manualChannel: ConfirmationManualChannelService,
    private readonly mockCourierChannel: ConfirmationMockCourierChannelService
  ) {}

  async createBatch(
    input: CreateConfirmationDispatchBatchInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await Promise.resolve();
    this.requireOfficeAccess(user);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.confirmationDispatchBatch.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: BATCH_INCLUDE,
      });
      if (existing) {
        return existing;
      }

      const batch = await tx.confirmationDispatchBatch.create({
        data: {
          method: input.method,
          status: "QUEUED",
          idempotencyKey: input.idempotencyKey,
          createdBy: user.id,
          items: {
            create: input.items.map((item) => ({
              confirmationId: item.confirmationId,
              artifactId: item.artifactId,
              idempotencyKey: getItemIdempotencyKey(
                input.idempotencyKey,
                item.confirmationId,
                item.artifactId,
                input.method
              ),
            })),
          },
        },
        include: BATCH_INCLUDE,
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "CONFIRMATION_DISPATCH_BATCH_CREATED",
          targetType: "CONFIRMATION_DISPATCH_BATCH",
          targetId: batch.id,
          description: `Created ${input.method} dispatch batch with ${batch.items.length} item(s)`,
          ipAddress: source.ipAddress,
          userAgent: source.userAgent,
        },
      });
      return batch;
    });
  }

  async executeBatch(
    batchId: string,
    input: ExecuteConfirmationDispatchBatchInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    this.requireOfficeAccess(user);
    const batch = await this.prisma.confirmationDispatchBatch.findUnique({
      where: { id: batchId },
      include: BATCH_INCLUDE,
    });
    if (!batch) {
      this.batchNotFound();
    }
    if (["COMPLETED", "PARTIAL_FAILURE", "FAILED"].includes(batch.status)) {
      return batch;
    }

    await this.prisma.confirmationDispatchBatch.updateMany({
      where: { id: batchId, status: "QUEUED" },
      data: { status: "EXECUTING", startedAt: new Date() },
    });
    for (const item of batch.items) {
      await this.executeItem(
        batch.id,
        batch.method,
        item.id,
        user,
        source,
        input.courierMode
      );
    }

    const completed = await this.prisma.confirmationDispatchBatch.findUnique({
      where: { id: batchId },
      include: BATCH_INCLUDE,
    });
    if (!completed) {
      this.batchNotFound();
    }
    const statuses = completed.items.map((item) => item.status);
    const failed = statuses.filter((status) => status === "FAILED").length;
    const status =
      failed === 0
        ? "COMPLETED"
        : failed === statuses.length
          ? "FAILED"
          : "PARTIAL_FAILURE";
    return this.prisma.confirmationDispatchBatch.update({
      where: { id: batchId },
      data: { status, completedAt: new Date() },
      include: BATCH_INCLUDE,
    });
  }

  async getBatch(batchId: string, user: RequestUser) {
    this.requireOfficeAccess(user);
    const batch = await this.prisma.confirmationDispatchBatch.findUnique({
      where: { id: batchId },
      include: BATCH_INCLUDE,
    });
    if (!batch) {
      this.batchNotFound();
    }
    return batch;
  }

  async completeMockCourierDelivery(
    dispatchId: string,
    _input: CompleteMockCourierDeliveryInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await Promise.resolve();
    this.requireOfficeAccess(user);
    return this.prisma.$transaction(async (tx) => {
      const dispatch = await tx.projectConfirmationDispatch.findUnique({
        where: { id: dispatchId },
        select: {
          id: true,
          confirmationId: true,
          executionStatus: true,
          providerName: true,
          trackingNumber: true,
          confirmation: { select: { projectId: true, confirmationCode: true } },
        },
      });
      if (!dispatch) {
        this.dispatchNotFound();
      }
      if (dispatch.providerName !== "MOCK_COURIER") {
        throw new ApiBadRequestException(
          "MOCK_COURIER_REQUIRED",
          "Only mock courier dispatches can be completed from this action"
        );
      }
      if (dispatch.executionStatus === "DELIVERED") {
        return dispatch;
      }
      if (dispatch.executionStatus !== "SENT") {
        throw new ApiConflictException(
          "DISPATCH_STATE_CONFLICT",
          "Mock courier dispatch is not ready for delivery"
        );
      }

      const deliveredAt = new Date();
      const updated = await tx.projectConfirmationDispatch.updateMany({
        where: {
          id: dispatchId,
          executionStatus: "SENT",
          providerName: "MOCK_COURIER",
        },
        data: { executionStatus: "DELIVERED", deliveredAt },
      });
      if (updated.count !== 1) {
        throw new ApiConflictException(
          "DISPATCH_STATE_CONFLICT",
          "Mock courier dispatch changed before delivery was recorded"
        );
      }
      await tx.confirmationDispatchEvent.create({
        data: {
          dispatchId,
          eventType: "DELIVERED",
          actorId: user.id,
          source: "MOCK_COURIER",
          payload: {
            simulated: true,
            trackingNumber: dispatch.trackingNumber,
          },
          occurredAt: deliveredAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "CONFIRMATION_MOCK_COURIER_DELIVERED",
          targetType: "PROJECT_CONFIRMATION_DISPATCH",
          targetId: dispatchId,
          projectId: dispatch.confirmation.projectId,
          description: `Recorded mock courier delivery for ${dispatch.confirmation.confirmationCode ?? dispatch.confirmationId}`,
          ipAddress: source.ipAddress,
          userAgent: source.userAgent,
        },
      });
      return tx.projectConfirmationDispatch.findUnique({
        where: { id: dispatchId },
      });
    });
  }

  private async executeItem(
    batchId: string,
    method: BatchSnapshot["method"],
    itemId: string,
    user: RequestUser,
    source: AuditLogSource,
    courierMode?: MockCourierMode
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.confirmationDispatchBatchItem.findUnique({
          where: { id: itemId },
          include: {
            dispatch: { select: { id: true } },
            artifact: {
              select: { id: true, disposition: true, templateCode: true },
            },
            confirmation: {
              select: {
                id: true,
                projectId: true,
                confirmationCode: true,
                counterpartyName: true,
                status: true,
                currentArtifactId: true,
                queueClaimedBy: true,
                currentArtifact: { select: { id: true, disposition: true } },
              },
            },
          },
        });
        if (!item || item.batchId !== batchId) {
          return this.markItemFailed(
            tx,
            itemId,
            "DISPATCH_BATCH_NOT_FOUND",
            "Batch item was not found"
          );
        }
        if (item.dispatch || item.status === "SENT") {
          return item;
        }

        const channel =
          method === "COURIER" ? this.mockCourierChannel : this.manualChannel;
        const request = {
          artifactId: item.artifactId,
          confirmationId: item.confirmationId,
          confirmationCode: item.confirmation.confirmationCode,
          counterpartyName: item.confirmation.counterpartyName,
          projectId: item.confirmation.projectId,
          method,
        };
        const validation = await channel.validate(request);
        if (!validation.ok) {
          return this.markItemFailed(
            tx,
            item.id,
            validation.code,
            validation.message
          );
        }
        if (
          item.confirmation.status !== "PREPARED" ||
          item.confirmation.currentArtifactId !== item.artifactId ||
          item.confirmation.currentArtifact?.disposition !== "ACTIVE" ||
          item.artifact.disposition !== "ACTIVE"
        ) {
          return this.markItemFailed(
            tx,
            item.id,
            "CONFIRMATION_STATE_CONFLICT",
            "Confirmation artifact is no longer active"
          );
        }
        if (!item.confirmation.queueClaimedBy) {
          return this.markItemFailed(
            tx,
            item.id,
            "QUEUE_CLAIM_REQUIRED",
            "Confirmation must be claimed before dispatch"
          );
        }
        if (item.confirmation.queueClaimedBy !== user.id) {
          return this.markItemFailed(
            tx,
            item.id,
            "QUEUE_CLAIM_NOT_OWNED",
            "Confirmation is claimed by another officer"
          );
        }

        const dispatchedAt = new Date();
        const receipt =
          method === "COURIER"
            ? await this.mockCourierChannel.dispatch(
                request,
                item.idempotencyKey,
                courierMode
              )
            : await this.manualChannel.dispatch(request, item.idempotencyKey);
        const latestDispatch = await tx.projectConfirmationDispatch.aggregate({
          where: { confirmationId: item.confirmationId },
          _max: { sequence: true },
        });
        const dispatch = await tx.projectConfirmationDispatch.create({
          data: {
            confirmationId: item.confirmationId,
            sequence: (latestDispatch._max.sequence ?? 0) + 1,
            method,
            artifactId: item.artifactId,
            batchItemId: item.id,
            executionStatus: "SENT",
            idempotencyKey: item.idempotencyKey,
            providerName: receipt.providerName,
            providerReference: receipt.providerReference,
            courierName: receipt.courierName,
            trackingNumber: receipt.trackingNumber,
            dispatchReference: receipt.dispatchReference,
            createdBy: user.id,
            startedAt: dispatchedAt,
            sentAt: dispatchedAt,
          },
          select: { id: true },
        });
        await tx.confirmationDispatchEvent.create({
          data: {
            dispatchId: dispatch.id,
            eventType: "CREATED",
            actorId: user.id,
            source: "MANUAL_BATCH",
            payload: { batchId },
            occurredAt: dispatchedAt,
          },
        });
        await tx.confirmationDispatchEvent.create({
          data: {
            dispatchId: dispatch.id,
            eventType: "SENT",
            actorId: user.id,
            source: "MANUAL_BATCH",
            payload: {
              batchId,
              method,
              courierMode:
                method === "COURIER" ? (courierMode ?? "ORDER") : null,
              providerName: receipt.providerName,
              providerReference: receipt.providerReference,
              trackingNumber: receipt.trackingNumber ?? null,
              simulated: receipt.providerName === "MOCK_COURIER",
            },
            occurredAt: dispatchedAt,
          },
        });
        const released = await tx.projectConfirmation.updateMany({
          where: {
            id: item.confirmationId,
            status: "PREPARED",
            currentArtifactId: item.artifactId,
            queueClaimedBy: user.id,
          },
          data: {
            status: "AWAITING_RESPONSE",
            queueClaimedBy: null,
            queueClaimedAt: null,
          },
        });
        if (released.count !== 1) {
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            "Confirmation changed before dispatch was recorded"
          );
        }
        const result = await tx.confirmationDispatchBatchItem.update({
          where: { id: item.id },
          data: { status: "SENT", errorCode: null, errorMessage: null },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "CONFIRMATION_DISPATCH_CREATED",
            targetType: "PROJECT_CONFIRMATION_DISPATCH",
            targetId: dispatch.id,
            projectId: item.confirmation.projectId,
            description: `Created ${method} dispatch attempt for ${item.confirmation.confirmationCode ?? item.confirmationId}`,
            ipAddress: source.ipAddress,
            userAgent: source.userAgent,
          },
        });
        return result;
      });
    } catch (error) {
      const failure = getFailure(error);
      return this.prisma.confirmationDispatchBatchItem.update({
        where: { id: itemId },
        data: {
          status: "FAILED",
          errorCode: failure.code,
          errorMessage: failure.message,
        },
      });
    }
  }

  private markItemFailed(
    tx: Prisma.TransactionClient,
    itemId: string,
    code: string,
    message: string
  ) {
    return tx.confirmationDispatchBatchItem.update({
      where: { id: itemId },
      data: { status: "FAILED", errorCode: code, errorMessage: message },
    });
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

  private batchNotFound(): never {
    throw new ApiNotFoundException(
      "DISPATCH_BATCH_NOT_FOUND",
      "Confirmation dispatch batch was not found"
    );
  }

  private dispatchNotFound(): never {
    throw new ApiNotFoundException(
      "CONFIRMATION_DISPATCH_NOT_FOUND",
      "Confirmation dispatch was not found"
    );
  }
}

function getItemIdempotencyKey(
  batchKey: string,
  confirmationId: string,
  artifactId: string,
  method: string
) {
  return createHash("sha256")
    .update([batchKey, confirmationId, artifactId, method].join(":"))
    .digest("hex");
}

function getFailure(error: unknown) {
  if (
    error instanceof ApiBadRequestException ||
    error instanceof ApiConflictException
  ) {
    const response = error.getResponse();
    if (response && typeof response === "object") {
      const { code, message } = response as { code?: string; message?: string };
      return {
        code: code ?? "DISPATCH_FAILED",
        message: message ?? "Dispatch failed",
      };
    }
  }
  return {
    code: "DISPATCH_FAILED",
    message: error instanceof Error ? error.message : "Dispatch failed",
  };
}
