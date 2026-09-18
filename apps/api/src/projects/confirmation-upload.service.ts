import { createHash, randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ConfirmationType } from "@prisma/client";
import { PDFDocument } from "pdf-lib";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiConflictException,
  ApiNotFoundException,
} from "../common/api-error";
import { normalizeUploadedFileName } from "../common/file-name";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { DocumentConversionService } from "../workflow/document-conversion.service";
import { ProjectAccessService } from "./project-access.service";
import { ProjectConfirmationCodeService } from "./project-confirmation-code.service";
import {
  PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA,
  normalizeConfirmationResponseFileNames,
} from "./project-confirmations.service";

export type UploadedConfirmationFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

export type UploadedConfirmationSourceSnapshot = {
  source: "UPLOAD";
  fileNames?: string[];
  objectKey: string;
  fileName: string;
  originalFileName?: string;
  mimeType: string;
  size: number;
  sha256: string;
  previewIsPdf: boolean;
  previewMimeType: string;
};

export const MAX_CONFIRMATION_UPLOAD_BYTES = 20 * 1024 * 1024;

type PreparedPreview = {
  body: Buffer;
  mimeType: string;
  isPdfPreview: boolean;
};

const OFFICE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

@Injectable()
export class ConfirmationUploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly codes: ProjectConfirmationCodeService,
    private readonly storage: StorageService,
    private readonly conversion: DocumentConversionService
  ) {}

  async attachToDraft(
    projectId: string,
    confirmationId: string,
    counterpartyName: string,
    inputFiles:
      | UploadedConfirmationFile
      | UploadedConfirmationFile[]
      | undefined,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.access.requireMutableProject(projectId, user.id);
    const existing = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      select: {
        id: true,
        status: true,
        currentArtifactId: true,
        submissionVersion: true,
        currentArtifact: {
          select: {
            templateCode: true,
            pdfObjectKey: true,
            structuredSnapshot: true,
          },
        },
      },
    });
    if (!existing) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }
    if (
      existing.status !== "DRAFT" ||
      (existing.currentArtifactId &&
        existing.currentArtifact?.templateCode !== "UPLOADED_DOCUMENT")
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Only an empty draft can accept an uploaded file"
      );
    }
    const files = Array.isArray(inputFiles)
      ? inputFiles
      : inputFiles
        ? [inputFiles]
        : [];
    if (!files.length || files.length > 20) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Select between 1 and 20 files"
      );
    }
    for (const item of files) {
      this.assertNonEmptyFile(item);
    }
    let [file] = files;
    this.assertNonEmptyFile(file);
    if (files.length > 1 || existing.currentArtifactId) {
      const merged = await PDFDocument.create();
      const buffers: Buffer[] = [];
      if (existing.currentArtifact?.pdfObjectKey) {
        buffers.push(
          await this.storage.getObjectBuffer(
            existing.currentArtifact.pdfObjectKey
          )
        );
      }
      buffers.push(...files.map((item) => item.buffer));
      try {
        for (const buffer of buffers) {
          const document = await PDFDocument.load(buffer);
          const pages = await merged.copyPages(
            document,
            document.getPageIndices()
          );
          for (const page of pages) {
            merged.addPage(page);
          }
        }
      } catch {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "追加上传仅支持可读取且未加密的 PDF 文件"
        );
      }
      const buffer = Buffer.from(await merged.save());
      file = {
        buffer,
        size: buffer.length,
        mimetype: "application/pdf",
        originalname: "confirmation-documents.pdf",
      };
    }

    const normalizedName = counterpartyName.trim();
    if (!normalizedName) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Counterparty name is required"
      );
    }
    const safeFileName = sanitizeUploadedConfirmationFileName(
      file.originalname
    );
    const preview = await this.preparePreview(file, safeFileName);
    const artifactId = randomUUID();
    const submittedAt = new Date();
    try {
      const sourceObject = await this.storage.putConfirmationArtifact(
        projectId,
        confirmationId,
        artifactId,
        "docx",
        file.buffer,
        file.mimetype
      );
      const sourceSnapshot = buildUploadedConfirmationSourceSnapshot(
        file,
        safeFileName,
        sourceObject.objectKey,
        preview
      );
      const previousSnapshot = existing.currentArtifact?.structuredSnapshot as {
        fileNames?: string[];
        fileName?: string;
      } | null;
      sourceSnapshot.fileNames = [
        ...(existing.currentArtifactId
          ? (previousSnapshot?.fileNames ??
            (previousSnapshot?.fileName ? [previousSnapshot.fileName] : []))
          : []),
        ...files.map((item) =>
          sanitizeUploadedConfirmationFileName(item.originalname)
        ),
      ];
      const pdfObject = await this.storage.putConfirmationArtifact(
        projectId,
        confirmationId,
        artifactId,
        "pdf",
        preview.body,
        preview.mimeType
      );
      return await this.prisma.$transaction(async (tx) => {
        if (existing.currentArtifactId) {
          const claimed = await tx.projectConfirmation.updateMany({
            where: {
              id: confirmationId,
              status: "DRAFT",
              currentArtifactId: existing.currentArtifactId,
            },
            data: { draftUpdatedAt: submittedAt },
          });
          if (claimed.count !== 1) {
            throw new ApiConflictException(
              "CONFIRMATION_STATE_CONFLICT",
              "函证状态已变化，请刷新后重试"
            );
          }
        }

        const latestArtifact = await tx.confirmationArtifact.findFirst({
          where: { confirmationId },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        const artifactVersion =
          Math.max(existing.submissionVersion, latestArtifact?.version ?? 0) +
          1;
        await tx.confirmationArtifact.create({
          data: {
            id: artifactId,
            confirmationId,
            version: artifactVersion,
            templateCode: "UPLOADED_DOCUMENT",
            templateVersion: "1",
            docxObjectKey: sourceObject.objectKey,
            docxSize: file.buffer.byteLength,
            pdfObjectKey: pdfObject.objectKey,
            pdfSize: preview.body.byteLength,
            pdfSha256: createHash("sha256").update(preview.body).digest("hex"),
            structuredSnapshot: sourceSnapshot,
            derivedSnapshot: {},
            submissionKey: randomUUID(),
            submittedBy: user.id,
            submittedAt,
          },
        });
        await tx.projectConfirmation.update({
          where: { id: confirmationId },
          data: {
            displayName: normalizedName,
            counterpartyName: normalizedName,
            attachmentName: safeFileName,
            draftUpdatedAt: submittedAt,
            submissionVersion: artifactVersion,
            status: "DRAFT",
            currentArtifactId: artifactId,
            queuedAt: null,
            responsibleUserId: null,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "PROJECT_CONFIRMATION_FILE_ATTACHED_AND_SUBMITTED",
            targetType: "PROJECT_CONFIRMATION",
            targetId: confirmationId,
            projectId,
            description: `Attached uploaded file to confirmation ${confirmationId}`,
            ipAddress: source.ipAddress,
            userAgent: source.userAgent,
          },
        });
        const confirmation = await tx.projectConfirmation.findUnique({
          where: { id: confirmationId },
          include: PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA,
        });
        return normalizeConfirmationResponseFileNames(confirmation);
      });
    } catch (error) {
      await Promise.allSettled([
        this.storage.deleteConfirmationArtifact(
          projectId,
          confirmationId,
          artifactId,
          "docx"
        ),
        this.storage.deleteConfirmationArtifact(
          projectId,
          confirmationId,
          artifactId,
          "pdf"
        ),
      ]);
      throw error;
    }
  }

  async removeFromDraft(
    projectId: string,
    confirmationId: string,
    user: RequestUser,
    source: AuditLogSource,
    allowGeneratedArtifact = false
  ) {
    await this.access.requireMutableProject(projectId, user.id);
    const existing = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      select: {
        id: true,
        status: true,
        currentArtifactId: true,
        currentArtifact: {
          select: {
            templateCode: true,
            dispatches: { select: { id: true }, take: 1 },
          },
        },
      },
    });
    if (!existing) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }
    if (
      existing.status !== "DRAFT" ||
      !existing.currentArtifactId ||
      (!allowGeneratedArtifact &&
        existing.currentArtifact?.templateCode !== "UPLOADED_DOCUMENT")
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Only an uploaded draft file can be removed"
      );
    }
    const artifactId = existing.currentArtifactId;
    const hasDispatchHistory =
      (existing.currentArtifact?.dispatches.length ?? 0) > 0;
    await this.prisma.$transaction(async (tx) => {
      await (hasDispatchHistory
        ? tx.confirmationArtifact.update({
            where: { id: artifactId },
            data: {
              disposition: "INVALIDATED",
              invalidatedBy: user.id,
              invalidatedAt: new Date(),
              invalidationReason: "REMOVED_FROM_DRAFT",
            },
          })
        : tx.confirmationArtifact.delete({ where: { id: artifactId } }));
      const latestArtifact = await tx.confirmationArtifact.findFirst({
        where: { confirmationId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      await tx.projectConfirmation.update({
        where: { id: confirmationId },
        data: {
          currentArtifactId: null,
          attachmentName: null,
          submissionVersion: latestArtifact?.version ?? 0,
          queuedAt: null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "PROJECT_CONFIRMATION_UPLOADED_FILE_REMOVED",
          targetType: "PROJECT_CONFIRMATION",
          targetId: confirmationId,
          projectId,
          description: `Removed uploaded file from confirmation ${confirmationId}`,
          ipAddress: source.ipAddress,
          userAgent: source.userAgent,
        },
      });
    });
    if (!hasDispatchHistory) {
      await Promise.allSettled([
        this.storage.deleteConfirmationArtifact(
          projectId,
          confirmationId,
          artifactId,
          "docx"
        ),
        this.storage.deleteConfirmationArtifact(
          projectId,
          confirmationId,
          artifactId,
          "pdf"
        ),
      ]);
    }
    return this.prisma.projectConfirmation
      .findUnique({
        where: { id: confirmationId },
        include: PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA,
      })
      .then(normalizeConfirmationResponseFileNames);
  }

  async removeDraftContent(
    projectId: string,
    confirmationId: string,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.access.requireMutableProject(projectId, user.id);
    const existing = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      select: {
        id: true,
        status: true,
        currentArtifactId: true,
        draftTemplateCode: true,
      },
    });
    if (!existing) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }
    if (existing.status !== "DRAFT") {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Only draft confirmation content can be removed"
      );
    }
    if (existing.currentArtifactId) {
      return this.removeFromDraft(
        projectId,
        confirmationId,
        user,
        source,
        true
      );
    }
    if (!existing.draftTemplateCode) {
      return this.prisma.projectConfirmation
        .findUnique({
          where: { id: confirmationId },
          include: PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA,
        })
        .then(normalizeConfirmationResponseFileNames);
    }
    await this.prisma.projectConfirmation.update({
      where: { id: confirmationId },
      data: {
        draftTemplateCode: null,
        draftPayload: Prisma.DbNull,
        draftUpdatedAt: null,
        counterpartyName: "",
        attachmentName: null,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "PROJECT_CONFIRMATION_DRAFT_CONTENT_REMOVED",
        targetType: "PROJECT_CONFIRMATION",
        targetId: confirmationId,
        projectId,
        description: `Removed draft content from confirmation ${confirmationId}`,
        ipAddress: source.ipAddress,
        userAgent: source.userAgent,
      },
    });
    return this.prisma.projectConfirmation
      .findUnique({
        where: { id: confirmationId },
        include: PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA,
      })
      .then(normalizeConfirmationResponseFileNames);
  }

  async createFromUpload(
    projectId: string,
    type: ConfirmationType,
    counterpartyName: string,
    file: UploadedConfirmationFile | undefined,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.access.requireMutableProject(projectId, user.id);
    this.assertNonEmptyFile(file);
    const normalizedName = counterpartyName.trim();
    if (!normalizedName) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Counterparty name is required"
      );
    }
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { projectCode: true },
    });
    if (!project) {
      throw new ApiNotFoundException("NOT_FOUND", "Project was not found");
    }
    const safeFileName = sanitizeUploadedConfirmationFileName(
      file.originalname
    );
    const preview = await this.preparePreview(file, safeFileName);
    const confirmationId = randomUUID();
    const artifactId = randomUUID();
    const submittedAt = new Date();
    try {
      const sourceObject = await this.storage.putConfirmationArtifact(
        projectId,
        confirmationId,
        artifactId,
        "docx",
        file.buffer,
        file.mimetype
      );
      const sourceSnapshot = buildUploadedConfirmationSourceSnapshot(
        file,
        safeFileName,
        sourceObject.objectKey,
        preview
      );
      const pdfObject = await this.storage.putConfirmationArtifact(
        projectId,
        confirmationId,
        artifactId,
        "pdf",
        preview.body,
        preview.mimeType
      );
      return await this.prisma.$transaction(async (tx) => {
        const allocation = await this.codes.allocateInTransaction(
          tx,
          projectId,
          project.projectCode,
          type
        );
        await tx.projectConfirmation.create({
          data: {
            id: confirmationId,
            projectId,
            type,
            status: "DRAFT",
            displayName: normalizedName,
            confirmationCode: allocation.confirmationCode,
            typeSequence: allocation.sequence,
            counterpartyName: normalizedName,
            attachmentName: safeFileName,
            draftUpdatedAt: submittedAt,
            submissionVersion: 1,
            createdBy: user.id,
          },
        });
        await tx.confirmationArtifact.create({
          data: {
            id: artifactId,
            confirmationId,
            version: 1,
            templateCode: "UPLOADED_DOCUMENT",
            templateVersion: "1",
            docxObjectKey: sourceObject.objectKey,
            docxSize: file.buffer.byteLength,
            pdfObjectKey: pdfObject.objectKey,
            pdfSize: preview.body.byteLength,
            pdfSha256: createHash("sha256").update(preview.body).digest("hex"),
            structuredSnapshot: sourceSnapshot,
            derivedSnapshot: {},
            submissionKey: randomUUID(),
            submittedBy: user.id,
            submittedAt,
          },
        });
        await tx.projectConfirmation.update({
          where: { id: confirmationId },
          data: {
            status: "PREPARED",
            currentArtifactId: artifactId,
            queuedAt: submittedAt,
            responsibleUserId: user.id,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "PROJECT_CONFIRMATION_UPLOADED_AND_SUBMITTED",
            targetType: "PROJECT_CONFIRMATION",
            targetId: confirmationId,
            projectId,
            description: `Uploaded and submitted confirmation ${allocation.confirmationCode}`,
            ipAddress: source.ipAddress,
            userAgent: source.userAgent,
          },
        });
        const confirmation = await tx.projectConfirmation.findUnique({
          where: { id: confirmationId },
          include: PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA,
        });
        return normalizeConfirmationResponseFileNames(confirmation);
      });
    } catch (error) {
      await Promise.allSettled([
        this.storage.deleteConfirmationArtifact(
          projectId,
          confirmationId,
          artifactId,
          "docx"
        ),
        this.storage.deleteConfirmationArtifact(
          projectId,
          confirmationId,
          artifactId,
          "pdf"
        ),
      ]);
      throw error;
    }
  }

  private assertNonEmptyFile(
    file: UploadedConfirmationFile | undefined
  ): asserts file is UploadedConfirmationFile {
    if (!file || file.buffer.byteLength === 0) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "An uploaded confirmation file is required and cannot be empty"
      );
    }
    if (file.size !== file.buffer.byteLength) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Uploaded confirmation file size does not match its contents"
      );
    }
    if (file.buffer.byteLength > MAX_CONFIRMATION_UPLOAD_BYTES) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Uploaded confirmation file exceeds the 20 MiB limit"
      );
    }
  }

  private async preparePreview(
    file: UploadedConfirmationFile,
    safeFileName: string
  ): Promise<PreparedPreview> {
    const fallback = {
      body: file.buffer,
      mimeType: file.mimetype || "application/octet-stream",
      isPdfPreview: false,
    };
    if (!OFFICE_TYPES.has(file.mimetype)) {
      return fallback;
    }
    if (file.mimetype === "application/pdf") {
      return file.buffer.subarray(0, 5).toString("ascii") === "%PDF-"
        ? { body: file.buffer, mimeType: "application/pdf", isPdfPreview: true }
        : fallback;
    }
    try {
      const converted = await this.conversion.convertOfficeBufferToPdf({
        body: file.buffer,
        fileName: safeFileName,
        mimeType: file.mimetype,
      });
      if (converted.subarray(0, 5).toString("ascii") === "%PDF-") {
        return {
          body: converted,
          mimeType: "application/pdf",
          isPdfPreview: true,
        };
      }
    } catch {
      // Keep the original upload available when conversion is unsupported.
    }
    return fallback;
  }
}

