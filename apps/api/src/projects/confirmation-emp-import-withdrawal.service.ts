import { Inject, Injectable } from "@nestjs/common";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiConflictException,
  ApiNotFoundException,
} from "../common/api-error";
import { ProjectAccessService } from "./project-access.service";

export type ConfirmationEmpImportMode = "FLAT" | "GROUPED" | "ZIP";

export type ConfirmationEmpImportDirectoryEntry = {
  id: string;
  path: string;
  kind: "GENERATED" | "EXTERNAL";
  version?: string | number | null;
  hash?: string | null;
};

export type ConfirmationEmpImportSnapshot = {
  workflowNodeId: string | null;
  workingPaperId: string | null;
  attachmentId: string | null;
  location: string;
  code: string;
  title: string;
  version: string | number | null;
  hash: string | null;
  versionId?: string | null;
  signoffs?: readonly ConfirmationEmpImportSignoffSnapshot[];
  directoryEntries?: readonly ConfirmationEmpImportDirectoryEntry[];
};

export type ConfirmationEmpImportSignoffSnapshot = {
  id: string;
  userId: string | null;
  type: string | null;
  signedAt: Date | string | null;
};

export type ConfirmationEmpImportTarget = ConfirmationEmpImportSnapshot & {
  inRecycleBin?: boolean;
};

export type ConfirmationEmpImportExpectedTarget = {
  linkId: string;
  snapshot: ConfirmationEmpImportSnapshot;
};

export type ConfirmationEmpImportLink = {
  id: string;
  importJobId: string;
  projectId: string;
  sourceConfirmationId: string;
  sourceResponseId?: string | null;
  sourceArtifactId?: string | null;
  responseArtifactId?: string | null;
  mode: ConfirmationEmpImportMode;
  active: boolean;
  withdrawnAt?: Date | string | null;
  workflowNodeId: string | null;
  workingPaperId: string | null;
  attachmentId: string | null;
  snapshot: ConfirmationEmpImportSnapshot;
};

export type ConfirmationEmpImportSourceState = {
  confirmationId: string;
  valid: boolean;
  matched: boolean;
  status?: string | null;
  differenceStatus?: string | null;
  artifactValid?: boolean;
  reason?: string | null;
};

export type ConfirmationEmpImportWithdrawalStore = {
  findLinkages: (input: {
    projectId: string;
    importJobId?: string;
    sourceConfirmationId?: string;
    linkId?: string;
    state: "ACTIVE" | "WITHDRAWN";
  }) => Promise<ConfirmationEmpImportLink[]>;
  readTarget: (
    link: ConfirmationEmpImportLink
  ) => Promise<ConfirmationEmpImportTarget | null>;
  withdrawLinkages: (input: {
    importJobId: string;
    linkIds: string[];
    actorId: string;
    withdrawnAt: Date;
    reason: string | null;
    recycleDirectory: boolean;
    force?: boolean;
    expectedTargets?: readonly ConfirmationEmpImportExpectedTarget[];
  }) => Promise<void>;
  withdrawZipItem?: (input: {
    importJobId: string;
    linkId: string;
    actorId: string;
    withdrawnAt: Date;
    reason: string | null;
    force?: boolean;
    expectedTarget?: ConfirmationEmpImportExpectedTarget;
  }) => Promise<void>;
  restoreLinkages: (input: {
    importJobId: string;
    linkIds: string[];
    actorId: string;
    restoredAt: Date;
    expectedTargets?: readonly ConfirmationEmpImportExpectedTarget[];
  }) => Promise<void>;
  readSourceState: (
    link: ConfirmationEmpImportLink,
    client?: unknown
  ) => Promise<ConfirmationEmpImportSourceState>;
};

export const CONFIRMATION_EMP_IMPORT_WITHDRAWAL_STORE =
  "CONFIRMATION_EMP_IMPORT_WITHDRAWAL_STORE";

export type ConfirmationEmpImportWithdrawalResult = {
  importJobId: string;
  linkIds: string[];
  mode: ConfirmationEmpImportMode;
  recycleDirectory: boolean;
};

