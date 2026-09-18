import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import pathModule from "node:path";

import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ConfirmationType } from "@prisma/client";
import {
  CONFIRMATION_TEMPLATE_FONT_FAMILIES,
  CONFIRMATION_TEMPLATE_FONT_SIZES,
  canGlobalRoleManageConfirmationTemplates,
} from "@project-wing/shared";
import type { ConfirmationTemplateTextStyle } from "@project-wing/shared";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import { normalizeUploadedFileName } from "../common/file-name";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { DocumentConversionService } from "../workflow/document-conversion.service";
import { getDefaultConfirmationTemplateDesign } from "./confirmation-template-design-defaults";
import { getConfirmationTemplateDefinition } from "./confirmation-template-registry";
import type { RegisteredConfirmationTemplateCode } from "./confirmation-template-registry";

export type UploadedConfirmationTemplateFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

export type ConfirmationTemplateDesignStatus = "DRAFT" | "ENABLED" | "DISABLED";

type ConfirmationTemplateDesignFieldKind =
  | "TEXT"
  | "MULTILINE"
  | "NUMBER"
  | "DATE"
  | "CHECKBOX"
  | "SELECT"
  | "RADIO"
  | "STATIC_TEXT"
  | "MASK";

export const CONFIRMATION_TEMPLATE_FIELD_BINDINGS = [
  "accountNumber",
  "auditorAddress",
  "auditorName",
  "authorizationAccount",
  "bankName",
  "clientName",
  "micEmail",
  "micNameAndInitial",
  "officeDate",
  "recipientAddress",
  "recipientName",
  "referenceCode",
  "picName",
  "micName",
  "reportDate",
  "salutation",
  "yearEndDate",
] as const;

export type ConfirmationTemplateDesignFieldBinding =
  (typeof CONFIRMATION_TEMPLATE_FIELD_BINDINGS)[number] | `custom:${string}`;

export const CONFIRMATION_BASE_INFORMATION_BINDINGS = [
  "accountNumber",
  "auditorAddress",
  "bankName",
  "clientName",
  "officeDate",
  "picName",
  "referenceCode",
  "recipientAddress",
  "reportDate",
  "micName",
] as const satisfies readonly ConfirmationTemplateDesignFieldBinding[];

export const CONFIRMATION_INFORMATION_LIBRARY_BINDINGS = [
  "bankName",
  "recipientAddress",
  "recipientName",
] as const satisfies readonly ConfirmationTemplateDesignFieldBinding[];

export type ConfirmationTemplateDefaultValueSource =
  | {
      binding: ConfirmationTemplateDesignFieldBinding;
      source: "BASE_INFORMATION" | "INFORMATION_LIBRARY";
    }
  | { source: "CUSTOM"; value: string }
  | { source: "SYSTEM"; value: "CURRENT_DATE" };

export type ConfirmationTemplateDesignFieldSourceRange = {
  end: number;
  paragraphId?: string;
  paragraphOrdinal: number;
  paragraphXmlSha256: string;
  part: "word/document.xml";
  sourceText: string;
  start: number;
};

export type ConfirmationTemplateDesignSchema = {
  version: 1;
  fields: {
    defaultChecked?: boolean;
    defaultValueSource?: ConfirmationTemplateDefaultValueSource;
    id: string;
    kind: ConfirmationTemplateDesignFieldKind;
    name: string;
    placeholder: string;
    options: string[];
    required?: boolean;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    textStyle?: ConfirmationTemplateTextStyle;
    textAlign?: "left" | "center" | "right";
    /** Legacy binding is migrated to baseInformationBinding on read. */
    binding?: ConfirmationTemplateDesignFieldBinding;
    baseInformationBinding?: ConfirmationTemplateDesignFieldBinding;
    informationLibraryBinding?: ConfirmationTemplateDesignFieldBinding;
    sourceRanges?: ConfirmationTemplateDesignFieldSourceRange[];
  }[];
};

const EMPTY_CONFIRMATION_TEMPLATE_DESIGN: ConfirmationTemplateDesignSchema = {
  version: 1,
  fields: [],
};
const MAX_TEMPLATE_FILE_SIZE = 20 * 1024 * 1024;
const MAX_DESIGN_FIELDS = 100;
const MAX_DESIGN_SOURCE_RANGES = 200;
const MAX_DESIGN_SOURCE_RANGE_TEXT_LENGTH = 10_000;
const MAX_TEMPLATE_DESCRIPTION_LENGTH = 2000;
const MAX_TEMPLATE_NAME_LENGTH = 200;
const MAX_DOCX_UNCOMPRESSED_SIZE = 100 * 1024 * 1024;
const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOCX_MAIN_PART_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
const MAX_DOCX_COMPRESSION_RATIO = 100;
const PACKAGE_CONTENT_TYPES_NAMESPACE =
  "http://schemas.openxmlformats.org/package/2006/content-types";
const PACKAGE_RELATIONSHIPS_NAMESPACE =
  "http://schemas.openxmlformats.org/package/2006/relationships";
const PDF_CONTENT_TYPE = "application/pdf";
const OFFICE_DOCUMENT_RELATIONSHIP_TYPES = new Set([
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
  "http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument",
]);
const WORDPROCESSING_NAMESPACES = new Set([
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  "http://purl.oclc.org/ooxml/wordprocessingml/main",
]);
const BUILT_IN_TEMPLATE_ROOT = existsSync(
  pathModule.join(process.cwd(), "confirmation-templates")
)
  ? pathModule.join(process.cwd(), "confirmation-templates")
  : pathModule.join(process.cwd(), "apps/api/confirmation-templates");
const BUILT_IN_TEMPLATE_UPLOADER = {
  id: "SYSTEM",
  name: "ProjectWing",
} as const;
const BUILT_IN_TEMPLATE_FILES = [
  {
    code: "STANDARD_FINANCIAL_INSTITUTION",
    fileName: "standard-financial-institution-pdf-twin.docx",
    fallbackName: "Standard financial institution confirmation",
  },
  {
    code: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
    fileName: "bank-confirmation-hk-standard-english.docx",
    fallbackName: "Bank Confirmation - HK Standard (English)",
  },
  {
    code: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
    fileName: "securities-confirmation-english-type-1.docx",
    fallbackName: "Securities Confirmation - English - Type 1",
  },
  {
    code: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
    fileName: "securities-confirmation-english-type-2.docx",
    fallbackName: "Securities Confirmation - English - Type 2",
  },
] as const satisfies readonly {
  code: RegisteredConfirmationTemplateCode;
  fileName: string;
  fallbackName: string;
}[];

type BuiltInOverrideRecord = {
  templateCode: RegisteredConfirmationTemplateCode;
  designSchema: unknown | null;
  designStatus: ConfirmationTemplateDesignStatus;
  enabledAt: Date | null;
  deletedAt?: Date | null;
  updatedAt: Date;
};

type BuiltInOverrideUpsertArgs = {
  where: { templateCode: string };
  create: {
    templateCode: string;
    designSchema: unknown;
    designStatus: ConfirmationTemplateDesignStatus;
    enabledAt: Date | null;
    deletedAt?: Date | null;
  };
  update: {
    designSchema?: unknown;
    designStatus?: ConfirmationTemplateDesignStatus;
    enabledAt?: Date | null;
    deletedAt?: Date | null;
  };
};

