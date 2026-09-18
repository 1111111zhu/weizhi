import { createHash, randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type {
  Prisma,
  WorkingPaperSignoffType,
  WorkflowNodeType,
} from "@prisma/client";
import { formatNumberWithoutDigitFour } from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiConflictException,
} from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { ObjectMetadata } from "../storage/storage.service";
import { buildNextWorkingPaperCode } from "../workflow/working-paper-code";
import { ConfirmationEmpImportArchiveService } from "./confirmation-emp-import-archive.service";
import type {
  ConfirmationEmpImportArchiveResult,
  ConfirmationEmpImportArchiveSource,
} from "./confirmation-emp-import-archive.service";
import { ConfirmationEmpImportItemError } from "./confirmation-emp-import-item.error";
import { ProjectAccessService } from "./project-access.service";

export type ConfirmationEmpImportMode = "FLAT" | "GROUPED" | "ZIP";

export type ConfirmationEmpImportSourceKind =
  | "OUTGOING_ARTIFACT"
  | "RESPONSE_ARTIFACT";

export type ConfirmationEmpImportPreviewSource = {
  reimportTargetDirectoryId?: string;
  confirmationId: string;
  confirmationCode: string | null;
  counterpartyName: string;
  sourceKind: ConfirmationEmpImportSourceKind;
  sourceArtifactId: string;
  responseId: string | null;
  responseArtifactId: string | null;
  sourceObjectKey: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  sourceSha256: string;
  activeLinkKey: string;
  paperCode: string;
  proposedCode?: string | null;
  businessName: string;
  prepareUserId: string | null;
  prepareAt: Date | null;
  reviewUserId: string | null;
  reviewAt: Date | null;
  responseSequence?: number;
  packageSequence: number | null;
  zipEntryName: string | null;
};

export type ConfirmationEmpImportPreviewIssue = {
  code: string;
  message: string;
  confirmationId?: string;
  sourceKey?: string;
};

export type ConfirmationEmpImportPreview = {
  projectId: string;
  targetWorkflowNodeId: string;
  mode: ConfirmationEmpImportMode;
  sources: ConfirmationEmpImportPreviewSource[];
  skipped: {
    confirmationId: string;
    sourceKey: string;
    existingJobId?: string;
    existingItemId?: string;
    existingMode?: ConfirmationEmpImportMode;
    targetState?:
      | "AVAILABLE"
      | "RECYCLED"
      | "MISSING"
      | "CHANGED"
      | "UNVERIFIED";
    sourceFileName?: string;
    existingWorkingPaperId?: string | null;
    existingAttachmentId?: string | null;
    existingWorkingPaperCode?: string | null;
    existingWorkingPaperTitle?: string | null;
    existingWorkflowLocation?: {
      id: string;
      code: string;
      title: string;
    } | null;
    existingLocation?: string | null;
  }[];
  issues: ConfirmationEmpImportPreviewIssue[];
  fingerprint: string;
};

export type ConfirmationEmpImportPreviewInput = {
  confirmationIds?: string[];
  activeLinkKeys?: string[];
  targetWorkflowNodeId: string;
  mode: ConfirmationEmpImportMode;
};

export type ConfirmationEmpImportCreateJobInput =
  ConfirmationEmpImportPreviewInput & {
    previewFingerprint: string;
    idempotencyKey: string;
    batchCode?: string;
    batchTitle?: string;
    sourceOverrides?: Record<
      string,
      { paperCode?: string; businessName?: string; zipEntryName?: string }
    >;
  };

const EMP_IMPORT_JOB_RESPONSE_INCLUDE = {
  items: { include: { empWorkflowNode: true } },
  targetWorkflowNode: true,
  batchWorkflowNode: true,
} as const;

type WorkflowNodeRecord =
  Prisma.WorkflowNodeGetPayload<Prisma.WorkflowNodeDefaultArgs>;
type WorkingPaperRecord =
  Prisma.WorkingPaperGetPayload<Prisma.WorkingPaperDefaultArgs>;
type AttachmentRecord =
  Prisma.AttachmentGetPayload<Prisma.AttachmentDefaultArgs>;
type EmpImportJobBase =
  Prisma.ConfirmationEmpImportJobGetPayload<Prisma.ConfirmationEmpImportJobDefaultArgs>;
type EmpImportItemBase =
  Prisma.ConfirmationEmpImportItemGetPayload<Prisma.ConfirmationEmpImportItemDefaultArgs>;
type EmpImportJob = EmpImportJobBase & {
  items?: EmpImportItem[];
  withdrawnAt?: Date | null;
  targetWorkflowNode?: WorkflowNodeRecord | null;
  batchWorkflowNode?: WorkflowNodeRecord | null;
};
type EmpImportItem = EmpImportItemBase & {
  job?: EmpImportJob | null;
  empWorkflowNode?: WorkflowNodeRecord | null;
  workingPaper?:
    | (WorkingPaperRecord & {
        workflowNode?: WorkflowNodeRecord | null;
        signoffs?: Prisma.WorkingPaperSignoffGetPayload<Prisma.WorkingPaperSignoffDefaultArgs>[];
      })
    | null;
  attachment?:
    | (AttachmentRecord & {
        workflowNode?: WorkflowNodeRecord | null;
        workingPaper?: WorkingPaperRecord | null;
        versions?: Prisma.AttachmentVersionGetPayload<Prisma.AttachmentVersionDefaultArgs>[];
        signoffs?: Prisma.WorkingPaperSignoffGetPayload<Prisma.WorkingPaperSignoffDefaultArgs>[];
        attachments?: AttachmentRecord[];
      })
    | null;
};

