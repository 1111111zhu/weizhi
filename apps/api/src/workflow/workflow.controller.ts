import { readFile } from "node:fs/promises";

import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  AttachWorkingPaperQuestionMessageSchema,
  ConfirmAttachmentUploadSchema,
  ConfirmAttachmentVersionUploadSchema,
  CreateAttachmentPlaceholderSchema,
  CreateProjectFileExportJobSchema,
  CreateWorkflowNodeSchema,
  CreateWorkingPaperQuestionSchema,
  CreateWorkingPaperSchema,
  FollowUpWorkingPaperQuestionSchema,
  RelocateAttachmentSchema,
  RenameAttachmentSchema,
  ReorderWorkingPaperAttachmentsSchema,
  ReplyWorkingPaperQuestionSchema,
  RequestAttachmentUploadUrlSchema,
  RequestAttachmentVersionUploadUrlSchema,
  RequestReviewQuestionImageUploadUrlSchema,
  ResolveAttachmentConflictSchema,
  RestoreAttachmentSchema,
  ReturnWorkingPaperSchema,
  RevokeWorkingPaperSignoffSchema,
  UpdateAttachmentIdentitySchema,
  UpdateWorkflowNodeSchema,
  UpdateWorkingPaperAssigneesSchema,
  UpdateWorkingPaperSchema,
  UploadAttachmentSchema,
  UploadAttachmentVersionSchema,
  ZipMasterOperationSchema,
} from "@project-wing/shared";
import type { ProjectFileExportJob } from "@project-wing/shared";
import type { Request, Response } from "express";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditSource } from "../audit-logs/audit-source.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/request-user";
import { ApiBadRequestException } from "../common/api-error";
import { externalRequestContextFromRequest } from "../common/external-request-context";
import {
  buildAttachmentContentDisposition,
  buildInlineContentDisposition,
} from "../common/file-name";
import { ProjectFileExportJobService } from "./project-file-export-job.service";
import { WorkflowService } from "./workflow.service";
import type {
  AttachmentExportFormat,
  UploadedWorkflowFile,
} from "./workflow.service";
import { ZipMasterService } from "./zip-master.service";
import type { ZipMasterOperationInput } from "./zip-master.service";

export {
  asBodyRecord,
  decimalStringBody,
  parseDesktopUploadCompleteInput,
  parseDesktopUploadPrepareInput,
  parseDirectCommitMetadata,
  positiveIntegerBody,
  stringBody,
} from "./workflow-controller-input";

const PREVIEW_BLOB_ACCEPT = "application/vnd.project-wing.preview";
const PREVIEW_BLOB_MIME = "application/vnd.project-wing.preview";

@UseGuards(AuthGuard)
@Controller("engagement/:projectId/workflow")
export class WorkflowController {
  constructor(
    private readonly workflow: WorkflowService,
    private readonly zipMaster: ZipMasterService,
    private readonly fileExports: ProjectFileExportJobService
  ) {}

  @Get()
  tree(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.workflow.tree(projectId, user);
  }

