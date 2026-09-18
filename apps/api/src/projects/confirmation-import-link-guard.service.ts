import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { ApiConflictException } from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";

export type ConfirmationSourceInvalidatingAction =
  | "UNDO_REVIEW"
  | "WITHDRAW_RESPONSE"
  | "VOID_CONFIRMATION"
  | "RECYCLE_CONFIRMATION"
  | "REDISPATCH_EDITING";

export type ConfirmationImportLinkGuardSource = {
  confirmationId: string;
  responseId?: string;
  sourceArtifactId?: string;
  responseArtifactId?: string;
  projectId?: string;
  actorId?: string;
  auditSource?: AuditLogSource;
};

export type ConfirmationImportLink = {
  id: string;
  importJobId?: string | null;
  sourceConfirmationId: string;
  sourceResponseId?: string | null;
  sourceArtifactId?: string | null;
  responseArtifactId?: string | null;
  mode?: string | null;
  active?: boolean | null;
  status?: string | null;
  withdrawnAt?: Date | string | null;
  workflowNodeId?: string | null;
  workingPaperId?: string | null;
  attachmentId?: string | null;
  snapshotLocation?: string | null;
  location?: string | null;
};

type ImportLinkModel = {
  findMany: (args: {
    where: Record<string, unknown>;
    include?: Record<string, unknown>;
    select?: Record<string, unknown>;
  }) => Promise<unknown[]>;
};

export type ConfirmationImportLinkPrismaLike = {
  $queryRaw?: (query: unknown) => Promise<unknown>;
  confirmationEmpImportItem?: ImportLinkModel;
  confirmationImportItem?: ImportLinkModel;
};

export async function lockConfirmationSourceRow(
  source: Pick<
    ConfirmationImportLinkGuardSource,
    "confirmationId" | "projectId"
  >,
  client: ConfirmationImportLinkPrismaLike
) {
  if (!client.$queryRaw) {
    throw new Error(
      "Confirmation source transaction client does not support FOR UPDATE locking"
    );
  }
  const query = source.projectId
    ? Prisma.sql`
        SELECT "id"
        FROM "project_confirmations"
        WHERE "id" = ${source.confirmationId}
          AND "project_id" = ${source.projectId}
        FOR UPDATE
      `
    : Prisma.sql`
        SELECT "id"
        FROM "project_confirmations"
        WHERE "id" = ${source.confirmationId}
        FOR UPDATE
      `;
  await client.$queryRaw(query);
}

const actionLabels: Record<ConfirmationSourceInvalidatingAction, string> = {
  UNDO_REVIEW: "撤回复核结论",
  WITHDRAW_RESPONSE: "撤回回函",
  VOID_CONFIRMATION: "将函证移入回收站",
  RECYCLE_CONFIRMATION: "将函证移入回收站",
  REDISPATCH_EDITING: "开始重发编辑",
};

@Injectable()
export class ConfirmationImportLinkGuardService {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveLinkages(
    source: ConfirmationImportLinkGuardSource,
    client?: ConfirmationImportLinkPrismaLike
  ): Promise<ConfirmationImportLink[]> {
    const prisma =
      client ?? (this.prisma as unknown as ConfirmationImportLinkPrismaLike);
    if (client) {
      await lockConfirmationSourceRow(source, prisma);
    }
    const model = this.getImportLinkModel(prisma);
    const links = await model.findMany({
      where: {
        withdrawnAt: null,
      },
      include: {
        job: {
          select: {
            mode: true,
          },
        },
        empWorkflowNode: {
          select: {
            code: true,
            title: true,
            parent: {
              select: {
                code: true,
                title: true,
                parent: {
                  select: { code: true, title: true },
                },
              },
            },
          },
        },
        workingPaper: {
          select: { code: true, title: true },
        },
      },
    });

    return links
      .map(normalizeImportLink)
      .filter(isActiveImportLink)
      .filter((link) => link.sourceConfirmationId === source.confirmationId);
  }

  async assertCanInvalidateSource(
    source: ConfirmationImportLinkGuardSource,
    action: ConfirmationSourceInvalidatingAction,
    client?: ConfirmationImportLinkPrismaLike
  ) {
    const links = await this.findActiveLinkages(source, client);
    if (links.length === 0) {
      return;
    }

    const locations = links.map((link) => {
      const location = link.snapshotLocation ?? link.location;
      const importId = link.importJobId ?? link.id;
      const mode = link.mode ? `${link.mode} ` : "";
      return `${mode}导入 ${importId}${location ? `（${location}）` : ""}`;
    });
    const message = `来源状态受 EMP 导入保护：${locations.join("；")}。请先从 EMP 撤回该导入后，再${actionLabels[action]}。`;
    throw new ApiConflictException("CONFIRMATION_STATE_CONFLICT", message);
  }

