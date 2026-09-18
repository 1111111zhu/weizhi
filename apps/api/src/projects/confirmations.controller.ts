import { readFile } from "node:fs/promises";

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  CONFIRMATION_TEMPLATE_FONT_FAMILIES,
  CONFIRMATION_TEMPLATE_FONT_SIZES,
  CONFIRMATION_TEMPLATE_MANAGER_GLOBAL_ROLES,
  ClaimConfirmationDispatchQueueSchema,
  CompleteMockCourierDeliverySchema,
  ConfirmationDispatchQueueQuerySchema,
  ConfirmationInformationLibraryCreateInputSchema,
  ConfirmationInformationLibraryUpdateInputSchema,
  CreateConfirmationDispatchBatchSchema,
  ExecuteConfirmationDispatchBatchSchema,
  ReleaseConfirmationDispatchQueueSchema,
  ReturnConfirmationDispatchQueueSchema,
  RouteConfirmationResponseLibraryFileSchema,
} from "@project-wing/shared";
import type { Response } from "express";
import { z } from "zod";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditSource } from "../audit-logs/audit-source.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequireGlobalRoles } from "../auth/global-roles.decorator";
import { GlobalRolesGuard } from "../auth/global-roles.guard";
import type { RequestUser } from "../auth/request-user";
import { ApiBadRequestException } from "../common/api-error";
import {
  buildAttachmentContentDisposition,
  buildInlineContentDisposition,
} from "../common/file-name";
import { ConfirmationDispatchQueueService } from "./confirmation-dispatch-queue.service";
import { ConfirmationDispatchService } from "./confirmation-dispatch.service";
import { ConfirmationInformationLibraryService } from "./confirmation-information-library.service";
import { ConfirmationPrintService } from "./confirmation-print.service";
import { ConfirmationResponseLibraryService } from "./confirmation-response-library.service";
import type { UploadedConfirmationResponseLibraryFile } from "./confirmation-response-library.service";
import {
  CONFIRMATION_BASE_INFORMATION_BINDINGS,
  CONFIRMATION_INFORMATION_LIBRARY_BINDINGS,
  CONFIRMATION_TEMPLATE_FIELD_BINDINGS,
  ConfirmationTemplateLibraryService,
  type UploadedConfirmationTemplateFile,
} from "./confirmation-template-library.service";
import { ConfirmationWorkspaceService } from "./confirmation-workspace.service";
import { ProjectConfirmationsService } from "./project-confirmations.service";

const ConfirmationTemplateLibraryUploadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  confirmationType: z.enum([
    "BANK",
    "BALANCE",
    "RELATED_PARTY",
    "LAWYER",
    "INVENTORY",
    "INTERMEDIARY",
    "OTHER",
  ]),
  description: z.string().trim().max(2000).optional(),
});
const ConfirmationTemplateDesignSourceRangeSchema = z
  .object({
    end: z.number().int().min(1),
    paragraphId: z
      .string()
      .refine((value) => Boolean(value.trim()))
      .optional(),
    paragraphOrdinal: z.number().int().min(0),
    paragraphXmlSha256: z.string().regex(/^[a-f0-9]{64}$/),
    part: z.literal("word/document.xml"),
    sourceText: z.string().min(1).max(10_000),
    start: z.number().int().min(0),
  })
  .strict()
  .superRefine((range, context) => {
    if (
      range.end <= range.start ||
      range.end - range.start !== range.sourceText.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Template source range must match its source text",
      });
    }
  });

