import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";
import { promisify } from "node:util";

import { path7za } from "7zip-bin";
import { Injectable, Optional } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { SmartFormPackageSchema } from "@project-wing/shared";
import JSZip from "jszip";

import type { RequestUser } from "../auth/request-user";
import { ApiNotFoundException } from "../common/api-error";
import { ensureExecutableFile } from "../common/executable-file";
import { InboxService } from "../inbox/inbox.service";
import { PrismaService } from "../prisma/prisma.service";
import { SmartFormV2PdfService } from "../smart-forms/smart-form-v2-pdf.service";
import type {
  SmartFormV2PdfReviewQuestion,
  SmartFormV2PdfSignoff,
} from "../smart-forms/smart-form-v2-pdf.service";
import { resolveSmartFormV2PdfEngagementDetails } from "../smart-forms/smart-form-v2-project-context";
import { StorageService } from "../storage/storage.service";
import type { DownloadObject } from "../storage/storage.service";
import { ArchiveCheckService } from "./archive-check.service";
import type { ArchiveCheckReport } from "./archive-check.service";
import { buildArchiveFileIndexPdf } from "./archive-file-index-pdf";
import type { ArchiveFileIndexFile } from "./archive-file-index-pdf";
import { ArchiveNotificationService } from "./archive-notification.service";
import { ProjectAccessService } from "./project-access.service";

const execFileAsync = promisify(execFile);
const ARCHIVE_PASSWORD_FALLBACK = "ProjectWing@2026";
const SEVEN_ZIP_TIMEOUT_MS = 600_000;

type ArchiveJobStatus = "queued" | "running" | "completed" | "failed";
type ArchiveJobPhase = "fileCheck" | "packaging" | "uploading" | "finalizing";

export type ProjectArchiveArtifactSnapshot = {
  id: string;
  projectId: string;
  fileName: string;
  objectKey: string;
  fileSize: number;
  mimeType: string;
  createdBy: string;
  createdAt: Date;
};

export type ArchiveJobProgressSnapshot = {
  completedUnits: number;
  totalUnits: number;
};

export type ArchiveJobSnapshot = {
  jobId: string;
  projectId: string;
  status: ArchiveJobStatus;
  currentPhase: ArchiveJobPhase;
  currentLabel?: string;
  progress: ArchiveJobProgressSnapshot;
  artifact?: ProjectArchiveArtifactSnapshot;
  error?: { message: string };
  createdAt: Date;
  updatedAt: Date;
};

type ArchivePaper = {
  id: string;
  workflowNodeId: string;
  code: string;
  title: string;
  signoffs: {
    attachmentId: string | null;
    signedAt: Date;
    type: string;
    user: { email: string; name: string };
  }[];
  attachments: {
    id: string;
    code: string | null;
    originalName: string | null;
    fileName: string;
    fileUrl: string | null;
    fileSize: number;
    mimeType: string;
    fileKind: string;
    smartFormInstance: {
      status: string;
      completedAt: Date | null;
      lastSavedAt: Date | null;
    } | null;
    reviewQuestions?: SmartFormV2PdfReviewQuestion[];
  }[];
};

type ArchiveWorkflowNode = {
  id: string;
  parentId: string | null;
  code: string;
  title: string;
  level: number;
  sortOrder: number;
};

const ARCHIVE_MIME_TYPE = "application/zip";

type ArchiveJobRow = {
  id: string;
  projectId: string;
  status: string;
  currentPhase: string;
  currentLabel: string | null;
  completedUnits: number;
  totalUnits: number;
  errorMessage: string | null;
  artifact?: ProjectArchiveArtifactSnapshot | null;
  createdAt: Date;
  updatedAt: Date;
};

type ArchiveJobPatch = Partial<{
  status: ArchiveJobStatus;
  currentPhase: ArchiveJobPhase;
  currentLabel: string | undefined;
  completedUnits: number;
  totalUnits: number;
  artifact: ProjectArchiveArtifactSnapshot;
  error: { message: string };
  startedAt: Date;
  completedAt: Date;
}>;