type BuiltInOverrideClient = {
  findMany: (args: unknown) => Promise<BuiltInOverrideRecord[]>;
  findUnique: (args: unknown) => Promise<BuiltInOverrideRecord | null>;
  upsert: (args: BuiltInOverrideUpsertArgs) => Promise<BuiltInOverrideRecord>;
};

type CustomTemplateStatusRecord = Record<string, unknown> & {
  id: string;
  code: string;
  uploadedById: string;
  designSchema?: unknown | null;
  fileName?: unknown;
  mimeType?: unknown;
};

type BulkStatusTarget =
  | {
      kind: "BUILT_IN";
      id: string;
      code: RegisteredConfirmationTemplateCode;
      override: BuiltInOverrideRecord | null;
    }
  | {
      kind: "CUSTOM";
      id: string;
      template: CustomTemplateStatusRecord;
    };

function builtInOverrideClient(client: unknown): BuiltInOverrideClient {
  return (
    client as {
      confirmationTemplateLibraryBuiltInOverride: BuiltInOverrideClient;
    }
  ).confirmationTemplateLibraryBuiltInOverride;
}

@Injectable()
export class ConfirmationTemplateLibraryService {
  private readonly logger = new Logger(ConfirmationTemplateLibraryService.name);
  private readonly previewRequests = new Map<string, Promise<Buffer>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auditLogs: AuditLogsService,
    private readonly documentConversion: DocumentConversionService
  ) {}

  async list() {
    const customTemplates =
      (await this.prisma.confirmationTemplateLibraryFile.findMany({
        include: {
          uploader: {
            select: { id: true, name: true },
          },
        },
        orderBy: [
          { confirmationType: "asc" },
          { name: "asc" },
          { updatedAt: "desc" },
        ],
      })) ?? [];
    const builtInOverrides = await builtInOverrideClient(this.prisma).findMany({
      where: {
        templateCode: {
          in: BUILT_IN_TEMPLATE_FILES.map((template) => template.code),
        },
      },
    });
    const overrideByCode = new Map(
      builtInOverrides.map((override) => [override.templateCode, override])
    );
    const builtInTemplateResults = await Promise.all(
      BUILT_IN_TEMPLATE_FILES.map((template) =>
        this.loadBuiltInTemplate(
          template.code,
          overrideByCode.get(template.code) ?? null
        )
      )
    );
    const builtInTemplates = builtInTemplateResults.filter(
      (template): template is NonNullable<typeof template> => template !== null
    );

    return [
      ...builtInTemplates.map(
        ({ filePath: _filePath, ...template }) => template
      ),
      ...customTemplates.map((template) => ({
        ...template,
        isBuiltIn: false as const,
      })),
    ];
  }

  async upload(
    input: {
      name: string;
      confirmationType: ConfirmationType;
      description?: string;
    },
    file: UploadedConfirmationTemplateFile | undefined,
    user: RequestUser,
    source: AuditLogSource
  ) {
    this.assertTemplateManager(user);
    const name = input.name.trim();
    if (!name || name.length > MAX_TEMPLATE_NAME_LENGTH) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        `Template name must contain 1 to ${MAX_TEMPLATE_NAME_LENGTH} characters`
      );
    }
    const description = input.description?.trim() || undefined;
    if (description && description.length > MAX_TEMPLATE_DESCRIPTION_LENGTH) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        `Template description must not exceed ${MAX_TEMPLATE_DESCRIPTION_LENGTH} characters`
      );
    }

    const validatedFile = await this.validateFile(file);
    const stored = await this.storage.putConfirmationTemplateLibraryFile(
      validatedFile.fileName,
      validatedFile.buffer,
      validatedFile.mimeType
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const code = await nextConfirmationTemplateCode(
          tx.confirmationTemplateLibraryFile,
          input.confirmationType
        );
        const template = await tx.confirmationTemplateLibraryFile.create({
          data: {
            code,
            name,
            confirmationType: input.confirmationType,
            ...(description ? { description } : {}),
            fileName: validatedFile.fileName,
            objectKey: stored.objectKey,
            fileSize: validatedFile.buffer.length,
            mimeType: validatedFile.mimeType,
            uploadedById: user.id,
            designSchema: Prisma.DbNull,
            designStatus: "DRAFT",
            enabledAt: null,
          },
          include: {
            uploader: {
              select: { id: true, name: true },
            },
          },
        });
        await this.auditLogs.logInTransaction(tx, {
          actorId: user.id,
          action: "CONFIRMATION_TEMPLATE_LIBRARY_FILE_UPLOADED",
          targetType: "CONFIRMATION_TEMPLATE_LIBRARY_FILE",
          targetId: template.id,
          description: `Uploaded confirmation template ${template.code}`,
          source,
        });
        return { ...template, isBuiltIn: false as const };
      });
    } catch (error) {
      await this.deleteStoredObject(
        stored.objectKey,
        "rolling back a failed template upload"
      );
      throw error;
    }
  }

  async saveDesign(
    id: string,
    input: {
      designSchema: unknown;
      designStatus: ConfirmationTemplateDesignStatus;
    },
    user: RequestUser,
    source: AuditLogSource
  ) {
    this.assertTemplateManager(user);
    const builtInCode = this.getBuiltInTemplateCode(id);
    validateDesignStatus(input.designStatus);
    const validatedDesignSchema = validateDesignSchema(input.designSchema);
    const designSchema = validatedDesignSchema;
    const enabledAt = input.designStatus === "ENABLED" ? new Date() : null;

    if (builtInCode) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await builtInOverrideClient(tx).upsert({
          where: { templateCode: builtInCode },
          create: {
            templateCode: builtInCode,
            designSchema: designSchema as Prisma.InputJsonValue,
            designStatus: input.designStatus,
            enabledAt,
          },
          update: {
            designSchema: designSchema as Prisma.InputJsonValue,
            designStatus: input.designStatus,
            enabledAt,
          },
        });
        await this.auditLogs.logInTransaction(tx, {
          actorId: user.id,
          action: "CONFIRMATION_TEMPLATE_LIBRARY_DESIGN_SAVED",
          targetType: "CONFIRMATION_TEMPLATE_LIBRARY_FILE",
          targetId: id,
          description: `Saved design for built-in confirmation template ${builtInCode}`,
          source,
        });
        return result;
      });

      return this.loadBuiltInTemplate(builtInCode, updated);
    }

    const template =
      await this.prisma.confirmationTemplateLibraryFile.findUnique({
        where: { id },
      });
    if (!template) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation template was not found"
      );
    }
    if (input.designStatus === "ENABLED") {
      assertCustomTemplateCanBeEnabled({
        ...(template as CustomTemplateStatusRecord),
        designSchema,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.confirmationTemplateLibraryFile.update({
        where: { id },
        data: {
          designSchema: designSchema as Prisma.InputJsonValue,
          designStatus: input.designStatus as never,
          enabledAt,
        },
        include: {
          uploader: {
            select: { id: true, name: true },
          },
        },
      });
      await this.auditLogs.logInTransaction(tx, {
        actorId: user.id,
        action: "CONFIRMATION_TEMPLATE_LIBRARY_DESIGN_SAVED",
        targetType: "CONFIRMATION_TEMPLATE_LIBRARY_FILE",
        targetId: template.id,
        description: `Saved design for confirmation template ${template.code}`,
        source,
      });
      return result;
    });

    return { ...updated, isBuiltIn: false as const };
  }

  async setStatus(
    id: string,
    designStatus: ConfirmationTemplateDesignStatus,
    user: RequestUser,
    source: AuditLogSource
  ) {
    this.assertTemplateManager(user);
    validateDesignStatus(designStatus);
    const builtInCode = this.getBuiltInTemplateCode(id);
    const enabledAt = designStatus === "ENABLED" ? new Date() : null;

    if (builtInCode) {
      const current = await this.findBuiltInOverride(builtInCode);
      if (
        designStatus === "ENABLED" &&
        current?.designSchema !== null &&
        current?.designSchema !== undefined
      ) {
        validateDesignSchema(current.designSchema);
      }
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await builtInOverrideClient(tx).upsert({
          where: { templateCode: builtInCode },
          create: {
            templateCode: builtInCode,
            designSchema: toNullableInputJson(current?.designSchema),
            designStatus,
            enabledAt,
          },
          update: {
            designStatus,
            enabledAt,
          },
        });
        await this.auditLogs.logInTransaction(tx, {
          actorId: user.id,
          action: "CONFIRMATION_TEMPLATE_LIBRARY_DESIGN_STATUS_SET",
          targetType: "CONFIRMATION_TEMPLATE_LIBRARY_FILE",
          targetId: id,
          description: `Set built-in confirmation template ${builtInCode} to ${designStatus}`,
          source,
        });
        return result;
      });
      return this.loadBuiltInTemplate(builtInCode, updated);
    }

    const template =
      (await this.prisma.confirmationTemplateLibraryFile.findUnique({
        where: { id },
      })) as CustomTemplateStatusRecord | null;
    if (!template) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation template was not found"
      );
    }
    if (designStatus === "ENABLED") {
      assertCustomTemplateCanBeEnabled(template);
    }

    const designSchema =
      designStatus === "ENABLED"
        ? validateDesignSchema(
            template.designSchema ?? EMPTY_CONFIRMATION_TEMPLATE_DESIGN
          )
        : undefined;
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.confirmationTemplateLibraryFile.update({
        where: { id },
        data: {
          ...(designSchema
            ? { designSchema: designSchema as Prisma.InputJsonValue }
            : {}),
          designStatus: designStatus as never,
          enabledAt,
        },
        include: {
          uploader: {
            select: { id: true, name: true },
          },
        },
      });
      await this.auditLogs.logInTransaction(tx, {
        actorId: user.id,
        action: "CONFIRMATION_TEMPLATE_LIBRARY_DESIGN_STATUS_SET",
        targetType: "CONFIRMATION_TEMPLATE_LIBRARY_FILE",
        targetId: template.id,
        description: `Set confirmation template ${template.code} to ${designStatus}`,
        source,
      });
      return result;
    });

    return { ...updated, isBuiltIn: false as const };
  }

  async bulkSetStatus(
    ids: string[],
    designStatus: ConfirmationTemplateDesignStatus,
    user: RequestUser,
    source: AuditLogSource
  ) {
    this.assertTemplateManager(user);
    validateDesignStatus(designStatus);
    if (ids.length === 0 || new Set(ids).size !== ids.length) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Confirmation template ids must be non-empty and unique"
      );
    }

    const targets: BulkStatusTarget[] = [];
    for (const id of ids) {
      const builtInCode = this.getBuiltInTemplateCode(id);
      if (builtInCode) {
        const override = await this.findBuiltInOverride(builtInCode);
        if (
          designStatus === "ENABLED" &&
          override?.designSchema !== null &&
          override?.designSchema !== undefined
        ) {
          validateDesignSchema(override.designSchema);
        }
        targets.push({
          kind: "BUILT_IN",
          id,
          code: builtInCode,
          override,
        });
        continue;
      }

      const template =
        (await this.prisma.confirmationTemplateLibraryFile.findUnique({
          where: { id },
        })) as CustomTemplateStatusRecord | null;
      if (!template) {
        throw new ApiNotFoundException(
          "NOT_FOUND",
          "Confirmation template was not found"
        );
      }
      if (designStatus === "ENABLED") {
        assertCustomTemplateCanBeEnabled(template);
      }
      targets.push({ kind: "CUSTOM", id, template });
    }

    const enabledAt = designStatus === "ENABLED" ? new Date() : null;
    const updated = await this.prisma.$transaction(async (tx) => {
      const results: {
        target: BulkStatusTarget;
        record: BuiltInOverrideRecord | Record<string, unknown>;
      }[] = [];

      for (const target of targets) {
        if (target.kind === "BUILT_IN") {
          const result = await builtInOverrideClient(tx).upsert({
            where: { templateCode: target.code },
            create: {
              templateCode: target.code,
              designSchema: toNullableInputJson(target.override?.designSchema),
              designStatus,
              enabledAt,
            },
            update: {
              designStatus,
              enabledAt,
            },
          });
          await this.auditLogs.logInTransaction(tx, {
            actorId: user.id,
            action: "CONFIRMATION_TEMPLATE_LIBRARY_DESIGN_STATUS_SET",
            targetType: "CONFIRMATION_TEMPLATE_LIBRARY_FILE",
            targetId: target.id,
            description: `Set built-in confirmation template ${target.code} to ${designStatus}`,
            source,
          });
          results.push({ target, record: result });
          continue;
        }

        const designSchema =
          designStatus === "ENABLED"
            ? validateDesignSchema(
                target.template.designSchema ??
                  EMPTY_CONFIRMATION_TEMPLATE_DESIGN
              )
            : undefined;
        const result = await tx.confirmationTemplateLibraryFile.update({
          where: { id: target.id },
          data: {
            ...(designSchema
              ? { designSchema: designSchema as Prisma.InputJsonValue }
              : {}),
            designStatus: designStatus as never,
            enabledAt,
          },
          include: {
            uploader: {
              select: { id: true, name: true },
            },
          },
        });
        await this.auditLogs.logInTransaction(tx, {
          actorId: user.id,
          action: "CONFIRMATION_TEMPLATE_LIBRARY_DESIGN_STATUS_SET",
          targetType: "CONFIRMATION_TEMPLATE_LIBRARY_FILE",
          targetId: target.id,
          description: `Set confirmation template ${target.template.code} to ${designStatus}`,
          source,
        });
        results.push({
          target,
          record: result as Record<string, unknown>,
        });
      }
      return results;
    });

    return Promise.all(
      updated.map(({ target, record }) =>
        target.kind === "BUILT_IN"
          ? this.loadBuiltInTemplate(
              target.code,
              record as BuiltInOverrideRecord
            )
          : { ...record, isBuiltIn: false as const }
      )
    );
  }

  async download(id: string, user: RequestUser, source: AuditLogSource) {
    const template = await this.findTemplate(id);
    await this.auditLogs.log({
      actorId: user.id,
      action: "CONFIRMATION_TEMPLATE_LIBRARY_FILE_DOWNLOADED",
      targetType: "CONFIRMATION_TEMPLATE_LIBRARY_FILE",
      targetId: template.id,
      description: `Downloaded confirmation template ${template.code}`,
      source,
    });
    const body = template.isBuiltIn
      ? await readFile(template.filePath)
      : await this.storage.getObjectBuffer(template.objectKey);
    const file = {
      body,
      fileName: template.fileName,
      mimeType: template.mimeType,
    };
    return {
      template,
      file,
    };
  }

  async preview(id: string) {
    const template = await this.findTemplate(id);
    if (template.mimeType === "application/pdf") {
      const body = template.isBuiltIn
        ? await readFile(template.filePath)
        : await this.storage.getObjectBuffer(template.objectKey);
      return {
        template,
        body,
        fileName: template.fileName,
        mimeType: template.mimeType,
      };
    }
    const cacheKey = [
      "confirmation-template-preview-cache",
      encodeURIComponent(template.id),
      template.updatedAt.getTime(),
      "preview.pdf",
    ].join("/");
    const pending = this.previewRequests.get(cacheKey);
    const request =
      pending ??
      (async () => {
        const cachedBody = await this.storage
          .getCacheObjectBuffer(cacheKey)
          .catch(() => null);
        if (cachedBody) {
          return cachedBody;
        }
        const body = template.isBuiltIn
          ? await readFile(template.filePath)
          : await this.storage.getObjectBuffer(template.objectKey);
        const converted =
          await this.documentConversion.convertOfficeBufferToPdf({
            body,
            fileName: template.fileName,
            mimeType: template.mimeType,
          });
        try {
          await this.storage.putCacheObject(
            cacheKey,
            converted,
            "application/pdf"
          );
        } catch (error) {
          this.logger.warn(
            `Confirmation template preview cache write failed: ${cacheKey}`,
            error instanceof Error ? error.stack : undefined
          );
        }
        return converted;
      })();
    if (!pending) {
      this.previewRequests.set(cacheKey, request);
    }
    let previewBody: Buffer;
    try {
      previewBody = await request;
    } finally {
      if (this.previewRequests.get(cacheKey) === request) {
        this.previewRequests.delete(cacheKey);
      }
    }
    return {
      template,
      body: previewBody,
      fileName: template.fileName.replace(/\.[^.]+$/u, ".pdf"),
      mimeType: "application/pdf",
    };
  }

  async remove(id: string, user: RequestUser, source: AuditLogSource) {
    this.assertTemplateManager(user);
    const builtInCode = this.getBuiltInTemplateCode(id);
    if (builtInCode) {
      const current = await this.findBuiltInOverride(builtInCode);
      await this.prisma.$transaction(async (tx) => {
        await builtInOverrideClient(tx).upsert({
          where: { templateCode: builtInCode },
          create: {
            templateCode: builtInCode,
            designSchema: toNullableInputJson(current?.designSchema),
            designStatus: "DISABLED",
            enabledAt: null,
            deletedAt: new Date(),
          },
          update: {
            designStatus: "DISABLED",
            enabledAt: null,
            deletedAt: new Date(),
          },
        });
        await this.auditLogs.logInTransaction(tx, {
          actorId: user.id,
          action: "CONFIRMATION_TEMPLATE_LIBRARY_FILE_DELETED",
          targetType: "CONFIRMATION_TEMPLATE_LIBRARY_FILE",
          targetId: id,
          description: `Deleted built-in confirmation template ${builtInCode}`,
          source,
        });
      });
      return { id };
    }
    const template =
      await this.prisma.confirmationTemplateLibraryFile.findUnique({
        where: { id },
      });
    if (!template) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation template was not found"
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.confirmationTemplateLibraryFile.delete({ where: { id } });
      await this.auditLogs.logInTransaction(tx, {
        actorId: user.id,
        action: "CONFIRMATION_TEMPLATE_LIBRARY_FILE_DELETED",
        targetType: "CONFIRMATION_TEMPLATE_LIBRARY_FILE",
        targetId: template.id,
        description: `Deleted confirmation template ${template.code}`,
        source,
      });
    });
    await this.deleteStoredObject(
      template.objectKey,
      `deleting confirmation template ${template.code}`
    );
    return { id: template.id };
  }

  private async validateFile(
    file: UploadedConfirmationTemplateFile | undefined
  ): Promise<{
    buffer: Buffer;
    fileName: string;
    mimeType: typeof PDF_CONTENT_TYPE;
  }> {
    if (
      !file?.buffer?.length ||
      file.size !== file.buffer.length ||
      file.size > MAX_TEMPLATE_FILE_SIZE
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Upload a PDF confirmation template up to 20 MB"
      );
    }

    const fileName = normalizeUploadedFileName(file.originalname).trim();
    const extension = pathModule.extname(fileName).toLowerCase();
    if (extension !== ".pdf") {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Only PDF confirmation templates are supported"
      );
    }

    try {
      await PDFDocument.load(file.buffer);
    } catch {
      throw this.invalidPdfFile();
    }

    return { buffer: file.buffer, fileName, mimeType: PDF_CONTENT_TYPE };
  }

  private invalidPdfFile() {
    return new ApiBadRequestException(
      "VALIDATION_FAILED",
      "The uploaded file is not a valid PDF document"
    );
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

  private async findTemplate(id: string) {
    const builtIn = await this.findBuiltInTemplate(id);
    if (builtIn) {
      return builtIn;
    }

    const template =
      await this.prisma.confirmationTemplateLibraryFile.findUnique({
        where: { id },
      });
    if (!template) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation template was not found"
      );
    }
    return { ...template, isBuiltIn: false as const };
  }

  private async findBuiltInOverride(code: RegisteredConfirmationTemplateCode) {
    await Promise.resolve();
    return builtInOverrideClient(this.prisma).findUnique({
      where: { templateCode: code },
    });
  }

  private getBuiltInTemplateCode(
    id: string
  ): RegisteredConfirmationTemplateCode | null {
    const template = BUILT_IN_TEMPLATE_FILES.find(
      (candidate) => `builtin-${candidate.code}` === id
    );
    if (!template) {
      return null;
    }
    const filePath = pathModule.join(BUILT_IN_TEMPLATE_ROOT, template.fileName);
    return existsSync(filePath) ? template.code : null;
  }

  private isBuiltInTemplateId(id: string) {
    return this.getBuiltInTemplateCode(id) !== null;
  }

  private async findBuiltInTemplate(id: string) {
    await Promise.resolve();
    const code = this.getBuiltInTemplateCode(id);
    return code ? this.loadBuiltInTemplate(code) : null;
  }

  private async loadBuiltInTemplate(
    code: RegisteredConfirmationTemplateCode,
    suppliedOverride?: BuiltInOverrideRecord | null
  ) {
    const template = BUILT_IN_TEMPLATE_FILES.find(
      (candidate) => candidate.code === code
    );
    if (!template) {
      return null;
    }
    const filePath = pathModule.join(BUILT_IN_TEMPLATE_ROOT, template.fileName);
    if (!existsSync(filePath)) {
      return null;
    }
    const override =
      suppliedOverride === undefined
        ? await this.findBuiltInOverride(code)
        : suppliedOverride;
    if (override?.deletedAt) {
      return null;
    }
    const definition = getConfirmationTemplateDefinition(code);
    const fileStats = await stat(filePath);
    return {
      id: `builtin-${template.code}`,
      code: template.code,
      name: definition.displayName ?? template.fallbackName,
      confirmationType: definition.confirmationType,
      description: null,
      fileName: template.fileName,
      objectKey: null,
      fileSize: fileStats.size,
      mimeType: DOCX_CONTENT_TYPE,
      uploadedById: BUILT_IN_TEMPLATE_UPLOADER.id,
      uploader: BUILT_IN_TEMPLATE_UPLOADER,
      createdAt: fileStats.birthtime,
      updatedAt: override?.updatedAt ?? fileStats.mtime,
      designSchema:
        override?.designSchema ?? getDefaultConfirmationTemplateDesign(code),
      designStatus: override?.designStatus ?? ("ENABLED" as const),
      enabledAt: override ? override.enabledAt : fileStats.mtime,
      isBuiltIn: true as const,
      filePath,
    };
  }

  private assertTemplateManager(user: RequestUser) {
    if (!canGlobalRoleManageConfirmationTemplates(user.globalRole)) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only Super Admin can manage confirmation templates"
      );
    }
  }
}