const ConfirmationTemplateRelationDefaultValueSourceSchema = z.union([
  z
    .object({
      binding: z.union([z.enum(CONFIRMATION_BASE_INFORMATION_BINDINGS), z.string().regex(/^custom:[a-zA-Z0-9-]{1,80}$/) as z.ZodType<`custom:${string}`>]),
      source: z.literal("BASE_INFORMATION"),
    })
    .strict(),
  z
    .object({
      binding: z.enum(CONFIRMATION_INFORMATION_LIBRARY_BINDINGS),
      source: z.literal("INFORMATION_LIBRARY"),
    })
    .strict(),
]);
const ConfirmationTemplateDesignFieldSchema = z
  .object({
    defaultChecked: z.boolean().optional(),
    defaultValueSource: z
      .union([
        ConfirmationTemplateRelationDefaultValueSourceSchema,
        z
          .object({
            source: z.literal("CUSTOM"),
            value: z.string().max(10_000),
          })
          .strict(),
        z
          .object({
            source: z.literal("SYSTEM"),
            value: z.literal("CURRENT_DATE"),
          })
          .strict(),
      ])
      .optional(),
    id: z.string().trim().min(1).max(100),
    kind: z.enum([
      "TEXT",
      "MULTILINE",
      "NUMBER",
      "DATE",
      "CHECKBOX",
      "SELECT",
      "RADIO",
      "STATIC_TEXT",
      "MASK",
    ]),
    name: z.string().trim().max(200),
    page: z.number().int().min(1).max(500),
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    width: z.number().finite().gt(0).max(1),
    height: z.number().finite().gt(0).max(1),
    placeholder: z.string().trim().max(300),
    options: z.array(z.string().trim().min(1).max(200)).max(100),
    required: z.boolean().optional(),
    textStyle: z
      .object({
        backgroundColor: z
          .union([
            z.literal("transparent"),
            z.string().regex(/^#[0-9A-Fa-f]{6}$/u),
          ])
          .optional(),
        bold: z.boolean(),
        fontFamily: z.enum(CONFIRMATION_TEMPLATE_FONT_FAMILIES),
        fontSize: z
          .number()
          .int()
          .refine((value) =>
            CONFIRMATION_TEMPLATE_FONT_SIZES.includes(
              value as (typeof CONFIRMATION_TEMPLATE_FONT_SIZES)[number]
            )
          ),
        italic: z.boolean(),
        textColor: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/u)
          .optional(),
        underline: z.boolean(),
      })
      .strict()
      .optional(),
    textAlign: z.enum(["left", "center", "right"]).optional(),
    binding: z.union([z.enum(CONFIRMATION_TEMPLATE_FIELD_BINDINGS), z.string().regex(/^custom:[a-zA-Z0-9-]{1,80}$/) as z.ZodType<`custom:${string}`>]).optional(),
    baseInformationBinding: z.union([z.enum(CONFIRMATION_BASE_INFORMATION_BINDINGS), z.string().regex(/^custom:[a-zA-Z0-9-]{1,80}$/) as z.ZodType<`custom:${string}`>]).optional(),
    informationLibraryBinding: z
      .enum(CONFIRMATION_INFORMATION_LIBRARY_BINDINGS)
      .optional(),
    sourceRanges: z
      .array(ConfirmationTemplateDesignSourceRangeSchema)
      .max(200)
      .optional(),
  })
  .strict()
  .superRefine((field, context) => {
    if (field.kind !== "MASK" && !field.name.trim()) {
      context.addIssue({
        code: "custom",
        message: "Template field name is required",
        path: ["name"],
      });
    }
    if (field.kind !== "MASK" && !field.placeholder.trim()) {
      context.addIssue({
        code: "custom",
        message: "Template field prompt is required",
        path: ["placeholder"],
      });
    }
    if (
      (field.kind === "SELECT" || field.kind === "RADIO") &&
      field.options.length === 0
    ) {
      context.addIssue({
        code: "custom",
        message: `${field.kind} template field requires an option`,
        path: ["options"],
      });
    }
    if (
      field.kind !== "SELECT" &&
      field.kind !== "RADIO" &&
      field.options.length > 0
    ) {
      context.addIssue({
        code: "custom",
        message: `${field.kind} template field cannot define options`,
        path: ["options"],
      });
    }
    if (
      (field.binding !== undefined ||
        field.baseInformationBinding !== undefined ||
        field.informationLibraryBinding !== undefined) &&
      field.kind !== "TEXT" &&
      field.kind !== "MULTILINE"
    ) {
      context.addIssue({
        code: "custom",
        message: "Only TEXT and MULTILINE template fields can define a binding",
        path: ["binding"],
      });
    }
    if (
      field.defaultValueSource !== undefined &&
      ((field.defaultValueSource.source === "SYSTEM" &&
        field.kind !== "DATE") ||
        ((field.defaultValueSource.source === "BASE_INFORMATION" ||
          field.defaultValueSource.source === "INFORMATION_LIBRARY") &&
          field.kind !== "TEXT" &&
          field.kind !== "MULTILINE") ||
        (field.defaultValueSource.source === "CUSTOM" &&
          (field.kind === "STATIC_TEXT" || field.kind === "MASK")))
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Only TEXT and MULTILINE template fields can define a default fill source",
        path: ["defaultValueSource"],
      });
    }
    if (field.defaultValueSource?.source === "CUSTOM") {
      const defaultValue = field.defaultValueSource.value.trim();
      const invalidNumber =
        field.kind === "NUMBER" &&
        defaultValue !== "" &&
        !/^-?(?:\d+|\d*\.\d+)$/u.test(defaultValue);
      const invalidDate =
        field.kind === "DATE" &&
        defaultValue !== "" &&
        (!/^\d{4}-\d{2}-\d{2}$/u.test(defaultValue) ||
          Number.isNaN(Date.parse(defaultValue)));
      const invalidChoice =
        (field.kind === "RADIO" || field.kind === "SELECT") &&
        defaultValue !== "" &&
        !field.options.includes(defaultValue);
      const invalidCheckbox =
        field.kind === "CHECKBOX" &&
        defaultValue !== "" &&
        defaultValue !== "true" &&
        defaultValue !== "false";
      if (invalidNumber || invalidDate || invalidChoice || invalidCheckbox) {
        context.addIssue({
          code: "custom",
          message: "Custom default fill value does not match the field type",
          path: ["defaultValueSource", "value"],
        });
      }
    }
    if (
      (field.defaultValueSource?.source === "BASE_INFORMATION" ||
        field.defaultValueSource?.source === "INFORMATION_LIBRARY") &&
      (field.binding !== undefined ||
        field.baseInformationBinding !== undefined ||
        field.informationLibraryBinding !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "Default fill source cannot be combined with a legacy binding",
        path: ["defaultValueSource"],
      });
    }
    if (
      (field.defaultChecked !== undefined || field.required !== undefined) &&
      field.kind !== "CHECKBOX"
    ) {
      context.addIssue({
        code: "custom",
        message: "Only CHECKBOX template fields can define checkbox behavior",
        path: [
          field.defaultChecked === undefined ? "required" : "defaultChecked",
        ],
      });
    }
    if (field.textStyle !== undefined && field.kind === "MASK") {
      context.addIssue({
        code: "custom",
        message: "Only text and select fields can define text styles",
        path: ["textStyle"],
      });
    }
    if (field.x + field.width > 1 || field.y + field.height > 1) {
      context.addIssue({
        code: "custom",
        message: "Template field must stay within its page",
      });
    }
  })
  .transform((field) => {
    const relation = field.defaultValueSource;
    if (!relation || relation.source === "CUSTOM" || relation.source === "SYSTEM") {
      return field;
    }
    const withoutRelation = { ...field };
    delete withoutRelation.defaultValueSource;
    return relation.source === "BASE_INFORMATION"
      ? { ...withoutRelation, baseInformationBinding: relation.binding }
      : {
          ...withoutRelation,
          informationLibraryBinding: relation.binding,
        };
  });
