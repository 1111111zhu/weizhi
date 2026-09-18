import { createHash } from "node:crypto";

import { Injectable, Optional } from "@nestjs/common";
import JSZip from "jszip";

import { ApiConflictException } from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type {
  ConfirmationEmpImportDirectoryEntry,
  ConfirmationEmpImportLink,
  ConfirmationEmpImportMode,
  ConfirmationEmpImportSignoffSnapshot,
  ConfirmationEmpImportSnapshot,
  ConfirmationEmpImportSourceState,
  ConfirmationEmpImportTarget,
  ConfirmationEmpImportWithdrawalStore,
} from "./confirmation-emp-import-withdrawal.service";
import { lockConfirmationSourceRow } from "./confirmation-import-link-guard.service";
import type { ConfirmationImportLinkPrismaLike } from "./confirmation-import-link-guard.service";

type WithdrawalSignoff = {
  id: string;
  userId: string | null;
  type: string | null;
  signedAt: Date | null;
};
type WithdrawalNode = {
  id: string;
  projectId?: string;
  parentId?: string | null;
  level: number;
  code: string;
  title: string;
  sortOrder?: number | null;
  parent?: WithdrawalNode | null;
};
type WithdrawalPaper = {
  id: string;
  projectId?: string;
  workflowNodeId: string | null;
  code: string;
  title: string;
  signoffs?: WithdrawalSignoff[];
  attachments?: WithdrawalAttachment[];
  workflowNode?: WithdrawalNode | null;
};
type WithdrawalAttachment = {
  id: string;
  projectId?: string;
  workingPaperId: string | null;
  workflowNodeId: string | null;
  code: string | null;
  title: string | null;
  fileName?: string | null;
  originalName?: string | null;
  version?: number;
  headVersionId?: string | null;
  contentHash?: string | null;
  fileUrl?: string | null;
  deletedAt?: Date | null;
  deletedBy?: string | null;
  deletedFromWorkingPaperId?: string | null;
  deletedFromWorkflowNodeId?: string | null;
  deletedFromWorkingPaperCode?: string | null;
  deletedFromWorkingPaperTitle?: string | null;
  restoredAt?: Date | null;
  restoredBy?: string | null;
  versions?: {
    id: string;
    version: number;
    contentHash: string | null;
    isCurrent: boolean;
  }[];
  workingPaper?: WithdrawalPaper | null;
  workflowNode?: WithdrawalNode | null;
};
type WithdrawalJob = {
  id: string;
  projectId: string;
  mode: ConfirmationEmpImportMode;
  targetWorkflowNodeId: string;
  batchWorkflowNodeId: string | null;
  batchCode: string | null;
  batchTitle: string | null;
  project?: { name: string; projectCode: string | null };
};
type WithdrawalConfirmation = {
  id: string;
  status: string | null;
  differenceStatus: string | null;
  currentArtifact?: { id: string; disposition?: string | null } | null;
  responses?: WithdrawalResponse[];
};
type WithdrawalResponse = {
  receivedAt?: Date | null;
  createdAt?: Date | null;
  routingStatus?: string | null;
  artifacts?: { id: string; objectKey?: string | null }[];
};
type WithdrawalValue = {
  id: string;
  projectId?: string | null;
  jobId?: string;
  status?: string | null;
  withdrawnAt?: Date | null;
  confirmationId?: string | null;
  responseId?: string | null;
  outgoingArtifactId?: string | null;
  responseArtifactId?: string | null;
  activeLinkKey?: string | null;
  workingPaperId?: string | null;
  attachmentId?: string | null;
  empWorkflowNodeId?: string | null;
  workingPaperCode?: string | null;
  workingPaperTitle?: string | null;
  targetHeadVersionId?: string | null;
  targetHeadHash?: string | null;
  prepareUserId?: string | null;
  preparedAt?: Date | null;
  reviewUserId?: string | null;
  reviewedAt?: Date | null;
  userId?: string | null;
  type?: string | null;
  signedAt?: Date | null;
  job?: WithdrawalJob | null;
  attachment?: WithdrawalAttachment | null;
  workingPaper?: WithdrawalPaper | null;
  empWorkflowNode?: WithdrawalNode | null;
  currentArtifact?: WithdrawalConfirmation["currentArtifact"];
  responses?: WithdrawalResponse[];
  artifacts?: { id: string; objectKey?: string | null }[];
  routingStatus?: string | null;
  receivedAt?: Date | null;
  createdAt?: Date | null;
  differenceStatus?: string | null;
  deletedAt?: Date | null;
  fileName?: string | null;
  originalName?: string | null;
  version?: number;
  contentHash?: string | null;
  workflowNodeId?: string | null;
  code: string;
  title: string;
  sortOrder: number | null;
  level: number;
  parentId?: string | null;
  [key: string]: unknown;
};

type Model = {
  findFirst?: (
    input: Record<string, unknown>
  ) => Promise<WithdrawalValue | null>;
  findUnique?: (
    input: Record<string, unknown>
  ) => Promise<WithdrawalValue | null>;
  findMany?: (input: Record<string, unknown>) => Promise<WithdrawalValue[]>;
  count?: (input: Record<string, unknown>) => Promise<number>;
  create?: (input: Record<string, unknown>) => Promise<WithdrawalValue>;
  createMany?: (input: Record<string, unknown>) => Promise<unknown>;
  update?: (input: Record<string, unknown>) => Promise<WithdrawalValue>;
  updateMany?: (input: Record<string, unknown>) => Promise<{ count: number }>;
  delete?: (input: Record<string, unknown>) => Promise<WithdrawalValue>;
  deleteMany?: (input: Record<string, unknown>) => Promise<{ count: number }>;
};

type WithdrawalClient = {
  $queryRaw?: (query: unknown) => Promise<unknown>;
  confirmationEmpImportItem?: Model;
  confirmationEmpImportJob?: Model;
  workflowNode?: Model;
  workingPaper?: Model;
  attachment?: Model;
  attachmentVersion?: Model;
  workingPaperSignoff?: Model;
  projectConfirmation?: Model;
  auditLog?: Model;
  confirmationFollowUpEvent?: Model;
};

type PrismaLike = WithdrawalClient & {
  $transaction?: <T>(
    callback: (client: WithdrawalClient) => Promise<T>
  ) => Promise<T>;
};

const ITEM_INCLUDE = {
  job: {
    select: {
      id: true,
      projectId: true,
      mode: true,
      targetWorkflowNodeId: true,
      batchWorkflowNodeId: true,
      batchCode: true,
      batchTitle: true,
      project: { select: { name: true, projectCode: true } },
    },
  },
  empWorkflowNode: {
    select: {
      id: true,
      projectId: true,
      parentId: true,
      level: true,
      code: true,
      title: true,
      parent: {
        select: {
          id: true,
          parentId: true,
          level: true,
          code: true,
          title: true,
          parent: {
            select: {
              id: true,
              parentId: true,
              level: true,
              code: true,
              title: true,
            },
          },
        },
      },
    },
  },
  workingPaper: {
    select: {
      id: true,
      workflowNodeId: true,
      code: true,
      title: true,
      signoffs: {
        select: { id: true, userId: true, type: true, signedAt: true },
        orderBy: { signedAt: "asc" },
      },
    },
  },
  attachment: {
    select: {
      id: true,
      projectId: true,
      workingPaperId: true,
      workflowNodeId: true,
      code: true,
      title: true,
      fileName: true,
      originalName: true,
      version: true,
      headVersionId: true,
      contentHash: true,
      fileUrl: true,
      deletedAt: true,
      deletedBy: true,
      deletedFromWorkingPaperId: true,
      deletedFromWorkflowNodeId: true,
      deletedFromWorkingPaperCode: true,
      deletedFromWorkingPaperTitle: true,
      restoredAt: true,
      restoredBy: true,
      versions: {
        where: { isCurrent: true },
        select: {
          id: true,
          version: true,
          contentHash: true,
          isCurrent: true,
        },
      },
    },
  },
} as const;
const ATTACHMENT_SELECT = {
  id: true,
  projectId: true,
  workingPaperId: true,
  workflowNodeId: true,
  code: true,
  title: true,
  version: true,
  headVersionId: true,
  contentHash: true,
  fileUrl: true,
  fileName: true,
  originalName: true,
  deletedAt: true,
  deletedBy: true,
  deletedFromWorkingPaperId: true,
  deletedFromWorkflowNodeId: true,
  deletedFromWorkingPaperCode: true,
  deletedFromWorkingPaperTitle: true,
  restoredAt: true,
  restoredBy: true,
  workingPaper: {
    select: {
      id: true,
      workflowNodeId: true,
      code: true,
      title: true,
      signoffs: {
        select: { id: true, userId: true, type: true, signedAt: true },
        orderBy: { signedAt: "asc" },
      },
    },
  },
  workflowNode: ITEM_INCLUDE.empWorkflowNode,
  versions: {
    where: { isCurrent: true },
    select: { id: true, version: true, contentHash: true, isCurrent: true },
  },
} as const;