function validateDesignStatus(
  value: unknown
): asserts value is ConfirmationTemplateDesignStatus {
  if (value !== "DRAFT" && value !== "ENABLED" && value !== "DISABLED") {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Confirmation template design status must be DRAFT, ENABLED, or DISABLED"
    );
  }
}

function toNullableInputJson(value: unknown | null | undefined) {
  return value === null || value === undefined
    ? Prisma.DbNull
    : (value as Prisma.InputJsonValue);
}

function assertCustomTemplateCanBeEnabled(
  template: Pick<
    CustomTemplateStatusRecord,
    "designSchema" | "fileName" | "mimeType"
  >
) {
  const isDocx =
    typeof template.fileName === "string" &&
    pathModule.extname(template.fileName).toLowerCase() === ".docx" &&
    template.mimeType === DOCX_CONTENT_TYPE;
  const isPdf =
    typeof template.fileName === "string" &&
    pathModule.extname(template.fileName).toLowerCase() === ".pdf" &&
    template.mimeType === PDF_CONTENT_TYPE;
  if (!isDocx && !isPdf) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Only DOCX or PDF confirmation templates with a valid design can be enabled"
    );
  }
  validateDesignSchema(
    template.designSchema ?? EMPTY_CONFIRMATION_TEMPLATE_DESIGN
  );
}

