import { randomUUID } from "node:crypto";
import pathModule from "node:path";

import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
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
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

export type UploadedKnowledgeDocumentFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export type CreateKnowledgeDocumentInput = {
  referenceCode?: unknown;
  title?: unknown;
  department?: unknown;
  type?: unknown;
  kind?: unknown;
  secondaryCategory?: unknown;
  tertiaryCategory?: unknown;
  body?: unknown;
  externalLink?: unknown;
  previewAllowed?: unknown;
  downloadAllowed?: unknown;
};

const DOCUMENT_SELECT = {
  id: true,
  referenceCode: true,
  title: true,
  department: true,
  type: true,
  kind: true,
  secondaryCategory: true,
  tertiaryCategory: true,
  body: true,
  externalLink: true,
  previewAllowed: true,
  downloadAllowed: true,
  status: true,
  originalName: true,
  objectKey: true,
  mimeType: true,
  size: true,
  updatedAt: true,
  uploader: { select: { id: true, image: true, name: true } },
  attachments: {
    select: {
      id: true,
      originalName: true,
      objectKey: true,
      mimeType: true,
      size: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;
const KNOWLEDGE_DEPARTMENTS = new Set(["admin", "hr", "finance", "qm", "it"]);
const KNOWLEDGE_TYPES = new Set([
  "policy",
  "process",
  "form",
  "template",
  "technicalAlert",
  "training",
  "guide",
]);
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const UPLOAD_FORMATS = {
  ".pdf": {
    mimeType: "application/pdf",
    signature: "pdf",
  },
  ".doc": {
    mimeType: "application/msword",
    signature: "ole",
  },
  ".docx": {
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    signature: "wordZip",
  },
  ".xls": {
    mimeType: "application/vnd.ms-excel",
    signature: "ole",
  },
  ".xlsx": {
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    signature: "excelZip",
  },
  ".ppt": {
    mimeType: "application/vnd.ms-powerpoint",
    signature: "ole",
  },
  ".pptx": {
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    signature: "powerPointZip",
  },
} as const;

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async list() {
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: DOCUMENT_SELECT,
    });
    return documents.map(toKnowledgeDocumentItem);
  }

  async listArchived() {
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: { status: "ARCHIVED" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: DOCUMENT_SELECT,
    });
    return documents.map(toKnowledgeDocumentItem);
  }

  async upload(
    input: CreateKnowledgeDocumentInput,
    file: UploadedKnowledgeDocumentFile | undefined,
    user: RequestUser,
    source?: AuditLogSource,
    attachmentFiles: UploadedKnowledgeDocumentFile[] = []
  ) {
    this.requireUploader(user);
    const metadata = parseMetadata(input);
    if (metadata.kind === "FILE" && !metadata.referenceCode) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "referenceCode is required for files"
      );
    }
    const validated = file ? await validateDocument(file) : undefined;
    if (metadata.kind === "FILE" && !validated) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A knowledge document file is required"
      );
    }
    if (
      metadata.kind === "NOTICE" &&
      !metadata.body &&
      !metadata.externalLink
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A notice body or link is required"
      );
    }

    const documentId = randomUUID();
    const preparedAttachments = await this.prepareAttachments(
      documentId,
      attachmentFiles
    );
    metadata.body = hydrateAttachmentNodes(metadata.body, preparedAttachments);
    const stored = validated
      ? await this.storage.putKnowledgeDocument(
          documentId,
          validated.file.originalname,
          validated.file.buffer,
          validated.format.mimeType
        )
      : undefined;
    let createdDocumentId: string | undefined;
    try {
      const document = await this.prisma.knowledgeDocument.create({
        data: {
          id: documentId,
          ...metadata,
          originalName: validated
            ? normalizeFileName(validated.file.originalname)
            : null,
          objectKey: stored?.objectKey ?? null,
          mimeType: validated?.format.mimeType ?? null,
          size: validated?.file.size ?? null,
          uploadedById: user.id,
          attachments: {
            create: preparedAttachments.map(({ id, ...attachment }) => ({
              id,
              ...attachment,
            })),
          },
        },
        select: DOCUMENT_SELECT,
      });
      createdDocumentId = document.id;
      await this.auditLogs.log({
        actorId: user.id,
        action:
          metadata.kind === "NOTICE"
            ? "KNOWLEDGE_NOTICE_PUBLISHED"
            : "KNOWLEDGE_DOCUMENT_UPLOADED",
        targetType: "KNOWLEDGE_DOCUMENT",
        targetId: document.id,
        description: `${metadata.kind === "NOTICE" ? "Published knowledge notice" : "Uploaded knowledge document"} ${document.referenceCode ?? ""}: ${document.title}`,
        source,
      });
      return toKnowledgeDocumentItem(document);
    } catch (error) {
      if (createdDocumentId) {
        try {
          await this.prisma.knowledgeDocument.delete({
            where: { id: createdDocumentId },
          });
        } catch {
          // Preserve the object if the compensating database delete fails.
          // A durable row must never point to an object we deliberately remove.
          throw error;
        }
      }
      if (stored) {
        await this.storage.deleteObject(stored.objectKey).catch(() => {});
      }
      await Promise.all(
        preparedAttachments.map((attachment) =>
          this.storage.deleteObject(attachment.objectKey).catch(() => {})
        )
      );
      if (isUniqueConstraintError(error)) {
        throw new ApiConflictException(
          "BAD_REQUEST",
          "Knowledge document reference code already exists"
        );
      }
      throw error;
    }
  }

  async getFile(id: string, mode: "preview" | "download" = "download") {
    const document = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
      select: {
        id: true,
        originalName: true,
        objectKey: true,
        mimeType: true,
        status: true,
        updatedAt: true,
        previewAllowed: true,
        downloadAllowed: true,
      },
    });
    if (
      !document ||
      !document.originalName ||
      !document.objectKey ||
      !document.mimeType
    ) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Knowledge document was not found"
      );
    }
    if (
      document.status === "ARCHIVED" ||
      (mode === "preview" && document.previewAllowed === false) ||
      (mode === "download" && document.downloadAllowed === false)
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        `This knowledge item does not allow ${mode}`
      );
    }
    return {
      fileName: document.originalName,
      mimeType: document.mimeType,
      etag: knowledgeFileEtag(document.id, document.updatedAt),
      body: await this.storage.getObjectBuffer(document.objectKey),
    };
  }

  async update(
    id: string,
    input: CreateKnowledgeDocumentInput,
    file: UploadedKnowledgeDocumentFile | undefined,
    user: RequestUser,
    source?: AuditLogSource,
    attachmentFiles: UploadedKnowledgeDocumentFile[] = []
  ) {
    this.requireUploader(user);
    const existing = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
      select: DOCUMENT_SELECT,
    });
    if (!existing) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Knowledge document was not found"
      );
    }
    const metadata = parseMetadata(input);
    if (metadata.kind === "FILE" && !metadata.referenceCode) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "referenceCode is required for files"
      );
    }
    if (metadata.kind === "FILE" && !file && !existing.objectKey) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A knowledge document file is required"
      );
    }
    if (
      metadata.kind === "NOTICE" &&
      !metadata.body &&
      !metadata.externalLink
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A notice body or link is required"
      );
    }

    const validated = file ? await validateDocument(file) : undefined;
    const preparedAttachments = await this.prepareAttachments(
      id,
      attachmentFiles
    );
    metadata.body = hydrateAttachmentNodes(metadata.body, preparedAttachments);
    const retainedAttachmentIds = collectAttachmentIds(metadata.body);
    const stored = validated
      ? await this.storage.putKnowledgeDocument(
          id,
          validated.file.originalname,
          validated.file.buffer,
          validated.format.mimeType
        )
      : undefined;
    try {
      const document = await this.prisma.knowledgeDocument.update({
        where: { id },
        data: {
          ...metadata,
          uploadedById: user.id,
          ...(validated
            ? {
                originalName: normalizeFileName(validated.file.originalname),
                objectKey: assertPresentValue(stored).objectKey,
                mimeType: validated.format.mimeType,
                size: validated.file.size,
              }
            : {}),
          attachments: {
            create: preparedAttachments.map(
              ({ id: attachmentId, ...attachment }) => ({
                id: attachmentId,
                ...attachment,
              })
            ),
            deleteMany: { id: { notIn: retainedAttachmentIds } },
          },
        },
        select: DOCUMENT_SELECT,
      });
      if (
        stored &&
        existing.objectKey &&
        existing.objectKey !== stored.objectKey
      ) {
        await this.storage.deleteObject(existing.objectKey).catch(() => {});
      }
      const removedAttachments = (existing.attachments ?? []).filter(
        (attachment) => !retainedAttachmentIds.includes(attachment.id)
      );
      await Promise.all(
        removedAttachments.map((attachment) =>
          this.storage.deleteObject(attachment.objectKey).catch(() => {})
        )
      );
      await this.auditLogs.log({
        actorId: user.id,
        action: "KNOWLEDGE_DOCUMENT_UPDATED",
        targetType: "KNOWLEDGE_DOCUMENT",
        targetId: document.id,
        description: `Updated knowledge item ${document.referenceCode ?? ""}: ${document.title}`,
        source,
      });
      return toKnowledgeDocumentItem(document);
    } catch (error) {
      if (stored) {
        await this.storage.deleteObject(stored.objectKey).catch(() => {});
      }
      await Promise.all(
        preparedAttachments.map((attachment) =>
          this.storage.deleteObject(attachment.objectKey).catch(() => {})
        )
      );
      if (isUniqueConstraintError(error)) {
        throw new ApiConflictException(
          "BAD_REQUEST",
          "Knowledge document reference code already exists"
        );
      }
      throw error;
    }
  }

  async getAttachment(
    attachmentId: string,
    mode: "preview" | "download" = "download"
  ) {
    const attachment = await this.prisma.knowledgeDocumentAttachment.findUnique(
      {
        where: { id: attachmentId },
        select: {
          originalName: true,
          objectKey: true,
          mimeType: true,
          createdAt: true,
          document: {
            select: {
              downloadAllowed: true,
              previewAllowed: true,
              status: true,
            },
          },
        },
      }
    );
    if (!attachment) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Knowledge attachment was not found"
      );
    }
    if (
      attachment.document.status === "ARCHIVED" ||
      (mode === "preview" && attachment.document.previewAllowed === false) ||
      (mode === "download" && attachment.document.downloadAllowed === false)
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        `This knowledge attachment does not allow ${mode}`
      );
    }
    return {
      fileName: attachment.originalName,
      mimeType: attachment.mimeType,
      etag: knowledgeFileEtag(attachmentId, attachment.createdAt),
      body: await this.storage.getObjectBuffer(attachment.objectKey),
    };
  }

  private async prepareAttachments(
    documentId: string,
    files: UploadedKnowledgeDocumentFile[]
  ) {
    await Promise.resolve();
    return Promise.all(
      files.map(async (file) => {
        const validated = await validateDocument(file);
        const id = randomUUID();
        const stored = await this.storage.putKnowledgeDocument(
          `${documentId}-attachment-${id}`,
          validated.file.originalname,
          validated.file.buffer,
          validated.format.mimeType
        );
        return {
          id,
          originalName: normalizeFileName(validated.file.originalname),
          objectKey: stored.objectKey,
          mimeType: validated.format.mimeType,
          size: validated.file.size,
        };
      })
    );
  }

  async archive(id: string, user: RequestUser, source?: AuditLogSource) {
    await Promise.resolve();
    return this.setArchiveStatus(id, true, user, source);
  }

  async restore(id: string, user: RequestUser, source?: AuditLogSource) {
    await Promise.resolve();
    return this.setArchiveStatus(id, false, user, source);
  }

  async remove(id: string, user: RequestUser, source?: AuditLogSource) {
    this.requireUploader(user);
    const existing = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
      select: {
        id: true,
        objectKey: true,
        referenceCode: true,
        title: true,
        attachments: { select: { objectKey: true } },
      },
    });
    if (!existing) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Knowledge document was not found"
      );
    }
    await this.prisma.knowledgeDocument.delete({ where: { id } });
    if (existing.objectKey) {
      await this.storage.deleteObject(existing.objectKey).catch(() => {});
    }
    await Promise.all(
      (existing.attachments ?? []).map((attachment) =>
        this.storage.deleteObject(attachment.objectKey).catch(() => {})
      )
    );
    await this.auditLogs.log({
      actorId: user.id,
      action: "KNOWLEDGE_DOCUMENT_DELETED",
      targetType: "KNOWLEDGE_DOCUMENT",
      targetId: existing.id,
      description: `Permanently deleted knowledge item ${existing.referenceCode ?? ""}: ${existing.title}`,
      source,
    });
    return { id };
  }

  private async setArchiveStatus(
    id: string,
    archived: boolean,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    this.requireUploader(user);
    const existing = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Knowledge document was not found"
      );
    }
    const document = await this.prisma.knowledgeDocument.update({
      where: { id },
      data: {
        archivedAt: archived ? new Date() : null,
        status: archived ? "ARCHIVED" : "PUBLISHED",
        uploadedById: user.id,
      },
      select: DOCUMENT_SELECT,
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: archived
        ? "KNOWLEDGE_DOCUMENT_ARCHIVED"
        : "KNOWLEDGE_DOCUMENT_RESTORED",
      targetType: "KNOWLEDGE_DOCUMENT",
      targetId: document.id,
      description: `${archived ? "Archived" : "Restored"} knowledge item ${document.referenceCode ?? ""}: ${document.title}`,
      source,
    });
    return toKnowledgeDocumentItem(document);
  }

  private requireUploader(user: RequestUser) {
    if (user.globalRole !== "SUPER_ADMIN" && user.globalRole !== "PARTNER") {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only administrators and partners can upload knowledge documents"
      );
    }
  }
}