@Injectable()
export class PrismaConfirmationEmpImportWithdrawalStore implements ConfirmationEmpImportWithdrawalStore {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly storage?: StorageService
  ) {}

  async findLinkages(input: {
    projectId: string;
    importJobId?: string;
    sourceConfirmationId?: string;
    linkId?: string;
    state: "ACTIVE" | "WITHDRAWN";
  }): Promise<ConfirmationEmpImportLink[]> {
    const client = this.prisma as unknown as PrismaLike;
    const itemModel = requireModel(client.confirmationEmpImportItem, "item");
    const where: Record<string, unknown> = {
      job: { projectId: input.projectId },
      status: "SUCCEEDED",
      withdrawnAt: input.state === "ACTIVE" ? null : { not: null },
    };
    if (input.importJobId) where.jobId = input.importJobId;
    if (input.sourceConfirmationId) {
      where.confirmationId = input.sourceConfirmationId;
    }
    if (input.linkId) {
      where.id = input.linkId;
    }

    const rows = await requireMethod(
      itemModel.findMany,
      "findMany"
    )({
      where,
      include: ITEM_INCLUDE,
    });
    let generatedRows = rows;
    if (input.sourceConfirmationId || input.linkId) {
      const generatedWhere: Record<string, unknown> = {
        job: { projectId: input.projectId },
        status: "SUCCEEDED",
      };
      if (input.importJobId) generatedWhere.jobId = input.importJobId;
      generatedRows = await requireMethod(
        itemModel.findMany,
        "findMany"
      )({
        where: generatedWhere,
        select: {
          empWorkflowNodeId: true,
          attachmentId: true,
          job: { select: { mode: true, projectId: true } },
        },
      });
    }
    const groupedEntries = await this.readGroupedEntries(
      client,
      rows,
      generatedRows
    );
    return rows.map((row) =>
      mapItemToLink(row, groupedEntries.get(row.empWorkflowNodeId ?? ""))
    );
  }

  async readTarget(
    link: ConfirmationEmpImportLink
  ): Promise<ConfirmationEmpImportTarget | null> {
    const client = this.prisma as unknown as PrismaLike;
    const attachmentModel = requireModel(client.attachment, "attachment");
    const attachment = (await requireMethod(
      attachmentModel.findFirst,
      "findFirst"
    )({
      where: { id: link.attachmentId, projectId: link.projectId },
      select: ATTACHMENT_SELECT,
    })) as WithdrawalAttachment | null;
    if (!attachment) {
      return null;
    }

    const node = attachment.workflowNode;
    const paper = attachment.workingPaper;
    const nodeId = attachment.workflowNodeId ?? paper?.workflowNodeId ?? null;
    const entries =
      link.mode === "GROUPED" && nodeId
        ? await this.readDirectoryEntries(
            client,
            link.projectId,
            nodeId,
            undefined,
            new Set(
              (link.snapshot.directoryEntries ?? [])
                .filter((entry) => entry.kind === "GENERATED")
                .map((entry) => entry.id)
            )
          )
        : undefined;
    const target = mapTarget(attachment, node, paper, entries);
    if (attachment.deletedAt !== null) {
      target.inRecycleBin = true;
    }
    return target;
  }

  async withdrawZipItem(
    input: Parameters<
      NonNullable<ConfirmationEmpImportWithdrawalStore["withdrawZipItem"]>
    >[0]
  ): Promise<void> {
    const expectedTarget = input.expectedTarget;
    if (!expectedTarget)
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "缺少 ZIP 撤回校验信息"
      );
    const client = this.prisma as unknown as WithdrawalClient;
    const rows = await requireMethod(
      requireModel(client.confirmationEmpImportItem, "item").findMany,
      "findMany"
    )({
      where: {
        jobId: input.importJobId,
        status: "SUCCEEDED",
        withdrawnAt: null,
      },
      include: ITEM_INCLUDE,
    });
    const selected = rows.find((row) => row.id === input.linkId);
    if (!selected)
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "ZIP 导入项已变化，请刷新后重试"
      );
    if (
      selected.job?.mode !== "ZIP" ||
      !selected.attachmentId ||
      !selected.job.projectId
    )
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "ZIP 导入关联已变化"
      );
    if (rows.length === 1) {
      await this.withdrawLinkages({
        ...input,
        linkIds: [input.linkId],
        recycleDirectory: false,
        expectedTargets: [expectedTarget],
      });
      return;
    }
    const storage = this.storage;
    if (!storage)
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "ZIP 存储不可用"
      );
    const attachment = await this.findAttachment(client, selected.attachmentId);
    if (!attachment?.fileUrl || attachment.deletedAt !== null)
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "ZIP 附件不可用"
      );
    const original = await storage.getObjectBuffer(attachment.fileUrl);
    const originalHash = createHash("sha256").update(original).digest("hex");
    if (attachment.contentHash && originalHash !== attachment.contentHash)
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "ZIP 文件内容已变化"
      );
    const zip = await JSZip.loadAsync(original);
    const entries = await Promise.all(
      Object.values(zip.files)
        .filter((entry) => !entry.dir)
        .map(async (entry) => ({
          name: entry.name,
          hash: createHash("sha256")
            .update(await entry.async("nodebuffer"))
            .digest("hex"),
        }))
    );
    const matchedNames = new Set<string>();
    let entryName: string | undefined;
    for (const row of rows) {
      const candidates = entries.filter(
        (entry) => entry.hash === String(row.sourceSha256 ?? "")
      );
      const match =
        candidates.find(
          (entry) => entry.name === String(row.zipEntryName ?? "")
        ) ?? (candidates.length === 1 ? candidates[0] : undefined);
      if (!match || matchedNames.has(match.name))
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "无法完整定位 ZIP 导入文件，请检查归档内容"
        );
      matchedNames.add(match.name);
      if (row.id === input.linkId) entryName = match.name;
    }
    if (!entryName)
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "ZIP 导入项已变化"
      );
    zip.remove(entryName);
    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
    const hash = createHash("sha256").update(buffer).digest("hex");
    const stored = await storage.putObject(
      selected.job.projectId,
      selected.workingPaperId ?? attachment.id,
      attachment.originalName ?? "Confirmation responses.zip",
      buffer,
      "application/zip"
    );
    try {
      await this.withTransaction(async (tx) => {
        const items = requireModel(tx.confirmationEmpImportItem, "item");
        const currentRows = await requireMethod(
          items.findMany,
          "findMany"
        )({
          where: {
            jobId: input.importJobId,
            status: "SUCCEEDED",
            withdrawnAt: null,
          },
          include: ITEM_INCLUDE,
        });
        if (
          currentRows.length !== rows.length ||
          currentRows.some(
            (row) =>
              !rows.some(
                (prior) =>
                  prior.id === row.id &&
                  prior.attachmentId === row.attachmentId &&
                  prior.targetHeadVersionId === row.targetHeadVersionId &&
                  prior.targetHeadHash === row.targetHeadHash
              )
          )
        )
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            "ZIP 导入项已变化，请重试"
          );
        await this.assertExpectedTargetInTransaction(
          tx,
          selected,
          expectedTarget.snapshot
        );
        const versions = requireModel(
          tx.attachmentVersion,
          "attachmentVersion"
        );
        const nextVersion = (attachment.version ?? 1) + 1;
        const version = await requireMethod(
          versions.create,
          "create"
        )({
          data: {
            attachmentId: attachment.id,
            projectId: selected.job!.projectId,
            version: nextVersion,
            parentVersionId: attachment.headVersionId ?? null,
            fileKind: "SUPPORTING",
            fileName: stored.fileName,
            originalName: attachment.originalName,
            fileUrl: stored.objectKey,
            fileSize: buffer.length,
            mimeType: "application/zip",
            contentHash: hash,
            uploadedBy: input.actorId,
            uploadedAt: input.withdrawnAt,
            archivedBy: input.actorId,
            action: "UPDATE",
            message: "Withdraw one imported ZIP file",
            isCurrent: false,
          },
        });
        const update = await requireMethod(
          requireModel(tx.attachment, "attachment").updateMany,
          "updateMany"
        )({
          where: {
            id: attachment.id,
            deletedAt: null,
            version: attachment.version,
            headVersionId: attachment.headVersionId,
            contentHash: attachment.contentHash,
          },
          data: {
            version: nextVersion,
            headVersionId: version.id,
            contentHash: hash,
            fileUrl: stored.objectKey,
            fileName: stored.fileName,
            fileSize: buffer.length,
            lastModifiedBy: input.actorId,
            lastModifiedAt: input.withdrawnAt,
          },
        });
        if (update.count !== 1)
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            "ZIP 附件已变化，撤回已回滚"
          );
        await requireMethod(
          versions.updateMany,
          "updateMany"
        )({
          where: { attachmentId: attachment.id, isCurrent: true },
          data: { isCurrent: false },
        });
        await requireMethod(
          versions.updateMany,
          "updateMany"
        )({ where: { id: version.id }, data: { isCurrent: true } });
        const removed = await requireMethod(
          items.updateMany,
          "updateMany"
        )({
          where: {
            id: input.linkId,
            jobId: input.importJobId,
            withdrawnAt: null,
            status: "SUCCEEDED",
          },
          data: {
            withdrawnAt: input.withdrawnAt,
            withdrawnBy: input.actorId,
            withdrawalReason: input.reason,
          },
        });
        if (removed.count !== 1)
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            "ZIP 导入项已变化，撤回已回滚"
          );
        const remaining = await requireMethod(
          items.updateMany,
          "updateMany"
        )({
          where: {
            jobId: input.importJobId,
            id: {
              in: rows
                .filter((row) => row.id !== input.linkId)
                .map((row) => row.id),
            },
            withdrawnAt: null,
            status: "SUCCEEDED",
          },
          data: { targetHeadVersionId: version.id, targetHeadHash: hash },
        });
        if (remaining.count !== rows.length - 1)
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            "ZIP 导入项已变化，撤回已回滚"
          );
        await this.writeWithdrawalEvent(tx, selected, input);
        await this.writeStateAudit(tx, {
          actorId: input.actorId,
          projectId: selected.job!.projectId,
          targetId: input.linkId,
          action: "PROJECT_CONFIRMATION_EMP_IMPORT_WITHDRAWN",
          description: "Withdrew one imported ZIP file and updated the archive",
        });
      });
    } catch (error) {
      await storage
        .deleteObjectIfPresent(stored.objectKey)
        .catch(() => undefined);
      throw error;
    }
  }

  async withdrawLinkages(input: {
    importJobId: string;
    linkIds: string[];
    actorId: string;
    withdrawnAt: Date;
    reason: string | null;
    recycleDirectory: boolean;
    force?: boolean;
    expectedTargets?: readonly {
      linkId: string;
      snapshot: ConfirmationEmpImportSnapshot;
    }[];
  }): Promise<void> {
    if (input.linkIds.length === 0) {
      return;
    }
    await this.withTransaction(async (tx) => {
      const itemModel = requireModel(tx.confirmationEmpImportItem, "item");
      const rows = await requireMethod(
        itemModel.findMany,
        "findMany"
      )({
        where: { jobId: input.importJobId, id: { in: input.linkIds } },
        include: ITEM_INCLUDE,
      });
      const activeRows = rows.filter(
        (row) => row.status === "SUCCEEDED" && row.withdrawnAt === null
      );
      if (activeRows.length === 0) {
        return;
      }

      const expectedTargets = new Map(
        (input.expectedTargets ?? []).map((target) => [target.linkId, target])
      );
      if (!input.force) {
        for (const row of activeRows) {
          const expected = expectedTargets.get(row.id);
          if (expected) {
            await this.assertExpectedTargetInTransaction(
              tx,
              row,
              expected.snapshot
            );
          }
        }
      }

      const attachmentIds = uniqueStrings(
        activeRows.map((row) => row.attachmentId)
      );
      const paperIds = new Set<string>();
      const groupNodeIds = new Set<string>();
      for (const row of activeRows) {
        if (row.workingPaperId) {
          paperIds.add(row.workingPaperId);
        }
        if (input.recycleDirectory && row.empWorkflowNodeId) {
          groupNodeIds.add(row.empWorkflowNodeId);
        }
      }
      if (!input.force) {
        for (const nodeId of groupNodeIds) {
          await this.assertGroupedNodeContainsOnlySelectedTargets(
            tx,
            nodeId,
            activeRows
          );
        }
      }

      for (const attachmentId of attachmentIds) {
        const attachment = await this.findAttachment(tx, attachmentId);
        if (!attachment) {
          if (input.force) {
            await this.writeStateAudit(tx, {
              actorId: input.actorId,
              projectId: activeRows[0]?.job?.projectId,
              targetId: attachmentId,
              action:
                "PROJECT_CONFIRMATION_EMP_IMPORT_WITHDRAWAL_TARGET_MISSING",
              description: `EMP 导入目标附件 ${attachmentId} 已不存在，已按确认结果撤回导入链路`,
            });
            continue;
          }
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            `EMP 导入目标附件 ${attachmentId} 不存在，无法安全撤回`
          );
        }
        if (attachment.deletedAt !== null) {
          if (input.force) {
            await this.writeStateAudit(tx, {
              actorId: input.actorId,
              projectId: activeRows[0]?.job?.projectId,
              targetId: attachmentId,
              action:
                "PROJECT_CONFIRMATION_EMP_IMPORT_WITHDRAWAL_TARGET_ALREADY_REMOVED",
              description: `EMP 导入目标附件 ${attachmentId} 已不在原位置，已按确认结果撤回导入链路`,
            });
            continue;
          }
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            `EMP 导入目标附件 ${attachmentId} 已被其他操作回收，无法安全撤回`
          );
        }
        const paperId = attachment.workingPaperId ?? null;
        const paper = paperId ? await this.findPaper(tx, paperId) : null;
        if (paperId) {
          paperIds.add(paperId);
        }
        const attachmentUpdate = await requireMethod(
          requireModel(tx.attachment, "attachment").updateMany,
          "updateMany"
        )({
          where: expectedAttachmentWhere(
            attachmentId,
            input.force
              ? undefined
              : input.expectedTargets?.find(
                  (target) => target.snapshot.attachmentId === attachmentId
                )?.snapshot
          ),
          data: buildRecycleData(
            input.actorId,
            input.withdrawnAt,
            paper,
            attachment
          ),
        });
        if (attachmentUpdate.count !== 1) {
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            `EMP 导入目标附件 ${attachmentId} 在事务内发生变化，撤回已回滚`
          );
        }
        await this.writeStateAudit(tx, {
          actorId: input.actorId,
          projectId: activeRows[0]?.job?.projectId,
          targetId: attachmentId,
          action: "ATTACHMENT_DELETED",
          description: `Moved EMP attachment ${attachmentId} to the recycle bin`,
        });

        if (
          paperId &&
          (await this.countActivePaperAttachments(tx, paperId)) === 0
        ) {
          await this.deletePaperIfPresent(tx, paperId);
          await this.writeStateAudit(tx, {
            actorId: input.actorId,
            projectId: activeRows[0]?.job?.projectId,
            targetId: paperId,
            action: "WORKING_PAPER_DELETED",
            description: `Removed empty EMP working paper ${paperId}`,
          });
        }
      }

      for (const nodeId of groupNodeIds) {
        const remainingAttachments = await this.countActiveNodeAttachments(
          tx,
          nodeId
        );
        const remainingPapers = await this.countNodePapers(tx, nodeId);
        if (remainingAttachments !== 0 || remainingPapers !== 0) {
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            `EMP 分组目录 ${nodeId} 回收前必须为空`
          );
        }
        await this.deleteNodeIfPresent(tx, nodeId);
        await this.writeStateAudit(tx, {
          actorId: input.actorId,
          projectId: activeRows[0]?.job?.projectId,
          targetId: nodeId,
          action: "WORKFLOW_NODE_DELETED",
          description: `Removed empty EMP import folder ${nodeId}`,
        });
      }

      for (const row of activeRows) {
        const itemUpdate = await requireMethod(
          requireModel(tx.confirmationEmpImportItem, "item").updateMany,
          "updateMany"
        )({
          where: {
            id: row.id,
            jobId: input.importJobId,
            status: "SUCCEEDED",
            withdrawnAt: null,
          },
          data: {
            withdrawnAt: input.withdrawnAt,
            withdrawnBy: input.actorId,
            withdrawalReason: input.reason,
          },
        });
        if (itemUpdate.count !== 1) {
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            `EMP 导入项 ${row.id} 在事务内发生变化，撤回已回滚`
          );
        }
        await this.writeWithdrawalEvent(tx, row, input);
        await this.writeStateAudit(tx, {
          actorId: input.actorId,
          projectId: row.job?.projectId,
          targetId: row.id,
          action: "PROJECT_CONFIRMATION_EMP_IMPORT_WITHDRAWN",
          description: `Withdrew EMP import item ${row.id}`,
        });
      }
      const batchNodeIds = uniqueStrings(activeRows
        .filter((row) => row.job?.mode === "GROUPED"
          && row.empWorkflowNodeId === row.job.batchWorkflowNodeId)
        .map((row) => row.empWorkflowNodeId));
      for (const nodeId of batchNodeIds) {
        if (groupNodeIds.has(nodeId)) continue;
        const deleted = await tx.workflowNode?.deleteMany?.({
          where: {
            id: nodeId,
            confirmationEmpImportJobsAsBatch: { some: { id: input.importJobId, mode: "GROUPED" } },
            confirmationEmpImportJobsAsTarget: { none: {} },
            confirmationEmpImportItems: { none: { status: "SUCCEEDED", withdrawnAt: null } },
            attachments: { none: { deletedAt: null } },
            workingPapers: { none: {} },
            children: { none: {} },
          },
        });
        if (deleted?.count) {
          await this.writeStateAudit(tx, {
            actorId: input.actorId,
            projectId: activeRows[0]?.job?.projectId,
            targetId: nodeId,
            action: "WORKFLOW_NODE_DELETED",
            description: `Removed empty EMP import folder ${nodeId} after final item withdrawal`,
          });
        }
      }
    });
  }

  async restoreLinkages(input: {
    importJobId: string;
    linkIds: string[];
    actorId: string;
    restoredAt: Date;
    expectedTargets?: readonly {
      linkId: string;
      snapshot: ConfirmationEmpImportSnapshot;
    }[];
  }): Promise<void> {
    if (input.linkIds.length === 0) {
      return;
    }
    await this.withTransaction(async (tx) => {
      const itemModel = requireModel(tx.confirmationEmpImportItem, "item");
      const rows = await requireMethod(
        itemModel.findMany,
        "findMany"
      )({
        where: {
          jobId: input.importJobId,
          id: { in: input.linkIds },
          status: "SUCCEEDED",
          withdrawnAt: { not: null },
        },
        include: ITEM_INCLUDE,
      });
      if (rows.length === 0) {
        return;
      }

      const job =
        assertPresentValue(rows[0]).job ??
        (await this.findJob(tx, input.importJobId));
      if (!job) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "EMP 导入任务不存在"
        );
      }
      const { mode } = job;
      const sourceRows = [...rows].sort((left, right) =>
        String(left.confirmationId).localeCompare(String(right.confirmationId))
      );
      const sourceConfirmationIds = uniqueStrings(
        sourceRows.map((row) => row.confirmationId)
      ).sort((left, right) => left.localeCompare(right));
      const projectId = job?.projectId ?? sourceRows[0]?.job?.projectId;
      for (const confirmationId of sourceConfirmationIds) {
        await lockConfirmationSourceRow(
          { confirmationId, projectId },
          tx as unknown as ConfirmationImportLinkPrismaLike
        );
      }
      for (const row of sourceRows) {
        const state = await this.readSourceState(mapItemToLink(row), tx);
        if (!isRestorableSourceState(state)) {
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            `EMP 导入来源 ${state.confirmationId} 在事务内已失效，必须保持 CLOSED 且 MATCHED：${state.reason ?? "来源状态已变化"}`
          );
        }
      }
      const expectedTargets = new Map(
        (input.expectedTargets ?? []).map((target) => [target.linkId, target])
      );
      for (const row of sourceRows) {
        const expected = expectedTargets.get(row.id);
        if (expected) {
          await this.assertExpectedTargetInTransaction(
            tx,
            row,
            expected.snapshot,
            true
          );
        }
      }
      const nodeId =
        mode === "GROUPED"
          ? await this.ensureGroupedNode(tx, job, input.actorId)
          : null;
      const restoredTargets = new Map<
        string,
        {
          paperId: string | null;
          nodeId: string | null;
          code: string | null;
          title: string | null;
        }
      >();

      for (const row of sourceRows) {
        const { attachmentId } = row;
        if (!attachmentId) {
          continue;
        }
        if (!restoredTargets.has(attachmentId)) {
          const attachment = await this.findAttachment(tx, attachmentId);
          if (!attachment) {
            throw new ApiConflictException(
              "CONFIRMATION_STATE_CONFLICT",
              `EMP 回收站附件 ${attachmentId} 不存在，无法恢复`
            );
          }
          if (attachment.deletedAt === null && attachment.workingPaperId) {
            await this.restorePaperSignoffs(
              tx,
              row,
              attachment,
              attachment.workingPaperId
            );
            restoredTargets.set(attachmentId, {
              paperId: attachment.workingPaperId,
              nodeId: attachment.workflowNodeId,
              code: attachment.code,
              title: attachment.title,
            });
          } else {
            const restoreNodeId =
              nodeId ??
              attachment.deletedFromWorkflowNodeId ??
              row.empWorkflowNodeId ??
              null;
            if (!restoreNodeId) {
              throw new ApiConflictException(
                "CONFIRMATION_STATE_CONFLICT",
                `EMP 回收站附件 ${attachmentId} 缺少恢复目录`
              );
            }
            const paper = await this.createRestorePaper(
              tx,
              row,
              attachment,
              restoreNodeId,
              input.actorId,
              expectedTargets.get(row.id)?.snapshot
            );
            const attachmentUpdate = await requireMethod(
              requireModel(tx.attachment, "attachment").update,
              "update"
            )({
              where: expectedRecycleAttachmentWhere(
                attachmentId,
                input.expectedTargets?.find(
                  (target) => target.snapshot.attachmentId === attachmentId
                )?.snapshot
              ),
              data: {
                workingPaperId: paper.id,
                workflowNodeId: paper.workflowNodeId,
                code: paper.code,
                title: paper.title,
                ...restoreSignoffFields(row),
                deletedAt: null,
                deletedBy: null,
                deletedFromWorkingPaperId: null,
                deletedFromWorkflowNodeId: null,
                deletedFromWorkingPaperCode: null,
                deletedFromWorkingPaperTitle: null,
                restoredAt: input.restoredAt,
                restoredBy: input.actorId,
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
            });
            if (!attachmentUpdate) {
              throw new ApiConflictException(
                "CONFIRMATION_STATE_CONFLICT",
                `EMP 回收站附件 ${attachmentId} 在事务内发生变化，恢复已回滚`
              );
            }
            await this.writeStateAudit(tx, {
              actorId: input.actorId,
              projectId: row.job?.projectId,
              targetId: attachmentId,
              action: "ATTACHMENT_RESTORED",
              description: `Restored EMP attachment ${attachmentId}`,
            });
            restoredTargets.set(attachmentId, {
              paperId: paper.id,
              nodeId: paper.workflowNodeId ?? null,
              code: paper.code,
              title: paper.title,
            });
          }
        }

        const target = assertPresentValue(restoredTargets.get(attachmentId));
        const itemUpdate = await requireMethod(
          requireModel(tx.confirmationEmpImportItem, "item").updateMany,
          "updateMany"
        )({
          where: {
            id: row.id,
            jobId: input.importJobId,
            status: "SUCCEEDED",
            withdrawnAt: { not: null },
          },
          data: {
            withdrawnAt: null,
            withdrawnBy: null,
            withdrawalReason: null,
            empWorkflowNodeId: target.nodeId,
            workingPaperId: target.paperId,
            workingPaperCode: target.code ?? row.workingPaperCode,
            workingPaperTitle: target.title ?? row.workingPaperTitle,
          },
        });
        if (itemUpdate.count !== 1) {
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            `EMP 导入项 ${row.id} 在事务内发生变化，恢复已回滚`
          );
        }
        await this.writeStateAudit(tx, {
          actorId: input.actorId,
          projectId: row.job?.projectId,
          targetId: row.id,
          action: "PROJECT_CONFIRMATION_EMP_IMPORT_RESTORED",
          description: `Restored EMP import item ${row.id}`,
        });
      }
    });
  }

  async readSourceState(
    link: ConfirmationEmpImportLink,
    clientOverride?: unknown
  ): Promise<ConfirmationEmpImportSourceState> {
    const client = (clientOverride ?? this.prisma) as PrismaLike;
    const confirmationModel = requireModel(
      client.projectConfirmation,
      "confirmation"
    );
    const confirmation = await requireMethod(
      confirmationModel.findFirst,
      "findFirst"
    )({
      where: { id: link.sourceConfirmationId, projectId: link.projectId },
      include: {
        currentArtifact: true,
        responses: { include: { artifacts: true } },
      },
    });
    if (!confirmation) {
      return invalidSource(link, "来源函证不存在");
    }

    const matched =
      confirmation.status === "CLOSED" &&
      confirmation.differenceStatus === "MATCHED";
    const outgoingValid =
      confirmation.currentArtifact?.disposition === "ACTIVE" &&
      (link.sourceArtifactId === null ||
        confirmation.currentArtifact.id === link.sourceArtifactId);
    const latestResponse = latestValidRoutedResponse(confirmation.responses);
    const latestResponseArtifact = latestResponse?.artifacts?.find(
      (artifact: { id: string; objectKey?: string | null }) =>
        artifact.id === link.responseArtifactId
    );
    const responseValid = Boolean(
      latestResponse &&
      latestResponse.artifacts?.some(
        (artifact: { objectKey?: string | null }) => Boolean(artifact.objectKey)
      ) &&
      (link.responseArtifactId === null ||
        Boolean(latestResponseArtifact?.objectKey))
    );
    const artifactValid = outgoingValid && responseValid;
    const valid = matched && artifactValid;
    const reason = matched
      ? outgoingValid
        ? responseValid
          ? null
          : "最新 routed response artifact 已失效或不是导入来源"
        : "当前 outgoing artifact 已失效或不是导入来源"
      : `函证状态为 ${confirmation.status ?? "未知"}，差异状态为 ${confirmation.differenceStatus ?? "未知"}`;
    return {
      confirmationId: link.sourceConfirmationId,
      valid,
      matched,
      status: confirmation.status,
      differenceStatus: confirmation.differenceStatus,
      artifactValid,
      reason,
    };
  }

  private async assertExpectedTargetInTransaction(
    client: WithdrawalClient,
    row: WithdrawalValue,
    expected: ConfirmationEmpImportSnapshot,
    restoring = false
  ) {
    const attachmentId = row.attachmentId ?? expected.attachmentId;
    if (!attachmentId) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        `EMP 导入项 ${row.id} 缺少目标附件，无法安全${restoring ? "恢复" : "撤回"}`
      );
    }
    const attachment = await this.findAttachment(client, attachmentId);
    if (!attachment) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        `EMP 导入目标附件 ${attachmentId} 不存在，无法安全${restoring ? "恢复" : "撤回"}`
      );
    }
    if (
      restoring ? attachment.deletedAt === null : attachment.deletedAt !== null
    ) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        `EMP 导入目标附件 ${attachmentId} 的回收站状态已变化，操作已回滚`
      );
    }

    const current = mapTarget(
      attachment,
      attachment.workflowNode,
      attachment.workingPaper
    );
    if (restoring) {
      current.workflowNodeId =
        attachment.deletedFromWorkflowNodeId ?? current.workflowNodeId;
      current.workingPaperId =
        attachment.deletedFromWorkingPaperId ?? current.workingPaperId;
      current.code = attachment.deletedFromWorkingPaperCode ?? current.code;
      current.title = attachment.deletedFromWorkingPaperTitle ?? current.title;
      const persistedSignoffs = mapImportItemSignoffs(row);
      if (persistedSignoffs.length > 0) {
        current.signoffs = persistedSignoffs;
      }
    }
    const reasons = compareStoredTargetSnapshot(expected, current);
    if (reasons.length > 0) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        `EMP 导入目标 ${attachmentId} 在事务内发生变化：${reasons.join("、")}`
      );
    }

    if (row.job?.mode === "GROUPED" && expected.directoryEntries) {
      const nodeId = current.workflowNodeId;
      if (!nodeId) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          `EMP 分组目录缺少位置，无法安全${restoring ? "恢复" : "撤回"}`
        );
      }
      const generatedIds = new Set(
        expected.directoryEntries
          .filter((entry) => entry.kind === "GENERATED")
          .map((entry) => entry.id)
      );
      const currentEntries = await this.readDirectoryEntries(
        client,
        row.job?.projectId,
        nodeId,
        undefined,
        generatedIds
      );
      const hasForeignEntry = [
        ...expected.directoryEntries,
        ...currentEntries,
      ].some((entry) => entry.kind === "EXTERNAL");
      if (
        hasForeignEntry ||
        !sameDirectoryEntrySnapshot(expected.directoryEntries, currentEntries)
      ) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          `EMP 分组目录 ${nodeId} 在事务内发生变化，${restoring ? "恢复" : "撤回"}已回滚`
        );
      }
    }
  }

  private async withTransaction<T>(
    callback: (tx: WithdrawalClient) => Promise<T>
  ) {
    await Promise.resolve();
    const prisma = this.prisma as unknown as PrismaLike;
    if (typeof prisma.$transaction === "function") {
      return prisma.$transaction(callback);
    }
    return callback(prisma);
  }

  private async readGroupedEntries(
    client: WithdrawalClient,
    rows: WithdrawalValue[],
    generatedRows: WithdrawalValue[] = rows
  ): Promise<Map<string, ConfirmationEmpImportDirectoryEntry[]>> {
    const result = new Map<string, ConfirmationEmpImportDirectoryEntry[]>();
    const groupedNodeIds = uniqueStrings(
      rows
        .filter((row) => row.job?.mode === "GROUPED")
        .map((row) => row.empWorkflowNodeId)
    );
    for (const nodeId of groupedNodeIds) {
      const generatedIds = new Set(
        uniqueStrings(
          generatedRows
            .filter(
              (row) => row.empWorkflowNodeId === nodeId && row.attachmentId
            )
            .map((row) => row.attachmentId)
        )
      );
      result.set(
        nodeId,
        await this.readDirectoryEntries(
          client,
          rows[0]?.job?.projectId,
          nodeId,
          rows,
          generatedIds
        )
      );
    }
    return result;
  }

  private async readDirectoryEntries(
    client: WithdrawalClient,
    projectId: string | undefined,
    nodeId: string,
    fallbackRows?: WithdrawalValue[],
    generatedIds = new Set<string>()
  ): Promise<ConfirmationEmpImportDirectoryEntry[]> {
    const attachmentModel = client.attachment;
    if (attachmentModel?.findMany) {
      const attachments = await attachmentModel.findMany({
        where: { projectId, workflowNodeId: nodeId, deletedAt: null },
        select: {
          id: true,
          code: true,
          title: true,
          fileName: true,
          originalName: true,
          version: true,
          contentHash: true,
          workingPaperId: true,
          workingPaper: { select: { code: true, title: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      return attachments.map((attachment) =>
        toDirectoryEntry(attachment, generatedIds.has(attachment.id))
      );
    }
    const rows = (fallbackRows ?? []).filter(
      (row) => row.empWorkflowNodeId === nodeId && row.attachment
    );
    return rows.flatMap((row) =>
      row.attachment
        ? [
            toDirectoryEntry(
              row.attachment,
              generatedIds.has(row.attachment.id)
            ),
          ]
        : []
    );
  }

  private async findAttachment(
    client: WithdrawalClient,
    id: string
  ): Promise<WithdrawalAttachment | null> {
    await Promise.resolve();
    const model = requireModel(client.attachment, "attachment");
    if (model.findUnique) {
      return (await model.findUnique({
        where: { id },
        select: ATTACHMENT_SELECT,
      })) as WithdrawalAttachment | null;
    }
    return (await requireMethod(
      model.findFirst,
      "findFirst"
    )({
      where: { id },
      select: ATTACHMENT_SELECT,
    })) as WithdrawalAttachment | null;
  }

  private async findPaper(
    client: WithdrawalClient,
    id: string
  ): Promise<WithdrawalPaper | null> {
    await Promise.resolve();
    const model = requireModel(client.workingPaper, "working paper");
    const find = model.findUnique ?? model.findFirst;
    if (!find) {
      return null;
    }
    return (await find.call(model, {
      where: { id },
      select: {
        id: true,
        projectId: true,
        workflowNodeId: true,
        code: true,
        title: true,
      },
    })) as WithdrawalPaper | null;
  }

  private async findJob(
    client: WithdrawalClient,
    id: string
  ): Promise<WithdrawalJob | null> {
    await Promise.resolve();
    const model = client.confirmationEmpImportJob;
    const find = model?.findUnique ?? model?.findFirst;
    if (!find) {
      return null;
    }
    return (await find.call(model, {
      where: { id },
      select: {
        id: true,
        projectId: true,
        mode: true,
        targetWorkflowNodeId: true,
        batchWorkflowNodeId: true,
        batchCode: true,
        batchTitle: true,
      },
    })) as WithdrawalJob | null;
  }

  private async countActivePaperAttachments(
    client: WithdrawalClient,
    paperId: string
  ) {
    await Promise.resolve();
    const model = requireModel(client.attachment, "attachment");
    if (!model.count) {
      return 0;
    }
    return model.count({ where: { workingPaperId: paperId, deletedAt: null } });
  }

  private async countActiveNodeAttachments(
    client: WithdrawalClient,
    nodeId: string
  ) {
    await Promise.resolve();
    const model = requireModel(client.attachment, "attachment");
    if (!model.count) {
      return 0;
    }
    return model.count({ where: { workflowNodeId: nodeId, deletedAt: null } });
  }

  private async assertGroupedNodeContainsOnlySelectedTargets(
    client: WithdrawalClient,
    nodeId: string,
    rows: WithdrawalValue[]
  ) {
    const projectId = rows[0]?.job?.projectId;
    const selectedAttachmentIds = new Set(
      rows
        .filter((row) => row.empWorkflowNodeId === nodeId)
        .map((row) => row.attachmentId)
        .filter((id): id is string => Boolean(id))
    );
    if (client.attachment?.findMany) {
      const attachments = await client.attachment.findMany({
        where: { projectId, workflowNodeId: nodeId, deletedAt: null },
        select: { id: true },
      });
      if (
        attachments.length !== selectedAttachmentIds.size ||
        attachments.some(
          (attachment) => !selectedAttachmentIds.has(attachment.id)
        )
      ) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          `EMP 分组目录 ${nodeId} 包含未纳入本次导入的外来项`
        );
      }
    }
    const selectedPaperIds = new Set(
      rows
        .filter((row) => row.empWorkflowNodeId === nodeId)
        .map((row) => row.workingPaperId)
        .filter((id): id is string => Boolean(id))
    );
    if (client.workingPaper?.findMany) {
      const papers = await client.workingPaper.findMany({
        where: { projectId, workflowNodeId: nodeId },
        select: { id: true },
      });
      if (
        papers.length !== selectedPaperIds.size ||
        papers.some((paper) => !selectedPaperIds.has(paper.id))
      ) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          `EMP 分组目录 ${nodeId} 包含未纳入本次导入的外来底稿`
        );
      }
    }
  }

  private async countNodePapers(client: WithdrawalClient, nodeId: string) {
    await Promise.resolve();
    const model = requireModel(client.workingPaper, "working paper");
    if (!model.count) {
      return 0;
    }
    return model.count({ where: { workflowNodeId: nodeId } });
  }

  private async deletePaperIfPresent(
    client: WithdrawalClient,
    paperId: string
  ) {
    const model = requireModel(client.workingPaper, "working paper");
    if (!model.delete) {
      return;
    }
    await model.delete({ where: { id: paperId } });
  }

  private async deleteNodeIfPresent(client: WithdrawalClient, nodeId: string) {
    const model = requireModel(client.workflowNode, "workflow node");
    if (!model.delete) {
      return;
    }
    await model.delete({ where: { id: nodeId } });
  }

  private async ensureGroupedNode(
    client: WithdrawalClient,
    job: WithdrawalJob,
    actorId: string
  ) {
    if (!job) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "EMP 导入任务不存在"
      );
    }
    const nodeModel = requireModel(client.workflowNode, "workflow node");
    const existing = job.batchWorkflowNodeId
      ? await (nodeModel.findUnique ?? nodeModel.findFirst)?.call(nodeModel, {
          where: { id: job.batchWorkflowNodeId, projectId: job.projectId },
        })
      : null;
    if (existing) {
      if (
        existing.code !== job.batchCode ||
        existing.title !== job.batchTitle
      ) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          `EMP 分组目录 ${existing.id} 的编号或名称已变化，恢复已阻止`
        );
      }
      return existing.id;
    }
    const target = await (nodeModel.findUnique ?? nodeModel.findFirst)?.call(
      nodeModel,
      { where: { id: job.targetWorkflowNodeId, projectId: job.projectId } }
    );
    if (!target || !nodeModel.create) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "EMP 分组目录已不存在，无法恢复"
      );
    }
    const children = nodeModel.findMany
      ? await nodeModel.findMany({
          where: { projectId: job.projectId, parentId: target.id },
          select: { id: true, sortOrder: true, code: true, title: true },
        })
      : [];
    if (!job.batchCode || !job.batchTitle) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "EMP 分组目录缺少原始编号或名称，恢复已阻止"
      );
    }
    if (
      children.some(
        (child: WithdrawalValue) =>
          child.code === job.batchCode || child.title === job.batchTitle
      )
    ) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        `EMP 分组目录 ${job.batchCode} 或名称已被其他目录占用，恢复已阻止`
      );
    }
    const node = await nodeModel.create({
      data: {
        projectId: job.projectId,
        parentId: target.id,
        level: target.level + 1,
        code: job.batchCode,
        title: job.batchTitle,
        nodeType:
          target.level + 1 === 1
            ? "PHASE"
            : target.level + 1 === 2
              ? "ACCOUNT"
              : "WORKING_PAPER",
        sortOrder:
          Math.max(
            0,
            ...children.map((child: WithdrawalValue) => child.sortOrder ?? 0)
          ) + 1,
        createdBy: actorId,
      },
    });
    if (client.confirmationEmpImportJob?.update) {
      await client.confirmationEmpImportJob.update({
        where: { id: job.id },
        data: { batchWorkflowNodeId: node.id },
      });
    }
    return node.id;
  }

  private async createRestorePaper(
    client: WithdrawalClient,
    row: WithdrawalValue,
    attachment: WithdrawalAttachment,
    workflowNodeId: string,
    actorId: string,
    snapshot?: ConfirmationEmpImportSnapshot
  ) {
    const model = requireModel(client.workingPaper, "working paper");
    if (!model.create) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "EMP 回收站缺少恢复工作底稿能力"
      );
    }
    const existingPapers = client.workingPaper?.findMany
      ? await client.workingPaper.findMany({
          where: { projectId: row.job?.projectId ?? "", workflowNodeId },
          select: { code: true },
        })
      : [];
    const existingAttachments = client.attachment?.findMany
      ? await client.attachment.findMany({
          where: {
            projectId: row.job?.projectId ?? "",
            workflowNodeId,
            deletedAt: null,
          },
          select: { code: true },
        })
      : [];
    const code =
      snapshot?.code ??
      attachment.deletedFromWorkingPaperCode ??
      row.workingPaperCode ??
      null;
    const title =
      snapshot?.title ??
      attachment.deletedFromWorkingPaperTitle ??
      row.workingPaperTitle ??
      null;
    if (!code || !title) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        `EMP 回收站附件 ${attachment.id} 缺少原始底稿编号或名称，无法无损恢复`
      );
    }
    const signoffFields = restoreSignoffFields(row);
    if (
      existingPapers.some((item: WithdrawalValue) => item.code === code) ||
      existingAttachments.some((item: WithdrawalValue) => item.code === code)
    ) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        `EMP 恢复底稿编号 ${code} 已被其他活动底稿占用，恢复已阻止`
      );
    }
    const paper = await model.create({
      data: {
        projectId: row.job?.projectId ?? "",
        workflowNodeId,
        code,
        title,
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
        createdBy: actorId,
        ...signoffFields,
      },
      select: {
        id: true,
        workflowNodeId: true,
        code: true,
        title: true,
      },
    });
    await this.restorePaperSignoffs(client, row, attachment, paper.id);
    return paper;
  }

  private async restorePaperSignoffs(
    client: WithdrawalClient,
    row: WithdrawalValue,
    attachment: WithdrawalAttachment,
    workingPaperId: string
  ) {
    if (row.job?.mode === "ZIP") {
      return;
    }
    const signoffFields = restoreSignoffFields(row);
    type RestoreSignoff = {
      workingPaperId: string;
      attachmentId: string;
      userId: string;
      type: "PREPARER" | "REVIEWER";
      signedAt: Date;
    };
    const data = [
      signoffFields.preparerId
        ? {
            workingPaperId,
            attachmentId: attachment.id,
            userId: signoffFields.preparerId,
            type: "PREPARER",
            signedAt: signoffFields.preparedAt ?? new Date(),
          }
        : null,
      signoffFields.reviewerId
        ? {
            workingPaperId,
            attachmentId: attachment.id,
            userId: signoffFields.reviewerId,
            type: "REVIEWER",
            signedAt: signoffFields.reviewedAt ?? new Date(),
          }
        : null,
    ].filter((signoff): signoff is RestoreSignoff => signoff !== null);
    if (data.length === 0) {
      return;
    }
    const model = requireModel(
      client.workingPaperSignoff,
      "working paper signoff"
    );
    const existingRows = await requireMethod(
      model.findMany,
      "findMany"
    )({
      where: { workingPaperId, attachmentId: attachment.id },
      select: { id: true, userId: true, type: true, signedAt: true },
    });
    const existing: WithdrawalSignoff[] = existingRows.map((signoff) => ({
      id: signoff.id,
      userId: signoff.userId ?? null,
      type: signoff.type ?? null,
      signedAt: signoff.signedAt ?? null,
    }));
    const missing = data.filter(
      (candidate) =>
        !existing.some(
          (signoff) =>
            signoff.userId === candidate.userId &&
            signoff.type === candidate.type &&
            sameDate(signoff.signedAt, candidate.signedAt)
        )
    );
    const conflicting = data.some((candidate) =>
      existing.some(
        (signoff) =>
          signoff.userId === candidate.userId &&
          signoff.type === candidate.type &&
          !sameDate(signoff.signedAt, candidate.signedAt)
      )
    );
    if (conflicting) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        `EMP 底稿 ${workingPaperId} 的 signoff 时间已变化，恢复已阻止`
      );
    }
    if (missing.length > 0) {
      await requireMethod(model.createMany, "createMany")({ data: missing });
    }
  }

  private async writeWithdrawalEvent(
    client: WithdrawalClient,
    row: WithdrawalValue,
    input: { actorId: string; withdrawnAt: Date; reason: string | null }
  ) {
    if (!row.confirmationId) return;
    await requireMethod(
      requireModel(
        client.confirmationFollowUpEvent,
        "confirmationFollowUpEvent"
      ).create,
      "create"
    )({
      data: {
        confirmationId: row.confirmationId,
        eventType: "IMPORT_WITHDRAWN",
        actorId: input.actorId,
        source: "PROJECT_TEAM_MANUAL",
        occurredAt: input.withdrawnAt,
        notes: `已撤回导入：${row.sourceFileName ?? row.workingPaperTitle ?? row.id}；目标项目：${row.job?.project?.projectCode ?? row.job?.project?.name ?? row.job?.projectId ?? ""}；待归档${input.reason ? `；${input.reason}` : ""}`,
        payload: {
          operation: "RESPONSE_IMPORT_WITHDRAWN",
          importJobId: row.jobId,
          importItemId: row.id,
          responseArtifactId: row.responseArtifactId,
          projectId: row.job?.projectId,
        },
      },
    });
  }

  private async writeStateAudit(
    client: WithdrawalClient,
    input: {
      actorId: string;
      projectId?: string | null;
      targetId: string;
      action: string;
      description: string;
    }
  ) {
    if (!client.auditLog?.create) {
      return;
    }
    await client.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        targetType: "CONFIRMATION_EMP_IMPORT_ITEM",
        targetId: input.targetId,
        projectId: input.projectId ?? undefined,
        description: input.description,
      },
    });
  }
}

