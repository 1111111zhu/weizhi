import { createHash, randomBytes, randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import pathModule from "node:path";

import { Injectable, Logger, Optional } from "@nestjs/common";
import type {
  AttachmentFileKind,
  AttachmentPlaceholderType as PrismaAttachmentPlaceholderType,
  WorkflowNodeType,
  WorkingPaperSignoffType,
} from "@prisma/client";
import { PaperType, Prisma, WorkingPaperBucket } from "@prisma/client";
import {
  ATTACHMENT_PLACEHOLDER_TYPES,
  REVIEW_QUESTION_IMAGE_MAX_SIZE_BYTES,
  REVIEW_QUESTION_IMAGE_MIME_TYPES,
  SmartFormPackageSchema,
  canGlobalRoleManageProjectMembers,
  isProjectPermissionSubjectConsistent,
  getAttachmentPlaceholderReplacementName,
  getAttachmentPlaceholderTypeForFile,
  isDesktopAgentOpenSupportedFileName,
  normalizeCodeSequenceWithoutDigitFour,
  normalizeCodeWithoutDigitFour,
} from "@project-wing/shared";
import type {
  CreateAttachmentPlaceholderInput,
  AttachmentPlaceholderType,
  ProjectPermissionAction,
  SmartFormV2FixedSheetRow,
  SmartFormV2Node,
} from "@project-wing/shared";
import JSZip from "jszip";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiConflictException,
  ApiForbiddenException,
  ApiServiceUnavailableException,
} from "../common/api-error";
import { XLSX } from "../common/xlsx";
import { InboxService } from "../inbox/inbox.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectAccessService } from "../projects/project-access.service";
import { SmartFormV2PdfService } from "../smart-forms/smart-form-v2-pdf.service";
import type {
  SmartFormV2PdfReviewQuestion,
  SmartFormV2PdfSignoff,
} from "../smart-forms/smart-form-v2-pdf.service";
import {
  loadSmartFormV2PdfEngagementDetails,
  loadSmartFormV2PdfSignoffs,
} from "../smart-forms/smart-form-v2-project-context";
import { StorageService } from "../storage/storage.service";
import type { UploadGrant, DownloadObject } from "../storage/storage.service";
import { cancelAttachmentWorkItems } from "../work-items/work-item-attachment-lifecycle";
import {
  attachmentPreviewDataForCommittedFile,
  attachmentPreviewDataForFile,
  queueAttachmentPreviewData,
} from "./attachment-preview-worker.service";
import { DocumentConversionService } from "./document-conversion.service";
import { PdfRasterPreviewService } from "./pdf-raster-preview.service";
import { SpreadsheetPreviewCacheService } from "./spreadsheet-preview-cache.service";
import { spreadsheetWorkbookReader } from "./spreadsheet-workbook-reader";
import {
  buildNextWorkingPaperCode,
  isHierarchicalNumericFolderCode,
  isHierarchicalNumericWorkingPaperCode,
  normalizeHierarchicalNumericCode,
} from "./working-paper-code";

const LOCK_DURATION_MS = 2 * 60 * 60 * 1000;
const DESKTOP_MASTER_STALE_AFTER_MS = 60_000;
const DESKTOP_MASTER_RECLAIM_GRACE_MS = 15 * 60_000;
const DESKTOP_CHECK_IN_ATTEMPT_LEASE_MS = 15 * 60_000;
const ATTACHMENT_CONTAINER_PAPER_CREATE_MAX_ATTEMPTS = 5;
const VERSIONED_ATTACHMENT_PREVIEW_CACHE_CONTROL =
  "private, max-age=604800, immutable, no-transform";
const UNVERSIONED_ATTACHMENT_PREVIEW_CACHE_CONTROL =
  "private, no-cache, no-transform";
const DEFAULT_PREVIEW_ROWS = 50;
const LEGACY_ATTACHMENT_FILE_KIND: AttachmentFileKind = "SUPPORTING";
const MAX_PREVIEW_ROWS = 200;
const MAX_PREVIEW_WORKBOOK_CACHE_SIZE = 4;
const MAX_ATTACHMENT_ZIP_EXPORT_BYTES = 512 * 1024 * 1024;
const REVIEW_SIGNOFF_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const USER_SUMMARY_SELECT = { id: true, name: true, email: true } as const;

export type AttachmentExportFormat = "original" | "pdf" | "zip";

function normalizeWorkflowNodeCode(code: string) {
  const trimmed = code.trim();
  return isHierarchicalNumericFolderCode(trimmed)
    ? normalizeHierarchicalNumericCode(trimmed)
    : normalizeCodeWithoutDigitFour(trimmed);
}

export function buildUniqueWorkflowNodeTitle(
  title: string,
  existingTitles: readonly string[]
) {
  const normalizedTitle = title.trim();
  const titles = new Set(
    existingTitles.map((existingTitle) => existingTitle.trim())
  );
  if (!titles.has(normalizedTitle)) {
    return normalizedTitle;
  }

  let suffix = 2;
  while (titles.has(`${normalizedTitle}（${suffix}）`)) {
    suffix += 1;
  }

  return `${normalizedTitle}（${suffix}）`;
}

function normalizeWorkingPaperCode(code: string) {
  const trimmed = code.trim();
  if (!isHierarchicalNumericWorkingPaperCode(trimmed)) {
    return normalizeCodeWithoutDigitFour(trimmed);
  }
  return trimmed.replaceAll(/\s*-\s*/g, "-").replaceAll(/\s*\.\s*/g, ".");
}
const REVIEW_QUESTION_INCLUDE = {
  assignedTo: { select: USER_SUMMARY_SELECT },
  createdBy: { select: USER_SUMMARY_SELECT },
  repliedBy: { select: USER_SUMMARY_SELECT },
  clearedBy: { select: USER_SUMMARY_SELECT },
  reopenedBy: { select: USER_SUMMARY_SELECT },
  messages: {
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: USER_SUMMARY_SELECT },
      images: { orderBy: { createdAt: "asc" } },
      references: {
        orderBy: { createdAt: "asc" },
        include: {
          workingPaper: {
            select: {
              id: true,
              code: true,
              title: true,
              workflowNodeId: true,
              bucket: true,
            },
          },
        },
      },
    },
  },
} as const;
const ATTACHMENT_USER_INCLUDE = {
  confirmationEmpImportItems: {
    where: { status: "SUCCEEDED", withdrawnAt: null },
    select: { id: true },
  },
  uploader: { select: USER_SUMMARY_SELECT },
  lockHolder: { select: USER_SUMMARY_SELECT },
  deletedByUser: { select: USER_SUMMARY_SELECT },
  restoredByUser: { select: USER_SUMMARY_SELECT },
  lastModifier: { select: USER_SUMMARY_SELECT },
} as const;
const ATTACHMENT_VERSION_USER_INCLUDE = {
  uploadedByUser: { select: USER_SUMMARY_SELECT },
  archivedByUser: { select: USER_SUMMARY_SELECT },
} as const;
const ATTACHMENT_REVISION_ACTIONS = {
  INITIAL: "INITIAL",
  UPLOAD: "UPLOAD",
  CHECK_IN: "CHECK_IN",
  RESTORE: "RESTORE",
  CONFLICT_CANDIDATE: "CONFLICT_CANDIDATE",
} as const;

export type UploadedWorkflowFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type AttachmentUploadGrantInput = {
  fileKind?: AttachmentFileKind;
  fileName: string;
  fileSize: number;
  mimeType: string;
  workDate?: string;
};

type ConfirmAttachmentUploadInput = AttachmentUploadGrantInput & {
  objectKey: string;
};

type RelocateAttachmentTarget = {
  workingPaperId?: string;
  workflowNodeId?: string;
  bucket?: WorkingPaperBucket;
};

type AttachmentExportSource = Prisma.AttachmentGetPayload<{
  include: {
    workingPaper: {
      select: { code: true; workflowNodeId: true };
    };
  };
}>;

type AttachmentExportProject = {
  projectCode: string;
  name: string;
};

type AttachmentExportWorkflowNode = {
  id: string;
  parentId: string | null;
  code: string;
  title: string;
};

type AttachmentContainerPaperSource = {
  id?: string;
  fileKind: AttachmentFileKind;
  fileName: string;
  originalName?: string | null;
  workflowNodeId?: string | null;
  bucket?: WorkingPaperBucket | null;
  code?: string | null;
  title?: string | null;
};

type AttachmentVersionUploadGrantInput = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  workDate?: string;
};

type ConfirmAttachmentVersionUploadInput = AttachmentVersionUploadGrantInput & {
  objectKey: string;
};

type AttachmentPlaceholderUploadInput = {
  fileName: string;
  fileSize: number;
  mimeType: string;
};

type ConfirmAttachmentPlaceholderUploadInput =
  AttachmentPlaceholderUploadInput & { objectKey: string };

type ReviewQuestionImageUploadGrantInput = {
  fileName: string;
  fileSize: number;
  mimeType: string;
};

type ConfirmReviewQuestionImageInput = ReviewQuestionImageUploadGrantInput & {
  objectKey: string;
  width?: number;
  height?: number;
};

type ReplyReviewQuestionInput = {
  replyBody?: string;
  images?: ConfirmReviewQuestionImageInput[];
  referencedWorkingPaperIds?: string[];
};

export type DesktopMasterOpenRequestContext = {
  protocol: string;
  host: string;
  pathPrefix?: string;
};

export type DesktopMasterCheckInInput = {
  projectId: string;
  attachmentId: string;
  lockSessionId: string;
  grantSecret: string;
  baseVersion: number;
  baseVersionId?: string;
  lockEpoch?: number;
  localContentHash: string;
  localContentCrc64?: string;
  idempotencyKey: string;
  objectKey?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadAttemptId?: string;
};

export type DesktopMasterUploadPrepareInput = DesktopMasterCheckInInput & {
  fileName: string;
  fileSize: number;
  mimeType: string;
  resumeUploadId?: string;
};

export type DesktopMasterUploadCompleteInput =
  DesktopMasterUploadPrepareInput & {
    objectKey: string;
    uploadId: string;
    parts: { partNumber: number; etag: string }[];
  };

export type DesktopMasterReleaseInput = {
  projectId: string;
  attachmentId: string;
  lockSessionId: string;
  grantSecret: string;
  lockEpoch?: number;
  reason: "CHECKED_IN" | "UNCHANGED_RELEASE" | "RECOVERY_ENDED";
};

export type DesktopMasterHeartbeatInput = {
  projectId: string;
  attachmentId: string;
  lockSessionId: string;
  grantSecret: string;
  lockEpoch?: number;
};