@Injectable()
export class ConfirmationEmpImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly storage: StorageService,
    private readonly auditLogs: AuditLogsService,
    private readonly archive: ConfirmationEmpImportArchiveService
  ) {}

  async preview(
    projectId: string,
    user: RequestUser,
    input: ConfirmationEmpImportPreviewInput
  ): Promise<ConfirmationEmpImportPreview> {
    await this.access.requireProjectAction(projectId, user.id, "modifyIndex");

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    });
    const targetNode = await this.prisma.workflowNode.findUnique({
      where: { id: input.targetWorkflowNodeId },
      select: {
        id: true,
        projectId: true,
        code: true,
        level: true,
      },
    });
    const issues: ConfirmationEmpImportPreviewIssue[] = [];
    if (!project || project.status !== "ACTIVE") {
      issues.push({
        code: "PROJECT_NOT_MUTABLE",
        message: "The selected project is not mutable.",
      });
    }
    if (!targetNode || targetNode.projectId !== projectId) {
      issues.push({
        code: "TARGET_NOT_FOUND",
        message:
          "The selected workflow directory does not belong to this project.",
      });
    }
    const explicitActiveLinkKeys = input.activeLinkKeys !== undefined;
    const requestedActiveLinkKeys = [...new Set(input.activeLinkKeys)];
    const requestedActiveLinkKeySet = new Set(requestedActiveLinkKeys);
    const sourceSelectionConfirmationIds = explicitActiveLinkKeys
      ? [
          ...new Set(
            requestedActiveLinkKeys
              .map(confirmationIdFromActiveLinkKey)
              .filter((value): value is string => Boolean(value))
          ),
        ]
      : [];
    const explicitConfirmationIds =
      !explicitActiveLinkKeys && input.confirmationIds !== undefined;
    const requestedConfirmationIds = [...new Set(input.confirmationIds)];
    const confirmations = await this.prisma.projectConfirmation.findMany({
      where: {
        projectId,
        ...(explicitActiveLinkKeys
          ? {
              id: { in: sourceSelectionConfirmationIds },
              status: "CLOSED",
              differenceStatus: "MATCHED",
            }
          : explicitConfirmationIds
            ? { id: { in: requestedConfirmationIds } }
            : { status: "CLOSED", differenceStatus: "MATCHED" }),
      },
      orderBy: explicitConfirmationIds
        ? undefined
        : [
            { confirmationCode: "asc" },
            { counterpartyName: "asc" },
            { id: "asc" },
          ],
      include: {
        currentArtifact: true,
        responses: {
          include: { artifacts: { orderBy: { sequence: "asc" } } },
        },
        followUpEvents: {
          orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
        },
      },
    });
    const eligibleConfirmations = explicitConfirmationIds
      ? confirmations
      : confirmations.filter(
          (confirmation) =>
            confirmation.status === "CLOSED" &&
            confirmation.differenceStatus === "MATCHED"
        );
    const orderedConfirmations = explicitConfirmationIds
      ? confirmations
      : [...eligibleConfirmations].sort(compareConfirmationRows);
    const confirmationIds = explicitActiveLinkKeys
      ? orderedConfirmations.map((confirmation) => confirmation.id)
      : explicitConfirmationIds
        ? requestedConfirmationIds
        : orderedConfirmations.map((confirmation) => confirmation.id);
    const confirmationsById = new Map(
      eligibleConfirmations.map((confirmation) => [
        confirmation.id,
        confirmation,
      ])
    );
    const existingPapers = targetNode
      ? await this.prisma.workingPaper.findMany({
          where: { projectId, workflowNodeId: targetNode.id },
          select: { code: true },
        })
      : [];
    const sourceCandidates: CandidateSource[] = [];
    const sourceKeysSeen = new Set<string>();
    if (explicitActiveLinkKeys && requestedActiveLinkKeys.length === 0) {
      issues.push({
        code: "SOURCE_LINK_SET_EMPTY",
        message: "At least one physical confirmation source must be selected.",
      });
    }
    if (explicitConfirmationIds) {
      for (const confirmationId of confirmationIds) {
        if (!confirmationsById.has(confirmationId)) {
          issues.push({
            code: "CONFIRMATION_NOT_FOUND",
            message: "The confirmation does not belong to this project.",
            confirmationId,
          });
        }
      }
    }

    for (const confirmationId of confirmationIds) {
      const confirmation = confirmationsById.get(confirmationId) as
        | ConfirmationRecord
        | undefined;
      if (!confirmation) {
        continue;
      }
      if (confirmation.status !== "CLOSED") {
        issues.push({
          code: "CONFIRMATION_NOT_CLOSED",
          message: "Only closed confirmations can be imported.",
          confirmationId,
        });
        continue;
      }
      if (confirmation.differenceStatus !== "MATCHED") {
        issues.push({
          code: "CONFIRMATION_NOT_MATCHED",
          message: "Only matched confirmations can be imported.",
          confirmationId,
        });
        continue;
      }
      const completedResponses = [...(confirmation.responses ?? [])]
        .filter(
          (response) =>
            (response.routingStatus === "ROUTED" ||
              response.routingStatus === "CONCLUDED") &&
            response.artifacts?.length
        )
        .sort(
          (left, right) =>
            responseDate(left).getTime() - responseDate(right).getTime() ||
            compareText(left.id, right.id)
        );
      if (completedResponses.length === 0) {
        issues.push({
          code: "ROUTED_RESPONSE_ARTIFACT_MISSING",
          message: "No completed response artifact is available.",
          confirmationId,
        });
        continue;
      }
      const counterpartyName = confirmation.counterpartyName.trim();
      let responseSequence = 0;
      for (const response of completedResponses) {
        const review = latestMatchedReview(
          confirmation.followUpEvents ?? [],
          response.id
        );
        const reviewUserId =
          review.userId && review.userId !== confirmation.createdBy
            ? review.userId
            : null;
        const reviewAt = reviewUserId ? review.occurredAt : null;
        for (const artifact of [...response.artifacts].sort(
          (left, right) =>
            (left.sequence ?? Number.MAX_SAFE_INTEGER) -
              (right.sequence ?? Number.MAX_SAFE_INTEGER) ||
            compareText(left.id, right.id)
        )) {
          responseSequence += 1;
          const sourceKey = `RESPONSE_ARTIFACT:${confirmation.id}:${
            response.id
          }:${artifact.id}`;
          sourceKeysSeen.add(sourceKey);
          if (
            explicitActiveLinkKeys &&
            !requestedActiveLinkKeySet.has(sourceKey)
          ) {
            continue;
          }
          try {
            await this.validateSourceMetadata(
              artifact.objectKey,
              artifact.fileSize,
              artifact.sha256
            );
          } catch (error) {
            issues.push({
              code: sourceObjectErrorCode(error),
              message: sourceObjectErrorMessage(error),
              confirmationId: confirmation.id,
              sourceKey,
            });
            continue;
          }
          sourceCandidates.push({
            confirmationId: confirmation.id,
            confirmationCode: confirmation.confirmationCode ?? null,
            counterpartyName,
            sourceKind: "RESPONSE_ARTIFACT",
            sourceArtifactId: artifact.id,
            responseId: response.id,
            responseArtifactId: artifact.id,
            sourceObjectKey: artifact.objectKey,
            originalFileName: artifact.fileName,
            mimeType: artifact.mimeType,
            fileSize: artifact.fileSize,
            sourceSha256: artifact.sha256,
            prepareUserId: null,
            prepareAt: null,
            reviewUserId,
            reviewAt,
            activeLinkKey: sourceKey,
            responseSequence,
          });
        }
      }
    }

    if (explicitActiveLinkKeys) {
      for (const sourceKey of requestedActiveLinkKeys) {
        if (!sourceKeysSeen.has(sourceKey)) {
          issues.push({
            code: "SOURCE_LINK_NOT_FOUND",
            message:
              "The selected physical confirmation source is no longer available.",
            sourceKey,
          });
        }
      }
    }

    const sourceKeys = sourceCandidates.map((source) => source.activeLinkKey);
    const activeItems =
      sourceKeys.length > 0
        ? await this.prisma.confirmationEmpImportItem.findMany({
            where: {
              activeLinkKey: { in: sourceKeys },
              status: "SUCCEEDED",
              withdrawnAt: null,
            },
            select: {
              id: true,
              job: {
                select: {
                  mode: true,
                  batchTitle: true,
                  batchCode: true,
                  targetWorkflowNodeId: true,
                },
              },
              workingPaperCode: true,
              workingPaperTitle: true,
              empWorkflowNodeId: true,
              targetHeadHash: true,
              attachment: {
                select: {
                  deletedAt: true,
                  contentHash: true,
                  fileUrl: true,
                  title: true,
                  code: true,
                  workflowNodeId: true,
                },
              },
              activeLinkKey: true,
              jobId: true,
              workingPaperId: true,
              attachmentId: true,
              workingPaper: {
                select: {
                  id: true,
                  code: true,
                  title: true,
                  workflowNode: {
                    select: { id: true, code: true, title: true },
                  },
                },
              },
            },
          })
        : [];
    const activeByKey = new Map<string, ActiveImportItem>(
      activeItems.map((item: ActiveImportItem) => [item.activeLinkKey, item])
    );
    const skipped: ConfirmationEmpImportPreview["skipped"] = [];
    const sources: ConfirmationEmpImportPreviewSource[] = [];
    const usedCodes = new Set(
      existingPapers.map((paper) => String(paper.code).trim())
    );
    for (const candidate of sourceCandidates) {
      const active = activeByKey.get(candidate.activeLinkKey);
      if (active && !active.attachment?.deletedAt) {
        skipped.push({
          confirmationId: candidate.confirmationId,
          sourceKey: candidate.activeLinkKey,
          existingJobId: active.jobId,
          existingItemId: active.id,
          existingMode: active.job?.mode,
          targetState: !active.attachment
            ? "MISSING"
            : active.attachment.deletedAt
              ? "RECYCLED"
              : (active.targetHeadHash &&
                    active.attachment.contentHash !== active.targetHeadHash) ||
                  active.attachment.title !==
                    (active.job?.mode === "ZIP"
                      ? active.job.batchTitle
                      : active.workingPaperTitle) ||
                  active.attachment.code !==
                    (active.job?.mode === "ZIP"
                      ? active.job.batchCode
                      : active.workingPaperCode) ||
                  active.attachment.workflowNodeId !== active.empWorkflowNodeId
                ? "CHANGED"
                : "AVAILABLE",
          sourceFileName: candidate.originalFileName,
          existingWorkingPaperId: active.workingPaperId,
          existingAttachmentId: active.attachmentId,
          existingWorkingPaperCode:
            active.workingPaper?.code ?? active.workingPaperCode ?? null,
          existingWorkingPaperTitle:
            active.workingPaper?.title ?? active.workingPaperTitle ?? null,
          existingWorkflowLocation:
            active.workingPaper?.workflowNode ?? active.workflowNode ?? null,
          existingLocation: active.workingPaper?.workflowNode
            ? [
                active.workingPaper.workflowNode.code,
                active.workingPaper.workflowNode.title,
              ]
                .filter(Boolean)
                .join(" ")
            : active.workflowNode
              ? [active.workflowNode.code, active.workflowNode.title]
                  .filter(Boolean)
                  .join(" ")
              : null,
        });
        const result = skipped[skipped.length - 1]!;
        if (result.targetState === "AVAILABLE" && active.attachment) {
          try {
            const metadata = await this.storage.getObjectMetadata(
              active.attachment.fileUrl
            );
            if (
              metadata.contentSha256 &&
              metadata.contentSha256 !== active.attachment.contentHash
            )
              result.targetState = "CHANGED";
          } catch (error) {
            const failure = error as { code?: string; status?: number };
            result.targetState =
              failure.code === "ENOENT" ||
              failure.code === "NoSuchKey" ||
              failure.status === 404
                ? "MISSING"
                : "UNVERIFIED";
          }
        }
        continue;
      }
      const paperCode = nextPaperCode(
        targetNode?.code ?? "EMP",
        [...existingPapers, ...[...usedCodes].map((code) => ({ code }))],
        usedCodes
      );
      const businessName = defaultBusinessName(candidate);
      sources.push({
        ...candidate,
        reimportTargetDirectoryId: active?.attachment?.deletedAt
          ? active.job?.targetWorkflowNodeId
          : undefined,
        paperCode,
        proposedCode: null,
        businessName,
        packageSequence: input.mode === "ZIP" ? 0 : null,
        zipEntryName: null,
      });
    }
    if (input.mode === "ZIP") {
      const zipPaperCode = sources[0]?.paperCode ?? null;
      const sequenceByConfirmation = new Map<string, number>();
      let packageSequence = 0;
      for (const [sourceIndex, source] of sources.entries()) {
        source.paperCode = zipPaperCode ?? source.paperCode;
        if (!sequenceByConfirmation.has(source.confirmationId)) {
          packageSequence += 1;
          sequenceByConfirmation.set(source.confirmationId, packageSequence);
        }
        source.packageSequence = assertPresentValue(
          sequenceByConfirmation.get(source.confirmationId)
        );
        source.proposedCode = `${source.paperCode}.${formatNumberWithoutDigitFour(sourceIndex + 1, 2)}`;
        source.zipEntryName = `${source.proposedCode}-${source.businessName}`;
      }
    }
    return {
      projectId,
      targetWorkflowNodeId: input.targetWorkflowNodeId,
      mode: input.mode,
      sources,
      skipped,
      issues,
      fingerprint: fingerprint({
        projectId,
        targetWorkflowNodeId: input.targetWorkflowNodeId,
        mode: input.mode,
        sources,
        skipped,
        issues,
      }),
    };
  }

  private async resolveOutgoingSource(
    confirmation: ConfirmationRecord,
    artifact: NonNullable<ConfirmationRecord["currentArtifact"]>
  ) {
    const uploadedSource = readUploadedSource(artifact.structuredSnapshot);
    const rawObjectKey = artifact.docxObjectKey;
    if (
      !rawObjectKey ||
      (!uploadedSource && artifact.templateCode !== "UPLOADED_DOCUMENT")
    ) {
      const source = {
        objectKey: artifact.pdfObjectKey,
        fileName: `${normalizeFileNamePart(confirmation.counterpartyName)}-Outgoing.pdf`,
        mimeType: "application/pdf",
        fileSize: artifact.pdfSize,
        sha256: artifact.pdfSha256,
      };
      await this.validateSourceMetadata(
        source.objectKey,
        source.fileSize,
        source.sha256
      );
      return source;
    }

    const fileName = normalizeSourceFileName(
      uploadedSource?.fileName ?? confirmation.attachmentName ?? rawObjectKey
    );
    const expectedSize =
      uploadedSource?.size ?? artifact.docxSize ?? artifact.pdfSize;
    const expectedSha = uploadedSource?.sha256?.trim() || null;
    const metadata = await this.validateSourceMetadata(
      rawObjectKey,
      expectedSize,
      expectedSha
    );
    const mimeType =
      uploadedSource?.mimeType?.trim() ||
      metadata?.contentType?.trim() ||
      mimeTypeFromFileName(fileName);
    const fileSize =
      metadata && Number.isFinite(metadata.contentLength)
        ? metadata.contentLength
        : expectedSize;
    const sha256 =
      uploadedSource?.sha256?.trim() ||
      metadata?.contentSha256?.trim() ||
      artifact.pdfSha256;
    return {
      objectKey: rawObjectKey,
      fileName,
      mimeType,
      fileSize: fileSize ?? expectedSize,
      sha256,
    };
  }

  private async validateSourceMetadata(
    objectKey: string,
    expectedSize: number,
    expectedSha256: string | null | undefined
  ): Promise<ObjectMetadata | undefined> {
    let metadata: ObjectMetadata | undefined;
    try {
      metadata = await this.storage.getObjectMetadata(objectKey);
    } catch {
      throw new ConfirmationEmpImportItemError(
        "SOURCE_OBJECT_UNAVAILABLE",
        "The confirmation source object is unavailable; repair it and retry."
      );
    }
    if (!metadata) {
      throw new ConfirmationEmpImportItemError(
        "SOURCE_OBJECT_UNAVAILABLE",
        "The confirmation source object is unavailable; repair it and retry."
      );
    }
    if (
      !Number.isFinite(metadata.contentLength) ||
      metadata.contentLength !== expectedSize
    ) {
      throw new ConfirmationEmpImportItemError(
        "FINGERPRINT_CHANGED",
        "The confirmation source fingerprint changed; refresh and retry."
      );
    }
    const actualSha256 = metadata.contentSha256?.trim();
    if (
      actualSha256 &&
      expectedSha256 &&
      actualSha256.toLowerCase() !== expectedSha256.toLowerCase()
    ) {
      throw new ConfirmationEmpImportItemError(
        "FINGERPRINT_CHANGED",
        "The confirmation source fingerprint changed; refresh and retry."
      );
    }
    return metadata;
  }

  async createJob(
    projectId: string,
    user: RequestUser,
    input: ConfirmationEmpImportCreateJobInput,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectAction(projectId, user.id, "modifyIndex");
    const existing = await this.prisma.confirmationEmpImportJob.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: EMP_IMPORT_JOB_RESPONSE_INCLUDE,
    });
    if (existing) {
      if (existing.projectId !== projectId) {
        throw new ApiConflictException(
          "CONFLICT_RISK",
          "The idempotency key is already in use by another project."
        );
      }
      return existing;
    }

    const selectedActiveLinkKeys = [...new Set(input.activeLinkKeys)];
    if (
      input.activeLinkKeys !== undefined &&
      selectedActiveLinkKeys.length === 0
    ) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "At least one physical confirmation source must be selected."
      );
    }
    const preview = await this.preview(projectId, user, {
      ...(input.confirmationIds === undefined
        ? {}
        : { confirmationIds: input.confirmationIds }),
      ...(input.activeLinkKeys === undefined
        ? {}
        : { activeLinkKeys: selectedActiveLinkKeys }),
      targetWorkflowNodeId: input.targetWorkflowNodeId,
      mode: input.mode,
    });
    if (preview.fingerprint !== input.previewFingerprint) {
      throw new ApiConflictException(
        "CONFLICT_RISK",
        "The confirmation preview is stale; refresh and retry."
      );
    }
    const selectedSourceKeySet = new Set(selectedActiveLinkKeys);
    const selectedSources =
      selectedActiveLinkKeys.length > 0
        ? preview.sources.filter((sourceRecord) =>
            selectedSourceKeySet.has(sourceRecord.activeLinkKey)
          )
        : preview.sources;
    if (
      selectedActiveLinkKeys.length > 0 &&
      !selectedActiveLinkKeys.every((key) =>
        preview.sources.some(
          (sourceRecord) => sourceRecord.activeLinkKey === key
        )
      )
    ) {
      throw new ApiConflictException(
        "CONFLICT_RISK",
        "The selected physical confirmation source changed; refresh and retry."
      );
    }
    const selectedConfirmationIds = new Set(
      selectedSources.map((sourceRecord) => sourceRecord.confirmationId)
    );
    const selectedIssues =
      selectedActiveLinkKeys.length > 0
        ? preview.issues.filter((issue) =>
            issue.sourceKey
              ? selectedSourceKeySet.has(issue.sourceKey)
              : issue.confirmationId
                ? selectedConfirmationIds.has(issue.confirmationId)
                : false
          )
        : preview.issues;
    if (selectedIssues.length > 0) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "The confirmation preview contains blocking issues."
      );
    }
    const sources = applySourceOverrides(
      selectedSources,
      input.sourceOverrides,
      input.mode
    );
    if (
      sources.some(
        (item) =>
          item.reimportTargetDirectoryId &&
          item.reimportTargetDirectoryId !== input.targetWorkflowNodeId
      )
    ) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "已删除的回函须重新导入原目标目录；如需换位置，请先撤回导入"
      );
    }
    const jobId = randomUUID();
    const now = new Date();
    let job: Awaited<
      ReturnType<PrismaService["confirmationEmpImportJob"]["create"]>
    >;
    try {
      job = await this.prisma.$transaction(async (tx) => {
        // Retire only deleted targets selected for this new import.
        await tx.confirmationEmpImportItem.updateMany({
          where: {
            activeLinkKey: { in: sources.map((item) => item.activeLinkKey) },
            status: "SUCCEEDED",
            withdrawnAt: null,
            attachment: { deletedAt: { not: null } },
          },
          data: { withdrawnAt: now, withdrawnBy: user.id },
        });
        return tx.confirmationEmpImportJob.create({
          data: {
            id: jobId,
            projectId,
            targetWorkflowNodeId: input.targetWorkflowNodeId,
            mode: input.mode,
            batchCode: input.batchCode?.trim() || null,
            batchTitle: input.batchTitle?.trim() || null,
            idempotencyKey: input.idempotencyKey,
            previewFingerprint: input.previewFingerprint,
            previewedAt: now,
            status: "QUEUED",
            createdBy: user.id,
            createdAt: now,
            updatedAt: now,
            items: {
              create: sources.map((sourceRecord) => ({
                id: randomUUID(),
                confirmationId: sourceRecord.confirmationId,
                sourceKind: sourceRecord.sourceKind,
                outgoingArtifactId:
                  sourceRecord.sourceKind === "OUTGOING_ARTIFACT"
                    ? sourceRecord.sourceArtifactId
                    : null,
                responseId: sourceRecord.responseId,
                responseArtifactId: sourceRecord.responseArtifactId,
                sourceObjectKey: sourceRecord.sourceObjectKey,
                sourceFileName: sourceRecord.originalFileName,
                sourceMimeType: sourceRecord.mimeType,
                sourceSize: sourceRecord.fileSize,
                sourceSha256: sourceRecord.sourceSha256,
                sourceConfirmationCode: sourceRecord.confirmationCode,
                sourceCounterpartyName: sourceRecord.counterpartyName,
                activeLinkKey: sourceRecord.activeLinkKey,
                status: "QUEUED",
                packageSequence: sourceRecord.packageSequence,
                zipEntryName: sourceRecord.zipEntryName,
                workingPaperCode: sourceRecord.paperCode,
                workingPaperTitle: sourceRecord.businessName,
                prepareUserId:
                  input.mode === "ZIP" ||
                  sourceRecord.sourceKind === "RESPONSE_ARTIFACT"
                    ? null
                    : sourceRecord.prepareUserId,
                preparedAt:
                  input.mode === "ZIP" ||
                  sourceRecord.sourceKind === "RESPONSE_ARTIFACT"
                    ? null
                    : sourceRecord.prepareAt,
                reviewUserId:
                  input.mode === "ZIP" ? null : sourceRecord.reviewUserId,
                reviewedAt: input.mode === "ZIP" ? null : sourceRecord.reviewAt,
                createdAt: now,
                updatedAt: now,
              })),
            },
          },
          include: EMP_IMPORT_JOB_RESPONSE_INCLUDE,
        });
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      const winner = await this.prisma.confirmationEmpImportJob.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: EMP_IMPORT_JOB_RESPONSE_INCLUDE,
      });
      if (!winner) {
        throw error;
      }
      return winner;
    }
    if (this.auditLogs.log) {
      await this.auditLogs.log({
        actorId: user.id,
        action: "CONFIRMATION_EMP_IMPORT_JOB_CREATED",
        targetType: "CONFIRMATION_EMP_IMPORT_JOB",
        targetId: job.id,
        projectId,
        description: `Created confirmation EMP import job ${job.id}`,
        source,
      });
    }
    void this.executeJob(job.id, projectId, user.id).catch(() => {});
    return job;
  }

  async getJob(projectId: string, user: RequestUser, jobId: string) {
    await this.access.requireProjectMember(projectId, user.id);
    const job = await this.prisma.confirmationEmpImportJob.findFirst({
      where: { id: jobId, projectId },
      include: EMP_IMPORT_JOB_RESPONSE_INCLUDE,
    });
    if (!job) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "The import job does not exist."
      );
    }
    this.triggerExecutionIfNeeded(job, projectId);
    return job;
  }

  async listJobs(projectId: string, user: RequestUser, limit?: number) {
    await this.access.requireProjectMember(projectId, user.id);
    const jobs = await this.prisma.confirmationEmpImportJob.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      ...(limit && limit > 0 ? { take: Math.min(Math.floor(limit), 100) } : {}),
      include: {
        items: { include: { empWorkflowNode: true } },
      },
    });
    return jobs.map(mapJobToSharedContract);
  }

  async getJobProgress(projectId: string, user: RequestUser, jobId: string) {
    await this.access.requireProjectMember(projectId, user.id);
    const job = await this.prisma.confirmationEmpImportJob.findFirst({
      where: { id: jobId, projectId },
      include: {
        items: { include: { empWorkflowNode: true } },
      },
    });
    if (!job) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "The import job does not exist."
      );
    }
    this.triggerExecutionIfNeeded(job, projectId);
    return mapJobToSharedContract(job);
  }

  async executeJob(jobId: string, projectId: string, actorId: string) {
    const job = await this.prisma.confirmationEmpImportJob.findUnique({
      where: { id: jobId },
      include: {
        items: true,
        targetWorkflowNode: true,
        batchWorkflowNode: true,
      },
    });
    if (!job || job.projectId !== projectId) {
      return null;
    }
    if (
      !["QUEUED", "FAILED", "PARTIAL_FAILURE"].includes(job.status) &&
      !(job.status === "RUNNING" && isStaleRunningJob(job))
    ) {
      return job;
    }
    try {
      await this.access.requireProjectAction(projectId, actorId, "modifyIndex");
    } catch (error) {
      return this.failJobBeforeClaim(
        job,
        jobId,
        "PERMISSION_DENIED",
        error instanceof Error ? error.message : String(error)
      );
    }
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    });
    if (!project || project.status !== "ACTIVE") {
      return this.failJobBeforeClaim(
        job,
        jobId,
        "PROJECT_NOT_MUTABLE",
        "PROJECT_NOT_MUTABLE"
      );
    }
    const claim = await this.prisma.confirmationEmpImportJob.updateMany({
      where: {
        id: jobId,
        projectId,
        OR: [
          { status: { in: ["QUEUED", "FAILED", "PARTIAL_FAILURE"] } },
          {
            status: "RUNNING",
            OR: [
              { startedAt: null },
              { startedAt: { lte: staleRunningBefore() } },
            ],
          },
        ],
      },
      data: { status: "RUNNING", startedAt: new Date(), lastError: null },
    });
    if (!claim.count) {
      return job;
    }

    try {
      let { targetWorkflowNodeId } = job;
      const sourceMap = job.previewFingerprint
        ? await this.refreshExecutionSources(job, actorId)
        : null;
      const pendingItems = (job.items ?? []).filter(
        (item: { status: string }) => item.status !== "SUCCEEDED"
      );
      const groupedPreflightFailures = new Map<string, unknown>();
      let groupedRunnableItems = pendingItems;
      if (job.mode === "GROUPED" && pendingItems.length > 0) {
        const preflightNodeId =
          job.batchWorkflowNodeId ?? job.targetWorkflowNodeId;
        for (const item of pendingItems) {
          try {
            await this.validateExecutionItem(
              job,
              item,
              preflightNodeId,
              sourceMap,
              { checkCode: false }
            );
            await this.readAndVerifySourceBuffer(item);
          } catch (error) {
            groupedPreflightFailures.set(item.id, error);
          }
        }
        groupedRunnableItems = pendingItems.filter(
          (item: { id: string }) => !groupedPreflightFailures.has(item.id)
        );
        if (groupedRunnableItems.length > 0) {
          targetWorkflowNodeId = await this.ensureGroupedNode(job, actorId);
        }
        for (const item of pendingItems) {
          const error = groupedPreflightFailures.get(item.id);
          if (error) {
            await this.failImportItem(job, item, actorId, error);
          }
        }
      }
      if (job.mode === "ZIP") {
        const hasExistingSuccess = (job.items ?? []).some(
          (item: { status: string }) => item.status === "SUCCEEDED"
        );
        if (pendingItems.length > 0 && hasExistingSuccess) {
          await this.failZipItems(
            job,
            pendingItems,
            actorId,
            new ConfirmationEmpImportItemError(
              "ZIP_PARTIAL_STATE",
              "The ZIP job already has a partial target; retry cannot create a second archive."
            )
          );
        } else {
          let validationFailed = false;
          if (pendingItems.length > 0) {
            await this.ensureAvailableZipWorkingPaperCode(
              job,
              pendingItems,
              targetWorkflowNodeId
            );
          }
          for (const item of pendingItems) {
            try {
              await this.validateExecutionItem(
                job,
                item,
                targetWorkflowNodeId,
                sourceMap
              );
            } catch {
              validationFailed = true;
            }
          }
          await (validationFailed
            ? this.failZipItems(
                job,
                pendingItems,
                actorId,
                new ConfirmationEmpImportItemError(
                  "ZIP_VALIDATION_FAILED",
                  "A ZIP source failed validation; retry the whole package."
                )
              )
            : this.executeZipItems(
                job,
                targetWorkflowNodeId,
                actorId,
                pendingItems
              ));
        }
      } else if (job.mode === "GROUPED") {
        for (const item of groupedRunnableItems) {
          await this.executeFlatItem(
            job,
            item,
            targetWorkflowNodeId,
            actorId,
            sourceMap
          );
        }
      } else {
        for (const item of pendingItems) {
          await this.executeFlatItem(
            job,
            item,
            targetWorkflowNodeId,
            actorId,
            sourceMap
          );
        }
      }
      if (
        job.mode === "GROUPED" &&
        pendingItems.length > 0 &&
        pendingItems.every(
          (item: { status: string }) => item.status === "FAILED"
        )
      ) {
        await this.cleanupEmptyGroupedNode(job, pendingItems);
      }
      const hasFailures = (job.items ?? []).some(
        (item: { status: string }) => item.status === "FAILED"
      );
      const hasSuccesses = (job.items ?? []).some(
        (item: { status: string }) => item.status === "SUCCEEDED"
      );
      const hasUnfinished = (job.items ?? []).some(
        (item: { status: string }) =>
          item.status !== "SUCCEEDED" && item.status !== "FAILED"
      );
      const status = hasFailures
        ? hasSuccesses
          ? "PARTIAL_FAILURE"
          : "FAILED"
        : hasUnfinished
          ? hasSuccesses
            ? "PARTIAL_FAILURE"
            : "FAILED"
          : "COMPLETED";
      return await this.prisma.confirmationEmpImportJob.update({
        where: { id: job.id },
        data: { status, completedAt: new Date() },
        include: { items: true },
      });
    } catch (error) {
      const message = importItemErrorMessage(error);
      await this.prisma.confirmationEmpImportItem
        .updateMany({
          where: { jobId, status: { not: "SUCCEEDED" } },
          data: {
            status: "FAILED",
            errorCode: isUniqueViolation(error)
              ? "DUPLICATE_CODE"
              : "IMPORT_FAILED",
            errorMessage: message,
          },
        })
        .catch(() => {});
      return this.prisma.confirmationEmpImportJob.update({
        where: { id: job.id },
        data: {
          status: (job.items ?? []).some(
            (item: { status: string }) => item.status === "SUCCEEDED"
          )
            ? "PARTIAL_FAILURE"
            : "FAILED",
          lastError: message,
          completedAt: new Date(),
        },
        include: { items: true },
      });
    }
  }

  async retryJob(
    projectId: string,
    user: RequestUser,
    jobId: string,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectAction(projectId, user.id, "modifyIndex");
    const job = await this.prisma.confirmationEmpImportJob.findFirst({
      where: { id: jobId, projectId },
      include: { items: true },
    });
    if (!job) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "The import job does not exist."
      );
    }
    if (job.status !== "FAILED" && job.status !== "PARTIAL_FAILURE") {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Only failed confirmation EMP imports can be retried."
      );
    }
    if (job.mode === "ZIP") {
      const cleanupPending = (job.items ?? []).some(
        (item: EmpImportItem) => item.errorCode === "ZIP_CLEANUP_PENDING"
      );
      let residual: ZipResidual | null = null;
      try {
        residual = this.readZipResidual(job);
      } catch (error) {
        throw new ApiConflictException(
          "CONFLICT_RISK",
          importItemErrorMessage(error)
        );
      }
      if (cleanupPending && !residual) {
        throw new ApiConflictException(
          "CONFLICT_RISK",
          "ZIP cleanup is pending but its durable target record is incomplete."
        );
      }
      if (cleanupPending && residual) {
        const cleaned = await this.cleanupZipResidual(job, residual);
        if (!cleaned) {
          await this.markZipCleanupPending(job.items ?? []);
          throw new ApiConflictException(
            "CONFLICT_RISK",
            "ZIP cleanup is pending; retry is blocked until the previous target is removed."
          );
        }
      }
    }
    await this.prisma.confirmationEmpImportItem.updateMany({
      where: { jobId, status: "FAILED" },
      data: { status: "QUEUED", errorCode: null, errorMessage: null },
    });
    const reset = await this.prisma.confirmationEmpImportJob.update({
      where: { id: jobId },
      data: { status: "QUEUED", lastError: null, completedAt: null },
      include: { items: true },
    });
    await this.logImportAction({
      actorId: user.id,
      projectId,
      targetId: jobId,
      action: "CONFIRMATION_EMP_IMPORT_JOB_RETRY",
      targetType: "CONFIRMATION_EMP_IMPORT_JOB",
      description: `Retried confirmation EMP import job ${jobId}`,
      source,
    });
    void this.executeJob(jobId, projectId, user.id).catch(() => {});
    return reset;
  }

  private triggerExecutionIfNeeded(job: EmpImportJob, projectId: string) {
    if (
      !job?.createdBy ||
      (job.status !== "QUEUED" && !isStaleRunningJob(job))
    ) {
      return;
    }
    void this.executeJob(job.id, projectId, job.createdBy).catch(() => {});
  }

  private async failJobBeforeClaim(
    job: EmpImportJob,
    jobId: string,
    errorCode: string,
    errorMessage: string
  ) {
    const safeMessage = publicImportErrorMessage(errorCode, errorMessage);
    await this.prisma.confirmationEmpImportItem.updateMany({
      where: { jobId, status: { not: "SUCCEEDED" } },
      data: {
        status: "FAILED",
        errorCode,
        errorMessage: safeMessage,
      },
    });
    return this.prisma.confirmationEmpImportJob.update({
      where: { id: jobId },
      data: {
        status: (job.items ?? []).some(
          (item: { status: string }) => item.status === "SUCCEEDED"
        )
          ? "PARTIAL_FAILURE"
          : "FAILED",
        lastError: safeMessage,
        completedAt: new Date(),
      },
      include: EMP_IMPORT_JOB_RESPONSE_INCLUDE,
    });
  }

  private async refreshExecutionSources(job: EmpImportJob, actorId: string) {
    const activeLinkKeys = [
      ...new Set<string>(
        (job.items ?? [])
          .filter((item: { status: string }) => item.status !== "SUCCEEDED")
          .map((item: { activeLinkKey?: string }) => item.activeLinkKey)
          .filter(
            (key: unknown): key is string =>
              typeof key === "string" && key.length > 0
          )
      ),
    ];
    if (activeLinkKeys.length === 0) {
      return new Map<string, ConfirmationEmpImportPreviewSource>();
    }
    const preview = await this.preview(
      job.projectId,
      { id: actorId } as RequestUser,
      {
        activeLinkKeys,
        targetWorkflowNodeId: job.targetWorkflowNodeId,
        mode: job.mode,
      }
    );
    return new Map(
      preview.sources.map((source) => [source.activeLinkKey, source] as const)
    );
  }

  private async validateExecutionItem(
    job: EmpImportJob,
    item: EmpImportItem,
    workflowNodeId: string,
    sourceMap: Map<string, ConfirmationEmpImportPreviewSource> | null,
    options: { checkCode?: boolean } = {}
  ) {
    if (sourceMap) {
      const current = sourceMap.get(item.activeLinkKey);
      if (!current || !sameSourceSnapshot(item, current)) {
        throw new ConfirmationEmpImportItemError(
          "SOURCE_FINGERPRINT_CHANGED",
          "The confirmation source changed after preview; refresh and retry."
        );
      }
    }
    const targetNode = await this.prisma.workflowNode.findUnique({
      where: { id: workflowNodeId },
      select: { id: true, projectId: true },
    });
    if (!targetNode || targetNode.projectId !== job.projectId) {
      throw new ConfirmationEmpImportItemError(
        "TARGET_NOT_AVAILABLE",
        "The EMP target directory is no longer available; refresh and retry."
      );
    }
    if (options.checkCode !== false) {
      const existing = await this.prisma.workingPaper.findMany({
        where: {
          projectId: job.projectId,
          workflowNodeId,
          code: item.workingPaperCode ?? "",
        },
        select: { id: true, code: true },
      });
      if (
        (existing ?? []).some(
          (paper: { code?: string }) => paper.code === item.workingPaperCode
        )
      ) {
        throw new ConfirmationEmpImportItemError(
          "DUPLICATE_CODE",
          "The proposed EMP reference code is already in use; refresh and retry."
        );
      }
    }
    const active = await this.prisma.confirmationEmpImportItem.findMany({
      where: {
        activeLinkKey: item.activeLinkKey,
        withdrawnAt: null,
        status: "SUCCEEDED",
      },
      take: 1,
      select: { id: true, jobId: true },
    });
    if (active.some((row: { id: string }) => row.id !== item.id)) {
      throw new ConfirmationEmpImportItemError(
        "ACTIVE_IMPORT_LINK",
        "This confirmation source is already linked to an active EMP item."
      );
    }
  }

  private async readAndVerifySourceBuffer(item: EmpImportItem) {
    let body: Buffer;
    try {
      body = await this.storage.getObjectBuffer(item.sourceObjectKey);
    } catch {
      throw new ConfirmationEmpImportItemError(
        "SOURCE_OBJECT_UNAVAILABLE",
        "The confirmation source object is unavailable; repair it and retry."
      );
    }
    if (!Buffer.isBuffer(body)) {
      throw new ConfirmationEmpImportItemError(
        "SOURCE_OBJECT_UNAVAILABLE",
        "The confirmation source object is unavailable; repair it and retry."
      );
    }
    if (body.byteLength !== item.sourceSize) {
      throw new ConfirmationEmpImportItemError(
        "FINGERPRINT_CHANGED",
        "The confirmation source fingerprint changed; refresh and retry."
      );
    }
    const sourceSha256 = createHash("sha256").update(body).digest("hex");
    if (
      item.sourceSha256 &&
      sourceSha256.toLowerCase() !== String(item.sourceSha256).toLowerCase()
    ) {
      throw new ConfirmationEmpImportItemError(
        "FINGERPRINT_CHANGED",
        "The confirmation source fingerprint changed; refresh and retry."
      );
    }
    return body;
  }

  private async failImportItem(
    job: EmpImportJob,
    item: EmpImportItem,
    actorId: string,
    error: unknown
  ) {
    const code = importItemErrorCode(error);
    const message = importItemErrorMessage(error);
    await this.prisma.confirmationEmpImportItem.update({
      where: { id: item.id },
      data: {
        status: "FAILED",
        attemptCount: { increment: 1 },
        errorCode: code,
        errorMessage: message,
      },
    });
    item.status = "FAILED";
    await this.logImportAction({
      actorId,
      projectId: job.projectId,
      targetId: item.id,
      action: "CONFIRMATION_EMP_IMPORT_ITEM_FAILED",
      description: `Confirmation source import failed: ${message}`,
    });
  }

  private async failZipItems(
    job: EmpImportJob,
    pending: EmpImportItem[],
    actorId: string,
    error: unknown
  ) {
    for (const item of pending) {
      await this.failImportItem(job, item, actorId, error);
    }
  }

  private async executeFlatItem(
    job: EmpImportJob,
    item: EmpImportItem,
    workflowNodeId: string,
    actorId: string,
    sourceMap: Map<string, ConfirmationEmpImportPreviewSource> | null
  ) {
    await this.prisma.confirmationEmpImportItem.update({
      where: { id: item.id },
      data: {
        status: "RUNNING",
        attemptCount: { increment: 1 },
        errorCode: null,
        errorMessage: null,
      },
    });
    let paper: WorkingPaperRecord | null = null;
    let stored: { fileName: string; objectKey: string } | undefined;
    try {
      await this.ensureAvailableWorkingPaperCode(job, item, workflowNodeId);
      await this.validateExecutionItem(job, item, workflowNodeId, sourceMap);
      const sourceBody = await this.readAndVerifySourceBuffer(item);
      paper = await this.createWorkingPaperWithAutoRename(
        job,
        item,
        workflowNodeId,
        actorId
      );
      stored = await this.storage.putObject(
        job.projectId,
        paper.id,
        item.workingPaperTitle ?? "source",
        sourceBody,
        item.sourceMimeType
      );
      const target = await this.createAttachmentTarget({
        job,
        item,
        paper,
        stored,
        actorId,
      });
      if (target.signoffCount) {
        await this.logImportAction({
          actorId,
          projectId: job.projectId,
          targetId: item.id,
          action: "CONFIRMATION_EMP_IMPORT_AUTO_SIGNOFFS",
          description: `Created ${target.signoffCount} automatic EMP signoffs`,
        });
      }
      await this.prisma.confirmationEmpImportItem.update({
        where: { id: item.id },
        data: {
          status: "SUCCEEDED",
          empWorkflowNodeId: workflowNodeId,
          workingPaperId: paper.id,
          attachmentId: target.attachment.id,
          attachmentObjectKey: stored.objectKey,
          targetHeadVersionId: target.version.id,
          targetHeadHash: item.sourceSha256,
        },
      });
      item.status = "SUCCEEDED";
      item.workingPaperId = paper.id;
      item.attachmentId = target.attachment.id;
      if (
        item.sourceKind === "RESPONSE_ARTIFACT" &&
        item.confirmationId &&
        this.prisma.confirmationFollowUpEvent?.create
      ) {
        await this.prisma.confirmationFollowUpEvent.create({
          data: {
            confirmationId: item.confirmationId,
            eventType: "PROGRAM_COMPLETED",
            actorId,
            source: "PROJECT_TEAM_MANUAL",
            notes: `回函已归档至 ${job.targetWorkflowNode?.code ?? workflowNodeId}/${paper.code ?? item.workingPaperCode}/${paper.title ?? item.workingPaperTitle}`,
            payload: {
              operation: "RESPONSE_ARCHIVED_TO_EMP",
              responseId: item.responseId,
              responseArtifactId: item.responseArtifactId,
              importJobId: job.id,
              workflowNodeId,
              workflowNodeCode: job.targetWorkflowNode?.code ?? null,
              workflowNodeTitle: job.targetWorkflowNode?.title ?? null,
              workingPaperId: paper.id,
              workingPaperCode: paper.code ?? item.workingPaperCode,
              workingPaperTitle: paper.title ?? item.workingPaperTitle,
              attachmentId: target.attachment.id,
              fileName: stored.fileName,
              objectKey: stored.objectKey,
            },
            occurredAt: new Date(),
          },
        });
      }
      await this.logImportAction({
        actorId,
        projectId: job.projectId,
        targetId: item.id,
        action: "CONFIRMATION_EMP_IMPORT_ITEM_SUCCEEDED",
        description: `Imported confirmation source ${item.activeLinkKey}`,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (stored) {
        await this.storage.deleteObject(stored.objectKey).catch(() => {});
      }
      if (paper?.id && this.prisma.workingPaper.delete) {
        await this.prisma.workingPaper
          .delete({
            where: { id: paper.id },
          })
          .catch(() => {});
      }
      await this.prisma.confirmationEmpImportItem.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          errorCode: importItemErrorCode(error),
          errorMessage: importItemErrorMessage(error),
        },
      });
      item.status = "FAILED";
      await this.logImportAction({
        actorId,
        projectId: job.projectId,
        targetId: item.id,
        action: "CONFIRMATION_EMP_IMPORT_ITEM_FAILED",
        description: `Confirmation source import failed: ${message}`,
      });
      return false;
    }
  }

  private async ensureAvailableWorkingPaperCode(
    job: EmpImportJob,
    item: EmpImportItem,
    workflowNodeId: string,
    options: { forceRename?: boolean } = {}
  ) {
    const requestedCode = String(item.workingPaperCode ?? "").trim();
    if (!requestedCode) {
      throw new ConfirmationEmpImportItemError(
        "BAD_REQUEST",
        "The EMP reference code is required."
      );
    }
    const existing = await this.prisma.workingPaper.findMany({
      where: { projectId: job.projectId, workflowNodeId },
      select: { code: true },
    });
    const usedCodes = new Set(
      (existing ?? []).map((paper: { code?: string }) =>
        String(paper.code ?? "").toLocaleLowerCase()
      )
    );
    if (options.forceRename) {
      usedCodes.add(requestedCode.toLocaleLowerCase());
    }
    if (!usedCodes.has(requestedCode.toLocaleLowerCase())) {
      return requestedCode;
    }

    let suffix = 2;
    let resolvedCode = `${requestedCode}-${suffix}`;
    while (usedCodes.has(resolvedCode.toLocaleLowerCase())) {
      suffix += 1;
      resolvedCode = `${requestedCode}-${suffix}`;
    }
    await this.prisma.confirmationEmpImportItem.update({
      where: { id: item.id },
      data: { workingPaperCode: resolvedCode },
    });
    item.workingPaperCode = resolvedCode;
    return resolvedCode;
  }

  private async createWorkingPaperWithAutoRename(
    job: EmpImportJob,
    item: EmpImportItem,
    workflowNodeId: string,
    actorId: string
  ) {
    const prepareUserId =
      item.sourceKind === "RESPONSE_ARTIFACT" ? null : item.prepareUserId;
    const preparedAt =
      item.sourceKind === "RESPONSE_ARTIFACT" ? null : item.preparedAt;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        return await this.prisma.workingPaper.create({
          data: {
            projectId: job.projectId,
            workflowNodeId,
            code: item.workingPaperCode ?? "",
            title: item.workingPaperTitle ?? "source",
            paperType: "WORKING_PAPER",
            bucket: "CURRENT",
            preparerId: prepareUserId,
            reviewerId:
              item.reviewUserId && item.reviewUserId !== prepareUserId
                ? item.reviewUserId
                : null,
            preparedAt: prepareUserId ? preparedAt : null,
            reviewedAt:
              item.reviewUserId && item.reviewUserId !== prepareUserId
                ? item.reviewedAt
                : null,
            createdBy: actorId,
          },
        });
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === 9) {
          throw error;
        }
        await this.ensureAvailableWorkingPaperCode(job, item, workflowNodeId, {
          forceRename: true,
        });
      }
    }
    throw new Error("Working paper code allocation failed");
  }

  private async ensureAvailableZipWorkingPaperCode(
    job: EmpImportJob,
    items: EmpImportItem[],
    workflowNodeId: string
  ) {
    const [firstItem] = items;
    if (!firstItem) {
      return;
    }
    const resolvedCode = await this.ensureAvailableWorkingPaperCode(
      job,
      firstItem,
      workflowNodeId
    );
    const remainingItems = items.slice(1);
    if (remainingItems.length > 0) {
      await this.prisma.confirmationEmpImportItem.updateMany({
        where: { id: { in: remainingItems.map((item) => item.id) } },
        data: { workingPaperCode: resolvedCode },
      });
      for (const item of remainingItems) {
        item.workingPaperCode = resolvedCode;
      }
    }
    if (job.batchCode !== resolvedCode) {
      await this.prisma.confirmationEmpImportJob.update({
        where: { id: job.id },
        data: { batchCode: resolvedCode },
      });
      job.batchCode = resolvedCode;
    }
  }

  private async createAttachmentTarget(input: {
    job: EmpImportJob;
    item: EmpImportItem;
    paper: WorkingPaperRecord;
    stored: { fileName: string; objectKey: string };
    actorId: string;
  }) {
    await Promise.resolve();
    return this.prisma.$transaction((tx) =>
      this.createAttachmentTargetInTransaction(tx, input)
    );
  }

  private async createAttachmentTargetInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      job: EmpImportJob;
      item: EmpImportItem;
      paper: WorkingPaperRecord;
      stored: { fileName: string; objectKey: string };
      actorId: string;
    }
  ) {
    const now = new Date();
    const prepareUserId =
      input.item.sourceKind === "RESPONSE_ARTIFACT"
        ? null
        : input.item.prepareUserId;
    const preparedAt =
      input.item.sourceKind === "RESPONSE_ARTIFACT"
        ? null
        : input.item.preparedAt;
    const attachment = await tx.attachment.create({
      data: {
        projectId: input.job.projectId,
        workingPaperId: input.paper.id,
        workflowNodeId: input.paper.workflowNodeId,
        bucket: "CURRENT",
        code: input.item.workingPaperCode,
        title: input.item.workingPaperTitle,
        preparerId: prepareUserId,
        reviewerId:
          input.item.reviewUserId && input.item.reviewUserId !== prepareUserId
            ? input.item.reviewUserId
            : null,
        preparedAt: prepareUserId ? preparedAt : null,
        reviewedAt:
          input.item.reviewUserId && input.item.reviewUserId !== prepareUserId
            ? input.item.reviewedAt
            : null,
        fileKind: "SUPPORTING",
        fileName: input.stored.fileName,
        originalName: input.item.workingPaperTitle,
        fileUrl: input.stored.objectKey,
        fileSize: input.item.sourceSize,
        mimeType: input.item.sourceMimeType,
        sortOrder: 0,
        version: 1,
        contentHash: input.item.sourceSha256,
        uploadedBy: input.actorId,
        lastModifiedBy: input.actorId,
        lastModifiedAt: now,
      },
    });
    const version = await tx.attachmentVersion.create({
      data: {
        attachmentId: attachment.id,
        projectId: input.job.projectId,
        version: 1,
        parentVersionId: null,
        sourceVersionId: null,
        fileKind: "SUPPORTING",
        fileName: input.stored.fileName,
        originalName: input.item.workingPaperTitle,
        fileUrl: input.stored.objectKey,
        fileSize: input.item.sourceSize,
        mimeType: input.item.sourceMimeType,
        contentHash: input.item.sourceSha256,
        uploadedBy: input.actorId,
        uploadedAt: now,
        archivedBy: input.actorId,
        action: "UPLOAD",
        isCurrent: true,
      },
    });
    const updatedAttachment = await tx.attachment.update({
      where: { id: attachment.id },
      data: { headVersionId: version.id },
    });
    type SignoffInput = {
      workingPaperId: string;
      attachmentId: string;
      userId: string;
      type: WorkingPaperSignoffType;
      signedAt: Date;
    };
    const signoffs: SignoffInput[] = [];
    if (prepareUserId) {
      signoffs.push({
        workingPaperId: input.paper.id,
        attachmentId: attachment.id,
        userId: prepareUserId,
        type: "PREPARER",
        signedAt: preparedAt ?? now,
      });
    }
    if (input.item.reviewUserId && input.item.reviewUserId !== prepareUserId) {
      signoffs.push({
        workingPaperId: input.paper.id,
        attachmentId: attachment.id,
        userId: input.item.reviewUserId,
        type: "REVIEWER",
        signedAt: input.item.reviewedAt ?? now,
      });
    }
    if (signoffs.length > 0) {
      await tx.workingPaperSignoff.createMany({ data: signoffs });
    }
    return {
      attachment: updatedAttachment,
      version,
      signoffCount: signoffs.length,
    };
  }

  private async ensureGroupedNode(job: EmpImportJob, actorId: string) {
    if (job.batchWorkflowNodeId) {
      return job.batchWorkflowNodeId;
    }
    const target =
      job.targetWorkflowNode ??
      (await this.prisma.workflowNode.findUnique({
        where: { id: job.targetWorkflowNodeId },
      }));
    if (!target) {
      throw new Error("GROUPED_TARGET_CANNOT_HAVE_CHILD");
    }
    const children = await this.prisma.workflowNode.findMany({
      where: { projectId: job.projectId, parentId: target.id },
      select: { sortOrder: true, code: true },
    });
    const requestedCode =
      job.batchCode ?? `IMPORT-${new Date().toISOString().slice(0, 10)}`;
    const usedCodes = new Set(
      children.map((child: { code?: string }) =>
        String(child.code ?? "").toLocaleLowerCase()
      )
    );
    let resolvedCode = requestedCode;
    let suffix = 2;
    while (usedCodes.has(resolvedCode.toLocaleLowerCase())) {
      resolvedCode = `${requestedCode}-${suffix}`;
      suffix += 1;
    }
    const nodeType: WorkflowNodeType =
      target.level + 1 === 1
        ? "PHASE"
        : target.level + 1 === 2
          ? "ACCOUNT"
          : "WORKING_PAPER";
    const nodeInput = {
      projectId: job.projectId,
      parentId: target.id,
      level: target.level + 1,
      code: resolvedCode,
      title: job.batchTitle ?? "Confirmation responses import",
      nodeType,
      sortOrder:
        Math.max(
          0,
          ...children.map(
            (child: { sortOrder: number | null }) => child.sortOrder ?? 0
          )
        ) + 1,
      createdBy: actorId,
    };
    let node: Awaited<ReturnType<PrismaService["workflowNode"]["create"]>>;
    for (;;) {
      try {
        node = await this.prisma.workflowNode.create({
          data: { ...nodeInput, code: resolvedCode },
        });
        break;
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
        resolvedCode = `${requestedCode}-${suffix}`;
        suffix += 1;
      }
    }
    const createdCode = String(node.code ?? resolvedCode);
    if (createdCode !== requestedCode) {
      for (const [index, item] of (job.items ?? []).entries()) {
        const currentCode = String(item.workingPaperCode ?? "");
        const expectedGeneratedCode = `${requestedCode}.${formatNumberWithoutDigitFour(index + 1, 2)}`;
        if (
          currentCode.toLocaleLowerCase() !==
          expectedGeneratedCode.toLocaleLowerCase()
        ) {
          continue;
        }
        const renamedCode = `${createdCode}.${formatNumberWithoutDigitFour(index + 1, 2)}`;
        await this.prisma.confirmationEmpImportItem.update({
          where: { id: item.id },
          data: { workingPaperCode: renamedCode },
        });
        item.workingPaperCode = renamedCode;
      }
    }
    await this.prisma.confirmationEmpImportJob.update({
      where: { id: job.id },
      data: { batchWorkflowNodeId: node.id, batchCode: createdCode },
    });
    job.batchWorkflowNodeId = node.id;
    return node.id;
  }

  private deterministicZipObjectKey(job: EmpImportJob) {
    return deterministicZipObjectKey(job.projectId, job.id);
  }

  private readZipResidual(job: EmpImportJob): ZipResidual | null {
    const items = Array.isArray(job.items) ? job.items : [];
    const pointerItems = items.filter((item: EmpImportItem) =>
      [
        item.workingPaperId,
        item.attachmentObjectKey,
        item.targetHeadHash,
        item.attachmentId,
        item.targetHeadVersionId,
      ].some((value) => value !== null && value !== undefined && value !== "")
    );
    if (pointerItems.length === 0) {
      return null;
    }

    const [first] = pointerItems;
    const allMatch = items.every(
      (item: EmpImportItem) =>
        item.workingPaperId === first.workingPaperId &&
        item.attachmentObjectKey === first.attachmentObjectKey &&
        item.targetHeadHash === first.targetHeadHash &&
        item.attachmentId === first.attachmentId &&
        item.targetHeadVersionId === first.targetHeadVersionId
    );
    const complete = Boolean(
      first.workingPaperId && first.attachmentObjectKey && first.targetHeadHash
    );
    const hasSuccess = items.some(
      (item: EmpImportItem) => item.status === "SUCCEEDED"
    );
    const allSuccess =
      items.length > 0 &&
      items.every((item: EmpImportItem) => item.status === "SUCCEEDED");
    if (!allMatch || !complete) {
      throw new ConfirmationEmpImportItemError(
        hasSuccess ? "ZIP_PARTIAL_STATE" : "ZIP_RESIDUAL_CORRUPT",
        hasSuccess
          ? "The ZIP job has a partial target and cannot create another archive."
          : "The ZIP job has inconsistent durable target pointers; repair it before retry."
      );
    }
    if (first.attachmentObjectKey !== this.deterministicZipObjectKey(job)) {
      throw new ConfirmationEmpImportItemError(
        "ZIP_RESIDUAL_CORRUPT",
        "The ZIP target key is not the deterministic key for this job."
      );
    }
    if (hasSuccess && !allSuccess) {
      throw new ConfirmationEmpImportItemError(
        "ZIP_PARTIAL_STATE",
        "The ZIP job has a partial target and cannot create another archive."
      );
    }
    return {
      workingPaperId: String(first.workingPaperId),
      attachmentObjectKey: String(first.attachmentObjectKey),
      targetHeadHash: String(first.targetHeadHash),
      attachmentId: first.attachmentId ? String(first.attachmentId) : null,
      targetHeadVersionId: first.targetHeadVersionId
        ? String(first.targetHeadVersionId)
        : null,
    };
  }

  private buildZipArchiveSources(pending: EmpImportItem[]) {
    return pending.map((item, index): ConfirmationEmpImportArchiveSource => ({
      internalSequence: item.packageSequence ?? index + 1,
      sourceConfirmationCode: item.sourceConfirmationCode ?? "",
      counterparty: item.sourceCounterpartyName ?? "Counterparty",
      role:
        item.sourceKind === "OUTGOING_ARTIFACT"
          ? "OUTGOING"
          : "RESPONSE_ORIGINAL",
      responseSequence:
        item.sourceKind === "RESPONSE_ARTIFACT"
          ? responseSequenceFromZipEntry(item.zipEntryName)
          : undefined,
      originalName: item.sourceFileName,
      size: item.sourceSize,
      checksum: item.sourceSha256,
      zipEntryName: item.zipEntryName ?? undefined,
      objectKey: item.sourceObjectKey,
    }));
  }

  private async stageZipTarget(
    job: EmpImportJob,
    workflowNodeId: string,
    actorId: string,
    pending: EmpImportItem[],
    archiveSha256: string
  ): Promise<{ residual: ZipResidual; paper: WorkingPaperRecord }> {
    const objectKey = this.deterministicZipObjectKey(job);
    const paperTitle = job.batchTitle ?? "Confirmation responses import";
    const itemIds = pending.map((item) => item.id);
    let staged: WorkingPaperRecord | null = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        staged = await this.prisma.$transaction(async (tx) => {
          const anchor = await tx.confirmationEmpImportItem.updateMany({
            where: {
              id: pending[0].id,
              jobId: job.id,
              status: "RUNNING",
              workingPaperId: null,
              attachmentObjectKey: null,
              attachmentId: null,
              targetHeadVersionId: null,
            },
            data: {
              attachmentObjectKey: objectKey,
              targetHeadHash: archiveSha256,
            },
          });
          if (!anchor.count) {
            return null;
          }
          const paper = await tx.workingPaper.create({
            data: {
              projectId: job.projectId,
              workflowNodeId,
              code: pending[0].workingPaperCode ?? "",
              title: paperTitle,
              paperType: "WORKING_PAPER",
              bucket: "CURRENT",
              createdBy: actorId,
            },
          });
          const linked = await tx.confirmationEmpImportItem.updateMany({
            where: {
              jobId: job.id,
              id: { in: itemIds },
              status: "RUNNING",
              attachmentId: null,
              targetHeadVersionId: null,
            },
            data: {
              workingPaperId: paper.id,
              attachmentObjectKey: objectKey,
              targetHeadHash: archiveSha256,
            },
          });
          if (linked.count !== itemIds.length) {
            throw new Error("ZIP_STAGE_CAS_FAILED");
          }
          return paper;
        });
        break;
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === 9) {
          throw error;
        }
        await this.ensureAvailableWorkingPaperCode(
          job,
          pending[0],
          workflowNodeId,
          { forceRename: true }
        );
        await this.ensureAvailableZipWorkingPaperCode(
          job,
          pending,
          workflowNodeId
        );
      }
    }
    if (staged) {
      const residual = {
        workingPaperId: String(staged.id),
        attachmentObjectKey: objectKey,
        targetHeadHash: archiveSha256,
        attachmentId: null,
        targetHeadVersionId: null,
      } satisfies ZipResidual;
      for (const item of pending) {
        item.workingPaperId = residual.workingPaperId;
        item.attachmentObjectKey = objectKey;
        item.targetHeadHash = archiveSha256;
      }
      return { residual, paper: staged };
    }

    const latest = await this.prisma.confirmationEmpImportJob.findUnique({
      where: { id: job.id },
      include: { items: true },
    });
    const residual = this.readZipResidual(latest ?? job);
    if (!residual) {
      throw new ConfirmationEmpImportItemError(
        "ZIP_STAGE_CAS_FAILED",
        "Another worker changed the ZIP target; refresh and retry."
      );
    }
    const paper = await this.prisma.workingPaper.findUnique({
      where: { id: residual.workingPaperId },
    });
    if (!paper) {
      throw new ConfirmationEmpImportItemError(
        "ZIP_RESIDUAL_CORRUPT",
        "The durable ZIP paper no longer exists."
      );
    }
    return { residual, paper };
  }

  private async putDeterministicZipObject(objectKey: string, body: Buffer) {
    const { putCacheObjectIfAbsent } = this.storage;
    try {
      await putCacheObjectIfAbsent.call(
        this.storage,
        objectKey,
        body,
        "application/zip"
      );
      return { created: true };
    } catch (error) {
      if (isStorageAlreadyExists(error)) {
        return { created: false };
      }
      throw error;
    }
  }

  private async ensureZipObject(
    job: EmpImportJob,
    paper: WorkingPaperRecord,
    pending: EmpImportItem[],
    residual: ZipResidual,
    generated: ConfirmationEmpImportArchiveResult | null
  ): Promise<ConfirmationEmpImportArchiveResult> {
    let existing: Buffer | null = null;
    try {
      const candidate = await this.storage.getObjectBuffer(
        residual.attachmentObjectKey
      );
      if (Buffer.isBuffer(candidate)) {
        existing = candidate;
      }
    } catch (error) {
      if (!isStorageNotFound(error)) {
        throw new ConfirmationEmpImportItemError(
          "ZIP_STORAGE_READ_FAILED",
          "The ZIP target could not be read; retry the import."
        );
      }
      existing = null;
    }
    if (existing) {
      const actualHash = createHash("sha256").update(existing).digest("hex");
      if (actualHash !== residual.targetHeadHash) {
        throw new ConfirmationEmpImportItemError(
          "ZIP_RESIDUAL_CORRUPT",
          "The durable ZIP object checksum does not match its target record."
        );
      }
      return {
        buffer: existing,
        sha256: actualHash,
        byteLength: existing.byteLength,
        entries: [],
        manifestCsv: "",
      };
    }
    const archiveResult =
      generated ??
      (await this.archive.createArchive(this.buildZipArchiveSources(pending)));
    if (archiveResult.sha256 !== residual.targetHeadHash) {
      throw new ConfirmationEmpImportItemError(
        "FINGERPRINT_CHANGED",
        "The ZIP source fingerprint changed while recovering its durable target."
      );
    }
    const write = await this.putDeterministicZipObject(
      residual.attachmentObjectKey,
      archiveResult.buffer
    );
    if (write.created) {
      return archiveResult;
    }
    let racedBody: Buffer;
    try {
      racedBody = await this.storage.getObjectBuffer(
        residual.attachmentObjectKey
      );
    } catch {
      throw new ConfirmationEmpImportItemError(
        "ZIP_STORAGE_READ_FAILED",
        "The ZIP target could not be read after a concurrent write; retry the import."
      );
    }
    if (!Buffer.isBuffer(racedBody)) {
      throw new ConfirmationEmpImportItemError(
        "ZIP_STORAGE_READ_FAILED",
        "The ZIP target could not be read after a concurrent write; retry the import."
      );
    }
    const racedHash = createHash("sha256").update(racedBody).digest("hex");
    if (racedHash !== residual.targetHeadHash) {
      throw new ConfirmationEmpImportItemError(
        "ZIP_RESIDUAL_CORRUPT",
        "A concurrent ZIP writer produced a different checksum for the durable target."
      );
    }
    return {
      ...archiveResult,
      buffer: racedBody,
      sha256: racedHash,
      byteLength: racedBody.byteLength,
    };
  }

  private async executeZipItems(
    job: EmpImportJob,
    workflowNodeId: string,
    actorId: string,
    pending: EmpImportItem[]
  ) {
    if (pending.length === 0) {
      return;
    }
    let archiveResult: ConfirmationEmpImportArchiveResult | null = null;
    let paper: WorkingPaperRecord | null = null;
    let residual: ZipResidual | null = null;
    try {
      if (pending.some((item) => item.errorCode === "ZIP_CLEANUP_PENDING")) {
        throw new ConfirmationEmpImportItemError(
          "ZIP_CLEANUP_PENDING",
          "ZIP cleanup is pending; remove the previous target before retrying."
        );
      }
      for (const item of pending) {
        await this.prisma.confirmationEmpImportItem.update({
          where: { id: item.id },
          data: { status: "RUNNING", attemptCount: { increment: 1 } },
        });
      }
      residual = this.readZipResidual(job);
      if (residual) {
        paper = await this.prisma.workingPaper.findUnique({
          where: { id: residual.workingPaperId },
        });
        if (!paper) {
          throw new ConfirmationEmpImportItemError(
            "ZIP_RESIDUAL_CORRUPT",
            "The durable ZIP paper no longer exists."
          );
        }
      } else {
        archiveResult = await this.archive.createArchive(
          this.buildZipArchiveSources(pending)
        );
        ({ residual, paper } = await this.stageZipTarget(
          job,
          workflowNodeId,
          actorId,
          pending,
          archiveResult.sha256
        ));
      }
      if (!residual) {
        throw new ConfirmationEmpImportItemError(
          "ZIP_RESIDUAL_CORRUPT",
          "The ZIP target was not durably staged."
        );
      }
      if (!paper) {
        throw new ConfirmationEmpImportItemError(
          "ZIP_RESIDUAL_CORRUPT",
          "The durable ZIP paper no longer exists."
        );
      }
      const durablePaper = paper;
      const durableResidual = residual;
      const finalizedArchiveResult = await this.ensureZipObject(
        job,
        durablePaper,
        pending,
        durableResidual,
        archiveResult
      );
      archiveResult = finalizedArchiveResult;
      const stored = {
        fileName: "confirmation-responses.zip",
        objectKey: durableResidual.attachmentObjectKey,
      };
      const target = await this.prisma.$transaction(async (tx) => {
        const finalClaim = await tx.confirmationEmpImportItem.updateMany({
          where: {
            jobId: job.id,
            id: { in: pending.map((item) => item.id) },
            status: "RUNNING",
            workingPaperId: durableResidual.workingPaperId,
            attachmentObjectKey: durableResidual.attachmentObjectKey,
            attachmentId: null,
            targetHeadVersionId: null,
          },
          data: { targetHeadHash: durableResidual.targetHeadHash },
        });
        if (finalClaim.count !== pending.length) {
          throw new ConfirmationEmpImportItemError(
            "ZIP_FINAL_CAS_FAILED",
            "Another worker changed the ZIP target; refresh and retry."
          );
        }
        const attachmentTarget = await this.createAttachmentTargetInTransaction(
          tx,
          {
            job,
            item: {
              ...pending[0],
              workingPaperCode: job.batchCode ?? pending[0].workingPaperCode,
              workingPaperTitle:
                job.batchTitle ?? "Confirmation responses import",
              sourceSize: finalizedArchiveResult.byteLength,
              sourceMimeType: "application/zip",
              sourceSha256: finalizedArchiveResult.sha256,
              prepareUserId: null,
              reviewUserId: null,
              preparedAt: null,
              reviewedAt: null,
            },
            paper: durablePaper,
            stored,
            actorId,
          }
        );
        const linked = await tx.confirmationEmpImportItem.updateMany({
          where: {
            jobId: job.id,
            id: { in: pending.map((item) => item.id) },
            status: "RUNNING",
            workingPaperId: durableResidual.workingPaperId,
            attachmentObjectKey: durableResidual.attachmentObjectKey,
            attachmentId: null,
            targetHeadVersionId: null,
          },
          data: {
            status: "SUCCEEDED",
            empWorkflowNodeId: workflowNodeId,
            workingPaperId: durablePaper.id,
            attachmentId: attachmentTarget.attachment.id,
            attachmentObjectKey: durableResidual.attachmentObjectKey,
            targetHeadVersionId: attachmentTarget.version.id,
            targetHeadHash: finalizedArchiveResult.sha256,
          },
        });
        if (linked.count !== pending.length) {
          throw new ConfirmationEmpImportItemError(
            "ZIP_FINAL_CAS_FAILED",
            "Another worker changed the ZIP target; refresh and retry."
          );
        }
        for (const item of pending) {
          if (item.sourceKind !== "RESPONSE_ARTIFACT" || !item.confirmationId)
            continue;
          await tx.confirmationFollowUpEvent.create({
            data: {
              confirmationId: item.confirmationId,
              eventType: "PROGRAM_COMPLETED",
              actorId,
              source: "PROJECT_TEAM_MANUAL",
              notes: `回函已归档至 ${job.targetWorkflowNode?.code ?? workflowNodeId}/${job.batchCode ?? item.workingPaperCode}/${item.zipEntryName ?? item.sourceFileName}`,
              payload: {
                operation: "RESPONSE_ARCHIVED_TO_EMP",
                mode: "ZIP",
                importJobId: job.id,
                importItemId: item.id,
                responseId: item.responseId,
                responseArtifactId: item.responseArtifactId,
                workflowNodeId,
                workingPaperId: durablePaper.id,
                attachmentId: attachmentTarget.attachment.id,
                fileName: item.sourceFileName,
              },
              occurredAt: new Date(),
            },
          });
        }
        return attachmentTarget;
      });
      for (const item of pending) {
        item.status = "SUCCEEDED";
        item.workingPaperId = paper.id;
        item.attachmentId = target.attachment.id;
        item.attachmentObjectKey = durableResidual.attachmentObjectKey;
        item.targetHeadVersionId = target.version.id;
        item.targetHeadHash = finalizedArchiveResult.sha256;
      }
    } catch (error) {
      let cleanupPending = false;
      let residualForCleanup = residual;
      if (!residualForCleanup) {
        try {
          residualForCleanup = this.readZipResidual(job);
        } catch {
          residualForCleanup = null;
        }
      }
      if (residualForCleanup && !isZipResidualBlockingError(error)) {
        cleanupPending = !(await this.cleanupZipResidual(
          job,
          residualForCleanup
        ));
      }
      const errorCode = cleanupPending
        ? "ZIP_CLEANUP_PENDING"
        : importItemErrorCode(error);
      const errorMessage = cleanupPending
        ? "ZIP target cleanup is pending; retry is blocked until storage and database cleanup complete."
        : importItemErrorMessage(error);
      for (const item of pending.filter(
        (candidate: { status: string }) => candidate.status !== "SUCCEEDED"
      )) {
        await this.prisma.confirmationEmpImportItem.update({
          where: { id: item.id },
          data: {
            status: "FAILED",
            errorCode,
            errorMessage,
          },
        });
        item.status = "FAILED";
      }
    }
  }

  private async cleanupZipResidual(
    job: EmpImportJob,
    residual: ZipResidual
  ): Promise<boolean> {
    const deleteIfPresent = this.storage.deleteObjectIfPresent;
    try {
      await deleteIfPresent.call(this.storage, residual.attachmentObjectKey);
      await this.prisma.$transaction(async (tx) => {
        await tx.workingPaperSignoff.deleteMany({
          where: { workingPaperId: residual.workingPaperId },
        });
        await tx.attachmentVersion.deleteMany({
          where: { attachment: { workingPaperId: residual.workingPaperId } },
        });
        await tx.attachment.deleteMany({
          where: { workingPaperId: residual.workingPaperId },
        });
        await tx.workingPaper.delete({
          where: { id: residual.workingPaperId },
        });
        const cleared = await tx.confirmationEmpImportItem.updateMany({
          where: {
            jobId: job.id,
            workingPaperId: residual.workingPaperId,
            attachmentObjectKey: residual.attachmentObjectKey,
          },
          data: {
            workingPaperId: null,
            attachmentObjectKey: null,
            targetHeadHash: null,
            attachmentId: null,
            targetHeadVersionId: null,
          },
        });
        if (!cleared.count) {
          throw new Error("ZIP_DB_CLEANUP_CAS_FAILED");
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  private async markZipCleanupPending(items: EmpImportItem[]) {
    for (const item of items.filter(
      (candidate) => candidate.status !== "SUCCEEDED"
    )) {
      await this.prisma.confirmationEmpImportItem.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          errorCode: "ZIP_CLEANUP_PENDING",
          errorMessage:
            "ZIP target cleanup is pending; retry is blocked until storage and database cleanup complete.",
        },
      });
      item.status = "FAILED";
      item.errorCode = "ZIP_CLEANUP_PENDING";
    }
  }

  private async cleanupEmptyGroupedNode(
    job: EmpImportJob,
    pending: EmpImportItem[]
  ) {
    const nodeId = job.batchWorkflowNodeId;
    if (!nodeId) {
      return;
    }
    const [paperCount, attachmentCount] = await Promise.all([
      this.prisma.workingPaper.count({
        where: { projectId: job.projectId, workflowNodeId: nodeId },
      }),
      this.prisma.attachment.count({
        where: { projectId: job.projectId, workflowNodeId: nodeId },
      }),
    ]);
    if ((paperCount ?? 0) > 0 || (attachmentCount ?? 0) > 0) {
      return;
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        const node = await tx.workflowNode.findUnique({
          where: { id: nodeId },
          select: { id: true, projectId: true, parentId: true },
        });
        if (
          !node ||
          node.projectId !== job.projectId ||
          node.parentId !== job.targetWorkflowNodeId
        ) {
          throw new Error("GROUPED_NODE_OWNERSHIP_CHANGED");
        }
        await tx.workflowNode.delete({ where: { id: nodeId } });
        const cleared = await tx.confirmationEmpImportJob.updateMany({
          where: { id: job.id, batchWorkflowNodeId: nodeId },
          data: { batchWorkflowNodeId: null },
        });
        if (!cleared.count) {
          throw new Error("GROUPED_NODE_CLEAR_CAS_FAILED");
        }
      });
      job.batchWorkflowNodeId = null;
    } catch {
      for (const item of pending.filter(
        (candidate: { status: string }) => candidate.status === "FAILED"
      )) {
        await this.prisma.confirmationEmpImportItem.update({
          where: { id: item.id },
          data: {
            errorCode: "GROUPED_EMPTY_NODE_CLEANUP_PENDING",
            errorMessage:
              "The empty grouped directory could not be safely removed; retry cleanup before creating another directory.",
          },
        });
        item.errorCode = "GROUPED_EMPTY_NODE_CLEANUP_PENDING";
      }
    }
  }

  private logImportAction(input: {
    actorId: string;
    projectId: string;
    targetId: string;
    action: string;
    targetType?: "CONFIRMATION_EMP_IMPORT_ITEM" | "CONFIRMATION_EMP_IMPORT_JOB";
    description: string;
    source?: AuditLogSource;
  }) {
    if (!this.auditLogs?.log) {
      return Promise.resolve();
    }
    return this.auditLogs.log({
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType ?? "CONFIRMATION_EMP_IMPORT_ITEM",
      targetId: input.targetId,
      projectId: input.projectId,
      description: input.description,
      source: input.source,
    });
  }
}