function mapItemToLink(
  item: WithdrawalValue,
  directoryEntries?: ConfirmationEmpImportDirectoryEntry[]
): ConfirmationEmpImportLink {
  const node = item.empWorkflowNode ?? item.workingPaper?.workflowNode;
  const paper = item.workingPaper;
  const { attachment } = item;
  const recycled =
    (item.withdrawnAt !== null && item.withdrawnAt !== undefined) ||
    (attachment?.deletedAt !== null && attachment?.deletedAt !== undefined);
  const workflowNodeId =
    item.empWorkflowNodeId ??
    paper?.workflowNodeId ??
    attachment?.workflowNodeId ??
    (recycled ? attachment?.deletedFromWorkflowNodeId : null) ??
    null;
  const workingPaperId =
    item.workingPaperId ??
    paper?.id ??
    attachment?.workingPaperId ??
    (recycled ? attachment?.deletedFromWorkingPaperId : null) ??
    null;
  const attachmentId = item.attachmentId ?? attachment?.id ?? null;
  const mode = (item.job?.mode ?? "FLAT") as ConfirmationEmpImportMode;
  const snapshot: ConfirmationEmpImportSnapshot = {
    workflowNodeId,
    workingPaperId,
    attachmentId,
    location: formatNodeLocation(node),
    code:
      (mode === "ZIP" ? item.job?.batchCode : item.workingPaperCode) ??
      attachment?.code ??
      paper?.code ??
      "",
    title:
      (mode === "ZIP" ? item.job?.batchTitle : item.workingPaperTitle) ??
      attachment?.title ??
      paper?.title ??
      "",
    version: attachment?.version ?? item.targetHeadVersionId ?? null,
    hash: item.targetHeadHash ?? attachment?.contentHash ?? null,
    versionId:
      item.targetHeadVersionId ??
      attachment?.headVersionId ??
      attachment?.versions?.[0]?.id ??
      null,
    signoffs: mapSignoffs(
      paper?.signoffs?.length ? paper.signoffs : mapImportItemSignoffs(item)
    ),
    ...(mode === "GROUPED"
      ? {
          directoryEntries:
            directoryEntries ?? mapEmbeddedDirectoryEntries(paper),
        }
      : {}),
  };
  return {
    id: item.id,
    importJobId: item.jobId ?? "",
    projectId: item.job?.projectId ?? "",
    sourceConfirmationId: item.confirmationId ?? "",
    sourceResponseId: item.responseId ?? null,
    sourceArtifactId: item.outgoingArtifactId ?? null,
    responseArtifactId: item.responseArtifactId ?? null,
    mode,
    active: item.status === "SUCCEEDED" && item.withdrawnAt === null,
    withdrawnAt: item.withdrawnAt ?? null,
    workflowNodeId,
    workingPaperId,
    attachmentId,
    snapshot,
  };
}