export type ConfirmationEmpImportRestoreResult = {
  importJobId: string;
  linkIds: string[];
  mode: ConfirmationEmpImportMode;
};

export type ConfirmationEmpImportRestoreScope =
  | { scope: "JOB" }
  | {
      scope: "SOURCE_CONFIRMATION";
      sourceConfirmationId: string;
    };

@Injectable()
export class ConfirmationEmpImportWithdrawalService {
  constructor(
    @Inject(CONFIRMATION_EMP_IMPORT_WITHDRAWAL_STORE)
    private readonly store: ConfirmationEmpImportWithdrawalStore,
    private readonly access: ProjectAccessService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async withdraw(
    projectId: string,
    importJobId: string,
    sourceConfirmationId: string | undefined,
    user: RequestUser,
    source: AuditLogSource,
    reason?: string,
    force = false,
    linkId?: string
  ): Promise<ConfirmationEmpImportWithdrawalResult> {
    await this.access.requireProjectAction(projectId, user.id, "modifyIndex");

    let links = await this.store.findLinkages({
      projectId,
      importJobId,
      sourceConfirmationId,
      linkId,
      state: "ACTIVE",
    });
    links = links.filter(
      (link) => link.projectId === projectId && isActiveLink(link)
    );
    if (links.length === 0) {
      let withdrawn = (
        await this.store.findLinkages({
          projectId,
          importJobId,
          sourceConfirmationId,
          linkId,
          state: "WITHDRAWN",
        })
      ).filter(
        (link) =>
          link.projectId === projectId &&
          !link.active &&
          link.withdrawnAt != null
      );
      if (withdrawn.length > 0) {
        const withdrawnMode = getSingleMode(withdrawn);
        if (withdrawnMode === "ZIP" && sourceConfirmationId) {
          withdrawn = (
            await this.store.findLinkages({
              projectId,
              importJobId,
              state: "WITHDRAWN",
            })
          ).filter(
            (link) =>
              link.projectId === projectId &&
              !link.active &&
              link.withdrawnAt != null
          );
        }
        return {
          importJobId,
          linkIds: withdrawn.map((link) => link.id),
          mode: withdrawnMode,
          recycleDirectory: false,
        };
      }
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "EMP 导入链路不存在或已经撤回"
      );
    }

    const mode = getSingleMode(links);
    if (mode === "ZIP" && sourceConfirmationId) {
      links = (
        await this.store.findLinkages({
          projectId,
          importJobId,
          state: "ACTIVE",
        })
      ).filter((link) => link.projectId === projectId && isActiveLink(link));
    }
    if (links.length === 0) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "ZIP 导入没有可撤回的活动链路"
      );
    }

    const conflicts = await this.findTargetConflicts(links);
    if (conflicts.length > 0) {
      const message = formatTargetConflictMessage(conflicts);
      if (!force) {
        await this.auditBlockedAttempt({
          actorId: user.id,
          projectId,
          targetId: importJobId,
          action: "PROJECT_CONFIRMATION_EMP_IMPORT_WITHDRAWAL_BLOCKED",
          description: message,
          source,
        });
        throw new ApiConflictException("CONFIRMATION_STATE_CONFLICT", message);
      }
      await this.auditBlockedAttempt({
        actorId: user.id,
        projectId,
        targetId: importJobId,
        action: "PROJECT_CONFIRMATION_EMP_IMPORT_WITHDRAWAL_FORCED",
        description: message,
        source,
      });
    }

    const recycleDirectory =
      mode === "GROUPED" && !linkId && !force && canRecycleGroupedDirectory(links);
    const withdrawnAt = new Date();
    const withdrawalInput: Parameters<
      ConfirmationEmpImportWithdrawalStore["withdrawLinkages"]
    >[0] = {
      importJobId,
      linkIds: links.map((link) => link.id),
      actorId: user.id,
      withdrawnAt,
      reason: reason?.trim() || null,
      recycleDirectory,
      expectedTargets: links.map((link) => ({
        linkId: link.id,
        snapshot: link.snapshot,
      })),
    };
    if (force) {
      withdrawalInput.force = true;
    }
    if (mode === "ZIP" && linkId) {
      if (!this.store.withdrawZipItem) {
        const message =
          "ZIP 单文件撤回需要先重建归档，当前任务不支持安全执行。";
        await this.auditBlockedAttempt({
          actorId: user.id,
          projectId,
          targetId: importJobId,
          action: "PROJECT_CONFIRMATION_EMP_IMPORT_WITHDRAWAL_BLOCKED",
          description: message,
          source,
        });
        throw new ApiConflictException("CONFIRMATION_STATE_CONFLICT", message);
      }
      await this.store.withdrawZipItem({
        importJobId,
        linkId,
        actorId: user.id,
        withdrawnAt,
        reason: reason?.trim() || null,
        ...(force ? { force: true } : {}),
        expectedTarget: {
          linkId,
          snapshot: links[0].snapshot,
        },
      });
    } else {
      await this.store.withdrawLinkages(withdrawalInput);
    }
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_EMP_IMPORT_WITHDRAWN",
      targetType: "CONFIRMATION_EMP_IMPORT_JOB",
      targetId: importJobId,
      projectId,
      description: `Withdrew EMP import ${importJobId} (${links.length} linkage(s)): ${links
        .map(
          (link) =>
            `${link.snapshot.location}/${link.snapshot.code}/${link.snapshot.title}`
        )
        .join("; ")}`,
      source,
    });

    return {
      importJobId,
      linkIds: links.map((link) => link.id),
      mode,
      recycleDirectory,
    };
  }

  async withdrawForConfirmation(
    projectId: string,
    sourceConfirmationId: string,
    user: RequestUser,
    source: AuditLogSource,
    reason = "撤回复核结论，联动撤回已归档函证"
  ) {
    const links = (
      await this.store.findLinkages({
        projectId,
        sourceConfirmationId,
        state: "ACTIVE",
      })
    ).filter((link) => link.projectId === projectId && isActiveLink(link));
    const importJobIds = [...new Set(links.map((link) => link.importJobId))];
    for (const importJobId of importJobIds) {
      await this.withdraw(
        projectId,
        importJobId,
        sourceConfirmationId,
        user,
        source,
        reason,
        true
      );
    }
    return { importJobIds };
  }

  async restore(
    projectId: string,
    importJobId: string,
    selection: ConfirmationEmpImportRestoreScope,
    user: RequestUser,
    source: AuditLogSource
  ): Promise<ConfirmationEmpImportRestoreResult> {
    await this.access.requireProjectAction(projectId, user.id, "modifyIndex");

    const sourceConfirmationId =
      selection.scope === "SOURCE_CONFIRMATION"
        ? selection.sourceConfirmationId
        : undefined;

    let links = (
      await this.store.findLinkages({
        projectId,
        importJobId,
        sourceConfirmationId,
        state: "WITHDRAWN",
      })
    ).filter(
      (candidate) =>
        candidate.projectId === projectId &&
        !candidate.active &&
        candidate.withdrawnAt != null
    );
    if (links.length === 0) {
      const active = (
        await this.store.findLinkages({
          projectId,
          importJobId,
          sourceConfirmationId,
          state: "ACTIVE",
      })
      ).filter(
        (candidate) =>
          candidate.projectId === projectId && isActiveLink(candidate)
      );
      if (active.length > 0) {
        const activeMode = getSingleMode(active);
        if (activeMode === "ZIP" && selection.scope === "SOURCE_CONFIRMATION") {
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            "ZIP 导入只能整包恢复"
          );
        }
        return {
          importJobId,
          linkIds: active.map((candidate) => candidate.id),
          mode: activeMode,
        };
      }
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "EMP 导入链路不存在或没有可恢复的回收站文件"
      );
    }

    const mode = getSingleMode(links);
    if (mode === "ZIP" && selection.scope === "SOURCE_CONFIRMATION") {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "ZIP 导入只能整包恢复"
      );
    }
    if (mode === "ZIP") {
      links = (
        await this.store.findLinkages({
          projectId,
          importJobId,
          state: "WITHDRAWN",
        })
      ).filter(
        (candidate) =>
          candidate.projectId === projectId &&
          !candidate.active &&
          candidate.withdrawnAt !== null
      );
    }

    const invalidSources: {
      link: ConfirmationEmpImportLink;
      state: ConfirmationEmpImportSourceState;
    }[] = [];
    for (const link of links) {
      const state = await this.store.readSourceState(link);
      if (!isRestorableSourceState(state)) {
        invalidSources.push({ link, state });
      }
    }
    if (invalidSources.length > 0) {
      const message = `EMP 导入仍不可恢复，来源必须保持 CLOSED 且 MATCHED：${invalidSources
        .map(
          ({ link, state }) =>
            `${state.confirmationId}（EMP ${link.snapshot.location}/${link.snapshot.title}）：${state.reason ?? describeSourceState(state)}`
        )
        .join("；")}`;
      await this.auditBlockedAttempt({
        actorId: user.id,
        action: "PROJECT_CONFIRMATION_EMP_IMPORT_RESTORE_BLOCKED",
        targetId: importJobId,
        projectId,
        description: message,
        source,
      });
      throw new ApiConflictException("CONFIRMATION_STATE_CONFLICT", message);
    }

    const restoredAt = new Date();
    await this.store.restoreLinkages({
      importJobId,
      linkIds: links.map((link) => link.id),
      actorId: user.id,
      restoredAt,
      expectedTargets: links.map((link) => ({
        linkId: link.id,
        snapshot: link.snapshot,
      })),
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_EMP_IMPORT_RESTORED",
      targetType: "CONFIRMATION_EMP_IMPORT_JOB",
      targetId: importJobId,
      projectId,
      description: `Restored EMP import ${importJobId} (${links.length} linkage(s))`,
      source,
    });

    return {
      importJobId,
      linkIds: links.map((link) => link.id),
      mode,
    };
  }

  private async findTargetConflicts(links: ConfirmationEmpImportLink[]) {
    const conflicts: Array<{
      link: ConfirmationEmpImportLink;
      reasons: string[];
    }> = [];
    for (const link of links) {
      const current = await this.store.readTarget(link);
      const reasons = compareTarget(link, current);
      if (reasons.length > 0) {
        conflicts.push({ link, reasons });
      }
    }
    return conflicts;
  }

  private async auditBlockedAttempt(input: {
    actorId: string;
    action: string;
    targetId: string;
    projectId: string;
    description: string;
    source: AuditLogSource;
  }) {
    try {
      await this.auditLogs.log({
        actorId: input.actorId,
        action: input.action,
        targetType: "CONFIRMATION_EMP_IMPORT_JOB",
        targetId: input.targetId,
        projectId: input.projectId,
        description: input.description,
        source: input.source,
      });
    } catch {
      // A failed audit write must never turn a guarded conflict into success.
    }
  }
}

