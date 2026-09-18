import { readFile } from "node:fs/promises";

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import {
  ConfirmationEmpImportEligibleProjectsResponseSchema,
  ConfirmationEmpImportJobSchema,
  ConfirmationEmpImportPreviewQuerySchema,
  ConfirmationEmpImportPreviewResponseSchema,
  ConfirmationTypeSchema,
  CorrectProjectConfirmationTrackingSchema,
  CreateConfirmationEmpImportJobSchema,
  CreateProjectConfirmationDispatchSchema,
  CreateProjectConfirmationFollowUpEventSchema,
  CreateProjectConfirmationResponseSchema,
  CreateProjectConfirmationSchema,
  CreateProjectSchema,
  LinkProjectEngagementSchema,
  MoveProjectPlacementSchema,
  PrepareProjectConfirmationDispatchSchema,
  RetryConfirmationEmpImportSchema,
  ReviewProjectConfirmationResponseSchema,
  SubmitProjectConfirmationSchema,
  UpdateProjectConfirmationDraftSchema,
  UpdateProjectConfirmationSchema,
  UpdateProjectSchema,
  WithdrawConfirmationEmpImportSchema,
  WithdrawProjectConfirmationSchema,
  formatNumberWithoutDigitFour,
  normalizeCodeWithoutDigitFour,
} from "@project-wing/shared";
import type { Response } from "express";
import { z } from "zod";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { AuditSource } from "../audit-logs/audit-source.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/request-user";
import { ApiBadRequestException } from "../common/api-error";
import {
  buildAttachmentContentDisposition,
  buildInlineContentDisposition,
} from "../common/file-name";
import { PrismaService } from "../prisma/prisma.service";
import { ConfirmationEmpImportWithdrawalService } from "./confirmation-emp-import-withdrawal.service";
import type {
  ConfirmationEmpImportMode,
  ConfirmationEmpImportPreviewIssue,
  ConfirmationEmpImportPreviewSource,
} from "./confirmation-emp-import.service";
import { ConfirmationEmpImportService } from "./confirmation-emp-import.service";
import { ConfirmationResponseService } from "./confirmation-response.service";
import { ConfirmationSubmissionService } from "./confirmation-submission.service";
import type { UploadedConfirmationFile } from "./confirmation-upload.service";
import { ConfirmationUploadService } from "./confirmation-upload.service";
import { ProjectAccessService } from "./project-access.service";
import { ProjectConfirmationsService } from "./project-confirmations.service";
import { ProjectsService } from "./projects.service";

const UpdateProjectConfirmationDefaultsSchema = z
  .object({
    clientName: z.string().trim().max(500).nullable().optional(),
    confirmationDate: z.string().trim().max(80).nullable().optional(),
    reference: z.string().trim().max(200).nullable().optional(),
    pic: z.string().trim().max(200).nullable().optional(),
    mic: z.string().trim().max(200).nullable().optional(),
    reportDate: z.string().trim().max(80).nullable().optional(),
    baseInformation: z
      .object({
        customFields: z
          .array(
            z
              .object({
                id: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
                name: z.string().trim().min(1).max(100),
                value: z.string().max(10_000),
              })
              .strict()
          )
          .max(200)
          .refine(
            (fields) =>
              new Set(fields.map((field) => field.id)).size === fields.length,
            "Duplicate custom field ID"
          )
          .optional(),
        clientNames: z.array(z.string().trim().max(500)).max(50),
        references: z.array(z.string().trim().max(200)).max(50),
        banks: z
          .array(
            z.object({
              name: z.string().trim().max(500),
              account: z.string().trim().max(200),
              address: z.string().trim().max(1000),
            })
          )
          .max(50),
      })
      .nullable()
      .optional(),
  })
  .strict();

type EmpImportItemLike = {
  id: string;
  sourceConfirmationId?: string | null;
  confirmationId: string;
  sourceFileName?: string | null;
  workingPaperTitle?: string | null;
  status: string;
  withdrawnAt?: Date | string | null;
  targetLocation?: string | null;
  targetCode?: string | null;
  workingPaperCode?: string | null;
  errorMessage?: string | null;
  retryable?: boolean;
  empWorkflowNode?: NodeLike | null;
  workflowNode?: NodeLike | null;
  workingPaper?: PaperLike | null;
  attachment?: AttachmentLike | null;
  [key: string]: unknown;
};
type EmpImportJobLike = {
  id: string;
  projectId: string;
  mode: ConfirmationEmpImportMode;
  status: string;
  total?: number;
  completed?: number;
  failed?: number;
  retryable?: boolean;
  previewFingerprint?: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
  withdrawnAt?: Date | string | null;
  items?: EmpImportItemLike[];
  batchWorkflowNode?: NodeLike | null;
  targetWorkflowNode?: NodeLike | null;
};
type NodeLike = {
  id?: string;
  projectId?: string;
  parentId?: string | null;
  level?: number;
  code?: string | null;
  title?: string | null;
  path?: string | null;
  location?: string | null;
  parent?: NodeLike | null;
};
type PaperLike = {
  id?: string;
  workflowNodeId?: string | null;
  code?: string | null;
  title?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
};
type AttachmentLike = PaperLike & { fileName?: string | null };
type PreviewSkippedLike = {
  existingJobId?: string;
  existingItemId?: string;
  existingMode?: ConfirmationEmpImportMode;
  targetState?: "AVAILABLE" | "RECYCLED" | "MISSING" | "CHANGED" | "UNVERIFIED";
  sourceFileName?: string;
  sourceKey: string;
  confirmationId: string;
  existingWorkingPaperId?: string | null;
  existingAttachmentId?: string | null;
};
type PreviewLike = {
  projectId: string;
  mode: ConfirmationEmpImportMode;
  fingerprint: string;
  sources: ConfirmationEmpImportPreviewSource[];
  skipped: PreviewSkippedLike[];
  issues: ConfirmationEmpImportPreviewIssue[];
};
type PreviewOutputItem = {
  reimportTargetDirectoryId?: string;
  confirmationId: string;
  status: string;
  [key: string]: unknown;
};