export type SpreadsheetPreviewInput = {
  sheetIndex?: number;
  offset?: number;
  limit?: number;
  columnOffset?: number;
  columnLimit?: number;
  targetRow?: number;
};

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly auditLogs: AuditLogsService,
    private readonly documentConversion: DocumentConversionService,
    @Optional() private readonly inbox?: InboxService,
    @Optional() private readonly storage?: StorageService,
    @Optional() private readonly pdfRasterPreview?: PdfRasterPreviewService,
    @Optional() private readonly smartFormPdf?: SmartFormV2PdfService,
    @Optional()
    private readonly spreadsheetPreview?: SpreadsheetPreviewCacheService
  ) {}

  private async requireProjectActionWithRole(
    projectId: string,
    userId: string,
    action: ProjectPermissionAction,
    minimumRole: "PREPARER" | "REVIEWER"
  ) {
    await this.access.requireProjectAction(projectId, userId, action);
    return this.access.requireProjectRole(projectId, userId, minimumRole);
  }

  async tree(projectId: string, user: RequestUser) {
    await this.access.requireProjectMember(projectId, user.id);
    const nodes = await this.prisma.workflowNode.findMany({
      where: { projectId },
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
      include: {
        workingPapers: {
          where: { attachments: { some: { deletedAt: null } } },
          orderBy: [{ bucket: "asc" }, { createdAt: "asc" }],
          include: {
            preparer: { select: USER_SUMMARY_SELECT },
            reviewer: { select: USER_SUMMARY_SELECT },
            signoffs: {
              where: { isCurrent: true, revokedAt: null },
              orderBy: { signedAt: "asc" },
              include: { user: { select: USER_SUMMARY_SELECT } },
            },
            reviewQuestions: {
              orderBy: { createdAt: "desc" },
              include: REVIEW_QUESTION_INCLUDE,
            },
            attachments: {
              where: { deletedAt: null },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
              include: ATTACHMENT_USER_INCLUDE,
            },
          },
        },
      },
    });
    return normalizeWorkflowTreeCodes(
      buildTree(nodes.map(normalizeWorkflowNodeResponse))
    );
  }

  async getWorkingPaper(projectId: string, paperId: string, user: RequestUser) {
    await this.access.requireProjectMember(projectId, user.id);
    const paper = await this.prisma.workingPaper.findFirst({
      where: { id: paperId, projectId },
      include: {
        preparer: { select: USER_SUMMARY_SELECT },
        reviewer: { select: USER_SUMMARY_SELECT },
        signoffs: {
          where: { isCurrent: true, revokedAt: null },
          orderBy: { signedAt: "asc" },
          include: { user: { select: USER_SUMMARY_SELECT } },
        },
        reviewQuestions: {
          orderBy: { createdAt: "desc" },
          include: REVIEW_QUESTION_INCLUDE,
        },
        attachments: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          include: ATTACHMENT_USER_INCLUDE,
        },
      },
    });
    if (!paper) {
      throw new ApiBadRequestException("NOT_FOUND", "底稿不存在");
    }
    return normalizeWorkingPaperResponse(paper);
  }

  async createWorkingPaper(
    projectId: string,
    user: RequestUser,
    input: {
      workflowNodeId: string;
      code: string;
      title: string;
      paperType: PaperType;
      bucket: WorkingPaperBucket;
    },
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "modifyIndex",
      "PREPARER"
    );
    const node = await this.prisma.workflowNode.findFirst({
      where: { id: input.workflowNodeId, projectId },
    });
    if (!node) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Please choose a project folder before adding files"
      );
    }
    const code = normalizeWorkingPaperCode(input.code);
    const title = normalizeDisplayTitleFromCode(code, input.title);
    try {
      const paper = await this.prisma.workingPaper.create({
        data: {
          projectId,
          workflowNodeId: input.workflowNodeId,
          code,
          title,
          paperType: input.paperType,
          bucket: input.bucket,
          createdBy: user.id,
        },
      });
      await this.auditLogs.log({
        actorId: user.id,
        action: "WORKING_PAPER_CREATED",
        targetType: "WORKING_PAPER",
        targetId: paper.id,
        projectId,
        description: `新增底稿文件 ${paper.code}`,
        source,
      });
      return paper;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiBadRequestException(
          "DUPLICATE_CODE",
          "该目录下编号已存在"
        );
      }
      throw error;
    }
  }

  async updateWorkingPaper(
    projectId: string,
    paperId: string,
    user: RequestUser,
    input: { code?: string; title?: string },
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "modifyIndex",
      "PREPARER"
    );
    const paper = await this.requireWorkingPaper(projectId, paperId);
    const data: { code?: string; title?: string } = {};
    const inputCode = input.code?.trim();
    if (inputCode !== undefined) {
      data.code = normalizeWorkingPaperCode(inputCode);
    }
    if (input.title !== undefined) {
      const title = input.title.trim();
      data.title =
        inputCode !== undefined && title === inputCode
          ? data.code
          : normalizeDisplayTitleFromCode(data.code ?? paper.code, title);
    }
    try {
      const updated = await this.prisma.workingPaper.update({
        where: { id: paperId },
        data,
      });
      if (data.code !== undefined) {
        // An unfilled placeholder represents the paper itself rather than an
        // Independently numbered file. Keep its inherited reference in sync
        // Whenever the paper reference changes.
        await this.prisma.attachment.updateMany({
          where: {
            projectId,
            workingPaperId: paperId,
            deletedAt: null,
            placeholderType: { not: null },
          },
          data: { code: data.code },
        });
      }
      if (data.title !== undefined) {
        await this.prisma.attachment.updateMany({
          where: { projectId, workingPaperId: paperId, deletedAt: null },
          data: { title: data.title },
        });
      }
      await this.auditLogs.log({
        actorId: user.id,
        action: "WORKING_PAPER_UPDATED",
        targetType: "WORKING_PAPER",
        targetId: paperId,
        projectId,
        description: `Updated workpaper ${paper.code}`,
        source,
      });
      return normalizeWorkingPaperResponse(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiBadRequestException(
          "DUPLICATE_CODE",
          "Working paper refcode already exists in this directory"
        );
      }
      throw error;
    }
  }

  async updateAttachmentIdentity(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    input: { code?: string; title?: string },
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "modifyIndex",
      "PREPARER"
    );
    const attachment = await this.requireAttachment(projectId, attachmentId);
    this.requireAttachmentMetadataEditable(attachment, user);
    const data: { code?: string; title?: string } = {};
    const inputCode = input.code?.trim();
    if (inputCode !== undefined) {
      if (attachment.placeholderType) {
        if (!attachment.workingPaperId) {
          throw new ApiBadRequestException(
            "VALIDATION_FAILED",
            "Placeholder must belong to a working paper before its refcode can be changed"
          );
        }
        // Placeholders are created with the working-paper reference. Applying
        // Regular attachment (-F001) validation here made that inherited
        // Reference impossible to edit in folders that use file-style codes.
        data.code = normalizeWorkingPaperCode(inputCode);
      } else {
        const nodeCode = await this.resolveAttachmentWorkflowNodeCode(
          projectId,
          attachment
        );
        data.code = normalizeAttachmentRefCodeInput(inputCode);
        assertAttachmentRefCodeMatchesNode(data.code, nodeCode);
      }
    }
    if (input.title !== undefined) {
      const title = input.title.trim();
      data.title =
        inputCode !== undefined && title === inputCode
          ? data.code
          : normalizeDisplayTitleFromCode(data.code ?? attachment.code, title);
    }
    const lastModifiedAt = new Date();
    try {
      if (attachment.placeholderType && data.code !== undefined) {
        const updated = await this.prisma.$transaction(async (tx) => {
          await tx.workingPaper.update({
            where: { id: assertPresentValue(attachment.workingPaperId) },
            data: { code: data.code },
          });
          await tx.attachment.updateMany({
            where: {
              projectId,
              workingPaperId: assertPresentValue(attachment.workingPaperId),
              deletedAt: null,
              placeholderType: { not: null },
            },
            data: { code: data.code },
          });
          return tx.attachment.update({
            where: { id: attachmentId },
            data: {
              ...data,
              lastModifiedBy: user.id,
              lastModifiedAt,
            },
            include: ATTACHMENT_USER_INCLUDE,
          });
        });
        await this.auditLogs.log({
          actorId: user.id,
          action: "WORKING_PAPER_UPDATED",
          targetType: "WORKING_PAPER",
          targetId: assertPresentValue(attachment.workingPaperId),
          projectId,
          description: `Updated placeholder workpaper ${data.code}`,
          source,
        });
        return normalizeAttachmentResponse(updated);
      }
      const updated = await this.prisma.attachment.update({
        where: { id: attachmentId },
        data: {
          ...data,
          lastModifiedBy: user.id,
          lastModifiedAt,
        },
        include: ATTACHMENT_USER_INCLUDE,
      });
      await this.auditLogs.log({
        actorId: user.id,
        action: "ATTACHMENT_UPDATED",
        targetType: "ATTACHMENT",
        targetId: attachmentId,
        projectId,
        description: `Updated file ${data.code ?? attachment.code ?? attachment.originalName ?? attachment.fileName}`,
        source,
      });
      return normalizeAttachmentResponse(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiBadRequestException(
          "DUPLICATE_CODE",
          "File refcode already exists in this directory"
        );
      }
      throw error;
    }
  }

  async reorderWorkingPaperAttachments(
    projectId: string,
    user: RequestUser,
    input: {
      workflowNodeId: string;
      bucket: WorkingPaperBucket;
      attachmentIds: string[];
    },
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "modifyIndex",
      "PREPARER"
    );
    const attachments = await this.prisma.attachment.findMany({
      where: {
        projectId,
        workflowNodeId: input.workflowNodeId,
        bucket: input.bucket,
        deletedAt: null,
      },
      select: { id: true },
    });
    const attachmentIds = new Set(
      attachments.map((attachment) => attachment.id)
    );
    if (
      attachmentIds.size !== input.attachmentIds.length ||
      input.attachmentIds.some(
        (attachmentId) => !attachmentIds.has(attachmentId)
      )
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "附件必须全部属于同一目录和文件桶"
      );
    }

    const lastModifiedAt = new Date();
    await this.prisma.$transaction((tx) =>
      Promise.all(
        input.attachmentIds.map((attachmentId, sortOrder) =>
          tx.attachment.updateMany({
            where: {
              id: attachmentId,
              projectId,
              workflowNodeId: input.workflowNodeId,
              bucket: input.bucket,
              deletedAt: null,
            },
            data: { sortOrder, lastModifiedBy: user.id, lastModifiedAt },
          })
        )
      )
    );
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_UPDATED",
      targetType: "PROJECT",
      targetId: projectId,
      projectId,
      description: `Reordered ${input.attachmentIds.length} directory attachments`,
      source,
    });
    return { attachmentIds: input.attachmentIds };
  }

  async updateWorkingPaperAssignees(
    projectId: string,
    paperId: string,
    user: RequestUser,
    input: { preparerId?: string; reviewerId?: string },
    source?: AuditLogSource
  ) {
    await this.access.requireProjectRole(projectId, user.id, "REVIEWER");
    await this.requireWorkingPaper(projectId, paperId);
    const paper = await this.prisma.workingPaper.update({
      where: { id: paperId },
      data: {
        preparerId: normalizeOptionalId(input.preparerId),
        reviewerId: normalizeOptionalId(input.reviewerId),
      },
      include: {
        preparer: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
      },
    });
    await this.prisma.attachment.updateMany({
      where: { projectId, workingPaperId: paperId, deletedAt: null },
      data: {
        preparerId: paper.preparerId,
        reviewerId: paper.reviewerId,
      },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "WORKING_PAPER_ASSIGNEES_UPDATED",
      targetType: "WORKING_PAPER",
      targetId: paperId,
      projectId,
      description: `更新底稿 ${paper.code} 的 Preparer / Reviewer`,
      source,
    });
    return paper;
  }

  async deleteWorkingPaper(
    projectId: string,
    paperId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "modifyIndex",
      "PREPARER"
    );
    const deleted = await this.prisma.$transaction(async (tx) => {
      const paper = await tx.workingPaper.findFirst({
        where: { id: paperId, projectId },
      });
      if (!paper) {
        throw new ApiBadRequestException(
          "NOT_FOUND",
          "Working paper not found"
        );
      }

      const [activeAttachmentCount, signoffCount, questionCount] =
        await Promise.all([
          tx.attachment.count({
            where: {
              projectId,
              workingPaperId: paperId,
              deletedAt: null,
            },
          }),
          tx.workingPaperSignoff.count({ where: { workingPaperId: paperId } }),
          tx.workingPaperQuestion.count({
            where: { projectId, workingPaperId: paperId },
          }),
        ]);
      if (activeAttachmentCount > 0 || signoffCount > 0 || questionCount > 0) {
        throw new ApiBadRequestException(
          "BAD_REQUEST",
          "Only empty working papers can be deleted"
        );
      }

      await tx.workingPaper.delete({ where: { id: paperId } });
      return paper;
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "WORKING_PAPER_DELETED",
      targetType: "WORKING_PAPER",
      targetId: paperId,
      projectId,
      description: `Delete empty working paper ${deleted.code}`,
      source,
    });
    return { id: paperId };
  }

  async uploadAttachment(
    projectId: string,
    paperId: string,
    user: RequestUser,
    input: { fileKind?: AttachmentFileKind; workDate?: string },
    file: UploadedWorkflowFile,
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "uploadWorkingPapers",
      "PREPARER"
    );
    const paper = await this.requireWorkingPaper(projectId, paperId);
    if (!file?.buffer?.length) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "请上传文件");
    }
    const originalName = normalizeUploadedFileName(file.originalname);
    const stored = await this.writeUploadedFile(projectId, paperId, file);
    const uploadedContentHash = createHash("sha256")
      .update(file.buffer)
      .digest("hex");
    const lastModifiedAt = new Date();
    const workDate =
      parseAttachmentWorkDate(input.workDate) ?? startOfUtcDate(lastModifiedAt);
    const sortOrder = await this.nextAttachmentSortOrder(
      projectId,
      paper.workflowNodeId,
      paper.bucket
    );
    const attachment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: {
          projectId,
          workingPaperId: paperId,
          ...buildAttachmentIdentityData(paper),
          fileKind: LEGACY_ATTACHMENT_FILE_KIND,
          fileName: stored.fileName,
          originalName,
          fileUrl: stored.fileUrl,
          fileSize: file.size,
          mimeType: file.mimetype || "application/octet-stream",
          contentHash: uploadedContentHash,
          ...attachmentPreviewDataForFile({
            fileName: stored.fileName,
            originalName,
            mimeType: file.mimetype || "application/octet-stream",
          }),
          sortOrder,
          uploadedBy: user.id,
          lastModifiedBy: user.id,
          lastModifiedAt,
          workDate,
        },
        include: ATTACHMENT_USER_INCLUDE,
      });
      const revision = await createAttachmentRevision(tx, {
        attachmentId: created.id,
        projectId,
        version: 1,
        parentVersionId: null,
        sourceVersionId: null,
        fileKind: LEGACY_ATTACHMENT_FILE_KIND,
        fileName: stored.fileName,
        originalName,
        fileUrl: stored.fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype || "application/octet-stream",
        contentHash: uploadedContentHash,
        workDate,
        uploadedBy: user.id,
        uploadedAt: lastModifiedAt,
        archivedBy: user.id,
        action: ATTACHMENT_REVISION_ACTIONS.INITIAL,
        createdAt: lastModifiedAt,
      });
      return tx.attachment.update({
        where: { id: created.id },
        data: { headVersionId: revision.id },
        include: ATTACHMENT_USER_INCLUDE,
      });
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_UPLOADED",
      targetType: "ATTACHMENT",
      targetId: attachment.id,
      projectId,
      description: `上传底稿文件 ${attachment.originalName ?? attachment.fileName}`,
      source,
    });
    return attachment;
  }

  async createAttachmentPlaceholder(
    projectId: string,
    paperId: string,
    user: RequestUser,
    input: CreateAttachmentPlaceholderInput,
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "uploadWorkingPapers",
      "PREPARER"
    );
    const paper = await this.requireWorkingPaper(projectId, paperId);
    const displayName = buildAttachmentPlaceholderName(
      input.name,
      input.placeholderType
    );
    const typeConfig = ATTACHMENT_PLACEHOLDER_TYPES[input.placeholderType];
    const sortOrder = await this.nextAttachmentSortOrder(
      projectId,
      paper.workflowNodeId,
      paper.bucket
    );
    const createdAt = new Date();
    const attachment = await this.prisma.attachment.create({
      data: {
        projectId,
        workingPaperId: paperId,
        ...buildAttachmentIdentityData(paper),
        fileKind: LEGACY_ATTACHMENT_FILE_KIND,
        placeholderType:
          input.placeholderType as PrismaAttachmentPlaceholderType,
        fileName: displayName,
        originalName: displayName,
        fileUrl: "",
        fileSize: 0,
        mimeType: typeConfig.mimeType,
        sortOrder,
        version: 0,
        previewStatus: "UNSUPPORTED",
        uploadedBy: user.id,
        lastModifiedBy: user.id,
        lastModifiedAt: createdAt,
      },
      include: ATTACHMENT_USER_INCLUDE,
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_PLACEHOLDER_CREATED",
      targetType: "ATTACHMENT",
      targetId: attachment.id,
      projectId,
      description: `Create ${input.placeholderType} placeholder ${displayName}`,
      source,
    });
    return normalizeAttachmentResponse(attachment);
  }

  async replaceAttachmentPlaceholder(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    file: UploadedWorkflowFile,
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "uploadWorkingPapers",
      "PREPARER"
    );
    const attachment = await this.requireAttachment(projectId, attachmentId);
    requireMatchingPlaceholderFile(attachment.placeholderType, {
      fileName: file?.originalname ?? "",
      mimeType: file?.mimetype ?? "",
    });
    if (!file?.buffer?.length) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Please select a file"
      );
    }
    const stored = await this.writeUploadedFile(
      projectId,
      attachment.workingPaperId ?? "unassigned",
      file
    );
    const contentHash = createHash("sha256").update(file.buffer).digest("hex");
    return this.commitAttachmentPlaceholderReplacement(
      projectId,
      attachment,
      user,
      {
        fileName: stored.fileName,
        fileUrl: stored.fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype || "application/octet-stream",
        contentHash,
      },
      source
    );
  }

  async createAttachmentPlaceholderUploadGrant(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    input: AttachmentPlaceholderUploadInput
  ): Promise<UploadGrant> {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "uploadWorkingPapers",
      "PREPARER"
    );
    const attachment = await this.requireAttachment(projectId, attachmentId);
    requireMatchingPlaceholderFile(attachment.placeholderType, input);
    return this.fileStorage().createUploadGrant(
      projectId,
      attachment.workingPaperId ?? "unassigned",
      normalizeUploadedFileName(input.fileName),
      input.mimeType
    );
  }

  async confirmAttachmentPlaceholderUpload(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    input: ConfirmAttachmentPlaceholderUploadInput,
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "uploadWorkingPapers",
      "PREPARER"
    );
    const attachment = await this.requireAttachment(projectId, attachmentId);
    requireMatchingPlaceholderFile(attachment.placeholderType, input);
    const objectKey = await this.assertStoredObjectMatches(
      projectId,
      attachment.workingPaperId ?? "unassigned",
      input.objectKey,
      input.fileSize,
      input.mimeType
    );
    return this.commitAttachmentPlaceholderReplacement(
      projectId,
      attachment,
      user,
      {
        fileName: storedObjectFromKey(objectKey).fileName,
        fileUrl: objectKey,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        contentHash: null,
      },
      source
    );
  }

  private async commitAttachmentPlaceholderReplacement(
    projectId: string,
    attachment: Prisma.AttachmentGetPayload<Record<string, never>>,
    user: RequestUser,
    file: {
      fileName: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
      contentHash: string | null;
    },
    source?: AuditLogSource
  ) {
    if (!attachment.placeholderType) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "This attachment is no longer a placeholder"
      );
    }
    const committedAt = new Date();
    const workDate = startOfUtcDate(committedAt);
    const displayName = getAttachmentPlaceholderReplacementName(
      attachment.originalName ?? attachment.fileName,
      file.fileName
    );
    let updated: Awaited<ReturnType<typeof this.prisma.attachment.update>>;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        const current = await tx.attachment.findFirst({
          where: {
            id: attachment.id,
            projectId,
            deletedAt: null,
            placeholderType: attachment.placeholderType,
            headVersionId: null,
          },
        });
        if (!current) {
          throw new ApiBadRequestException(
            "BAD_REQUEST",
            "This placeholder has already been replaced"
          );
        }
        const revision = await createAttachmentRevision(tx, {
          attachmentId: attachment.id,
          projectId,
          version: 1,
          parentVersionId: null,
          sourceVersionId: null,
          fileKind: attachment.fileKind,
          fileName: file.fileName,
          originalName: displayName,
          fileUrl: file.fileUrl,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          contentHash: file.contentHash,
          workDate,
          uploadedBy: user.id,
          uploadedAt: committedAt,
          archivedBy: user.id,
          action: ATTACHMENT_REVISION_ACTIONS.INITIAL,
          createdAt: committedAt,
        });
        return tx.attachment.update({
          where: { id: attachment.id },
          data: {
            placeholderType: null,
            fileName: file.fileName,
            originalName: displayName,
            fileUrl: file.fileUrl,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            contentHash: file.contentHash,
            version: 1,
            headVersionId: revision.id,
            workDate,
            uploadedBy: user.id,
            lastModifiedBy: user.id,
            lastModifiedAt: committedAt,
            ...attachmentPreviewDataForFile({
              fileName: file.fileName,
              originalName: displayName,
              mimeType: file.mimeType,
            }),
          },
          include: ATTACHMENT_USER_INCLUDE,
        });
      });
    } catch (error) {
      await this.fileStorage()
        .deleteObject(file.fileUrl)
        .catch(() => {});
      throw error;
    }
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_PLACEHOLDER_REPLACED",
      targetType: "ATTACHMENT",
      targetId: attachment.id,
      projectId,
      description: `Replace placeholder ${displayName}`,
      source,
    });
    return normalizeAttachmentResponse(updated);
  }

  async createAttachmentUploadGrant(
    projectId: string,
    paperId: string,
    user: RequestUser,
    input: AttachmentUploadGrantInput
  ): Promise<UploadGrant> {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "uploadWorkingPapers",
      "PREPARER"
    );
    await this.requireWorkingPaper(projectId, paperId);
    return this.fileStorage().createUploadGrant(
      projectId,
      paperId,
      normalizeUploadedFileName(input.fileName),
      input.mimeType
    );
  }

  async confirmAttachmentUpload(
    projectId: string,
    paperId: string,
    user: RequestUser,
    input: ConfirmAttachmentUploadInput,
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "uploadWorkingPapers",
      "PREPARER"
    );
    const paper = await this.requireWorkingPaper(projectId, paperId);
    const objectKey = await this.assertStoredObjectMatches(
      projectId,
      paperId,
      input.objectKey,
      input.fileSize,
      input.mimeType
    );
    const originalName = normalizeUploadedFileName(input.fileName);
    const stored = storedObjectFromKey(objectKey);
    const lastModifiedAt = new Date();
    const workDate =
      parseAttachmentWorkDate(input.workDate) ?? startOfUtcDate(lastModifiedAt);
    const sortOrder = await this.nextAttachmentSortOrder(
      projectId,
      paper.workflowNodeId,
      paper.bucket
    );
    const attachment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: {
          projectId,
          workingPaperId: paperId,
          ...buildAttachmentIdentityData(paper),
          fileKind: LEGACY_ATTACHMENT_FILE_KIND,
          fileName: stored.fileName,
          originalName,
          fileUrl: objectKey,
          fileSize: input.fileSize,
          mimeType: input.mimeType || "application/octet-stream",
          ...attachmentPreviewDataForFile({
            fileName: stored.fileName,
            originalName,
            mimeType: input.mimeType || "application/octet-stream",
          }),
          sortOrder,
          uploadedBy: user.id,
          lastModifiedBy: user.id,
          lastModifiedAt,
          workDate,
        },
        include: ATTACHMENT_USER_INCLUDE,
      });
      const revision = await createAttachmentRevision(tx, {
        attachmentId: created.id,
        projectId,
        version: 1,
        parentVersionId: null,
        sourceVersionId: null,
        fileKind: LEGACY_ATTACHMENT_FILE_KIND,
        fileName: stored.fileName,
        originalName,
        fileUrl: objectKey,
        fileSize: input.fileSize,
        mimeType: input.mimeType || "application/octet-stream",
        workDate,
        uploadedBy: user.id,
        uploadedAt: lastModifiedAt,
        archivedBy: user.id,
        action: ATTACHMENT_REVISION_ACTIONS.INITIAL,
        createdAt: lastModifiedAt,
      });
      return tx.attachment.update({
        where: { id: created.id },
        data: { headVersionId: revision.id },
        include: ATTACHMENT_USER_INCLUDE,
      });
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_UPLOADED",
      targetType: "ATTACHMENT",
      targetId: attachment.id,
      projectId,
      description: `上传底稿文件 ${attachment.originalName ?? attachment.fileName}`,
      source,
    });
    return attachment;
  }

  async lockAttachment(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "uploadWorkingPapers",
      "PREPARER"
    );
    requireAttachmentFile(
      await this.requireAttachment(projectId, attachmentId)
    );
    return this.claimAttachmentLock(projectId, attachmentId, user, source);
  }

  async openAttachmentMaster(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    requestContext: DesktopMasterOpenRequestContext,
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "uploadWorkingPapers",
      "PREPARER"
    );
    let existing = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, projectId, deletedAt: null },
      include: ATTACHMENT_USER_INCLUDE,
    });
    if (!existing) {
      throw new ApiBadRequestException("NOT_FOUND", "附件不存在");
    }
    requireAttachmentFile(existing);
    if (isDesktopMasterLeaseReclaimable(existing, new Date())) {
      await this.reclaimExpiredDesktopMasterLock(existing, new Date());
      existing = await this.prisma.attachment.findFirst({
        where: { id: attachmentId, projectId, deletedAt: null },
        include: ATTACHMENT_USER_INCLUDE,
      });
      if (!existing) {
        throw new ApiBadRequestException("NOT_FOUND", "附件不存在");
      }
    }
    this.requireDesktopOpenSupportedAttachment(existing);
    if (existing.conflictFrozenAt) {
      throw new ApiBadRequestException(
        "CONFLICT_FROZEN",
        "This file is frozen until its version conflict is resolved."
      );
    }
    if (hasActiveLock(existing)) {
      if (existing.lockedBy === user.id) {
        return {
          ok: false as const,
          code: "ALREADY_MASTER" as const,
          attachmentId,
          lockSessionId: existing.lockSessionId,
        };
      }
      return {
        ok: false as const,
        code: "LOCKED_BY_OTHER" as const,
        holderName: existing.lockHolder?.name ?? "其他成员",
      };
    }

    const lockedAt = new Date();
    const lockExpiresAt = new Date(lockedAt.getTime() + LOCK_DURATION_MS);
    const lockSessionId = randomUUID();
    const grantSecret = createDesktopGrantSecret();
    await this.prisma.$transaction(async (tx) => {
      const txClient = tx;
      const updatedCount = await txClient.attachment.updateMany({
        where: {
          id: attachmentId,
          projectId,
          deletedAt: null,
          lockedBy: null,
          lockSessionId: null,
          lockEpoch: existing.lockEpoch,
          conflictFrozenAt: null,
        },
        data: {
          lockEpoch: { increment: 1 },
          lockedBy: user.id,
          lockedAt,
          lockExpiresAt,
          lockSessionId,
          lockHeartbeatAt: lockedAt,
          lockStaleAt: null,
          lockRevokedAt: null,
          lockRevokedBy: null,
          lockReleaseReason: null,
        },
      });
      if (updatedCount.count === 0) {
        throw new ApiBadRequestException(
          "BAD_REQUEST",
          "该文件已被其他成员锁定"
        );
      }
      await txClient.desktopMasterGrant.create({
        data: {
          lockSessionId,
          projectId,
          attachmentId,
          userId: user.id,
          secretHash: hashDesktopGrantSecret(grantSecret),
          allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
          issuedAt: lockedAt,
          expiresAt: lockExpiresAt,
        },
      });
      await txClient.auditLog.create({
        data: {
          actorId: user.id,
          action: "ATTACHMENT_MASTER_OPENED",
          targetType: "ATTACHMENT",
          targetId: attachmentId,
          projectId,
          description: `打开 Master 文件 ${existing.originalName ?? existing.fileName}`,
          ipAddress: source?.ipAddress,
          userAgent: source?.userAgent,
        },
      });
    });

    return {
      ok: true as const,
      lockSessionId,
      grantSecret,
      attachmentId,
      projectId,
      fileName: existing.originalName ?? existing.fileName,
      version: existing.version,
      baseVersionId: existing.headVersionId ?? undefined,
      lockEpoch: existing.lockEpoch + 1,
      contentToken: buildAttachmentContentToken(existing),
      contentHash: existing.contentHash ?? undefined,
      cacheVersionId: buildAttachmentCacheVersionId(existing),
      cacheOwnerId: user.id,
      fileSize: existing.fileSize,
      mimeType: existing.mimeType,
      directUploadSupported: supportsDesktopDirectTransfer(this.fileStorage()),
      downloadUrl: buildAttachmentDownloadUrl(
        requestContext,
        projectId,
        attachmentId
      ),
    };
  }

  async recoverAttachmentMaster(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    requestContext: DesktopMasterOpenRequestContext,
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "uploadWorkingPapers",
      "PREPARER"
    );
    const attachment = await this.requireAttachment(projectId, attachmentId);
    requireAttachmentFile(attachment);
    this.requireDesktopOpenSupportedAttachment(attachment);
    if (attachment.conflictFrozenAt) {
      throw new ApiBadRequestException(
        "CONFLICT_FROZEN",
        "This file is frozen until its version conflict is resolved."
      );
    }
    if (
      !hasActiveLock(attachment) ||
      attachment.lockedBy !== user.id ||
      !attachment.lockSessionId
    ) {
      throw new ApiBadRequestException(
        "LOCK_REVOKED",
        "You do not hold an active Master session for this file."
      );
    }

    const recoveredAt = new Date();
    const lockExpiresAt = new Date(recoveredAt.getTime() + LOCK_DURATION_MS);
    const grantSecret = createDesktopGrantSecret();
    await this.prisma.$transaction(async (tx) => {
      const txClient = tx;
      const recovered = await txClient.attachment.updateMany({
        where: {
          id: attachmentId,
          projectId,
          deletedAt: null,
          lockedBy: user.id,
          lockSessionId: assertPresentValue(attachment.lockSessionId),
          lockEpoch: attachment.lockEpoch,
          lockRevokedAt: null,
          ...desktopMasterAttachmentLeaseWhere(recoveredAt),
        },
        data: {
          lockHeartbeatAt: recoveredAt,
          lockExpiresAt,
          lockStaleAt: null,
        },
      });
      if (recovered.count !== 1) {
        throw new ApiBadRequestException(
          "LOCK_SESSION_MISMATCH",
          "Desktop Master session changed while it was being recovered."
        );
      }
      await txClient.desktopMasterGrant.create({
        data: {
          lockSessionId: assertPresentValue(attachment.lockSessionId),
          projectId,
          attachmentId,
          userId: user.id,
          secretHash: hashDesktopGrantSecret(grantSecret),
          allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
          issuedAt: recoveredAt,
          expiresAt: lockExpiresAt,
        },
      });
      await txClient.auditLog.create({
        data: {
          actorId: user.id,
          action: "ATTACHMENT_MASTER_RECOVERED",
          targetType: "ATTACHMENT",
          targetId: attachmentId,
          projectId,
          description: `Recover desktop Master file ${attachment.originalName ?? attachment.fileName}`,
          ipAddress: source?.ipAddress,
          userAgent: source?.userAgent,
        },
      });
    });

    return {
      ok: true as const,
      lockSessionId: attachment.lockSessionId,
      grantSecret,
      attachmentId,
      projectId,
      fileName: attachment.originalName ?? attachment.fileName,
      version: attachment.version,
      baseVersionId: attachment.headVersionId ?? undefined,
      lockEpoch: attachment.lockEpoch,
      contentToken: buildAttachmentContentToken(attachment),
      contentHash: attachment.contentHash ?? undefined,
      cacheVersionId: buildAttachmentCacheVersionId(attachment),
      cacheOwnerId: user.id,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      directUploadSupported: supportsDesktopDirectTransfer(this.fileStorage()),
      downloadUrl: buildAttachmentDownloadUrl(
        requestContext,
        projectId,
        attachmentId
      ),
    };
  }

  private async claimAttachmentLock(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const lockedAt = new Date();
    const lockExpiresAt = new Date(lockedAt.getTime() + LOCK_DURATION_MS);
    const lockSessionId = randomUUID();
    const result = await this.prisma.attachment.updateMany({
      where: {
        id: attachmentId,
        projectId,
        deletedAt: null,
        lockedBy: null,
      },
      data: {
        lockedBy: user.id,
        lockedAt,
        lockExpiresAt,
        lockSessionId,
        lockHeartbeatAt: lockedAt,
        lockStaleAt: null,
        lockRevokedAt: null,
        lockRevokedBy: null,
        lockReleaseReason: null,
      },
    });
    if (result.count === 0) {
      const blocked = await this.prisma.attachment.findFirst({
        where: { id: attachmentId, projectId, deletedAt: null },
        include: ATTACHMENT_USER_INCLUDE,
      });
      if (!blocked) {
        throw new ApiBadRequestException("NOT_FOUND", "附件不存在");
      }
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        `该文件已被 ${blocked.lockHolder?.name ?? "其他成员"} 锁定`
      );
    }
    const updated = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, projectId, deletedAt: null },
      include: ATTACHMENT_USER_INCLUDE,
    });
    if (!updated) {
      throw new ApiBadRequestException("NOT_FOUND", "附件不存在");
    }
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_LOCKED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `锁定文件 ${updated.originalName ?? updated.fileName}`,
      source,
    });
    return updated;
  }

  async unlockAttachment(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const attachment = await this.requireAttachment(projectId, attachmentId);
    requireAttachmentFile(attachment);
    if (
      attachment.lockedBy &&
      attachment.lockedBy !== user.id &&
      user.globalRole !== "SUPER_ADMIN" &&
      !canGlobalRoleManageProjectMembers(user.globalRole)
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "只有锁定人或项目负责人可以解锁"
      );
    }
    const released = await this.prisma.attachment.updateMany({
      where: {
        id: attachmentId,
        projectId,
        deletedAt: null,
        lockedBy: attachment.lockedBy,
        lockSessionId: assertPresentValue(attachment.lockSessionId),
        lockEpoch: attachment.lockEpoch,
      },
      data: {
        lockEpoch: { increment: 1 },
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        lockSessionId: null,
        lockHeartbeatAt: null,
        lockStaleAt: null,
        lockRevokedAt: null,
        lockRevokedBy: null,
        lockReleaseReason: "UNCHANGED_RELEASE",
      },
    });
    if (released.count !== 1) {
      throw new ApiBadRequestException(
        "LOCK_SESSION_MISMATCH",
        "Attachment lock changed while it was being released."
      );
    }
    await this.revokeDesktopMasterGrantForSession(attachment.lockSessionId);
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_UNLOCKED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `解锁文件 ${attachment.originalName ?? attachment.fileName}`,
      source,
    });
    return this.requireAttachment(projectId, attachmentId);
  }

  async uploadNewAttachmentVersion(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    file: UploadedWorkflowFile,
    input: { workDate?: string } = {},
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "uploadWorkingPapers",
      "PREPARER"
    );
    const attachment = await this.requireAttachment(projectId, attachmentId);
    this.requireAttachmentNotConflictFrozen(attachment);
    this.requireNoDesktopMasterHeadMutation(attachment);
    if (hasActiveLock(attachment) && attachment.lockedBy !== user.id) {
      throw new ApiBadRequestException("BAD_REQUEST", "该文件已被其他成员锁定");
    }
    if (!hasActiveLock(attachment) || attachment.lockedBy !== user.id) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "请先锁定该文件后再上传新版本"
      );
    }
    if (!file?.buffer?.length) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "请上传文件");
    }
    const originalName = normalizeUploadedFileName(file.originalname);
    const stored = await this.writeUploadedFile(
      projectId,
      attachment.workingPaperId ?? "unassigned",
      file
    );
    const uploadedContentHash = createHash("sha256")
      .update(file.buffer)
      .digest("hex");
    const lastModifiedAt = new Date();
    const workDate =
      parseAttachmentWorkDate(input.workDate) ?? startOfUtcDate(lastModifiedAt);
    const updated = await this.prisma.$transaction(async (tx) => {
      const parentVersionId = await resolveAttachmentHeadVersionId(
        tx,
        attachment
      );
      const nextVersion = await nextAttachmentRevisionNumber(
        tx,
        attachmentId,
        attachment.version
      );
      const revision = await createAttachmentRevision(tx, {
        attachmentId,
        projectId,
        version: nextVersion,
        parentVersionId,
        sourceVersionId: null,
        fileKind: attachment.fileKind,
        fileName: stored.fileName,
        originalName,
        fileUrl: stored.fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype || "application/octet-stream",
        contentHash: uploadedContentHash,
        workDate,
        uploadedBy: user.id,
        uploadedAt: lastModifiedAt,
        archivedBy: user.id,
        action: ATTACHMENT_REVISION_ACTIONS.UPLOAD,
        createdAt: lastModifiedAt,
      });
      return tx.attachment.update({
        where: { id: attachmentId },
        data: {
          fileName: stored.fileName,
          originalName,
          fileUrl: stored.fileUrl,
          fileSize: file.size,
          mimeType: file.mimetype || "application/octet-stream",
          contentHash: uploadedContentHash,
          version: nextVersion,
          headVersionId: revision.id,
          workDate,
          uploadedBy: user.id,
          lastModifiedBy: user.id,
          lastModifiedAt,
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          lockSessionId: null,
          lockHeartbeatAt: null,
          lockStaleAt: null,
          lockRevokedAt: null,
          lockRevokedBy: null,
          lockReleaseReason: "CHECKED_IN",
          ...attachmentPreviewDataForCommittedFile(attachment, {
            fileName: stored.fileName,
            originalName,
            mimeType: file.mimetype || "application/octet-stream",
            version: nextVersion,
            contentHash: uploadedContentHash,
          }),
        },
        include: ATTACHMENT_USER_INCLUDE,
      });
    });
    await this.revokeDesktopMasterGrantForSession(attachment.lockSessionId);
    if (attachment.contentHash?.trim().toLowerCase() !== uploadedContentHash) {
      await Promise.allSettled([
        this.pdfRasterPreviewService().clearAttachmentPreviewCache(attachment),
        this.spreadsheetPreviewCacheService().clearAttachmentPreviewCache(
          attachment
        ),
      ]);
    }
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_VERSION_UPLOADED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `上传文件新版本 ${originalName}`,
      source,
    });
    return updated;
  }

  async createAttachmentVersionUploadGrant(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    input: AttachmentVersionUploadGrantInput
  ): Promise<UploadGrant> {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "uploadWorkingPapers",
      "PREPARER"
    );
    const attachment = await this.requireAttachment(projectId, attachmentId);
    this.requireAttachmentNotConflictFrozen(attachment);
    this.requireNoDesktopMasterHeadMutation(attachment);
    this.requireUserActiveAttachmentLock(attachment, user.id);
    return this.fileStorage().createUploadGrant(
      projectId,
      attachment.workingPaperId ?? "unassigned",
      normalizeUploadedFileName(input.fileName),
      input.mimeType
    );
  }

  async confirmAttachmentVersionUpload(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    input: ConfirmAttachmentVersionUploadInput,
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "uploadWorkingPapers",
      "PREPARER"
    );
    const attachment = await this.requireAttachment(projectId, attachmentId);
    this.requireAttachmentNotConflictFrozen(attachment);
    this.requireNoDesktopMasterHeadMutation(attachment);
    this.requireUserActiveAttachmentLock(attachment, user.id);
    const objectKey = await this.assertStoredObjectMatches(
      projectId,
      attachment.workingPaperId ?? "unassigned",
      input.objectKey,
      input.fileSize,
      input.mimeType
    );
    const originalName = normalizeUploadedFileName(input.fileName);
    const stored = storedObjectFromKey(objectKey);
    const lastModifiedAt = new Date();
    const workDate =
      parseAttachmentWorkDate(input.workDate) ?? startOfUtcDate(lastModifiedAt);
    const updated = await this.prisma.$transaction(async (tx) => {
      const parentVersionId = await resolveAttachmentHeadVersionId(
        tx,
        attachment
      );
      const nextVersion = await nextAttachmentRevisionNumber(
        tx,
        attachmentId,
        attachment.version
      );
      const revision = await createAttachmentRevision(tx, {
        attachmentId,
        projectId,
        version: nextVersion,
        parentVersionId,
        sourceVersionId: null,
        fileKind: attachment.fileKind,
        fileName: stored.fileName,
        originalName,
        fileUrl: objectKey,
        fileSize: input.fileSize,
        mimeType: input.mimeType || "application/octet-stream",
        contentHash: null,
        workDate,
        uploadedBy: user.id,
        uploadedAt: lastModifiedAt,
        archivedBy: user.id,
        action: ATTACHMENT_REVISION_ACTIONS.UPLOAD,
        createdAt: lastModifiedAt,
      });
      return tx.attachment.update({
        where: { id: attachmentId },
        data: {
          fileName: stored.fileName,
          originalName,
          fileUrl: objectKey,
          fileSize: input.fileSize,
          mimeType: input.mimeType || "application/octet-stream",
          contentHash: null,
          version: nextVersion,
          headVersionId: revision.id,
          workDate,
          uploadedBy: user.id,
          lastModifiedBy: user.id,
          lastModifiedAt,
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          lockSessionId: null,
          lockHeartbeatAt: null,
          lockStaleAt: null,
          lockRevokedAt: null,
          lockRevokedBy: null,
          lockReleaseReason: "CHECKED_IN",
          ...attachmentPreviewDataForFile({
            fileName: stored.fileName,
            originalName,
            mimeType: input.mimeType || "application/octet-stream",
          }),
        },
        include: ATTACHMENT_USER_INCLUDE,
      });
    });
    await this.revokeDesktopMasterGrantForSession(attachment.lockSessionId);
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_VERSION_UPLOADED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `上传文件新版本 ${originalName}`,
      source,
    });
    return updated;
  }

  async prepareDesktopMasterUpload(input: DesktopMasterUploadPrepareInput) {
    await this.requireDesktopMasterGrant(input, "CHECK_IN", {
      allowRevoked: true,
    });
    const previous = await this.prisma.desktopCheckInIdempotency.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    const objectKey = buildDesktopCheckInObjectKey(input);
    if (previous?.status === "SUCCEEDED") {
      this.assertDesktopCheckInIdempotencyMatches(previous, input);
      return {
        ok: true as const,
        mode: "ALREADY_UPLOADED" as const,
        objectKey,
      };
    }
    return this.fileStorage().createResumableUploadGrant({
      objectKey,
      contentType: input.mimeType,
      fileSize: input.fileSize,
      contentSha256: input.localContentHash,
      contentCrc64: input.localContentCrc64,
      resumeUploadId: input.resumeUploadId,
    });
  }

  async completeDesktopMasterUpload(input: DesktopMasterUploadCompleteInput) {
    await this.requireDesktopMasterGrant(input, "CHECK_IN", {
      allowRevoked: true,
    });
    assertDesktopCheckInObjectKey(input, input.objectKey);
    await this.fileStorage().completeResumableUpload({
      objectKey: input.objectKey,
      uploadId: input.uploadId,
      parts: input.parts,
      fileSize: input.fileSize,
      contentSha256: input.localContentHash,
      contentCrc64: input.localContentCrc64,
    });
    return { ok: true as const, objectKey: input.objectKey };
  }

  async checkInDesktopMasterSession(
    input: DesktopMasterCheckInInput,
    file?: UploadedWorkflowFile,
    source?: AuditLogSource
  ) {
    const idempotencyStore = this.prisma.desktopCheckInIdempotency;
    const previous = await idempotencyStore.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (previous) {
      this.assertDesktopCheckInIdempotencyMatches(previous, input);
    }
    if (previous?.status === "SUCCEEDED" && previous.responseJson) {
      const previousGrant = await this.findDesktopMasterGrant(input);
      this.assertDesktopMasterGrant(previousGrant, input, "CHECK_IN", {
        allowRevoked: true,
      });
      return previous.responseJson;
    }

    const grant = await this.findDesktopMasterGrant(input);
    this.assertDesktopMasterGrant(grant, input, "CHECK_IN", {
      allowRevoked: true,
    });
    await this.requireProjectActionWithRole(
      input.projectId,
      grant.userId,
      "uploadWorkingPapers",
      "PREPARER"
    );
    const attachment = await this.requireAttachment(
      input.projectId,
      input.attachmentId
    );
    const directUpload = input.objectKey
      ? await this.resolveDesktopCheckInObject(input)
      : null;
    if (!directUpload && !file?.buffer?.length) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "请上传文件");
    }
    const uploadedContentHash = directUpload
      ? input.localContentHash.toLowerCase()
      : createHash("sha256")
          .update((file as UploadedWorkflowFile).buffer)
          .digest("hex");
    if (uploadedContentHash !== input.localContentHash.toLowerCase()) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Uploaded bytes do not match localContentHash."
      );
    }
    const attemptStartedAt = new Date();
    const attemptToken = randomUUID();
    const attemptLeaseExpiresAt = new Date(
      attemptStartedAt.getTime() + DESKTOP_CHECK_IN_ATTEMPT_LEASE_MS
    );
    if (previous?.status === "FAILED") {
      const retried = await idempotencyStore.updateMany({
        where: {
          idempotencyKey: input.idempotencyKey,
          status: "FAILED",
        },
        data: {
          status: "IN_PROGRESS",
          responseJson: Prisma.DbNull,
          attemptToken,
          leaseExpiresAt: attemptLeaseExpiresAt,
        },
      });
      if (retried.count !== 1) {
        throw desktopCheckInAlreadyInProgress();
      }
    } else if (previous?.status === "IN_PROGRESS") {
      const takeover = await idempotencyStore.updateMany({
        where: {
          idempotencyKey: input.idempotencyKey,
          status: "IN_PROGRESS",
          OR: [
            { leaseExpiresAt: { lt: attemptStartedAt } },
            {
              leaseExpiresAt: null,
              updatedAt: {
                lt: new Date(
                  attemptStartedAt.getTime() - DESKTOP_CHECK_IN_ATTEMPT_LEASE_MS
                ),
              },
            },
          ],
        },
        data: {
          responseJson: Prisma.DbNull,
          attemptToken,
          leaseExpiresAt: attemptLeaseExpiresAt,
        },
      });
      if (takeover.count !== 1) {
        throw desktopCheckInAlreadyInProgress();
      }
    } else {
      try {
        await idempotencyStore.create({
          data: {
            lockSessionId: input.lockSessionId,
            idempotencyKey: input.idempotencyKey,
            projectId: input.projectId,
            attachmentId: input.attachmentId,
            localContentHash: input.localContentHash,
            status: "IN_PROGRESS",
            attemptToken,
            leaseExpiresAt: attemptLeaseExpiresAt,
          },
        });
      } catch (error) {
        if (isPrismaUniqueConstraintError(error)) {
          throw desktopCheckInAlreadyInProgress();
        }
        throw error;
      }
    }

    let idempotencySucceeded = false;
    try {
      const originalName = normalizeUploadedFileName(
        directUpload?.fileName ?? file?.originalname ?? attachment.fileName
      );
      const stored = directUpload
        ? {
            fileName: pathModule.basename(directUpload.objectKey),
            fileUrl: directUpload.objectKey,
          }
        : await this.writeUploadedFile(
            input.projectId,
            attachment.workingPaperId ?? "unassigned",
            file as UploadedWorkflowFile
          );
      const checkedInFileSize = directUpload?.fileSize ?? file?.size ?? 0;
      const checkedInMimeType =
        directUpload?.mimeType ?? file?.mimetype ?? "application/octet-stream";
      const lastModifiedAt = new Date();
      const response = await this.prisma.$transaction(async (tx) => {
        const txClient = tx;
        const currentAttachment =
          typeof txClient.attachment.findFirst === "function"
            ? await txClient.attachment.findFirst({
                where: {
                  id: input.attachmentId,
                  projectId: input.projectId,
                  deletedAt: null,
                },
                include: ATTACHMENT_USER_INCLUDE,
              })
            : attachment;
        if (!currentAttachment) {
          throw new ApiBadRequestException("NOT_FOUND", "附件不存在");
        }
        const exactBaseMatches =
          currentAttachment.version === input.baseVersion &&
          (!input.baseVersionId ||
            currentAttachment.headVersionId === input.baseVersionId) &&
          (input.lockEpoch === undefined ||
            currentAttachment.lockEpoch === input.lockEpoch);
        const sessionStillOwnsLock =
          currentAttachment.lockedBy === grant.userId &&
          currentAttachment.lockSessionId === input.lockSessionId &&
          (input.lockEpoch === undefined ||
            currentAttachment.lockEpoch === input.lockEpoch);
        const activeSessionMatches =
          !grant.revokedAt &&
          isDesktopMasterLeaseAlive(currentAttachment, lastModifiedAt) &&
          isDesktopMasterGrantLeaseAlive(grant, lastModifiedAt) &&
          sessionStillOwnsLock;
        const isConflict =
          !exactBaseMatches ||
          !activeSessionMatches ||
          Boolean(currentAttachment.conflictFrozenAt);
        const parentVersionId = await resolveAttachmentHeadVersionId(
          tx,
          currentAttachment
        );
        const nextVersion = await nextAttachmentRevisionNumber(
          tx,
          input.attachmentId,
          currentAttachment.version
        );
        if (isConflict) {
          const baseVersion = input.baseVersionId
            ? await tx.attachmentVersion.findFirst({
                where: {
                  id: input.baseVersionId,
                  attachmentId: input.attachmentId,
                },
                select: { id: true },
              })
            : await tx.attachmentVersion.findFirst({
                where: {
                  attachmentId: input.attachmentId,
                  version: input.baseVersion,
                },
                select: { id: true },
              });
          const candidate = await createAttachmentRevision(
            tx,
            {
              attachmentId: input.attachmentId,
              projectId: input.projectId,
              version: nextVersion,
              parentVersionId: baseVersion?.id ?? null,
              sourceVersionId: parentVersionId,
              fileKind: currentAttachment.fileKind,
              fileName: stored.fileName,
              originalName,
              fileUrl: stored.fileUrl,
              fileSize: checkedInFileSize,
              mimeType: checkedInMimeType,
              contentHash: uploadedContentHash,
              workDate: currentAttachment.workDate ?? null,
              uploadedBy: grant.userId,
              uploadedAt: lastModifiedAt,
              archivedBy: grant.userId,
              action: ATTACHMENT_REVISION_ACTIONS.CONFLICT_CANDIDATE,
              message: "Desktop check-in diverged from the active server head.",
              conflictState: "OPEN",
              conflictBaseVersionId: baseVersion?.id ?? null,
              conflictServerVersionId: parentVersionId,
              createdAt: lastModifiedAt,
            },
            { isCurrent: false }
          );
          const conflictData = {
            conflictFrozenAt:
              currentAttachment.conflictFrozenAt ?? lastModifiedAt,
            conflictCandidateVersionId: candidate.id,
          };
          if (sessionStillOwnsLock) {
            const fencedConflict = await tx.attachment.updateMany({
              where: {
                id: input.attachmentId,
                projectId: input.projectId,
                deletedAt: null,
                lockedBy: grant.userId,
                lockSessionId: input.lockSessionId,
                lockEpoch: currentAttachment.lockEpoch,
              },
              data: {
                ...conflictData,
                lockEpoch: { increment: 1 },
                lockedBy: null,
                lockedAt: null,
                lockExpiresAt: null,
                lockSessionId: null,
                lockHeartbeatAt: null,
                lockStaleAt: null,
                lockRevokedAt: lastModifiedAt,
                lockRevokedBy: grant.userId,
                lockReleaseReason: "CONFLICT_FROZEN",
              },
            });
            if (fencedConflict.count === 0) {
              await tx.attachment.update({
                where: { id: input.attachmentId },
                data: conflictData,
              });
            }
          } else {
            await tx.attachment.update({
              where: { id: input.attachmentId },
              data: conflictData,
            });
          }
          const result = {
            ok: true as const,
            conflict: true as const,
            attachmentId: input.attachmentId,
            lockSessionId: input.lockSessionId,
            version: currentAttachment.version,
            candidateVersionId: candidate.id,
            serverVersionId: parentVersionId,
            uploaded: true,
            localContentHash: uploadedContentHash,
          };
          const completedAttempt =
            await tx.desktopCheckInIdempotency.updateMany({
              where: {
                idempotencyKey: input.idempotencyKey,
                status: "IN_PROGRESS",
                attemptToken,
              },
              data: {
                status: "SUCCEEDED",
                responseJson: result,
                leaseExpiresAt: null,
              },
            });
          if (completedAttempt.count !== 1) {
            throw desktopCheckInAttemptLost();
          }
          return result;
        }
        const revision = await createAttachmentRevision(tx, {
          attachmentId: input.attachmentId,
          projectId: input.projectId,
          version: nextVersion,
          parentVersionId,
          sourceVersionId: null,
          fileKind: currentAttachment.fileKind,
          fileName: stored.fileName,
          originalName,
          fileUrl: stored.fileUrl,
          fileSize: checkedInFileSize,
          mimeType: checkedInMimeType,
          contentHash: uploadedContentHash,
          workDate: currentAttachment.workDate ?? null,
          uploadedBy: grant.userId,
          uploadedAt: lastModifiedAt,
          archivedBy: grant.userId,
          action: ATTACHMENT_REVISION_ACTIONS.CHECK_IN,
          createdAt: lastModifiedAt,
        });
        const fencedCheckIn = await tx.attachment.updateMany({
          where: {
            id: input.attachmentId,
            projectId: input.projectId,
            deletedAt: null,
            lockedBy: grant.userId,
            lockSessionId: input.lockSessionId,
            lockEpoch: currentAttachment.lockEpoch,
            lockRevokedAt: null,
            ...desktopMasterAttachmentLeaseWhere(lastModifiedAt),
          },
          data: {
            fileName: stored.fileName,
            originalName,
            fileUrl: stored.fileUrl,
            fileSize: checkedInFileSize,
            mimeType: checkedInMimeType,
            version: nextVersion,
            headVersionId: revision.id,
            contentHash: uploadedContentHash,
            uploadedBy: grant.userId,
            lastModifiedBy: grant.userId,
            lastModifiedAt,
            lockedBy: grant.userId,
            lockSessionId: input.lockSessionId,
            lockHeartbeatAt: lastModifiedAt,
            lockExpiresAt: new Date(
              lastModifiedAt.getTime() + LOCK_DURATION_MS
            ),
            lockStaleAt: null,
            ...attachmentPreviewDataForCommittedFile(currentAttachment, {
              fileName: stored.fileName,
              originalName,
              mimeType: checkedInMimeType,
              version: nextVersion,
              contentHash: uploadedContentHash,
            }),
          },
        });
        if (fencedCheckIn.count !== 1) {
          throw new ApiBadRequestException(
            "LOCK_SESSION_MISMATCH",
            "Desktop Master session changed while the check-in was committing."
          );
        }
        const result = {
          ok: true as const,
          conflict: false as const,
          attachmentId: input.attachmentId,
          lockSessionId: input.lockSessionId,
          version: nextVersion,
          uploaded: true,
          localContentHash: input.localContentHash,
        };
        const completedAttempt = await tx.desktopCheckInIdempotency.updateMany({
          where: {
            idempotencyKey: input.idempotencyKey,
            status: "IN_PROGRESS",
            attemptToken,
          },
          data: {
            status: "SUCCEEDED",
            responseJson: result,
            leaseExpiresAt: null,
          },
        });
        if (completedAttempt.count !== 1) {
          throw desktopCheckInAttemptLost();
        }
        return result;
      });
      idempotencySucceeded = true;
      if (response.conflict) {
        await this.revokeDesktopMasterGrantForSession(input.lockSessionId);
        await this.notifyAttachmentConflict(input.projectId, attachment, {
          candidateVersionId: response.candidateVersionId,
          uploaderId: grant.userId,
        });
      }
      await this.auditLogs.log({
        actorId: grant.userId,
        action: response.conflict
          ? "ATTACHMENT_CONFLICT_PRESERVED"
          : "ATTACHMENT_CHECKED_IN",
        targetType: "ATTACHMENT",
        targetId: input.attachmentId,
        projectId: input.projectId,
        description: response.conflict
          ? `Preserved conflicting desktop Master candidate ${originalName}`
          : `Check in desktop Master file ${originalName}`,
        source,
      });
      return response;
    } catch (error) {
      if (!idempotencySucceeded) {
        await Promise.resolve(
          idempotencyStore.updateMany({
            where: {
              idempotencyKey: input.idempotencyKey,
              status: "IN_PROGRESS",
              attemptToken,
            },
            data: { status: "FAILED", leaseExpiresAt: null },
          })
        ).catch(() => {});
      }
      throw error;
    }
  }

  private async resolveDesktopCheckInObject(input: DesktopMasterCheckInInput) {
    if (
      !input.objectKey ||
      !input.fileName ||
      input.fileSize === undefined ||
      !input.mimeType
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Desktop direct upload metadata is invalid."
      );
    }
    assertDesktopCheckInObjectKey(input, input.objectKey);
    await this.fileStorage().assertUploadedObject(
      input.objectKey,
      input.fileSize,
      input.localContentHash,
      input.localContentCrc64
    );
    return {
      objectKey: input.objectKey,
      fileName: input.fileName,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
    };
  }

  async releaseDesktopMasterSession(
    input: DesktopMasterReleaseInput,
    source?: AuditLogSource
  ) {
    const grant = await this.findDesktopMasterGrant(input);
    if (input.reason === "RECOVERY_ENDED" && grant?.revokedAt) {
      const removed = await this.prisma.attachment.findFirst({
        where: {
          id: input.attachmentId,
          projectId: input.projectId,
          deletedAt: { not: null },
        },
        select: { id: true, deletedAt: true },
      });
      if (removed?.deletedAt) {
        this.assertDesktopMasterGrant(grant, input, "RELEASE", {
          allowRevoked: true,
        });
        return {
          ok: true as const,
          recoveryEnded: true,
          attachmentId: input.attachmentId,
          lockSessionId: input.lockSessionId,
        };
      }
    }
    const attachment = await this.requireAttachment(
      input.projectId,
      input.attachmentId
    );
    if (input.reason === "RECOVERY_ENDED" && !grant) {
      throw new ApiBadRequestException(
        "CONFLICT_RISK",
        "The old grant could not be verified. Ask the project administrator to check its lock; keep the local recovery record."
      );
    }
    this.assertDesktopMasterGrant(grant, input, "RELEASE", {
      allowRevoked: true,
    });
    if (
      input.reason === "RECOVERY_ENDED" &&
      attachment.lockSessionId !== input.lockSessionId
    ) {
      return {
        ok: true as const,
        recoveryEnded: true,
        attachmentId: input.attachmentId,
        lockSessionId: input.lockSessionId,
      };
    }
    if (grant.revokedAt) {
      if (this.isIdempotentDesktopReleaseRetry(attachment, input)) {
        return {
          ok: true as const,
          attachmentId: input.attachmentId,
          lockSessionId: input.lockSessionId,
          attachment,
        };
      }
      throw new ApiBadRequestException(
        "LOCK_REVOKED",
        "Desktop Master grant is no longer active."
      );
    }
    this.requireMatchingDesktopMasterSession(attachment, input, grant.userId);
    const releasedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const txClient = tx;
      const released = await txClient.attachment.updateMany({
        where: {
          id: input.attachmentId,
          projectId: input.projectId,
          deletedAt: null,
          lockedBy: grant.userId,
          lockSessionId: input.lockSessionId,
          lockEpoch: attachment.lockEpoch,
          lockRevokedAt: null,
        },
        data: {
          lockEpoch: { increment: 1 },
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          lockSessionId: null,
          lockHeartbeatAt: null,
          lockStaleAt: null,
          lockRevokedAt: null,
          lockRevokedBy: null,
          lockReleaseReason: input.reason,
        },
      });
      if (released.count !== 1) {
        throw new ApiBadRequestException(
          "LOCK_SESSION_MISMATCH",
          "Desktop Master session changed while it was being released."
        );
      }
      await txClient.desktopMasterGrant.updateMany({
        where: { lockSessionId: input.lockSessionId, revokedAt: null },
        data: { revokedAt: releasedAt, lastUsedAt: releasedAt },
      });
      await txClient.auditLog.create({
        data: {
          actorId: grant.userId,
          action: "ATTACHMENT_MASTER_RELEASED",
          targetType: "ATTACHMENT",
          targetId: input.attachmentId,
          projectId: input.projectId,
          description: `Release desktop Master file ${attachment.originalName ?? attachment.fileName}`,
          ipAddress: source?.ipAddress,
          userAgent: source?.userAgent,
        },
      });
      return {
        ...attachment,
        lockEpoch: attachment.lockEpoch + 1,
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        lockSessionId: null,
        lockHeartbeatAt: null,
        lockStaleAt: null,
        lockRevokedAt: null,
        lockRevokedBy: null,
        lockReleaseReason: input.reason,
      };
    });
    return {
      ok: true as const,
      attachmentId: input.attachmentId,
      lockSessionId: input.lockSessionId,
      attachment: updated,
      ...(input.reason === "RECOVERY_ENDED" ? { recoveryEnded: true } : {}),
    };
  }

  async heartbeatDesktopMasterSession(input: DesktopMasterHeartbeatInput) {
    const grant = await this.findDesktopMasterGrant(input);
    if (grant?.revokedAt) {
      const removed = await this.prisma.attachment.findFirst({
        where: {
          id: input.attachmentId,
          projectId: input.projectId,
          deletedAt: { not: null },
        },
        select: { id: true, deletedAt: true },
      });
      if (removed?.deletedAt) {
        throw new ApiConflictException(
          "SERVER_FILE_REMOVED",
          "This file was removed from the project. The local copy has been preserved."
        );
      }
    }
    this.assertDesktopMasterGrant(grant, input, "HEARTBEAT");
    await this.requireProjectActionWithRole(
      input.projectId,
      grant.userId,
      "uploadWorkingPapers",
      "PREPARER"
    );
    const attachment = await this.requireAttachment(
      input.projectId,
      input.attachmentId
    );
    this.requireMatchingDesktopMasterSession(attachment, input, grant.userId);
    const heartbeatAt = new Date();
    const lockExpiresAt = new Date(heartbeatAt.getTime() + LOCK_DURATION_MS);
    await this.prisma.$transaction(async (tx) => {
      const txClient = tx;
      const renewed = await txClient.attachment.updateMany({
        where: {
          id: input.attachmentId,
          projectId: input.projectId,
          deletedAt: null,
          lockedBy: grant.userId,
          lockSessionId: input.lockSessionId,
          lockEpoch: attachment.lockEpoch,
          lockRevokedAt: null,
          ...desktopMasterAttachmentLeaseWhere(heartbeatAt),
        },
        data: {
          lockHeartbeatAt: heartbeatAt,
          lockExpiresAt,
          lockStaleAt: null,
        },
      });
      if (renewed.count !== 1) {
        throw new ApiBadRequestException(
          "LOCK_REVOKED",
          "Desktop Master lease has expired or changed."
        );
      }
      const renewedGrant = await txClient.desktopMasterGrant.updateMany({
        where: {
          id: grant.id,
          lockSessionId: input.lockSessionId,
          revokedAt: null,
          ...desktopMasterGrantLeaseWhere(heartbeatAt),
        },
        data: { lastUsedAt: heartbeatAt, expiresAt: lockExpiresAt },
      });
      if (renewedGrant.count !== 1) {
        throw new ApiBadRequestException(
          "LOCK_REVOKED",
          "Desktop Master grant has expired or changed."
        );
      }
    });
    return {
      ok: true as const,
      attachmentId: input.attachmentId,
      lockSessionId: input.lockSessionId,
      version: attachment.version,
      lockHeartbeatAt: heartbeatAt.toISOString(),
    };
  }

  async forceReleaseAttachmentMaster(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const member = await this.access.requireProjectMember(projectId, user.id);
    if (
      user.globalRole !== "SUPER_ADMIN" &&
      member.projectRole !== "PARTNER" &&
      !canGlobalRoleManageProjectMembers(user.globalRole)
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only managers or partners can force release desktop Master."
      );
    }
    const attachment = await this.requireAttachment(projectId, attachmentId);
    if (!hasActiveLock(attachment) || !attachment.lockSessionId) {
      return normalizeAttachmentResponse(attachment);
    }
    const revokedAt = new Date();
    const released = await this.prisma.$transaction(async (tx) => {
      const txClient = tx;
      const fencedRelease = await txClient.attachment.updateMany({
        where: {
          id: attachmentId,
          projectId,
          deletedAt: null,
          lockedBy: attachment.lockedBy,
          lockSessionId: attachment.lockSessionId,
          lockEpoch: attachment.lockEpoch,
          lockRevokedAt: null,
        },
        data: {
          lockEpoch: { increment: 1 },
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          lockSessionId: null,
          lockHeartbeatAt: null,
          lockStaleAt: null,
          lockRevokedAt: revokedAt,
          lockRevokedBy: user.id,
          lockReleaseReason: "FORCE_RELEASED",
        },
      });
      if (fencedRelease.count !== 1) {
        return false;
      }
      await txClient.desktopMasterGrant.updateMany({
        where: {
          lockSessionId: assertPresentValue(attachment.lockSessionId),
          revokedAt: null,
        },
        data: { revokedAt, lastUsedAt: revokedAt },
      });
      await txClient.auditLog.create({
        data: {
          actorId: user.id,
          action: "ATTACHMENT_MASTER_FORCE_RELEASED",
          targetType: "ATTACHMENT",
          targetId: attachmentId,
          projectId,
          description: `Force release desktop Master file ${attachment.originalName ?? attachment.fileName}`,
          ipAddress: source?.ipAddress,
          userAgent: source?.userAgent,
        },
      });
      return true;
    });
    if (!released) {
      return normalizeAttachmentResponse(
        await this.requireAttachment(projectId, attachmentId)
      );
    }
    return normalizeAttachmentResponse({
      ...attachment,
      lockEpoch: attachment.lockEpoch + 1,
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
      lockSessionId: null,
      lockHeartbeatAt: null,
      lockStaleAt: null,
      lockRevokedAt: revokedAt,
      lockRevokedBy: user.id,
      lockReleaseReason: "FORCE_RELEASED",
    });
  }

  async deletedAttachments(projectId: string, user: RequestUser) {
    await this.access.requireProjectAction(
      projectId,
      user.id,
      "viewRecycleBin"
    );
    const attachments = await this.prisma.attachment.findMany({
      where: { projectId, deletedAt: { not: null } },
      orderBy: [{ deletedAt: "desc" }, { updatedAt: "desc" }],
      include: ATTACHMENT_USER_INCLUDE,
    });
    return attachments.map(normalizeAttachmentResponse);
  }

  async projectAttachments(projectId: string, user: RequestUser) {
    await this.access.requireProjectMember(projectId, user.id);
    await this.markStaleDesktopMasterSessions(projectId);
    const attachments = await this.prisma.attachment.findMany({
      where: {
        projectId,
        deletedAt: null,
        OR: [
          { workingPaperId: { not: null } },
          { workflowNodeId: { not: null } },
        ],
      },
      orderBy: [
        { workflowNodeId: "asc" },
        { bucket: "asc" },
        { sortOrder: "asc" },
        { lastModifiedAt: "desc" },
        { updatedAt: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        ...ATTACHMENT_USER_INCLUDE,
        smartFormInstance: { select: { status: true } },
        workingPaper: {
          select: {
            id: true,
            code: true,
            title: true,
            bucket: true,
            signoffs: {
              where: { isCurrent: true, revokedAt: null },
              orderBy: { signedAt: "asc" },
              include: { user: { select: USER_SUMMARY_SELECT } },
            },
            reviewQuestions: {
              orderBy: { createdAt: "desc" },
              include: REVIEW_QUESTION_INCLUDE,
            },
            workflowNode: {
              select: {
                id: true,
                code: true,
                title: true,
                level: true,
                parent: {
                  select: {
                    id: true,
                    code: true,
                    title: true,
                    level: true,
                    parent: {
                      select: {
                        id: true,
                        code: true,
                        title: true,
                        level: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        signoffs: {
          where: { isCurrent: true, revokedAt: null },
          orderBy: { signedAt: "asc" },
          include: { user: { select: USER_SUMMARY_SELECT } },
        },
        reviewQuestions: {
          orderBy: { createdAt: "desc" },
          include: REVIEW_QUESTION_INCLUDE,
        },
        workflowNode: {
          select: {
            id: true,
            code: true,
            title: true,
            level: true,
            parent: {
              select: {
                id: true,
                code: true,
                title: true,
                level: true,
                parent: {
                  select: {
                    id: true,
                    code: true,
                    title: true,
                    level: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return attachments.map(normalizeProjectAttachmentResponse);
  }

  private async markStaleDesktopMasterSessions(projectId: string) {
    const staleAt = new Date();
    const staleBefore = new Date(
      staleAt.getTime() - DESKTOP_MASTER_STALE_AFTER_MS
    );
    await this.prisma.attachment.updateMany({
      where: {
        projectId,
        deletedAt: null,
        lockedBy: { not: null },
        lockSessionId: { not: null },
        lockRevokedAt: null,
        lockStaleAt: null,
        OR: [
          { lockHeartbeatAt: { lt: staleBefore } },
          { lockHeartbeatAt: null, lockedAt: { lt: staleBefore } },
        ],
      },
      data: { lockStaleAt: staleAt },
    });
    const attachmentStore = this.prisma.attachment;
    if (typeof attachmentStore.findMany !== "function") {
      return;
    }
    const reclaimable = await attachmentStore.findMany({
      where: {
        projectId,
        deletedAt: null,
        lockedBy: { not: null },
        lockSessionId: { not: null },
        lockRevokedAt: null,
        ...desktopMasterAttachmentExpiredWhere(staleAt),
      },
      select: {
        id: true,
        projectId: true,
        lockedBy: true,
        lockedAt: true,
        lockSessionId: true,
        lockEpoch: true,
        lockExpiresAt: true,
        lockHeartbeatAt: true,
        lockRevokedAt: true,
      },
    });
    for (const attachment of reclaimable) {
      await this.reclaimExpiredDesktopMasterLock(attachment, staleAt);
    }
  }

  private async reclaimExpiredDesktopMasterLock(
    attachment: {
      id: string;
      projectId: string;
      lockedBy: string | null;
      lockedAt?: Date | null;
      lockSessionId?: string | null;
      lockEpoch: number;
      lockExpiresAt?: Date | null;
      lockHeartbeatAt?: Date | null;
      lockRevokedAt?: Date | null;
    },
    reclaimedAt: Date
  ) {
    if (!isDesktopMasterLeaseReclaimable(attachment, reclaimedAt)) {
      return false;
    }
    const attachmentStore = this.prisma.attachment;
    const grantStore = this.prisma.desktopMasterGrant;
    const result = await attachmentStore.updateMany({
      where: {
        id: attachment.id,
        projectId: attachment.projectId,
        lockedBy: attachment.lockedBy,
        lockSessionId: assertPresentValue(attachment.lockSessionId),
        lockEpoch: attachment.lockEpoch,
        lockRevokedAt: null,
        ...desktopMasterAttachmentExpiredWhere(reclaimedAt),
      },
      data: {
        lockEpoch: { increment: 1 },
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        lockSessionId: null,
        lockHeartbeatAt: null,
        lockStaleAt: null,
        lockRevokedAt: reclaimedAt,
        lockRevokedBy: null,
        lockReleaseReason: "LEASE_EXPIRED",
      },
    });
    if (result.count === 0) {
      return false;
    }
    await grantStore.updateMany({
      where: {
        lockSessionId: assertPresentValue(attachment.lockSessionId),
        revokedAt: null,
      },
      data: { revokedAt: reclaimedAt, lastUsedAt: reclaimedAt },
    });
    return true;
  }

  async renameAttachment(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    input: { originalName: string },
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "modifyIndex",
      "PREPARER"
    );
    const attachment = await this.requireAttachment(projectId, attachmentId);
    this.requireAttachmentMetadataEditable(attachment, user);
    const lastModifiedAt = new Date();
    const originalName = attachment.placeholderType
      ? buildAttachmentPlaceholderName(
          input.originalName,
          attachment.placeholderType
        )
      : normalizeUploadedFileName(input.originalName.trim());
    const updated = await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        originalName,
        lastModifiedBy: user.id,
        lastModifiedAt,
      },
      include: ATTACHMENT_USER_INCLUDE,
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_RENAMED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `Renamed attachment ${attachment.originalName ?? attachment.fileName} to ${originalName}`,
      source,
    });
    return normalizeAttachmentResponse(updated);
  }

  async moveAttachment(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    input: RelocateAttachmentTarget,
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "modifyIndex",
      "PREPARER"
    );
    const imported = await this.prisma.confirmationEmpImportItem.findFirst({
      where: { attachmentId, status: "SUCCEEDED", withdrawnAt: null },
      select: { id: true },
    });
    if (imported)
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "请回到函证归档处撤回导入，再重新导入到目标位置"
      );
    const attachment = await this.requireAttachment(projectId, attachmentId);
    this.requireAttachmentMetadataEditable(attachment, user);
    const targetPaper = await this.resolveAttachmentRelocationPaper(
      projectId,
      input,
      attachment,
      user
    );
    const targetSortOrder = await this.nextAttachmentSortOrder(
      projectId,
      targetPaper.workflowNodeId,
      targetPaper.bucket
    );
    const lastModifiedAt = new Date();
    const updateData = {
      workingPaperId: targetPaper.id,
      ...buildAttachmentIdentityData(targetPaper),
      sortOrder: targetSortOrder,
      lastModifiedBy: user.id,
      lastModifiedAt,
    };
    let updated: Awaited<ReturnType<typeof this.prisma.attachment.update>>;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        const changed = await tx.attachment.update({
          where: { id: attachmentId },
          data: updateData,
          include: ATTACHMENT_USER_INCLUDE,
        });
        if (attachment.workingPaperId) {
          const remainingActiveAttachments = await tx.attachment.count({
            where: {
              projectId,
              workingPaperId: attachment.workingPaperId,
              deletedAt: null,
            },
          });
          if (remainingActiveAttachments === 0) {
            await tx.workingPaper.delete({
              where: { id: attachment.workingPaperId },
            });
          }
        }
        return changed;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiBadRequestException(
          "DUPLICATE_CODE",
          "Relocation target paper code already exists; please try again"
        );
      }
      throw error;
    }
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_MOVED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `Moved attachment ${attachment.originalName ?? attachment.fileName} to ${targetPaper.code}`,
      source,
    });
    return normalizeAttachmentResponse(updated);
  }

  async copyAttachment(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    input: RelocateAttachmentTarget,
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "modifyIndex",
      "PREPARER"
    );
    const attachment = await this.requireAttachment(projectId, attachmentId);
    this.requireAttachmentMetadataEditable(attachment, user);
    const targetPaper = await this.resolveAttachmentRelocationPaper(
      projectId,
      input,
      attachment,
      user
    );
    const targetSortOrder = await this.nextAttachmentSortOrder(
      projectId,
      targetPaper.workflowNodeId,
      targetPaper.bucket
    );
    const lastModifiedAt = new Date();
    const isPlaceholder = Boolean(attachment.placeholderType);
    const copied = await this.prisma.$transaction(async (tx) => {
      const txClient = tx;
      let copiedAttachment = await txClient.attachment.create({
        data: {
          projectId,
          workingPaperId: targetPaper.id,
          ...buildAttachmentIdentityData(targetPaper),
          sortOrder: targetSortOrder,
          fileKind: attachment.fileKind,
          placeholderType: attachment.placeholderType,
          fileName: attachment.fileName,
          originalName: attachment.originalName,
          fileUrl: attachment.fileUrl,
          fileSize: attachment.fileSize,
          mimeType: attachment.mimeType,
          ...(isPlaceholder
            ? { previewStatus: "UNSUPPORTED" as const }
            : attachmentPreviewDataForFile(attachment)),
          version: isPlaceholder ? 0 : 1,
          workDate: attachment.workDate,
          uploadedBy: user.id,
          deletedAt: null,
          deletedBy: null,
          restoredAt: null,
          restoredBy: null,
          lastModifiedBy: user.id,
          lastModifiedAt,
        },
        include: ATTACHMENT_USER_INCLUDE,
      });
      if (isPlaceholder) {
        return copiedAttachment;
      }
      const sourceVersionId = await resolveAttachmentHeadVersionId(
        txClient,
        attachment
      );
      const initialRevision = await createAttachmentRevision(txClient, {
        attachmentId: copiedAttachment.id,
        projectId,
        version: 1,
        parentVersionId: null,
        sourceVersionId,
        fileKind: attachment.fileKind,
        fileName: attachment.fileName,
        originalName: attachment.originalName,
        fileUrl: attachment.fileUrl,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
        workDate: attachment.workDate,
        uploadedBy: user.id,
        uploadedAt: lastModifiedAt,
        archivedBy: user.id,
        action: ATTACHMENT_REVISION_ACTIONS.INITIAL,
        createdAt: lastModifiedAt,
      });
      copiedAttachment = await txClient.attachment.update({
        where: { id: copiedAttachment.id },
        data: { headVersionId: initialRevision.id },
        include: ATTACHMENT_USER_INCLUDE,
      });
      if (attachment.fileKind === "SMART_FORM") {
        const sourceInstance = await txClient.smartFormInstance.findUnique({
          where: { attachmentId: attachment.id },
        });
        if (sourceInstance) {
          await txClient.smartFormInstance.create({
            data: {
              projectId,
              attachmentId: copiedAttachment.id,
              smartFormTemplateId: sourceInstance.smartFormTemplateId,
              smartFormTemplateVersionId:
                sourceInstance.smartFormTemplateVersionId,
              schemaHash: sourceInstance.schemaHash,
              answerHash: sourceInstance.answerHash,
              status: sourceInstance.status,
              completedAt: sourceInstance.completedAt ?? null,
              lastSavedBy: sourceInstance.lastSavedBy ?? null,
              lastSavedAt: sourceInstance.lastSavedAt ?? null,
            },
          });
        }
      }
      return copiedAttachment;
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_COPIED",
      targetType: "ATTACHMENT",
      targetId: copied.id,
      projectId,
      description: `Copied attachment ${attachment.originalName ?? attachment.fileName} to ${targetPaper.code}`,
      source,
    });
    return normalizeAttachmentResponse(copied);
  }

  private async resolveAttachmentRelocationPaper(
    projectId: string,
    input: RelocateAttachmentTarget,
    attachment: AttachmentContainerPaperSource,
    user: RequestUser
  ) {
    await Promise.resolve();
    const targetWorkingPaperId = normalizeOptionalId(input.workingPaperId);
    if (targetWorkingPaperId) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Please choose a project folder and file bucket"
      );
    }
    const targetWorkflowNodeId = normalizeOptionalId(input.workflowNodeId);
    if (!targetWorkflowNodeId || !input.bucket) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Please choose a project folder and file bucket"
      );
    }
    return this.createAttachmentContainerPaper(
      projectId,
      targetWorkflowNodeId,
      input.bucket,
      attachment,
      user,
      "Please choose a project folder as the relocation location",
      "Relocation target paper code already exists; please try again"
    );
  }

  async deleteAttachment(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "modifyIndex",
      "PREPARER"
    );
    const attachment = await this.requireAttachment(projectId, attachmentId);
    const deletedFromPaper = attachment.workingPaperId
      ? await this.prisma.workingPaper.findFirst({
          where: { id: attachment.workingPaperId, projectId },
          select: { id: true, code: true, title: true, workflowNodeId: true },
        })
      : null;
    const deletedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const recycled = await tx.attachment.update({
        where: { id: attachmentId },
        data: buildAttachmentRecycleData(
          user.id,
          deletedAt,
          deletedFromPaper,
          attachment.workingPaperId
        ),
        include: ATTACHMENT_USER_INCLUDE,
      });
      await cancelAttachmentWorkItems(tx, {
        projectId,
        attachmentId,
        actorId: user.id,
        deletedAt,
      });
      if (attachment.workingPaperId) {
        const remainingActiveAttachments = await tx.attachment.count({
          where: {
            projectId,
            workingPaperId: attachment.workingPaperId,
            deletedAt: null,
          },
        });
        if (remainingActiveAttachments === 0) {
          await tx.workingPaper.delete({
            where: { id: attachment.workingPaperId },
          });
        }
      }
      await this.recordImportTargetChange(
        tx,
        attachmentId,
        user.id,
        deletedAt,
        "DELETED"
      );
      return recycled;
    });
    await this.revokeDesktopMasterGrantForSession(attachment.lockSessionId);
    await Promise.allSettled([
      this.pdfRasterPreviewService().clearAttachmentPreviewCache(attachment),
      this.spreadsheetPreviewCacheService().clearAttachmentPreviewCache(
        attachment
      ),
    ]);
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_DELETED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `删除文件 ${attachment.originalName ?? attachment.fileName}`,
      source,
    });
    return normalizeAttachmentResponse(updated);
  }

  async restoreAttachment(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    input: { workingPaperId?: string; workflowNodeId?: string },
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "modifyIndex",
      "PREPARER"
    );
    const attachment = await this.requireDeletedAttachment(
      projectId,
      attachmentId
    );
    let targetWorkflowNodeId = normalizeOptionalId(input.workflowNodeId);
    if (!targetWorkflowNodeId) {
      targetWorkflowNodeId =
        normalizeOptionalId(
          attachment.deletedFromWorkflowNodeId ?? undefined
        ) ??
        (await this.resolveDeletedAttachmentWorkflowNodeId(
          projectId,
          normalizeOptionalId(input.workingPaperId) ??
            attachment.deletedFromWorkingPaperId
        ));
    }
    if (!targetWorkflowNodeId) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "原目录不存在，请选择新的恢复位置"
      );
    }
    const targetPaper = await this.createRecycleBinRestorePaper(
      projectId,
      targetWorkflowNodeId,
      attachment,
      user
    );
    const restoredAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const restored = await tx.attachment.update({
        where: { id: attachmentId },
        data: {
          workingPaperId: targetPaper.id,
          ...buildAttachmentIdentityData(targetPaper),
          deletedAt: null,
          deletedBy: null,
          deletedFromWorkingPaperId: null,
          deletedFromWorkflowNodeId: null,
          deletedFromWorkingPaperCode: null,
          deletedFromWorkingPaperTitle: null,
          restoredAt,
          restoredBy: user.id,
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          lockSessionId: null,
          lockHeartbeatAt: null,
          lockStaleAt: null,
          lockRevokedAt: null,
          lockRevokedBy: null,
          lockReleaseReason: null,
        },
        include: ATTACHMENT_USER_INCLUDE,
      });
      await this.recordImportTargetChange(
        tx,
        attachmentId,
        user.id,
        restoredAt,
        "RESTORED"
      );
      return restored;
    });
    await this.revokeDesktopMasterGrantForSession(attachment.lockSessionId);
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_RESTORED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `恢复文件 ${attachment.originalName ?? attachment.fileName} 到 ${targetPaper.code}`,
      source,
    });
    return normalizeAttachmentResponse(updated);
  }

  private async recordImportTargetChange(
    tx: Prisma.TransactionClient,
    attachmentId: string,
    actorId: string,
    occurredAt: Date,
    operation: "DELETED" | "RESTORED"
  ) {
    const imports = await tx.confirmationEmpImportItem.findMany({
      where: { attachmentId, status: "SUCCEEDED", withdrawnAt: null },
      select: { id: true, confirmationId: true, sourceFileName: true },
    });
    if (imports.length)
      await tx.confirmationFollowUpEvent.createMany({
        data: imports.map((item) => ({
          confirmationId: item.confirmationId!,
          actorId,
          occurredAt,
          source: "PROJECT_TEAM_MANUAL" as const,
          eventType: "IMPORT_TARGET_CHANGED" as const,
          notes: `${item.sourceFileName}：${operation === "DELETED" ? "项目文件已移入回收站，待归档" : "项目文件已恢复"}`,
          payload: {
            operation: `IMPORT_TARGET_${operation}`,
            itemId: item.id,
            attachmentId,
          },
        })),
      });
  }

  private async resolveDeletedAttachmentWorkflowNodeId(
    projectId: string,
    workingPaperId?: string | null
  ) {
    const targetWorkingPaperId = normalizeOptionalId(
      workingPaperId ?? undefined
    );
    if (!targetWorkingPaperId) {
      return null;
    }
    const paper = await this.prisma.workingPaper.findFirst({
      where: { id: targetWorkingPaperId, projectId },
      select: { workflowNodeId: true },
    });
    return paper?.workflowNodeId ?? null;
  }

  private async createRecycleBinRestorePaper(
    projectId: string,
    workflowNodeId: string,
    attachment: AttachmentContainerPaperSource,
    user: RequestUser
  ) {
    await Promise.resolve();
    return this.createAttachmentContainerPaper(
      projectId,
      workflowNodeId,
      WorkingPaperBucket.CURRENT,
      attachment,
      user,
      "Please choose a project folder as the restore location",
      "Restore target paper code already exists; please try again"
    );
  }

  private async createAttachmentContainerPaper(
    projectId: string,
    workflowNodeId: string,
    bucket: WorkingPaperBucket,
    attachment: AttachmentContainerPaperSource,
    user: RequestUser,
    missingTargetMessage: string,
    duplicateCodeMessage: string
  ) {
    const targetNode = await this.prisma.workflowNode.findFirst({
      where: { id: workflowNodeId, projectId },
      select: { id: true, code: true, level: true },
    });
    if (!targetNode) {
      throw new ApiBadRequestException("BAD_REQUEST", missingTargetMessage);
    }
    for (
      let attempt = 0;
      attempt < ATTACHMENT_CONTAINER_PAPER_CREATE_MAX_ATTEMPTS;
      attempt += 1
    ) {
      const existingPapers = await this.prisma.workingPaper.findMany({
        where: { projectId, workflowNodeId: targetNode.id },
        select: { code: true },
      });
      const existingAttachments =
        (await this.prisma.attachment.findMany({
          where: {
            projectId,
            workflowNodeId: targetNode.id,
            deletedAt: null,
          },
          select: { code: true },
        })) ?? [];
      const code = buildNextWorkingPaperCode(targetNode.code, [
        ...existingPapers,
        ...existingAttachments.flatMap((record) =>
          record.code ? [{ code: record.code }] : []
        ),
      ]);
      try {
        return await this.prisma.workingPaper.create({
          data: {
            projectId,
            workflowNodeId: targetNode.id,
            code,
            title: normalizeDisplayTitleFromCode(
              code,
              attachment.originalName ?? attachment.fileName
            ),
            paperType: PaperType.WORKING_PAPER,
            bucket,
            createdBy: user.id,
          },
          select: {
            id: true,
            workflowNodeId: true,
            code: true,
            title: true,
            bucket: true,
            preparerId: true,
            reviewerId: true,
            preparedAt: true,
            reviewedAt: true,
            returnedAt: true,
            reviewNote: true,
            templateItemId: true,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          if (attempt < ATTACHMENT_CONTAINER_PAPER_CREATE_MAX_ATTEMPTS - 1) {
            continue;
          }
          throw new ApiBadRequestException(
            "DUPLICATE_CODE",
            duplicateCodeMessage
          );
        }
        throw error;
      }
    }
    throw new ApiBadRequestException("DUPLICATE_CODE", duplicateCodeMessage);
  }

  async downloadAttachment(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "uploadWorkingPapers",
      "PREPARER"
    );
    const attachment = await this.requireAttachment(projectId, attachmentId);
    requireAttachmentFile(attachment);
    if (isSmartFormAttachment(attachment)) {
      await this.auditLogs.log({
        actorId: user.id,
        action: "ATTACHMENT_READONLY_DOWNLOADED",
        targetType: "ATTACHMENT",
        targetId: attachmentId,
        projectId,
        description: `Downloaded Smart Form PDF ${attachment.originalName ?? attachment.fileName}`,
        source,
      });
      return this.exportSmartFormPdfDownload(projectId, attachment);
    }
    const lockedAttachment = await this.claimAttachmentLock(
      projectId,
      attachmentId,
      user,
      source
    );
    return this.fileStorage().getDownloadObject(
      lockedAttachment.fileUrl,
      normalizeUploadedFileName(
        lockedAttachment.originalName ?? lockedAttachment.fileName
      ),
      lockedAttachment.mimeType
    );
  }

  async downloadAttachmentForActiveMaster(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const attachment = await this.requireAttachment(projectId, attachmentId);
    requireAttachmentFile(attachment);
    if (!hasActiveLock(attachment) || attachment.lockedBy !== user.id) {
      throw new ApiBadRequestException(
        "LOCK_SESSION_MISMATCH",
        "You are not the active Master for this file."
      );
    }
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_MASTER_DOWNLOADED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `Downloaded active Master attachment ${attachment.originalName ?? attachment.fileName}`,
      source,
    });
    return this.fileStorage().getDownloadObject(
      attachment.fileUrl,
      normalizeUploadedFileName(attachment.originalName ?? attachment.fileName),
      attachment.mimeType
    );
  }

  async downloadAttachmentReadOnly(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const attachment = await this.requireAttachment(projectId, attachmentId);
    requireAttachmentFile(attachment);
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_READONLY_DOWNLOADED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `Downloaded read-only attachment ${attachment.originalName ?? attachment.fileName}`,
      source,
    });
    if (isSmartFormAttachment(attachment)) {
      return this.exportSmartFormPdfDownload(projectId, attachment);
    }
    return this.fileStorage().getDownloadObject(
      attachment.fileUrl,
      normalizeUploadedFileName(attachment.originalName ?? attachment.fileName),
      attachment.mimeType
    );
  }

  async exportAttachment(
    projectId: string,
    attachmentId: string,
    format: AttachmentExportFormat,
    user: RequestUser,
    source?: AuditLogSource
  ): Promise<
    DownloadObject | { fileName: string; mimeType: string; body: Buffer }
  > {
    await this.access.requireProjectMember(projectId, user.id);
    const [attachment, project, workflowNodes] = await Promise.all([
      this.prisma.attachment.findFirst({
        where: { id: attachmentId, projectId, deletedAt: null },
        include: {
          workingPaper: {
            select: { code: true, workflowNodeId: true },
          },
        },
      }),
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { projectCode: true, name: true },
      }),
      this.prisma.workflowNode.findMany({
        where: { projectId },
        select: { id: true, parentId: true, code: true, title: true },
      }),
    ]);
    if (!attachment || !project) {
      throw new ApiBadRequestException("NOT_FOUND", "Attachment not found");
    }
    requireAttachmentFile(attachment);

    const numberedFileName = getAttachmentExportFileName(attachment);
    let exported:
      | DownloadObject
      | { fileName: string; mimeType: string; body: Buffer };

    if (format === "original") {
      exported = isSmartFormAttachment(attachment)
        ? await this.createSmartFormExportFile(
            projectId,
            attachment,
            numberedFileName
          )
        : this.fileStorage().getDownloadObject(
            attachment.fileUrl,
            numberedFileName,
            attachment.mimeType
          );
    } else if (format === "pdf") {
      if (isSmartFormAttachment(attachment)) {
        exported = await this.createSmartFormExportFile(
          projectId,
          attachment,
          numberedFileName
        );
      } else {
        if (!isOfficePdfExportAttachment(attachment)) {
          throw new ApiBadRequestException(
            "EXPORT_FORMAT_NOT_SUPPORTED",
            "PDF export is available for Office files and Smart Forms only."
          );
        }
        try {
          exported = {
            ...(await this.documentConversion.getAttachmentPreviewPdf(
              attachment
            )),
            fileName: replaceFileExtension(numberedFileName, ".pdf"),
          };
        } catch (error) {
          throw new ApiServiceUnavailableException(
            "EXPORT_CONVERSION_FAILED",
            error instanceof Error
              ? `Could not convert the Office file to PDF: ${error.message}`
              : "Could not convert the Office file to PDF."
          );
        }
      }
    } else {
      exported = await this.createAttachmentZipExport({
        projectId,
        attachment,
        project,
        workflowNodes,
        numberedFileName,
      });
    }

    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_EXPORTED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `Exported attachment ${numberedFileName} as ${format}`,
      source,
    });
    return exported;
  }

  async previewAttachmentContent(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    source?: AuditLogSource,
    ifNoneMatch?: string,
    requestedVersion?: number
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const attachment = await this.requireAttachment(projectId, attachmentId);
    requireAttachmentFile(attachment);
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_READONLY_DOWNLOADED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `Previewed attachment ${attachment.originalName ?? attachment.fileName}`,
      source,
    });
    const eTag = buildAttachmentPreviewETag(attachment);
    const responseMetadata = {
      fileName: normalizeUploadedFileName(
        attachment.originalName ?? attachment.fileName
      ),
      mimeType: attachment.mimeType,
      cacheControl: attachmentPreviewCacheControl(
        attachment.version,
        requestedVersion
      ),
      eTag,
    };
    if (matchesETag(ifNoneMatch, eTag)) {
      return {
        ...responseMetadata,
        notModified: true,
      };
    }
    return {
      ...responseMetadata,
      body: await this.fileStorage().getObjectBuffer(attachment.fileUrl),
    };
  }

  async downloadAttachmentVersion(
    projectId: string,
    attachmentId: string,
    versionId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const version = await this.requireAttachmentVersion(
      projectId,
      attachmentId,
      versionId
    );
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_VERSION_DOWNLOADED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `Downloaded attachment version v${version.version} ${version.originalName ?? version.fileName}`,
      source,
    });
    return this.fileStorage().getDownloadObject(
      version.fileUrl,
      normalizeUploadedFileName(version.originalName ?? version.fileName),
      version.mimeType
    );
  }

  async restoreAttachmentVersion(
    projectId: string,
    attachmentId: string,
    versionId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.requireProjectActionWithRole(
      projectId,
      user.id,
      "modifyIndex",
      "PREPARER"
    );
    const attachment = await this.requireAttachment(projectId, attachmentId);
    this.requireAttachmentNotConflictFrozen(attachment);
    if (hasActiveLock(attachment)) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Release Master before resetting the head"
      );
    }
    const version = await this.requireAttachmentVersion(
      projectId,
      attachmentId,
      versionId
    );
    const restoredAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.attachmentVersion.updateMany({
        where: { attachmentId, isCurrent: true },
        data: { isCurrent: false },
      });
      await tx.attachmentVersion.update({
        where: { id: version.id },
        data: { isCurrent: true },
      });
      return tx.attachment.update({
        where: { id: attachmentId },
        data: {
          fileKind: version.fileKind,
          fileName: version.fileName,
          originalName: version.originalName,
          fileUrl: version.fileUrl,
          fileSize: version.fileSize,
          mimeType: version.mimeType,
          contentHash: version.contentHash,
          version: version.version,
          headVersionId: version.id,
          lockEpoch: { increment: 1 },
          workDate: version.workDate,
          uploadedBy: version.uploadedBy ?? user.id,
          lastModifiedBy: user.id,
          lastModifiedAt: restoredAt,
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          lockSessionId: null,
          lockHeartbeatAt: null,
          lockStaleAt: null,
          lockRevokedAt: null,
          lockRevokedBy: null,
          lockReleaseReason: null,
          ...attachmentPreviewDataForFile(version),
        },
        include: ATTACHMENT_USER_INCLUDE,
      });
    });
    await this.revokeDesktopMasterGrantForSession(attachment.lockSessionId);
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_VERSION_RESTORED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `Restored attachment version v${version.version} ${version.originalName ?? version.fileName}`,
      source,
    });
    return normalizeAttachmentResponse(updated);
  }

  async resolveAttachmentConflict(
    projectId: string,
    attachmentId: string,
    candidateVersionId: string,
    resolution: AttachmentConflictResolution,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const member = await this.access.requireProjectMember(projectId, user.id);
    if (
      user.globalRole !== "SUPER_ADMIN" &&
      member.projectRole !== "PARTNER" &&
      !canGlobalRoleManageProjectMembers(user.globalRole)
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only the project PIC or an administrator can resolve file conflicts."
      );
    }
    const attachment = await this.requireAttachment(projectId, attachmentId);
    if (!attachment.conflictFrozenAt) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "This file does not have an open version conflict."
      );
    }
    this.requireNoDesktopMasterHeadMutation(attachment);
    const candidate = await this.prisma.attachmentVersion.findFirst({
      where: {
        id: candidateVersionId,
        projectId,
        attachmentId,
        conflictState: "OPEN",
      },
    });
    if (!candidate) {
      throw new ApiBadRequestException(
        "NOT_FOUND",
        "The conflict candidate does not exist or has already been resolved."
      );
    }
    const targetVersionId =
      resolution === "USE_CANDIDATE"
        ? candidate.id
        : resolution === "REVERT_TO_BASE"
          ? candidate.conflictBaseVersionId
          : attachment.headVersionId;
    if (!targetVersionId) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "The selected conflict resolution has no valid target version."
      );
    }
    const target = await this.requireAttachmentVersion(
      projectId,
      attachmentId,
      targetVersionId
    );
    const resolvedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.attachmentVersion.updateMany({
        where: { attachmentId, isCurrent: true },
        data: { isCurrent: false },
      });
      await tx.attachmentVersion.update({
        where: { id: target.id },
        data: { isCurrent: true },
      });
      await tx.attachmentVersion.update({
        where: { id: candidate.id },
        data: {
          conflictState: "RESOLVED",
          conflictResolvedBy: user.id,
          conflictResolvedAt: resolvedAt,
          conflictResolution: resolution,
        },
      });
      const remainingCandidate = await tx.attachmentVersion.findFirst({
        where: {
          attachmentId,
          conflictState: "OPEN",
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true },
      });
      const conflictFrozenAt = remainingCandidate
        ? attachment.conflictFrozenAt
        : null;
      const conflictCandidateVersionId = remainingCandidate?.id ?? null;
      const fencedResolution = await tx.attachment.updateMany({
        where: {
          id: attachmentId,
          projectId,
          deletedAt: null,
          lockedBy: null,
          lockSessionId: null,
          lockEpoch: attachment.lockEpoch,
          conflictFrozenAt: attachment.conflictFrozenAt,
        },
        data: {
          fileKind: target.fileKind,
          fileName: target.fileName,
          originalName: target.originalName,
          fileUrl: target.fileUrl,
          fileSize: target.fileSize,
          mimeType: target.mimeType,
          contentHash: target.contentHash,
          version: target.version,
          headVersionId: target.id,
          workDate: target.workDate,
          uploadedBy: target.uploadedBy ?? user.id,
          lastModifiedBy: user.id,
          lastModifiedAt: resolvedAt,
          conflictFrozenAt,
          conflictCandidateVersionId,
          lockEpoch: { increment: 1 },
          lockReleaseReason: `CONFLICT_RESOLVED_${resolution}`,
          ...attachmentPreviewDataForFile(target),
        },
      });
      if (fencedResolution.count !== 1) {
        throw new ApiBadRequestException(
          "CONFLICT_RISK",
          "A desktop Master session became active while the conflict was being resolved."
        );
      }
      return {
        ...attachment,
        fileKind: target.fileKind,
        fileName: target.fileName,
        originalName: target.originalName,
        fileUrl: target.fileUrl,
        fileSize: target.fileSize,
        mimeType: target.mimeType,
        contentHash: target.contentHash,
        version: target.version,
        headVersionId: target.id,
        workDate: target.workDate,
        uploadedBy: target.uploadedBy ?? user.id,
        lastModifiedBy: user.id,
        lastModifiedAt: resolvedAt,
        conflictFrozenAt,
        conflictCandidateVersionId,
        lockEpoch: attachment.lockEpoch + 1,
        lockReleaseReason: `CONFLICT_RESOLVED_${resolution}`,
      };
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "ATTACHMENT_CONFLICT_RESOLVED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `Resolved attachment conflict ${candidateVersionId} with ${resolution}`,
      source,
    });
    return normalizeAttachmentResponse(updated);
  }

  async listAttachmentConflicts(
    projectId: string,
    attachmentId: string,
    user: RequestUser
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const attachment = await this.requireAttachment(projectId, attachmentId);
    const candidates = await this.prisma.attachmentVersion.findMany({
      where: {
        projectId,
        attachmentId,
        conflictState: "OPEN",
      },
      orderBy: [{ createdAt: "desc" }],
      include: ATTACHMENT_VERSION_USER_INCLUDE,
    });
    return {
      frozen: Boolean(attachment.conflictFrozenAt),
      frozenAt: attachment.conflictFrozenAt,
      headVersionId: attachment.headVersionId,
      candidateVersionId: attachment.conflictCandidateVersionId,
      candidates,
    };
  }

  async previewAttachmentPdf(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    ifNoneMatch?: string,
    requestedVersion?: number
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const attachment = await this.requireAttachment(projectId, attachmentId);
    const responseMetadata = {
      cacheControl: attachmentPreviewCacheControl(
        attachment.version,
        requestedVersion
      ),
      // Invalidate validators issued for the previous signed-redirect delivery.
      eTag: buildAttachmentPreviewETag(
        attachment,
        isSmartFormAttachment(attachment)
          ? "pdf-rich-notes-v1"
          : "pdf-content-v2"
      ),
    };
    if (matchesETag(ifNoneMatch, responseMetadata.eTag)) {
      return {
        ...responseMetadata,
        fileName: getPreviewDisplayName(attachment),
        mimeType: "application/pdf" as const,
        notModified: true,
      };
    }
    if (isSmartFormAttachment(attachment)) {
      const snapshot = await this.createSmartFormPdfSnapshot(
        projectId,
        attachment
      );
      return {
        ...(snapshot.downloadObject.redirectUrl
          ? {
              body: await this.fileStorage().getObjectBuffer(
                snapshot.previewAttachment.fileUrl
              ),
              mimeType: "application/pdf" as const,
            }
          : snapshot.downloadObject),
        fileName: getPreviewDisplayName(attachment),
        ...responseMetadata,
      };
    }
    return {
      ...(await this.documentConversion.getAttachmentPreviewPdf(attachment)),
      fileName: getPreviewDisplayName(attachment),
      ...responseMetadata,
    };
  }

  async previewAttachmentRasterPdfManifest(
    projectId: string,
    attachmentId: string,
    user: RequestUser
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const attachment = await this.requireAttachment(projectId, attachmentId);
    if (isSmartFormAttachment(attachment)) {
      const snapshot = await this.createSmartFormPdfSnapshot(
        projectId,
        attachment
      );
      return this.pdfRasterPreviewService().getAttachmentRasterPreviewManifest(
        snapshot.previewAttachment
      );
    }
    if (!attachment.previewStatus) {
      return this.pdfRasterPreviewService().getAttachmentRasterPreviewManifest(
        attachment
      );
    }
    const cached =
      await this.pdfRasterPreviewService().readCachedAttachmentRasterPreviewManifest(
        attachment
      );
    if (cached) {
      return cached;
    }
    return this.ensureAttachmentPreviewCacheQueued(attachment);
  }

  async previewAttachmentRasterPdfPage(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    input: { pageNumber: number; dpi?: number },
    ifNoneMatch?: string,
    requestedVersion?: number
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const attachment = await this.requireAttachment(projectId, attachmentId);
    const responseMetadata = {
      cacheControl: attachmentPreviewCacheControl(
        attachment.version,
        requestedVersion
      ),
      eTag: buildAttachmentPreviewETag(
        attachment,
        `raster:${input.pageNumber}:${input.dpi ?? "default"}`
      ),
    };
    if (matchesETag(ifNoneMatch, responseMetadata.eTag)) {
      return {
        ...responseMetadata,
        fileName: `page-${input.pageNumber}.png`,
        mimeType: "image/png" as const,
        notModified: true,
      };
    }
    if (isSmartFormAttachment(attachment)) {
      const snapshot = await this.createSmartFormPdfSnapshot(
        projectId,
        attachment
      );
      return {
        ...(await this.pdfRasterPreviewService().getAttachmentRasterPreviewPage(
          snapshot.previewAttachment,
          input
        )),
        ...responseMetadata,
      };
    }
    if (!attachment.previewStatus) {
      return {
        ...(await this.pdfRasterPreviewService().getAttachmentRasterPreviewPage(
          attachment,
          input
        )),
        ...responseMetadata,
      };
    }
    const cached =
      await this.pdfRasterPreviewService().readCachedAttachmentRasterPreviewPage(
        attachment,
        input
      );
    if (cached) {
      return { ...cached, ...responseMetadata };
    }
    return this.ensureAttachmentPreviewCacheQueued(attachment);
  }

  async attachmentHistory(
    projectId: string,
    attachmentId: string,
    user: RequestUser
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, projectId },
      include: ATTACHMENT_USER_INCLUDE,
    });
    if (!attachment) {
      throw new ApiBadRequestException("NOT_FOUND", "附件不存在");
    }
    const events = await this.prisma.auditLog.findMany({
      where: {
        projectId,
        targetType: "ATTACHMENT",
        targetId: attachmentId,
      },
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: { id: true, name: true, email: true, globalRole: true },
        },
      },
    });
    const versions = await this.prisma.attachmentVersion.findMany({
      where: { projectId, attachmentId },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      include: ATTACHMENT_VERSION_USER_INCLUDE,
    });

    return {
      attachment: normalizeAttachmentResponse(attachment),
      versions: versions.map(normalizeAttachmentVersionResponse),
      events,
    };
  }

  async previewAttachment(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    input: SpreadsheetPreviewInput = {}
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const attachment = await this.requireAttachment(projectId, attachmentId);
    this.requireSpreadsheetAttachment(attachment);
    if (attachment.previewStatus) {
      await this.ensureSpreadsheetPreviewCacheAvailable(attachment);
      return this.spreadsheetPreviewCacheService().readPreview(
        attachment,
        input
      );
    }

    const downloadObject = this.fileStorage().getDownloadObject(
      attachment.fileUrl,
      attachment.fileName,
      attachment.mimeType
    );
    const workbook = downloadObject.absolutePath
      ? readWorkbookForPreview(downloadObject.absolutePath)
      : await readStoredWorkbookForPreview(
          getStoredWorkbookPreviewCacheKey(attachment),
          () => this.fileStorage().getObjectBuffer(attachment.fileUrl)
        );
    const sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "表格文件没有可预览的工作表"
      );
    }
    const sheetIndex = clampInteger(input.sheetIndex, 0, sheetNames.length - 1);
    const limit = clampInteger(
      input.limit,
      1,
      MAX_PREVIEW_ROWS,
      DEFAULT_PREVIEW_ROWS
    );
    const sheetName = sheetNames[sheetIndex];
    const sheet = workbook.Sheets[sheetName];
    const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
    const totalRows = range ? range.e.r - range.s.r + 1 : 0;
    const totalColumns = range ? range.e.c - range.s.c + 1 : 0;
    const columnOffset = clampInteger(
      input.columnOffset,
      0,
      Math.max(0, totalColumns - 1)
    );
    const columnLimit = clampInteger(input.columnLimit, 1, 200, 30);
    const offset = range
      ? getSpreadsheetPreviewOffset(input, range, limit)
      : Math.max(0, Math.trunc(input.offset ?? 0));
    const rows = range
      ? readSheetRows(sheet, range, offset, limit, columnOffset, columnLimit)
      : [];

    return {
      attachmentId,
      fileName: normalizeUploadedFileName(
        attachment.originalName ?? attachment.fileName
      ),
      sheetNames,
      sheetIndex,
      sheetName,
      offset,
      limit,
      columnOffset,
      columnLimit,
      totalRows,
      totalColumns,
      rows,
      hasMore: offset + rows.length < totalRows,
      hasMoreColumns: columnOffset + columnLimit < totalColumns,
    };
  }

  async searchAttachmentPreview(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    query: string
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const attachment = await this.requireAttachment(projectId, attachmentId);
    this.requireSpreadsheetAttachment(attachment);
    return this.spreadsheetPreviewCacheService().searchPreview(
      attachment,
      query
    );
  }

  async prepareWorkingPaper(
    projectId: string,
    paperId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await Promise.resolve();
    return this.toggleWorkingPaperSignoff(
      projectId,
      paperId,
      user,
      "PREPARER",
      source
    );
  }

  async reviewWorkingPaper(
    projectId: string,
    paperId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await Promise.resolve();
    return this.toggleWorkingPaperSignoff(
      projectId,
      paperId,
      user,
      "REVIEWER",
      source
    );
  }

  async removeWorkingPaperSignoff(
    projectId: string,
    signoffId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    await this.access.requireMutableProject(projectId, user.id);

    const signoff = await this.prisma.workingPaperSignoff.findFirst({
      where: {
        id: signoffId,
        workingPaper: { projectId },
      },
      select: {
        id: true,
        type: true,
        userId: true,
        attachmentId: true,
        workingPaper: { select: { code: true } },
      },
    });
    if (!signoff) {
      throw new ApiBadRequestException("NOT_FOUND", "签核不存在");
    }
    if (signoff.type === "PREPARER") {
      await this.access.requireProjectAction(
        projectId,
        user.id,
        "signPreparer"
      );
    } else if (signoff.userId !== user.id) {
      await this.access.requireProjectRole(projectId, user.id, "PARTNER");
    }

    await this.prisma.workingPaperSignoff.delete({
      where: { id: signoff.id },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action:
        signoff.type === "PREPARER"
          ? "WORKING_PAPER_PREPARE_SIGNOFF_REMOVED"
          : "WORKING_PAPER_REVIEW_SIGNOFF_REMOVED",
      targetType: signoff.attachmentId ? "ATTACHMENT" : "WORKING_PAPER",
      targetId: signoff.attachmentId ?? signoff.id,
      projectId,
      description: `Removed ${signoff.type.toLowerCase()} signoff for ${signoff.workingPaper.code}`,
      source,
    });
    return { id: signoff.id };
  }

  async prepareAttachment(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await Promise.resolve();
    return this.toggleAttachmentSignoff(
      projectId,
      attachmentId,
      user,
      "PREPARER",
      source
    );
  }

  async reviewAttachment(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await Promise.resolve();
    return this.toggleAttachmentSignoff(
      projectId,
      attachmentId,
      user,
      "REVIEWER",
      source
    );
  }

  async attachmentSignoffHistory(
    projectId: string,
    attachmentId: string,
    user: RequestUser
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    await this.requireAttachment(projectId, attachmentId);
    const signoffs = await this.prisma.workingPaperSignoff.findMany({
      where: { attachmentId },
      orderBy: [{ roundNumber: "desc" }, { signedAt: "asc" }],
      include: {
        user: { select: USER_SUMMARY_SELECT },
        revokedBy: { select: USER_SUMMARY_SELECT },
      },
    });
    const current = deriveCurrentSignoffRound(signoffs);
    return {
      attachmentId,
      total: signoffs.length,
      currentRoundNumber: current?.roundNumber ?? null,
      currentStatus: current
        ? getSignoffRoundStatus(current)
        : "PENDING_PREPARER",
      rounds: groupSignoffsByRound(signoffs, current?.roundNumber ?? null),
    };
  }

  async revokeAttachmentSignoff(
    projectId: string,
    attachmentId: string,
    signoffId: string,
    user: RequestUser,
    input: { reason: string },
    source?: AuditLogSource
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    await this.access.requireMutableProject(projectId, user.id);
    const reason = input.reason.trim();
    if (!reason) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A revocation reason is required."
      );
    }
    const signoff = await this.prisma.workingPaperSignoff.findFirst({
      where: { id: signoffId, attachmentId, workingPaper: { projectId } },
      select: {
        id: true,
        userId: true,
        type: true,
        roundNumber: true,
        revokedAt: true,
        workingPaperId: true,
      },
    });
    if (!signoff) {
      throw new ApiBadRequestException(
        "NOT_FOUND",
        "Signoff record not found."
      );
    }
    if (signoff.revokedAt) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "This signoff has already been revoked."
      );
    }
    if (signoff.userId !== user.id) {
      await this.access.requireProjectRole(projectId, user.id, "PARTNER");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workingPaperSignoff.update({
        where: { id: signoff.id },
        data: {
          isCurrent: false,
          revokedAt: new Date(),
          revokedById: user.id,
          revocationReason: reason,
        },
      });
      await refreshCurrentSignoffRound(tx, attachmentId);
    });

    await this.auditLogs.log({
      actorId: user.id,
      action: "WORKING_PAPER_SIGNOFF_REVOKED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `Revoked ${signoff.type.toLowerCase()} signoff in round ${signoff.roundNumber}: ${reason}`,
      source,
    });
    return this.attachmentSignoffHistory(projectId, attachmentId, user);
  }

  private async toggleWorkingPaperSignoff(
    projectId: string,
    paperId: string,
    user: RequestUser,
    type: WorkingPaperSignoffType,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectAction(
      projectId,
      user.id,
      type === "PREPARER" ? "signPreparer" : "reviewSignoff"
    );
    await this.access.requireProjectMember(projectId, user.id);
    await this.access.requireMutableProject(projectId, user.id);
    const paper = await this.requireWorkingPaper(projectId, paperId);
    const attachmentId = await this.findActiveAttachmentIdForWorkingPaper(
      projectId,
      paperId
    );
    if (attachmentId) {
      const code = normalizeWorkingPaperCode(paper.code);
      return this.toggleAttachmentSignoffForRecord(
        projectId,
        {
          id: attachmentId,
          workingPaperId: paperId,
          code,
          title: paper.title === paper.code ? code : (paper.title ?? code),
          originalName: null,
          fileName: paper.title === paper.code ? code : (paper.title ?? code),
          preparerId: paper.preparerId ?? null,
          reviewerId: paper.reviewerId ?? null,
        },
        user,
        type,
        source
      );
    }
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      "This workpaper has no file to sign."
    );
  }

  private async toggleAttachmentSignoff(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    type: WorkingPaperSignoffType,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectAction(
      projectId,
      user.id,
      type === "PREPARER" ? "signPreparer" : "reviewSignoff"
    );
    await this.access.requireProjectMember(projectId, user.id);
    await this.access.requireMutableProject(projectId, user.id);
    const attachment = await this.requireAttachment(projectId, attachmentId);
    return this.toggleAttachmentSignoffForRecord(
      projectId,
      attachment,
      user,
      type,
      source
    );
  }

  private async toggleAttachmentSignoffForRecord(
    projectId: string,
    attachment: {
      id: string;
      workingPaperId: string | null;
      code?: string | null;
      title?: string | null;
      originalName?: string | null;
      fileName: string;
      preparerId?: string | null;
      reviewerId?: string | null;
    },
    user: RequestUser,
    type: WorkingPaperSignoffType,
    source?: AuditLogSource
  ) {
    const attachmentId = attachment.id;
    const { workingPaperId } = attachment;
    if (!workingPaperId) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "This file cannot be signed before legacy workpaper compatibility is linked."
      );
    }
    const fileCode =
      attachment.code ??
      attachment.originalName ??
      attachment.fileName ??
      attachment.workingPaperId;
    const fileTitle =
      attachment.title ?? attachment.originalName ?? attachment.fileName;
    await this.assertSmartFormCompleteForSignoff(attachmentId);

    let signedAt: Date;
    await this.prisma.$transaction(async (tx) => {
      if (type === "REVIEWER") {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`attachment-review-signoff:${attachmentId}:${user.id}`}, 0)
          )
        `;
        const latestReview = await tx.workingPaperSignoff.findFirst({
          where: {
            attachmentId,
            userId: user.id,
            type: "REVIEWER",
            revokedAt: null,
          },
          orderBy: { signedAt: "desc" },
          select: { signedAt: true },
        });
        signedAt = new Date();
        if (
          latestReview &&
          signedAt.getTime() - latestReview.signedAt.getTime() <
            REVIEW_SIGNOFF_COOLDOWN_MS
        ) {
          throw new ApiBadRequestException(
            "REVIEW_SIGNOFF_COOLDOWN_ACTIVE",
            "The same reviewer can sign this file again after 24 hours."
          );
        }
      } else {
        signedAt = new Date();
      }
      const currentSignoffs = await tx.workingPaperSignoff.findMany({
        where: { attachmentId, isCurrent: true, revokedAt: null },
        orderBy: [{ roundNumber: "desc" }, { signedAt: "asc" }],
      });
      const current = deriveCurrentSignoffRound(currentSignoffs);
      const latestCurrentSignoff = current
        ? latestSignoffRecord(current.signoffs)
        : null;
      if (
        latestCurrentSignoff &&
        signedAt.getTime() <= latestCurrentSignoff.signedAt.getTime()
      ) {
        signedAt = new Date(latestCurrentSignoff.signedAt.getTime() + 1);
      }
      let roundNumber = current?.roundNumber ?? 1;

      if (type === "PREPARER" && current?.isComplete) {
        await tx.workingPaperSignoff.updateMany({
          where: { attachmentId, isCurrent: true },
          data: { isCurrent: false },
        });
        roundNumber += 1;
      }
      if (type === "REVIEWER") {
        if (!current?.latestPreparer) {
          throw new ApiBadRequestException(
            "PREPARER_SIGNOFF_REQUIRED",
            "Preparation signoff is required before review signoff."
          );
        }
        if (current.latestPreparer.signedAt.getTime() >= signedAt.getTime()) {
          throw new ApiBadRequestException(
            "PREPARER_SIGNOFF_REQUIRED",
            "Review signoff must be submitted after preparation signoff."
          );
        }
      }

      const versionSnapshot = await tx.attachment.findFirst({
        where: { id: attachmentId, projectId, deletedAt: null },
        select: { headVersionId: true, version: true, contentHash: true },
      });
      await tx.workingPaperSignoff.create({
        data: {
          workingPaperId,
          attachmentId,
          userId: user.id,
          type,
          roundNumber,
          isCurrent: true,
          attachmentVersionId: versionSnapshot?.headVersionId ?? null,
          attachmentVersion: versionSnapshot?.version ?? null,
          contentHash: versionSnapshot?.contentHash ?? null,
          signedAt,
        },
      });
    });
    await this.auditLogs.log({
      actorId: user.id,
      action:
        type === "PREPARER"
          ? "WORKING_PAPER_PREPARED"
          : "WORKING_PAPER_REVIEWED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description:
        type === "PREPARER"
          ? `Preparation signed for ${fileCode}`
          : `Review signed for ${fileCode}`,
      source,
    });
    this.dispatchNotification(
      "working-paper signoff",
      this.notifyWorkingPaperSignoff(
        type,
        {
          id: workingPaperId,
          projectId,
          code: fileCode,
          title: fileTitle,
          preparerId: attachment.preparerId ?? null,
          reviewerId: attachment.reviewerId ?? null,
        },
        user
      )
    );
    return normalizeAttachmentResponse(attachment);
  }

  private async assertSmartFormCompleteForSignoff(attachmentId: string) {
    const instance = await this.prisma.smartFormInstance.findUnique({
      where: { attachmentId },
      select: { status: true },
    });
    if (instance && instance.status !== "COMPLETE") {
      throw new ApiBadRequestException(
        "SMART_FORM_INCOMPLETE",
        "Complete the Smart Form before signing it."
      );
    }
  }

  async returnWorkingPaper(
    projectId: string,
    paperId: string,
    user: RequestUser,
    input: { reviewNote: string },
    source?: AuditLogSource
  ) {
    await this.access.requireProjectAction(projectId, user.id, "modifyIndex");
    const paper = await this.requireWorkingPaper(projectId, paperId);
    await this.auditLogs.log({
      actorId: user.id,
      action: "WORKING_PAPER_RETURNED",
      targetType: "WORKING_PAPER",
      targetId: paperId,
      projectId,
      description: `Reviewer 提出复核意见 ${paper.code}`,
      source,
    });
    return paper;
  }

  async createWorkingPaperQuestion(
    projectId: string,
    paperId: string,
    user: RequestUser,
    input: {
      body: string;
      assignedToId?: string;
      smartFormNodeId?: string;
      smartFormRowId?: string;
      smartFormTargetLabel?: string;
      referencedWorkingPaperIds?: string[];
    },
    source?: AuditLogSource
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    await this.access.requireMutableProject(projectId, user.id);
    this.rejectSmartFormReviewTarget(input);
    const paper = await this.requireWorkingPaper(projectId, paperId);
    if (input.assignedToId) {
      await this.requireActiveProjectMember(projectId, input.assignedToId);
    }
    const body = input.body.trim();
    const referencedWorkingPaperIds =
      await this.requireReviewQuestionReferencedPapers(
        projectId,
        input.referencedWorkingPaperIds
      );
    const now = new Date();
    const questionData: Prisma.WorkingPaperQuestionUncheckedCreateInput = {
      projectId,
      workingPaperId: paperId,
      body,
      status: "OPEN",
      createdById: user.id,
      smartFormNodeId: input.smartFormNodeId,
      smartFormRowId: input.smartFormRowId,
      smartFormTargetLabel: input.smartFormTargetLabel,
    };
    const attachmentId = await this.findActiveAttachmentIdForWorkingPaper(
      projectId,
      paperId
    );
    if (attachmentId) {
      questionData.attachmentId = attachmentId;
    }
    if (input.assignedToId) {
      questionData.assignedToId = input.assignedToId;
    }
    const question = await this.prisma.workingPaperQuestion.create({
      data: questionData,
      include: REVIEW_QUESTION_INCLUDE,
    });
    const message = await this.prisma.workingPaperQuestionMessage.create({
      data: {
        questionId: question.id,
        authorId: user.id,
        messageType: "QUESTION",
        body,
        createdAt: now,
        ...(referencedWorkingPaperIds.length > 0
          ? {
              references: {
                create: referencedWorkingPaperIds.map((workingPaperId) => ({
                  workingPaperId,
                })),
              },
            }
          : {}),
      },
      include: REVIEW_QUESTION_INCLUDE.messages.include,
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "WORKING_PAPER_QUESTION_CREATED",
      targetType: "WORKING_PAPER_QUESTION",
      targetId: question.id,
      projectId,
      description: `Reviewer 提出复核意见 ${paper.code}`,
      source,
    });
    this.dispatchNotification(
      "review-question assignment",
      this.notifyReviewQuestionCreated(projectId, paper, question, user)
    );
    return { ...question, messages: [message] };
  }

  async createAttachmentQuestion(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    input: {
      body: string;
      assignedToId?: string;
      smartFormNodeId?: string;
      smartFormRowId?: string;
      smartFormTargetLabel?: string;
      referencedWorkingPaperIds?: string[];
    },
    source?: AuditLogSource
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    await this.access.requireMutableProject(projectId, user.id);
    const attachment = await this.requireAttachment(projectId, attachmentId);
    if (!attachment.workingPaperId) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "This file cannot receive review notes before legacy workpaper compatibility is linked."
      );
    }
    await this.validateSmartFormReviewTarget(attachment, input);
    if (input.assignedToId) {
      await this.requireActiveProjectMember(projectId, input.assignedToId);
    }
    const body = input.body.trim();
    const referencedWorkingPaperIds =
      await this.requireReviewQuestionReferencedPapers(
        projectId,
        input.referencedWorkingPaperIds
      );
    const now = new Date();
    const questionData: Prisma.WorkingPaperQuestionUncheckedCreateInput = {
      projectId,
      workingPaperId: attachment.workingPaperId,
      attachmentId,
      body,
      status: "OPEN",
      createdById: user.id,
      smartFormNodeId: input.smartFormNodeId,
      smartFormRowId: input.smartFormRowId,
      smartFormTargetLabel: input.smartFormTargetLabel,
    };
    if (input.assignedToId) {
      questionData.assignedToId = input.assignedToId;
    }
    const question = await this.prisma.workingPaperQuestion.create({
      data: questionData,
      include: REVIEW_QUESTION_INCLUDE,
    });
    const message = await this.prisma.workingPaperQuestionMessage.create({
      data: {
        questionId: question.id,
        authorId: user.id,
        messageType: "QUESTION",
        body,
        createdAt: now,
        ...(referencedWorkingPaperIds.length > 0
          ? {
              references: {
                create: referencedWorkingPaperIds.map((workingPaperId) => ({
                  workingPaperId,
                })),
              },
            }
          : {}),
      },
      include: REVIEW_QUESTION_INCLUDE.messages.include,
    });
    const fileCode =
      attachment.code ?? attachment.originalName ?? attachment.fileName;
    const fileTitle =
      attachment.title ?? attachment.originalName ?? attachment.fileName;
    await this.auditLogs.log({
      actorId: user.id,
      action: "WORKING_PAPER_QUESTION_CREATED",
      targetType: "WORKING_PAPER_QUESTION",
      targetId: question.id,
      projectId,
      description: `Reviewer 提出复核意见 ${fileCode}`,
      source,
    });
    this.dispatchNotification(
      "review-question assignment",
      this.notifyReviewQuestionCreated(
        projectId,
        {
          id: attachment.workingPaperId,
          code: fileCode,
          title: fileTitle,
        },
        question,
        user
      )
    );
    return { ...question, messages: [message] };
  }

  private rejectSmartFormReviewTarget(input: {
    smartFormNodeId?: string;
    smartFormRowId?: string;
    smartFormTargetLabel?: string;
  }) {
    if (
      input.smartFormNodeId ||
      input.smartFormRowId ||
      input.smartFormTargetLabel
    ) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Smart Form targets can only be attached to a Smart Form file."
      );
    }
  }

  private async validateSmartFormReviewTarget(
    attachment: { fileKind: AttachmentFileKind; fileUrl: string },
    input: {
      smartFormNodeId?: string;
      smartFormRowId?: string;
      smartFormTargetLabel?: string;
    }
  ) {
    const hasTarget = Boolean(
      input.smartFormNodeId ||
      input.smartFormRowId ||
      input.smartFormTargetLabel
    );
    if (!hasTarget) {
      return;
    }
    if (!input.smartFormNodeId || attachment.fileKind !== "SMART_FORM") {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "The review target must belong to this Smart Form file."
      );
    }

    let smartFormPackage;
    try {
      const buffer = await this.fileStorage().getObjectBuffer(
        attachment.fileUrl
      );
      smartFormPackage = SmartFormPackageSchema.parse(
        JSON.parse(buffer.toString("utf-8"))
      );
    } catch {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "The Smart Form review target could not be verified."
      );
    }

    const node = findSmartFormV2Node(
      smartFormPackage.definition.children,
      input.smartFormNodeId
    );
    if (!node) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "The selected Smart Form question no longer exists."
      );
    }
    if (!input.smartFormRowId) {
      if (node.kind !== "field") {
        throw new ApiBadRequestException(
          "BAD_REQUEST",
          "Review questions can only target Smart Form questions or table rows."
        );
      }
      return;
    }
    if (
      node.kind !== "sheet" ||
      !smartFormSheetHasRow(node, input.smartFormRowId)
    ) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "The selected Smart Form table row no longer exists."
      );
    }
  }

  async createReviewQuestionImageUploadGrant(
    projectId: string,
    questionId: string,
    user: RequestUser,
    input: ReviewQuestionImageUploadGrantInput
  ): Promise<UploadGrant> {
    await this.access.requireProjectMember(projectId, user.id);
    await this.access.requireMutableProject(projectId, user.id);
    const question = await this.requireReviewQuestion(projectId, questionId);
    this.assertCanMessageReviewQuestion(question, user);
    this.assertReviewQuestionCanReceiveMessage(question);
    this.assertValidReviewQuestionImage(input);
    return this.fileStorage().createReviewQuestionImageUploadGrant(
      projectId,
      questionId,
      normalizeUploadedFileName(input.fileName),
      input.mimeType.toLowerCase()
    );
  }

  async uploadReviewQuestionImage(
    projectId: string,
    questionId: string,
    user: RequestUser,
    file: UploadedWorkflowFile
  ): Promise<ConfirmReviewQuestionImageInput> {
    await this.access.requireProjectMember(projectId, user.id);
    await this.access.requireMutableProject(projectId, user.id);
    const question = await this.requireReviewQuestion(projectId, questionId);
    this.assertCanMessageReviewQuestion(question, user);
    this.assertReviewQuestionCanReceiveMessage(question);
    if (!file?.buffer?.length) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Please upload an image."
      );
    }
    const input = {
      fileName: normalizeUploadedFileName(file.originalname),
      fileSize: file.size,
      mimeType: file.mimetype || "application/octet-stream",
    };
    this.assertValidReviewQuestionImage(input);
    const stored = await this.fileStorage().putReviewQuestionImage(
      projectId,
      questionId,
      input.fileName,
      file.buffer,
      input.mimeType.toLowerCase()
    );
    return {
      ...input,
      mimeType: input.mimeType.toLowerCase(),
      objectKey: stored.objectKey,
    };
  }

  async replyWorkingPaperQuestion(
    projectId: string,
    questionId: string,
    user: RequestUser,
    input: ReplyReviewQuestionInput,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    await this.access.requireMutableProject(projectId, user.id);
    const question = await this.requireReviewQuestion(projectId, questionId);
    // 未指定 → 所有人可回复；已指定 → 被指派人和创建人可回复
    if (
      question.assignedToId &&
      question.assignedToId !== user.id &&
      question.createdById !== user.id
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "只有被指派的成员可以回复该复核意见"
      );
    }
    if (question.status !== "OPEN" && question.status !== "REPLIED") {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "当前状态无法回复该复核意见"
      );
    }
    const paper = await this.requireWorkingPaper(
      projectId,
      question.workingPaperId
    );
    const body = input.replyBody?.trim() ?? "";
    const images = input.images ?? [];
    const referencedWorkingPaperIds =
      await this.requireReviewQuestionReferencedPapers(
        projectId,
        input.referencedWorkingPaperIds
      );
    if (
      !body &&
      images.length === 0 &&
      referencedWorkingPaperIds.length === 0
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Message requires text, an attachment, or a workpaper reference"
      );
    }
    const imageData = await Promise.all(
      images.map((image) =>
        this.assertReviewQuestionImageObjectMatches(
          projectId,
          questionId,
          image
        )
      )
    );
    const repliedAt = new Date();
    const isQuestionCreator = question.createdById === user.id;
    const replyIsFollowUp = isQuestionCreator && question.status === "REPLIED";
    await this.prisma.workingPaperQuestionMessage.create({
      data: {
        questionId,
        authorId: user.id,
        messageType: replyIsFollowUp ? "FOLLOW_UP" : "REPLY",
        body,
        createdAt: repliedAt,
        ...(imageData.length > 0
          ? {
              images: {
                create: imageData,
              },
            }
          : {}),
        ...(referencedWorkingPaperIds.length > 0
          ? {
              references: {
                create: referencedWorkingPaperIds.map((workingPaperId) => ({
                  workingPaperId,
                })),
              },
            }
          : {}),
      },
      include: REVIEW_QUESTION_INCLUDE.messages.include,
    });
    const updated = await this.prisma.workingPaperQuestion.update({
      where: { id: questionId },
      data: { updatedAt: repliedAt },
      include: REVIEW_QUESTION_INCLUDE,
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "WORKING_PAPER_QUESTION_REPLIED",
      targetType: "WORKING_PAPER_QUESTION",
      targetId: questionId,
      projectId,
      description: "回复复核意见",
      source,
    });
    if (!isQuestionCreator) {
      await this.notifyReviewQuestionReplied(projectId, paper, question, user);
    } else if (replyIsFollowUp) {
      await this.notifyReviewQuestionFollowedUp(
        projectId,
        paper,
        question,
        user
      );
    }
    return updated;
  }

  async attachWorkingPaperQuestionInitialMessage(
    projectId: string,
    questionId: string,
    user: RequestUser,
    input: { images?: ConfirmReviewQuestionImageInput[] }
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    await this.access.requireMutableProject(projectId, user.id);
    const question = await this.requireReviewQuestion(projectId, questionId);
    if (question.createdById !== user.id) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only the review note author can attach files to the original question"
      );
    }
    const images = input.images ?? [];
    const imageData = await Promise.all(
      images.map((image) =>
        this.assertReviewQuestionImageObjectMatches(
          projectId,
          questionId,
          image
        )
      )
    );
    const questionMessage =
      await this.prisma.workingPaperQuestionMessage.findFirst({
        where: { questionId, messageType: "QUESTION" },
        orderBy: { createdAt: "asc" },
      });
    if (!questionMessage) {
      throw new ApiBadRequestException(
        "NOT_FOUND",
        "Original review note message not found"
      );
    }
    if (imageData.length > 0) {
      await this.prisma.workingPaperQuestionMessageImage.createMany({
        data: imageData.map((image) => ({
          ...image,
          messageId: questionMessage.id,
        })),
        skipDuplicates: true,
      });
    }
    return this.prisma.workingPaperQuestion.findUniqueOrThrow({
      where: { id: questionId },
      include: REVIEW_QUESTION_INCLUDE,
    });
  }

  async downloadReviewQuestionImage(
    projectId: string,
    imageId: string,
    user: RequestUser
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const image = await this.prisma.workingPaperQuestionMessageImage.findFirst({
      where: {
        id: imageId,
        message: {
          question: {
            projectId,
          },
        },
      },
    });
    if (!image) {
      throw new ApiBadRequestException(
        "NOT_FOUND",
        "Review note image not found"
      );
    }
    return {
      fileName: normalizeUploadedFileName(image.originalName ?? image.fileName),
      mimeType: image.mimeType,
      body: await this.fileStorage().getObjectBuffer(image.objectKey),
    };
  }

  async markWorkingPaperQuestionReplied(
    projectId: string,
    questionId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    await this.access.requireMutableProject(projectId, user.id);
    const question = await this.requireReviewQuestion(projectId, questionId);
    if (
      question.assignedToId &&
      question.assignedToId !== user.id &&
      question.createdById !== user.id
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only the assigned member can mark this review note as replied"
      );
    }
    if (question.status !== "OPEN") {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Only open review notes can be marked as replied"
      );
    }
    const paper = await this.requireWorkingPaper(
      projectId,
      question.workingPaperId
    );
    const repliedAt = new Date();
    const updated = await this.prisma.workingPaperQuestion.update({
      where: { id: questionId },
      data: {
        status: "REPLIED",
        repliedById: user.id,
        repliedAt,
        clearedById: null,
        clearedAt: null,
      },
      include: REVIEW_QUESTION_INCLUDE,
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "WORKING_PAPER_QUESTION_REPLIED",
      targetType: "WORKING_PAPER_QUESTION",
      targetId: questionId,
      projectId,
      description: "Marked review note as replied",
      source,
    });
    await this.notifyReviewQuestionReplied(projectId, paper, question, user);
    return updated;
  }

  async followUpWorkingPaperQuestion(
    projectId: string,
    questionId: string,
    user: RequestUser,
    input: { body: string },
    source?: AuditLogSource
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    await this.access.requireMutableProject(projectId, user.id);
    const question = await this.requireReviewQuestion(projectId, questionId);
    if (question.createdById !== user.id) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "只有提出该复核意见的人可以继续追问"
      );
    }
    if (question.status !== "REPLIED") {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "只有已回复的复核意见可以继续追问"
      );
    }
    const paper = await this.requireWorkingPaper(
      projectId,
      question.workingPaperId
    );
    const body = input.body.trim();
    const followedUpAt = new Date();
    await this.prisma.workingPaperQuestionMessage.create({
      data: {
        questionId,
        authorId: user.id,
        messageType: "FOLLOW_UP",
        body,
        createdAt: followedUpAt,
      },
    });
    const updated = await this.prisma.workingPaperQuestion.update({
      where: { id: questionId },
      data: {
        status: "OPEN",
        clearedById: null,
        clearedAt: null,
      },
      include: REVIEW_QUESTION_INCLUDE,
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "WORKING_PAPER_QUESTION_FOLLOWED_UP",
      targetType: "WORKING_PAPER_QUESTION",
      targetId: questionId,
      projectId,
      description: "继续追问复核意见",
      source,
    });
    await this.notifyReviewQuestionFollowedUp(projectId, paper, question, user);
    return updated;
  }

  async clearWorkingPaperQuestion(
    projectId: string,
    questionId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    await this.access.requireMutableProject(projectId, user.id);
    const question = await this.requireReviewQuestion(projectId, questionId);
    if (question.createdById !== user.id) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "只有提出该复核意见的人可以标记已解决"
      );
    }
    if (question.status === "CLEARED") {
      throw new ApiBadRequestException("BAD_REQUEST", "该复核意见已清除");
    }
    const updated = await this.prisma.workingPaperQuestion.update({
      where: { id: questionId },
      data: {
        status: "CLEARED",
        clearedById: user.id,
        clearedAt: new Date(),
      },
      include: REVIEW_QUESTION_INCLUDE,
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "WORKING_PAPER_QUESTION_CLEARED",
      targetType: "WORKING_PAPER_QUESTION",
      targetId: questionId,
      projectId,
      description: "清除复核意见",
      source,
    });
    return updated;
  }

  async reopenWorkingPaperQuestion(
    projectId: string,
    questionId: string,
    user: RequestUser,
    input: { body: string },
    source?: AuditLogSource
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    await this.access.requireMutableProject(projectId, user.id);
    const question = await this.requireReviewQuestion(projectId, questionId);
    if (question.createdById !== user.id) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "只有提出该复核意见的人可以重新打开"
      );
    }
    if (question.status !== "CLEARED") {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "只有已解决的复核意见可以重新打开"
      );
    }
    const paper = await this.requireWorkingPaper(
      projectId,
      question.workingPaperId
    );
    const body = input.body.trim();
    const reopenedAt = new Date();
    await this.prisma.workingPaperQuestionMessage.create({
      data: {
        questionId,
        authorId: user.id,
        messageType: "REOPEN",
        body,
        createdAt: reopenedAt,
      },
    });
    const updated = await this.prisma.workingPaperQuestion.update({
      where: { id: questionId },
      data: {
        status: "OPEN",
        reopenedById: user.id,
        reopenedAt,
        clearedById: null,
        clearedAt: null,
      },
      include: REVIEW_QUESTION_INCLUDE,
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "WORKING_PAPER_QUESTION_REOPENED",
      targetType: "WORKING_PAPER_QUESTION",
      targetId: questionId,
      projectId,
      description: "重新打开复核意见",
      source,
    });
    await this.notifyReviewQuestionReopened(projectId, paper, question, user);
    return updated;
  }

  async createNode(
    projectId: string,
    user: RequestUser,
    input: { parentId?: string | null; code: string; title: string },
    source?: AuditLogSource
  ) {
    await this.access.requireProjectAction(projectId, user.id, "modifyIndex");

    const parentIdInput = input.parentId?.trim() || null;
    const isRoot = !parentIdInput;
    let level: number;
    let parentId: string | null;

    if (isRoot) {
      level = 1;
      parentId = null;
    } else {
      const parent = await this.prisma.workflowNode.findFirst({
        where: { id: parentIdInput, projectId },
      });
      if (!parent) {
        throw new ApiBadRequestException("BAD_REQUEST", "父级组或阶段不存在");
      }
      const childLevel = getCreatableChildLevel(parent.level);
      level = childLevel;
      parentId = parent.id;
    }

    const code = normalizeWorkflowNodeCode(input.code);
    const existingCode = await this.prisma.workflowNode.findFirst({
      where: { projectId, parentId, code },
      select: { id: true },
    });
    if (existingCode) {
      throw new ApiBadRequestException(
        "DUPLICATE_CODE",
        "同一父级下编号已存在"
      );
    }

    const sortOrder = await this.nextSortOrder(projectId, parentId ?? null);
    const requestedTitle =
      input.title.trim() === input.code.trim() ? code : input.title.trim();
    const siblings = await this.prisma.workflowNode.findMany({
      where: { projectId, parentId },
      select: { title: true },
    });
    const title = buildUniqueWorkflowNodeTitle(
      requestedTitle,
      siblings.map((sibling) => sibling.title)
    );
    try {
      const node = await this.prisma.workflowNode.create({
        data: {
          projectId,
          parentId,
          level,
          code,
          title,
          nodeType: getWorkflowNodeType(level),
          sortOrder,
          createdBy: user.id,
        },
        include: { workingPapers: true },
      });
      await this.auditLogs.log({
        actorId: user.id,
        action: "WORKFLOW_NODE_CREATED",
        targetType: "WORKFLOW_NODE",
        targetId: node.id,
        projectId,
        description: `新增${getWorkflowNodeLevelLabel(node.level)} ${node.code}`,
        source,
      });
      return node;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiBadRequestException(
          "DUPLICATE_CODE",
          "同一父级下编号已存在"
        );
      }
      throw error;
    }
  }

  async deleteNode(
    projectId: string,
    nodeId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectAction(projectId, user.id, "modifyIndex");
    const node = await this.prisma.workflowNode.findFirst({
      where: { id: nodeId, projectId },
    });
    if (!node) {
      throw new ApiBadRequestException("BAD_REQUEST", "组或底稿不存在");
    }
    const deletedAt = new Date();
    const directChildren =
      node.level === 1
        ? await this.prisma.workflowNode.findMany({
            where: { projectId, parentId: node.id },
            select: { id: true },
          })
        : [];
    const directChildIds = directChildren.map((child) => child.id);
    const nodesToDelete = await this.prisma.workflowNode.findMany({
      where:
        node.level === 1
          ? {
              projectId,
              OR: [
                { id: node.id },
                { parentId: node.id },
                { parentId: { in: directChildIds } },
              ],
            }
          : node.level === 2
            ? { projectId, OR: [{ id: node.id }, { parentId: node.id }] }
            : { projectId, id: node.id },
      include: {
        workingPapers: {
          include: {
            attachments: {
              where: { deletedAt: null },
              include: ATTACHMENT_USER_INCLUDE,
            },
          },
        },
      },
    });
    const attachmentsToArchive = nodesToDelete.flatMap((workflowNode) =>
      workflowNode.workingPapers.flatMap((paper) =>
        paper.attachments.map((attachment) => ({
          attachment,
          paper,
        }))
      )
    );
    await this.prisma.$transaction(async (tx) => {
      for (const item of attachmentsToArchive) {
        await tx.attachment.update({
          where: { id: item.attachment.id },
          data: buildAttachmentRecycleData(user.id, deletedAt, item.paper),
        });
      }
      await tx.workflowNode.delete({ where: { id: node.id } });
    });
    for (const item of attachmentsToArchive) {
      await this.revokeDesktopMasterGrantForSession(
        item.attachment.lockSessionId
      );
    }
    for (const item of attachmentsToArchive) {
      await this.auditLogs.log({
        actorId: user.id,
        action: "ATTACHMENT_DELETED",
        targetType: "ATTACHMENT",
        targetId: item.attachment.id,
        projectId,
        description: `删除文件 ${item.attachment.originalName ?? item.attachment.fileName}`,
        source,
      });
    }
    await this.auditLogs.log({
      actorId: user.id,
      action: "WORKFLOW_NODE_DELETED",
      targetType: "WORKFLOW_NODE",
      targetId: node.id,
      projectId,
      description: `删除${getWorkflowNodeLevelLabel(node.level)} ${node.code}`,
      source,
    });
    return { id: node.id };
  }

  async updateNode(
    projectId: string,
    nodeId: string,
    user: RequestUser,
    input: {
      code?: string;
      title?: string;
      parentId?: string | null;
      insert?: { targetNodeId: string; placement: "BEFORE" | "AFTER" };
    }
  ) {
    await this.access.requireProjectAction(projectId, user.id, "modifyIndex");
    const node = await this.prisma.workflowNode.findFirst({
      where: { id: nodeId, projectId },
    });
    if (!node) {
      throw new ApiBadRequestException("BAD_REQUEST", "组或底稿不存在");
    }

    try {
      const updatedNode = await this.prisma.$transaction(async (tx) => {
        let { parentId } = node;
        let { level } = node;
        let shouldRelocate = false;
        const requestedParentId =
          "parentId" in input ? input.parentId?.trim() || null : undefined;

        if (requestedParentId !== undefined) {
          const targetParent = requestedParentId
            ? await tx.workflowNode.findFirst({
                where: { id: requestedParentId, projectId },
              })
            : null;
          if (requestedParentId && !targetParent) {
            throw new ApiBadRequestException("BAD_REQUEST", "目标目录不存在");
          }
          if (
            targetParent &&
            (targetParent.id === node.id ||
              (await this.isWorkflowNodeDescendant(
                tx,
                projectId,
                targetParent.id,
                node.id
              )))
          ) {
            throw new ApiBadRequestException(
              "BAD_REQUEST",
              "不能移动到自身或下级目录"
            );
          }
          const targetLevel = targetParent
            ? getCreatableChildLevel(targetParent.level)
            : 1;
          parentId = targetParent?.id ?? null;
          level = targetLevel;
          shouldRelocate = parentId !== node.parentId || level !== node.level;
        }

        const { insert } = input;
        if (insert) {
          const insertTarget = await tx.workflowNode.findFirst({
            where: { id: insert.targetNodeId, projectId },
          });
          if (!insertTarget) {
            throw new ApiBadRequestException("BAD_REQUEST", "插入位置不存在");
          }
          const insertParentId = insertTarget.parentId ?? null;
          if (requestedParentId === undefined) {
            parentId = insertParentId;
            ({ level } = insertTarget);
          } else if ((parentId ?? null) !== insertParentId) {
            throw new ApiBadRequestException(
              "BAD_REQUEST",
              "插入位置必须在目标目录下"
            );
          }
          shouldRelocate ||=
            parentId !== node.parentId ||
            level !== node.level ||
            insert.targetNodeId !== node.id;
        }

        const data: Prisma.WorkflowNodeUpdateInput = {};
        if (input.code !== undefined && input.title !== undefined) {
          const code = normalizeWorkflowNodeCode(input.code);
          data.code = code;
          data.title =
            input.title.trim() === input.code.trim() ? code : input.title;
        }
        if (shouldRelocate) {
          data.parent = parentId
            ? { connect: { id: parentId } }
            : { disconnect: true };
          data.level = level;
          data.nodeType = getWorkflowNodeType(level);
        }

        const updated = await tx.workflowNode.update({
          where: { id: node.id },
          data,
          include: { workingPapers: true },
        });

        if (shouldRelocate) {
          await this.updateWorkflowNodeDescendantLevels(
            tx,
            projectId,
            node.id,
            level
          );
        }
        if (shouldRelocate || insert) {
          await this.reorderWorkflowSiblings(
            tx,
            projectId,
            parentId,
            node.id,
            insert
          );
        }
        return updated;
      });
      await this.auditLogs.log({
        actorId: user.id,
        action: "WORKFLOW_NODE_UPDATED",
        targetType: "WORKFLOW_NODE",
        targetId: updatedNode.id,
        projectId,
        description:
          input.code === undefined
            ? `移动${getWorkflowNodeLevelLabel(updatedNode.level)} ${updatedNode.code}`
            : `重命名${getWorkflowNodeLevelLabel(updatedNode.level)} ${updatedNode.code}`,
      });
      return normalizeWorkflowNodeResponse(updatedNode);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiBadRequestException(
          "DUPLICATE_CODE",
          "同一父级下编号已存在"
        );
      }
      throw error;
    }
  }

  private async isWorkflowNodeDescendant(
    tx: Prisma.TransactionClient,
    projectId: string,
    nodeId: string,
    ancestorId: string
  ): Promise<boolean> {
    const node = await tx.workflowNode.findFirst({
      where: { id: nodeId, projectId },
      select: { parentId: true },
    });
    if (!node?.parentId) {
      return false;
    }
    if (node.parentId === ancestorId) {
      return true;
    }
    return this.isWorkflowNodeDescendant(
      tx,
      projectId,
      node.parentId,
      ancestorId
    );
  }

  private async updateWorkflowNodeDescendantLevels(
    tx: Prisma.TransactionClient,
    projectId: string,
    parentId: string,
    parentLevel: number
  ) {
    const children = await tx.workflowNode.findMany({
      where: { projectId, parentId },
      select: { id: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    for (const child of children) {
      const level = parentLevel + 1;
      await tx.workflowNode.update({
        where: { id: child.id },
        data: { level, nodeType: getWorkflowNodeType(level) },
      });
      await this.updateWorkflowNodeDescendantLevels(
        tx,
        projectId,
        child.id,
        level
      );
    }
  }

  private async reorderWorkflowSiblings(
    tx: Prisma.TransactionClient,
    projectId: string,
    parentId: string | null,
    movedNodeId: string,
    insert?: { targetNodeId: string; placement: "BEFORE" | "AFTER" }
  ) {
    const siblings = await tx.workflowNode.findMany({
      where: { projectId, parentId },
      select: { id: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const orderedIds = siblings
      .map((item) => item.id)
      .filter((id) => id !== movedNodeId);
    const targetIndex = insert ? orderedIds.indexOf(insert.targetNodeId) : -1;
    const insertIndex =
      targetIndex < 0
        ? orderedIds.length
        : insert?.placement === "BEFORE"
          ? targetIndex
          : targetIndex + 1;
    orderedIds.splice(insertIndex, 0, movedNodeId);
    for (const [index, id] of orderedIds.entries()) {
      await tx.workflowNode.update({
        where: { id },
        data: { sortOrder: index + 1 },
      });
    }
  }

  private async notifyWorkingPaperSignoff(
    signoffType: "PREPARER" | "REVIEWER",
    paper: {
      id: string;
      projectId: string;
      code: string;
      title: string;
      preparerId: string | null;
      reviewerId: string | null;
    },
    user: RequestUser
  ) {
    const recipientId =
      signoffType === "PREPARER" ? paper.reviewerId : paper.preparerId;
    if (!recipientId) {
      return;
    }

    const isPrepared = signoffType === "PREPARER";
    await this.inbox?.createCollaborationMessage({
      recipientId,
      senderId: user.id,
      projectId: paper.projectId,
      workingPaperId: paper.id,
      type: "SIGNOFF",
      title: isPrepared
        ? `底稿已完成编制：${paper.code}`
        : `底稿已完成复核：${paper.code}`,
      body: `${user.name} 已${isPrepared ? "编制签署" : "复核签署"}底稿 ${paper.code} ${paper.title}。`,
      contentKey: isPrepared
        ? "WORKING_PAPER_PREPARED"
        : "WORKING_PAPER_REVIEWED",
      contentParams: {
        actor: user.name,
        paperCode: paper.code,
        paperTitle: paper.title,
      },
      actionUrl: this.projectActionUrl(paper.projectId),
    });
  }

  private dispatchNotification(label: string, operation: Promise<unknown>) {
    void operation.catch((error) => {
      this.logger.warn(
        `Unable to deliver ${label} notification: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    });
  }

  private async notifyReviewQuestionCreated(
    projectId: string,
    paper: { id: string; code: string; title: string },
    question: { id: string; assignedToId: string | null; body: string },
    user: RequestUser
  ) {
    if (!question.assignedToId) {
      return;
    }
    await this.inbox?.createCollaborationMessage({
      recipientId: question.assignedToId,
      senderId: user.id,
      projectId,
      workingPaperId: paper.id,
      reviewQuestionId: question.id,
      type: "REVIEW_QUESTION",
      title: `复核问题待回复：${paper.code}`,
      body: `${user.name} 指派你处理底稿 ${paper.code} ${paper.title} 的复核问题：${this.notificationExcerpt(question.body)}`,
      contentKey: "REVIEW_QUESTION_ASSIGNED",
      contentParams: {
        actor: user.name,
        paperCode: paper.code,
        paperTitle: paper.title,
        question: this.notificationExcerpt(question.body),
      },
      actionUrl: this.projectActionUrl(projectId),
    });
  }

  private async notifyReviewQuestionReplied(
    projectId: string,
    paper: { id: string; code: string; title: string },
    question: { id: string; createdById: string; body: string },
    user: RequestUser
  ) {
    await this.inbox?.createCollaborationMessage({
      recipientId: question.createdById,
      senderId: user.id,
      projectId,
      workingPaperId: paper.id,
      reviewQuestionId: question.id,
      type: "REVIEW_REPLY",
      title: `复核问题已回复：${paper.code}`,
      body: `${user.name} 回复了底稿 ${paper.code} ${paper.title} 的复核问题：${this.notificationExcerpt(question.body)}`,
      contentKey: "REVIEW_QUESTION_REPLIED",
      contentParams: {
        actor: user.name,
        paperCode: paper.code,
        paperTitle: paper.title,
        question: this.notificationExcerpt(question.body),
      },
      actionUrl: this.projectActionUrl(projectId),
    });
  }

  private async notifyReviewQuestionFollowedUp(
    projectId: string,
    paper: { id: string; code: string; title: string },
    question: { id: string; assignedToId: string | null; body: string },
    user: RequestUser
  ) {
    if (!question.assignedToId) {
      return;
    }
    await this.inbox?.createCollaborationMessage({
      recipientId: question.assignedToId,
      senderId: user.id,
      projectId,
      workingPaperId: paper.id,
      reviewQuestionId: question.id,
      type: "REVIEW_FOLLOW_UP",
      title: `复核问题需补充：${paper.code}`,
      body: `${user.name} 继续追问底稿 ${paper.code} ${paper.title} 的复核问题：${this.notificationExcerpt(question.body)}`,
      contentKey: "REVIEW_QUESTION_FOLLOW_UP",
      contentParams: {
        actor: user.name,
        paperCode: paper.code,
        paperTitle: paper.title,
        question: this.notificationExcerpt(question.body),
      },
      actionUrl: this.projectActionUrl(projectId),
    });
  }

  private async notifyReviewQuestionReopened(
    projectId: string,
    paper: { id: string; code: string; title: string },
    question: { id: string; assignedToId: string | null; body: string },
    user: RequestUser
  ) {
    if (!question.assignedToId) {
      return;
    }
    await this.inbox?.createCollaborationMessage({
      recipientId: question.assignedToId,
      senderId: user.id,
      projectId,
      workingPaperId: paper.id,
      reviewQuestionId: question.id,
      type: "REVIEW_REOPENED",
      title: `复核问题已重开：${paper.code}`,
      body: `${user.name} 重新打开底稿 ${paper.code} ${paper.title} 的复核问题：${this.notificationExcerpt(question.body)}`,
      contentKey: "REVIEW_QUESTION_REOPENED",
      contentParams: {
        actor: user.name,
        paperCode: paper.code,
        paperTitle: paper.title,
        question: this.notificationExcerpt(question.body),
      },
      actionUrl: this.projectActionUrl(projectId),
    });
  }

  private projectActionUrl(projectId: string) {
    return `/engagement/${projectId}`;
  }

  private notificationExcerpt(value: string, limit = 120) {
    const normalized = value.trim().replaceAll(/\s+/g, " ");
    if (normalized.length <= limit) {
      return normalized;
    }
    return `${normalized.slice(0, limit - 1)}…`;
  }

  private async requireWorkingPaper(projectId: string, paperId: string) {
    const paper = await this.prisma.workingPaper.findFirst({
      where: { id: paperId, projectId },
    });
    if (!paper) {
      throw new ApiBadRequestException("NOT_FOUND", "底稿不存在");
    }
    return paper;
  }

  private async findActiveAttachmentIdForWorkingPaper(
    projectId: string,
    paperId: string
  ) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { projectId, workingPaperId: paperId, deletedAt: null },
      select: { id: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return attachment?.id ?? null;
  }

  private async nextAttachmentSortOrder(
    projectId: string,
    workflowNodeId: string,
    bucket: WorkingPaperBucket
  ) {
    const lastAttachment = await this.prisma.attachment.findFirst({
      where: {
        projectId,
        workflowNodeId,
        bucket,
        deletedAt: null,
      },
      select: { sortOrder: true },
      orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
    });
    return (lastAttachment?.sortOrder ?? -1) + 1;
  }

  private async requireAttachment(projectId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, projectId, deletedAt: null },
    });
    if (!attachment) {
      throw new ApiBadRequestException("NOT_FOUND", "附件不存在");
    }
    return attachment;
  }

  private async resolveAttachmentWorkflowNodeCode(
    projectId: string,
    attachment: {
      workflowNodeId?: string | null;
      workingPaperId?: string | null;
    }
  ) {
    let workflowNodeId = attachment.workflowNodeId ?? null;
    if (!workflowNodeId && attachment.workingPaperId) {
      const paper = await this.prisma.workingPaper.findFirst({
        where: { id: attachment.workingPaperId, projectId },
        select: { workflowNodeId: true },
      });
      workflowNodeId = paper?.workflowNodeId ?? null;
    }
    if (!workflowNodeId) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "File code cannot be validated without a folder"
      );
    }
    const node = await this.prisma.workflowNode.findFirst({
      where: { id: workflowNodeId, projectId },
      select: { code: true },
    });
    if (!node) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "File code cannot be validated without a folder"
      );
    }
    return node.code;
  }

  private requireAttachmentMetadataEditable(
    attachment: LockableAttachment,
    user: RequestUser
  ) {
    this.requireAttachmentNotConflictFrozen(attachment);
    if (hasActiveLock(attachment) && attachment.lockedBy !== user.id) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "This file is locked by another member"
      );
    }
  }

  private async notifyAttachmentConflict(
    projectId: string,
    attachment: {
      id: string;
      originalName?: string | null;
      fileName: string;
    },
    input: { candidateVersionId: string; uploaderId: string }
  ) {
    const { inbox } = this;
    if (!inbox) {
      return;
    }
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ownerId: true,
        members: {
          where: { projectRole: "PARTNER", status: "ACTIVE" },
          select: { userId: true },
        },
      },
    });
    if (!project) {
      return;
    }
    const recipientIds = new Set([
      project.ownerId,
      ...project.members.map((member) => member.userId),
    ]);
    await Promise.all(
      [...recipientIds].map((recipientId) =>
        inbox.createCollaborationMessage({
          recipientId,
          senderId: input.uploaderId,
          projectId,
          type: "ATTACHMENT_CONFLICT",
          title: `底稿版本冲突待裁决：${attachment.originalName ?? attachment.fileName}`,
          body: `Desktop Agent 已保留冲突版本 ${input.candidateVersionId}。该底稿已冻结，请由 PIC 选择服务端版本、冲突版本或共同父版本。`,
          contentKey: "ATTACHMENT_CONFLICT",
          contentParams: {
            fileName: attachment.originalName ?? attachment.fileName,
            candidateVersionId: input.candidateVersionId,
          },
          actionUrl: this.projectActionUrl(projectId),
        })
      )
    );
  }

  private requireAttachmentNotConflictFrozen(attachment: {
    conflictFrozenAt?: Date | null;
  }) {
    if (attachment.conflictFrozenAt) {
      throw new ApiBadRequestException(
        "CONFLICT_FROZEN",
        "This file is frozen until its version conflict is resolved."
      );
    }
  }

  private requireNoDesktopMasterHeadMutation(
    attachment: LockableAttachment & {
      lockSessionId?: string | null;
    }
  ) {
    if (hasActiveLock(attachment) && attachment.lockSessionId) {
      throw new ApiBadRequestException(
        "CONFLICT_RISK",
        "A desktop Master session is active. Check in or release it before changing the server version."
      );
    }
  }

  private async requireDesktopMasterGrant(
    input: Pick<
      | DesktopMasterCheckInInput
      | DesktopMasterReleaseInput
      | DesktopMasterHeartbeatInput,
      "projectId" | "attachmentId" | "lockSessionId" | "grantSecret"
    >,
    action: "CHECK_IN" | "RELEASE" | "HEARTBEAT",
    options: { allowRevoked?: boolean } = {}
  ) {
    const grant = await this.findDesktopMasterGrant(input);
    this.assertDesktopMasterGrant(grant, input, action, options);
    if (action !== "RELEASE") {
      await this.requireProjectActionWithRole(
        input.projectId,
        grant.userId,
        "uploadWorkingPapers",
        "PREPARER"
      );
    }
    return grant;
  }

  private assertDesktopCheckInIdempotencyMatches(
    previous: {
      projectId?: string | null;
      attachmentId?: string | null;
      lockSessionId?: string | null;
      localContentHash?: string | null;
    },
    input: Pick<
      DesktopMasterCheckInInput,
      "projectId" | "attachmentId" | "lockSessionId" | "localContentHash"
    >
  ) {
    if (
      previous.projectId !== input.projectId ||
      previous.attachmentId !== input.attachmentId ||
      previous.lockSessionId !== input.lockSessionId ||
      previous.localContentHash !== input.localContentHash
    ) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Desktop check-in idempotency key does not match this request."
      );
    }
  }

  private async findDesktopMasterGrant(
    input: Pick<
      | DesktopMasterCheckInInput
      | DesktopMasterReleaseInput
      | DesktopMasterHeartbeatInput,
      "projectId" | "attachmentId" | "lockSessionId" | "grantSecret"
    >
  ) {
    return (await this.prisma.desktopMasterGrant.findFirst({
      where: {
        projectId: input.projectId,
        attachmentId: input.attachmentId,
        lockSessionId: input.lockSessionId,
        secretHash: hashDesktopGrantSecret(input.grantSecret),
      },
    })) as {
      id: string;
      lockSessionId: string;
      projectId: string;
      attachmentId: string;
      userId: string;
      issuedAt?: Date | null;
      expiresAt?: Date | null;
      revokedAt?: Date | null;
      lastUsedAt?: Date | null;
      secretHash: string;
      allowedActions?: string | null;
    } | null;
  }

  private assertDesktopMasterGrant(
    grant: Awaited<ReturnType<WorkflowService["findDesktopMasterGrant"]>>,
    input: Pick<
      | DesktopMasterCheckInInput
      | DesktopMasterReleaseInput
      | DesktopMasterHeartbeatInput,
      "grantSecret"
    >,
    action: "CHECK_IN" | "RELEASE" | "HEARTBEAT",
    options: { allowRevoked?: boolean } = {}
  ): asserts grant is NonNullable<typeof grant> {
    if (!grant || (grant.revokedAt && !options.allowRevoked)) {
      throw new ApiBadRequestException(
        "LOCK_REVOKED",
        "Desktop Master grant is no longer active."
      );
    }
    if (
      action === "HEARTBEAT" &&
      !isDesktopMasterGrantLeaseAlive(grant, new Date())
    ) {
      throw new ApiBadRequestException(
        "LOCK_REVOKED",
        "Desktop Master grant has expired."
      );
    }
    if (grant.secretHash !== hashDesktopGrantSecret(input.grantSecret)) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Desktop Master grant is invalid."
      );
    }
    const allowedActions = String(grant.allowedActions ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!allowedActions.includes(action)) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Desktop Master grant does not allow this action."
      );
    }
  }

  private isIdempotentDesktopReleaseRetry(
    attachment: {
      lockedBy?: string | null;
      lockSessionId?: string | null;
      lockReleaseReason?: string | null;
    },
    input: DesktopMasterReleaseInput
  ) {
    return (
      !attachment.lockedBy &&
      !attachment.lockSessionId &&
      attachment.lockReleaseReason === input.reason
    );
  }

  private requireMatchingDesktopMasterSession(
    attachment: {
      lockedBy?: string | null;
      lockSessionId?: string | null;
      lockEpoch?: number;
    },
    input: Pick<
      | DesktopMasterCheckInInput
      | DesktopMasterReleaseInput
      | DesktopMasterHeartbeatInput,
      "lockSessionId" | "lockEpoch"
    >,
    userId: string
  ) {
    if (attachment.lockedBy !== userId) {
      throw new ApiBadRequestException(
        "LOCK_REVOKED",
        "Desktop Master is not held by this grant user."
      );
    }
    if (attachment.lockSessionId !== input.lockSessionId) {
      throw new ApiBadRequestException(
        "LOCK_SESSION_MISMATCH",
        "Desktop Master session no longer matches the active lock."
      );
    }
    if (
      input.lockEpoch !== undefined &&
      attachment.lockEpoch !== input.lockEpoch
    ) {
      throw new ApiBadRequestException(
        "LOCK_SESSION_MISMATCH",
        "Desktop Master fencing token no longer matches the active lock."
      );
    }
  }

  private async revokeDesktopMasterGrantForSession(
    lockSessionId?: string | null,
    revokedAt = new Date()
  ) {
    if (!lockSessionId) {
      return;
    }
    await this.prisma.desktopMasterGrant.updateMany({
      where: { lockSessionId, revokedAt: null },
      data: { revokedAt, lastUsedAt: revokedAt },
    });
  }

  private async requireAttachmentVersion(
    projectId: string,
    attachmentId: string,
    versionId: string
  ) {
    const version = await this.prisma.attachmentVersion.findFirst({
      where: { id: versionId, attachmentId, projectId },
      include: ATTACHMENT_VERSION_USER_INCLUDE,
    });
    if (!version) {
      throw new ApiBadRequestException(
        "NOT_FOUND",
        "鏂囦欢鍘嗗彶鐗堟湰涓嶅瓨鍦?"
      );
    }
    return version;
  }

  private async requireDeletedAttachment(
    projectId: string,
    attachmentId: string
  ) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, projectId, deletedAt: { not: null } },
      include: ATTACHMENT_USER_INCLUDE,
    });
    if (!attachment) {
      throw new ApiBadRequestException("NOT_FOUND", "回收站文件不存在");
    }
    return attachment;
  }

  private async requireActiveProjectMember(projectId: string, userId: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: { user: { select: { globalRole: true, status: true } } },
    });
    if (
      !member ||
      member.status !== "ACTIVE" ||
      member.user.status !== "ACTIVE" ||
      !isProjectPermissionSubjectConsistent({
        globalRole: member.user.globalRole,
        projectRole: member.projectRole,
        inChargeRole: member.inChargeRole,
        authorizationSuspended: Boolean(member.authorizationSuspendedAt),
      })
    ) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "指派的成员不在项目中或访问授权已暂停"
      );
    }
    return member;
  }

  private async requireReviewQuestion(projectId: string, questionId: string) {
    const question = await this.prisma.workingPaperQuestion.findFirst({
      where: {
        id: questionId,
        projectId,
        OR: [
          { attachmentId: null },
          { attachment: { is: { deletedAt: null } } },
        ],
      },
    });
    if (!question) {
      throw new ApiBadRequestException(
        "NOT_FOUND",
        "The review question is unavailable or its file has been deleted."
      );
    }
    return question;
  }

  private async requireReviewQuestionReferencedPapers(
    projectId: string,
    workingPaperIds?: string[]
  ) {
    const uniqueIds = [...new Set(workingPaperIds)];
    if (uniqueIds.length === 0) {
      return [];
    }
    const papers = await this.prisma.workingPaper.findMany({
      where: { projectId, id: { in: uniqueIds } },
      select: { id: true },
    });
    if (papers.length !== uniqueIds.length) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "One or more referenced workpapers do not belong to this project."
      );
    }
    return uniqueIds;
  }

  private assertCanMessageReviewQuestion(
    question: { assignedToId?: string | null; createdById: string },
    user: RequestUser
  ) {
    if (
      question.assignedToId &&
      question.assignedToId !== user.id &&
      question.createdById !== user.id
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only the assigned member or note creator can send messages."
      );
    }
  }

  private assertReviewQuestionCanReceiveMessage(question: { status: string }) {
    if (question.status !== "OPEN" && question.status !== "REPLIED") {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Current review note status cannot receive messages."
      );
    }
  }

  private assertValidReviewQuestionImage(
    input: ReviewQuestionImageUploadGrantInput
  ) {
    const mimeType = input.mimeType.trim().toLowerCase();
    if (
      !(REVIEW_QUESTION_IMAGE_MIME_TYPES as readonly string[]).includes(
        mimeType
      )
    ) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "This review note attachment type is not supported."
      );
    }
    if (
      !Number.isFinite(input.fileSize) ||
      input.fileSize <= 0 ||
      input.fileSize > REVIEW_QUESTION_IMAGE_MAX_SIZE_BYTES
    ) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Review note attachments must be 25 MB or smaller."
      );
    }
  }

  private async assertReviewQuestionImageObjectMatches(
    projectId: string,
    questionId: string,
    input: ConfirmReviewQuestionImageInput
  ) {
    this.assertValidReviewQuestionImage(input);
    const prefix = `review-question-images/${projectId}/${questionId}/`;
    const normalizedObjectKey = normalizeConfirmedObjectKey(input.objectKey);
    if (!normalizedObjectKey || !normalizedObjectKey.startsWith(prefix)) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Uploaded attachment does not belong to the target review note."
      );
    }
    const metadata =
      await this.fileStorage().getObjectMetadata(normalizedObjectKey);
    if (metadata.contentLength !== input.fileSize) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Uploaded attachment size does not match the message metadata."
      );
    }
    if (
      metadata.contentType !== "application/octet-stream" &&
      metadata.contentType.toLowerCase() !== input.mimeType.toLowerCase()
    ) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Uploaded image content type does not match the message metadata."
      );
    }
    const stored = storedObjectFromKey(normalizedObjectKey);
    return {
      fileName: stored.fileName,
      originalName: normalizeUploadedFileName(input.fileName),
      objectKey: normalizedObjectKey,
      fileSize: input.fileSize,
      mimeType: input.mimeType.toLowerCase(),
      width: input.width,
      height: input.height,
    };
  }

  private requireSpreadsheetAttachment(attachment: {
    fileName: string;
    originalName?: string | null;
  }) {
    if (
      !isSpreadsheetPreviewFileName(
        attachment.originalName ?? attachment.fileName
      )
    ) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "只有表格文件可以在线预览"
      );
    }
  }

  private requireDesktopOpenSupportedAttachment(
    attachment: {
      fileName: string;
      originalName?: string | null;
    },
    mode: "MASTER" | "READ_ONLY" = "MASTER"
  ) {
    if (
      !isDesktopAgentOpenSupportedFileName(
        attachment.originalName ?? attachment.fileName,
        mode
      )
    ) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        mode === "READ_ONLY"
          ? "Desktop Agent read-only currently supports xlsx, xls, xlsm, xlsb, csv, docx, doc, pptx, ppt, and pdf files only."
          : "Desktop Agent currently supports xlsx, xls, xlsm, xlsb, csv, docx, doc, pptx, ppt, and pdf files only."
      );
    }
  }

  private requireUserActiveAttachmentLock(
    attachment: {
      lockedBy: string | null;
      lockExpiresAt: Date | null;
    },
    userId: string
  ) {
    if (hasActiveLock(attachment) && attachment.lockedBy !== userId) {
      throw new ApiBadRequestException("BAD_REQUEST", "该文件已被其他成员锁定");
    }
    if (!hasActiveLock(attachment) || attachment.lockedBy !== userId) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "请先锁定该文件后再上传新版本"
      );
    }
  }

  private async assertStoredObjectMatches(
    projectId: string,
    paperId: string,
    objectKey: string,
    fileSize: number,
    mimeType: string
  ): Promise<string> {
    const prefix = `working-papers/${projectId}/${paperId}/`;
    const normalizedObjectKey = normalizeConfirmedObjectKey(objectKey);
    if (!normalizedObjectKey || !normalizedObjectKey.startsWith(prefix)) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Uploaded object does not belong to the target workpaper."
      );
    }
    const metadata =
      await this.fileStorage().getObjectMetadata(normalizedObjectKey);
    if (metadata.contentLength !== fileSize) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Uploaded object size does not match the attachment metadata."
      );
    }
    if (
      mimeType &&
      metadata.contentType !== "application/octet-stream" &&
      metadata.contentType.toLowerCase() !== mimeType.toLowerCase()
    ) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Uploaded object content type does not match the attachment metadata."
      );
    }
    return normalizedObjectKey;
  }

  private async writeUploadedFile(
    projectId: string,
    paperId: string,
    file: UploadedWorkflowFile
  ) {
    const stored = await this.fileStorage().putObject(
      projectId,
      paperId,
      normalizeUploadedFileName(file.originalname),
      file.buffer,
      file.mimetype || "application/octet-stream"
    );
    return {
      fileName: stored.fileName,
      fileUrl: stored.objectKey,
    };
  }

  private fileStorage() {
    return this.storage ?? new StorageService();
  }

  private pdfRasterPreviewService() {
    return (
      this.pdfRasterPreview ??
      new PdfRasterPreviewService(this.fileStorage(), this.documentConversion)
    );
  }

  private spreadsheetPreviewCacheService() {
    return (
      this.spreadsheetPreview ??
      new SpreadsheetPreviewCacheService(this.fileStorage())
    );
  }

  private async ensureSpreadsheetPreviewCacheAvailable(attachment: {
    id: string;
    version: number;
    fileUrl: string;
    fileName: string;
    originalName?: string | null;
    mimeType: string;
    projectId?: string | null;
    fileSize?: number | null;
    contentHash?: string | null;
    previewStatus?: string | null;
    previewLeaseExpiresAt?: Date | null;
  }) {
    const preview = this.spreadsheetPreviewCacheService();
    if (await preview.getManifest(attachment)) {
      return;
    }
    await this.ensureAttachmentPreviewCacheQueued(attachment);
  }

  private async ensureAttachmentPreviewCacheQueued(attachment: {
    id: string;
    version: number;
    previewStatus?: string | null;
    previewLeaseExpiresAt?: Date | null;
  }): Promise<never> {
    const now = new Date();
    const processingLeaseIsActive =
      attachment.previewStatus === "PROCESSING" &&
      Boolean(
        attachment.previewLeaseExpiresAt &&
        attachment.previewLeaseExpiresAt > now
      );

    if (!processingLeaseIsActive && attachment.previewStatus !== "QUEUED") {
      await this.prisma.attachment.updateMany({
        where: { id: attachment.id, version: attachment.version },
        data: {
          ...queueAttachmentPreviewData(),
          previewUpdatedAt: now,
        },
      });
    }

    throw new ApiServiceUnavailableException(
      "PREVIEW_PROCESSING",
      "Preview is being prepared."
    );
  }

  private smartFormPdfService() {
    return this.smartFormPdf ?? new SmartFormV2PdfService();
  }

  private async createSmartFormExportFile(
    projectId: string,
    attachment: AttachmentExportSource,
    numberedFileName: string
  ): Promise<DownloadObject> {
    try {
      const snapshot = await this.createSmartFormPdfSnapshot(
        projectId,
        attachment
      );
      return {
        ...snapshot.downloadObject,
        fileName: replaceFileExtension(numberedFileName, ".pdf"),
      };
    } catch (error) {
      throw new ApiServiceUnavailableException(
        "EXPORT_CONVERSION_FAILED",
        error instanceof Error
          ? `Could not export the Smart Form as PDF: ${error.message}`
          : "Could not export the Smart Form as PDF."
      );
    }
  }

  private async createAttachmentZipExport(input: {
    projectId: string;
    attachment: AttachmentExportSource;
    project: AttachmentExportProject;
    workflowNodes: AttachmentExportWorkflowNode[];
    numberedFileName: string;
  }) {
    const { projectId, attachment, project, workflowNodes, numberedFileName } =
      input;
    if (
      !isSmartFormAttachment(attachment) &&
      attachment.fileSize > MAX_ATTACHMENT_ZIP_EXPORT_BYTES
    ) {
      throw new ApiServiceUnavailableException(
        "EXPORT_ZIP_FAILED",
        "This file is too large to package as ZIP. Export the original format instead."
      );
    }

    let fileName = numberedFileName;
    let body: Buffer;
    if (isSmartFormAttachment(attachment)) {
      let snapshot: SmartFormPdfSnapshot;
      try {
        snapshot = await this.createSmartFormPdfSnapshot(projectId, attachment);
        fileName = replaceFileExtension(numberedFileName, ".pdf");
      } catch (error) {
        throw new ApiServiceUnavailableException(
          "EXPORT_CONVERSION_FAILED",
          error instanceof Error
            ? `Could not export the Smart Form as PDF: ${error.message}`
            : "Could not export the Smart Form as PDF."
        );
      }
      body = await this.readExportObject(snapshot.previewAttachment.fileUrl);
    } else {
      body = await this.readExportObject(attachment.fileUrl);
    }

    try {
      const zip = new JSZip();
      const zipEntryPath = buildAttachmentZipEntryPath({
        attachment,
        project,
        workflowNodes,
        fileName,
      });
      zip.file(zipEntryPath, body, {
        binary: true,
        date: attachment.updatedAt,
      });
      return {
        fileName: `${stripFileExtension(sanitizeExportFileName(numberedFileName))}-export.zip`,
        mimeType: "application/zip",
        body: await zip.generateAsync({
          type: "nodebuffer",
          compression: "STORE",
          platform: "DOS",
        }),
      };
    } catch (error) {
      throw new ApiServiceUnavailableException(
        "EXPORT_ZIP_FAILED",
        error instanceof Error
          ? `Could not create the ZIP export: ${error.message}`
          : "Could not create the ZIP export."
      );
    }
  }

  private async readExportObject(objectKey: string) {
    try {
      return await this.fileStorage().getObjectBuffer(objectKey);
    } catch (error) {
      throw new ApiServiceUnavailableException(
        "EXPORT_STORAGE_FAILED",
        error instanceof Error
          ? `Could not read the file from storage: ${error.message}`
          : "Could not read the file from storage."
      );
    }
  }

  private async exportSmartFormPdfDownload(
    projectId: string,
    attachment: SmartFormPdfSourceAttachment
  ) {
    const snapshot = await this.createSmartFormPdfSnapshot(
      projectId,
      attachment
    );
    return snapshot.downloadObject;
  }

  private async createSmartFormPdfSnapshot(
    projectId: string,
    attachment: SmartFormPdfSourceAttachment
  ): Promise<SmartFormPdfSnapshot> {
    if (!attachment.fileUrl) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Smart Form source file is missing"
      );
    }
    const displayName = normalizeUploadedFileName(
      attachment.originalName ?? attachment.fileName
    );
    const source = await this.fileStorage().getObjectBuffer(attachment.fileUrl);
    const smartForm = SmartFormPackageSchema.parse(
      JSON.parse(source.toString("utf-8"))
    );
    const engagementDetails = await loadSmartFormV2PdfEngagementDetails(
      this.prisma,
      projectId,
      smartForm.template.language
    );
    const smartFormInstance = await this.prisma.smartFormInstance.findUnique({
      where: { attachmentId: attachment.id },
      select: {
        status: true,
        lastSavedAt: true,
        updatedAt: true,
        completedAt: true,
      },
    });
    const reviewQuestions = await this.prisma.workingPaperQuestion.findMany({
      where: {
        projectId,
        attachmentId: attachment.id,
      },
      orderBy: { createdAt: "asc" },
      include: REVIEW_QUESTION_INCLUDE,
    });
    const signoffs = await loadSmartFormV2PdfSignoffs(
      this.prisma,
      attachment.id
    );
    const pdfFileName = toPdfFileName(displayName);
    const previewCacheKey = buildSmartFormPdfPreviewCacheKey(
      attachment,
      smartFormInstance,
      reviewQuestions,
      signoffs
    );
    const cacheKey = pathModule.posix.join(
      "smart-form-pdf-cache",
      projectId,
      attachment.id,
      previewCacheKey,
      sanitizeCachePathSegment(pdfFileName)
    );
    const snapshot: SmartFormPdfSnapshot = {
      downloadObject: this.fileStorage().getDownloadObject(
        cacheKey,
        pdfFileName,
        "application/pdf"
      ),
      previewAttachment: {
        ...attachment,
        fileUrl: cacheKey,
        fileName: pdfFileName,
        originalName: pdfFileName,
        mimeType: "application/pdf",
        previewCacheKey,
      },
    };
    const cacheExists = await this.fileStorage()
      .getObjectMetadata(cacheKey)
      .then(
        () => true,
        () => false
      );
    if (cacheExists) {
      return snapshot;
    }

    const pdf = await this.smartFormPdfService().renderSmartFormV2Pdf({
      definition: smartForm.definition,
      response: smartForm.response,
      locale: smartForm.template.language,
      fileName: displayName,
      generatedAt: new Date(),
      documentVersion: `v${attachment.version}`,
      engagementDetails: engagementDetails ?? undefined,
      signoffs,
      reviewQuestions,
    });
    await this.fileStorage().putCacheObject(cacheKey, pdf, "application/pdf");
    return snapshot;
  }

  private async nextSortOrder(projectId: string, parentId: string | null) {
    const result = await this.prisma.workflowNode.aggregate({
      where: { projectId, parentId },
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? 0) + 1;
  }
}