function isActiveLink(link: ConfirmationEmpImportLink) {
  return link.active && link.withdrawnAt === null;
}

function getSingleMode(links: ConfirmationEmpImportLink[]) {
  const modes = new Set(links.map((link) => link.mode));
  if (modes.size !== 1) {
    throw new ApiConflictException(
      "CONFIRMATION_STATE_CONFLICT",
      "EMP 导入链路包含不一致的打包模式，请刷新后重试"
    );
  }
  return assertPresentValue(links[0]).mode;
}

function compareTarget(
  link: ConfirmationEmpImportLink,
  current: ConfirmationEmpImportTarget | null
) {
  if (!current) {
    return ["目标文件或目录不存在"];
  }
  if (current.inRecycleBin) {
    return ["目标已经在 EMP 回收站"];
  }

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
  ];
  for (const field of fields) {
    if (current[field] !== link.snapshot[field]) {
      const labels: Record<string, string> = {
        workflowNodeId: "位置",
        workingPaperId: "工作底稿",
        attachmentId: "附件",
        location: "路径",
        code: "编号",
        title: "名称",
        version: "版本",
        hash: "内容 hash",
      };
      reasons.push(`${labels[field] ?? field}已变化`);
    }
  }
  if ((current.versionId ?? null) !== (link.snapshot.versionId ?? null)) {
    reasons.push("版本已变化");
  }
  if (
    link.snapshot.signoffs &&
    !sameSignoffs(link.snapshot.signoffs, current.signoffs ?? [])
  ) {
    reasons.push("签字状态已变化");
  }

  if (link.mode === "GROUPED") {
    const hasForeignItem = [
      ...(link.snapshot.directoryEntries ?? []),
      ...(current.directoryEntries ?? []),
    ].some((entry) => entry.kind === "EXTERNAL");
    if (hasForeignItem) {
      reasons.push("目录混入外来项");
    } else if (
      !sameDirectoryEntries(
        link.snapshot.directoryEntries,
        current.directoryEntries
      )
    ) {
      reasons.push("目录内容已变化");
    }
  }
  return reasons;
}