async function nextConfirmationTemplateCode(
  client: unknown,
  confirmationType: ConfirmationType
) {
  const year = new Date().getFullYear();
  const prefix = `CTPL-${confirmationType}-${year}-`;
  const { findMany } = client as {
    findMany: (args: unknown) => Promise<Array<{ code: string }>>;
  };
  const records =
    (await findMany({
      where: { code: { startsWith: prefix } },
      select: { code: true },
    })) ?? [];
  const nextSequence =
    records.reduce((max, record) => {
      const sequence = Number(
        record.code.match(/^CTPL-[A-Z_]+-\d{4}-(\d{6})$/)?.[1]
      );
      return Number.isInteger(sequence) ? Math.max(max, sequence) : max;
    }, 0) + 1;
  return `${prefix}${String(nextSequence).padStart(6, "0")}`;
}

function validateDesignSchema(
  value: unknown
): ConfirmationTemplateDesignSchema {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["version", "fields"]) ||
    value.version !== 1
  ) {
    throw invalidDesign("version must be 1");
  }
  if (!Array.isArray(value.fields) || value.fields.length > MAX_DESIGN_FIELDS) {
    throw invalidDesign(
      `fields must contain at most ${MAX_DESIGN_FIELDS} items`
    );
  }

  const fieldIds = new Set<string>();
  const fields: ConfirmationTemplateDesignSchema["fields"] = [];
  for (const field of value.fields as unknown[]) {
    fields.push(validateDesignField(field, fieldIds));
  }
  return { version: 1, fields };
}