const ConfirmationTemplateDesignSaveSchema = z
  .object({
    designSchema: z
      .object({
        version: z.literal(1),
        fields: z.array(ConfirmationTemplateDesignFieldSchema).max(100),
      })
      .strict(),
    designStatus: z.enum(["DRAFT", "ENABLED"]),
  })
  .strict();
const ConfirmationTemplateStatusSchema = z.enum([
  "DRAFT",
  "ENABLED",
  "DISABLED",
]);
const ConfirmationTemplateStatusPatchSchema = z
  .object({
    designStatus: ConfirmationTemplateStatusSchema,
  })
  .strict();
const ConfirmationTemplateStatusBulkPatchSchema = z
  .object({
    templateIds: z.array(z.string().trim().min(1)).min(1).max(100),
    designStatus: ConfirmationTemplateStatusSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (new Set(input.templateIds).size !== input.templateIds.length) {
      context.addIssue({
        code: "custom",
        message: "Template IDs must be unique",
        path: ["templateIds"],
      });
    }
  });

function stripTemplateLibraryInternalFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripTemplateLibraryInternalFields);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  const {
    filePath: _filePath,
    objectKey: _objectKey,
    ...publicValue
  } = value as Record<string, unknown>;
  return {
    ...publicValue,
    ...(typeof publicValue.fileName === "string"
      ? { fileName: publicValue.fileName.replace(/\.[^.]+$/u, ".pdf") }
      : {}),
    ...(typeof publicValue.mimeType === "string"
      ? { mimeType: "application/pdf" }
      : {}),
  };
}

const ConfirmationResponseLibraryUploadSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  receivedAt: z.coerce.date(),
  courierTrackingNumber: z.string().trim().max(200).optional(),
  referenceNumber: z.string().trim().max(200).optional(),
  clientName: z.string().trim().min(1).max(200),
  respondingEntity: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).optional(),
});
const InformationLibraryQuerySchema = z.object({
  entryId: z.string().trim().min(1).max(200).optional(),
  query: z.string().trim().max(300).optional(),
  includeInactive: z
    .preprocess(
      (value) =>
        value === undefined || value === ""
          ? false
          : value === "true"
            ? true
            : value === "false"
              ? false
              : value,
      z.boolean()
    )
    .default(false),
});

@UseGuards(AuthGuard)
@Controller("confirmations")
export class ConfirmationsController {
  constructor(
    private readonly confirmations: ProjectConfirmationsService,
    private readonly queue: ConfirmationDispatchQueueService,
    private readonly dispatches: ConfirmationDispatchService,
    private readonly prints: ConfirmationPrintService,
    private readonly templateLibrary: ConfirmationTemplateLibraryService,
    private readonly responseLibrary: ConfirmationResponseLibraryService,
    private readonly workspace: ConfirmationWorkspaceService,
    private readonly informationLibrary: ConfirmationInformationLibraryService
  ) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.confirmations.listForOffice(user);
  }

  @Get("logistics-unread")
  listLogisticsUnread(@CurrentUser() user: RequestUser) {
    return this.confirmations.listLogisticsUnread(user);
  }

  @Get("workspace-summary")
  listWorkspaceSummary(@CurrentUser() user: RequestUser) {
    return this.workspace.list(user);
  }

  @Get("information-library")
  listInformationLibrary(@Query() query: Record<string, unknown>) {
    const parsed = InformationLibraryQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid confirmation information library filters"
      );
    }
    return this.informationLibrary.list(parsed.data);
  }

  @Post("information-library")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  createInformationLibraryEntry(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed =
      ConfirmationInformationLibraryCreateInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid confirmation information library entry"
      );
    }
    return this.informationLibrary.create(parsed.data, user, source);
  }

  @Patch("information-library/:entryId")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  updateInformationLibraryEntry(
    @Param("entryId") entryId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed =
      ConfirmationInformationLibraryUpdateInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid confirmation information library entry"
      );
    }
    return this.informationLibrary.update(entryId, parsed.data, user, source);
  }

  @Delete("information-library/:entryId")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  deactivateInformationLibraryEntry(
    @Param("entryId") entryId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.informationLibrary.deactivate(entryId, user, source);
  }

  @Post("information-library/:entryId/restore")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  restoreInformationLibraryEntry(
    @Param("entryId") entryId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.informationLibrary.restore(entryId, user, source);
  }

  @Get("template-library")
  listTemplateLibrary() {
    return this.templateLibrary.list().then(stripTemplateLibraryInternalFields);
  }

  @Get("template-library/:templateId/download")
  async downloadTemplateLibraryFile(
    @Param("templateId") templateId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource,
    @Res() response: Response
  ) {
    const { template, file } = await this.templateLibrary.download(
      templateId,
      user,
      source
    );
    response.type(file.mimeType);
    response.setHeader(
      "Content-Disposition",
      buildAttachmentContentDisposition(file.fileName)
    );
    return response.send(file.body);
  }

  @Get("template-library/:templateId/preview")
  async previewTemplateLibraryFile(
    @Param("templateId") templateId: string,
    @Res() response: Response
  ) {
    const { template, body, fileName, mimeType } =
      await this.templateLibrary.preview(templateId);
    response.type(mimeType);
    response.setHeader(
      "Content-Disposition",
      buildInlineContentDisposition(fileName ?? template.fileName)
    );
    return response.send(body);
  }

  @Post("template-library")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles(...CONFIRMATION_TEMPLATE_MANAGER_GLOBAL_ROLES)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } })
  )
  uploadTemplateLibraryFile(
    @Body() body: unknown,
    @UploadedFile() file: UploadedConfirmationTemplateFile | undefined,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ConfirmationTemplateLibraryUploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid confirmation template metadata"
      );
    }
    return this.templateLibrary
      .upload(parsed.data, file, user, source)
      .then(stripTemplateLibraryInternalFields);
  }

  @Patch("template-library/:templateId/design")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles(...CONFIRMATION_TEMPLATE_MANAGER_GLOBAL_ROLES)
  saveTemplateLibraryDesign(
    @Param("templateId") templateId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ConfirmationTemplateDesignSaveSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid confirmation template design"
      );
    }
    return this.templateLibrary
      .saveDesign(templateId, parsed.data, user, source)
      .then(stripTemplateLibraryInternalFields);
  }

  @Patch("template-library/status")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles(...CONFIRMATION_TEMPLATE_MANAGER_GLOBAL_ROLES)
  bulkSetTemplateLibraryStatus(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ConfirmationTemplateStatusBulkPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid confirmation template status update"
      );
    }
    return this.templateLibrary
      .bulkSetStatus(
        parsed.data.templateIds,
        parsed.data.designStatus,
        user,
        source
      )
      .then(stripTemplateLibraryInternalFields);
  }

  @Patch("template-library/:templateId/status")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles(...CONFIRMATION_TEMPLATE_MANAGER_GLOBAL_ROLES)
  setTemplateLibraryStatus(
    @Param("templateId") templateId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ConfirmationTemplateStatusPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid confirmation template status update"
      );
    }
    return this.templateLibrary
      .setStatus(templateId, parsed.data.designStatus, user, source)
      .then(stripTemplateLibraryInternalFields);
  }

  @Delete("template-library/:templateId")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles(...CONFIRMATION_TEMPLATE_MANAGER_GLOBAL_ROLES)
  deleteTemplateLibraryFile(
    @Param("templateId") templateId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.templateLibrary.remove(templateId, user, source);
  }

  @Get("response-library")
  listResponseLibrary() {
    return this.responseLibrary.list();
  }

  @Get("response-library/project/:projectId/pending")
  listPendingProjectResponses(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.responseLibrary.listPendingForProject(projectId, user);
  }

  @Get("response-library/project/:projectId")
  listProjectResponseWarehouse(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.responseLibrary.listForProject(projectId, user);
  }

  @Patch("response-library/:responseId/route")
  routeResponseLibraryFile(
    @Param("responseId") responseId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = RouteConfirmationResponseLibraryFileSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid confirmation response routing details"
      );
    }
    return this.responseLibrary.route(responseId, parsed.data, user, source);
  }

  @Get("response-library/:responseId/download")
  async downloadResponseLibraryFile(
    @Param("responseId") responseId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource,
    @Res() response: Response
  ) {
    const { response: item, file } = await this.responseLibrary.download(
      responseId,
      user,
      source
    );
    response.type(file.mimeType);
    response.setHeader(
      "Content-Disposition",
      buildAttachmentContentDisposition(item.fileName)
    );
    if (file.redirectUrl) {
      return response.redirect(302, file.redirectUrl);
    }
    if (!file.absolutePath) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Confirmation response file is unavailable"
      );
    }
    return response.send(await readFile(file.absolutePath));
  }

  @Get("response-library/:responseId/preview")
  async previewResponseLibraryFile(
    @Param("responseId") responseId: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    const { response: item, body } = await this.responseLibrary.preview(
      responseId,
      user
    );
    response.type(item.mimeType);
    response.setHeader(
      "Content-Disposition",
      buildInlineContentDisposition(item.fileName)
    );
    return response.send(body);
  }

  @Post("response-library")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 50 * 1024 * 1024 } })
  )
  uploadResponseLibraryFile(
    @Body() body: unknown,
    @UploadedFile() file: UploadedConfirmationResponseLibraryFile | undefined,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ConfirmationResponseLibraryUploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid confirmation response metadata"
      );
    }
    return this.responseLibrary.upload(parsed.data, file, user, source);
  }

  @Get("print-documents/:confirmationId.pdf")
  async downloadPrintableArtifact(
    @Param("confirmationId") confirmationId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource,
    @Res() response: Response
  ) {
    const file = await this.prints.getPrintableArtifact(
      confirmationId,
      user,
      source
    );
    response.type(file.mimeType);
    response.setHeader(
      "Content-Disposition",
      buildInlineContentDisposition(file.fileName)
    );
    if (file.redirectUrl) {
      return response.redirect(302, file.redirectUrl);
    }
    if (file.body) {
      return response.send(file.body);
    }
    if (!file.absolutePath) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Printable confirmation file is unavailable"
      );
    }
    return response.send(await readFile(file.absolutePath));
  }

  @Get("dispatch-queue/:confirmationId/preview.pdf")
  async previewDispatchArtifact(
    @Param("confirmationId") confirmationId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource,
    @Res() response: Response
  ) {
    const file = await this.prints.getPreviewArtifact(
      confirmationId,
      user,
      source
    );
    response.type(file.mimeType);
    response.setHeader(
      "Content-Disposition",
      buildInlineContentDisposition(file.fileName)
    );
    if (file.redirectUrl) {
      return response.redirect(302, file.redirectUrl);
    }
    if (file.body) {
      return response.send(file.body);
    }
    if (!file.absolutePath) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Confirmation preview is unavailable"
      );
    }
    return response.send(await readFile(file.absolutePath));
  }

  @Get("dispatch-queue")
  listDispatchQueue(
    @Query() query: Record<string, unknown>,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = ConfirmationDispatchQueueQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid queue filters"
      );
    }
    return this.queue.list(parsed.data, user);
  }

  @Post("dispatch-queue/:confirmationId/claim")
  claimDispatchQueue(
    @Param("confirmationId") confirmationId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ClaimConfirmationDispatchQueueSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid queue claim"
      );
    }
    return this.queue.claim(confirmationId, parsed.data, user, source);
  }

  @Post("dispatch-queue/:confirmationId/release")
  releaseDispatchQueue(
    @Param("confirmationId") confirmationId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ReleaseConfirmationDispatchQueueSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid queue release"
      );
    }
    return this.queue.release(confirmationId, parsed.data, user, source);
  }

  @Post("dispatch-queue/:confirmationId/return")
  returnDispatchQueue(
    @Param("confirmationId") confirmationId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ReturnConfirmationDispatchQueueSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid queue return"
      );
    }
    return this.queue.returnToProject(
      confirmationId,
      parsed.data,
      user,
      source
    );
  }

  @Post("dispatch-batches")
  createDispatchBatch(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateConfirmationDispatchBatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid dispatch batch"
      );
    }
    return this.dispatches.createBatch(parsed.data, user, source);
  }

  @Post("dispatch-batches/:batchId/execute")
  executeDispatchBatch(
    @Param("batchId") batchId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ExecuteConfirmationDispatchBatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid dispatch batch execution"
      );
    }
    return this.dispatches.executeBatch(batchId, parsed.data, user, source);
  }

  @Get("dispatch-batches/:batchId")
  getDispatchBatch(
    @Param("batchId") batchId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.dispatches.getBatch(batchId, user);
  }

  @Post("dispatches/:dispatchId/mock-delivery")
  completeMockCourierDelivery(
    @Param("dispatchId") dispatchId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CompleteMockCourierDeliverySchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid mock courier delivery"
      );
    }
    return this.dispatches.completeMockCourierDelivery(
      dispatchId,
      parsed.data,
      user,
      source
    );
  }
}

@UseGuards(AuthGuard)
@Controller("projects")
export class ProjectConfirmationLogisticsController {
  constructor(private readonly confirmations: ProjectConfirmationsService) {}

  @Post(":projectId/confirmations/:confirmationId/logistics-read")
  acknowledgeLogisticsRead(
    @Param("projectId") projectId: string,
    @Param("confirmationId") confirmationId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = z
      .object({ version: z.string().trim().min(1).max(10_000) })
      .strict()
      .safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid logistics read version"
      );
    }
    return this.confirmations.acknowledgeLogisticsRead(
      projectId,
      confirmationId,
      parsed.data.version,
      user
    );
  }
}