type FlatNode = {
  id: string;
  projectId: string;
  parentId: string | null;
  level: number;
  code: string;
  title: string;
  nodeType: string;
  sortOrder: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  workingPapers?: WorkingPaperNameRecord[];
  children?: FlatNode[];
};

type AttachmentNameRecord = {
  fileName: string;
  originalName?: string | null;
  deletedFromWorkingPaperTitle?: string | null;
};

type AttachmentProjectLocationRecord = {
  id: string;
  code: string;
  title: string;
  bucket: WorkingPaperBucket;
  signoffs?: unknown[];
  reviewQuestions?: unknown[];
  workflowNode: WorkflowPathNodeRecord;
};

type WorkflowPathNodeRecord = {
  id: string;
  code: string;
  title: string;
  level: number;
  parent?: WorkflowPathNodeRecord | null;
};

type ProjectAttachmentRecord = AttachmentNameRecord & {
  id: string;
  code?: string | null;
  title?: string | null;
  bucket?: WorkingPaperBucket | null;
  signoffs?: unknown[];
  reviewQuestions?: unknown[];
  workflowNode?: WorkflowPathNodeRecord | null;
  workingPaper?: AttachmentProjectLocationRecord | null;
};

type SmartFormPdfSourceAttachment = {
  id: string;
  projectId?: string | null;
  fileUrl: string | null;
  fileName: string;
  originalName: string | null;
  mimeType?: string | null;
  version: number;
  workingPaperId?: string | null;
};