function mapTarget(
  attachment: WithdrawalAttachment,
  node: WithdrawalNode | null | undefined,
  paper: WithdrawalPaper | null | undefined,
  directoryEntries?: ConfirmationEmpImportDirectoryEntry[]
): ConfirmationEmpImportTarget {
  return {
    workflowNodeId: attachment.workflowNodeId ?? paper?.workflowNodeId ?? null,
    workingPaperId: attachment.workingPaperId ?? paper?.id ?? null,
    attachmentId: attachment.id,
    location: formatNodeLocation(node),
    code: attachment.code ?? paper?.code ?? "",
    title: attachment.title ?? paper?.title ?? "",
    version: attachment.version ?? null,
    hash: attachment.contentHash ?? null,
    versionId: attachment.headVersionId ?? attachment.versions?.[0]?.id ?? null,
    signoffs: mapSignoffs(paper?.signoffs),
    ...(directoryEntries ? { directoryEntries } : {}),
  };
}

function mapSignoffs(
  signoffs:
    | readonly {
        id: string;
        userId: string | null;
        type: string | null;
        signedAt: Date | string | null;
      }[]
    | undefined
) {
  return (signoffs ?? []).map((signoff) => ({
    id: signoff.id,
    userId: signoff.userId ?? null,
    type: signoff.type ?? null,
    signedAt: signoff.signedAt ?? null,
  }));
}