function validateDesignField(
  value: unknown,
  fieldIds: Set<string>
): ConfirmationTemplateDesignSchema["fields"][number] {
  if (
    !isRecord(value) ||
    !hasRequiredAndOptionalKeys(
      value,
      [
        "id",
        "kind",
        "name",
        "page",
        "x",
        "y",
        "width",
        "height",
        "placeholder",
        "options",
      ],
      [
        "binding",
        "baseInformationBinding",
        "defaultChecked",
        "defaultValueSource",
        "informationLibraryBinding",
        "required",
        "sourceRanges",
        "textStyle",
        "textAlign",
      ]
    )
  ) {
    throw invalidDesign("each field must match the design contract");
  }

  if (
    typeof value.id !== "string" ||
    !value.id.trim() ||
    value.id.trim().length > 100
  ) {
    throw invalidDesign("each field must have a non-empty id");
  }
  const normalizedId = value.id.trim();
  if (fieldIds.has(normalizedId)) {
    throw invalidDesign("field ids must be unique");
  }
  fieldIds.add(normalizedId);

  if (
    value.kind !== "TEXT" &&
    value.kind !== "MULTILINE" &&
    value.kind !== "NUMBER" &&
    value.kind !== "DATE" &&
    value.kind !== "CHECKBOX" &&
    value.kind !== "SELECT" &&
    value.kind !== "RADIO" &&
    value.kind !== "STATIC_TEXT" &&
    value.kind !== "MASK"
  ) {
    throw invalidDesign("field kind is not supported");
  }
  if (
    typeof value.page !== "number" ||
    !Number.isInteger(value.page) ||
    value.page < 1 ||
    value.page > 500
  ) {
    throw invalidDesign(
      "field page must be an integer greater than or equal to 1"
    );
  }

  for (const coordinate of ["x", "y", "width", "height"] as const) {
    const number = value[coordinate];
    if (
      typeof number !== "number" ||
      !Number.isFinite(number) ||
      number < 0 ||
      number > 1
    ) {
      throw invalidDesign(`field ${coordinate} must be between 0 and 1`);
    }
  }
  const x = value.x as number;
  const y = value.y as number;
  const width = value.width as number;
  const height = value.height as number;
  if (width <= 0 || height <= 0) {
    throw invalidDesign("field width and height must be greater than 0");
  }
  if (x + width > 1 || y + height > 1) {
    throw invalidDesign("field bounds must stay within the page");
  }

  if (typeof value.name !== "string" || value.name.trim().length > 200) {
    throw invalidDesign(
      "field name must be a string of at most 200 characters"
    );
  }
  const name = value.name.trim();
  if (value.kind !== "MASK" && !name) {
    throw invalidDesign("fillable fields require a non-empty name");
  }
  if (
    typeof value.placeholder !== "string" ||
    value.placeholder.trim().length > 300
  ) {
    throw invalidDesign("field placeholder must be at most 300 characters");
  }
  if (value.kind !== "MASK" && !value.placeholder.trim()) {
    throw invalidDesign("fillable fields require a non-empty prompt");
  }
  if (!Array.isArray(value.options) || value.options.length > 100) {
    throw invalidDesign("field options must contain at most 100 items");
  }
  if (
    (value.kind === "SELECT" || value.kind === "RADIO") &&
    value.options.length === 0
  ) {
    throw invalidDesign(`${value.kind} fields require at least one option`);
  }
  if (
    value.kind !== "SELECT" &&
    value.kind !== "RADIO" &&
    value.options.length > 0
  ) {
    throw invalidDesign(`${value.kind} fields cannot define options`);
  }
  const legacyBinding = validateDesignFieldBinding(value.binding, value.kind);
  const defaultValueSource = validateDesignFieldDefaultValueSource(
    value.defaultValueSource,
    value.kind
  );
  const legacyRelationDefaultValueSource =
    defaultValueSource?.source === "BASE_INFORMATION" ||
    defaultValueSource?.source === "INFORMATION_LIBRARY"
      ? defaultValueSource
      : undefined;
  if (
    value.defaultChecked !== undefined &&
    (value.kind !== "CHECKBOX" || typeof value.defaultChecked !== "boolean")
  ) {
    throw invalidDesign("defaultChecked must be a boolean on CHECKBOX fields");
  }
  if (
    value.required !== undefined &&
    (value.kind !== "CHECKBOX" || typeof value.required !== "boolean")
  ) {
    throw invalidDesign("required must be a boolean on CHECKBOX fields");
  }
  const baseInformationBinding = validateDesignFieldBinding(
    value.baseInformationBinding ??
      (legacyRelationDefaultValueSource?.source === "BASE_INFORMATION"
        ? legacyRelationDefaultValueSource.binding
        : undefined),
    value.kind,
    CONFIRMATION_BASE_INFORMATION_BINDINGS
  );
  const informationLibraryBinding = validateDesignFieldBinding(
    value.informationLibraryBinding ??
      (legacyRelationDefaultValueSource?.source === "INFORMATION_LIBRARY"
        ? legacyRelationDefaultValueSource.binding
        : undefined),
    value.kind,
    CONFIRMATION_INFORMATION_LIBRARY_BINDINGS
  );
  if (
    (defaultValueSource?.source === "BASE_INFORMATION" ||
      defaultValueSource?.source === "INFORMATION_LIBRARY") &&
    (value.binding !== undefined ||
      value.baseInformationBinding !== undefined ||
      value.informationLibraryBinding !== undefined)
  ) {
    throw invalidDesign(
      "default fill source cannot be combined with a legacy binding"
    );
  }
  const sourceRanges = validateDesignFieldSourceRanges(value.sourceRanges);
  const textStyle = validateDesignFieldTextStyle(value.textStyle, value.kind);
  if (
    value.textAlign !== undefined &&
    value.textAlign !== "left" &&
    value.textAlign !== "center" &&
    value.textAlign !== "right"
  ) {
    throw invalidDesign("textAlign must be left, center, or right");
  }
  const options = new Set<string>();
  for (const option of value.options as unknown[]) {
    if (
      typeof option !== "string" ||
      !option.trim() ||
      option.trim().length > 200
    ) {
      throw invalidDesign("field options must be non-empty strings");
    }
    const normalizedOption = option.trim();
    if (options.has(normalizedOption)) {
      throw invalidDesign("field options must be unique");
    }
    options.add(normalizedOption);
  }
  if (defaultValueSource?.source === "CUSTOM") {
    const customValue = defaultValueSource.value.trim();
    const invalidNumber =
      value.kind === "NUMBER" &&
      customValue !== "" &&
      !/^-?(?:\d+|\d*\.\d+)$/u.test(customValue);
    const invalidDate =
      value.kind === "DATE" &&
      customValue !== "" &&
      (!/^\d{4}-\d{2}-\d{2}$/u.test(customValue) ||
        Number.isNaN(Date.parse(customValue)));
    const invalidChoice =
      (value.kind === "RADIO" || value.kind === "SELECT") &&
      customValue !== "" &&
      !options.has(customValue);
    const invalidCheckbox =
      value.kind === "CHECKBOX" &&
      customValue !== "" &&
      customValue !== "true" &&
      customValue !== "false";
    if (invalidNumber || invalidDate || invalidChoice || invalidCheckbox) {
      throw invalidDesign("custom default fill does not match the field type");
    }
  }
  return {
    ...(value.kind === "CHECKBOX" && typeof value.defaultChecked === "boolean"
      ? { defaultChecked: value.defaultChecked }
      : {}),
    ...(defaultValueSource && !legacyRelationDefaultValueSource
      ? { defaultValueSource }
      : {}),
    id: normalizedId,
    kind: value.kind,
    name,
    page: value.page,
    x,
    y,
    width,
    height,
    placeholder: value.placeholder.trim(),
    options: [...options],
    ...(value.kind === "CHECKBOX" && typeof value.required === "boolean"
      ? { required: value.required }
      : {}),
    ...(textStyle ? { textStyle } : {}),
    ...(value.textAlign ? { textAlign: value.textAlign } : {}),
    ...(baseInformationBinding &&
    (value.baseInformationBinding !== undefined ||
      legacyRelationDefaultValueSource?.source === "BASE_INFORMATION")
      ? { binding: baseInformationBinding, baseInformationBinding }
      : legacyBinding
        ? { binding: legacyBinding }
        : {}),
    ...(informationLibraryBinding ? { informationLibraryBinding } : {}),
    ...(sourceRanges.length ? { sourceRanges } : {}),
  };
}