type SmartFormPdfSnapshot = {
  downloadObject: DownloadObject;
  previewAttachment: SmartFormPdfSourceAttachment & {
    fileUrl: string;
    fileName: string;
    originalName: string;
    mimeType: "application/pdf";
    previewCacheKey: string;
  };
};

type SmartFormPdfInstanceState = {
  status: string | null;
  lastSavedAt?: Date | null;
  updatedAt?: Date | null;
  completedAt?: Date | null;
} | null;

type WorkingPaperNameRecord = {
  id?: string;
  code?: string;
  title: string;
  workflowNodeId?: string | null;
  attachments?: AttachmentNameRecord[];
};

type LockableAttachment = {
  lockedBy: string | null;
  lockedAt?: Date | null;
  lockExpiresAt?: Date | null;
  lockHeartbeatAt?: Date | null;
  lockRevokedAt?: Date | null;
  conflictFrozenAt?: Date | null;
};

type AttachmentRevisionAttachmentSnapshot = {
  id: string;
  version: number;
  headVersionId?: string | null;
};

export type AttachmentConflictResolution =
  | "KEEP_SERVER"
  | "USE_CANDIDATE"
  | "REVERT_TO_BASE";

type AttachmentRevisionInput = {
  attachmentId: string;
  projectId: string;
  version: number;
  parentVersionId?: string | null;
  sourceVersionId?: string | null;
  fileKind: AttachmentFileKind;
  fileName: string;
  originalName?: string | null;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  contentHash?: string | null;
  workDate?: Date | null;
  uploadedBy?: string | null;
  uploadedAt: Date;
  archivedBy: string;
  action: (typeof ATTACHMENT_REVISION_ACTIONS)[keyof typeof ATTACHMENT_REVISION_ACTIONS];
  message?: string | null;
  conflictState?: string;
  conflictBaseVersionId?: string | null;
  conflictServerVersionId?: string | null;
  conflictResolvedBy?: string | null;
  conflictResolvedAt?: Date | null;
  conflictResolution?: string | null;
  createdAt: Date;
};