function mapImportItemSignoffs(
  item: WithdrawalValue
): ConfirmationEmpImportSignoffSnapshot[] {
  const signoffs: (ConfirmationEmpImportSignoffSnapshot | null)[] = [
    item.prepareUserId
      ? {
          id: `${item.id}:PREPARER`,
          userId: item.prepareUserId,
          type: "PREPARER",
          signedAt: item.preparedAt ?? null,
        }
      : null,
    item.reviewUserId && item.reviewUserId !== item.prepareUserId
      ? {
          id: `${item.id}:REVIEWER`,
          userId: item.reviewUserId,
          type: "REVIEWER",
          signedAt: item.reviewedAt ?? null,
        }
      : null,
  ];
  return signoffs.filter(
    (signoff): signoff is ConfirmationEmpImportSignoffSnapshot =>
      signoff !== null && signoff !== undefined
  );
}

function mapEmbeddedDirectoryEntries(
  paper: WithdrawalPaper | null | undefined
) {
  const attachments = paper?.attachments ?? [];
  return attachments.map((attachment: WithdrawalAttachment | WithdrawalValue) =>
    toDirectoryEntry(attachment, true)
  );
}

function toDirectoryEntry(
  attachment: WithdrawalAttachment | WithdrawalValue,
  generated: boolean
): ConfirmationEmpImportDirectoryEntry {
  return {
    id: attachment.id,
    path:
      attachment.originalName ??
      attachment.fileName ??
      attachment.title ??
      attachment.code ??
      attachment.id,
    kind: generated ? "GENERATED" : "EXTERNAL",
    version: attachment.version ?? null,
    hash: attachment.contentHash ?? null,
  };
}