function canRecycleGroupedDirectory(links: ConfirmationEmpImportLink[]) {
  const entries = links[0]?.snapshot.directoryEntries;
  if (!entries || entries.some((entry) => entry.kind !== "GENERATED")) {
    return false;
  }
  const selectedAttachmentIds = new Set(
    links
      .map((link) => link.attachmentId)
      .filter((id): id is string => Boolean(id))
  );
  return (
    selectedAttachmentIds.size === entries.length &&
    entries.every((entry) => selectedAttachmentIds.has(entry.id))
  );
}

function sameSignoffs(
  expected: readonly ConfirmationEmpImportSignoffSnapshot[],
  actual: readonly ConfirmationEmpImportSignoffSnapshot[]
) {
  const normalize = (
    signoffs: readonly ConfirmationEmpImportSignoffSnapshot[]
  ) =>
    (signoffs ?? [])
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
  return (
    JSON.stringify(normalize(expected)) === JSON.stringify(normalize(actual))
  );
}

function sameDirectoryEntries(
  expected: readonly ConfirmationEmpImportDirectoryEntry[] | undefined,
  actual: readonly ConfirmationEmpImportDirectoryEntry[] | undefined
) {
  if (!expected || !actual || expected.length !== actual.length) {
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
    JSON.stringify(normalize(expected)) === JSON.stringify(normalize(actual))
  );
}