type CandidateSource = Omit<
  ConfirmationEmpImportPreviewSource,
  "paperCode" | "businessName" | "packageSequence" | "zipEntryName"
> & { responseSequence?: number };

type ConfirmationRecord = {
  id: string;
  projectId: string;
  status: string;
  differenceStatus: string | null;
  confirmationCode?: string | null;
  counterpartyName: string;
  createdBy?: string | null;
  attachmentName?: string | null;
  currentArtifact?: {
    id: string;
    disposition: string;
    templateCode?: string | null;
    docxObjectKey?: string | null;
    docxSize?: number | null;
    structuredSnapshot?: unknown;
    pdfObjectKey: string;
    pdfSize: number;
    pdfSha256: string;
    submittedAt?: Date | null;
  } | null;
  responses?: {
    id: string;
    routingStatus: string;
    receivedAt?: Date | null;
    createdAt?: Date | null;
    artifacts: {
      id: string;
      sequence?: number;
      objectKey: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
      sha256: string;
    }[];
  }[];
  followUpEvents?: {
    id?: string;
    eventType: string;
    actorId?: string | null;
    payload?: unknown;
    occurredAt: Date;
    createdAt?: Date;
  }[];
};

type ActiveImportItem = {
  id?: string;
  job?: {
    mode: ConfirmationEmpImportMode;
    batchTitle?: string | null;
    batchCode?: string | null;
    targetWorkflowNodeId?: string;
  };
  empWorkflowNodeId?: string | null;
  targetHeadHash?: string | null;
  attachment?: {
    deletedAt: Date | null;
    contentHash: string | null;
    fileUrl: string;
    title: string | null;
    code: string | null;
    workflowNodeId: string | null;
  } | null;
  activeLinkKey: string;
  jobId: string;
  workingPaperId?: string | null;
  attachmentId?: string | null;
  workingPaperCode?: string | null;
  workingPaperTitle?: string | null;
  workflowNode?: {
    id: string;
    code: string;
    title: string;
  } | null;
  workingPaper?: {
    id: string;
    code: string;
    title: string;
    workflowNode?: {
      id: string;
      code: string;
      title: string;
    } | null;
  } | null;
};