function formatNodeLocation(node: WithdrawalNode | null | undefined): string {
  const parts: string[] = [];
  let current = node;
  let guard = 0;
  while (current && guard < 8) {
    const code = typeof current.code === "string" ? current.code.trim() : "";
    const title = typeof current.title === "string" ? current.title.trim() : "";
    parts.unshift(
      code && title && code !== title ? `${code} ${title}` : code || title
    );
    current = current.parent;
    guard += 1;
  }
  return parts.filter(Boolean).join(" /");
}

function latestValidRoutedResponse(
  responses: WithdrawalResponse[] | undefined
) {
  return [...(responses ?? [])]
    .filter(
      (response) =>
        (response.routingStatus === "ROUTED" ||
          response.routingStatus === "CONCLUDED") &&
        response.artifacts?.some((artifact) => Boolean(artifact.objectKey))
    )
    .sort(
      (left, right) =>
        responseDate(right).getTime() - responseDate(left).getTime()
    )[0];
}

function responseDate(response: WithdrawalResponse) {
  return response.receivedAt ?? response.createdAt ?? new Date(0);
}

function invalidSource(link: ConfirmationEmpImportLink, reason: string) {
  return {
    confirmationId: link.sourceConfirmationId,
    valid: false,
    matched: false,
    artifactValid: false,
    reason,
  } satisfies ConfirmationEmpImportSourceState;
}