  @Post("nodes")
  createNode(
    @Param("projectId") projectId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateWorkflowNodeSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "组或底稿信息无效");
    }
    return this.workflow.createNode(projectId, user, parsed.data, source);
  }

  @Delete("nodes/:nodeId")
  deleteNode(
    @Param("projectId") projectId: string,
    @Param("nodeId") nodeId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.workflow.deleteNode(projectId, nodeId, user, source);
  }

  @Patch("nodes/:nodeId")
  updateNode(
    @Param("projectId") projectId: string,
    @Param("nodeId") nodeId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = UpdateWorkflowNodeSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "组或底稿信息无效");
    }
    return this.workflow.updateNode(projectId, nodeId, user, parsed.data);
  }

  @Post("working-papers")
  createWorkingPaper(
    @Param("projectId") projectId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateWorkingPaperSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "底稿信息无效");
    }
    return this.workflow.createWorkingPaper(
      projectId,
      user,
      parsed.data,
      source
    );
  }

  @Get("working-papers/:paperId")
  getWorkingPaper(
    @Param("projectId") projectId: string,
    @Param("paperId") paperId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.workflow.getWorkingPaper(projectId, paperId, user);
  }

  @Patch("working-papers/:paperId")
  updateWorkingPaper(
    @Param("projectId") projectId: string,
    @Param("paperId") paperId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UpdateWorkingPaperSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "搴曠淇℃伅鏃犳晥");
    }
    return this.workflow.updateWorkingPaper(
      projectId,
      paperId,
      user,
      parsed.data,
      source
    );
  }

  @Patch("working-papers/:paperId/assignees")
  updateWorkingPaperAssignees(
    @Param("projectId") projectId: string,
    @Param("paperId") paperId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UpdateWorkingPaperAssigneesSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "底稿负责人无效");
    }
    return this.workflow.updateWorkingPaperAssignees(
      projectId,
      paperId,
      user,
      parsed.data,
      source
    );
  }

  @Delete("working-papers/:paperId")
  deleteWorkingPaper(
    @Param("projectId") projectId: string,
    @Param("paperId") paperId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.workflow.deleteWorkingPaper(projectId, paperId, user, source);
  }

  @Post("working-papers/:paperId/attachments")
  @UseInterceptors(FileInterceptor("file"))
  uploadAttachment(
    @Param("projectId") projectId: string,
    @Param("paperId") paperId: string,
    @Body() body: unknown,
    @UploadedFile() file: UploadedWorkflowFile,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UploadAttachmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "附件类型无效");
    }
    return this.workflow.uploadAttachment(
      projectId,
      paperId,
      user,
      parsed.data,
      file,
      source
    );
  }

  @Post("working-papers/:paperId/attachments/placeholders")
  createAttachmentPlaceholder(
    @Param("projectId") projectId: string,
    @Param("paperId") paperId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateAttachmentPlaceholderSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Placeholder information is invalid"
      );
    }
    return this.workflow.createAttachmentPlaceholder(
      projectId,
      paperId,
      user,
      parsed.data,
      source
    );
  }

  @Post("working-papers/:paperId/attachments/upload-url")
  createAttachmentUploadGrant(
    @Param("projectId") projectId: string,
    @Param("paperId") paperId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = RequestAttachmentUploadUrlSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "附件上传信息无效");
    }
    return this.workflow.createAttachmentUploadGrant(
      projectId,
      paperId,
      user,
      parsed.data
    );
  }

  @Post("working-papers/:paperId/attachments/confirm")
  confirmAttachmentUpload(
    @Param("projectId") projectId: string,
    @Param("paperId") paperId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ConfirmAttachmentUploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "附件上传确认信息无效"
      );
    }
    return this.workflow.confirmAttachmentUpload(
      projectId,
      paperId,
      user,
      parsed.data,
      source
    );
  }

  @Get("deleted-attachments")
  deletedAttachments(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.workflow.deletedAttachments(projectId, user);
  }

  @Get("attachments")
  projectAttachments(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.workflow.projectAttachments(projectId, user);
  }

  @Patch("attachments/order")
  reorderWorkingPaperAttachments(
    @Param("projectId") projectId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ReorderWorkingPaperAttachmentsSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "附件排序信息无效");
    }
    return this.workflow.reorderWorkingPaperAttachments(
      projectId,
      user,
      parsed.data,
      source
    );
  }

  @Delete("attachments/:attachmentId")
  deleteAttachment(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.workflow.deleteAttachment(
      projectId,
      attachmentId,
      user,
      source
    );
  }

  @Patch("attachments/:attachmentId")
  renameAttachment(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = RenameAttachmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "鏂囦欢鍚嶇О鏃犳晥"
      );
    }
    return this.workflow.renameAttachment(
      projectId,
      attachmentId,
      user,
      parsed.data,
      source
    );
  }

  @Patch("attachments/:attachmentId/identity")
  updateAttachmentIdentity(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UpdateAttachmentIdentitySchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "文件编号信息无效");
    }
    return this.workflow.updateAttachmentIdentity(
      projectId,
      attachmentId,
      user,
      parsed.data,
      source
    );
  }

  @Post("attachments/:attachmentId/move")
  moveAttachment(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = RelocateAttachmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "鐩爣搴曠鏃犳晥");
    }
    return this.workflow.moveAttachment(
      projectId,
      attachmentId,
      user,
      parsed.data,
      source
    );
  }

  @Post("attachments/:attachmentId/copy")
  copyAttachment(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = RelocateAttachmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "鐩爣搴曠鏃犳晥");
    }
    return this.workflow.copyAttachment(
      projectId,
      attachmentId,
      user,
      parsed.data,
      source
    );
  }

  @Post("attachments/:attachmentId/restore")
  restoreAttachment(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = RestoreAttachmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "恢复目标无效");
    }
    return this.workflow.restoreAttachment(
      projectId,
      attachmentId,
      user,
      parsed.data,
      source
    );
  }

  @Get("attachments/:attachmentId/preview")
  async previewAttachment(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Query("sheet") sheet: string | undefined,
    @Query("offset") offset: string | undefined,
    @Query("limit") limit: string | undefined,
    @Query("column") column: string | undefined,
    @Query("columns") columns: string | undefined,
    @Query("row") row: string | undefined,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) response?: Response
  ) {
    const startedAt = performance.now();
    const preview = await this.workflow.previewAttachment(
      projectId,
      attachmentId,
      user,
      {
        sheetIndex: parseIntegerQuery(sheet),
        offset: parseIntegerQuery(offset),
        limit: parseIntegerQuery(limit),
        columnOffset: parseIntegerQuery(column),
        columnLimit: parseIntegerQuery(columns),
        targetRow: parseIntegerQuery(row),
      }
    );
    setPreviewServerTiming(response, startedAt);
    return preview;
  }

  @Get("attachments/:attachmentId/preview-search")
  previewAttachmentSearch(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Query("q") query: string | undefined,
    @CurrentUser() user: RequestUser
  ) {
    return this.workflow.searchAttachmentPreview(
      projectId,
      attachmentId,
      user,
      query ?? ""
    );
  }

  @Get("attachments/:attachmentId/preview-pdf")
  async previewAttachmentPdf(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response,
    @Headers("accept") accept?: string,
    @Headers("if-none-match") ifNoneMatch?: string,
    @Query("version") version?: string
  ) {
    const startedAt = performance.now();
    const file = await this.workflow.previewAttachmentPdf(
      projectId,
      attachmentId,
      user,
      ifNoneMatch,
      parseIntegerQuery(version)
    );
    setPreviewServerTiming(response, startedAt);
    return sendWorkflowInlineFile(response, file, {
      includeContentDisposition: !usesPreviewBlobTransport(accept),
      responseMimeType: usesPreviewBlobTransport(accept)
        ? PREVIEW_BLOB_MIME
        : undefined,
    });
  }

  @Get("attachments/:attachmentId/preview-pdf/pages")
  async previewAttachmentRasterPdfManifest(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) response?: Response
  ) {
    const startedAt = performance.now();
    const manifest = await this.workflow.previewAttachmentRasterPdfManifest(
      projectId,
      attachmentId,
      user
    );
    setPreviewServerTiming(response, startedAt);
    return manifest;
  }

  @Get("attachments/:attachmentId/preview-pdf/pages/:pageNumber")
  async previewAttachmentRasterPdfPage(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Param("pageNumber") pageNumber: string,
    @Query("dpi") dpi: string | undefined,
    @Query("version") version: string | undefined,
    @CurrentUser() user: RequestUser,
    @Res() response: Response,
    @Headers("if-none-match") ifNoneMatch?: string
  ) {
    const startedAt = performance.now();
    const parsedPageNumber = parseIntegerQuery(pageNumber);
    if (!parsedPageNumber) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "PDF preview page is invalid"
      );
    }
    const file = await this.workflow.previewAttachmentRasterPdfPage(
      projectId,
      attachmentId,
      user,
      {
        pageNumber: parsedPageNumber,
        dpi: parseIntegerQuery(dpi),
      },
      ifNoneMatch,
      parseIntegerQuery(version)
    );
    setPreviewServerTiming(response, startedAt);
    return sendWorkflowInlineFile(response, file);
  }

  @Get("attachments/:attachmentId/preview-pdf/:displayName")
  async previewAttachmentPdfWithDisplayName(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response,
    @Headers("if-none-match") ifNoneMatch?: string,
    @Query("version") version?: string
  ) {
    const startedAt = performance.now();
    const file = await this.workflow.previewAttachmentPdf(
      projectId,
      attachmentId,
      user,
      ifNoneMatch,
      parseIntegerQuery(version)
    );
    setPreviewServerTiming(response, startedAt);
    return sendWorkflowInlineFile(response, file, {
      includeContentDisposition: false,
    });
  }

  @Get("attachments/:attachmentId/history")
  attachmentHistory(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.workflow.attachmentHistory(projectId, attachmentId, user);
  }

  @Post("attachments/:attachmentId/lock")
  lockAttachment(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.workflow.lockAttachment(projectId, attachmentId, user, source);
  }

  @Post("attachments/:attachmentId/master/open")
  openAttachmentMaster(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource,
    @Req() request: Request
  ) {
    return this.workflow.openAttachmentMaster(
      projectId,
      attachmentId,
      user,
      externalRequestContextFromRequest(request),
      source
    );
  }

  @Post("attachments/:attachmentId/zip-master/open")
  openZipMaster(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.zipMaster.openMaster(projectId, attachmentId, user, source);
  }

  @Get("attachments/:attachmentId/zip/read")
  readZip(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.zipMaster.readOnly(projectId, attachmentId, user);
  }

  @Get("attachments/:attachmentId/zip/entries/download")
  async downloadZipEntryReadOnly(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Query("path") entryPath: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    const file = await this.zipMaster.downloadReadOnlyEntry(
      projectId,
      attachmentId,
      entryPath,
      user
    );
    return sendWorkflowDownload(response, file);
  }

  @Post("zip-master-sessions/:sessionId/entries/master/open")
  openZipEntryMaster(
    @Param("projectId") projectId: string,
    @Param("sessionId") sessionId: string,
    @Body() body: Record<string, string | undefined>,
    @CurrentUser() user: RequestUser,
    @Req() request: Request
  ) {
    const entryPath = body.entryPath?.trim();
    if (!entryPath) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Zip entry path is required."
      );
    }
    return this.zipMaster.openEntryMaster(
      projectId,
      sessionId,
      entryPath,
      user,
      externalRequestContextFromRequest(request)
    );
  }

  @Get("zip-master-sessions/:sessionId/entries/download")
  async downloadZipSessionEntry(
    @Param("projectId") projectId: string,
    @Param("sessionId") sessionId: string,
    @Query("path") entryPath: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    const file = await this.zipMaster.downloadSessionEntry(
      projectId,
      sessionId,
      entryPath,
      user
    );
    return sendWorkflowDownload(response, file);
  }

  @Post("zip-master-sessions/:sessionId/operations")
  @UseInterceptors(FileInterceptor("file"))
  addZipOperation(
    @Param("projectId") projectId: string,
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
    @UploadedFile() file: UploadedWorkflowFile,
    @CurrentUser() user: RequestUser
  ) {
    return this.zipMaster.addOperation(
      projectId,
      sessionId,
      user,
      parseZipOperationBody(body),
      file
    );
  }

  @Post("zip-master-sessions/:sessionId/close")
  closeZipMaster(
    @Param("projectId") projectId: string,
    @Param("sessionId") sessionId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.zipMaster.close(projectId, sessionId, user, source);
  }

  @Post("zip-master-sessions/:sessionId/discard")
  discardZipMaster(
    @Param("projectId") projectId: string,
    @Param("sessionId") sessionId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.zipMaster.discard(projectId, sessionId, user, source);
  }

  @Post("attachments/:attachmentId/master/recover")
  recoverAttachmentMaster(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource,
    @Req() request: Request
  ) {
    return this.workflow.recoverAttachmentMaster(
      projectId,
      attachmentId,
      user,
      externalRequestContextFromRequest(request),
      source
    );
  }

  @Post("attachments/:attachmentId/master/force-release")
  forceReleaseAttachmentMaster(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.workflow.forceReleaseAttachmentMaster(
      projectId,
      attachmentId,
      user,
      source
    );
  }

  @Post("attachments/:attachmentId/unlock")
  unlockAttachment(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.workflow.unlockAttachment(
      projectId,
      attachmentId,
      user,
      source
    );
  }

  @Post("attachments/:attachmentId/new-version")
  @UseInterceptors(FileInterceptor("file"))
  uploadNewAttachmentVersion(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Body() body: unknown,
    @UploadedFile() file: UploadedWorkflowFile,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UploadAttachmentVersionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "鏂囦欢宸ヤ綔鏃ユ湡鏃犳晥"
      );
    }
    return this.workflow.uploadNewAttachmentVersion(
      projectId,
      attachmentId,
      user,
      file,
      parsed.data,
      source
    );
  }

  @Post("attachments/:attachmentId/replace")
  @UseInterceptors(FileInterceptor("file"))
  replaceAttachmentPlaceholder(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @UploadedFile() file: UploadedWorkflowFile,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.workflow.replaceAttachmentPlaceholder(
      projectId,
      attachmentId,
      user,
      file,
      source
    );
  }

  @Post("attachments/:attachmentId/replace/upload-url")
  createAttachmentPlaceholderUploadGrant(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = RequestAttachmentVersionUploadUrlSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Placeholder replacement upload information is invalid"
      );
    }
    return this.workflow.createAttachmentPlaceholderUploadGrant(
      projectId,
      attachmentId,
      user,
      parsed.data
    );
  }

  @Post("attachments/:attachmentId/replace/confirm")
  confirmAttachmentPlaceholderUpload(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ConfirmAttachmentVersionUploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Placeholder replacement confirmation is invalid"
      );
    }
    return this.workflow.confirmAttachmentPlaceholderUpload(
      projectId,
      attachmentId,
      user,
      parsed.data,
      source
    );
  }

  @Post("attachments/:attachmentId/new-version/upload-url")
  createAttachmentVersionUploadGrant(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = RequestAttachmentVersionUploadUrlSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "文件新版本上传信息无效"
      );
    }
    return this.workflow.createAttachmentVersionUploadGrant(
      projectId,
      attachmentId,
      user,
      parsed.data
    );
  }

  @Post("attachments/:attachmentId/new-version/confirm")
  confirmAttachmentVersionUpload(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ConfirmAttachmentVersionUploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "文件新版本上传确认信息无效"
      );
    }
    return this.workflow.confirmAttachmentVersionUpload(
      projectId,
      attachmentId,
      user,
      parsed.data,
      source
    );
  }

  @Get("attachments/:attachmentId/versions/:versionId/download")
  async downloadAttachmentVersion(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Param("versionId") versionId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource,
    @Res() response: Response
  ) {
    const file = await this.workflow.downloadAttachmentVersion(
      projectId,
      attachmentId,
      versionId,
      user,
      source
    );
    return sendWorkflowFile(response, file);
  }

  @Get("attachments/:attachmentId/download-readonly")
  async downloadAttachmentReadOnly(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource,
    @Res() response: Response
  ) {
    const file = await this.workflow.downloadAttachmentReadOnly(
      projectId,
      attachmentId,
      user,
      source
    );
    return sendWorkflowFile(response, file);
  }

  @Get("attachments/:attachmentId/export")
  async exportAttachment(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Query("format") formatValue: string | undefined,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource,
    @Res() response: Response
  ) {
    const format = parseAttachmentExportFormat(formatValue);
    const file = await this.workflow.exportAttachment(
      projectId,
      attachmentId,
      format,
      user,
      source
    );
    return sendWorkflowFile(response, file);
  }

  @Post("export-jobs")
  createFileExportJob(
    @Param("projectId") projectId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateProjectFileExportJobSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "The export selection is invalid."
      );
    }
    return this.fileExports.createJob(projectId, user, parsed.data, source);
  }

  @Get("export-jobs/active")
  activeFileExportJob(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.fileExports.getActiveJob(projectId, user);
  }

  @Get("export-jobs/:jobId")
  fileExportJob(
    @Param("projectId") projectId: string,
    @Param("jobId") jobId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.fileExports.getJob(projectId, jobId, user);
  }

  @Post("export-jobs/:jobId/retry")
  retryFileExportJob(
    @Param("projectId") projectId: string,
    @Param("jobId") jobId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.fileExports.retryJob(projectId, jobId, user, source);
  }

  @Get("export-jobs/:jobId/events")
  async fileExportJobEvents(
    @Param("projectId") projectId: string,
    @Param("jobId") jobId: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    const initial = await this.fileExports.getJob(projectId, jobId, user);
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders?.();

    writeFileExportJobEvent(response, initial);
    if (isTerminalFileExportJob(initial.status)) {
      response.end();
      return;
    }

    let closed = false;
    let lastUpdatedAt = initial.updatedAt;
    let polling = false;
    const heartbeat = setInterval(() => response.write(": ping\n\n"), 25_000);
    const poll = async () => {
      if (closed || polling) {
        return;
      }
      polling = true;
      try {
        const latest = await this.fileExports.getJob(projectId, jobId, user);
        if (closed || latest.updatedAt === lastUpdatedAt) {
          return;
        }
        lastUpdatedAt = latest.updatedAt;
        writeFileExportJobEvent(response, latest);
        if (isTerminalFileExportJob(latest.status)) {
          close();
        }
      } catch {
        close();
      } finally {
        polling = false;
      }
    };
    const databasePoll = setInterval(() => {
      poll().catch(() => {});
    }, 2000);
    let unsubscribe: () => void = () => {};
    const cleanup = () => {
      clearInterval(heartbeat);
      clearInterval(databasePoll);
      unsubscribe();
    };
    const close = () => {
      if (closed) {
        return;
      }
      closed = true;
      cleanup();
      response.end();
    };
    response.on("close", () => {
      closed = true;
      cleanup();
    });
    unsubscribe = this.fileExports.subscribe(jobId, (job) => {
      if (closed) {
        return;
      }
      lastUpdatedAt = job.updatedAt;
      writeFileExportJobEvent(response, job);
      if (isTerminalFileExportJob(job.status)) {
        close();
      }
    });
    await poll();
  }

  @Get("export-jobs/:jobId/download")
  async downloadFileExportJob(
    @Param("projectId") projectId: string,
    @Param("jobId") jobId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource,
    @Res() response: Response
  ) {
    const file = await this.fileExports.openDownload(projectId, jobId, user);
    response.setHeader("Content-Type", "application/zip");
    response.setHeader(
      "Content-Disposition",
      buildAttachmentContentDisposition(file.fileName)
    );
    if (file.fileSize > 0) {
      response.setHeader("Content-Length", file.fileSize);
    }
    let finished = false;
    response.on("finish", () => {
      finished = true;
      void this.fileExports.completeDownload(projectId, jobId, user, source);
    });
    response.on("close", () => {
      if (!finished) {
        file.stream.destroy();
      }
    });
    file.stream.on("error", (error) => response.destroy(error));
    file.stream.pipe(response);
  }

  @Get("attachments/:attachmentId/preview-content")
  async previewAttachmentContent(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource,
    @Res() response: Response,
    @Headers("accept") accept?: string,
    @Query("version") version?: string
  ) {
    const startedAt = performance.now();
    const file = await this.workflow.previewAttachmentContent(
      projectId,
      attachmentId,
      user,
      source,
      ifNoneMatch,
      parseIntegerQuery(version)
    );
    setPreviewServerTiming(response, startedAt);
    return sendWorkflowInlineFile(response, file, {
      includeContentDisposition: !usesPreviewBlobTransport(accept),
      responseMimeType:
        usesPreviewBlobTransport(accept) && file.mimeType === "application/pdf"
          ? PREVIEW_BLOB_MIME
          : undefined,
    });
  }

  @Get("attachments/:attachmentId/master/download")
  async downloadAttachmentForActiveMaster(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource,
    @Res() response: Response
  ) {
    const file = await this.workflow.downloadAttachmentForActiveMaster(
      projectId,
      attachmentId,
      user,
      source
    );
    return sendWorkflowFile(response, file);
  }

  @Post("attachments/:attachmentId/versions/:versionId/restore")
  restoreAttachmentVersion(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Param("versionId") versionId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.workflow.restoreAttachmentVersion(
      projectId,
      attachmentId,
      versionId,
      user,
      source
    );
  }

  @Get("attachments/:attachmentId/conflicts")
  listAttachmentConflicts(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.workflow.listAttachmentConflicts(projectId, attachmentId, user);
  }

  @Post("attachments/:attachmentId/conflicts/:candidateVersionId/resolve")
  resolveAttachmentConflict(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Param("candidateVersionId") candidateVersionId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ResolveAttachmentConflictSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "The conflict resolution is invalid."
      );
    }
    return this.workflow.resolveAttachmentConflict(
      projectId,
      attachmentId,
      candidateVersionId,
      parsed.data.resolution,
      user,
      source
    );
  }

  @Get("attachments/:attachmentId/download")
  async downloadAttachment(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource,
    @Res() response: Response
  ) {
    const file = await this.workflow.downloadAttachment(
      projectId,
      attachmentId,
      user,
      source
    );
    return sendWorkflowFile(response, file);
  }

  @Post("attachments/:attachmentId/prepare")
  prepareAttachment(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.workflow.prepareAttachment(
      projectId,
      attachmentId,
      user,
      source
    );
  }

  @Post("attachments/:attachmentId/review")
  reviewAttachment(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.workflow.reviewAttachment(
      projectId,
      attachmentId,
      user,
      source
    );
  }

  @Get("attachments/:attachmentId/signoffs/history")
  attachmentSignoffHistory(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.workflow.attachmentSignoffHistory(
      projectId,
      attachmentId,
      user
    );
  }

  @Post("attachments/:attachmentId/signoffs/:signoffId/revoke")
  revokeAttachmentSignoff(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Param("signoffId") signoffId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = RevokeWorkingPaperSignoffSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid signoff revocation request."
      );
    }
    return this.workflow.revokeAttachmentSignoff(
      projectId,
      attachmentId,
      signoffId,
      user,
      parsed.data,
      source
    );
  }

  @Delete("signoffs/:signoffId")
  removeWorkingPaperSignoff(
    @Param("projectId") projectId: string,
    @Param("signoffId") signoffId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.workflow.removeWorkingPaperSignoff(
      projectId,
      signoffId,
      user,
      source
    );
  }

  @Post("working-papers/:paperId/prepare")
  prepareWorkingPaper(
    @Param("projectId") projectId: string,
    @Param("paperId") paperId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.workflow.prepareWorkingPaper(projectId, paperId, user, source);
  }

  @Post("working-papers/:paperId/review")
  reviewWorkingPaper(
    @Param("projectId") projectId: string,
    @Param("paperId") paperId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.workflow.reviewWorkingPaper(projectId, paperId, user, source);
  }

  @Post("working-papers/:paperId/return")
  returnWorkingPaper(
    @Param("projectId") projectId: string,
    @Param("paperId") paperId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ReturnWorkingPaperSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "复核意见无效");
    }
    return this.workflow.returnWorkingPaper(
      projectId,
      paperId,
      user,
      parsed.data,
      source
    );
  }

  @Post("working-papers/:paperId/questions")
  createWorkingPaperQuestion(
    @Param("projectId") projectId: string,
    @Param("paperId") paperId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateWorkingPaperQuestionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "复核意见无效");
    }
    return this.workflow.createWorkingPaperQuestion(
      projectId,
      paperId,
      user,
      parsed.data,
      source
    );
  }

  @Post("attachments/:attachmentId/questions")
  createAttachmentQuestion(
    @Param("projectId") projectId: string,
    @Param("attachmentId") attachmentId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateWorkingPaperQuestionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "复核意见无效");
    }
    return this.workflow.createAttachmentQuestion(
      projectId,
      attachmentId,
      user,
      parsed.data,
      source
    );
  }

  @Post("questions/:questionId/reply")
  replyWorkingPaperQuestion(
    @Param("projectId") projectId: string,
    @Param("questionId") questionId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ReplyWorkingPaperQuestionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "复核意见回复无效");
    }
    return this.workflow.replyWorkingPaperQuestion(
      projectId,
      questionId,
      user,
      parsed.data,
      source
    );
  }

  @Post("questions/:questionId/initial-attachments")
  attachWorkingPaperQuestionInitialMessage(
    @Param("projectId") projectId: string,
    @Param("questionId") questionId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = AttachWorkingPaperQuestionMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Review note attachment information is invalid"
      );
    }
    return this.workflow.attachWorkingPaperQuestionInitialMessage(
      projectId,
      questionId,
      user,
      parsed.data
    );
  }

  @Post("questions/:questionId/images/upload-url")
  createReviewQuestionImageUploadGrant(
    @Param("projectId") projectId: string,
    @Param("questionId") questionId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = RequestReviewQuestionImageUploadUrlSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Review note image upload information is invalid"
      );
    }
    return this.workflow.createReviewQuestionImageUploadGrant(
      projectId,
      questionId,
      user,
      parsed.data
    );
  }

  @Post("questions/:questionId/images")
  @UseInterceptors(FileInterceptor("file"))
  uploadReviewQuestionImage(
    @Param("projectId") projectId: string,
    @Param("questionId") questionId: string,
    @UploadedFile() file: UploadedWorkflowFile,
    @CurrentUser() user: RequestUser
  ) {
    return this.workflow.uploadReviewQuestionImage(
      projectId,
      questionId,
      user,
      file
    );
  }

  @Get("question-images/:imageId")
  async downloadReviewQuestionImage(
    @Param("projectId") projectId: string,
    @Param("imageId") imageId: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    const file = await this.workflow.downloadReviewQuestionImage(
      projectId,
      imageId,
      user
    );
    return sendWorkflowInlineFile(response, file);
  }

  @Post("questions/:questionId/mark-replied")
  markWorkingPaperQuestionReplied(
    @Param("projectId") projectId: string,
    @Param("questionId") questionId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.workflow.markWorkingPaperQuestionReplied(
      projectId,
      questionId,
      user,
      source
    );
  }

  @Post("questions/:questionId/follow-up")
  followUpWorkingPaperQuestion(
    @Param("projectId") projectId: string,
    @Param("questionId") questionId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = FollowUpWorkingPaperQuestionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "继续追问内容无效");
    }
    return this.workflow.followUpWorkingPaperQuestion(
      projectId,
      questionId,
      user,
      parsed.data,
      source
    );
  }

  @Post("questions/:questionId/clear")
  clearWorkingPaperQuestion(
    @Param("projectId") projectId: string,
    @Param("questionId") questionId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.workflow.clearWorkingPaperQuestion(
      projectId,
      questionId,
      user,
      source
    );
  }

  @Post("questions/:questionId/reopen")
  reopenWorkingPaperQuestion(
    @Param("projectId") projectId: string,
    @Param("questionId") questionId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = FollowUpWorkingPaperQuestionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "重新打开原因无效");
    }
    return this.workflow.reopenWorkingPaperQuestion(
      projectId,
      questionId,
      user,
      parsed.data,
      source
    );
  }
}