@UseGuards(AuthGuard)
@Controller("engagement")
export class ProjectsController {
  constructor(
    @Inject(ProjectsService)
    private readonly projects: ProjectsService,
    @Inject(ProjectConfirmationsService)
    private readonly confirmations: ProjectConfirmationsService,
    @Inject(ConfirmationSubmissionService)
    private readonly confirmationSubmissions: ConfirmationSubmissionService,
    @Inject(ConfirmationResponseService)
    private readonly confirmationResponses: ConfirmationResponseService,
    @Inject(ConfirmationUploadService)
    private readonly confirmationUploads: ConfirmationUploadService,
    @Inject(ConfirmationEmpImportService)
    private readonly confirmationEmpImports: ConfirmationEmpImportService,
    @Inject(ConfirmationEmpImportWithdrawalService)
    private readonly confirmationEmpImportWithdrawals: ConfirmationEmpImportWithdrawalService,
    @Inject(ProjectAccessService)
    private readonly projectAccess: ProjectAccessService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditLogsService)
    private readonly auditLogs: AuditLogsService
  ) {}

  @Post(":id/confirmations/upload")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } })
  )
  uploadConfirmation(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file: UploadedConfirmationFile | undefined,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsedType = ConfirmationTypeSchema.safeParse(body.type);
    if (!parsedType.success || typeof body.counterpartyName !== "string") {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid confirmation upload details"
      );
    }
    return this.confirmationUploads.createFromUpload(
      id,
      parsedType.data,
      body.counterpartyName,
      file,
      user,
      source
    );
  }

  @Post(":id/confirmations/:confirmationId/upload")
  @UseInterceptors(
    FilesInterceptor("file", 20, { limits: { fileSize: 20 * 1024 * 1024 } })
  )
  uploadConfirmationFile(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() file: UploadedConfirmationFile[] | undefined,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    if (typeof body.counterpartyName !== "string") {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid confirmation upload details"
      );
    }
    return this.confirmationUploads.attachToDraft(
      id,
      confirmationId,
      body.counterpartyName,
      file,
      user,
      source
    );
  }

  @Delete(":id/confirmations/:confirmationId/upload")
  removeConfirmationFile(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.confirmationUploads.removeFromDraft(
      id,
      confirmationId,
      user,
      source
    );
  }

  @Delete(":id/confirmations/:confirmationId/content")
  removeConfirmationContent(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.confirmationUploads.removeDraftContent(
      id,
      confirmationId,
      user,
      source
    );
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.projects.list(user);
  }

  @Get("deleted")
  listDeleted(@CurrentUser() user: RequestUser) {
    return this.projects.listDeleted(user);
  }

  @Get("confirmation-emp-imports/eligible-projects")
  async listEligibleConfirmationEmpProjects(@CurrentUser() user: RequestUser) {
    const memberships = await this.prisma.projectMember.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
        project: { status: "ACTIVE" },
      },
      select: {
        project: { select: { id: true, projectCode: true, name: true } },
      },
    });
    const projects: { id: string; code: string; name: string }[] = [];
    for (const membership of memberships) {
      try {
        await this.projectAccess.requireProjectAction(
          membership.project.id,
          user.id,
          "modifyIndex"
        );
        projects.push({
          id: membership.project.id,
          code: membership.project.projectCode,
          name: membership.project.name,
        });
      } catch (error) {
        if (
          error instanceof HttpException &&
          [403, 404].includes(error.getStatus())
        ) {
          continue;
        }
        throw error;
      }
    }
    projects.sort((left, right) => left.code.localeCompare(right.code));
    return ConfirmationEmpImportEligibleProjectsResponseSchema.parse({
      projects,
    });
  }

  @Get(":id/confirmation-emp-imports/preview")
  async previewConfirmationEmpImport(
    @Param("id") id: string,
    @Query() query: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = ConfirmationEmpImportPreviewQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Validation failed"
      );
    }
    await this.projectAccess.requireProjectAction(id, user.id, "modifyIndex");
    const workflowNodes = await this.prisma.workflowNode.findMany({
      where: { projectId: id },
      select: {
        id: true,
        projectId: true,
        parentId: true,
        level: true,
        code: true,
        title: true,
      },
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
    });
    const [fallbackNode] = workflowNodes;
    const targetWorkflowNodeId =
      parsed.data.targetDirectoryId ?? fallbackNode?.id ?? "";
    const confirmationIds = [
      ...new Set([
        ...(parsed.data.confirmationIds ?? []),
        ...(parsed.data.confirmationId ? [parsed.data.confirmationId] : []),
      ]),
    ];
    const preview = await this.confirmationEmpImports.preview(id, user, {
      targetWorkflowNodeId,
      mode: parsed.data.mode,
      ...(confirmationIds.length > 0 ? { confirmationIds } : {}),
      ...(parsed.data.activeLinkKeys
        ? { activeLinkKeys: parsed.data.activeLinkKeys }
        : {}),
    });
    return serializeConfirmationEmpImportPreview(
      preview,
      workflowNodes,
      (parsed.data.targetDirectoryId ?? targetWorkflowNodeId) || null,
      this.prisma
    );
  }

  @Post(":id/confirmation-emp-imports")
  @HttpCode(202)
  async createConfirmationEmpImport(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateConfirmationEmpImportJobSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Validation failed"
      );
    }
    const job = await this.confirmationEmpImports.createJob(
      id,
      user,
      toConfirmationEmpImportCreateInput(parsed.data),
      source
    );
    return serializeConfirmationEmpImportJob(job);
  }

  @Get(":id/confirmation-emp-imports")
  async listConfirmationEmpImports(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser
  ) {
    const jobs = await this.confirmationEmpImports.listJobs(id, user);
    return jobs.map(serializeConfirmationEmpImportJob);
  }

  @Get(":id/confirmation-emp-imports/:jobId")
  async getConfirmationEmpImport(
    @Param("id") id: string,
    @Param("jobId") jobId: string,
    @CurrentUser() user: RequestUser
  ) {
    const job = await this.confirmationEmpImports.getJob(id, user, jobId);
    return serializeConfirmationEmpImportJob(job);
  }

  @Post(":id/confirmation-emp-imports/:jobId/retry")
  @HttpCode(202)
  async retryConfirmationEmpImport(
    @Param("id") id: string,
    @Param("jobId") jobId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = RetryConfirmationEmpImportSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Validation failed"
      );
    }
    const job = await this.confirmationEmpImports.retryJob(
      id,
      user,
      jobId,
      source
    );
    return serializeConfirmationEmpImportJob(job);
  }

  @Post(":id/confirmation-emp-imports/:jobId/withdraw")
  async withdrawConfirmationEmpImport(
    @Param("id") id: string,
    @Param("jobId") jobId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = WithdrawConfirmationEmpImportSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Validation failed"
      );
    }
    const current = await this.confirmationEmpImports.getJob(id, user, jobId);
    if (current.mode !== parsed.data.mode) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "The withdrawal mode does not match the import job."
      );
    }
    const sourceConfirmationId =
      parsed.data.scope === "SOURCE_CONFIRMATION"
        ? parsed.data.sourceConfirmationId
        : undefined;
    const itemId =
      parsed.data.scope === "ITEM" ? parsed.data.itemId : undefined;
    if (itemId) {
      await this.confirmationEmpImportWithdrawals.withdraw(
        id,
        jobId,
        undefined,
        user,
        source,
        undefined,
        parsed.data.force ?? false,
        itemId
      );
    } else if (parsed.data.force) {
      await this.confirmationEmpImportWithdrawals.withdraw(
        id,
        jobId,
        sourceConfirmationId,
        user,
        source,
        undefined,
        true
      );
    } else {
      await this.confirmationEmpImportWithdrawals.withdraw(
        id,
        jobId,
        sourceConfirmationId,
        user,
        source
      );
    }
    return serializeConfirmationEmpImportJob(
      await this.confirmationEmpImports.getJob(id, user, jobId)
    );
  }

  @Post(":id/confirmation-emp-imports/:jobId/restore")
  async restoreConfirmationEmpImport(
    @Param("id") id: string,
    @Param("jobId") jobId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = WithdrawConfirmationEmpImportSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Validation failed"
      );
    }
    const current = await this.confirmationEmpImports.getJob(id, user, jobId);
    if (current.mode !== parsed.data.mode) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "The restore mode does not match the import job."
      );
    }
    await this.confirmationEmpImportWithdrawals.restore(
      id,
      jobId,
      parsed.data.scope === "SOURCE_CONFIRMATION"
        ? {
            scope: "SOURCE_CONFIRMATION",
            sourceConfirmationId: parsed.data.sourceConfirmationId,
          }
        : { scope: "JOB" },
      user,
      source
    );
    return serializeConfirmationEmpImportJob(
      await this.confirmationEmpImports.getJob(id, user, jobId)
    );
  }

  @Post()
  create(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateProjectSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "项目信息不完整或格式无效"
      );
    }
    return this.projects.create(parsed.data, user, source);
  }

  @Get(":id/roll-forward-preview")
  rollForwardPreview(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.projects.rollForwardPreview(id, user);
  }

  @Get(":id/confirmations")
  listConfirmations(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.confirmations.listForProject(id, user);
  }

  @Get(":id/confirmation-defaults")
  getConfirmationDefaults(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.confirmations.getProjectConfirmationDefaults(id, user);
  }

  @Patch(":id/confirmation-defaults")
  updateConfirmationDefaults(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UpdateProjectConfirmationDefaultsSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "函证通用填写信息不完整或格式无效"
      );
    }
    return this.confirmations.updateProjectConfirmationDefaults(
      id,
      parsed.data,
      user,
      source
    );
  }

  @Post(":id/confirmations")
  createConfirmation(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateProjectConfirmationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "函证信息不完整或格式无效"
      );
    }
    return this.confirmations.createForProject(id, parsed.data, user, source);
  }

  @Post(":id/confirmations/:confirmationId/submit")
  submitConfirmation(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = SubmitProjectConfirmationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "函证提交信息不完整或格式无效"
      );
    }
    return this.confirmationSubmissions.submit(
      id,
      confirmationId,
      parsed.data,
      user,
      source
    );
  }

  @Post(":id/confirmations/:confirmationId/withdraw")
  withdrawConfirmation(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = WithdrawProjectConfirmationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "函证撤回信息不完整或格式无效"
      );
    }
    return this.confirmationSubmissions.withdraw(
      id,
      confirmationId,
      parsed.data,
      user,
      source
    );
  }

  @Post(":id/confirmations/:confirmationId/dispatches")
  createConfirmationDispatch(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateProjectConfirmationDispatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "发函信息不完整或格式无效"
      );
    }
    return this.confirmations.createDispatchForConfirmation(
      id,
      confirmationId,
      parsed.data,
      user,
      source
    );
  }

  @Post(":id/confirmations/:confirmationId/dispatches/:dispatchId/attachment")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } })
  )
  uploadConfirmationDispatchAttachment(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Param("dispatchId") dispatchId: string,
    @UploadedFile() file: UploadedConfirmationFile | undefined,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.confirmations.uploadDispatchAttachment(
      id,
      confirmationId,
      dispatchId,
      file,
      user,
      source
    );
  }

  @Post(":id/confirmations/:confirmationId/responses")
  @UseInterceptors(
    FilesInterceptor("files", 20, { limits: { fileSize: 20 * 1024 * 1024 } })
  )
  receiveConfirmationResponse(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: UploadedConfirmationFile[] | undefined,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateProjectConfirmationResponseSchema.safeParse({
      responseChannel: body.responseChannel,
      receivedAt: body.receivedAt,
      responseReference: body.responseReference,
      notes: body.notes,
    });
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "回函登记信息不完整或格式无效"
      );
    }
    return this.confirmationResponses.receive(
      id,
      confirmationId,
      parsed.data,
      files ?? [],
      user,
      source
    );
  }

  @Post(":id/confirmations/:confirmationId/follow-up-events")
  createConfirmationFollowUpEvent(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateProjectConfirmationFollowUpEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "回函跟进信息不完整或格式无效"
      );
    }
    return this.confirmations.createFollowUpEventForConfirmation(
      id,
      confirmationId,
      parsed.data,
      user,
      source
    );
  }

  @Post(":id/confirmations/:confirmationId/review")
  reviewConfirmationResponse(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ReviewProjectConfirmationResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "回函复核信息不完整或格式无效"
      );
    }
    return this.confirmations.reviewProjectConfirmationResponse(
      id,
      confirmationId,
      parsed.data,
      user,
      source
    );
  }

  @Post(":id/confirmations/:confirmationId/redispatch/edit")
  startConfirmationRedispatchEditing(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.confirmations.startRedispatchEditing(
      id,
      confirmationId,
      user,
      source
    );
  }

  @Post(":id/confirmations/:confirmationId/void")
  voidConfirmation(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.confirmations.voidProjectConfirmation(
      id,
      confirmationId,
      user,
      source
    );
  }

  @Post(":id/confirmations/:confirmationId/restore")
  restoreConfirmation(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.confirmations.restoreProjectConfirmation(
      id,
      confirmationId,
      user,
      source
    );
  }

  @Post(":id/confirmations/:confirmationId/review/undo")
  undoConfirmationReview(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.confirmations.undoProjectConfirmationReview(
      id,
      confirmationId,
      user,
      source
    );
  }

  @Post(":id/confirmations/:confirmationId/complete")
  completeConfirmationProgram(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.confirmations.completeConfirmationProgram(
      id,
      confirmationId,
      user,
      source
    );
  }

  @Post(":id/confirmations/:confirmationId/responses/:responseId/artifacts")
  @UseInterceptors(
    FilesInterceptor("files", 20, { limits: { fileSize: 20 * 1024 * 1024 } })
  )
  addConfirmationResponseArtifacts(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Param("responseId") responseId: string,
    @UploadedFiles() files: UploadedConfirmationFile[] | undefined,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.confirmationResponses.addArtifacts(
      id,
      confirmationId,
      responseId,
      files ?? [],
      user,
      source
    );
  }

  @Get(
    ":id/confirmations/:confirmationId/responses/:responseId/artifacts/:artifactId"
  )
  async downloadConfirmationResponseArtifact(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Param("responseId") responseId: string,
    @Param("artifactId") artifactId: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    const file = await this.confirmationResponses.downloadArtifact(
      id,
      confirmationId,
      responseId,
      artifactId,
      user
    );
    return sendProjectInlineFile(response, file);
  }

  @Post(":id/confirmations/:confirmationId/responses/:responseId/withdraw")
  withdrawConfirmationResponse(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Param("responseId") responseId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.confirmationResponses.withdraw(
      id,
      confirmationId,
      responseId,
      user,
      source
    );
  }

  @Patch(":id/confirmations/:confirmationId/dispatches/:dispatchId/tracking")
  correctConfirmationTracking(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Param("dispatchId") dispatchId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CorrectProjectConfirmationTrackingSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "更正物流信息不完整或格式无效"
      );
    }
    return this.confirmations.correctTrackingForConfirmation(
      id,
      confirmationId,
      dispatchId,
      parsed.data,
      user,
      source
    );
  }

  @Post(
    ":id/confirmations/:confirmationId/dispatches/:dispatchId/tracking/refresh"
  )
  refreshConfirmationTracking(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Param("dispatchId") dispatchId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.confirmations.refreshTrackingForConfirmation(
      id,
      confirmationId,
      dispatchId,
      user,
      source
    );
  }

  @Patch(":id/confirmations/:confirmationId/prepared-dispatch")
  prepareConfirmationDispatch(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = PrepareProjectConfirmationDispatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "待发函信息不完整或格式无效"
      );
    }
    return this.confirmations.prepareDispatchForConfirmation(
      id,
      confirmationId,
      parsed.data,
      user,
      source
    );
  }

  @Patch(":id/confirmations/:confirmationId/draft")
  updateConfirmationDraft(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UpdateProjectConfirmationDraftSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "函证草稿信息不完整或格式无效"
      );
    }
    return this.confirmations.updateDraftForProject(
      id,
      confirmationId,
      parsed.data,
      user,
      source
    );
  }

  @Get(":id/confirmations/:confirmationId/preview.pdf")
  async previewConfirmationPdf(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    const file = await this.confirmations.previewPdfForProject(
      id,
      confirmationId,
      user
    );
    return sendProjectInlineFile(response, file);
  }

  @Post(":id/confirmations/:confirmationId/preview.pdf")
  async downloadConfirmationPdf(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    const parsed = UpdateProjectConfirmationDraftSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "函证草稿信息不完整或格式无效"
      );
    }
    const file = await this.confirmations.previewPdfForProject(
      id,
      confirmationId,
      user,
      parsed.data
    );
    return sendProjectInlineFile(response, file);
  }

  @Get(":id/confirmations/:confirmationId/preview.docx")
  async previewConfirmationDocx(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    const file = await this.confirmations.previewDocxForProject(
      id,
      confirmationId,
      user
    );
    return sendProjectInlineFile(response, file);
  }

  @Post(":id/confirmations/:confirmationId/preview.docx")
  async downloadConfirmationDocx(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    const parsed = UpdateProjectConfirmationDraftSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "函证草稿信息不完整或格式无效"
      );
    }
    const file = await this.confirmations.previewDocxForProject(
      id,
      confirmationId,
      user,
      parsed.data
    );
    return sendProjectInlineFile(response, file);
  }

  @Patch(":id/confirmations/:confirmationId")
  updateConfirmation(
    @Param("id") id: string,
    @Param("confirmationId") confirmationId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UpdateProjectConfirmationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "函证信息不完整或格式无效"
      );
    }
    return this.confirmations.updateForProject(
      id,
      confirmationId,
      parsed.data,
      user,
      source
    );
  }

  @Get(":id")
  get(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.projects.get(id, user);
  }

  @Get(":id/archive-check")
  archiveCheck(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.projects.archiveCheck(id, user);
  }

  @Get(":id/archive-check/export.pdf")
  async exportArchiveCheck(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    const file = await this.projects.exportArchiveCheck(id, user);
    response.type(file.mimeType);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(file.fileName)}"`
    );
    return response.send(file.buffer);
  }

  @Post(":id/archive-check-jobs")
  startArchiveCheckJob(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.projects.startArchiveCheckJob(id, user);
  }

  @Get(":id/archive-check-jobs/:jobId")
  archiveCheckJob(
    @Param("id") id: string,
    @Param("jobId") jobId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.projects.archiveCheckJob(id, jobId, user);
  }

  @Post(":id/archive-jobs")
  startArchiveJob(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.projects.startArchiveJob(id, user, source);
  }

  @Get(":id/archive-jobs/:jobId")
  archiveJob(
    @Param("id") id: string,
    @Param("jobId") jobId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.projects.archiveJob(id, jobId, user);
  }

  @Get(":id/archive-jobs/:jobId/events")
  async archiveJobEvents(
    @Param("id") id: string,
    @Param("jobId") jobId: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders?.();

    const initial = await this.projects.archiveJob(id, jobId, user);
    writeArchiveJobEvent(response, initial);
    if (isTerminalArchiveJob(initial)) {
      response.end();
      return;
    }

    let heartbeat: NodeJS.Timeout | undefined;
    let streamClosed = false;
    let unsubscribe: () => void = () => {};
    const cleanup = () => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = undefined;
      }
      unsubscribe();
    };
    const closeStream = () => {
      if (streamClosed) {
        return;
      }
      streamClosed = true;
      cleanup();
      response.end();
    };
    response.on("close", () => {
      streamClosed = true;
      cleanup();
    });
    heartbeat = setInterval(() => {
      response.write(": ping\n\n");
    }, 25_000);

    unsubscribe = this.projects.subscribeArchiveJob(jobId, (job) => {
      if (streamClosed) {
        return;
      }
      writeArchiveJobEvent(response, job);
      if (isTerminalArchiveJob(job)) {
        closeStream();
      }
    });
    if (streamClosed) {
      cleanup();
      return;
    }
    const latest = await this.projects.archiveJob(id, jobId, user);
    if (!streamClosed && archiveJobSnapshotChanged(initial, latest)) {
      writeArchiveJobEvent(response, latest);
      if (isTerminalArchiveJob(latest)) {
        closeStream();
      }
    }
  }

  @Get(":id/archive-artifact")
  archiveArtifact(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.projects.archiveArtifact(id, user);
  }

  @Get(":id/archive-artifact/download")
  async downloadArchiveArtifact(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    const file = await this.projects.downloadArchiveArtifact(id, user);
    if (file.redirectUrl) {
      return response.redirect(302, file.redirectUrl);
    }
    if (!file.absolutePath) {
      throw new ApiBadRequestException("BAD_REQUEST", "文件下载地址无效");
    }
    response.type(file.mimeType);
    return response.download(file.absolutePath, file.fileName);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UpdateProjectSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "椤圭洰淇℃伅涓嶅畬鏁存垨鏍煎紡鏃犳晥"
      );
    }
    return this.projects.update(id, parsed.data, user, source);
  }

  @Post(":id/link-engagement")
  linkEngagement(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = LinkProjectEngagementSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "CMP Client 和 Engagement Code 无效"
      );
    }
    return this.projects.linkEngagement(id, parsed.data, user, source);
  }

  @Delete(":id/link-engagement")
  unlinkEngagement(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.projects.unlinkEngagement(id, user, source);
  }

  @Delete(":id")
  deleteProject(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.projects.deleteProject(id, user, source);
  }

  @Post(":id/restore")
  restoreProject(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.projects.restoreProject(id, user, source);
  }

  @Post(":id/archive")
  archiveExplicit(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.projects.submitArchive(id, user, source);
  }

  @Post(":id/submit-archive")
  archive(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.projects.submitArchive(id, user, source);
  }

  @Post(":id/reopen")
  reopen(
    @Param("id") id: string,
    @Body() _body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.projects.reopen(id, user, source);
  }

  @Post(":id/confirm-archive")
  confirmArchive(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.projects.confirmArchive(id, user, source);
  }

  @Patch(":id/placement")
  movePlacement(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = MoveProjectPlacementSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "Folder 信息无效");
    }
    return this.projects.movePlacement(id, user, parsed.data, source);
  }
}