function parseMetadata(input: CreateKnowledgeDocumentInput) {
  const kind =
    optionalChoice(input.kind, "kind", new Set(["FILE", "NOTICE"])) ?? "FILE";
  return {
    referenceCode: optionalText(input.referenceCode, 100),
    title: requiredText(input.title, "title", 300),
    department: requiredChoice(
      input.department,
      "department",
      KNOWLEDGE_DEPARTMENTS
    ),
    type: requiredChoice(input.type, "type", KNOWLEDGE_TYPES),
    kind,
    secondaryCategory: optionalText(input.secondaryCategory, 100),
    tertiaryCategory: optionalText(input.tertiaryCategory, 100),
    body: parseBody(input.body),
    externalLink: parseExternalLink(input.externalLink),
    previewAllowed: optionalBoolean(input.previewAllowed, true),
    downloadAllowed: optionalBoolean(input.downloadAllowed, true),
  };
}

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Text value is invalid"
    );
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > maxLength) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Text value is too long"
    );
  }
  return normalized;
}

function optionalChoice(value: unknown, field: string, choices: Set<string>) {
  const normalized = optionalText(value, 100);
  if (normalized === null) {
    return null;
  }
  if (!choices.has(normalized)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      `${field} is invalid`
    );
  }
  return normalized;
}

function optionalBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (value === true || value === "true") {
    return true;
  }
  if (value === false || value === "false") {
    return false;
  }
  throw new ApiBadRequestException(
    "VALIDATION_FAILED",
    "Boolean value is invalid"
  );
}

function parseBody(value: unknown) {
  const serialized = optionalText(value, 100_000);
  if (serialized === null) {
    return;
  }
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("invalid body");
    }
    return parsed as Prisma.InputJsonValue;
  } catch {
    throw new ApiBadRequestException("VALIDATION_FAILED", "body is invalid");
  }
}

function parseExternalLink(value: unknown) {
  const normalized = optionalText(value, 2000);
  if (normalized === null) {
    return null;
  }
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported knowledge URL protocol");
    }
    return url.toString();
  } catch {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "externalLink is invalid"
    );
  }
}

function requiredText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      `${field} is required`
    );
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      `${field} is too long`
    );
  }
  return normalized;
}

function requiredChoice(value: unknown, field: string, choices: Set<string>) {
  const normalized = requiredText(value, field, 100);
  if (!choices.has(normalized)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      `${field} is invalid`
    );
  }
  return normalized;
}

async function validateDocument(
  file: UploadedKnowledgeDocumentFile | undefined
): Promise<{
  file: UploadedKnowledgeDocumentFile;
  format: (typeof UPLOAD_FORMATS)[keyof typeof UPLOAD_FORMATS];
}> {
  if (!file) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "A knowledge document file is required"
    );
  }
  if (
    file.size > MAX_UPLOAD_BYTES ||
    file.buffer.byteLength > MAX_UPLOAD_BYTES
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Knowledge documents must not exceed 20 MiB"
    );
  }
  const extension = pathModule.extname(file.originalname).toLowerCase();
  const format = UPLOAD_FORMATS[extension as keyof typeof UPLOAD_FORMATS];
  if (!format || file.mimetype.toLowerCase() !== format.mimeType) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Unsupported knowledge document file type"
    );
  }
  const validSignature = await hasExpectedSignature(
    file.buffer,
    format.signature
  );
  if (!validSignature) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Uploaded document signature does not match its file type"
    );
  }
  return { file, format };
}