function responseDate(response: {
  receivedAt?: Date | null;
  createdAt?: Date | null;
}) {
  return response.receivedAt ?? response.createdAt ?? new Date(0);
}

function latestMatchedReview(
  events: {
    id?: string;
    eventType: string;
    actorId?: string | null;
    payload?: unknown;
    occurredAt: Date;
    createdAt?: Date;
  }[],
  responseId: string
) {
  const retractedEventIds = new Set<string>();
  for (const event of events) {
    if (event.eventType !== "REVIEW_RETRACTED") {
      continue;
    }
    const payload = isRecord(event.payload) ? event.payload : null;
    const targetEventId = payload?.targetEventId;
    if (typeof targetEventId === "string" && targetEventId.length > 0) {
      retractedEventIds.add(targetEventId);
    }
  }
  const candidates = events
    .filter((event) => {
      if (event.eventType !== "PROGRAM_COMPLETED" || !event.actorId) {
        return false;
      }
      if (event.id && retractedEventIds.has(event.id)) {
        return false;
      }
      const payload = isRecord(event.payload) ? event.payload : null;
      return (
        payload?.transition === "REVIEW" &&
        payload.result === "MATCHED" &&
        payload.responseId === responseId
      );
    })
    .sort(compareFollowUpEvents);
  const latest = candidates.at(-1);
  return {
    userId: latest?.actorId ?? null,
    occurredAt: latest?.occurredAt ?? null,
  };
}

