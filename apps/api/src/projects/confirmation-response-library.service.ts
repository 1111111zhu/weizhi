import { createHash, randomUUID } from "node:crypto";
import pathModule from "node:path";

import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  ConfirmationType,
  RouteConfirmationResponseLibraryFileInput,
} from "@project-wing/shared";
import JSZip from "jszip";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiConflictException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import { normalizeUploadedFileName } from "../common/file-name";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { ConfirmationEmpImportWithdrawalService } from "./confirmation-emp-import-withdrawal.service";
import { ProjectAccessService } from "./project-access.service";
import { ProjectConfirmationCodeService } from "./project-confirmation-code.service";

export type UploadedConfirmationResponseLibraryFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_NOTES_LENGTH = 2000;
const MAX_SHORT_TEXT_LENGTH = 200;
const MAX_TITLE_LENGTH = 200;
const LEGACY_OFFICE_SIGNATURE = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);
const FILE_TYPES = {
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".tsv": "text/tab-separated-values",
  ".xls": "application/vnd.ms-excel",
  ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

type SupportedExtension = keyof typeof FILE_TYPES;

const RESPONSE_LIBRARY_INCLUDE = {
  uploader: { select: { id: true, name: true } },
  routedBy: { select: { id: true, name: true } },
  project: {
    select: {
      id: true,
      name: true,
      projectCode: true,
      cmpClient: { select: { nameZh: true, nameEn: true } },
    },
  },
  confirmation: {
    select: {
      id: true,
      confirmationCode: true,
      counterpartyName: true,
      displayName: true,
      type: true,
      status: true,
      differenceStatus: true,
    },
  },
} satisfies Prisma.ConfirmationResponseLibraryFileInclude;

@Injectable()
export class ConfirmationResponseLibraryService {
  private readonly logger = new Logger(ConfirmationResponseLibraryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auditLogs: AuditLogsService,
    private readonly access: ProjectAccessService,
    private readonly confirmationCodes: ProjectConfirmationCodeService,
    private readonly empImportWithdrawal: ConfirmationEmpImportWithdrawalService
  ) {}

  list() {
    return this.prisma.confirmationResponseLibraryFile.findMany({
      include: RESPONSE_LIBRARY_INCLUDE,
      // Keep claimed and matched responses visible for auditability and for a
      // Controlled return path; the UI marks their current routing state.
      orderBy: [
        { receivedAt: "desc" },
        { updatedAt: "desc" },
        { title: "asc" },
      ],
    });
  }

  async listForProject(projectId: string, user: RequestUser) {
    if (!hasConfirmationOfficeAccess(user)) {
      await this.access.requireProjectMember(projectId, user.id);
    }
    return this.prisma.confirmationResponseLibraryFile.findMany({
      where: {
        projectId,
        routingStatus: {
          in: ["PENDING_MATCH", "NO_SOURCE_REQUEST", "MATCHED"],
        },
      },
      include: RESPONSE_LIBRARY_INCLUDE,
      orderBy: [{ updatedAt: "desc" }, { receivedAt: "desc" }],
    });
  }

  async listPendingForProject(projectId: string, user: RequestUser) {
    if (!hasConfirmationOfficeAccess(user)) {
      await this.access.requireProjectMember(projectId, user.id);
    }
    return this.prisma.confirmationResponseLibraryFile.findMany({
      where: {
        projectId,
        routingStatus: { in: ["PENDING_MATCH", "NO_SOURCE_REQUEST"] },
      },
      include: RESPONSE_LIBRARY_INCLUDE,
      orderBy: [{ updatedAt: "desc" }, { receivedAt: "desc" }],
    });
  }

  async route(
    id: string,
    input: RouteConfirmationResponseLibraryFileInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    const response = await this.findResponse(id);
    if (
      input.action === "UNASSIGN_PROJECT" &&
      response.routingStatus === "MATCHED"
    ) {
      return this.withdrawMatchedResponse(response, user, source);
    }
    if (response.routingStatus === "MATCHED") {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "A matched response must be withdrawn from its confirmation first"
      );
    }

    if (input.action === "UNASSIGN_PROJECT") {
      if (response.projectId) {
        await this.access.requireMutableProject(response.projectId, user.id);
      }
      return this.prisma.$transaction(async (tx) => {
        await this.claimResponseForRouting(tx, response, user.id);
        const updated = await tx.confirmationResponseLibraryFile.update({
          where: { id },
          data: {
            projectId: null,
            confirmationId: null,
            matchedResponseId: null,
            provisionalType: null,
            routingStatus: "UNASSIGNED_PROJECT",
            routedById: null,
            routedAt: null,
          },
          include: RESPONSE_LIBRARY_INCLUDE,
        });
        await this.logRoutingChangeInTransaction(
          tx,
          updated,
          user,
          source,
          "Removed project assignment from"
        );
        return updated;
      });
    }

    const projectId = input.projectId as string;
    if (response.projectId && response.projectId !== projectId) {
      await this.access.requireMutableProject(response.projectId, user.id);
    }
    await this.access.requireMutableProject(projectId, user.id);
    if (input.action === "MATCH_CONFIRMATION") {
      return this.matchConfirmation(
        response,
        projectId,
        input.confirmationId as string,
        user,
        source
      );
    }
    if (input.action === "NO_SOURCE_REQUEST") {
      return this.createDirectResponseConfirmation(
        response,
        projectId,
        input.provisionalType ?? "OTHER",
        user,
        source
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await this.claimResponseForRouting(tx, response, user.id);
      const updated = await tx.confirmationResponseLibraryFile.update({
        where: { id },
        data: {
          projectId,
          confirmationId: null,
          matchedResponseId: null,
          provisionalType: input.provisionalType ?? null,
          routingStatus: "PENDING_MATCH",
          routedById: user.id,
          routedAt: new Date(),
        },
        include: RESPONSE_LIBRARY_INCLUDE,
      });
      await this.logRoutingChangeInTransaction(
        tx,
        updated,
        user,
        source,
        "Routed"
      );
      return updated;
    });
  }

  async upload(
    input: {
      projectId?: string;
      title: string;
      receivedAt: Date;
      courierTrackingNumber?: string;
      referenceNumber?: string;
      clientName: string;
      respondingEntity: string;
      notes?: string;
    },
    file: UploadedConfirmationResponseLibraryFile | undefined,
    user: RequestUser,
    source: AuditLogSource
  ) {
    if (input.projectId) {
      await this.access.requireMutableProject(input.projectId, user.id);
    } else if (!hasConfirmationOfficeAccess(user)) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only confirmation officers can upload to the global response warehouse"
      );
    }
    const title = input.title.trim();
    if (!title || title.length > MAX_TITLE_LENGTH) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        `Response title must contain 1 to ${MAX_TITLE_LENGTH} characters`
      );
    }
    const clientName = this.requiredShortText(input.clientName, "Client name");
    const respondingEntity = this.requiredShortText(
      input.respondingEntity,
      "Responding entity"
    );
    const courierTrackingNumber = this.optionalShortText(
      input.courierTrackingNumber,
      "Courier tracking number"
    );
    const referenceNumber = this.optionalShortText(
      input.referenceNumber,
      "Reference number"
    );
    const notes = input.notes?.trim() || undefined;
    if (notes && notes.length > MAX_NOTES_LENGTH) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        `Response notes must not exceed ${MAX_NOTES_LENGTH} characters`
      );
    }
    if (Number.isNaN(input.receivedAt.getTime())) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A valid received date is required"
      );
    }

    const validatedFile = await this.validateFile(file);
    const stored = await this.storage.putConfirmationResponseLibraryFile(
      validatedFile.fileName,
      validatedFile.buffer,
      validatedFile.mimeType
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const response = await tx.confirmationResponseLibraryFile.create({
          data: {
            code: `CRSP-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
            title,
            receivedAt: input.receivedAt,
            ...(courierTrackingNumber ? { courierTrackingNumber } : {}),
            ...(referenceNumber ? { referenceNumber } : {}),
            clientName,
            respondingEntity,
            ...(notes ? { notes } : {}),
            fileName: validatedFile.fileName,
            objectKey: stored.objectKey,
            fileSize: validatedFile.buffer.length,
            mimeType: validatedFile.mimeType,
            uploadedById: user.id,
            ...(input.projectId
              ? {
                  projectId: input.projectId,
                  routingStatus: "PENDING_MATCH" as const,
                  routedById: user.id,
                  routedAt: new Date(),
                }
              : {}),
          },
          include: RESPONSE_LIBRARY_INCLUDE,
        });
        await this.auditLogs.logInTransaction(tx, {
          actorId: user.id,
          action: "CONFIRMATION_RESPONSE_LIBRARY_FILE_UPLOADED",
          targetType: "CONFIRMATION_RESPONSE_LIBRARY_FILE",
          targetId: response.id,
          description: `Uploaded confirmation response ${response.code}`,
          source,
        });
        return response;
      });
    } catch (error) {
      await this.deleteStoredObject(
        stored.objectKey,
        "rolling back a failed response upload"
      );
      throw error;
    }
  }

  async download(id: string, user: RequestUser, source: AuditLogSource) {
    const response = await this.findResponse(id);
    if (response.projectId) {
      await this.access.requireProjectMember(response.projectId, user.id);
    }
    await this.auditLogs.log({
      actorId: user.id,
      action: "CONFIRMATION_RESPONSE_LIBRARY_FILE_DOWNLOADED",
      targetType: "CONFIRMATION_RESPONSE_LIBRARY_FILE",
      targetId: response.id,
      description: `Downloaded confirmation response ${response.code}`,
      source,
    });
    return {
      response,
      file: this.storage.getDownloadObject(
        response.objectKey,
        response.fileName,
        response.mimeType
      ),
    };
  }

  async preview(id: string, user: RequestUser) {
    const response = await this.findResponse(id);
    if (response.projectId) {
      await this.access.requireProjectMember(response.projectId, user.id);
    }
    return {
      response,
      body: await this.storage.getObjectBuffer(response.objectKey),
    };
  }

  private async validateFile(
    file: UploadedConfirmationResponseLibraryFile | undefined
  ): Promise<{
    buffer: Buffer;
    fileName: string;
    mimeType: (typeof FILE_TYPES)[SupportedExtension];
  }> {
    if (
      !file?.buffer?.length ||
      file.size !== file.buffer.length ||
      file.size > MAX_FILE_SIZE
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Upload a response file up to 50 MB"
      );
    }

    const fileName = normalizeUploadedFileName(file.originalname).trim();
    const extension = pathModule
      .extname(fileName)
      .toLowerCase() as SupportedExtension;
    if (!(extension in FILE_TYPES)) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "This response file type is not supported"
      );
    }

    await this.assertFileSignature(extension, file.buffer);
    return {
      buffer: file.buffer,
      fileName,
      mimeType: FILE_TYPES[extension],
    };
  }

  private async assertFileSignature(
    extension: SupportedExtension,
    buffer: Buffer
  ) {
    const invalid = () =>
      new ApiBadRequestException(
        "VALIDATION_FAILED",
        "The uploaded response file does not match its file type"
      );

    if ([".doc", ".xls", ".ppt"].includes(extension)) {
      if (!buffer.subarray(0, 8).equals(LEGACY_OFFICE_SIGNATURE)) {
        throw invalid();
      }
      return;
    }
    if ([".docx", ".xlsx", ".xlsm", ".pptx"].includes(extension)) {
      try {
        const archive = await JSZip.loadAsync(buffer);
        const requiredPart =
          extension === ".docx"
            ? "word/document.xml"
            : extension === ".pptx"
              ? "ppt/presentation.xml"
              : "xl/workbook.xml";
        if (
          !archive.file("[Content_Types].xml") ||
          !archive.file(requiredPart)
        ) {
          throw invalid();
        }
      } catch (error) {
        if (error instanceof ApiBadRequestException) {
          throw error;
        }
        throw invalid();
      }
      return;
    }
    if (extension === ".pdf" && buffer.subarray(0, 5).toString() !== "%PDF-") {
      throw invalid();
    }
    if (
      extension === ".png" &&
      !buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
      throw invalid();
    }
    if (
      [".jpg", ".jpeg"].includes(extension) &&
      !(buffer[0] === 0xff && buffer[1] === 0xd8)
    ) {
      throw invalid();
    }
    if ([".csv", ".tsv"].includes(extension) && buffer.includes(0)) {
      throw invalid();
    }
  }

  private async findResponse(id: string) {
    const response =
      await this.prisma.confirmationResponseLibraryFile.findUnique({
        where: { id },
      });
    if (!response) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation response was not found"
      );
    }
    return response;
  }

  private async createDirectResponseConfirmation(
    response: Awaited<
      ReturnType<ConfirmationResponseLibraryService["findResponse"]>
    >,
    projectId: string,
    type: ConfirmationType,
    user: RequestUser,
    source: AuditLogSource
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { projectCode: true },
    });
    if (!project) {
      throw new ApiNotFoundException("NOT_FOUND", "Project was not found");
    }

    const responseId = randomUUID();
    const artifactId = randomUUID();
    const body = await this.storage.getObjectBuffer(response.objectKey);
    const stored = await this.storage.putConfirmationResponseArtifactFile(
      responseId,
      artifactId,
      response.fileName,
      body,
      response.mimeType
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.claimResponseForRouting(tx, response, user.id);
        const allocation = await this.confirmationCodes.allocateInTransaction(
          tx,
          projectId,
          project.projectCode,
          type
        );
        const confirmation = await tx.projectConfirmation.create({
          data: {
            projectId,
            type,
            status: "RESPONSE_RECEIVED",
            confirmationCode: allocation.confirmationCode,
            typeSequence: allocation.sequence,
            displayName: `无需发函 · ${response.respondingEntity}`,
            clientName: response.clientName,
            counterpartyName: response.respondingEntity,
            respondingEntityName: response.respondingEntity,
            notes: "由回函直接生成，已跳过发函跟踪流程",
            createdBy: user.id,
            responsibleUserId: user.id,
          },
          select: {
            id: true,
            confirmationCode: true,
            counterpartyName: true,
          },
        });

        await tx.projectConfirmationResponse.create({
          data: {
            id: responseId,
            confirmationId: confirmation.id,
            responseStatus: "RECEIVED",
            responseChannel: "OTHER",
            matchMethod: "MANUAL",
            routingStatus: "ROUTED",
            responsibleUserId: user.id,
            receivingUserId: user.id,
            receivedAt: response.receivedAt,
            receivedBy: user.id,
            responseReference: response.referenceNumber,
            attachmentName: response.fileName,
            notes: response.notes,
            artifacts: {
              create: {
                id: artifactId,
                sequence: 1,
                objectKey: stored.objectKey,
                fileName: response.fileName,
                mimeType: response.mimeType,
                fileSize: body.length,
                sha256: createHash("sha256").update(body).digest("hex"),
                uploadedBy: response.uploadedById,
                capturedAt: response.receivedAt,
              },
            },
          },
        });
        await tx.projectConfirmation.update({
          where: { id: confirmation.id },
          data: {
            followUpEvents: {
              create: {
                eventType: "RESPONSE_RECEIVED",
                actorId: user.id,
                source: "RESPONSE_INTAKE",
                notes: response.notes,
                payload: {
                  responseId,
                  responseLibraryFileId: response.id,
                  transition: "DIRECT_RESPONSE_CONFIRMATION",
                  source: "NO_SOURCE_REQUEST",
                } as Prisma.InputJsonValue,
                occurredAt: new Date(),
              },
            },
          },
        });
        const updated = await tx.confirmationResponseLibraryFile.update({
          where: { id: response.id },
          data: {
            projectId,
            confirmationId: confirmation.id,
            provisionalType: type,
            routingStatus: "MATCHED",
            routedById: user.id,
            routedAt: new Date(),
            matchedResponseId: responseId,
          },
          include: RESPONSE_LIBRARY_INCLUDE,
        });
        await this.auditLogs.logInTransaction(tx, {
          actorId: user.id,
          action: "CONFIRMATION_RESPONSE_LIBRARY_FILE_MATCHED",
          targetType: "CONFIRMATION_RESPONSE_LIBRARY_FILE",
          targetId: response.id,
          projectId,
          description: `Created direct-response confirmation ${confirmation.confirmationCode ?? confirmation.id} for ${response.code}`,
          source,
        });
        return updated;
      });
    } catch (error) {
      await this.deleteStoredObject(
        stored.objectKey,
        "rolling back a direct response confirmation"
      );
      throw error;
    }
  }

  private async withdrawMatchedResponse(
    response: Awaited<
      ReturnType<ConfirmationResponseLibraryService["findResponse"]>
    >,
    user: RequestUser,
    source: AuditLogSource
  ) {
    if (
      !response.projectId ||
      !response.confirmationId ||
      !response.matchedResponseId
    ) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "The matched response is missing its confirmation link"
      );
    }
    await this.access.requireMutableProject(response.projectId, user.id);

    const {projectId} = response;
    const {confirmationId} = response;
    const {matchedResponseId} = response;
    const importedItems = await this.prisma.confirmationEmpImportItem.findMany({
      where: {
        confirmationId,
        responseId: matchedResponseId,
        status: "SUCCEEDED",
        withdrawnAt: null,
      },
      select: { jobId: true },
    });
    for (const importJobId of new Set(
      importedItems.map((item) => item.jobId)
    )) {
      await this.empImportWithdrawal.withdraw(
        projectId,
        importJobId,
        confirmationId,
        user,
        source,
        `Returned matched response ${response.code} to the confirmation center`,
        true
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.confirmationResponseLibraryFile.updateMany({
        where: {
          id: response.id,
          updatedAt: response.updatedAt,
          routingStatus: "MATCHED",
          matchedResponseId,
        },
        data: { routedById: user.id, routedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "This response was updated by another user; refresh and try again"
        );
      }

      const linkedResponse = await tx.projectConfirmationResponse.findUnique({
        where: { id: matchedResponseId },
        select: {
          id: true,
          confirmationId: true,
          responseStatus: true,
          routingStatus: true,
          artifacts: { select: { id: true } },
        },
      });
      const confirmation = await tx.projectConfirmation.findUnique({
        where: { id: confirmationId },
        select: {
          id: true,
          projectId: true,
          status: true,
          differenceStatus: true,
          counterpartyName: true,
          responses: {
            where: { routingStatus: "ROUTED" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, artifacts: { select: { id: true } } },
          },
        },
      });
      const canReopenMatchedConfirmation =
        confirmation?.status === "RESPONSE_RECEIVED" &&
        confirmation.differenceStatus === null;
      const canRetractMatchedReview =
        confirmation?.status === "CLOSED" &&
        confirmation.differenceStatus === "MATCHED";
      if (
        !linkedResponse ||
        !confirmation ||
        linkedResponse.confirmationId !== confirmationId ||
        linkedResponse.routingStatus !== "ROUTED" ||
        confirmation.projectId !== projectId ||
        (!canReopenMatchedConfirmation && !canRetractMatchedReview) ||
        confirmation.responses[0]?.id !== linkedResponse.id
      ) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "The matched response link is no longer available"
        );
      }

      const restored = await tx.projectConfirmation.updateMany({
        where: {
          id: confirmationId,
          projectId,
          status: confirmation.status,
          differenceStatus: confirmation.differenceStatus,
          responses: {
            some: { id: linkedResponse.id, routingStatus: "ROUTED" },
          },
        },
        data: { status: "AWAITING_RESPONSE", differenceStatus: null },
      });
      if (restored.count !== 1) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "The confirmation cannot be returned to awaiting response"
        );
      }

      const responseArtifactIds = linkedResponse.artifacts.map(
        (artifact) => artifact.id
      );
      await tx.confirmationEmpImportItem.updateMany({
        where: {
          OR: [
            { responseId: linkedResponse.id },
            ...(responseArtifactIds.length
              ? [{ responseArtifactId: { in: responseArtifactIds } }]
              : []),
          ],
        },
        data: { responseId: null, responseArtifactId: null },
      });

      // Clear the library foreign-key link before deleting the project response.
      // The library row owns matchedResponseId, so deleting first violates the FK.
      const updated = await tx.confirmationResponseLibraryFile.update({
        where: { id: response.id },
        data: {
          projectId: null,
          confirmationId: null,
          matchedResponseId: null,
          provisionalType: null,
          routingStatus: "UNASSIGNED_PROJECT",
          routedById: null,
          routedAt: null,
        },
        include: RESPONSE_LIBRARY_INCLUDE,
      });

      const deleted = await tx.projectConfirmationResponse.deleteMany({
        where: { id: linkedResponse.id, confirmationId },
      });
      if (deleted.count !== 1) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "The confirmation response is no longer available"
        );
      }

      const latestDispatch = await tx.projectConfirmationDispatch.findFirst({
        where: { confirmationId },
        orderBy: { sequence: "desc" },
        select: { id: true },
      });
      if (latestDispatch) {
        await tx.confirmationDispatchEvent.create({
          data: {
            dispatchId: latestDispatch.id,
            eventType: "VOIDED",
            actorId: user.id,
            source: "RESPONSE_INTAKE",
            payload: {
              responseId: linkedResponse.id,
              responseLibraryFileId: response.id,
              transition: "RESPONSE_WITHDRAWN",
            },
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
          notes: response.notes,
          payload: {
            responseId: linkedResponse.id,
            responseLibraryFileId: response.id,
            previous: {
              status: confirmation.status,
              differenceStatus: confirmation.differenceStatus,
            },
            next: {
              status: "AWAITING_RESPONSE",
              differenceStatus: null,
            },
          } as Prisma.InputJsonValue,
          occurredAt: new Date(),
        },
      });

      await this.auditLogs.logInTransaction(tx, {
        actorId: user.id,
        action: "CONFIRMATION_RESPONSE_LIBRARY_FILE_RETURNED",
        targetType: "CONFIRMATION_RESPONSE_LIBRARY_FILE",
        targetId: response.id,
        projectId,
        description: `Returned matched response ${response.code} and reopened ${confirmationId}`,
        source,
      });
      return updated;
    });
  }

  private async matchConfirmation(
    response: Awaited<
      ReturnType<ConfirmationResponseLibraryService["findResponse"]>
    >,
    projectId: string,
    confirmationId: string,
    user: RequestUser,
    source: AuditLogSource
  ) {
    const confirmation = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      select: {
        id: true,
        status: true,
        type: true,
        confirmationCode: true,
        responsibleUserId: true,
        responses: {
          where: { responseStatus: "RECEIVED", routingStatus: "ROUTED" },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!confirmation) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found in the selected project"
      );
    }
    if (
      confirmation.status === "RESPONSE_RECEIVED" ||
      (confirmation.responses?.length ?? 0) > 0
    ) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "This confirmation is not available for a response match"
      );
    }

    const responseId = randomUUID();
    const artifactId = randomUUID();
    const body = await this.storage.getObjectBuffer(response.objectKey);
    const stored = await this.storage.putConfirmationResponseArtifactFile(
      responseId,
      artifactId,
      response.fileName,
      body,
      response.mimeType
    );
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.claimResponseForRouting(tx, response, user.id);
        const claimed = await tx.projectConfirmation.updateMany({
          where: {
            id: confirmationId,
            status: confirmation.status,
            responses: {
              none: { responseStatus: "RECEIVED", routingStatus: "ROUTED" },
            },
          },
          data: { status: "RESPONSE_RECEIVED" },
        });
        if (claimed.count !== 1) {
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            "This confirmation is no longer awaiting a response"
          );
        }
        await tx.projectConfirmationResponse.create({
          data: {
            id: responseId,
            confirmationId,
            responseStatus: "RECEIVED",
            responseChannel: "OTHER",
            matchMethod: "MANUAL",
            routingStatus: "ROUTED",
            responsibleUserId: confirmation.responsibleUserId,
            receivingUserId: user.id,
            receivedAt: response.receivedAt,
            receivedBy: user.id,
            responseReference: response.referenceNumber,
            attachmentName: response.fileName,
            notes: response.notes,
            artifacts: {
              create: {
                id: artifactId,
                sequence: 1,
                objectKey: stored.objectKey,
                fileName: response.fileName,
                mimeType: response.mimeType,
                fileSize: body.length,
                sha256: createHash("sha256").update(body).digest("hex"),
                uploadedBy: response.uploadedById,
                capturedAt: response.receivedAt,
              },
            },
          },
        });
        await tx.projectConfirmation.update({
          where: { id: confirmationId },
          data: {
            followUpEvents: {
              create: {
                eventType: "RESPONSE_RECEIVED",
                actorId: user.id,
                source: "RESPONSE_INTAKE",
                notes: response.notes,
                payload: {
                  responseId,
                  responseLibraryFileId: response.id,
                } as Prisma.InputJsonValue,
                occurredAt: new Date(),
              },
            },
          },
        });
        const updated = await tx.confirmationResponseLibraryFile.update({
          where: { id: response.id },
          data: {
            projectId,
            confirmationId,
            provisionalType: confirmation.type,
            routingStatus: "MATCHED",
            routedById: user.id,
            routedAt: new Date(),
            matchedResponseId: responseId,
          },
          include: RESPONSE_LIBRARY_INCLUDE,
        });
        await this.auditLogs.logInTransaction(tx, {
          actorId: user.id,
          action: "CONFIRMATION_RESPONSE_LIBRARY_FILE_MATCHED",
          targetType: "CONFIRMATION_RESPONSE_LIBRARY_FILE",
          targetId: response.id,
          projectId,
          description: `Matched ${response.code} to ${confirmation.confirmationCode ?? confirmationId}`,
          source,
        });
        return updated;
      });
    } catch (error) {
      await this.deleteStoredObject(
        stored.objectKey,
        "rolling back a failed response match"
      );
      throw error;
    }
  }

  private async claimResponseForRouting(
    tx: Prisma.TransactionClient,
    response: Awaited<
      ReturnType<ConfirmationResponseLibraryService["findResponse"]>
    >,
    routedById: string
  ) {
    const claimed = await tx.confirmationResponseLibraryFile.updateMany({
      where: {
        id: response.id,
        updatedAt: response.updatedAt,
        matchedResponseId: null,
        routingStatus: { not: "MATCHED" },
      },
      data: { routedById, routedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "This response was routed by another user; refresh and try again"
      );
    }
  }

  private async logRoutingChangeInTransaction(
    tx: Prisma.TransactionClient,
    response: { id: string; code: string; projectId: string | null },
    user: RequestUser,
    source: AuditLogSource,
    verb: string
  ) {
    await this.auditLogs.logInTransaction(tx, {
      actorId: user.id,
      action: "CONFIRMATION_RESPONSE_LIBRARY_FILE_ROUTED",
      targetType: "CONFIRMATION_RESPONSE_LIBRARY_FILE",
      targetId: response.id,
      projectId: response.projectId ?? undefined,
      description: `${verb} confirmation response ${response.code}`,
      source,
    });
  }

  private requiredShortText(value: string, label: string) {
    const normalized = value.trim();
    if (!normalized || normalized.length > MAX_SHORT_TEXT_LENGTH) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        `${label} must contain 1 to ${MAX_SHORT_TEXT_LENGTH} characters`
      );
    }
    return normalized;
  }

  private optionalShortText(value: string | undefined, label: string) {
    const normalized = value?.trim() || undefined;
    if (normalized && normalized.length > MAX_SHORT_TEXT_LENGTH) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        `${label} must not exceed ${MAX_SHORT_TEXT_LENGTH} characters`
      );
    }
    return normalized;
  }

  private async deleteStoredObject(objectKey: string, context: string) {
    try {
      await this.storage.deleteObject(objectKey);
    } catch (error) {
      this.logger.error(
        `Object cleanup failed while ${context}: ${objectKey}`,
        error instanceof Error ? error.stack : undefined
      );
    }
  }
}

function hasConfirmationOfficeAccess(user: RequestUser) {
  return (
    user.globalRole === "CONFIRMATION_OFFICER" ||
    user.globalRole === "SUPER_ADMIN"
  );
}