function validateDesignFieldTextStyle(
  value: unknown,
  kind: ConfirmationTemplateDesignFieldKind
): ConfirmationTemplateTextStyle | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (kind === "MASK") {
    throw invalidDesign("MASK fields cannot define text styles");
  }
  if (
    !isRecord(value) ||
    !["bold", "fontFamily", "fontSize", "italic", "underline"].every((key) =>
      Object.hasOwn(value, key)
    ) ||
    !Object.keys(value).every((key) =>
      [
        "backgroundColor",
        "bold",
        "fontFamily",
        "fontSize",
        "italic",
        "textColor",
        "underline",
      ].includes(key)
    ) ||
    typeof value.bold !== "boolean" ||
    typeof value.italic !== "boolean" ||
    typeof value.underline !== "boolean" ||
    !CONFIRMATION_TEMPLATE_FONT_FAMILIES.includes(
      value.fontFamily as (typeof CONFIRMATION_TEMPLATE_FONT_FAMILIES)[number]
    ) ||
    !CONFIRMATION_TEMPLATE_FONT_SIZES.includes(
      value.fontSize as (typeof CONFIRMATION_TEMPLATE_FONT_SIZES)[number]
    ) ||
    (value.textColor !== undefined &&
      (typeof value.textColor !== "string" ||
        !/^#[0-9A-Fa-f]{6}$/u.test(value.textColor))) ||
    (value.backgroundColor !== undefined &&
      (typeof value.backgroundColor !== "string" ||
        (value.backgroundColor !== "transparent" &&
          !/^#[0-9A-Fa-f]{6}$/u.test(value.backgroundColor))))
  ) {
    throw invalidDesign(
      "textStyle must match the supported field style options"
    );
  }
  return {
    ...(value.backgroundColor
      ? { backgroundColor: value.backgroundColor }
      : {}),
    bold: value.bold,
    fontFamily: value.fontFamily as ConfirmationTemplateTextStyle["fontFamily"],
    fontSize: value.fontSize as ConfirmationTemplateTextStyle["fontSize"],
    italic: value.italic,
    ...(value.textColor ? { textColor: value.textColor } : {}),
    underline: value.underline,
  };
}

function validateDesignFieldBinding(
  value: unknown,
  kind: ConfirmationTemplateDesignFieldKind,
  bindings: readonly ConfirmationTemplateDesignFieldBinding[] =
    CONFIRMATION_TEMPLATE_FIELD_BINDINGS
): ConfirmationTemplateDesignFieldBinding | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    (kind !== "TEXT" && kind !== "MULTILINE") ||
    typeof value !== "string" ||
    !(bindings.includes(value as ConfirmationTemplateDesignFieldBinding) || (bindings !== CONFIRMATION_INFORMATION_LIBRARY_BINDINGS && /^custom:[a-zA-Z0-9-]{1,80}$/.test(value)))
  ) {
    throw invalidDesign(
      "only TEXT and MULTILINE fields can define a supported binding"
    );
  }
  return value as ConfirmationTemplateDesignFieldBinding;
}

function validateDesignFieldDefaultValueSource(
  value: unknown,
  kind: ConfirmationTemplateDesignFieldKind
): ConfirmationTemplateDefaultValueSource | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    isRecord(value) &&
    value.source === "CUSTOM" &&
    hasRequiredAndOptionalKeys(value, ["source", "value"], []) &&
    typeof value.value === "string" &&
    value.value.length <= 10_000
  ) {
    if (kind === "STATIC_TEXT" || kind === "MASK") {
      throw invalidDesign(
        "STATIC_TEXT and MASK fields cannot define a custom default fill"
      );
    }
    return { source: "CUSTOM", value: value.value };
  }
  if (
    isRecord(value) &&
    value.source === "SYSTEM" &&
    hasRequiredAndOptionalKeys(value, ["source", "value"], []) &&
    value.value === "CURRENT_DATE"
  ) {
    if (kind !== "DATE") {
      throw invalidDesign("CURRENT_DATE default fill is only valid for DATE");
    }
    return { source: "SYSTEM", value: "CURRENT_DATE" };
  }
  const relationSource =
    isRecord(value) &&
    (value.source === "BASE_INFORMATION" ||
      value.source === "INFORMATION_LIBRARY")
      ? value.source
      : undefined;
  const validRelationBinding =
    relationSource !== undefined &&
    isRecord(value) &&
    typeof value.binding === "string"
      ? relationSource === "BASE_INFORMATION"
        ? /^custom:[a-zA-Z0-9-]{1,80}$/.test(value.binding) || CONFIRMATION_BASE_INFORMATION_BINDINGS.includes(
            value.binding as (typeof CONFIRMATION_BASE_INFORMATION_BINDINGS)[number]
          )
        : relationSource === "INFORMATION_LIBRARY"
          ? CONFIRMATION_INFORMATION_LIBRARY_BINDINGS.includes(
              value.binding as (typeof CONFIRMATION_INFORMATION_LIBRARY_BINDINGS)[number]
            )
          : false
      : false;
  if (
    (kind !== "TEXT" && kind !== "MULTILINE") ||
    !isRecord(value) ||
    !hasRequiredAndOptionalKeys(value, ["binding", "source"], []) ||
    typeof value.binding !== "string" ||
    !validRelationBinding ||
    relationSource === undefined
  ) {
    throw invalidDesign("default fill source is invalid");
  }
  return {
    binding: value.binding as ConfirmationTemplateDesignFieldBinding,
    source: relationSource,
  };
}