type AttachmentVersionWriter = {
  attachmentVersion: {
    findFirst: (input: {
      where: { attachmentId: string };
      orderBy: Record<string, "asc" | "desc">[];
      select: { id: true; version?: true };
    }) => Promise<{ id: string; version?: number } | null>;
    updateMany: (input: {
      where: { attachmentId: string; isCurrent: true };
      data: { isCurrent: false };
    }) => Promise<unknown>;
    update: (input: {
      where: { id: string };
      data: { isCurrent: boolean };
    }) => Promise<unknown>;
    create: (input: {
      data: AttachmentRevisionInput & { isCurrent: boolean };
    }) => Promise<{ id: string }>;
  };
};

function buildAttachmentIdentityData(paper: {
  workflowNodeId?: string | null;
  bucket?: WorkingPaperBucket | null;
  code?: string | null;
  title?: string | null;
  preparerId?: string | null;
  reviewerId?: string | null;
  preparedAt?: Date | null;
  reviewedAt?: Date | null;
  returnedAt?: Date | null;
  reviewNote?: string | null;
  templateItemId?: string | null;
}) {
  return {
    workflowNodeId: paper.workflowNodeId ?? undefined,
    bucket: paper.bucket ?? WorkingPaperBucket.CURRENT,
    code: paper.code ? normalizeWorkingPaperCode(paper.code) : undefined,
    title: paper.title
      ? paper.title === paper.code
        ? normalizeReferenceCodeForDisplay(paper.code ?? "")
        : normalizeDisplayTitleFromCode(paper.code, paper.title)
      : undefined,
    preparerId: paper.preparerId ?? null,
    reviewerId: paper.reviewerId ?? null,
    preparedAt: paper.preparedAt ?? null,
    reviewedAt: paper.reviewedAt ?? null,
    returnedAt: paper.returnedAt ?? null,
    reviewNote: paper.reviewNote ?? null,
    templateItemId: paper.templateItemId ?? null,
  };
}