@Injectable()
export class ArchiveJobService {
  private readonly subscribers = new Map<
    string,
    Set<(job: ArchiveJobSnapshot) => void>
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly archiveChecks: ArchiveCheckService,
    private readonly storage: StorageService,
    private readonly inbox: InboxService,
    @Optional()
    private readonly archiveNotifications?: ArchiveNotificationService,
    @Optional()
    private readonly smartFormPdf?: SmartFormV2PdfService
  ) {}

  async startJob(
    projectId: string,
    user: RequestUser
  ): Promise<ArchiveJobSnapshot> {
    if (user.globalRole !== "SUPER_ADMIN") {
      await this.access.requireProjectAction(
        projectId,
        user.id,
        "archiveProject"
      );
    }

    const now = new Date();
    const row = await this.prisma.projectArchiveJob.create({
      data: {
        id: randomUUID(),
        projectId,
        status: "queued",
        currentPhase: "fileCheck",
        completedUnits: 0,
        totalUnits: 4,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      },
      include: { artifact: true },
    });
    const job = toJobSnapshot(row);
    void this.runJob(job.jobId, projectId, user.id);
    return job;
  }

  async getJob(
    projectId: string,
    jobId: string,
    user: RequestUser
  ): Promise<ArchiveJobSnapshot> {
    if (user.globalRole !== "SUPER_ADMIN") {
      await this.access.requireProjectMember(projectId, user.id);
    }
    const job = await this.prisma.projectArchiveJob.findFirst({
      where: { id: jobId, projectId },
      include: { artifact: true },
    });
    if (!job) {
      throw new ApiNotFoundException("NOT_FOUND", "Archive job was not found");
    }
    return toJobSnapshot(job);
  }

  subscribeJob(jobId: string, listener: (job: ArchiveJobSnapshot) => void) {
    const listeners = this.subscribers.get(jobId) ?? new Set();
    listeners.add(listener);
    this.subscribers.set(jobId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.subscribers.delete(jobId);
      }
    };
  }

  private emitJob(row: ArchiveJobRow) {
    const listeners = this.subscribers.get(row.id);
    if (!listeners?.size) {
      return;
    }
    const snapshot = toJobSnapshot(row);
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  async latestArtifact(projectId: string, user: RequestUser) {
    if (user.globalRole !== "SUPER_ADMIN") {
      await this.access.requireProjectMember(projectId, user.id);
    }
    const artifact = await this.prisma.projectArchiveArtifact.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    if (!artifact) {
      throw new ApiNotFoundException(
        "ARCHIVE_ARTIFACT_NOT_FOUND",
        "项目归档包不存在"
      );
    }
    return toArtifactSnapshot(artifact);
  }

  async downloadLatestArtifact(
    projectId: string,
    user: RequestUser
  ): Promise<DownloadObject> {
    const artifact = await this.latestArtifact(projectId, user);
    return this.storage.getDownloadObject(
      artifact.objectKey,
      artifact.fileName,
      artifact.mimeType
    );
  }

  private async runJob(jobId: string, projectId: string, userId: string) {
    await this.updateJob(jobId, {
      status: "running",
      currentPhase: "fileCheck",
      currentLabel: "Running File Check",
      startedAt: new Date(),
    });
    try {
      const report = await this.archiveChecks.assertReadyForArchive(projectId);
      await this.completeUnit(jobId, {
        currentPhase: "packaging",
        currentLabel: "Packaging current workpapers",
      });

      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          status: { in: ["ACTIVE", "PENDING_FINAL_CHECK"] },
        },
        select: {
          id: true,
          projectCode: true,
          name: true,
          language: true,
          yearEndDate: true,
          workspace: { select: { clientName: true } },
          cmpClient: { select: { nameZh: true, nameEn: true } },
          cmpEngagement: { select: { engagementCode: true } },
          archivePassword: true,
        },
      });
      if (!project) {
        throw new ApiNotFoundException(
          "PROJECT_NOT_FOUND",
          "Project does not exist or cannot be archived from its current status"
        );
      }
      const papers = await this.currentWorkpapers(projectId);
      const workflowNodes = await this.currentWorkflowNodes(projectId);
      const { buffer, manifestJson, fileCheckReportJson } =
        await this.buildArchivePackage(project, workflowNodes, papers, report);

      await this.completeUnit(jobId, {
        currentPhase: "uploading",
        currentLabel: "Uploading archive package",
      });
      const archiveFileName = `${sanitizeFileName(project.projectCode)}-archive.zip`;
      const stored = await this.storage.putProjectArchive(
        projectId,
        archiveFileName,
        buffer,
        ARCHIVE_MIME_TYPE
      );

      await this.completeUnit(jobId, {
        currentPhase: "finalizing",
        currentLabel: "Locking project",
      });
      const artifact = await this.prisma.$transaction(async (tx) => {
        const created = await tx.projectArchiveArtifact.create({
          data: {
            projectId,
            fileName: stored.fileName,
            objectKey: stored.objectKey,
            fileSize: buffer.byteLength,
            mimeType: ARCHIVE_MIME_TYPE,
            fileCheckReport: fileCheckReportJson,
            manifestJson,
            createdBy: userId,
          },
        });
        await tx.project.update({
          where: { id: projectId },
          data: { status: "ARCHIVED" },
        });
        return created;
      });

      await this.notifyArchiveCompleted(
        projectId,
        userId,
        stored.fileName,
        project.projectCode
      );
      await this.completeUnit(jobId, {
        artifact: toArtifactSnapshot(artifact),
        currentLabel: undefined,
        status: "completed",
        completedAt: new Date(),
      });
    } catch (error) {
      await this.updateJob(jobId, {
        status: "failed",
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
        },
        currentLabel: undefined,
        completedAt: new Date(),
      });
    }
  }

  private currentWorkpapers(projectId: string): Promise<ArchivePaper[]> {
    return this.prisma.workingPaper.findMany({
      where: { projectId, bucket: "CURRENT" },
      orderBy: [{ code: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        workflowNodeId: true,
        code: true,
        title: true,
        signoffs: {
          where: { isCurrent: true, revokedAt: null },
          orderBy: { signedAt: "desc" },
          select: {
            attachmentId: true,
            type: true,
            signedAt: true,
            user: { select: { name: true, email: true } },
          },
        },
        attachments: {
          where: { deletedAt: null },
          orderBy: [{ fileKind: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            code: true,
            originalName: true,
            fileName: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            fileKind: true,
            smartFormInstance: {
              select: {
                status: true,
                completedAt: true,
                lastSavedAt: true,
              },
            },
            reviewQuestions: {
              orderBy: { createdAt: "asc" },
              include: {
                assignedTo: { select: { name: true, email: true } },
                createdBy: { select: { name: true, email: true } },
                repliedBy: { select: { name: true, email: true } },
                messages: {
                  orderBy: { createdAt: "asc" },
                  include: {
                    author: { select: { name: true, email: true } },
                    images: { orderBy: { createdAt: "asc" } },
                    references: {
                      orderBy: { createdAt: "asc" },
                      include: {
                        workingPaper: {
                          select: { code: true, title: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  private currentWorkflowNodes(
    projectId: string
  ): Promise<ArchiveWorkflowNode[]> {
    return this.prisma.workflowNode.findMany({
      where: { projectId },
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        parentId: true,
        code: true,
        title: true,
        level: true,
        sortOrder: true,
      },
    });
  }

  private async buildArchivePackage(
    project: {
      id: string;
      projectCode: string;
      name: string;
      language?: string;
      yearEndDate: Date;
      workspace: { clientName: string };
      cmpClient: { nameZh: string | null; nameEn: string | null } | null;
      cmpEngagement: { engagementCode: string } | null;
      archivePassword?: string | null;
    },
    workflowNodes: ArchiveWorkflowNode[],
    papers: ArchivePaper[],
    report: ArchiveCheckReport
  ) {
    const zip = new JSZip();
    const usedPaths = new Set<string>();
    const folderPathsByNodeId = buildArchiveFolderPaths(
      zip,
      usedPaths,
      workflowNodes
    );
    const files: ArchiveFileIndexFile[] = [];

    for (const paper of papers) {
      for (const attachment of paper.attachments) {
        if (!attachment.fileUrl) {
          continue;
        }
        const displayName = getArchiveAttachmentDisplayName(
          attachment,
          paper.code
        );
        const paperFolderPath =
          folderPathsByNodeId.get(paper.workflowNodeId) ??
          addZipFolder(
            zip,
            usedPaths,
            pathModule.posix.join("workpapers", sanitizeZipSegment(paper.code))
          );
        const body = await this.storage.getObjectBuffer(attachment.fileUrl);
        const exportedSmartForm =
          attachment.fileKind === "SMART_FORM"
            ? await exportSmartFormAttachment(
                body,
                displayName,
                attachment,
                this.smartFormPdfService(),
                project,
                resolveArchiveSmartFormSignoffs(paper.signoffs, attachment.id)
              )
            : null;
        const entryPath = uniqueZipPath(
          usedPaths,
          pathModule.posix.join(
            stripTrailingSlash(paperFolderPath),
            exportedSmartForm?.fileName ?? sanitizeFileName(displayName)
          )
        );
        const archivedBody = exportedSmartForm?.body ?? body;
        zip.file(entryPath, archivedBody);
        const attachmentSignoffs = paper.signoffs.filter(
          (signoff) => signoff.attachmentId === attachment.id
        );
        const preparerSignoff = attachmentSignoffs.find(
          (signoff) => signoff.type === "PREPARER"
        );
        const reviewerSignoff = attachmentSignoffs.find(
          (signoff) => signoff.type === "REVIEWER"
        );
        files.push({
          workingPaperId: paper.id,
          workingPaperCode: paper.code,
          workingPaperTitle: paper.title,
          workflowNodeId: paper.workflowNodeId,
          attachmentId: attachment.id,
          fileReference: attachment.code ?? paper.code,
          fileName:
            exportedSmartForm?.fileName ?? sanitizeFileName(displayName),
          archivePath: entryPath,
          fileSize: archivedBody.byteLength,
          mimeType: exportedSmartForm?.mimeType ?? attachment.mimeType,
          fileKind: exportedSmartForm?.fileKind ?? attachment.fileKind,
          sourceFileName: exportedSmartForm ? displayName : undefined,
          sourceFileKind: exportedSmartForm ? attachment.fileKind : undefined,
          smartFormStatus: attachment.smartFormInstance?.status,
          sha256: createHash("sha256").update(archivedBody).digest("hex"),
          preparerSignoff: preparerSignoff
            ? {
                name: preparerSignoff.user.name,
                email: preparerSignoff.user.email,
                signedAt: preparerSignoff.signedAt.toISOString(),
              }
            : undefined,
          reviewerSignoff: reviewerSignoff
            ? {
                name: reviewerSignoff.user.name,
                email: reviewerSignoff.user.email,
                signedAt: reviewerSignoff.signedAt.toISOString(),
              }
            : undefined,
          signoffStatus: preparerSignoff
            ? reviewerSignoff
              ? "COMPLETE"
              : "MISSING_REVIEWER"
            : "MISSING_PREPARER",
        });
      }
    }

    const generatedAt = new Date().toISOString();
    const manifestProject = {
      id: project.id,
      projectCode: project.projectCode,
      name: project.name,
      language: project.language,
      yearEndDate: project.yearEndDate.toISOString(),
      clientName:
        project.cmpClient?.nameZh ||
        project.cmpClient?.nameEn ||
        project.workspace.clientName,
      engagementCode: project.cmpEngagement?.engagementCode,
    };
    const folders = workflowNodes.map((node) => ({
      workflowNodeId: node.id,
      parentId: node.parentId,
      code: node.code,
      title: node.title,
      level: node.level,
      sortOrder: node.sortOrder,
      entryPath: folderPathsByNodeId.get(node.id),
    }));
    const manifest = {
      version: 2,
      generatedAt,
      project: manifestProject,
      includedBuckets: ["CURRENT"],
      excluded: {
        reviewQuestions: true,
        priorWorkpapers: true,
        temporaryFiles: true,
        deletedAttachments: true,
      },
      folders,
      files,
      fileCheckSummary: report.summary,
    };
    const manifestJson = toJsonValue(manifest);
    const fileCheckReportJson = toJsonValue(report);
    zip.file(
      archiveFileIndexName(project.language),
      buildArchiveFileIndexPdf({
        generatedAt,
        project: manifestProject,
        folders,
        files,
        fileCheckSummary: report.summary,
      })
    );
    zip.file(
      "file-check-report.pdf",
      this.archiveChecks.renderReportPdf(report)
    );

    const plainBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const archivePassword =
      project.archivePassword?.trim() ||
      process.env.ARCHIVE_PASSWORD ||
      ARCHIVE_PASSWORD_FALLBACK;
    const encryptedBuffer = await encryptArchiveWith7zip(
      plainBuffer,
      archivePassword
    );

    return {
      buffer: encryptedBuffer,
      manifestJson,
      fileCheckReportJson,
    };
  }

  private async notifyArchiveCompleted(
    projectId: string,
    senderId: string,
    packageFileName: string,
    projectCode: string
  ) {
    if (this.archiveNotifications) {
      await this.archiveNotifications
        .notifyArchiveCompleted({
          projectId,
          actorId: senderId,
          packageFileName,
        })
        .catch((error) => {
          console.warn(
            "Archive notification failed after archive completed",
            error
          );
        });
      return;
    }

    const members = await this.prisma.projectMember.findMany({
      where: { projectId, status: "ACTIVE" },
      select: { userId: true },
    });
    await Promise.all(
      members.map((member) =>
        this.inbox.createCollaborationMessage({
          recipientId: member.userId,
          senderId: member.userId === senderId ? null : senderId,
          projectId,
          type: "SYSTEM_NOTIFICATION",
          title: `Project successfully archived: ${projectCode}`,
          body: `${projectCode} has been successfully archived. The archive package is ready to download.`,
          contentKey: "PROJECT_ARCHIVE_COMPLETED",
          contentParams: {
            projectCode,
            projectName: projectCode,
            packageFileName,
          },
          actionUrl: `/engagement/${projectId}`,
        })
      )
    );
  }

  private async completeUnit(jobId: string, patch: ArchiveJobPatch) {
    const job = await this.prisma.projectArchiveJob.findUnique({
      where: { id: jobId },
      include: { artifact: true },
    });
    if (!job) {
      return;
    }
    await this.updateJob(jobId, {
      ...patch,
      completedUnits: Math.min(job.totalUnits, job.completedUnits + 1),
    });
  }

  private async updateJob(jobId: string, patch: ArchiveJobPatch) {
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) {
      data.status = patch.status;
    }
    if (patch.currentPhase !== undefined) {
      data.currentPhase = patch.currentPhase;
    }
    if (Object.hasOwn(patch, "currentLabel")) {
      data.currentLabel = patch.currentLabel ?? null;
    }
    if (patch.completedUnits !== undefined) {
      data.completedUnits = patch.completedUnits;
    }
    if (patch.totalUnits !== undefined) {
      data.totalUnits = patch.totalUnits;
    }
    if (patch.artifact) {
      data.artifactId = patch.artifact.id;
    }
    if (patch.error) {
      data.errorMessage = patch.error.message;
    }
    if (patch.startedAt) {
      data.startedAt = patch.startedAt;
    }
    if (patch.completedAt) {
      data.completedAt = patch.completedAt;
    }

    const row = await this.prisma.projectArchiveJob.update({
      where: { id: jobId },
      data,
      include: { artifact: true },
    });
    this.emitJob(row);
    return row;
  }

  private smartFormPdfService() {
    return this.smartFormPdf ?? new SmartFormV2PdfService();
  }
}

function buildArchiveFolderPaths(
  zip: JSZip,
  usedPaths: Set<string>,
  workflowNodes: ArchiveWorkflowNode[]
) {
  const folderPathsByNodeId = new Map<string, string>();
  addZipFolder(zip, usedPaths, "workpapers");

  for (const node of workflowNodes) {
    const parentPath = node.parentId
      ? (folderPathsByNodeId.get(node.parentId) ?? "workpapers/")
      : "workpapers/";
    const folderPath = addZipFolder(
      zip,
      usedPaths,
      pathModule.posix.join(
        stripTrailingSlash(parentPath),
        sanitizeZipSegment(node.code)
      )
    );
    folderPathsByNodeId.set(node.id, folderPath);
  }

  return folderPathsByNodeId;
}

function addZipFolder(zip: JSZip, usedPaths: Set<string>, desiredPath: string) {
  const folderPath = uniqueZipFolderPath(usedPaths, desiredPath);
  zip.file(folderPath, null, { dir: true });
  return folderPath;
}

function toArtifactSnapshot(artifact: ProjectArchiveArtifactSnapshot) {
  return {
    id: artifact.id,
    projectId: artifact.projectId,
    fileName: artifact.fileName,
    objectKey: artifact.objectKey,
    fileSize: artifact.fileSize,
    mimeType: artifact.mimeType,
    createdBy: artifact.createdBy,
    createdAt: artifact.createdAt,
  };
}

function toJobSnapshot(job: ArchiveJobRow): ArchiveJobSnapshot {
  return {
    jobId: job.id,
    projectId: job.projectId,
    status: toArchiveJobStatus(job.status),
    currentPhase: toArchiveJobPhase(job.currentPhase),
    ...(job.currentLabel ? { currentLabel: job.currentLabel } : {}),
    progress: {
      completedUnits: job.completedUnits,
      totalUnits: job.totalUnits,
    },
    ...(job.artifact ? { artifact: toArtifactSnapshot(job.artifact) } : {}),
    ...(job.errorMessage ? { error: { message: job.errorMessage } } : {}),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function toArchiveJobStatus(value: string): ArchiveJobStatus {
  if (
    value === "queued" ||
    value === "running" ||
    value === "completed" ||
    value === "failed"
  ) {
    return value;
  }
  return "failed";
}

function toArchiveJobPhase(value: string): ArchiveJobPhase {
  if (
    value === "fileCheck" ||
    value === "packaging" ||
    value === "uploading" ||
    value === "finalizing"
  ) {
    return value;
  }
  return "finalizing";
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return structuredClone(value) as Prisma.InputJsonValue;
}

function uniqueZipPath(usedPaths: Set<string>, desiredPath: string) {
  let path = desiredPath;
  let index = 2;
  while (usedPaths.has(path)) {
    const extensionIndex = desiredPath.lastIndexOf(".");
    path =
      extensionIndex > desiredPath.lastIndexOf("/")
        ? `${desiredPath.slice(0, extensionIndex)} (${index})${desiredPath.slice(extensionIndex)}`
        : `${desiredPath} (${index})`;
    index += 1;
  }
  usedPaths.add(path);
  return path;
}

function uniqueZipFolderPath(usedPaths: Set<string>, desiredPath: string) {
  const normalizedPath = `${stripTrailingSlash(desiredPath)}/`;
  let path = normalizedPath;
  let index = 2;
  while (usedPaths.has(path) || usedPaths.has(stripTrailingSlash(path))) {
    path = `${stripTrailingSlash(normalizedPath)} (${index})/`;
    index += 1;
  }
  usedPaths.add(path);
  return path;
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function sanitizeZipSegment(value: string) {
  const sanitized = value.replaceAll(/[\\/:*?"<>|]/g, "_").trim();
  return sanitized || "untitled";
}

function sanitizeFileName(value: string) {
  const sanitized = sanitizeZipSegment(value).replace(/^\.+$/, "file");
  if (
    !sanitized ||
    sanitized.startsWith(".") ||
    sanitized.includes("..") ||
    pathModule.posix.normalize(sanitized) !== sanitized
  ) {
    return "file";
  }
  return sanitized;
}

function getArchiveAttachmentDisplayName(
  attachment: Pick<
    ArchivePaper["attachments"][number],
    "code" | "fileName" | "originalName"
  >,
  fallbackCode: string
) {
  const displayName = formatDisplayName(
    attachment.originalName ?? attachment.fileName
  );
  const refCode = attachment.code ?? fallbackCode;
  const baseName = displayName.replace(
    /^[A-Za-z0-9][A-Za-z0-9-]*-F\d+\s+/i,
    ""
  );
  return refCode ? `${refCode} ${baseName}` : baseName;
}

function formatDisplayName(value: string) {
  return value.replaceAll(/\s*-\s*/g, " - ");
}

async function exportSmartFormAttachment(
  body: Buffer,
  displayName: string,
  attachment: ArchivePaper["attachments"][number],
  smartFormPdf: SmartFormV2PdfService,
  project: {
    name: string;
    yearEndDate: Date;
    workspace: { clientName: string };
    cmpClient: { nameZh: string | null; nameEn: string | null } | null;
    cmpEngagement: { engagementCode: string } | null;
  },
  signoffs: SmartFormV2PdfSignoff[]
) {
  const parsed = SmartFormPackageSchema.parse(
    JSON.parse(body.toString("utf-8"))
  );
  const exportFileName = `${stripFileExtension(sanitizeFileName(displayName))}.pdf`;
  return {
    fileName: exportFileName,
    mimeType: "application/pdf",
    fileKind: "SMART_FORM_EXPORT",
    body: await smartFormPdf.renderSmartFormV2Pdf({
      definition: parsed.definition,
      response: parsed.response,
      locale: parsed.template.language,
      fileName: displayName,
      engagementDetails: resolveSmartFormV2PdfEngagementDetails(
        project,
        parsed.template.language
      ),
      signoffs,
      reviewQuestions: attachment.reviewQuestions ?? [],
    }),
  };
}

function resolveArchiveSmartFormSignoffs(
  signoffs: ArchivePaper["signoffs"],
  attachmentId: string
): SmartFormV2PdfSignoff[] {
  const attachmentSignoffs = signoffs.filter(
    (signoff) => signoff.attachmentId === attachmentId
  );
  const applicable =
    attachmentSignoffs.length > 0
      ? attachmentSignoffs
      : signoffs.filter((signoff) => signoff.attachmentId === null);
  return applicable.flatMap((signoff) => {
    if (signoff.type !== "PREPARER" && signoff.type !== "REVIEWER") {
      return [];
    }
    return [
      {
        type: signoff.type,
        userName: signoff.user.name || signoff.user.email,
        signedAt: signoff.signedAt,
      },
    ];
  });
}

function stripFileExtension(value: string) {
  const lastDot = value.lastIndexOf(".");
  return lastDot > 0 ? value.slice(0, lastDot) : value;
}

function archiveFileIndexName(language?: string) {
  const isChinese = language?.toLowerCase().startsWith("zh") ?? true;
  return isChinese ? "项目归档文件索引.pdf" : "Project Archive File Index.pdf";
}

async function encryptArchiveWith7zip(
  plainBuffer: Buffer,
  password: string
): Promise<Buffer> {
  const tempRoot = await mkdtemp(
    pathModule.join(tmpdir(), "projectwing-archive-")
  );
  const plainPath = pathModule.join(tempRoot, "archive-plain.zip");
  const contentRoot = pathModule.join(tempRoot, "contents");
  const encryptedPath = pathModule.join(tempRoot, "archive-encrypted.zip");
  try {
    await writeFile(plainPath, plainBuffer);
    await mkdir(contentRoot, { recursive: true });
    const sevenZipPath = await ensureExecutableFile(path7za, "7za");
    await execFileAsync(
      sevenZipPath,
      ["x", "-y", `-o${contentRoot}`, plainPath],
      { timeout: SEVEN_ZIP_TIMEOUT_MS, windowsHide: true }
    );
    await execFileAsync(
      sevenZipPath,
      [
        "a",
        "-tzip",
        "-mem=AES256",
        "-mx=5",
        `-p${password}`,
        encryptedPath,
        "*",
      ],
      {
        cwd: contentRoot,
        timeout: SEVEN_ZIP_TIMEOUT_MS,
        windowsHide: true,
      }
    );
    return await readFile(encryptedPath);
  } finally {
    // Clean up temp files. Use void to avoid unhandled rejections.
    void (async () => {
      try {
        const { rm } = await import("node:fs/promises");
        await rm(tempRoot, { recursive: true, force: true });
      } catch {
        // Temp cleanup failures are non-critical.
      }
    })();
  }
}