  private getImportLinkModel(client?: ConfirmationImportLinkPrismaLike) {
    const prisma =
      client ?? (this.prisma as unknown as ConfirmationImportLinkPrismaLike);
    const model =
      prisma.confirmationEmpImportItem ?? prisma.confirmationImportItem;
    if (!model) {
      throw new Error("Confirmation EMP import link model is not wired");
    }
    return model;
  }
}

function isActiveImportLink(value: unknown): value is ConfirmationImportLink {
  if (!value || typeof value !== "object") {
    return false;
  }
  const link = value as Partial<ConfirmationImportLink>;
  return (
    typeof link.id === "string" &&
    typeof link.sourceConfirmationId === "string" &&
    link.active !== false &&
    (link.status === null || link.status === "SUCCEEDED") &&
    link.withdrawnAt === null
  );
}

function normalizeImportLink(value: unknown): ConfirmationImportLink {
  const raw = (value ?? {}) as Record<string, unknown>;
  const withdrawnAt = asDateOrString(raw.withdrawnAt);
  const status = typeof raw.status === "string" ? raw.status : null;
  const rawActive = raw.active;
  const active =
    status === null
      ? typeof rawActive === "boolean"
        ? rawActive
        : withdrawnAt === null || withdrawnAt === undefined
      : withdrawnAt === null ||
        (withdrawnAt === undefined && status === "SUCCEEDED");
  const job =
    raw.job && typeof raw.job === "object"
      ? (raw.job as Record<string, unknown>)
      : undefined;
  const mode =
    typeof raw.mode === "string"
      ? raw.mode
      : typeof job?.mode === "string"
        ? job.mode
        : null;
  const node =
    raw.empWorkflowNode && typeof raw.empWorkflowNode === "object"
      ? (raw.empWorkflowNode as Record<string, unknown>)
      : undefined;
  const paper =
    raw.workingPaper && typeof raw.workingPaper === "object"
      ? (raw.workingPaper as Record<string, unknown>)
      : undefined;

  return {
    id: typeof raw.id === "string" ? raw.id : "",
    importJobId:
      typeof raw.importJobId === "string"
        ? raw.importJobId
        : typeof raw.jobId === "string"
          ? raw.jobId
          : null,
    sourceConfirmationId:
      typeof raw.sourceConfirmationId === "string"
        ? raw.sourceConfirmationId
        : typeof raw.confirmationId === "string"
          ? raw.confirmationId
          : "",
    sourceResponseId:
      typeof raw.sourceResponseId === "string"
        ? raw.sourceResponseId
        : typeof raw.responseId === "string"
          ? raw.responseId
          : null,
    sourceArtifactId:
      typeof raw.sourceArtifactId === "string"
        ? raw.sourceArtifactId
        : typeof raw.outgoingArtifactId === "string"
          ? raw.outgoingArtifactId
          : null,
    responseArtifactId:
      typeof raw.responseArtifactId === "string"
        ? raw.responseArtifactId
        : null,
    mode,
    active,
    status,
    withdrawnAt,
    workflowNodeId:
      typeof raw.workflowNodeId === "string"
        ? raw.workflowNodeId
        : typeof raw.empWorkflowNodeId === "string"
          ? raw.empWorkflowNodeId
          : null,
    workingPaperId: asNullableString(raw.workingPaperId),
    attachmentId: asNullableString(raw.attachmentId),
    snapshotLocation:
      asNullableString(raw.snapshotLocation) ??
      asNullableString(raw.location) ??
      formatImportLocation(node) ??
      asNullableString(paper?.code) ??
      asNullableString(raw.workingPaperTitle),
    location: asNullableString(raw.location),
  };
}

function formatImportLocation(node: Record<string, unknown> | undefined) {
  const parts: string[] = [];
  let current = node;
  let guard = 0;
  while (current && guard < 8) {
    const code = asNullableString(current.code);
    const title = asNullableString(current.title);
    if (code || title) {
      parts.unshift(
        code && title && code !== title
          ? `${code} ${title}`
          : (code ?? assertPresentValue(title))
      );
    }
    current =
      current.parent && typeof current.parent === "object"
        ? (current.parent as Record<string, unknown>)
        : undefined;
    guard += 1;
  }
  return parts.length > 0 ? parts.join(" /") : null;
}

function asNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asDateOrString(value: unknown) {
  return value instanceof Date || typeof value === "string" ? value : null;
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