function buildAttachmentRecycleData(
  userId: string,
  deletedAt: Date,
  paper: Pick<
    WorkingPaperNameRecord,
    "id" | "code" | "title" | "workflowNodeId"
  > | null,
  fallbackPaperId?: string | null
) {
  return {
    workingPaperId: null,
    deletedAt,
    deletedBy: userId,
    deletedFromWorkingPaperId: paper?.id ?? fallbackPaperId ?? null,
    deletedFromWorkflowNodeId: paper?.workflowNodeId ?? null,
    deletedFromWorkingPaperCode: paper?.code
      ? normalizeWorkingPaperCode(paper.code)
      : null,
    deletedFromWorkingPaperTitle: paper
      ? paper.title === paper.code
        ? normalizeReferenceCodeForDisplay(paper.code ?? "")
        : normalizeDisplayTitleFromCode(paper.code, paper.title)
      : null,
    restoredAt: null,
    restoredBy: null,
    lockedBy: null,
    lockedAt: null,
    lockExpiresAt: null,
    lockSessionId: null,
    lockHeartbeatAt: null,
    lockStaleAt: null,
    lockRevokedAt: null,
    lockRevokedBy: null,
    lockReleaseReason: null,
  };
}

async function resolveAttachmentHeadVersionId(
  tx: AttachmentVersionWriter,
  attachment: AttachmentRevisionAttachmentSnapshot
) {
  if (attachment.headVersionId) {
    return attachment.headVersionId;
  }
  const latest = await tx.attachmentVersion.findFirst({
    where: { attachmentId: attachment.id },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  return latest?.id ?? null;
}

async function nextAttachmentRevisionNumber(
  tx: AttachmentVersionWriter,
  attachmentId: string,
  currentVersion = 0
) {
  const latest = await tx.attachmentVersion.findFirst({
    where: { attachmentId },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: { id: true, version: true },
  });
  return Math.max(latest?.version ?? 0, currentVersion) + 1;
}

async function createAttachmentRevision(
  tx: AttachmentVersionWriter,
  input: AttachmentRevisionInput,
  options: { isCurrent?: boolean } = {}
) {
  const isCurrent = options.isCurrent ?? true;
  if (isCurrent) {
    await tx.attachmentVersion.updateMany({
      where: { attachmentId: input.attachmentId, isCurrent: true },
      data: { isCurrent: false },
    });
  }

  return tx.attachmentVersion.create({
    data: {
      ...input,
      parentVersionId: input.parentVersionId ?? null,
      sourceVersionId: input.sourceVersionId ?? null,
      message: input.message ?? null,
      isCurrent,
    },
  });
}

export function buildTree(nodes: FlatNode[]) {
  const byId = new Map<string, FlatNode>();
  const roots: FlatNode[] = [];

  for (const node of nodes) {
    byId.set(node.id, { ...node, children: [] });
  }

  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)?.children?.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function canDeleteWorkflowNodeLevel(level: number) {
  return level >= 1;
}

export function getCreatableChildLevel(parentLevel: number | null) {
  if (parentLevel === null) {
    return 1;
  }
  return parentLevel + 1;
}

function getWorkflowNodeType(level: number): WorkflowNodeType {
  if (level === 1) {
    return "PHASE";
  }
  if (level === 2) {
    return "ACCOUNT";
  }
  return "WORKING_PAPER";
}

function getWorkflowNodeLevelLabel(level: number) {
  if (level === 1) {
    return "一级目录";
  }
  if (level === 2) {
    return "组";
  }
  return "底稿";
}

function isSpreadsheetPreviewFileName(fileName: string) {
  const normalized = normalizeUploadedFileName(fileName).toLowerCase();
  return /\.(xlsx|xls|xlsm|xlsb|csv)$/.test(normalized);
}

function storedObjectFromKey(objectKey: string) {
  return { fileName: pathModule.basename(objectKey), fileUrl: objectKey };
}

function normalizeConfirmedObjectKey(objectKey: string) {
  if (
    !objectKey ||
    objectKey.startsWith("/") ||
    objectKey.includes("\\") ||
    pathModule.posix.normalize(objectKey) !== objectKey ||
    objectKey.startsWith("../") ||
    objectKey === ".."
  ) {
    return null;
  }
  return objectKey;
}

function normalizeWorkflowTreeCodes<T extends FlatNode>(
  nodes: T[],
  isRoot = true
): T[] {
  const shouldRestoreSmeRootTitles = isRoot && hasSmeRootFolderSet(nodes);
  const legacyCodes = shouldRestoreSmeRootTitles
    ? nodes
        .filter((node) => !isHierarchicalNumericFolderCode(node.code))
        .map(
          (node) =>
            getSmeRootCode(node.code) ??
            normalizeCodeWithoutDigitFour(node.code)
        )
    : normalizeCodeSequenceWithoutDigitFour(
        nodes
          .filter((node) => !isHierarchicalNumericFolderCode(node.code))
          .map((node) => node.code)
      );
  let legacyCodeIndex = 0;
  const nextCodes = nodes.map((node) => {
    if (isHierarchicalNumericFolderCode(node.code)) {
      return normalizeWorkflowNodeCode(node.code);
    }
    const code =
      legacyCodes[legacyCodeIndex] ?? normalizeCodeWithoutDigitFour(node.code);
    legacyCodeIndex += 1;
    return code;
  });
  nodes.forEach((node, index) => {
    const previousCode = node.code;
    const code = nextCodes[index] ?? normalizeWorkflowNodeCode(node.code);
    syncResponseCodeAndTitle(
      node,
      code,
      shouldRestoreSmeRootTitles ? SME_ROOT_TITLE_BY_CODE[code] : undefined
    );
    rebaseWorkflowTreePrefixes(node.children ?? [], previousCode, code);
    normalizeWorkflowTreeCodes(node.children ?? [], false);
    rebaseWorkingPaperPrefixes(node.workingPapers ?? [], previousCode, code);
    normalizeWorkingPaperCodeSequence(node.workingPapers ?? []);
  });
  return nodes;
}

function normalizeWorkingPaperCodeSequence<T extends WorkingPaperNameRecord>(
  papers: T[]
) {
  const legacyCodes = normalizeCodeSequenceWithoutDigitFour(
    papers
      .filter(
        (paper) => !isHierarchicalNumericWorkingPaperCode(paper.code ?? "")
      )
      .map((paper) => paper.code ?? "")
  );
  let legacyCodeIndex = 0;
  const nextCodes = papers.map((paper) => {
    if (isHierarchicalNumericWorkingPaperCode(paper.code ?? "")) {
      return normalizeWorkingPaperCode(paper.code ?? "");
    }
    const code =
      legacyCodes[legacyCodeIndex] ??
      normalizeCodeWithoutDigitFour(paper.code ?? "");
    legacyCodeIndex += 1;
    return code;
  });
  papers.forEach((paper, index) => {
    if (!paper.code) {
      return;
    }
    const code = nextCodes[index] ?? normalizeWorkingPaperCode(paper.code);
    syncResponseCodeAndTitle(paper, code);
  });
}

function rebaseWorkflowTreePrefixes(
  nodes: FlatNode[],
  previousPrefix: string,
  nextPrefix: string
) {
  for (const node of nodes) {
    syncResponseCodeAndTitle(
      node,
      rebaseCodePrefix(node.code, previousPrefix, nextPrefix)
    );
    rebaseWorkingPaperPrefixes(
      node.workingPapers ?? [],
      previousPrefix,
      nextPrefix
    );
    rebaseWorkflowTreePrefixes(node.children ?? [], previousPrefix, nextPrefix);
  }
}

function rebaseWorkingPaperPrefixes<T extends WorkingPaperNameRecord>(
  papers: T[],
  previousPrefix: string,
  nextPrefix: string
) {
  for (const paper of papers) {
    if (!paper.code) {
      continue;
    }
    syncResponseCodeAndTitle(
      paper,
      rebaseCodePrefix(paper.code, previousPrefix, nextPrefix)
    );
  }
}

function syncResponseCodeAndTitle<
  T extends { code?: string | null; title?: string | null },
>(item: T, code: string, titleFallback?: string) {
  if (
    item.title === item.code ||
    (item.title && isReferenceCodeText(item.title)) ||
    (item.title && isDefaultPhaseTitle(item.title))
  ) {
    item.title = titleFallback ?? code;
  }
  item.code = code;
}

function hasSmeRootFolderSet(nodes: { code: string }[]) {
  const codes = new Set(
    nodes
      .map(
        (node) =>
          getSmeRootCode(node.code) ?? normalizeCodeWithoutDigitFour(node.code)
      )
      .filter(Boolean)
  );
  return SME_ROOT_CODES.every((code) => codes.has(code));
}

function getSmeRootCode(value: string) {
  const code = value.trim();
  return SME_ROOT_TITLE_BY_CODE[code] ? code : SME_ROOT_CODE_BY_TITLE[code];
}

function rebaseCodePrefix(
  code: string,
  previousPrefix: string,
  nextPrefix: string
) {
  if (previousPrefix === nextPrefix) {
    return code;
  }
  if (code === previousPrefix) {
    return nextPrefix;
  }
  if (code.startsWith(`${previousPrefix}-`)) {
    return `${nextPrefix}${code.slice(previousPrefix.length)}`;
  }
  const normalizedPreviousPrefix =
    normalizeCodeWithoutDigitFour(previousPrefix);
  if (normalizedPreviousPrefix === previousPrefix) {
    return code;
  }
  if (code === normalizedPreviousPrefix) {
    return nextPrefix;
  }
  if (code.startsWith(`${normalizedPreviousPrefix}-`)) {
    return `${nextPrefix}${code.slice(normalizedPreviousPrefix.length)}`;
  }
  return code;
}

function normalizeWorkflowNodeResponse<
  T extends {
    code: string;
    title: string;
    workingPapers?: WorkingPaperNameRecord[];
  },
>(node: T): T {
  const code = normalizeWorkflowNodeCode(node.code);
  return {
    ...node,
    code,
    title:
      node.title === node.code
        ? code
        : normalizeDisplayTitleFromCode(code, node.title),
    workingPapers: node.workingPapers?.map(normalizeWorkingPaperResponse),
  };
}

type SignoffHistoryRecord = {
  id: string;
  roundNumber?: number | null;
  type: WorkingPaperSignoffType;
  signedAt: Date;
  isCurrent?: boolean | null;
  revokedAt?: Date | null;
  attachmentVersionId?: string | null;
  attachmentVersion?: number | null;
  contentHash?: string | null;
  revocationReason?: string | null;
  user?: unknown;
  revokedBy?: unknown;
};

type CurrentSignoffRound = {
  roundNumber: number;
  signoffs: SignoffHistoryRecord[];
  latestPreparer: SignoffHistoryRecord | null;
  latestReviewer: SignoffHistoryRecord | null;
  isComplete: boolean;
};

function deriveCurrentSignoffRound(
  signoffs: readonly SignoffHistoryRecord[]
): CurrentSignoffRound | null {
  const active = signoffs.filter(
    (signoff) => signoff.isCurrent !== false && !signoff.revokedAt
  );
  if (active.length === 0) {
    return null;
  }
  const roundNumber = Math.max(
    ...active.map((signoff) => signoff.roundNumber ?? 1)
  );
  const roundSignoffs = active.filter(
    (signoff) => (signoff.roundNumber ?? 1) === roundNumber
  );
  const preparers = roundSignoffs.filter(
    (signoff) => signoff.type === "PREPARER"
  );
  const reviewers = roundSignoffs.filter(
    (signoff) => signoff.type === "REVIEWER"
  );
  const latestPreparer = latestSignoffRecord(preparers);
  const latestReviewer = latestSignoffRecord(reviewers);
  return {
    roundNumber,
    signoffs: roundSignoffs,
    latestPreparer,
    latestReviewer,
    isComplete: Boolean(
      latestPreparer &&
      latestReviewer &&
      latestReviewer.signedAt.getTime() > latestPreparer.signedAt.getTime()
    ),
  };
}

function latestSignoffRecord(
  signoffs: readonly SignoffHistoryRecord[]
): SignoffHistoryRecord | null {
  return (
    [...signoffs].sort(
      (left, right) => right.signedAt.getTime() - left.signedAt.getTime()
    )[0] ?? null
  );
}

function getSignoffRoundStatus(round: CurrentSignoffRound) {
  return round.isComplete ? "COMPLETED" : "PENDING_REVIEW";
}

function groupSignoffsByRound(
  signoffs: readonly SignoffHistoryRecord[],
  currentRoundNumber: number | null
) {
  const grouped = new Map<number, SignoffHistoryRecord[]>();
  for (const signoff of signoffs) {
    const roundNumber = signoff.roundNumber ?? 1;
    const current = grouped.get(roundNumber) ?? [];
    current.push(signoff);
    grouped.set(roundNumber, current);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => right - left)
    .map(([roundNumber, entries]) => {
      const active = entries.filter((entry) => !entry.revokedAt);
      const round = deriveCurrentSignoffRound(
        active.map((entry) => ({ ...entry, isCurrent: true }))
      );
      return {
        roundNumber,
        status:
          currentRoundNumber === roundNumber
            ? getSignoffRoundStatus(assertPresentValue(round))
            : active.length > 0
              ? "SUPERSEDED"
              : "REVOKED",
        signoffs: entries,
      };
    });
}

async function refreshCurrentSignoffRound(
  tx: Prisma.TransactionClient,
  attachmentId: string
) {
  const allSignoffs = await tx.workingPaperSignoff.findMany({
    where: { attachmentId },
    orderBy: [{ roundNumber: "desc" }, { signedAt: "asc" }],
  });
  const active = allSignoffs.filter(
    (signoff: SignoffHistoryRecord) => !signoff.revokedAt
  );
  const candidateRoundNumbers: number[] = [
    ...new Set<number>(
      active.map((signoff: SignoffHistoryRecord) => signoff.roundNumber ?? 1)
    ),
  ].sort((left, right) => right - left);
  const currentRoundNumber = candidateRoundNumbers.find((roundNumber) =>
    active.some(
      (signoff: SignoffHistoryRecord) =>
        (signoff.roundNumber ?? 1) === roundNumber &&
        signoff.type === "PREPARER"
    )
  );

  await tx.workingPaperSignoff.updateMany({
    where: { attachmentId },
    data: { isCurrent: false },
  });
  if (currentRoundNumber !== undefined) {
    await tx.workingPaperSignoff.updateMany({
      where: { attachmentId, roundNumber: currentRoundNumber, revokedAt: null },
      data: { isCurrent: true },
    });
  }
}

function normalizeWorkingPaperResponse<T extends WorkingPaperNameRecord>(
  paper: T
): T {
  const code = paper.code ? normalizeWorkingPaperCode(paper.code) : paper.code;
  return {
    ...paper,
    ...(code ? { code } : {}),
    title:
      paper.code && paper.title === paper.code
        ? assertPresentValue(code)
        : normalizeDisplayTitleFromCode(code ?? paper.code, paper.title),
    attachments: paper.attachments?.map(normalizeAttachmentResponse),
  };
}

function normalizeAttachmentResponse<T extends AttachmentNameRecord>(
  attachment: T
): T {
  const normalized = {
    ...attachment,
    fileName: normalizeUploadedFileName(attachment.fileName),
    originalName:
      attachment.originalName === undefined || attachment.originalName === null
        ? attachment.originalName
        : normalizeUploadedFileName(attachment.originalName),
  };
  if (attachment.deletedFromWorkingPaperTitle !== undefined) {
    normalized.deletedFromWorkingPaperTitle =
      attachment.deletedFromWorkingPaperTitle === null
        ? attachment.deletedFromWorkingPaperTitle
        : normalizeUploadedFileName(attachment.deletedFromWorkingPaperTitle);
  }
  return normalized;
}

function normalizeAttachmentVersionResponse<T extends AttachmentNameRecord>(
  version: T
): T {
  return normalizeAttachmentResponse(version);
}

function normalizeProjectAttachmentResponse<T extends ProjectAttachmentRecord>(
  attachment: T
) {
  const normalized = normalizeAttachmentResponse(attachment);
  const paper = attachment.workingPaper;
  const workflowNode = attachment.workflowNode ?? paper?.workflowNode;
  if (!workflowNode) {
    return { ...normalized, workingPaper: null };
  }
  const location = {
    id: paper?.id ?? attachment.id,
    code: attachment.code ?? paper?.code ?? "",
    title:
      attachment.title ??
      paper?.title ??
      attachment.originalName ??
      attachment.fileName,
    bucket: attachment.bucket ?? paper?.bucket ?? WorkingPaperBucket.CURRENT,
    signoffs: attachment.signoffs ?? paper?.signoffs ?? [],
    reviewQuestions: attachment.reviewQuestions ?? paper?.reviewQuestions ?? [],
    workflowNode,
  };
  const path = buildWorkflowPath(workflowNode);
  const locationCode =
    attachment.code ?? normalizeWorkingPaperCode(paper?.code ?? "");
  const workflowNodeCode = normalizeWorkflowNodeCode(
    location.workflowNode.code
  );
  return {
    ...normalized,
    workingPaper: {
      id: location.id,
      attachmentId: attachment.id,
      code: locationCode,
      title:
        location.title === location.code
          ? locationCode
          : normalizeDisplayTitleFromCode(locationCode, location.title),
      bucket: location.bucket,
      signoffs: location.signoffs,
      reviewQuestions: location.reviewQuestions,
      workflowNodeId: location.workflowNode.id,
      workflowNodeCode,
      workflowNodeTitle:
        location.workflowNode.title === location.workflowNode.code
          ? workflowNodeCode
          : normalizeDisplayTitleFromCode(
              workflowNodeCode,
              location.workflowNode.title
            ),
      path,
    },
  };
}

function buildWorkflowPath(node: WorkflowPathNodeRecord) {
  const path: {
    id: string;
    code: string;
    title: string;
    level: number;
  }[] = [];
  let current: WorkflowPathNodeRecord | null | undefined = node;
  while (current) {
    const code = normalizeWorkflowNodeCode(current.code);
    path.unshift({
      id: current.id,
      code,
      title:
        current.title === current.code
          ? code
          : normalizeDisplayTitleFromCode(code, current.title),
      level: current.level,
    });
    current = current.parent;
  }
  return path;
}

function normalizeAttachmentRefCodeInput(code: string) {
  return code.trim().replaceAll(/\s*-\s*/g, "-");
}

function buildAttachmentPlaceholderName(
  inputName: string,
  placeholderType: AttachmentPlaceholderType
) {
  const { extension } = ATTACHMENT_PLACEHOLDER_TYPES[placeholderType];
  const normalized = normalizeUploadedFileName(inputName.trim());
  const withoutExtension = normalized.replace(/\.[^.]+$/, "").trim();
  return `${withoutExtension || "Placeholder"}${extension}`;
}

function requireMatchingPlaceholderFile(
  placeholderType: AttachmentPlaceholderType | null | undefined,
  file: { fileName: string; mimeType?: string | null }
) {
  if (!placeholderType) {
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      "This attachment is not an unfilled placeholder"
    );
  }
  if (placeholderType === ("GENERIC" as PrismaAttachmentPlaceholderType)) {
    return;
  }
  const actualType = getAttachmentPlaceholderTypeForFile(
    file.fileName,
    file.mimeType
  );
  if (actualType !== placeholderType) {
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      `Select a ${placeholderType.toLowerCase()} file for this placeholder`
    );
  }
}