function toConfirmationEmpImportCreateInput(input: {
  items: { id: string; empCode: string; businessName: string }[];
  batchDirectory?: { code: string; name: string } | null;
  zipWorkingPaper?: { code: string; name: string } | null;
  targetDirectoryId: string;
  mode: ConfirmationEmpImportMode;
  previewFingerprint: string;
  idempotencyKey: string;
}) {
  const sourceOverrides: Record<
    string,
    { paperCode: string; businessName: string; zipEntryName?: string }
  > = {};
  const zipParentCode = input.zipWorkingPaper?.code.trim();
  for (const item of input.items) {
    sourceOverrides[item.id] = {
      paperCode:
        input.mode === "ZIP" ? zipParentCode || item.empCode : item.empCode,
      businessName: item.businessName,
      ...(input.mode === "ZIP"
        ? { zipEntryName: `${item.empCode}-${item.businessName}` }
        : {}),
    };
  }
  const container = input.batchDirectory ?? input.zipWorkingPaper;
  return {
    targetWorkflowNodeId: input.targetDirectoryId,
    mode: input.mode,
    activeLinkKeys: input.items.map((item: { id: string }) => item.id),
    previewFingerprint: input.previewFingerprint,
    idempotencyKey: input.idempotencyKey,
    ...(container
      ? { batchCode: container.code, batchTitle: container.name }
      : {}),
    sourceOverrides,
  };
}