function formatTargetConflictMessage(
  conflicts: { link: ConfirmationEmpImportLink; reasons: string[] }[]
) {
  const details = conflicts.map(
    ({ link, reasons }) =>
      `${link.sourceConfirmationId}（EMP ${link.snapshot.location}/${link.snapshot.title}）：${reasons.join("、")}`
  );
  return `EMP 撤回已阻止，目标已被修改或无法安全回收：${details.join("；")}。请先手动解决冲突。`;
}

function isRestorableSourceState(state: ConfirmationEmpImportSourceState) {
  return (
    state.valid &&
    state.matched &&
    state.artifactValid !== false &&
    (state.status === undefined ||
      state.status === null ||
      state.status === "CLOSED") &&
    (state.differenceStatus === undefined ||
      state.differenceStatus === null ||
      state.differenceStatus === "MATCHED")
  );
}

function describeSourceState(state: ConfirmationEmpImportSourceState) {
  if (!state.valid) {
    return "来源函证或附件已失效";
  }
  if (!state.matched) {
    return "来源函证不再是 MATCHED";
  }
  if (state.artifactValid === false) {
    return "来源附件已失效";
  }
  if (state.status && state.status !== "CLOSED") {
    return `函证状态为 ${state.status}`;
  }
  if (state.differenceStatus && state.differenceStatus !== "MATCHED") {
    return `差异状态为 ${state.differenceStatus}`;
  }
  return "来源状态已变化";
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