export { DesktopMasterSessionController } from "./desktop-master-session.controller";
export { DesktopZipEntryMasterSessionController } from "./desktop-zip-entry-master-session.controller";

function parseIntegerQuery(value: string | undefined) {
  if (value === undefined || value.trim() === "") {
    return;
  }
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseZipOperationBody(body: unknown): ZipMasterOperationInput {
  const rawOperation =
    body &&
    typeof body === "object" &&
    "operation" in body &&
    (body as { operation?: unknown }).operation !== undefined
      ? (body as { operation?: unknown }).operation
      : body;
  const operation =
    typeof rawOperation === "string"
      ? parseZipOperationJson(rawOperation)
      : rawOperation;
  if (!operation || typeof operation !== "object") {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Zip operation is invalid."
    );
  }
  const typed = operation as {
    type?: unknown;
    entryPath?: unknown;
    targetPath?: unknown;
  };
  if (
    (typed.type === "ADD_FILE" || typed.type === "REPLACE_FILE") &&
    typeof typed.entryPath === "string"
  ) {
    return {
      type: typed.type,
      entryPath: typed.entryPath,
    };
  }
  const parsed = ZipMasterOperationSchema.safeParse(operation);
  if (!parsed.success) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Zip operation is invalid."
    );
  }
  return parsed.data;
}

function parseZipOperationJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Zip operation is invalid."
    );
  }
}

function sendWorkflowFile(
  response: Response,
  file: {
    mimeType: string;
    fileName: string;
    body?: Buffer;
    absolutePath?: string;
    redirectUrl?: string;
  }
) {
  if (file.redirectUrl) {
    return response.redirect(302, file.redirectUrl);
  }
  if (file.body) {
    response.type(file.mimeType);
    response.setHeader(
      "Content-Disposition",
      buildAttachmentContentDisposition(file.fileName)
    );
    return response.send(file.body);
  }
  if (!file.absolutePath) {
    throw new ApiBadRequestException("BAD_REQUEST", "文件下载地址无效");
  }
  response.type(file.mimeType);
  return response.download(file.absolutePath, file.fileName);
}

function parseAttachmentExportFormat(
  value: string | undefined
): AttachmentExportFormat {
  if (value === "original" || value === "pdf" || value === "zip") {
    return value;
  }
  throw new ApiBadRequestException(
    "VALIDATION_FAILED",
    "Export format must be original, pdf, or zip."
  );
}

async function sendWorkflowInlineFile(
  response: Response,
  file: {
    mimeType: string;
    fileName: string;
    body?: Buffer;
    absolutePath?: string;
    redirectUrl?: string;
    cacheControl?: string;
    eTag?: string;
    notModified?: boolean;
  },
  options: {
    includeContentDisposition?: boolean;
    responseMimeType?: string;
  } = {}
) {
  response.type(options.responseMimeType ?? file.mimeType);
  const transientRedirect = Boolean(file.redirectUrl && !file.body);
  const cacheControl = transientRedirect
    ? "private, no-store"
    : file.cacheControl;
  if (cacheControl) {
    response.setHeader("Cache-Control", cacheControl);
    response.setHeader("Vary", "Accept, Authorization, Cookie, Origin");
  }
  if (file.eTag && !transientRedirect) {
    response.setHeader("ETag", file.eTag);
  }
  if (file.notModified && !transientRedirect) {
    return response.status(304).end();
  }
  if (options.includeContentDisposition !== false) {
    response.setHeader(
      "Content-Disposition",
      buildInlineContentDisposition(file.fileName)
    );
  }
  if (file.body) {
    return response.send(file.body);
  }
  if (file.redirectUrl) {
    return response.redirect(302, file.redirectUrl);
  }
  if (!file.absolutePath) {
    throw new ApiBadRequestException("BAD_REQUEST", "文件下载地址无效");
  }
  return response.send(await readFile(file.absolutePath));
}