function serializeConfirmationEmpImportJob(job: EmpImportJobLike) {
  const items = job.items ?? [];
  const normalizedItems = items.map((item: EmpImportItemLike) => ({
    id: String(item.id),
    sourceConfirmationId: String(
      item.sourceConfirmationId ?? item.confirmationId
    ),
    confirmationId: String(item.confirmationId),
    sourceFileName: String(
      item.sourceFileName ?? item.workingPaperTitle ?? item.id
    ),
    status:
      item.withdrawnAt === null || item.withdrawnAt === undefined
        ? normalizeEmpImportItemStatus(item.status)
        : "WITHDRAWN",
    targetLocation: targetLocationForJobItem(item, job),
    targetCode: item.targetCode ?? item.workingPaperCode ?? null,
    errorMessage: item.errorMessage ?? null,
    retryable:
      typeof item.retryable === "boolean"
        ? item.retryable
        : normalizeEmpImportItemStatus(item.status) === "FAILED",
  }));
  const completed = normalizedItems.filter(
    (item) => item.status === "COMPLETED"
  ).length;
  const failed = normalizedItems.filter(
    (item) => item.status === "FAILED"
  ).length;
  const allItemsWithdrawn =
    normalizedItems.length > 0 &&
    normalizedItems.every((item) => item.status === "WITHDRAWN");
  const status = allItemsWithdrawn
    ? "WITHDRAWN"
    : normalizeEmpImportJobStatus(job.status);
  const withdrawnAt = job.withdrawnAt
    ? toIsoDate(job.withdrawnAt)
    : allItemsWithdrawn
      ? latestWithdrawnAt(items)
      : null;
  return ConfirmationEmpImportJobSchema.parse({
    id: String(job.id),
    projectId: String(job.projectId),
    mode: job.mode,
    status,
    total: typeof job.total === "number" ? job.total : normalizedItems.length,
    completed: typeof job.completed === "number" ? job.completed : completed,
    failed: typeof job.failed === "number" ? job.failed : failed,
    retryable:
      typeof job.retryable === "boolean"
        ? job.retryable
        : status === "FAILED" || status === "PARTIAL_FAILURE",
    previewFingerprint: String(job.previewFingerprint),
    createdAt: toIsoDate(job.createdAt),
    updatedAt: toIsoDate(job.updatedAt ?? job.createdAt),
    withdrawnAt,
    items: normalizedItems,
  });
}