function compareFollowUpEvents(
  left: { occurredAt: Date; createdAt?: Date; id?: string },
  right: { occurredAt: Date; createdAt?: Date; id?: string }
) {
  return (
    left.occurredAt.getTime() - right.occurredAt.getTime() ||
    (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0) ||
    compareText(left.id ?? "", right.id ?? "")
  );
}

function compareConfirmationRows(
  left: Pick<
    ConfirmationRecord,
    "confirmationCode" | "counterpartyName" | "id"
  >,
  right: Pick<
    ConfirmationRecord,
    "confirmationCode" | "counterpartyName" | "id"
  >
) {
  return (
    compareText(left.confirmationCode ?? "", right.confirmationCode ?? "") ||
    compareText(left.counterpartyName, right.counterpartyName) ||
    compareText(left.id, right.id)
  );
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readUploadedSource(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }
  const nested = isRecord(value.source) ? value.source : null;
  if (!nested && value.source !== "UPLOAD") {
    return null;
  }
  const source = nested ?? value;
  return {
    fileName: typeof source.fileName === "string" ? source.fileName : undefined,
    mimeType: typeof source.mimeType === "string" ? source.mimeType : undefined,
    sha256: typeof source.sha256 === "string" ? source.sha256 : undefined,
    size: typeof source.size === "number" ? source.size : undefined,
  };
}