function buildUploadedConfirmationSourceSnapshot(
  file: UploadedConfirmationFile,
  safeFileName: string,
  objectKey: string,
  preview: PreparedPreview
): UploadedConfirmationSourceSnapshot {
  const originalFileName = toTraceableOriginalFileName(file.originalname);
  return {
    source: "UPLOAD",
    objectKey,
    fileName: safeFileName,
    ...(originalFileName === safeFileName ? {} : { originalFileName }),
    mimeType: file.mimetype || "application/octet-stream",
    size: file.buffer.byteLength,
    sha256: createHash("sha256").update(file.buffer).digest("hex"),
    previewIsPdf: preview.isPdfPreview,
    previewMimeType: preview.mimeType,
  };
}

export function sanitizeUploadedConfirmationFileName(fileName: string) {
  const baseName =
    normalizeUploadedFileName(fileName).split(/[\\/]/).pop() ?? "";
  const withoutControls = [...baseName]
    .filter((character) => !isUnsafeFileNameCharacter(character))
    .join("");
  const sanitized = withoutControls
    .replaceAll(/[<>:"|?*]/g, "_")
    .trim()
    .replaceAll(/[. ]+$/g, "");
  return [...sanitized].slice(0, 120).join("") || "file";
}

function toTraceableOriginalFileName(fileName: string) {
  return [...normalizeUploadedFileName(fileName)]
    .map((character) => {
      if (isUnsafeFileNameCharacter(character)) {
        const codePoint = character.codePointAt(0) ?? 0;
        return `[U+${codePoint.toString(16).padStart(4, "0")}]`;
      }
      return character;
    })
    .join("");
}

function isUnsafeFileNameCharacter(character: string) {
  const codePoint = character.codePointAt(0) ?? 0;
  return (
    codePoint <= 0x1f ||
    codePoint === 0x7f ||
    (codePoint >= 0x80 && codePoint <= 0x9f) ||
    /[\\/<>:"|?*]/.test(character)
  );
}