async function hasExpectedSignature(
  body: Buffer,
  signature: "pdf" | "ole" | "wordZip" | "excelZip" | "powerPointZip"
) {
  if (signature === "pdf") {
    return body.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (signature === "ole") {
    return body
      .subarray(0, 8)
      .equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  }
  try {
    const archive = await JSZip.loadAsync(body);
    if (!archive.file("[Content_Types].xml")) {
      return false;
    }
    const directory =
      signature === "wordZip"
        ? "word/"
        : signature === "excelZip"
          ? "xl/"
          : "ppt/";
    return Object.keys(archive.files).some((path) =>
      path.startsWith(directory)
    );
  } catch {
    return false;
  }
}

function normalizeFileName(value: string) {
  const normalized = value.replaceAll(/[\r\n\\/]/g, "_").trim();
  return normalized || "knowledge-document.pdf";
}

type StoredNoticeAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt?: Date;
};

function hydrateAttachmentNodes(
  body: Prisma.InputJsonValue | undefined,
  attachments: StoredNoticeAttachment[],
  options: { downloadAllowed?: boolean } = {}
) {
  if (!body) {
    return body;
  }
  const attachmentList = attachments ?? [];
  const usedAttachmentIds = new Set<string>();
  const attachmentsById = new Map(
    attachmentList.map((attachment) => [attachment.id, attachment])
  );
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(visit);
    }
    if (!value || typeof value !== "object") {
      return value;
    }
    const record = value as Record<string, unknown>;
    const content = Array.isArray(record.content)
      ? record.content.map(visit)
      : record.content;
    if (record.type !== "knowledgeAttachment") {
      return { ...record, content };
    }
    const attrs = (
      record.attrs && typeof record.attrs === "object" ? record.attrs : {}
    ) as Record<string, unknown>;
    const attachment =
      typeof attrs.attachmentId === "string"
        ? attachmentsById.get(attrs.attachmentId)
        : attachmentList.find(
            (candidate) => !usedAttachmentIds.has(candidate.id)
          );
    if (!attachment) {
      return { ...record, attrs, content };
    }
    usedAttachmentIds.add(attachment.id);
    return {
      ...record,
      attrs: {
        ...attrs,
        attachmentId: attachment.id,
        downloadUrl: `/knowledge-documents/attachments/${encodeURIComponent(attachment.id)}/download`,
        previewUrl: `/knowledge-attachment-preview/${encodeURIComponent(attachment.id)}?fileName=${encodeURIComponent(attachment.originalName)}&mimeType=${encodeURIComponent(attachment.mimeType)}&version=${encodeURIComponent(attachment.createdAt?.toISOString() ?? attachment.id)}&downloadAllowed=${options.downloadAllowed === false ? "false" : "true"}`,
        previewSourceUrl: `/knowledge-attachment-source/${encodeURIComponent(attachment.id)}?version=${encodeURIComponent(attachment.createdAt?.toISOString() ?? attachment.id)}`,
        fileName: attachment.originalName,
        fileSize: formatStoredSize(attachment.size),
      },
      content,
    };
  };
  return visit(body) as Prisma.InputJsonValue;
}