function validateDesignFieldSourceRanges(
  value: unknown
): ConfirmationTemplateDesignFieldSourceRange[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > MAX_DESIGN_SOURCE_RANGES) {
    throw invalidDesign(
      `sourceRanges must contain at most ${MAX_DESIGN_SOURCE_RANGES} items`
    );
  }

  return value.map((range) => {
    const expectedKeys =
      isRecord(range) && range.paragraphId === undefined
        ? [
            "part",
            "paragraphOrdinal",
            "paragraphXmlSha256",
            "sourceText",
            "start",
            "end",
          ]
        : [
            "part",
            "paragraphOrdinal",
            "paragraphId",
            "paragraphXmlSha256",
            "sourceText",
            "start",
            "end",
          ];
    if (
      !isRecord(range) ||
      !hasExactKeys(range, expectedKeys) ||
      range.part !== "word/document.xml" ||
      typeof range.paragraphOrdinal !== "number" ||
      !Number.isSafeInteger(range.paragraphOrdinal) ||
      range.paragraphOrdinal < 0 ||
      (range.paragraphId !== undefined &&
        (typeof range.paragraphId !== "string" || !range.paragraphId.trim())) ||
      typeof range.paragraphXmlSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(range.paragraphXmlSha256) ||
      typeof range.sourceText !== "string" ||
      typeof range.start !== "number" ||
      typeof range.end !== "number" ||
      !Number.isSafeInteger(range.start) ||
      !Number.isSafeInteger(range.end) ||
      range.start < 0 ||
      range.end <= range.start ||
      !range.sourceText ||
      range.sourceText.length > MAX_DESIGN_SOURCE_RANGE_TEXT_LENGTH ||
      range.end - range.start !== range.sourceText.length
    ) {
      throw invalidDesign("sourceRanges must contain valid source anchors");
    }
    return {
      end: range.end,
      ...(typeof range.paragraphId === "string"
        ? { paragraphId: range.paragraphId }
        : {}),
      paragraphOrdinal: range.paragraphOrdinal,
      paragraphXmlSha256: range.paragraphXmlSha256,
      part: "word/document.xml" as const,
      sourceText: range.sourceText,
      start: range.start,
    };
  });
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value);
  return (
    actual.length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function hasRequiredAndOptionalKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[]
) {
  return (
    required.every((key) => key in value) &&
    Object.keys(value).every(
      (key) => required.includes(key) || optional.includes(key)
    )
  );
}

type ParsedXmlElement = {
  attributes: Record<string, string>;
  localName: string;
  namespaceUri: string | null;
};

type DocxArchiveReadState = {
  uncompressedSize: number;
};

async function readDocxArchiveEntry(
  name: string,
  entry: JSZip.JSZipObject,
  compressedSize: number,
  requiredParts: Set<string>,
  state: DocxArchiveReadState
) {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const stream = entry.nodeStream("nodebuffer");
    let settled = false;
    stream.on("data", (value: Buffer | Uint8Array) => {
      if (settled) {
        return;
      }
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      state.uncompressedSize += chunk.length;
      if (
        state.uncompressedSize > MAX_DOCX_UNCOMPRESSED_SIZE ||
        state.uncompressedSize > compressedSize * MAX_DOCX_COMPRESSION_RATIO
      ) {
        settled = true;
        (stream as unknown as { destroy: () => void }).destroy();
        reject(invalidDocxArchive());
        return;
      }
      if (requiredParts.has(name)) {
        chunks.push(chunk);
      }
    });
    stream.on("error", (error) => {
      if (!settled) {
        reject(error);
      }
    });
    stream.on("end", () => {
      if (!settled) {
        resolve();
      }
    });
  });
  return requiredParts.has(name) ? Buffer.concat(chunks) : null;
}

async function readDocxArchive(archive: JSZip, compressedSize: number) {
  const requiredParts = new Set([
    "[Content_Types].xml",
    "_rels/.rels",
    "word/document.xml",
  ]);
  const parts = new Map<string, Buffer>();
  const state: DocxArchiveReadState = { uncompressedSize: 0 };

  for (const [name, entry] of Object.entries(archive.files)) {
    if (entry.dir) {
      continue;
    }
    const content = await readDocxArchiveEntry(
      name,
      entry,
      compressedSize,
      requiredParts,
      state
    );
    if (content) {
      parts.set(name, content);
    }
  }
  if ([...requiredParts].some((name) => !parts.has(name))) {
    throw invalidDocxArchive();
  }
  return parts;
}