async function serializeConfirmationEmpImportPreview(
  preview: PreviewLike,
  workflowNodes: {
    id: string;
    projectId: string;
    parentId: string | null;
    level: number;
    code: string;
    title: string;
  }[],
  targetDirectoryId: string | null,
  prisma?: PrismaService
) {
  const { issues, skipped, sources } = preview;
  const [userNames, skippedTargets] = await Promise.all([
    readPreviewUserNames(prisma, sources),
    readSkippedPreviewTargets(prisma, skipped, workflowNodes),
  ]);
  const items: PreviewOutputItem[] = sources.map((source) => {
    const counterparty =
      String(source.counterpartyName ?? "").trim() ||
      String(source.confirmationCode ?? "").trim() ||
      String(source.originalFileName ?? "").trim() ||
      "Unknown counterparty";
    const blockingIssues = issues
      .filter(
        (issue) =>
          issue.sourceKey === source.activeLinkKey ||
          issue.confirmationId === source.confirmationId
      )
      .map((issue) => String(issue.message));
    return {
      id: String(source.activeLinkKey),
      sourceConfirmationId: String(source.confirmationId),
      confirmationId: String(source.confirmationId),
      confirmationCode: source.confirmationCode ?? null,
      counterparty,
      role:
        source.sourceKind === "OUTGOING_ARTIFACT"
          ? "OUTGOING"
          : "RESPONSE_ARTIFACT",
      reimportTargetDirectoryId: source.reimportTargetDirectoryId as
        | string
        | undefined,
      sourceFileName: String(source.originalFileName),
      sourceFileSize: Number(source.fileSize ?? 0),
      sourceProposal: {
        sourceConfirmationId: String(source.confirmationId),
        empCode: String(source.proposedCode ?? source.paperCode),
        businessName: String(source.businessName),
      },
      status: blockingIssues.length > 0 ? "BLOCKED" : "ELIGIBLE",
      signoff: {
        preparerName:
          preview.mode === "ZIP"
            ? null
            : source.prepareUserId
              ? (userNames.get(source.prepareUserId) ?? null)
              : null,
        reviewerName:
          preview.mode === "ZIP"
            ? null
            : source.reviewUserId
              ? (userNames.get(source.reviewUserId) ?? null)
              : null,
        manual: preview.mode === "ZIP",
      },
      zipEntryName: source.zipEntryName ?? null,
      blockingIssues,
    };
  });
  for (const item of skipped) {
    const target = skippedTargets.get(String(item.sourceKey));
    items.push({
      id: String(item.sourceKey),
      sourceConfirmationId: String(item.confirmationId),
      confirmationId: String(item.confirmationId),
      confirmationCode: null,
      counterparty: String(item.confirmationId),
      role: target?.role ?? sourceRoleFromKey(item.sourceKey),
      sourceFileName:
        item.sourceFileName ?? target?.fileName ?? "Existing EMP import",
      existingJobId: item.existingJobId,
      existingItemId: item.existingItemId,
      existingMode: item.existingMode,
      targetState: item.targetState,
      sourceFileSize: target?.fileSize ?? 0,
      sourceProposal: {
        sourceConfirmationId: String(item.confirmationId),
        empCode: target?.code ?? "EMP-IMPORTED",
        businessName:
          target?.title ?? target?.fileName ?? "Existing EMP import",
      },
      status: "IMPORTED",
      existingLocation: target?.location ?? "EMP location unavailable",
      signoff: { manual: preview.mode === "ZIP" },
      zipEntryName: null,
      blockingIssues: [],
    });
  }
  const representedIssueConfirmationIds = new Set(
    items.map((item) => item.confirmationId)
  );
  for (const issue of issues) {
    if (!issue.confirmationId) {
      continue;
    }
    if (representedIssueConfirmationIds.has(String(issue.confirmationId))) {
      continue;
    }
    items.push({
      id: `blocked:${String(issue.confirmationId)}`,
      sourceConfirmationId: String(issue.confirmationId),
      confirmationId: String(issue.confirmationId),
      confirmationCode: null,
      counterparty: String(issue.confirmationId),
      role: "RESPONSE_ARTIFACT",
      sourceFileName: "Unavailable source",
      sourceFileSize: 0,
      sourceProposal: {
        sourceConfirmationId: String(issue.confirmationId),
        empCode: "EMP-BLOCKED",
        businessName: "Unavailable source",
      },
      status: "BLOCKED",
      signoff: { manual: preview.mode === "ZIP" },
      zipEntryName: null,
      blockingIssues: issues
        .filter(
          (candidate) => candidate.confirmationId === issue.confirmationId
        )
        .map((candidate) => String(candidate.message)),
    });
    representedIssueConfirmationIds.add(String(issue.confirmationId));
  }
  const targetDirectories = workflowNodes.map((node) => ({
    id: node.id,
    code: node.code,
    title: node.title,
    path: workflowNodePath(node, workflowNodes),
    level: node.level,
    canAcceptWorkflow: true,
  }));
  const targetNode = workflowNodes.find(
    (node) => node.id === targetDirectoryId
  );
  const fallbackContainerCode = `${normalizeCodeWithoutDigitFour(targetNode?.code ?? "EMP")}-F001`;
  const sourcePaperCode =
    typeof sources[0]?.paperCode === "string" && sources[0].paperCode.trim()
      ? sources[0].paperCode.trim()
      : fallbackContainerCode;
  const containerCode =
    preview.mode === "ZIP"
      ? sourcePaperCode
      : preview.mode === "GROUPED"
        ? nextGroupedImportDirectoryCode(targetNode, workflowNodes)
        : null;
  const result = {
    projectId: String(preview.projectId),
    mode: preview.mode,
    targetDirectoryId,
    targetDirectories,
    batchDirectory:
      preview.mode === "GROUPED"
        ? { code: containerCode, name: "Confirmation responses-Import" }
        : null,
    zipWorkingPaper:
      preview.mode === "ZIP"
        ? { code: containerCode, name: "Confirmation responses-Import.zip" }
        : null,
    counts: {
      eligible: items.filter((item) => item.status === "ELIGIBLE").length,
      imported: items.filter((item) => item.status === "IMPORTED").length,
      blocked: items.filter((item) => item.status === "BLOCKED").length,
    },
    items,
    zipEntries: sources
      .map((source) => source.zipEntryName)
      .filter((entry): entry is string => Boolean(entry)),
    blockers: issues.map((issue) => String(issue.message)),
    fingerprint: String(preview.fingerprint),
  };
  return ConfirmationEmpImportPreviewResponseSchema.parse(result);
}