function requireAttachmentFile(attachment: {
  placeholderType?: AttachmentPlaceholderType | null;
  headVersionId?: string | null;
  fileUrl?: string | null;
}) {
  if (attachment.placeholderType) {
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      "Replace this placeholder with a matching file before opening it"
    );
  }
}

function assertAttachmentRefCodeMatchesNode(code: string, nodeCode: string) {
  const normalizedCode = normalizeWorkingPaperCode(code);
  const normalizedNodeCode = normalizeWorkflowNodeCode(nodeCode);
  if (isHierarchicalNumericFolderCode(normalizedNodeCode)) {
    const prefix = `${normalizedNodeCode}.`;
    const suffix = normalizedCode.slice(prefix.length);
    if (normalizedCode.startsWith(prefix) && /^[1-9]\d*$/.test(suffix)) {
      return;
    }
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      `File code must use ${prefix}1 format`
    );
  }
  const prefix = `${normalizeAttachmentRefCodeInput(nodeCode)}-F`;
  const suffix = normalizedCode.slice(prefix.length);
  if (normalizedCode.startsWith(prefix) && /^\d{3}$/.test(suffix)) {
    return;
  }
  throw new ApiBadRequestException(
    "VALIDATION_FAILED",
    `File code must use ${prefix}001 format`
  );
}

