import { createHash, randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { CreateProjectConfirmationResponseInput } from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiConflictException,
  ApiNotFoundException,
} from "../common/api-error";
import { normalizeUploadedFileName } from "../common/file-name";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { ConfirmationImportLinkGuardService } from "./confirmation-import-link-guard.service";
import type {
  ConfirmationImportLinkPrismaLike,
  ConfirmationSourceInvalidatingAction,
} from "./confirmation-import-link-guard.service";
import type { UploadedConfirmationFile } from "./confirmation-upload.service";
import { ProjectAccessService } from "./project-access.service";
import {
  PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA,
  normalizeConfirmationResponseFileNames,
} from "./project-confirmations.service";

const RESPONSE_FILE_TYPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
} as const;
const MAX_RESPONSE_FILES = 20;

@Injectable()
export class ConfirmationResponseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly storage: StorageService,
    private readonly auditLogs: AuditLogsService,
    private readonly importLinkGuard: ConfirmationImportLinkGuardService
  ) {}

  async receive(
    projectId: string,
    confirmationId: string,
    input: CreateProjectConfirmationResponseInput,
    files: UploadedConfirmationFile[],
    user: RequestUser,
    source: AuditLogSource
  ) {
    if (!hasOfficeAccess(user)) {
      await this.access.requireMutableProject(projectId, user.id);
    }
    const confirmation = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      select: {
        id: true,
        status: true,
        confirmationCode: true,
        responsibleUserId: true,
        dispatches: {
          orderBy: { sequence: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!confirmation) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }
    if (confirmation.status !== "AWAITING_RESPONSE") {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "Only a sent confirmation can receive a response"
      );
    }
    this.validateFiles(files);

    const responseId = randomUUID();
    const receivedAt = new Date(input.receivedAt);
    const artifacts = await this.storeArtifacts(
      responseId,
      files,
      1,
      receivedAt,
      user.id
    );

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.projectConfirmation.updateMany({
          where: {
            id: confirmationId,
            projectId,
            status: "AWAITING_RESPONSE",
            queueClaimedBy: null,
            dispatches: {
              none: {
                executionStatus: { in: ["QUEUED", "STARTED"] },
              },
            },
          },
          data: {
            status: "RESPONSE_RECEIVED",
            differenceStatus: null,
          },
        });
        if (claimed.count !== 1) {
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            "函证状态已变化，请刷新后重试"
          );
        }

        await tx.projectConfirmationResponse.create({
          data: {
            id: responseId,
            confirmationId,
            responseStatus: "RECEIVED",
            responseChannel: input.responseChannel,
            matchMethod: "MANUAL",
            routingStatus: "ROUTED",
            responsibleUserId: confirmation.responsibleUserId,
            receivingUserId: user.id,
            receivedAt,
            receivedBy: user.id,
            responseReference: input.responseReference || null,
            attachmentName: files[0]
              ? normalizeUploadedFileName(files[0].originalname)
              : null,
            notes: input.notes || null,
            artifacts: { create: artifacts.map(({ data }) => data) },
          },
        });
        const [latestDispatch] = confirmation.dispatches;
        if (latestDispatch) {
          await tx.confirmationDispatchEvent.create({
            data: {
              dispatchId: latestDispatch.id,
              eventType: "RECEIVED",
              actorId: user.id,
              source: "RESPONSE_INTAKE",
              payload: {
                responseId,
                responseChannel: input.responseChannel,
              } as Prisma.InputJsonValue,
              occurredAt: receivedAt,
            },
          });
        }
        await tx.confirmationFollowUpEvent.create({
          data: {
            confirmationId,
            eventType: "RESPONSE_RECEIVED",
            actorId: user.id,
            source: "RESPONSE_INTAKE",
            notes: input.notes || null,
            payload: {
              responseId,
              responseChannel: input.responseChannel,
            } as Prisma.InputJsonValue,
            occurredAt: receivedAt,
          },
        });
        return normalizeConfirmationResponseFileNames(
          await tx.projectConfirmation.findUniqueOrThrow({
            where: { id: confirmationId },
            include: PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA,
          })
        );
      });
      await this.auditLogs.log({
        actorId: user.id,
        action: "PROJECT_CONFIRMATION_RESPONSE_RECEIVED",
        targetType: "PROJECT_CONFIRMATION_RESPONSE",
        targetId: responseId,
        projectId,
        description: `Recorded response for ${confirmation.confirmationCode ?? confirmationId}`,
        source,
      });
      return result;
    } catch (error) {
      await Promise.allSettled(
        artifacts.map(({ objectKey }) => this.storage.deleteObject(objectKey))
      );
      throw error;
    }
  }

  async addArtifacts(
    projectId: string,
    confirmationId: string,
    responseId: string,
    files: UploadedConfirmationFile[],
    user: RequestUser,
    source: AuditLogSource
  ) {
    if (!hasOfficeAccess(user)) {
      await this.access.requireMutableProject(projectId, user.id);
    }
    this.validateFiles(files);
    const response = await this.prisma.projectConfirmationResponse.findFirst({
      where: {
        id: responseId,
        confirmationId,
        confirmation: { projectId },
      },
      select: {
        id: true,
        confirmation: { select: { status: true, confirmationCode: true } },
        artifacts: {
          orderBy: { sequence: "desc" },
          select: { sequence: true },
        },
      },
    });
    if (!response) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation response was not found"
      );
    }
    if (
      response.confirmation.status !== "RESPONSE_RECEIVED" &&
      response.confirmation.status !== "CLOSED"
    ) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "Files can only be added to a recorded response"
      );
    }
    if (response.artifacts.length + files.length > MAX_RESPONSE_FILES) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        `A response can contain up to ${MAX_RESPONSE_FILES} files`
      );
    }

    const artifacts = await this.storeArtifacts(
      responseId,
      files,
      (response.artifacts[0]?.sequence ?? 0) + 1,
      new Date(),
      user.id
    );
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.confirmationResponseArtifact.createMany({
          data: artifacts.map(({ data }) => ({ ...data, responseId })),
        });
        return normalizeConfirmationResponseFileNames(
          await tx.projectConfirmation.findUniqueOrThrow({
            where: { id: confirmationId },
            include: PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA,
          })
        );
      });
      await this.auditLogs.log({
        actorId: user.id,
        action: "PROJECT_CONFIRMATION_RESPONSE_ARTIFACTS_ADDED",
        targetType: "PROJECT_CONFIRMATION_RESPONSE",
        targetId: responseId,
        projectId,
        description: `Added ${files.length} file(s) to response for ${response.confirmation.confirmationCode ?? confirmationId}`,
        source,
      });
      return result;
    } catch (error) {
      await Promise.allSettled(
        artifacts.map(({ objectKey }) => this.storage.deleteObject(objectKey))
      );
      throw error;
    }
  }

  async downloadArtifact(
    projectId: string,
    confirmationId: string,
    responseId: string,
    artifactId: string,
    user: RequestUser
  ) {
    if (!hasOfficeAccess(user)) {
      await this.access.requireProjectMember(projectId, user.id);
    }
    const artifact = await this.prisma.confirmationResponseArtifact.findFirst({
      where: {
        id: artifactId,
        responseId,
        response: { confirmation: { id: confirmationId, projectId } },
      },
    });
    if (!artifact) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation response scan was not found"
      );
    }
    return {
      body: await this.storage.getObjectBuffer(artifact.objectKey),
      fileName: normalizeUploadedFileName(artifact.fileName),
      mimeType: artifact.mimeType,
    };
  }

  async withdraw(
    projectId: string,
    confirmationId: string,
    responseId: string,
    user: RequestUser,
    source: AuditLogSource
  ) {
    if (!hasOfficeAccess(user)) {
      await this.access.requireMutableProject(projectId, user.id);
    }
    await this.assertSourceTransitionAllowed(
      {
        confirmationId,
        responseId,
        projectId,
        actorId: user.id,
        auditSource: source,
      },
      "WITHDRAW_RESPONSE"
    );
    const response = await this.prisma.projectConfirmationResponse.findFirst({
      where: {
        id: responseId,
        confirmationId,
        confirmation: { projectId },
      },
      select: {
        id: true,
        confirmation: {
          select: {
            status: true,
            differenceStatus: true,
            confirmationCode: true,
            followUpEvents: {
              where: { eventType: "RESPONSE_RECEIVED", payload: { path: ["transition"], equals: "DIRECT_RESPONSE_CONFIRMATION" } },
              select: { payload: true },
            },
            responses: {
              where: { routingStatus: "ROUTED" },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true },
            },
            dispatches: {
              orderBy: { sequence: "desc" },
              take: 1,
              select: { id: true },
            },
          },
        },
        artifacts: { select: { objectKey: true } },
        sourceLibraryFile: { select: { id: true } },
      },
    });
    if (!response) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation response was not found"
      );
    }
    if (
      response.confirmation.status !== "RESPONSE_RECEIVED" ||
      response.confirmation.differenceStatus !== null ||
      response.confirmation.responses[0]?.id !== responseId
    ) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "Only a recorded response can be withdrawn"
      );
    }

    const directResponse = Boolean(response.sourceLibraryFile && response.confirmation.followUpEvents?.some(event => {
      const payload = event.payload as { responseId?: string; responseLibraryFileId?: string } | null;
      return payload?.responseId === responseId && payload?.responseLibraryFileId === response.sourceLibraryFile?.id;
    }));
    const result = await this.prisma.$transaction(async (tx) => {
      await this.assertSourceTransitionAllowed(
        {
          confirmationId,
          responseId,
          projectId,
          actorId: user.id,
          auditSource: source,
        },
        "WITHDRAW_RESPONSE",
        tx
      );
      if (response.sourceLibraryFile) {
        await tx.confirmationResponseLibraryFile.update({
          where: { id: response.sourceLibraryFile.id },
          data: {
            confirmationId: null,
            matchedResponseId: null,
            routingStatus: "PENDING_MATCH",
            routedById: user.id,
            routedAt: new Date(),
          },
        });
      }
      const advanced = await tx.projectConfirmation.updateMany({
        where: {
          id: confirmationId,
          status: "RESPONSE_RECEIVED",
          differenceStatus: null,
          responses: {
            some: { id: responseId, routingStatus: "ROUTED" },
          },
        },
        data: {
          status: "AWAITING_RESPONSE",
          differenceStatus: null,
        },
      });
      if (advanced.count !== 1) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "函证状态已变化，请刷新后重试"
        );
      }

      const deleted = await tx.projectConfirmationResponse.deleteMany({
        where: { id: responseId, confirmationId },
      });
      if (deleted.count !== 1) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "函证回函已变化，请刷新后重试"
        );
      }

      if (directResponse) {
        const removed = await tx.projectConfirmation.deleteMany({
          where: {
            id: confirmationId, projectId, status: "AWAITING_RESPONSE",
            currentArtifactId: null,
            dispatches: { none: {} }, artifacts: { none: {} }, responses: { none: {} },
            empImportItems: { none: {} }, responseLibraryFiles: { none: {} },
          },
        });
        if (removed.count !== 1) {
          throw new ApiConflictException("CONFIRMATION_STATE_CONFLICT", "自动生成的函证已存在其他关联，无法撤回，请刷新后重试");
        }
        return { deletedConfirmationId: confirmationId, responseLibraryFileId: response.sourceLibraryFile!.id };
      }

      const [latestDispatch] = response.confirmation.dispatches;
      if (latestDispatch) {
        await tx.confirmationDispatchEvent.create({
          data: {
            dispatchId: latestDispatch.id,
            eventType: "VOIDED",
            actorId: user.id,
            source: "RESPONSE_INTAKE",
            payload: { responseId, action: "WITHDRAWN" },
            occurredAt: new Date(),
          },
        });
      }
      await tx.confirmationFollowUpEvent.create({
        data: {
          confirmationId,
          eventType: "RESPONSE_WITHDRAWN",
          actorId: user.id,
          source: "RESPONSE_INTAKE",
          payload: { responseId } as Prisma.InputJsonValue,
          occurredAt: new Date(),
        },
      });
      return normalizeConfirmationResponseFileNames(
        await tx.projectConfirmation.findUniqueOrThrow({
          where: { id: confirmationId },
          include: PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA,
        })
      );
    });

    await Promise.allSettled(
      response.artifacts.map((artifact) =>
        this.storage.deleteObject(artifact.objectKey)
      )
    );
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_RESPONSE_WITHDRAWN",
      targetType: "PROJECT_CONFIRMATION_RESPONSE",
      targetId: responseId,
      projectId,
      description: `Withdrew response for ${response.confirmation.confirmationCode ?? confirmationId}`,
      source,
    });
    return result;
  }

  private async assertSourceTransitionAllowed(
    source: {
      confirmationId: string;
      responseId: string;
      projectId: string;
      actorId: string;
      auditSource: AuditLogSource;
    },
    action: ConfirmationSourceInvalidatingAction,
    transaction?: unknown
  ) {
    try {
      await (transaction
        ? this.importLinkGuard.assertCanInvalidateSource(
            source,
            action,
            transaction as ConfirmationImportLinkPrismaLike
          )
        : this.importLinkGuard.assertCanInvalidateSource(source, action));
    } catch (error) {
      if (error instanceof ApiConflictException) {
        const response = error.getResponse();
        const message =
          typeof response === "object" &&
          response !== null &&
          "message" in response
            ? String(response.message)
            : error.message;
        try {
          await this.auditLogs.log({
            actorId: source.actorId,
            action: "PROJECT_CONFIRMATION_SOURCE_STATE_BLOCKED",
            targetType: "PROJECT_CONFIRMATION_RESPONSE",
            targetId: source.responseId,
            projectId: source.projectId,
            description: message,
            source: source.auditSource,
          });
        } catch {
          // A failed audit write must not turn the source guard into success.
        }
      }
      throw error;
    }
  }

  private validateFiles(files: UploadedConfirmationFile[]) {
    if (files.length === 0 || files.length > MAX_RESPONSE_FILES) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        `Select between 1 and ${MAX_RESPONSE_FILES} response files`
      );
    }
    if (
      files.some(
        (file) =>
          !RESPONSE_FILE_TYPES[
            file.mimetype as keyof typeof RESPONSE_FILE_TYPES
          ]
      )
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Only PDF, JPG, and PNG response scans are supported"
      );
    }
  }

  private async storeArtifacts(
    responseId: string,
    files: UploadedConfirmationFile[],
    firstSequence: number,
    capturedAt: Date,
    uploadedBy: string
  ) {
    const artifacts: {
      objectKey: string;
      data: {
        id: string;
        sequence: number;
        objectKey: string;
        fileName: string;
        mimeType: string;
        fileSize: number;
        sha256: string;
        uploadedBy: string;
        capturedAt: Date;
      };
    }[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const artifactId = randomUUID();
        const format =
          RESPONSE_FILE_TYPES[
            file.mimetype as keyof typeof RESPONSE_FILE_TYPES
          ];
        const stored = await this.storage.putConfirmationResponseArtifact(
          responseId,
          artifactId,
          format,
          file.buffer,
          file.mimetype
        );
        artifacts.push({
          objectKey: stored.objectKey,
          data: {
            id: artifactId,
            sequence: firstSequence + index,
            objectKey: stored.objectKey,
            fileName: normalizeUploadedFileName(file.originalname),
            mimeType: file.mimetype,
            fileSize: file.size,
            sha256: createHash("sha256").update(file.buffer).digest("hex"),
            uploadedBy,
            capturedAt,
          },
        });
      }
      return artifacts;
    } catch (error) {
      await Promise.allSettled(
        artifacts.map(({ objectKey }) => this.storage.deleteObject(objectKey))
      );
      throw error;
    }
  }
}

function hasOfficeAccess(user: RequestUser) {
  return (
    user.globalRole === "CONFIRMATION_OFFICER" ||
    user.globalRole === "SUPER_ADMIN"
  );
}