function collectAttachmentIds(body: Prisma.InputJsonValue | undefined) {
  const ids: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      return value.forEach(visit);
    }
    if (!value || typeof value !== "object") {
      return;
    }
    const record = value as Record<string, unknown>;
    if (record.type === "knowledgeAttachment") {
      const attrs = record.attrs as Record<string, unknown> | undefined;
      if (typeof attrs?.attachmentId === "string") {
        ids.push(attrs.attachmentId);
      }
    }
    visit(record.content);
  };
  visit(body);
  return ids;
}

function formatStoredSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function toKnowledgeDocumentItem(document: {
  id: string;
  referenceCode: string | null;
  title: string;
  department: string;
  type: string;
  kind: string;
  secondaryCategory: string | null;
  tertiaryCategory: string | null;
  body: unknown;
  externalLink: string | null;
  previewAllowed: boolean;
  downloadAllowed: boolean;
  status: string;
  originalName: string | null;
  mimeType: string | null;
  updatedAt: Date;
  uploader: { id: string; image: string | null; name: string };
  attachments: (StoredNoticeAttachment & { objectKey: string })[];
}) {
  const encodedId = encodeURIComponent(document.id);
  return {
    id: document.id,
    referenceCode: document.referenceCode,
    title: document.title,
    department: document.department,
    type: document.type,
    ...(document.kind ? { kind: document.kind } : {}),
    ...(document.secondaryCategory
      ? { secondaryCategory: document.secondaryCategory }
      : {}),
    ...(document.tertiaryCategory
      ? { tertiaryCategory: document.tertiaryCategory }
      : {}),
    ...(document.body
      ? {
          body: hydrateAttachmentNodes(
            document.body as Prisma.InputJsonValue,
            document.attachments,
            { downloadAllowed: document.downloadAllowed }
          ),
        }
      : {}),
    ...(document.externalLink ? { externalLink: document.externalLink } : {}),
    ...(typeof document.previewAllowed === "boolean"
      ? { previewAllowed: document.previewAllowed }
      : {}),
    ...(typeof document.downloadAllowed === "boolean"
      ? { downloadAllowed: document.downloadAllowed }
      : {}),
    ...(document.status ? { status: document.status } : {}),
    fileName: document.originalName,
    mimeType: document.mimeType,
    owner: document.uploader.name,
    ownerAvatar: document.uploader.image,
    ownerId: document.uploader.id,
    updatedAt: document.updatedAt,
    previewVersion: document.updatedAt.toISOString(),
    ...(document.previewAllowed !== false &&
    document.mimeType === "application/pdf"
      ? { previewUrl: `/knowledge-documents/${encodedId}/preview` }
      : {}),
    ...(document.downloadAllowed !== false && document.originalName
      ? { downloadUrl: `/knowledge-documents/${encodedId}/download` }
      : {}),
  };
}

function knowledgeFileEtag(id: string, version: Date) {
  return `W/"${id}-${version.getTime()}"`;
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