function isRestorableSourceState(state: ConfirmationEmpImportSourceState) {
  return (
    state.valid &&
    state.matched &&
    state.artifactValid !== false &&
    (state.status === null || state.status === "CLOSED") &&
    (state.differenceStatus === null || state.differenceStatus === "MATCHED")
  );
}

function expectedAttachmentWhere(
  attachmentId: string,
  snapshot?: ConfirmationEmpImportSnapshot
) {
  return {
    id: attachmentId,
    deletedAt: null,
    ...(snapshot
      ? {
          workingPaperId: snapshot.workingPaperId,
          workflowNodeId: snapshot.workflowNodeId,
          code: snapshot.code,
          title: snapshot.title,
          version: snapshot.version,
          headVersionId: snapshot.versionId ?? null,
          contentHash: snapshot.hash,
        }
      : {}),
  };
}

function expectedRecycleAttachmentWhere(
  attachmentId: string,
  snapshot?: ConfirmationEmpImportSnapshot
) {
  return {
    id: attachmentId,
    deletedAt: { not: null },
    ...(snapshot
      ? {
          deletedFromWorkingPaperId: snapshot.workingPaperId,
          deletedFromWorkflowNodeId: snapshot.workflowNodeId,
          deletedFromWorkingPaperCode: snapshot.code,
          deletedFromWorkingPaperTitle: snapshot.title,
          version: snapshot.version,
          headVersionId: snapshot.versionId ?? null,
          contentHash: snapshot.hash,
        }
      : {}),
  };
}