function nextGroupedImportDirectoryCode(
  targetNode:
    | {
        id: string;
        code: string;
      }
    | undefined,
  workflowNodes: { parentId: string | null; code: string }[]
) {
  const normalizedTargetCode = normalizeCodeWithoutDigitFour(
    targetNode?.code?.trim() || "EMP"
  );
  const prefix = `${normalizedTargetCode}-B`;
  const existingCodes = new Set(
    workflowNodes
      .filter((node) => node.parentId === (targetNode?.id ?? null))
      .map((node) => normalizeCodeWithoutDigitFour(node.code))
  );
  for (let index = 1; ; index += 1) {
    const candidate = `${prefix}${formatNumberWithoutDigitFour(index, 3)}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }
}

async function readPreviewUserNames(
  prisma: PrismaService | undefined,
  sources: ConfirmationEmpImportPreviewSource[]
) {
  const ids = [
    ...new Set(
      sources
        .flatMap((source) => [source.prepareUserId, source.reviewUserId])
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  const model = prisma?.user;
  if (ids.length === 0 || typeof model?.findMany !== "function") {
    return new Map<string, string>();
  }
  const rows = await model.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(
    rows.map((row: { id: string; name: string }) => [row.id, row.name])
  );
}

type SkippedPreviewTarget = {
  code: string | null;
  title: string | null;
  location: string | null;
  fileName: string | null;
  fileSize: number;
  role: "OUTGOING" | "RESPONSE_ARTIFACT";
};

async function readSkippedPreviewTargets(
  prisma: PrismaService | undefined,
  skipped: PreviewSkippedLike[],
  workflowNodes: {
    id: string;
    parentId: string | null;
    code: string;
    title: string;
  }[]
) {
  const paperIds = [
    ...new Set(
      skipped
        .map((item) => item.existingWorkingPaperId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  const attachmentIds = [
    ...new Set(
      skipped
        .map((item) => item.existingAttachmentId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  const paperModel = prisma?.workingPaper;
  const attachmentModel = prisma?.attachment;
  const [papers, attachments] = await Promise.all([
    paperIds.length > 0 && typeof paperModel?.findMany === "function"
      ? paperModel.findMany({
          where: { id: { in: paperIds } },
          select: {
            id: true,
            code: true,
            title: true,
            workflowNodeId: true,
          },
        })
      : [],
    attachmentIds.length > 0 && typeof attachmentModel?.findMany === "function"
      ? attachmentModel.findMany({
          where: { id: { in: attachmentIds } },
          select: {
            id: true,
            code: true,
            title: true,
            fileName: true,
            workflowNodeId: true,
          },
        })
      : [],
  ]);
  const papersById = new Map<string, PaperLike>(
    papers.map((paper) => [paper.id, paper] as [string, PaperLike])
  );
  const attachmentsById = new Map<string, AttachmentLike>(
    attachments.map(
      (attachment) => [attachment.id, attachment] as [string, AttachmentLike]
    )
  );
  const nodesById = new Map(workflowNodes.map((node) => [node.id, node]));
  const result = new Map<string, SkippedPreviewTarget>();
  for (const item of skipped) {
    const paper = papersById.get(item.existingWorkingPaperId ?? "");
    const attachment = attachmentsById.get(item.existingAttachmentId ?? "");
    const node = nodesById.get(
      attachment?.workflowNodeId ?? paper?.workflowNodeId ?? ""
    );
    result.set(String(item.sourceKey), {
      code: attachment?.code ?? paper?.code ?? null,
      title: attachment?.title ?? paper?.title ?? null,
      location: node ? workflowNodePath(node, workflowNodes) : null,
      fileName: attachment?.fileName ?? null,
      fileSize: Number(attachment?.fileSize ?? 0),
      role: sourceRoleFromKey(item.sourceKey),
    });
  }
  return result;
}

function sourceRoleFromKey(value: unknown): "OUTGOING" | "RESPONSE_ARTIFACT" {
  return String(value).startsWith("RESPONSE_ARTIFACT:")
    ? "RESPONSE_ARTIFACT"
    : "OUTGOING";
}

function targetLocationForJobItem(
  item: EmpImportItemLike,
  job: EmpImportJobLike
) {
  if (typeof item.targetLocation === "string" && item.targetLocation.trim()) {
    return item.targetLocation;
  }
  if (typeof item.location === "string" && item.location.trim()) {
    return item.location;
  }
  const node =
    item.empWorkflowNode ??
    item.workflowNode ??
    job.batchWorkflowNode ??
    job.targetWorkflowNode;
  const nodeLocation = nodeLocationFromUnknown(node);
  const code = String(
    item.workingPaperCode ?? item.attachment?.code ?? item.code ?? ""
  ).trim();
  if (nodeLocation && code) {
    return `${nodeLocation} / ${code}`;
  }
  if (nodeLocation) {
    return nodeLocation;
  }
  if (code) {
    return code;
  }
  return "EMP / target unavailable";
}

function nodeLocationFromUnknown(node: NodeLike | null | undefined) {
  if (!node || typeof node !== "object") {
    return "";
  }
  if (typeof node.path === "string" && node.path.trim()) {
    return node.path.trim();
  }
  if (typeof node.location === "string" && node.location.trim()) {
    return node.location.trim();
  }
  const parts: string[] = [];
  let current: NodeLike | null | undefined = node;
  let guard = 0;
  while (current && guard < 16) {
    const code = typeof current.code === "string" ? current.code.trim() : "";
    const title = typeof current.title === "string" ? current.title.trim() : "";
    if (code || title) {
      parts.unshift(`${code} ${title}`.trim());
    }
    current = current.parent;
    guard += 1;
  }
  return parts.join(" / ");
}

function latestWithdrawnAt(items: EmpImportItemLike[]) {
  const dates = items
    .map((item) => item.withdrawnAt)
    .filter(
      (value): value is Date | string =>
        value instanceof Date || typeof value === "string"
    )
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));
  return dates.length > 0
    ? new Date(Math.max(...dates)).toISOString()
    : new Date(0).toISOString();
}

function workflowNodePath(
  node: {
    id: string;
    parentId: string | null;
    code: string;
    title: string;
  },
  nodes: {
    id: string;
    parentId: string | null;
    code: string;
    title: string;
  }[]
) {
  const byId = new Map(nodes.map((candidate) => [candidate.id, candidate]));
  const parts: string[] = [];
  let current: typeof node | undefined = node;
  let guard = 0;
  while (current && guard < 16) {
    parts.unshift(`${current.code} ${current.title}`.trim());
    current = current.parentId ? byId.get(current.parentId) : undefined;
    guard += 1;
  }
  return parts.join(" / ");
}

function normalizeEmpImportItemStatus(value: unknown) {
  return value === "SUCCEEDED" ? "COMPLETED" : value;
}

function normalizeEmpImportJobStatus(value: unknown) {
  return value === "SUCCEEDED" ? "COMPLETED" : value;
}

function toIsoDate(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return new Date(value).toISOString();
  }
  return new Date(0).toISOString();
}

function writeArchiveJobEvent(
  response: Response,
  job: {
    jobId: string;
    projectId?: string;
    status: string;
    currentPhase?: string;
    currentLabel?: string;
    progress?: unknown;
    artifact?: unknown;
    error?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
  }
) {
  response.write(`event: archive-job\ndata: ${JSON.stringify(job)}\n\n`);
}

function isTerminalArchiveJob(job: { status: string }) {
  return job.status === "completed" || job.status === "failed";
}

function archiveJobSnapshotChanged(
  previous: { status: string; updatedAt?: unknown },
  next: { status: string; updatedAt?: unknown }
) {
  return (
    previous.status !== next.status ||
    String(previous.updatedAt ?? "") !== String(next.updatedAt ?? "")
  );
}

async function sendProjectInlineFile(
  response: Response,
  file: {
    mimeType: string;
    fileName: string;
    body?: Buffer;
    absolutePath?: string;
    redirectUrl?: string;
  }
) {
  const isPdf = file.mimeType.trim().toLowerCase() === "application/pdf";
  const safeMimeType = isPdf ? "application/pdf" : "application/octet-stream";
  response.type(safeMimeType);
  response.setHeader(
    "Content-Disposition",
    isPdf
      ? buildInlineContentDisposition(file.fileName)
      : buildAttachmentContentDisposition(file.fileName)
  );
  if (!isPdf) {
    response.setHeader("X-Content-Type-Options", "nosniff");
  }
  if (file.body) {
    return response.send(file.body);
  }
  if (file.redirectUrl) {
    return response.redirect(302, file.redirectUrl);
  }
  if (!file.absolutePath) {
    throw new ApiBadRequestException("BAD_REQUEST", "文件预览地址无效");
  }
  try {
    return response.send(await readFile(file.absolutePath));
  } catch {
    throw new ApiBadRequestException("BAD_REQUEST", "文件预览地址无效");
  }
}
