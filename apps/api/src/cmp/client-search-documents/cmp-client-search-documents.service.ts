import { createHash, randomUUID } from "node:crypto";
import pathModule from "node:path";

import { Injectable } from "@nestjs/common";
import type { CmpClientSearchDocumentCategory } from "@prisma/client";

import type { AuditLogSource } from "../../audit-logs/audit-log-source";
import { AuditLogsService } from "../../audit-logs/audit-logs.service";
import type { RequestUser } from "../../auth/request-user";
import {
  ApiBadRequestException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../../common/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { StorageService } from "../../storage/storage.service";
import { DocumentConversionService } from "../../workflow/document-conversion.service";
import { SpreadsheetPreviewCacheService } from "../../workflow/spreadsheet-preview-cache.service";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
]);
const WRITE_ROLES = new Set(["SUPER_ADMIN", "PARTNER", "PRINCIPAL", "MANAGER"]);

export type UploadedCmpSearchDocument = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class CmpClientSearchDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly conversion: DocumentConversionService,
    private readonly spreadsheetPreview: SpreadsheetPreviewCacheService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async list(clientId: string, category: CmpClientSearchDocumentCategory) {
    await this.assertClientExists(clientId);
    const documents = await this.prisma.cmpClientSearchDocument.findMany({
      where: { clientId, category },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    return { documents: documents.map(serializeDocument) };
  }

  async upload(
    clientId: string,
    category: CmpClientSearchDocumentCategory,
    file: UploadedCmpSearchDocument | undefined,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    assertCanWrite(user);
    await this.assertClientExists(clientId);
    const normalizedFile = file
      ? { ...file, originalname: normalizeMultipartFileName(file.originalname) }
      : undefined;
    assertUpload(normalizedFile);

    const id = randomUUID();
    const mimeType = normalizeMimeType(
      normalizedFile.originalname,
      normalizedFile.mimetype
    );
    const stored = await this.storage.putCmpClientSearchDocument(
      clientId,
      id,
      normalizedFile.originalname,
      normalizedFile.buffer,
      mimeType
    );
    let document;
    try {
      document = await this.prisma.cmpClientSearchDocument.create({
        data: {
          id,
          clientId,
          category,
          fileName: stored.fileName,
          originalName: normalizedFile.originalname,
          fileUrl: stored.objectKey,
          fileSize: normalizedFile.size,
          mimeType,
          contentHash: createHash("sha256")
            .update(normalizedFile.buffer)
            .digest("hex"),
          uploadedById: user.id,
        },
        include: { uploadedBy: { select: { id: true, name: true } } },
      });
    } catch (error) {
      await this.storage.deleteObjectIfPresent(stored.objectKey);
      throw error;
    }

    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_CLIENT_SEARCH_DOCUMENT_UPLOADED",
      targetType: "CMP_CLIENT_SEARCH_DOCUMENT",
      targetId: document.id,
      description: `Uploaded ${document.originalName} to ${category}`,
      source,
    });

    // Cache creation is best effort. Spreadsheet files use the native sheet
    // Cache and must never be flattened into a PDF preview.
    await this.warmPreviewCache(document).catch(() => null);
    return serializeDocument(document);
  }

  async download(id: string) {
    const document = await this.getDocument(id);
    const originalName = normalizeMultipartFileName(document.originalName);
    return {
      document: { ...document, originalName },
      file: this.storage.getDownloadObject(
        document.fileUrl,
        originalName,
        document.mimeType
      ),
    };
  }

  async remove(id: string, user: RequestUser, source?: AuditLogSource) {
    assertCanWrite(user);
    const document = await this.getDocument(id);
    await this.prisma.cmpClientSearchDocument.delete({ where: { id } });
    await Promise.all([
      this.storage.deleteObjectIfPresent(document.fileUrl),
      this.conversion.clearAttachmentPreviewCache(document.id),
    ]);
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_CLIENT_SEARCH_DOCUMENT_DELETED",
      targetType: "CMP_CLIENT_SEARCH_DOCUMENT",
      targetId: document.id,
      description: `Deleted ${document.originalName} from ${document.category}`,
      source,
    });
    return { deleted: true };
  }

  private async assertClientExists(clientId: string) {
    const client = await this.prisma.cmpClient.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) {
      throw new ApiNotFoundException("NOT_FOUND", "Client was not found");
    }
  }

  private async getDocument(id: string) {
    const document = await this.prisma.cmpClientSearchDocument.findUnique({
      where: { id },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    if (!document) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Client search document was not found"
      );
    }
    return document;
  }

  private warmPreviewCache(document: {
    id: string;
    fileName: string;
    originalName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
    version: number;
  }) {
    return isSpreadsheet(document)
      ? this.spreadsheetPreview.warmAttachmentPreview(document)
      : this.conversion.getAttachmentPreviewPdf(document);
  }
}

function isSpreadsheet(document: { originalName: string; mimeType: string }) {
  const name = document.originalName.toLowerCase();
  const mimeType = document.mimeType.toLowerCase();
  return (
    /\.xlsx?$/.test(name) ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType.includes("spreadsheetml")
  );
}

function serializeDocument(document: {
  id: string;
  clientId: string;
  category: CmpClientSearchDocumentCategory;
  originalName: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
  uploadedBy: { id: string; name: string };
}) {
  return {
    id: document.id,
    clientId: document.clientId,
    category: document.category,
    fileName: normalizeMultipartFileName(document.originalName),
    fileSize: document.fileSize,
    mimeType: document.mimeType,
    createdAt: document.createdAt.toISOString(),
    uploadedBy: document.uploadedBy,
  };
}

/**
 * Busboy exposes multipart header values as Latin-1 strings. Browsers send
 * UTF-8 bytes, so a Chinese file name otherwise becomes mojibake such as
 * `å½è¯`. Keep already-decoded Unicode intact and repair both new uploads
 * and legacy rows when they are read.
 */
export function normalizeMultipartFileName(fileName: string) {
  if (
    [...fileName].some((character) => (character.codePointAt(0) ?? 0) > 255)
  ) {
    return fileName;
  }

  const bytes = Buffer.from(fileName, "latin1");
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decoded.includes("\uFFFD") ? fileName : decoded;
  } catch {
    return fileName;
  }
}

function assertUpload(
  file: UploadedCmpSearchDocument | undefined
): asserts file is UploadedCmpSearchDocument {
  if (!file) {
    throw new ApiBadRequestException("BAD_REQUEST", "A file is required");
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      "File size must be between 1 byte and 50 MB"
    );
  }
  if (
    !ALLOWED_EXTENSIONS.has(pathModule.extname(file.originalname).toLowerCase())
  ) {
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      "Only PDF, Word, Excel, and PowerPoint files are supported"
    );
  }
}

function assertCanWrite(user: RequestUser) {
  if (!WRITE_ROLES.has(user.globalRole)) {
    throw new ApiForbiddenException(
      "FORBIDDEN",
      "You do not have permission to maintain Client search materials"
    );
  }
}

function normalizeMimeType(fileName: string, mimeType: string) {
  const byExtension: Record<string, string> = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return byExtension[pathModule.extname(fileName).toLowerCase()] ?? mimeType;
}
