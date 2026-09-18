import { Injectable } from "@nestjs/common";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiConflictException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { sanitizeUploadedConfirmationFileName } from "./confirmation-upload.service";

@Injectable()
export class ConfirmationPrintService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async getPrintableArtifact(
    confirmationId: string,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await Promise.resolve();
    return this.getOfficeArtifact(confirmationId, user, source, "print");
  }

  async getPreviewArtifact(
    confirmationId: string,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await Promise.resolve();
    return this.getOfficeArtifact(confirmationId, user, source, "preview");
  }

  private async getOfficeArtifact(
    confirmationId: string,
    user: RequestUser,
    source: AuditLogSource,
    purpose: "preview" | "print"
  ) {
    this.requireOfficeAccess(user);
    const confirmation = await this.prisma.projectConfirmation.findUnique({
      where: { id: confirmationId },
      select: {
        id: true,
        projectId: true,
        confirmationCode: true,
        currentArtifact: {
          select: {
            id: true,
            disposition: true,
            templateCode: true,
            pdfObjectKey: true,
            structuredSnapshot: true,
          },
        },
      },
    });
    if (!confirmation) {
      throw new ApiNotFoundException("NOT_FOUND", "Confirmation was not found");
    }
    if (confirmation.currentArtifact?.disposition !== "ACTIVE") {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "Confirmation does not have an active printable artifact"
      );
    }
    await this.auditLogs.log({
      actorId: user.id,
      action:
        purpose === "preview"
          ? "CONFIRMATION_DOCUMENT_PREVIEWED"
          : "CONFIRMATION_PRINT_DOCUMENT_REQUESTED",
      targetType: "PROJECT_CONFIRMATION",
      targetId: confirmation.id,
      projectId: confirmation.projectId,
      description:
        purpose === "preview"
          ? `Previewed confirmation artifact ${confirmation.currentArtifact.id}`
          : `Requested printable artifact ${confirmation.currentArtifact.id}`,
      source,
    });
    if (confirmation.currentArtifact.templateCode === "UPLOADED_DOCUMENT") {
      const sourceSnapshot = readUploadedSourceSnapshot(
        confirmation.currentArtifact.structuredSnapshot
      );
      if (!sourceSnapshot) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "Uploaded confirmation file metadata is unavailable"
        );
      }
      const sourceFileName = sanitizeUploadedConfirmationFileName(
        sourceSnapshot.fileName
      );
      const { previewIsPdf } = sourceSnapshot;
      const fileName = previewIsPdf
        ? ensurePdfFileName(sourceFileName)
        : sourceFileName;
      const objectKey = previewIsPdf
        ? confirmation.currentArtifact.pdfObjectKey
        : sourceSnapshot.objectKey;
      const mimeType = previewIsPdf
        ? "application/pdf"
        : sourceSnapshot.mimeType || "application/octet-stream";
      if (purpose === "preview") {
        return {
          fileName,
          mimeType,
          body: await this.storage.getObjectBuffer(objectKey),
        };
      }
      return this.storage.getDownloadObject(objectKey, fileName, mimeType);
    }

    const fileName = `${confirmation.confirmationCode ?? confirmation.id}-confirmation.pdf`;
    if (purpose === "preview") {
      return {
        fileName,
        mimeType: "application/pdf",
        body: await this.storage.getObjectBuffer(
          confirmation.currentArtifact.pdfObjectKey
        ),
      };
    }
    return this.storage.getDownloadObject(
      confirmation.currentArtifact.pdfObjectKey,
      fileName,
      "application/pdf"
    );
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
}

type UploadedSourceSnapshot = {
  source: "UPLOAD";
  objectKey: string;
  fileName: string;
  mimeType: string;
  previewIsPdf: boolean;
};

function readUploadedSourceSnapshot(
  value: unknown
): UploadedSourceSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    record.source !== "UPLOAD" ||
    typeof record.objectKey !== "string" ||
    typeof record.fileName !== "string" ||
    typeof record.mimeType !== "string" ||
    typeof record.previewIsPdf !== "boolean"
  ) {
    return null;
  }
  return {
    source: "UPLOAD",
    objectKey: record.objectKey,
    fileName: record.fileName,
    mimeType: record.mimeType,
    previewIsPdf: record.previewIsPdf,
  };
}

function ensurePdfFileName(fileName: string) {
  if (fileName.toLowerCase().endsWith(".pdf")) {
    return fileName;
  }
  return `${fileName.replace(/\.[^./\\]*$/, "") || "confirmation"}.pdf`;
}