function usesPreviewBlobTransport(accept?: string) {
  return accept?.toLowerCase().includes(PREVIEW_BLOB_ACCEPT) ?? false;
}

function setPreviewServerTiming(
  response: Response | undefined,
  startedAt: number
) {
  if (!response) {
    return;
  }
  const duration = Math.max(0, performance.now() - startedAt);
  response.setHeader("Server-Timing", `preview;dur=${duration.toFixed(1)}`);
}

function sendWorkflowDownload(
  response: Response,
  file: {
    mimeType: string;
    fileName: string;
    absolutePath?: string;
    redirectUrl?: string;
    buffer?: Buffer;
  }
) {
  if (file.buffer) {
    return sendWorkflowBuffer(response, {
      fileName: file.fileName,
      mimeType: file.mimeType,
      buffer: file.buffer,
    });
  }
  return sendWorkflowFile(response, file);
}

function sendWorkflowBuffer(
  response: Response,
  file: {
    mimeType: string;
    fileName: string;
    buffer: Buffer;
  }
) {
  response.attachment(file.fileName);
  response.type(file.mimeType);
  return response.send(file.buffer);
}

function writeFileExportJobEvent(
  response: Response,
  job: ProjectFileExportJob
) {
  response.write(`data: ${JSON.stringify(job)}\n\n`);
}

function isTerminalFileExportJob(status: ProjectFileExportJob["status"]) {
  return ["COMPLETED", "FAILED", "DOWNLOADED", "EXPIRED"].includes(status);
}