function compareStoredTargetSnapshot(
  expected: ConfirmationEmpImportSnapshot,
  current: ConfirmationEmpImportTarget
) {
  const labels: Record<string, string> = {
    workflowNodeId: "位置",
    workingPaperId: "工作底稿",
    attachmentId: "附件",
    location: "路径",
    code: "编号",
    title: "名称",
    version: "版本",
    hash: "内容 hash",
    versionId: "版本指针",
  };
  const reasons: string[] = [];
  const fields: (keyof ConfirmationEmpImportSnapshot)[] = [
    "workflowNodeId",
    "workingPaperId",
    "attachmentId",
    "location",
    "code",
    "title",
    "version",
    "hash",
    "versionId",
  ];
  for (const field of fields) {
    if ((current[field] ?? null) !== (expected[field] ?? null)) {
      reasons.push(`${labels[field] ?? field}已变化`);
    }
  }
  if (
    expected.signoffs &&
    JSON.stringify(normalizeSignoffSnapshot(expected.signoffs)) !==
      JSON.stringify(normalizeSignoffSnapshot(current.signoffs ?? []))
  ) {
    reasons.push("签字状态已变化");
  }
  return reasons;
}

function normalizeSignoffSnapshot(
  signoffs: readonly ConfirmationEmpImportSignoffSnapshot[]
) {
  return signoffs
    .map((signoff) => ({
      id: signoff.id,
      userId: signoff.userId,
      type: signoff.type,
      signedAt:
        signoff.signedAt instanceof Date
          ? signoff.signedAt.toISOString()
          : (signoff.signedAt ?? null),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function sameDirectoryEntrySnapshot(
  expected: readonly ConfirmationEmpImportDirectoryEntry[],
  current: readonly ConfirmationEmpImportDirectoryEntry[]
) {
  if (expected.length !== current.length) {
    return false;
  }
  const normalize = (entries: readonly ConfirmationEmpImportDirectoryEntry[]) =>
    entries
      .map((entry) => ({
        id: entry.id,
        path: entry.path,
        kind: entry.kind,
        version: entry.version ?? null,
        hash: entry.hash ?? null,
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
  return (
    JSON.stringify(normalize(expected)) === JSON.stringify(normalize(current))
  );
}

function buildRecycleData(
  actorId: string,
  deletedAt: Date,
  paper: WithdrawalPaper | null,
  attachment: WithdrawalAttachment
) {
  return {
    workingPaperId: null,
    deletedAt,
    deletedBy: actorId,
    deletedFromWorkingPaperId: paper?.id ?? attachment.workingPaperId ?? null,
    deletedFromWorkflowNodeId:
      paper?.workflowNodeId ?? attachment.workflowNodeId ?? null,
    deletedFromWorkingPaperCode: paper?.code ?? attachment.code ?? null,
    deletedFromWorkingPaperTitle: paper?.title ?? attachment.title ?? null,
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

function uniqueStrings(values: (string | null | undefined)[]) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

function sameDate(left: Date | string | null | undefined, right: unknown) {
  const leftTime =
    left === null || left === undefined ? null : new Date(left).getTime();
  const rightTime =
    right === null || right === undefined
      ? null
      : new Date(String(right)).getTime();
  return leftTime === rightTime;
}

function restoreSignoffFields(row: WithdrawalValue) {
  const automatic = row.job?.mode !== "ZIP";
  const preparerId = automatic ? (row.prepareUserId ?? null) : null;
  const reviewerId =
    automatic && row.reviewUserId && row.reviewUserId !== row.prepareUserId
      ? row.reviewUserId
      : null;
  return {
    preparerId,
    preparedAt: preparerId ? (row.preparedAt ?? null) : null,
    reviewerId,
    reviewedAt: reviewerId ? (row.reviewedAt ?? null) : null,
  };
}

function requireModel(value: Model | undefined, name: string): Model {
  if (!value) {
    throw new Error(`Confirmation EMP withdrawal ${name} model is not wired`);
  }
  return value;
}

function requireMethod<T extends (...args: never[]) => unknown>(
  value: T | undefined,
  name: string
): T {
  if (!value) {
    throw new Error(`Confirmation EMP withdrawal ${name} method is not wired`);
  }
  return value;
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