function normalizeSourceFileName(value: string) {
  const baseName = value.split(/[\\/]/).pop()?.trim() ?? "";
  const normalized = baseName.replaceAll(/[\p{Cc}\u007F]/gu, "");
  return normalized || "source";
}

function mimeTypeFromFileName(fileName: string) {
  const extension = extensionForFileName(fileName);
  return (
    (
      {
        csv: "text/csv",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        json: "application/json",
        png: "image/png",
        pdf: "application/pdf",
        txt: "text/plain",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        zip: "application/zip",
      } as Record<string, string>
    )[extension] ?? "application/octet-stream"
  );
}

function extensionForFileName(fileName: string) {
  const baseName = normalizeSourceFileName(fileName);
  const dot = baseName.lastIndexOf(".");
  if (dot <= 0 || dot === baseName.length - 1) {
    return "bin";
  }
  const extension = baseName.slice(dot + 1).replaceAll(/[^A-Za-z0-9]/g, "");
  return extension.toLowerCase() || "bin";
}

function sameSourceSnapshot(
  item: EmpImportItem,
  source: ConfirmationEmpImportPreviewSource
) {
  const sourceArtifactId =
    source.sourceKind === "OUTGOING_ARTIFACT"
      ? item.outgoingArtifactId
      : item.responseArtifactId;
  return (
    item.activeLinkKey === source.activeLinkKey &&
    item.sourceKind === source.sourceKind &&
    sourceArtifactId === source.sourceArtifactId &&
    (item.responseId ?? null) === (source.responseId ?? null) &&
    item.sourceObjectKey === source.sourceObjectKey &&
    item.sourceFileName === source.originalFileName &&
    item.sourceMimeType === source.mimeType &&
    item.sourceSize === source.fileSize &&
    item.sourceSha256 === source.sourceSha256
  );
}