function validateDocxPackage(parts: Map<string, Buffer>) {
  const contentTypes = parseXml(
    assertPresentValue(parts.get("[Content_Types].xml"))
  );
  const relationships = parseXml(assertPresentValue(parts.get("_rels/.rels")));
  const document = parseXml(assertPresentValue(parts.get("word/document.xml")));
  if (
    contentTypes[0]?.localName !== "Types" ||
    contentTypes[0]?.namespaceUri !== PACKAGE_CONTENT_TYPES_NAMESPACE ||
    !contentTypes.some(
      (element) =>
        element.localName === "Override" &&
        element.namespaceUri === PACKAGE_CONTENT_TYPES_NAMESPACE &&
        element.attributes.PartName === "/word/document.xml" &&
        element.attributes.ContentType === DOCX_MAIN_PART_CONTENT_TYPE
    )
  ) {
    throw invalidDocxArchive();
  }
  if (
    relationships[0]?.localName !== "Relationships" ||
    relationships[0]?.namespaceUri !== PACKAGE_RELATIONSHIPS_NAMESPACE ||
    !relationships.some(
      (element) =>
        element.localName === "Relationship" &&
        element.namespaceUri === PACKAGE_RELATIONSHIPS_NAMESPACE &&
        OFFICE_DOCUMENT_RELATIONSHIP_TYPES.has(element.attributes.Type) &&
        element.attributes.Target === "word/document.xml" &&
        element.attributes.TargetMode !== "External"
    )
  ) {
    throw invalidDocxArchive();
  }
  if (
    document[0]?.localName !== "document" ||
    !WORDPROCESSING_NAMESPACES.has(document[0].namespaceUri ?? "")
  ) {
    throw invalidDocxArchive();
  }
}

function parseXml(buffer: Buffer): ParsedXmlElement[] {
  let xml: string;
  try {
    xml = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw invalidDocxArchive();
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw invalidDocxArchive();
  }
  const elements: ParsedXmlElement[] = [];
  const stack: { name: string; namespaces: Map<string, string> }[] = [];
  let index = 0;
  let roots = 0;
  while (index < xml.length) {
    if (xml[index] !== "<") {
      const end = xml.indexOf("<", index);
      const text = xml.slice(index, end === -1 ? xml.length : end);
      validateXmlEntities(text);
      if (stack.length === 0 && text.trim()) {
        throw invalidDocxArchive();
      }
      index = end === -1 ? xml.length : end;
      continue;
    }
    if (xml.startsWith("<!--", index)) {
      const end = xml.indexOf("-->", index + 4);
      if (end === -1 || xml.slice(index + 4, end).includes("--")) {
        throw invalidDocxArchive();
      }
      index = end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", index)) {
      const end = xml.indexOf("]]>", index + 9);
      if (end === -1 || stack.length === 0) {
        throw invalidDocxArchive();
      }
      index = end + 3;
      continue;
    }
    if (xml.startsWith("<?", index)) {
      const end = xml.indexOf("?>", index + 2);
      if (end === -1) {
        throw invalidDocxArchive();
      }
      index = end + 2;
      continue;
    }
    if (xml.startsWith("<!", index)) {
      throw invalidDocxArchive();
    }
    const end = findXmlTagEnd(xml, index + 1);
    const source = xml.slice(index + 1, end).trim();
    if (source.startsWith("/")) {
      const name = source.slice(1).trim();
      if (!isXmlName(name) || stack.pop()?.name !== name) {
        throw invalidDocxArchive();
      }
    } else {
      const selfClosing = source.endsWith("/");
      const parsed = parseXmlStartTag(
        selfClosing ? source.slice(0, -1).trim() : source,
        stack.at(-1)?.namespaces
      );
      if (stack.length === 0) {
        roots += 1;
      }
      const prefix = parsed.name.includes(":")
        ? parsed.name.slice(0, parsed.name.indexOf(":"))
        : "";
      const namespaceUri = parsed.namespaces.get(prefix) ?? null;
      if (prefix && !namespaceUri) {
        throw invalidDocxArchive();
      }
      elements.push({
        attributes: parsed.attributes,
        localName: parsed.name.slice(parsed.name.lastIndexOf(":") + 1),
        namespaceUri,
      });
      if (!selfClosing) {
        stack.push({ name: parsed.name, namespaces: parsed.namespaces });
      }
    }
    index = end + 1;
  }
  if (stack.length > 0 || roots !== 1 || elements.length === 0) {
    throw invalidDocxArchive();
  }
  return elements;
}

function findXmlTagEnd(xml: string, start: number) {
  let quote = "";
  for (let index = start; index < xml.length; index += 1) {
    const character = xml[index];
    if (quote) {
      if (character === quote) {
        quote = "";
      }
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }
  throw invalidDocxArchive();
}

function parseXmlStartTag(source: string, inherited?: Map<string, string>) {
  const nameMatch = /^[A-Za-z_][A-Za-z0-9_.:-]*/.exec(source);
  if (!nameMatch) {
    throw invalidDocxArchive();
  }
  const [name] = nameMatch;
  const attributes: Record<string, string> = {};
  const namespaces = new Map(inherited);
  let index = name.length;
  while (index < source.length) {
    while (/\s/.test(source[index] ?? "")) {
      index += 1;
    }
    if (index >= source.length) {
      break;
    }
    const match = /^[A-Za-z_][A-Za-z0-9_.:-]*/.exec(source.slice(index));
    if (!match) {
      throw invalidDocxArchive();
    }
    const [attributeName] = match;
    if (attributeName in attributes) {
      throw invalidDocxArchive();
    }
    index += attributeName.length;
    while (/\s/.test(source[index] ?? "")) {
      index += 1;
    }
    if (source[index] !== "=") {
      throw invalidDocxArchive();
    }
    index += 1;
    while (/\s/.test(source[index] ?? "")) {
      index += 1;
    }
    const quote = source[index];
    if (quote !== '"' && quote !== "'") {
      throw invalidDocxArchive();
    }
    const end = source.indexOf(quote, index + 1);
    if (end === -1) {
      throw invalidDocxArchive();
    }
    const rawValue = source.slice(index + 1, end);
    validateXmlEntities(rawValue);
    const value = decodeXmlEntities(rawValue);
    attributes[attributeName] = value;
    if (attributeName === "xmlns") {
      namespaces.set("", value);
    }
    if (attributeName.startsWith("xmlns:")) {
      namespaces.set(attributeName.slice(6), value);
    }
    index = end + 1;
  }
  return { attributes, name, namespaces };
}

function isXmlName(value: string) {
  return /^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(value);
}

function validateXmlEntities(value: string) {
  if (
    value
      .replaceAll(/&(?:amp|lt|gt|apos|quot|#\d+|#x[\dA-Fa-f]+);/g, "")
      .includes("&")
  ) {
    throw invalidDocxArchive();
  }
}

function decodeXmlEntities(value: string) {
  return value.replaceAll(
    /&(?:amp|lt|gt|apos|quot|#\d+|#x[\dA-Fa-f]+);/g,
    (entity) => {
      if (entity === "&amp;") {
        return "&";
      }
      if (entity === "&lt;") {
        return "<";
      }
      if (entity === "&gt;") {
        return ">";
      }
      if (entity === "&apos;") {
        return "'";
      }
      if (entity === "&quot;") {
        return '"';
      }
      const hexadecimal = entity[2] === "x";
      const encodedCodePoint = entity.slice(hexadecimal ? 3 : 2, -1);
      const codePoint = hexadecimal
        ? Number.parseInt(encodedCodePoint, 16)
        : Math.trunc(Number(encodedCodePoint));
      if (
        !Number.isInteger(codePoint) ||
        codePoint <= 0 ||
        codePoint > 0x10_ff_ff
      ) {
        throw invalidDocxArchive();
      }
      return String.fromCodePoint(codePoint);
    }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidDesign(message: string) {
  return new ApiBadRequestException(
    "VALIDATION_FAILED",
    `Invalid confirmation template design: ${message}`
  );
}

function invalidDocxArchive() {
  return new ApiBadRequestException(
    "VALIDATION_FAILED",
    "The uploaded file is not a valid DOCX document"
  );
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
