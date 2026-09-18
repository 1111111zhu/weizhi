import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import type { OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  CreateProjectFileExportJobInput,
  ProjectFileExportJob,
} from "@project-wing/shared";
import { SmartFormPackageSchema } from "@project-wing/shared";
import archiver from "archiver";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiConflictException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import { backgroundJobsEnabled } from "../common/background-jobs";
import { normalizeUploadedFileName } from "../common/file-name";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectAccessService } from "../projects/project-access.service";
import { SmartFormV2PdfService } from "../smart-forms/smart-form-v2-pdf.service";
import type { SmartFormV2PdfSignoff } from "../smart-forms/smart-form-v2-pdf.service";
import { loadSmartFormV2PdfEngagementDetails } from "../smart-forms/smart-form-v2-project-context";
import { StorageService } from "../storage/storage.service";
import { ExportWorkerLeaseLostError } from "./export-worker-lease-lost.error";

const DEFAULT_MAX_FILES = 5000;
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024 * 1024;
const DEFAULT_RETENTION_HOURS = 24;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
const RECOVERY_INTERVAL_MS = 30 * 1000;
const WORKER_LEASE_MS = 2 * 60 * 1000;
const WORKER_HEARTBEAT_MS = 30 * 1000;
const STALE_TEMP_DIRECTORY_MS = 10 * 60 * 1000;
const TEMP_DIRECTORY_PREFIX = "project-wing-export-";

type ExportSnapshotFile = {
  attachmentId: string;
  headVersionId: string | null;
  objectKey: string;
  fileName: string;
  mimeType: string;
  fileKind: string;
  fileSize: number;
  version: number;
  zipPath: string;
  signoffs?: SmartFormV2PdfSignoff[];
};

type ExportJobSnapshot = {
  projectRoot: string;
  files: ExportSnapshotFile[];
  emptyDirectories: string[];
};

type ExportJobRow = Prisma.ProjectFileExportJobGetPayload<
  Record<string, never>
>;