function normalizeDisplayTitleFromCode(
  code: string | null | undefined,
  title: string
) {
  const normalizedTitle = normalizeUploadedFileName(title).trim();
  const codeValue = code?.trim() ?? "";
  const normalizedCode = normalizeReferenceCodeForDisplay(codeValue);
  if (!normalizedTitle || !normalizedCode) {
    return normalizedTitle || normalizedCode;
  }
  if (normalizedTitle === codeValue || normalizedTitle === normalizedCode) {
    return normalizedCode;
  }
  if (isReferenceCodeText(normalizedTitle)) {
    return normalizedCode;
  }
  const titleWithoutCode = stripReferenceCodePrefix(
    normalizedTitle,
    normalizedCode
  );
  const cleanedTitle =
    stripLegacyReferenceCodePrefix(titleWithoutCode) ?? titleWithoutCode;
  return cleanedTitle || normalizedCode;
}

function normalizeReferenceCodeForDisplay(code: string) {
  if (isHierarchicalNumericWorkingPaperCode(code)) {
    return normalizeWorkingPaperCode(code);
  }
  if (isHierarchicalNumericFolderCode(code)) {
    return normalizeWorkflowNodeCode(code);
  }
  return isReferenceCodeText(code) ? normalizeCodeWithoutDigitFour(code) : code;
}

function stripReferenceCodePrefix(title: string, code: string) {
  const titleValue = title.trim();
  const codePattern = code
    .trim()
    .split(/\s*-\s*/g)
    .filter(Boolean)
    .map(escapeRegExp)
    .join(String.raw`\s*-\s*`);
  if (codePattern) {
    if (new RegExp(`^${codePattern}$`, "i").test(titleValue)) {
      return "";
    }
    const prefixMatch = titleValue.match(
      new RegExp(
        `^${codePattern}\\s*(?:-|\\u2013|\\u2014|:|\\uFF1A)\\s*(.+)$`,
        "i"
      )
    );
    if (prefixMatch) {
      return prefixMatch[1].trim();
    }
  }
  return stripLegacyReferenceCodePrefix(titleValue) ?? titleValue;
}

function stripLegacyReferenceCodePrefix(title: string) {
  const parts = title
    .split(LEGACY_REFERENCE_TITLE_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0 || !isReferenceCodeStart(parts[0])) {
    return null;
  }
  if (parts.every(isReferenceCodePart)) {
    return "";
  }
  let prefixCount = 0;
  while (
    prefixCount < parts.length - 1 &&
    isReferenceCodePart(parts[prefixCount])
  ) {
    prefixCount += 1;
  }
  return prefixCount > 0 ? parts.slice(prefixCount).join(" - ").trim() : null;
}

function isReferenceCodeStart(value: string) {
  return (
    /^[A-Za-z]$/i.test(value) ||
    /^[A-Za-z]{1,3}\d+[A-Za-z]?$/i.test(value) ||
    /^F\d{1,5}$/i.test(value)
  );
}

function isReferenceCodePart(value: string) {
  return isReferenceCodeStart(value) || /^\d{1,6}$/.test(value);
}

function isReferenceCodeText(value: string) {
  const parts = value
    .trim()
    .split(/\s*-\s*/g)
    .filter(Boolean);
  return (
    parts.length > 0 &&
    isReferenceCodeStart(parts[0]) &&
    parts.every(isReferenceCodePart)
  );
}

const LEGACY_REFERENCE_TITLE_SEPARATOR =
  /\s*(?:[:\uFF1A]|[\u2013\u2014]+|-)\s*/g;
const SME_ROOT_CODES = ["A", "B", "C", "D", "E", "F", "G"];
const SME_ROOT_TITLE_BY_CODE: Record<string, string> = {
  A: "Planning",
  B: "General Procedures",
  C: "Execution",
  D: "Reporting",
  E: "Completion",
  F: "Continued Connected Transactions (CCT)",
  G: "Other Audit Programmes",
};
const SME_ROOT_CODE_BY_TITLE = Object.fromEntries(
  Object.entries(SME_ROOT_TITLE_BY_CODE).map(([code, title]) => [title, code])
) as Record<string, string>;

function isDefaultPhaseTitle(title: string) {
  return title === "\u65B0\u9636\u6BB5" || title === "New phase";
}

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function buildAttachmentPreviewETag(
  attachment: {
    id: string;
    version: number;
    contentHash?: string | null;
  },
  variant = "source"
) {
  const identity = [
    attachment.id,
    String(attachment.version),
    attachment.contentHash?.trim().toLowerCase() ?? "",
    variant,
  ].join(":");
  const digest = createHash("sha256").update(identity).digest("base64url");
  return `"${digest}"`;
}

function attachmentPreviewCacheControl(
  currentVersion: number,
  requestedVersion?: number
) {
  return requestedVersion === currentVersion
    ? VERSIONED_ATTACHMENT_PREVIEW_CACHE_CONTROL
    : UNVERSIONED_ATTACHMENT_PREVIEW_CACHE_CONTROL;
}

function matchesETag(ifNoneMatch: string | undefined, eTag: string) {
  if (!ifNoneMatch) {
    return false;
  }
  return ifNoneMatch.split(",").some((candidate) => {
    const normalized = candidate.trim();
    return (
      normalized === "*" || normalized === eTag || normalized === `W/${eTag}`
    );
  });
}

function normalizeUploadedFileName(fileName: string) {
  const decoded = Buffer.from(fileName, "latin1").toString("utf-8");
  if (
    decoded &&
    !decoded.includes("\uFFFD") &&
    mojibakeScore(decoded) < mojibakeScore(fileName)
  ) {
    return decoded;
  }
  return fileName;
}

function isSmartFormAttachment(attachment: { fileKind?: string | null }) {
  return attachment.fileKind === "SMART_FORM";
}

function getPreviewDisplayName(attachment: {
  fileName: string;
  originalName?: string | null;
}) {
  const fileName = attachment.originalName ?? attachment.fileName;
  const extension = pathModule.extname(fileName);
  return extension ? fileName.slice(0, -extension.length) : fileName;
}

function isOfficePdfExportAttachment(attachment: {
  fileName: string;
  originalName?: string | null;
  mimeType: string;
}) {
  const mimeType = attachment.mimeType.toLowerCase();
  const fileName = normalizeUploadedFileName(
    attachment.originalName ?? attachment.fileName
  ).toLowerCase();
  return (
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/vnd.ms-excel.sheet.macroenabled.12",
      "application/vnd.ms-excel.sheet.binary.macroenabled.12",
    ].includes(mimeType) ||
    /\.(doc|docx|ppt|pptx|xls|xlsx|xlsm|xlsb)$/.test(fileName)
  );
}

function getAttachmentExportFileName(attachment: AttachmentExportSource) {
  const displayName = normalizeUploadedFileName(
    attachment.originalName ?? attachment.fileName
  );
  const refCode = attachment.code ?? attachment.workingPaper?.code ?? "";
  if (!refCode) {
    return displayName;
  }
  const baseName = displayName.replace(
    /^[A-Za-z0-9][A-Za-z0-9-]*-F\d+\s+/i,
    ""
  );
  return `${refCode} ${baseName}`;
}

export function buildAttachmentZipEntryPath(input: {
  attachment: Pick<AttachmentExportSource, "workflowNodeId" | "workingPaper">;
  project: AttachmentExportProject;
  workflowNodes: AttachmentExportWorkflowNode[];
  fileName: string;
}) {
  const root = sanitizeExportPathSegment(
    `${input.project.projectCode} - ${input.project.name}`
  );
  const nodeById = new Map(input.workflowNodes.map((node) => [node.id, node]));
  const workflowNodeId =
    input.attachment.workflowNodeId ??
    input.attachment.workingPaper?.workflowNodeId ??
    null;
  const directorySegments: string[] = [];
  const visited = new Set<string>();
  let current = workflowNodeId ? nodeById.get(workflowNodeId) : undefined;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    directorySegments.unshift(
      sanitizeExportPathSegment(current.code || current.title)
    );
    current = current.parentId ? nodeById.get(current.parentId) : undefined;
  }
  if (directorySegments.length === 0) {
    directorySegments.push("Unassigned");
  }
  return pathModule.posix.join(
    root,
    ...directorySegments,
    sanitizeExportFileName(input.fileName)
  );
}

function sanitizeExportPathSegment(value: string) {
  const sanitized = value
    .replaceAll(/[\p{Cc}\\/:*?"<>|]/gu, "_")
    .trim()
    .replace(/^\.+$/, "_");
  return sanitized && sanitized !== "." && sanitized !== ".."
    ? sanitized
    : "Untitled";
}

function sanitizeExportFileName(value: string) {
  const sanitized = sanitizeExportPathSegment(value);
  return sanitized.startsWith(".") || sanitized.includes("..")
    ? "file"
    : sanitized;
}

function replaceFileExtension(fileName: string, extension: string) {
  const currentExtension = pathModule.extname(fileName);
  const baseName = currentExtension
    ? fileName.slice(0, -currentExtension.length)
    : fileName;
  return `${baseName || "file"}${extension}`;
}

function stripFileExtension(fileName: string) {
  const extension = pathModule.extname(fileName);
  return extension ? fileName.slice(0, -extension.length) : fileName;
}

function toPdfFileName(fileName: string) {
  const normalized = normalizeUploadedFileName(fileName).trim() || "smart-form";
  const lastDot = normalized.lastIndexOf(".");
  const baseName = lastDot > 0 ? normalized.slice(0, lastDot) : normalized;
  return `${baseName || "smart-form"}.pdf`;
}

export function buildSmartFormPdfPreviewCacheKey(
  attachment: { version: number },
  instance: SmartFormPdfInstanceState,
  reviewQuestions: SmartFormV2PdfReviewQuestion[] = [],
  signoffs: SmartFormV2PdfSignoff[] = []
) {
  const signature = JSON.stringify({
    rendererVersion: 7,
    version: attachment.version,
    status: instance?.status ?? null,
    lastSavedAt: instance?.lastSavedAt?.getTime() ?? null,
    updatedAt: instance?.updatedAt?.getTime() ?? null,
    completedAt: instance?.completedAt?.getTime() ?? null,
    signoffs: signoffs.map((signoff) => ({
      type: signoff.type,
      userName: signoff.userName,
      signedAt: toCacheTimestamp(signoff.signedAt),
    })),
    reviewQuestions: reviewQuestions.map((question) => ({
      id: question.id,
      status: question.status,
      updatedAt: toCacheTimestamp(question.updatedAt),
      messages: question.messages?.map((message) => ({
        id: message.id,
        createdAt: toCacheTimestamp(message.createdAt),
        images: message.images?.map((image) => [
          image.originalName ?? null,
          image.fileName,
        ]),
        references: message.references?.map((reference) => [
          reference.workingPaper?.code ?? null,
          reference.workingPaper?.title ?? null,
        ]),
      })),
    })),
  });
  const hash = createHash("sha1").update(signature).digest("hex").slice(0, 12);
  return sanitizeCachePathSegment(`v${attachment.version}-${hash}`);
}

function toCacheTimestamp(value: Date | string | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.getTime();
}

function sanitizeCachePathSegment(value: string) {
  const sanitized = value.replaceAll(/[\\/:*?"<>|]/g, "_").trim();
  if (!sanitized || sanitized.startsWith(".") || sanitized.includes("..")) {
    return "smart-form.pdf";
  }
  return sanitized;
}

function readSheetRows(
  sheet: XLSX.WorkSheet,
  range: XLSX.Range,
  offset: number,
  limit: number,
  columnOffset = 0,
  columnLimit = 30
) {
  const startRow = range.s.r + offset;
  const endRow = Math.min(range.e.r, startRow + limit - 1);
  if (startRow > range.e.r) {
    return [];
  }
  const rows: { rowNumber: number; cells: string[] }[] = [];
  for (let row = startRow; row <= endRow; row += 1) {
    const cells: string[] = [];
    const startColumn = Math.min(range.e.c, range.s.c + columnOffset);
    const endColumn = Math.min(
      range.e.c,
      startColumn + Math.max(1, columnLimit) - 1
    );
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      cells.push(formatSheetCell(cell));
    }
    rows.push({ rowNumber: row + 1, cells });
  }
  return rows;
}

function getSpreadsheetPreviewOffset(
  input: SpreadsheetPreviewInput,
  range: XLSX.Range,
  limit: number
) {
  if (input.targetRow !== undefined) {
    const targetRowIndex = Math.max(0, Math.trunc(input.targetRow) - 1);
    const relativeRow = targetRowIndex - range.s.r;
    return Math.max(0, relativeRow - Math.floor(limit / 2));
  }
  return Math.max(0, Math.trunc(input.offset ?? 0));
}

type PreviewWorkbookCacheEntry = {
  workbook: XLSX.WorkBook;
  mtimeMs: number;
  size: number;
};

const previewWorkbookCache = new Map<string, PreviewWorkbookCacheEntry>();

function readWorkbookForPreview(absolutePath: string) {
  try {
    const fileStat = statSync(absolutePath);
    const cached = previewWorkbookCache.get(absolutePath);
    if (
      cached &&
      cached.mtimeMs === fileStat.mtimeMs &&
      cached.size === fileStat.size
    ) {
      previewWorkbookCache.delete(absolutePath);
      previewWorkbookCache.set(absolutePath, cached);
      return cached.workbook;
    }

    const workbook = spreadsheetWorkbookReader.readFile(absolutePath);
    previewWorkbookCache.set(absolutePath, {
      workbook,
      mtimeMs: fileStat.mtimeMs,
      size: fileStat.size,
    });
    trimPreviewWorkbookCache();
    return workbook;
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new ApiBadRequestException(
        "NOT_FOUND",
        "原始文件不存在，请重新上传"
      );
    }
    throw error;
  }
}

async function readStoredWorkbookForPreview(
  cacheKey: string,
  loadBuffer: () => Promise<Buffer>
) {
  const cached = previewWorkbookCache.get(cacheKey);
  if (cached) {
    previewWorkbookCache.delete(cacheKey);
    previewWorkbookCache.set(cacheKey, cached);
    return cached.workbook;
  }

  const buffer = await loadBuffer();
  const workbook = readWorkbookForPreviewBuffer(buffer);
  previewWorkbookCache.set(cacheKey, {
    workbook,
    mtimeMs: 0,
    size: buffer.byteLength,
  });
  trimPreviewWorkbookCache();
  return workbook;
}

function readWorkbookForPreviewBuffer(buffer: Buffer) {
  try {
    return XLSX.read(buffer, { cellDates: true, type: "buffer" });
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new ApiBadRequestException(
        "NOT_FOUND",
        "原始文件不存在，请重新上传"
      );
    }
    throw error;
  }
}

function getStoredWorkbookPreviewCacheKey(attachment: {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  version: number;
  updatedAt: Date;
  lastModifiedAt: Date | null;
}) {
  const modifiedAt = attachment.lastModifiedAt ?? attachment.updatedAt;
  return [
    "stored",
    attachment.id,
    attachment.version,
    attachment.fileSize,
    modifiedAt.getTime(),
    attachment.fileUrl,
    attachment.fileName,
  ].join(":");
}

function trimPreviewWorkbookCache() {
  while (previewWorkbookCache.size > MAX_PREVIEW_WORKBOOK_CACHE_SIZE) {
    const oldestKey = previewWorkbookCache.keys().next().value;
    if (!oldestKey) {
      return;
    }
    previewWorkbookCache.delete(oldestKey);
  }
}

function isMissingFileError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function formatSheetCell(cell: XLSX.CellObject | undefined) {
  if (!cell) {
    return "";
  }
  if (typeof cell.w === "string") {
    return cell.w;
  }
  if (cell.v instanceof Date) {
    return cell.v.toISOString().slice(0, 10);
  }
  return cell.v === undefined || cell.v === null ? "" : String(cell.v);
}

function clampInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback = min
) {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function mojibakeScore(value: string) {
  let score = 0;
  if (/[\u0080-\u009F]/.test(value)) {
    score += 4;
  }
  if (
    /[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(value)
  ) {
    score += 2;
  }
  if (value.includes("\uFFFD")) {
    score += 8;
  }
  return score;
}

function hasActiveLock(attachment: LockableAttachment) {
  return Boolean(attachment.lockedBy && !attachment.lockRevokedAt);
}

function isDesktopMasterLeaseReclaimable(
  attachment: LockableAttachment & {
    lockSessionId?: string | null;
  },
  now: Date
) {
  const leaseDeadline = desktopMasterAttachmentLeaseDeadline(attachment);
  return Boolean(
    hasActiveLock(attachment) &&
    attachment.lockSessionId &&
    leaseDeadline &&
    leaseDeadline.getTime() + DESKTOP_MASTER_RECLAIM_GRACE_MS < now.getTime()
  );
}

function isDesktopMasterLeaseAlive(
  attachment: {
    lockExpiresAt?: Date | null;
    lockHeartbeatAt?: Date | null;
    lockedAt?: Date | null;
  },
  now: Date
) {
  if (attachment.lockExpiresAt) {
    return (
      attachment.lockExpiresAt.getTime() + DESKTOP_MASTER_RECLAIM_GRACE_MS >=
      now.getTime()
    );
  }
  const lastActiveAt = attachment.lockHeartbeatAt ?? attachment.lockedAt;
  if (!lastActiveAt) {
    return false;
  }
  return Boolean(
    lastActiveAt.getTime() +
      LOCK_DURATION_MS +
      DESKTOP_MASTER_RECLAIM_GRACE_MS >=
    now.getTime()
  );
}

function isDesktopMasterGrantLeaseAlive(
  grant: {
    issuedAt?: Date | null;
    expiresAt?: Date | null;
    lastUsedAt?: Date | null;
  },
  now: Date
) {
  if (grant.expiresAt) {
    return (
      grant.expiresAt.getTime() + DESKTOP_MASTER_RECLAIM_GRACE_MS >=
      now.getTime()
    );
  }
  const lastActiveAt = grant.lastUsedAt ?? grant.issuedAt;
  if (!lastActiveAt) {
    return false;
  }
  return Boolean(
    lastActiveAt.getTime() +
      LOCK_DURATION_MS +
      DESKTOP_MASTER_RECLAIM_GRACE_MS >=
    now.getTime()
  );
}

function desktopMasterAttachmentLeaseWhere(now: Date) {
  const graceCutoff = new Date(now.getTime() - DESKTOP_MASTER_RECLAIM_GRACE_MS);
  const legacyActivityCutoff = new Date(
    now.getTime() - LOCK_DURATION_MS - DESKTOP_MASTER_RECLAIM_GRACE_MS
  );
  return {
    OR: [
      { lockExpiresAt: { gte: graceCutoff } },
      {
        lockExpiresAt: null,
        lockHeartbeatAt: { gte: legacyActivityCutoff },
      },
      {
        lockExpiresAt: null,
        lockHeartbeatAt: null,
        lockedAt: { gte: legacyActivityCutoff },
      },
    ],
  };
}

function desktopMasterAttachmentExpiredWhere(now: Date) {
  const graceCutoff = new Date(now.getTime() - DESKTOP_MASTER_RECLAIM_GRACE_MS);
  const legacyActivityCutoff = new Date(
    now.getTime() - LOCK_DURATION_MS - DESKTOP_MASTER_RECLAIM_GRACE_MS
  );
  return {
    OR: [
      { lockExpiresAt: { lt: graceCutoff } },
      {
        lockExpiresAt: null,
        lockHeartbeatAt: { lt: legacyActivityCutoff },
      },
      {
        lockExpiresAt: null,
        lockHeartbeatAt: null,
        lockedAt: { lt: legacyActivityCutoff },
      },
    ],
  };
}

function desktopMasterAttachmentLeaseDeadline(attachment: {
  lockExpiresAt?: Date | null;
  lockHeartbeatAt?: Date | null;
  lockedAt?: Date | null;
}) {
  if (attachment.lockExpiresAt) {
    return attachment.lockExpiresAt;
  }
  const lastActiveAt = attachment.lockHeartbeatAt ?? attachment.lockedAt;
  return lastActiveAt
    ? new Date(lastActiveAt.getTime() + LOCK_DURATION_MS)
    : null;
}

function desktopMasterGrantLeaseWhere(now: Date) {
  const graceCutoff = new Date(now.getTime() - DESKTOP_MASTER_RECLAIM_GRACE_MS);
  const legacyActivityCutoff = new Date(
    now.getTime() - LOCK_DURATION_MS - DESKTOP_MASTER_RECLAIM_GRACE_MS
  );
  return {
    OR: [
      { expiresAt: { gte: graceCutoff } },
      {
        expiresAt: null,
        lastUsedAt: { gte: legacyActivityCutoff },
      },
      {
        expiresAt: null,
        lastUsedAt: null,
        issuedAt: { gte: legacyActivityCutoff },
      },
    ],
  };
}

function desktopCheckInAlreadyInProgress() {
  return new ApiBadRequestException(
    "CHECK_IN_IN_PROGRESS",
    "Desktop check-in is already in progress."
  );
}

function desktopCheckInAttemptLost() {
  return new ApiBadRequestException(
    "CHECK_IN_IN_PROGRESS",
    "Desktop check-in attempt lease was taken over by a newer request."
  );
}

function isPrismaUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  );
}

function createDesktopGrantSecret() {
  return randomBytes(32).toString("base64url");
}

function hashDesktopGrantSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

function buildAttachmentContentToken(attachment: {
  id: string;
  version: number;
  fileUrl?: string | null;
  fileSize?: number | null;
  contentHash?: string | null;
}) {
  if (attachment.contentHash) {
    return attachment.contentHash;
  }
  return createHash("sha256")
    .update(
      [
        attachment.id,
        String(attachment.version),
        attachment.fileUrl ?? "",
        String(attachment.fileSize ?? ""),
      ].join("\u0000")
    )
    .digest("hex");
}

function buildAttachmentDownloadUrl(
  context: DesktopMasterOpenRequestContext,
  projectId: string,
  attachmentId: string
) {
  const protocol = context.protocol || "http";
  const host = context.host || "localhost:3000";
  const prefix = normalizeExternalPathPrefix(context.pathPrefix);
  return `${protocol}://${host}${prefix}/engagement/${projectId}/workflow/attachments/${attachmentId}/master/download`;
}

function buildAttachmentCacheVersionId(attachment: {
  id: string;
  version: number;
  headVersionId?: string | null;
}) {
  return attachment.headVersionId ?? `${attachment.id}:v${attachment.version}`;
}

function buildDesktopCheckInObjectKey(
  input: Pick<
    DesktopMasterUploadPrepareInput,
    | "projectId"
    | "attachmentId"
    | "lockSessionId"
    | "localContentHash"
    | "fileName"
    | "uploadAttemptId"
  >
) {
  if (!/^[a-f0-9]{64}$/i.test(input.localContentHash)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Desktop content hash is invalid."
    );
  }
  const extension = pathModule.extname(
    normalizeUploadedFileName(input.fileName)
  );
  return pathModule.posix.join(
    "desktop-master-check-ins",
    safeDesktopObjectSegment(input.projectId),
    safeDesktopObjectSegment(input.attachmentId),
    safeDesktopObjectSegment(input.lockSessionId),
    ...(input.uploadAttemptId
      ? [safeDesktopObjectSegment(input.uploadAttemptId)]
      : []),
    `${input.localContentHash.toLowerCase()}${extension}`
  );
}

function assertDesktopCheckInObjectKey(
  input: Pick<
    DesktopMasterCheckInInput,
    "projectId" | "attachmentId" | "lockSessionId" | "localContentHash"
  > & { fileName?: string; uploadAttemptId?: string },
  objectKey: string
) {
  if (!input.fileName) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Desktop upload object key is invalid."
    );
  }
  if (
    buildDesktopCheckInObjectKey({
      ...input,
      fileName: input.fileName,
      uploadAttemptId: input.uploadAttemptId,
    }) !== objectKey
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Desktop upload object key is invalid."
    );
  }
}

function safeDesktopObjectSegment(value: string) {
  const normalized = value.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
  if (!normalized) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Desktop upload identity is invalid."
    );
  }
  return normalized;
}

function supportsDesktopDirectTransfer(storage: StorageService) {
  return storage.supportsDirectTransfer?.() ?? false;
}

function normalizeExternalPathPrefix(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }
  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return prefixed.replace(/\/+$/, "");
}

function parseAttachmentWorkDate(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Work date must use YYYY-MM-DD"
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Work date is invalid"
    );
  }
  return parsed;
}

function startOfUtcDate(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
}

function normalizeOptionalId(value?: string) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function findSmartFormV2Node(
  nodes: readonly SmartFormV2Node[],
  nodeId: string
): SmartFormV2Node | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }
    const nested =
      node.kind === "section" || node.kind === "group"
        ? findSmartFormV2Node(node.children, nodeId)
        : node.kind === "component"
          ? findSmartFormV2Node(Object.values(node.slots ?? {}).flat(), nodeId)
          : null;
    if (nested) {
      return nested;
    }
  }
  return null;
}

function smartFormSheetHasRow(
  sheet: Extract<SmartFormV2Node, { kind: "sheet" }>,
  rowId: string
) {
  return (
    sheet.rows.mode === "fixed" &&
    smartFormFixedRowsContain(sheet.rows.items, rowId)
  );
}

function smartFormFixedRowsContain(
  rows: readonly SmartFormV2FixedSheetRow[],
  rowId: string
): boolean {
  return rows.some(
    (row) =>
      row.id === rowId || smartFormFixedRowsContain(row.children ?? [], rowId)
  );
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