function confirmationIdFromActiveLinkKey(value: string) {
  const parts = value.split(":");
  if (
    (parts[0] === "OUTGOING_ARTIFACT" && parts.length >= 3) ||
    (parts[0] === "RESPONSE_ARTIFACT" && parts.length >= 4)
  ) {
    return parts[1] || null;
  }
  return null;
}

type ZipResidual = {
  workingPaperId: string;
  attachmentObjectKey: string;
  targetHeadHash: string;
  attachmentId: string | null;
  targetHeadVersionId: string | null;
};

function deterministicZipObjectKey(projectId: string, jobId: string) {
  const segment = (value: string) =>
    normalizeFileNamePart(value)
      .replaceAll(/[^A-Za-z0-9._-]/g, "_")
      .slice(0, 128) || "unnamed";
  return `working-papers/${segment(projectId)}/emp-import/${segment(jobId)}/confirmation-responses.zip`;
}

function isZipResidualBlockingError(error: unknown) {
  return (
    error instanceof ConfirmationEmpImportItemError &&
    [
      "ZIP_CLEANUP_PENDING",
      "ZIP_RESIDUAL_CORRUPT",
      "ZIP_PARTIAL_STATE",
      "ZIP_STAGE_CAS_FAILED",
      "ZIP_FINAL_CAS_FAILED",
    ].includes(error.code)
  );
}