@Injectable()
export class ProjectFileExportJobService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly subscribers = new Map<
    string,
    Set<(job: ProjectFileExportJob) => void>
  >();
  private cleanupTimer?: NodeJS.Timeout;
  private recoveryTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly storage: StorageService,
    private readonly auditLogs: AuditLogsService,
    private readonly smartFormPdf: SmartFormV2PdfService
  ) {}

  async onApplicationBootstrap() {
    if (!backgroundJobsEnabled()) {
      return;
    }
    await this.cleanupStaleTempDirectories();
    await this.cleanupExpiredJobs();
    await this.scheduleRecoverableJobs();
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredJobs().catch(() => {});
      void this.cleanupStaleTempDirectories().catch(() => {});
    }, CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref?.();
    this.recoveryTimer = setInterval(() => {
      this.scheduleRecoverableJobs().catch(() => {});
    }, RECOVERY_INTERVAL_MS);
    this.recoveryTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
    }
  }

  async createJob(
    projectId: string,
    user: RequestUser,
    input: CreateProjectFileExportJobInput,
    source?: AuditLogSource
  ): Promise<ProjectFileExportJob> {
    await this.access.requireProjectMember(projectId, user.id);
    const active = await this.findActiveRow(projectId, user.id);
    if (active) {
      return toSnapshot(active);
    }

    const collected = await this.collectSnapshot(projectId, input);
    const limits = exportLimits();
    if (collected.snapshot.files.length > limits.maxFiles) {
      throw new ApiBadRequestException(
        "EXPORT_LIMIT_EXCEEDED",
        `This export contains ${collected.snapshot.files.length} files; the limit is ${limits.maxFiles}.`
      );
    }
    if (collected.totalSourceBytes > limits.maxBytes) {
      throw new ApiBadRequestException(
        "EXPORT_LIMIT_EXCEEDED",
        `This export is larger than the configured ${formatBytes(limits.maxBytes)} limit.`
      );
    }

    const now = new Date();
    let row: ExportJobRow;
    try {
      row = await this.prisma.projectFileExportJob.create({
        data: {
          id: randomUUID(),
          projectId,
          createdBy: user.id,
          scope: input.scope,
          bucket: collected.bucket,
          workflowNodeId:
            input.scope === "WORKFLOW_NODE" ? input.workflowNodeId : null,
          status: "QUEUED",
          currentPhase: "COLLECTING",
          completedFiles: 0,
          totalFiles: collected.snapshot.files.length,
          totalSourceBytes: BigInt(collected.totalSourceBytes),
          snapshotJson: collected.snapshot as unknown as Prisma.InputJsonValue,
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const concurrent = await this.findActiveRow(projectId, user.id);
        if (concurrent) {
          return toSnapshot(concurrent);
        }
      }
      throw error;
    }

    await this.logAudit({
      actorId: user.id,
      action: "PROJECT_FILE_EXPORT_CREATED",
      targetType: "PROJECT_FILE_EXPORT_JOB",
      targetId: row.id,
      projectId,
      description: `Created ${input.scope.toLowerCase()} export with ${row.totalFiles} files`,
      source,
    });
    void this.runJob(row.id);
    return toSnapshot(row);
  }

  async getActiveJob(projectId: string, user: RequestUser) {
    await this.access.requireProjectMember(projectId, user.id);
    const row = await this.prisma.projectFileExportJob.findFirst({
      where: {
        projectId,
        createdBy: user.id,
        status: {
          in: ["QUEUED", "RUNNING"],
        },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    });
    return row ? toSnapshot(row) : null;
  }

  async getJob(projectId: string, jobId: string, user: RequestUser) {
    await this.access.requireProjectMember(projectId, user.id);
    return toSnapshot(await this.requireOwnedJob(projectId, jobId, user.id));
  }

  async retryJob(
    projectId: string,
    jobId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const row = await this.requireOwnedJob(projectId, jobId, user.id);
    if (row.status !== "FAILED") {
      throw new ApiConflictException(
        "EXPORT_NOT_READY",
        "Only a failed export can be retried."
      );
    }
    const active = await this.findActiveRow(projectId, user.id);
    if (active) {
      return toSnapshot(active);
    }
    const updated = await this.prisma.projectFileExportJob.update({
      where: { id: row.id },
      data: {
        status: "QUEUED",
        currentPhase: "COLLECTING",
        completedFiles: 0,
        errorMessage: null,
        outputObjectKey: null,
        outputFileName: null,
        outputFileSize: null,
        completedAt: null,
        downloadedAt: null,
        expiresAt: null,
        workerToken: null,
        leaseExpiresAt: null,
      },
    });
    await this.logAudit({
      actorId: user.id,
      action: "PROJECT_FILE_EXPORT_RETRIED",
      targetType: "PROJECT_FILE_EXPORT_JOB",
      targetId: row.id,
      projectId,
      description: `Retried project file export ${row.id}`,
      source,
    });
    this.emit(updated);
    void this.runJob(row.id);
    return toSnapshot(updated);
  }

  subscribe(jobId: string, listener: (job: ProjectFileExportJob) => void) {
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

  async openDownload(projectId: string, jobId: string, user: RequestUser) {
    await this.access.requireProjectMember(projectId, user.id);
    const row = await this.requireOwnedJob(projectId, jobId, user.id);
    if (
      !["COMPLETED", "DOWNLOADED"].includes(row.status) ||
      !row.outputObjectKey ||
      !row.outputFileName
    ) {
      throw new ApiConflictException(
        "EXPORT_NOT_READY",
        "The export is not ready to download."
      );
    }
    if (row.expiresAt && row.expiresAt <= new Date()) {
      await this.expireJob(row);
      throw new ApiConflictException(
        "EXPORT_EXPIRED",
        "The export has expired. Create it again."
      );
    }
    return {
      fileName: row.outputFileName,
      fileSize: Number(row.outputFileSize ?? 0),
      stream: await this.storage.getObjectReadStream(row.outputObjectKey),
    };
  }

  async completeDownload(
    projectId: string,
    jobId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const row = await this.requireOwnedJob(projectId, jobId, user.id);
    if (
      !["COMPLETED", "DOWNLOADED"].includes(row.status) ||
      !row.outputObjectKey
    ) {
      return;
    }
    const updated = await this.prisma.projectFileExportJob.update({
      where: { id: jobId },
      data: { status: "DOWNLOADED", downloadedAt: new Date() },
    });
    this.emit(updated);
    await this.logAudit({
      actorId: user.id,
      action: "PROJECT_FILE_EXPORT_DOWNLOADED",
      targetType: "PROJECT_FILE_EXPORT_JOB",
      targetId: jobId,
      projectId,
      description: `Downloaded project file export ${row.outputFileName ?? jobId}`,
      source,
    });
  }

  private async collectSnapshot(
    projectId: string,
    input: CreateProjectFileExportJobInput
  ) {
    const [project, nodes] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { projectCode: true, name: true },
      }),
      this.prisma.workflowNode.findMany({
        where: { projectId },
        select: { id: true, parentId: true, code: true, title: true },
      }),
    ]);
    if (!project) {
      throw new ApiNotFoundException("NOT_FOUND", "Project was not found.");
    }
    const root = sanitizePathSegment(
      `${project.projectCode} - ${project.name}`
    );
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    let subtreeIds: Set<string> | undefined;
    let emptyDirectories: string[] = [];
    if (input.scope === "WORKFLOW_NODE") {
      if (!nodeById.has(input.workflowNodeId)) {
        throw new ApiNotFoundException(
          "NOT_FOUND",
          "Workflow folder was not found."
        );
      }
      subtreeIds = collectSubtreeIds(nodes, input.workflowNodeId);
      emptyDirectories = [...subtreeIds].map((nodeId) =>
        pathModule.posix.join(root, ...buildNodePath(nodeById, nodeId))
      );
    }

    const attachments = await this.prisma.attachment.findMany({
      where:
        input.scope === "ATTACHMENTS"
          ? {
              projectId,
              id: { in: [...new Set(input.attachmentIds)] },
              deletedAt: null,
            }
          : {
              projectId,
              bucket: input.bucket,
              deletedAt: null,
              OR: [
                { workflowNodeId: { in: [...(subtreeIds ?? [])] } },
                {
                  workingPaper: {
                    workflowNodeId: { in: [...(subtreeIds ?? [])] },
                    bucket: input.bucket,
                  },
                },
              ],
            },
      include: {
        workingPaper: {
          select: {
            code: true,
            workflowNodeId: true,
            signoffs: {
              where: { attachmentId: null, isCurrent: true, revokedAt: null },
              orderBy: { signedAt: "asc" },
              select: {
                type: true,
                signedAt: true,
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
        signoffs: {
          where: { isCurrent: true, revokedAt: null },
          orderBy: { signedAt: "asc" },
          select: {
            type: true,
            signedAt: true,
            user: { select: { name: true, email: true } },
          },
        },
        headVersion: {
          select: {
            id: true,
            fileUrl: true,
            fileName: true,
            originalName: true,
            fileSize: true,
            mimeType: true,
            fileKind: true,
            version: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    if (input.scope === "ATTACHMENTS") {
      if (attachments.length !== new Set(input.attachmentIds).size) {
        throw new ApiBadRequestException(
          "EXPORT_ATTACHMENT_NOT_FOUND",
          "One or more selected files are unavailable."
        );
      }
      const buckets = new Set(attachments.map((item) => item.bucket));
      if (buckets.size !== 1) {
        throw new ApiBadRequestException(
          "EXPORT_BUCKET_MISMATCH",
          "Selected files must belong to the same workpaper bucket."
        );
      }
    }
    const bucket =
      input.scope === "WORKFLOW_NODE"
        ? input.bucket
        : assertPresentValue(attachments[0]).bucket;
    const usedPaths = new Set<string>();
    const files = attachments.map((attachment) => {
      const version = attachment.headVersion;
      const objectKey = version?.fileUrl ?? attachment.fileUrl;
      const sourceName = normalizeUploadedFileName(
        version?.originalName ??
          version?.fileName ??
          attachment.originalName ??
          attachment.fileName
      );
      const refCode = attachment.code ?? attachment.workingPaper?.code ?? "";
      const baseName = refCode
        ? sourceName.replace(/^[A-Za-z0-9][A-Za-z0-9-]*-F\d+\s+/i, "")
        : sourceName;
      let fileName = sanitizeFileName(
        refCode ? `${refCode} ${baseName}` : baseName
      );
      const fileKind = version?.fileKind ?? attachment.fileKind;
      if (fileKind === "SMART_FORM") {
        fileName = replaceExtension(fileName, ".pdf");
      }
      const workflowNodeId =
        attachment.workflowNodeId ??
        attachment.workingPaper?.workflowNodeId ??
        null;
      const directory = workflowNodeId
        ? buildNodePath(nodeById, workflowNodeId)
        : ["Unassigned"];
      const zipPath = uniqueZipPath(
        pathModule.posix.join(root, ...directory, fileName),
        usedPaths
      );
      const directSignoffs = attachment.signoffs ?? [];
      const applicableSignoffs =
        directSignoffs.length > 0
          ? directSignoffs
          : (attachment.workingPaper?.signoffs ?? []);
      return {
        attachmentId: attachment.id,
        headVersionId: version?.id ?? attachment.headVersionId,
        objectKey,
        fileName,
        mimeType: version?.mimeType ?? attachment.mimeType,
        fileKind,
        fileSize: version?.fileSize ?? attachment.fileSize,
        version: version?.version ?? attachment.version,
        zipPath,
        ...(applicableSignoffs.length > 0
          ? {
              signoffs: applicableSignoffs.map((signoff) => ({
                type: signoff.type,
                userName: signoff.user.name || signoff.user.email,
                signedAt: signoff.signedAt.toISOString(),
              })),
            }
          : {}),
      } satisfies ExportSnapshotFile;
    });
    const snapshot: ExportJobSnapshot = {
      projectRoot: root,
      files,
      emptyDirectories: uniqueDirectoryPaths(emptyDirectories),
    };
    return {
      bucket,
      snapshot,
      totalSourceBytes: files.reduce((sum, file) => sum + file.fileSize, 0),
    };
  }

  private async runJob(jobId: string) {
    const workerToken = randomUUID();
    const claimedAt = new Date();
    const claim = await this.prisma.projectFileExportJob.updateMany({
      where: {
        id: jobId,
        OR: [
          { status: "QUEUED" },
          {
            status: "RUNNING",
            OR: [
              { leaseExpiresAt: null },
              { leaseExpiresAt: { lte: claimedAt } },
            ],
          },
        ],
      },
      data: {
        status: "RUNNING",
        currentPhase: "PACKAGING",
        completedFiles: 0,
        errorMessage: null,
        startedAt: claimedAt,
        workerToken,
        leaseExpiresAt: new Date(claimedAt.getTime() + WORKER_LEASE_MS),
      },
    });
    if (claim.count !== 1) {
      return;
    }

    let heartbeatTimer: NodeJS.Timeout | undefined;
    let tempDirectory: string | undefined;
    let uploadedObjectKey: string | undefined;
    try {
      const row = await this.prisma.projectFileExportJob.findUnique({
        where: { id: jobId },
      });
      if (!row || row.workerToken !== workerToken) {
        return;
      }
      if (row.outputObjectKey) {
        await this.storage.deleteObject(row.outputObjectKey).catch(() => {});
        await this.updateClaimedJob(jobId, workerToken, {
          outputObjectKey: null,
          outputFileName: null,
          outputFileSize: null,
        });
      }
      const snapshot = parseExportSnapshot(row.snapshotJson);
      tempDirectory = await mkdtemp(
        pathModule.join(tmpdir(), `${TEMP_DIRECTORY_PREFIX}${jobId}-`)
      );
      heartbeatTimer = setInterval(() => {
        void this.renewWorkerLease(jobId, workerToken, tempDirectory);
      }, WORKER_HEARTBEAT_MS);
      heartbeatTimer.unref?.();
      const sourceDirectory = pathModule.join(tempDirectory, "sources");
      await mkdir(sourceDirectory, { recursive: true });
      const zipPath = pathModule.join(tempDirectory, "export.zip");
      const output = createWriteStream(zipPath);
      const zip = archiver("zip", { store: true });
      const zipFinished = new Promise<void>((resolve, reject) => {
        output.on("close", resolve);
        output.on("error", reject);
        zip.on("error", reject);
      });
      zip.pipe(output);
      const engagementDetailsByLocale = new Map<
        string,
        Awaited<ReturnType<typeof loadSmartFormV2PdfEngagementDetails>>
      >();
      for (const directory of snapshot.emptyDirectories) {
        zip.append("", { name: `${directory.replace(/\/+$/, "")}/` });
      }
      for (let index = 0; index < snapshot.files.length; index += 1) {
        const file = assertPresentValue(snapshot.files[index]);
        const extension = pathModule.extname(file.fileName);
        const sourcePath = pathModule.join(
          sourceDirectory,
          `${String(index).padStart(6, "0")}${extension}`
        );
        try {
          if (file.fileKind === "SMART_FORM") {
            const source = await this.storage.getObjectBuffer(file.objectKey);
            const smartForm = SmartFormPackageSchema.parse(
              JSON.parse(source.toString("utf-8"))
            );
            const locale =
              smartForm.template.language ??
              smartForm.response?.responseLocale ??
              "zh-CN";
            if (!engagementDetailsByLocale.has(locale)) {
              engagementDetailsByLocale.set(
                locale,
                await loadSmartFormV2PdfEngagementDetails(
                  this.prisma,
                  row.projectId,
                  locale
                )
              );
            }
            const pdf = await this.smartFormPdf.renderSmartFormV2Pdf({
              definition: smartForm.definition,
              response: smartForm.response,
              locale,
              fileName: file.fileName,
              generatedAt: new Date(),
              documentVersion: `v${file.version}`,
              engagementDetails:
                engagementDetailsByLocale.get(locale) ?? undefined,
              signoffs: file.signoffs ?? [],
            });
            await writeFile(sourcePath, pdf);
          } else {
            await this.storage.downloadObjectToFile(file.objectKey, sourcePath);
          }
        } catch (error) {
          throw new Error(
            `${file.fileName}: ${error instanceof Error ? error.message : "could not read or convert the file"}`,
            { cause: error }
          );
        }
        zip.file(sourcePath, { name: file.zipPath });
        if ((index + 1) % 10 === 0 || index + 1 === snapshot.files.length) {
          await this.updateClaimedJob(jobId, workerToken, {
            completedFiles: index + 1,
          });
        }
      }
      await zip.finalize();
      await zipFinished;

      await this.updateClaimedJob(jobId, workerToken, {
        currentPhase: "UPLOADING",
      });
      const outputFileName = buildOutputFileName(row, snapshot);
      const expectedObject = this.storage.getProjectFileExportObject(
        row.projectId,
        jobId,
        outputFileName
      );
      await this.updateClaimedJob(jobId, workerToken, {
        outputObjectKey: expectedObject.objectKey,
        outputFileName: expectedObject.fileName,
        outputFileSize: null,
      });
      uploadedObjectKey = expectedObject.objectKey;
      const stored = await this.storage.putProjectFileExport(
        row.projectId,
        jobId,
        outputFileName,
        zipPath
      );
      const completedAt = new Date();
      const expiresAt = new Date(
        completedAt.getTime() + exportLimits().retentionHours * 60 * 60 * 1000
      );
      await this.updateClaimedJob(jobId, workerToken, {
        status: "COMPLETED",
        currentPhase: "READY",
        completedFiles: snapshot.files.length,
        outputObjectKey: stored.objectKey,
        outputFileName,
        outputFileSize: BigInt(stored.fileSize),
        completedAt,
        expiresAt,
        workerToken: null,
        leaseExpiresAt: null,
      });
      await this.logAudit({
        actorId: row.createdBy,
        action: "PROJECT_FILE_EXPORT_COMPLETED",
        targetType: "PROJECT_FILE_EXPORT_JOB",
        targetId: jobId,
        projectId: row.projectId,
        description: `Completed project file export ${outputFileName}`,
      });
    } catch (error) {
      if (uploadedObjectKey) {
        const owner = await this.prisma.projectFileExportJob
          .findUnique({ where: { id: jobId }, select: { workerToken: true } })
          .catch(() => null);
        if (owner?.workerToken === workerToken) {
          await this.storage.deleteObject(uploadedObjectKey).catch(() => {});
        }
      }
      const message =
        error instanceof Error ? error.message : "The export job failed.";
      const failed = await this.updateClaimedJob(jobId, workerToken, {
        status: "FAILED",
        errorMessage: message,
        workerToken: null,
        leaseExpiresAt: null,
      }).catch(() => null);
      if (failed) {
        await this.logAudit({
          actorId: failed.createdBy,
          action: "PROJECT_FILE_EXPORT_FAILED",
          targetType: "PROJECT_FILE_EXPORT_JOB",
          targetId: jobId,
          projectId: failed.projectId,
          description: `Project file export failed: ${message}`,
        });
      }
    } finally {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      if (tempDirectory) {
        await rm(tempDirectory, { recursive: true, force: true });
      }
    }
  }

  private async updateClaimedJob(
    jobId: string,
    workerToken: string,
    data: Prisma.ProjectFileExportJobUpdateInput
  ) {
    const result = await this.prisma.projectFileExportJob.updateMany({
      where: { id: jobId, workerToken },
      data: {
        ...data,
        leaseExpiresAt:
          "leaseExpiresAt" in data
            ? data.leaseExpiresAt
            : new Date(Date.now() + WORKER_LEASE_MS),
      },
    });
    if (result.count !== 1) {
      throw new ExportWorkerLeaseLostError();
    }
    const row = await this.prisma.projectFileExportJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    this.emit(row);
    return row;
  }

  private emit(row: ExportJobRow) {
    const snapshot = toSnapshot(row);
    for (const listener of this.subscribers.get(row.id) ?? []) {
      listener(snapshot);
    }
  }

  private findActiveRow(projectId: string, userId: string) {
    return this.prisma.projectFileExportJob.findFirst({
      where: {
        projectId,
        createdBy: userId,
        status: { in: ["QUEUED", "RUNNING"] },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  private async requireJob(projectId: string, jobId: string) {
    const row = await this.prisma.projectFileExportJob.findFirst({
      where: { id: jobId, projectId },
    });
    if (!row) {
      throw new ApiNotFoundException("NOT_FOUND", "Export job was not found.");
    }
    return row;
  }

  private async requireOwnedJob(
    projectId: string,
    jobId: string,
    userId: string
  ) {
    const row = await this.requireJob(projectId, jobId);
    if (row.createdBy !== userId) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only the user who created this export can access it."
      );
    }
    return row;
  }

  private async scheduleRecoverableJobs() {
    const now = new Date();
    const rows = await this.prisma.projectFileExportJob.findMany({
      where: {
        OR: [
          { status: "QUEUED" },
          {
            status: "RUNNING",
            OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
          },
        ],
      },
      select: { id: true },
    });
    for (const row of rows) {
      void this.runJob(row.id);
    }
  }

  private async renewWorkerLease(
    jobId: string,
    workerToken: string,
    tempDirectory?: string
  ) {
    await this.prisma.projectFileExportJob.updateMany({
      where: { id: jobId, workerToken, status: "RUNNING" },
      data: { leaseExpiresAt: new Date(Date.now() + WORKER_LEASE_MS) },
    });
    if (tempDirectory) {
      const now = new Date();
      await utimes(tempDirectory, now, now).catch(() => {});
    }
  }

  private async cleanupStaleTempDirectories() {
    const entries = await readdir(tmpdir(), { withFileTypes: true }).catch(
      () => []
    );
    const cutoff = Date.now() - STALE_TEMP_DIRECTORY_MS;
    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        !entry.name.startsWith(TEMP_DIRECTORY_PREFIX)
      ) {
        continue;
      }
      const path = pathModule.join(tmpdir(), entry.name);
      const details = await stat(path).catch(() => null);
      if (!details || details.mtimeMs > cutoff) {
        continue;
      }
      await rm(path, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async logAudit(input: Parameters<AuditLogsService["log"]>[0]) {
    await this.auditLogs.log(input).catch(() => {});
  }

  private async cleanupExpiredJobs() {
    const rows = await this.prisma.projectFileExportJob.findMany({
      where: {
        status: { in: ["COMPLETED", "DOWNLOADED"] },
        expiresAt: { lte: new Date() },
      },
    });
    for (const row of rows) {
      await this.expireJob(row);
    }
  }

  private async expireJob(row: ExportJobRow) {
    if (row.outputObjectKey) {
      const deleted = await this.storage.deleteObject(row.outputObjectKey).then(
        () => true,
        () => false
      );
      if (!deleted) {
        return false;
      }
    }
    const expired = await this.prisma.projectFileExportJob.update({
      where: { id: row.id },
      data: {
        status: "EXPIRED",
        outputObjectKey: null,
        outputFileSize: null,
      },
    });
    this.emit(expired);
    return true;
  }
}

function toSnapshot(row: ExportJobRow): ProjectFileExportJob {
  return {
    id: row.id,
    projectId: row.projectId,
    scope: row.scope,
    bucket: row.bucket,
    workflowNodeId: row.workflowNodeId,
    status: row.status,
    currentPhase: row.currentPhase,
    completedFiles: row.completedFiles,
    totalFiles: row.totalFiles,
    totalSourceBytes: Number(row.totalSourceBytes),
    errorMessage: row.errorMessage,
    outputFileName: row.outputFileName,
    outputFileSize:
      row.outputFileSize === null ? null : Number(row.outputFileSize),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

function parseExportSnapshot(value: Prisma.JsonValue): ExportJobSnapshot {
  const snapshot = value as unknown as ExportJobSnapshot;
  if (
    !snapshot ||
    !Array.isArray(snapshot.files) ||
    !Array.isArray(snapshot.emptyDirectories)
  ) {
    throw new Error("The saved export snapshot is invalid.");
  }
  return {
    ...snapshot,
    files: snapshot.files.map((file) => ({
      ...file,
      objectKey: normalizeLegacyExportObjectKey(file.objectKey),
    })),
  };
}

function normalizeLegacyExportObjectKey(objectKey: string) {
  if (objectKey.startsWith("\\") || /^[a-zA-Z]:[\\/]/.test(objectKey)) {
    return objectKey;
  }
  return objectKey.replaceAll("\\", "/");
}

function exportLimits() {
  return {
    maxFiles: positiveInteger(
      process.env.PROJECT_FILE_EXPORT_MAX_FILES,
      DEFAULT_MAX_FILES
    ),
    maxBytes: positiveInteger(
      process.env.PROJECT_FILE_EXPORT_MAX_BYTES,
      DEFAULT_MAX_BYTES
    ),
    retentionHours: positiveInteger(
      process.env.PROJECT_FILE_EXPORT_RETENTION_HOURS,
      DEFAULT_RETENTION_HOURS
    ),
  };
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function collectSubtreeIds(
  nodes: { id: string; parentId: string | null }[],
  rootId: string
) {
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) {
      continue;
    }
    const values = children.get(node.parentId) ?? [];
    values.push(node.id);
    children.set(node.parentId, values);
  }
  const result = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const current = assertPresentValue(stack.pop());
    if (result.has(current)) {
      continue;
    }
    result.add(current);
    stack.push(...(children.get(current) ?? []));
  }
  return result;
}

function buildNodePath(
  nodeById: Map<
    string,
    { id: string; parentId: string | null; code: string; title: string }
  >,
  nodeId: string
) {
  const result: string[] = [];
  const visited = new Set<string>();
  let current = nodeById.get(nodeId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    result.unshift(sanitizePathSegment(current.code || current.title));
    current = current.parentId ? nodeById.get(current.parentId) : undefined;
  }
  return result.length > 0 ? result : ["Unassigned"];
}

function sanitizePathSegment(value: string) {
  const sanitized = value
    .normalize("NFC")
    .replaceAll(/[\p{Cc}\\/:*?"<>|]/gu, "_")
    .trim()
    .replace(/^\.+$/, "_");
  return sanitized && sanitized !== "." && sanitized !== ".."
    ? sanitized
    : "Untitled";
}

function sanitizeFileName(value: string) {
  const sanitized = sanitizePathSegment(value);
  return sanitized.startsWith(".") || sanitized.includes("..")
    ? "file"
    : sanitized;
}

function replaceExtension(fileName: string, extension: string) {
  const current = pathModule.extname(fileName);
  return `${current ? fileName.slice(0, -current.length) : fileName || "file"}${extension}`;
}

function uniqueZipPath(path: string, used: Set<string>) {
  const normalized = path.toLocaleLowerCase("en-US");
  if (!used.has(normalized)) {
    used.add(normalized);
    return path;
  }
  const extension = pathModule.extname(path);
  const base = extension ? path.slice(0, -extension.length) : path;
  for (let index = 2; ; index += 1) {
    const candidate = `${base} (${index})${extension}`;
    const key = candidate.toLocaleLowerCase("en-US");
    if (!used.has(key)) {
      used.add(key);
      return candidate;
    }
  }
}

function uniqueDirectoryPaths(paths: string[]) {
  const seen = new Set<string>();
  return paths.filter((path) => {
    const key = path.toLocaleLowerCase("en-US");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildOutputFileName(row: ExportJobRow, snapshot: ExportJobSnapshot) {
  if (row.scope === "WORKFLOW_NODE" && row.workflowNodeId) {
    const directory = snapshot.emptyDirectories.find((path) =>
      path
        .toLocaleLowerCase("en-US")
        .startsWith(`${snapshot.projectRoot}/`.toLocaleLowerCase("en-US"))
    );
    const name = directory?.split("/").at(-1) ?? "folder";
    return `${sanitizeFileName(name)}-export.zip`;
  }
  return `${sanitizeFileName(snapshot.projectRoot)}-selected-files-export.zip`;
}

function formatBytes(bytes: number) {
  return `${Math.ceil(bytes / 1024 / 1024 / 1024)} GiB`;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