function sourceObjectErrorCode(error: unknown) {
  if (error instanceof ConfirmationEmpImportItemError) {
    return error.code;
  }
  return "SOURCE_OBJECT_UNAVAILABLE";
}

function sourceObjectErrorMessage(error: unknown) {
  if (error instanceof ConfirmationEmpImportItemError) {
    return publicImportErrorMessage(error.code, error.message);
  }
  return "The confirmation source object is unavailable; repair it and retry.";
}

function importItemErrorCode(error: unknown) {
  if (error instanceof ConfirmationEmpImportItemError) {
    return error.code;
  }
  if (isUniqueViolation(error)) {
    return "DUPLICATE_CODE";
  }
  if (error instanceof Error && error.message === "ACTIVE_IMPORT_LINK") {
    return "ACTIVE_IMPORT_LINK";
  }
  return "IMPORT_FAILED";
}

function importItemErrorMessage(error: unknown) {
  if (error instanceof ConfirmationEmpImportItemError) {
    return publicImportErrorMessage(error.code, error.message);
  }
  if (isUniqueViolation(error)) {
    return "The proposed EMP reference code is already in use; refresh and retry.";
  }
  if (error instanceof Error && error.message === "ACTIVE_IMPORT_LINK") {
    return "This confirmation source is already linked to an active EMP item.";
  }
  return "The confirmation EMP import failed; repair the source and retry.";
}

function publicImportErrorMessage(errorCode: string, _internalMessage: string) {
  const messages: Record<string, string> = {
    SOURCE_OBJECT_UNAVAILABLE:
      "The confirmation source object is unavailable; repair it and retry.",
    FINGERPRINT_CHANGED: "The confirmation source changed; refresh and retry.",
    TARGET_NOT_AVAILABLE:
      "The EMP target directory is no longer available; refresh and retry.",
    ACTIVE_IMPORT_LINK:
      "This confirmation source is already linked to an active EMP item.",
    DUPLICATE_CODE:
      "The proposed EMP reference code is already in use; refresh and retry.",
    PERMISSION_DENIED: "You are not allowed to execute this import.",
    PROJECT_NOT_MUTABLE:
      "The project is not mutable; retry after it is active.",
    ZIP_CLEANUP_PENDING:
      "ZIP cleanup is pending; retry is blocked until the previous target is removed.",
    ZIP_RESIDUAL_CORRUPT:
      "The ZIP target is inconsistent; repair it before retrying.",
    ZIP_PARTIAL_STATE:
      "The ZIP job has a partial target and cannot create another archive.",
    ZIP_STAGE_CAS_FAILED:
      "Another worker changed the ZIP target; refresh and retry.",
    ZIP_FINAL_CAS_FAILED:
      "Another worker changed the ZIP target; refresh and retry.",
    ZIP_STORAGE_ATOMIC_UNAVAILABLE:
      "ZIP storage is not ready for an atomic retry; try again later.",
    ZIP_STORAGE_READ_FAILED:
      "The ZIP target could not be read; retry the import.",
    GROUPED_EMPTY_NODE_CLEANUP_PENDING:
      "The grouped directory cleanup is pending; retry cleanup before continuing.",
    GROUPED_TARGET_CONFLICT:
      "The grouped target is already owned by another import; refresh and retry.",
    IMPORT_FAILED:
      "The confirmation EMP import failed; repair the source and retry.",
  };
  return messages[errorCode] ?? messages.IMPORT_FAILED;
}

function responseSequenceFromZipEntry(value: string | null | undefined) {
  const match =
    typeof value === "string" ? value.match(/Response-(\d+)-/i) : null;
  const sequence = match ? Number(match[1]) : Number.NaN;
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : undefined;
}

const CONFIRMATION_EMP_IMPORT_STALE_AFTER_MS = 15 * 60 * 1000;

function staleRunningBefore(now = Date.now()) {
  return new Date(now - CONFIRMATION_EMP_IMPORT_STALE_AFTER_MS);
}

function isStaleRunningJob(job: { status?: string; startedAt?: Date | null }) {
  if (job.status !== "RUNNING") {
    return false;
  }
  if (!job.startedAt) {
    return true;
  }
  const startedAt =
    job.startedAt instanceof Date
      ? job.startedAt.getTime()
      : new Date(String(job.startedAt)).getTime();
  return Number.isNaN(startedAt) || startedAt <= staleRunningBefore().getTime();
}

function mapJobToSharedContract(job: EmpImportJob) {
  const rawItems = job.items ?? [];
  const items = rawItems.map((item: EmpImportItem) => {
    const withdrawn = Boolean(item.withdrawnAt);
    const status = withdrawn
      ? "WITHDRAWN"
      : item.status === "SUCCEEDED"
        ? "COMPLETED"
        : item.status;
    const workflowNode = item.empWorkflowNode ?? null;
    const targetLocation = workflowNode
      ? [workflowNode.code, workflowNode.title].filter(Boolean).join(" ")
      : null;
    return {
      id: String(item.id),
      sourceConfirmationId: item.confirmationId
        ? String(item.confirmationId)
        : undefined,
      confirmationId: String(item.confirmationId),
      sourceFileName: String(item.sourceFileName ?? "source"),
      status,
      targetLocation,
      targetCode: item.workingPaperCode ?? null,
      errorMessage: item.errorMessage ?? null,
      retryable: status === "FAILED",
    };
  });
  const completed = items.filter(
    (item: { status: string }) => item.status === "COMPLETED"
  ).length;
  const failed = items.filter(
    (item: { status: string }) => item.status === "FAILED"
  ).length;
  const allWithdrawn =
    items.length > 0 &&
    items.every((item: { status: string }) => item.status === "WITHDRAWN");
  const withdrawnDates = rawItems
    .map((item: EmpImportItem) => item.withdrawnAt)
    .filter(Boolean)
    .map((value: unknown) => toIso(value));
  return {
    id: String(job.id),
    projectId: String(job.projectId),
    mode: job.mode,
    status: allWithdrawn ? "WITHDRAWN" : job.status,
    total: items.length,
    completed,
    failed,
    retryable: failed > 0 && !allWithdrawn,
    previewFingerprint: String(job.previewFingerprint ?? "unknown"),
    createdAt: toIso(job.createdAt),
    updatedAt: toIso(job.updatedAt),
    withdrawnAt:
      job.withdrawnAt === null || job.withdrawnAt === undefined
        ? allWithdrawn && withdrawnDates.length > 0
          ? withdrawnDates.sort()[0]
          : null
        : toIso(job.withdrawnAt),
    items,
  };
}

function toIso(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value ?? 0));
  return Number.isNaN(date.getTime())
    ? new Date(0).toISOString()
    : date.toISOString();
}

function nextPaperCode(
  nodeCode: string,
  existingPapers: { code: string }[],
  usedCodes: Set<string>
) {
  let code = buildNextWorkingPaperCode(nodeCode, existingPapers);
  while (usedCodes.has(code)) {
    code = buildNextWorkingPaperCode(nodeCode, [...existingPapers, { code }]);
  }
  usedCodes.add(code);
  return code;
}

function defaultBusinessName(source: CandidateSource) {
  const counterpartyName = normalizeFileNamePart(source.counterpartyName);
  if (source.sourceKind === "OUTGOING_ARTIFACT") {
    return `${counterpartyName}-Outgoing.${extensionForFileName(
      source.originalFileName
    )}`;
  }
  return `${counterpartyName}-Response-${String(
    source.responseSequence ?? 1
  ).padStart(2, "0")}-${normalizeFileNamePart(source.originalFileName)}`;
}

function normalizeFileNamePart(value: string) {
  const normalized = value
    .trim()
    .replaceAll(/[<>:"/\\|?*\p{Cc}]/gu, "_")
    .replaceAll(/\s+/g, "_")
    .replaceAll(/_+/g, "_");
  return normalized || "unnamed";
}

function normalizeBusinessName(value: string) {
  const normalized = value
    .trim()
    .replaceAll(/[<>:"/\\|?*\p{Cc}]/gu, "_")
    .replaceAll(/_+/g, "_");
  return normalized || "unnamed";
}

function fingerprint(value: unknown) {
  return createHash("sha256")
    .update(
      JSON.stringify(value, (_key, item) =>
        item instanceof Date ? item.toISOString() : item
      )
    )
    .digest("hex");
}

function applySourceOverrides(
  sources: ConfirmationEmpImportPreviewSource[],
  overrides: ConfirmationEmpImportCreateJobInput["sourceOverrides"],
  mode: ConfirmationEmpImportMode
) {
  let zipPaperCode: string | null = null;
  return sources.map((source) => {
    const override = overrides?.[source.activeLinkKey];
    const paperCode = override?.paperCode?.trim() || source.paperCode;
    const businessName = override?.businessName?.trim()
      ? normalizeBusinessName(override.businessName)
      : source.businessName;
    const zipEntryName = override?.zipEntryName?.trim()
      ? normalizeFileNamePart(override.zipEntryName)
      : source.zipEntryName;
    if (!paperCode) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Each imported working paper must have a reference code."
      );
    }
    if (mode === "ZIP") {
      if (zipPaperCode && zipPaperCode !== paperCode) {
        throw new ApiBadRequestException(
          "BAD_REQUEST",
          "ZIP mode uses one EMP reference code for the whole archive."
        );
      }
      zipPaperCode = paperCode;
    }
    return {
      ...source,
      paperCode,
      businessName,
      zipEntryName,
    };
  });
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function isStorageAlreadyExists(error: unknown) {
  const value = error as {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  const code = String(value?.code ?? "").toLowerCase();
  const status = Number(value?.status ?? value?.statusCode);
  const message = error instanceof Error ? error.message : String(error);
  return (
    code === "eexist" ||
    code.includes("alreadyexists") ||
    status === 409 ||
    status === 412 ||
    /already exists|precondition failed|objectexists/i.test(message)
  );
}

function isStorageNotFound(error: unknown) {
  const value = error as {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  const code = String(value?.code ?? "").toLowerCase();
  const status = Number(value?.status ?? value?.statusCode);
  const message = error instanceof Error ? error.message : String(error);
  return (
    code === "enoent" ||
    code.includes("nosuchkey") ||
    status === 404 ||
    /not found|no such key|missing|enoent/i.test(message)
  );
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
