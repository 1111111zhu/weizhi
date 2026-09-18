import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import type { WorkItemResponsibilitySelector } from "@prisma/client";
import type { WorkItem } from "@project-wing/shared";

import type { RequestUser } from "../auth/request-user";
import { PrismaService } from "../prisma/prisma.service";
import {
  workItemAttachmentId,
  unavailableWorkItemTarget,
} from "./work-item-attachment-lifecycle";
import { buildCmpPersonalWorkItems } from "./work-items-cmp";
import { buildEmpPersonalWorkItems } from "./work-items-emp";
import { buildOpsWorkItems } from "./work-items-ops";
import { buildProjectTeamWorkItems } from "./work-items-project";
import { buildTmsPersonalWorkItems } from "./work-items-tms";

const WORK_ITEM_SYNC_INTERVAL_MS = 60_000;
const WORK_ITEM_READ_FRESHNESS_MS = 30_000;

type ResponsibilityProjection = {
  selectorType: WorkItemResponsibilitySelector;
  selectorKey: string;
  userId?: string;
  projectId?: string;
  roleCode?: string;
  engagementId?: string;
  isPrimary: boolean;
};

export type AccumulatedWorkItem = {
  item: WorkItem;
  originUserIds: Set<string>;
};

@Injectable()
export class WorkItemsSynchronizerService {
  private readonly logger = new Logger(WorkItemsSynchronizerService.name);
  private inFlight: Promise<void> | null = null;
  private lastCompletedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  syncForRead() {
    if (
      this.inFlight ||
      Date.now() - this.lastCompletedAt < WORK_ITEM_READ_FRESHNESS_MS
    ) {
      return;
    }
    void this.synchronize().catch((error) => {
      this.logger.error(
        "Unable to synchronize persisted work items for this read",
        error instanceof Error ? error.stack : String(error)
      );
    });
  }

  @Interval(WORK_ITEM_SYNC_INTERVAL_MS)
  async synchronizeOnInterval() {
    try {
      await this.synchronize();
    } catch (error) {
      this.logger.error(
        "Scheduled work-item synchronization failed",
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  synchronize() {
    if (!this.inFlight) {
      this.inFlight = this.synchronizeAll().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  private async synchronizeAll() {
    const [users, projects] = await Promise.all([
      this.prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, email: true, name: true, globalRole: true },
      }),
      this.prisma.project.findMany({
        where: { status: { not: "DELETED" } },
        select: { id: true },
      }),
    ]);
    const activeUsers: RequestUser[] = users;
    const current = new Map<string, AccumulatedWorkItem>();
    const add = (item: WorkItem, originUserId?: string) => {
      const key = workItemDedupeKey(item);
      const accumulated = current.get(key) ?? {
        item,
        originUserIds: new Set<string>(),
      };
      if (new Date(item.updatedAt) > new Date(accumulated.item.updatedAt)) {
        accumulated.item = item;
      }
      if (originUserId) {
        accumulated.originUserIds.add(originUserId);
      }
      current.set(key, accumulated);
    };

    const personalGroups = await mapInBatches(activeUsers, 8, async (user) => {
      const [emp, cmp, tms] = await Promise.all([
        buildEmpPersonalWorkItems(this.prisma, user, "zh-CN"),
        buildCmpPersonalWorkItems(this.prisma, user, "zh-CN"),
        buildTmsPersonalWorkItems(this.prisma, user, "zh-CN"),
      ]);
      return { userId: user.id, items: [...emp, ...cmp, ...tms] };
    });
    for (const group of personalGroups) {
      for (const item of group.items) {
        add(item, group.userId);
      }
    }

    const [projectionUser] = activeUsers;
    if (projectionUser) {
      const teamGroups = await mapInBatches(projects, 8, (project) =>
        buildProjectTeamWorkItems(
          this.prisma,
          projectionUser,
          project.id,
          "zh-CN"
        )
      );
      for (const items of teamGroups) {
        for (const item of items) {
          add(item);
        }
      }
    }

    const superAdmin = activeUsers.find(
      (user) => user.globalRole === "SUPER_ADMIN"
    );
    if (superAdmin) {
      for (const item of await buildOpsWorkItems(
        this.prisma,
        superAdmin,
        "zh-CN"
      )) {
        add(item);
      }
    }

    await this.reconcile(current);
    this.lastCompletedAt = Date.now();
  }

  private async reconcile(current: Map<string, AccumulatedWorkItem>) {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(78451239)`
      );
      await this.reconcileLocked(current, transaction);
    });
  }

  private async reconcileLocked(
    current: Map<string, AccumulatedWorkItem>,
    transaction: Prisma.TransactionClient
  ) {
    const stored = await transaction.workItemRecord.findMany({
      include: { responsibilities: true },
    });
    const storedByKey = new Map(stored.map((item) => [item.dedupeKey, item]));
    const activeKeys = new Set<string>();
    const attachmentIds = [
      ...new Set(
        [
          ...[...current.values()].map(({ item }) =>
            workItemAttachmentId(item)
          ),
          ...stored
            .filter((item) => item.status === "ACTIVE")
            .map(workItemAttachmentId),
        ].filter((id): id is string => Boolean(id))
      ),
    ];
    const liveAttachments = attachmentIds.length
      ? await transaction.attachment.findMany({
          where: { id: { in: attachmentIds }, deletedAt: null },
          select: { id: true },
        })
      : [];
    const liveAttachmentIds = new Set(liveAttachments.map((item) => item.id));

    for (const [dedupeKey, accumulated] of current) {
      const attachmentId = workItemAttachmentId(accumulated.item);
      if (attachmentId && !liveAttachmentIds.has(attachmentId)) {
        continue;
      }
      const responsibilities = inferWorkItemResponsibilities(accumulated);
      if (responsibilities.length === 0) {
        this.logger.error(
          `Work item ${dedupeKey} has no responsibility selector and was not opened`
        );
        continue;
      }
      activeKeys.add(dedupeKey);
      const { item } = accumulated;
      const existing = storedByKey.get(dedupeKey);
      const responsibilityKeys = responsibilities
        .map((responsibility) => responsibility.selectorKey)
        .sort();
      const existingKeys = (existing?.responsibilities ?? [])
        .map((responsibility) => responsibility.selectorKey)
        .sort();
      const contentParams = workItemContentParams(item);
      const { actionTarget } = item;
      const responsibilityChanged =
        responsibilityKeys.join("|") !== existingKeys.join("|");
      const itemChanged = Boolean(
        existing &&
        (existing.state !== item.state ||
          existing.severity !== item.severity ||
          existing.priority !== item.priority ||
          existing.displayContent !== item.title ||
          existing.sourceUpdatedAt.toISOString() !== item.updatedAt ||
          existing.projectId !== (item.project?.id ?? null) ||
          (existing.dueAt?.toISOString() ?? null) !== item.dueAt ||
          JSON.stringify(existing.contentParams) !==
            JSON.stringify(contentParams) ||
          JSON.stringify(existing.actionTarget) !==
            JSON.stringify(actionTarget))
      );
      const reopened =
        existing?.status !== undefined && existing.status !== "ACTIVE";
      const eventType = existing
        ? reopened
          ? "REOPENED"
          : responsibilityChanged
            ? "RESPONSIBILITY_CHANGED"
            : itemChanged
              ? "UPDATED"
              : null
        : "OPENED";
      if (existing && !eventType) {
        continue;
      }
      const record = {
        dedupeKey,
        ruleId: item.ruleId,
        cycleKey: "active",
        domain: item.domain,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        projectId: item.project?.id ?? null,
        status: "ACTIVE" as const,
        state: item.state,
        severity: item.severity,
        priority: item.priority,
        locale: "zh-CN",
        displayContent: item.title,
        contentKey: item.ruleId,
        contentParams: contentParams as Prisma.InputJsonValue,
        actionTarget: actionTarget as Prisma.InputJsonValue,
        dueAt: item.dueAt ? new Date(item.dueAt) : null,
        openedAt: new Date(item.openedAt),
        sourceUpdatedAt: new Date(item.updatedAt),
        resolvedAt: null,
        resolutionReason: null,
      };
      const nestedResponsibilities = responsibilities.map((responsibility) => ({
        selectorType: responsibility.selectorType,
        selectorKey: responsibility.selectorKey,
        userId: responsibility.userId,
        projectId: responsibility.projectId,
        roleCode: responsibility.roleCode,
        engagementId: responsibility.engagementId,
        isPrimary: responsibility.isPrimary,
      }));
      if (!existing) {
        await transaction.workItemRecord.create({
          data: {
            ...record,
            responsibilities: { create: nestedResponsibilities },
            events: {
              create: {
                type: "OPENED",
                payload: workItemEventPayload(item) as Prisma.InputJsonValue,
              },
            },
          },
        });
        continue;
      }
      await transaction.workItemRecord.update({
        where: { id: existing.id },
        data: {
          ...record,
          responsibilities: responsibilityChanged
            ? {
                deleteMany: {},
                create: nestedResponsibilities,
              }
            : undefined,
          events: eventType
            ? {
                create: {
                  type: eventType,
                  payload: workItemEventPayload(item) as Prisma.InputJsonValue,
                },
              }
            : undefined,
        },
      });
    }

    const resolvedAt = new Date();
    for (const existing of stored) {
      if (existing.status !== "ACTIVE" || activeKeys.has(existing.dedupeKey)) {
        continue;
      }
      const attachmentId = workItemAttachmentId(existing);
      const resolutionReason =
        attachmentId && !liveAttachmentIds.has(attachmentId)
          ? "ATTACHMENT_DELETED"
          : existing.ruleId === "PRJ-015"
            ? "ROUTED_TO_OPS"
            : "DOMAIN_STATE_NORMALIZED";
      const cancelled = resolutionReason === "ATTACHMENT_DELETED";
      await transaction.workItemRecord.update({
        where: { id: existing.id },
        data: {
          status: cancelled ? "CANCELLED" : "RESOLVED",
          resolvedAt,
          resolutionReason,
          ...(cancelled
            ? { actionTarget: unavailableWorkItemTarget(existing.actionTarget) }
            : {}),
          events: {
            create: {
              type: cancelled ? "CANCELLED" : "RESOLVED",
              payload: { reason: resolutionReason },
            },
          },
        },
      });
    }
  }
}

export function workItemDedupeKey(item: WorkItem) {
  return `${item.ruleId}:${item.subjectType}:${item.subjectId}:active`;
}

export function inferWorkItemResponsibilities(
  accumulated: AccumulatedWorkItem
) {
  const { item } = accumulated;
  const responsibilities = new Map<string, ResponsibilityProjection>();
  const add = (responsibility: ResponsibilityProjection) => {
    responsibilities.set(responsibility.selectorKey, responsibility);
  };
  if (item.assignedTo) {
    add(userResponsibility(item.assignedTo.id, true));
  }
  for (const userId of accumulated.originUserIds) {
    add(userResponsibility(userId, !item.assignedTo));
  }
  if (item.ruleId === "PRJ-005" && item.createdBy) {
    add(userResponsibility(item.createdBy.id, false));
  }
  if (item.view === "TEAM" && item.project) {
    add({
      selectorType: "PROJECT_ALL_MEMBERS",
      selectorKey: `PROJECT_ALL_MEMBERS:${item.project.id}`,
      projectId: item.project.id,
      isPrimary: !item.assignedTo,
    });
  }
  if (item.domain === "OPS" || item.ruleId === "EMP-009") {
    add(globalRoleResponsibility("SUPER_ADMIN"));
  }
  if (["CMP-014", "CMP-015", "CMP-017"].includes(item.ruleId)) {
    add(globalRoleResponsibility("FINANCE"));
  }
  if (["PRJ-004", "PRJ-009", "EMP-005"].includes(item.ruleId) && item.project) {
    add({
      selectorType: "PROJECT_ROLE",
      selectorKey: `PROJECT_ROLE:${item.project.id}:PARTNER`,
      projectId: item.project.id,
      roleCode: "PARTNER",
      isPrimary: false,
    });
  }
  const { engagementId } = item.actionTarget.params;
  if (typeof engagementId === "string" && engagementId) {
    add({
      selectorType: "ENGAGEMENT_PIC_MIC",
      selectorKey: `ENGAGEMENT_PIC_MIC:${engagementId}`,
      engagementId,
      isPrimary: !item.assignedTo,
    });
  }
  if (["PRJ-015", "CMP-017", "OPS-003", "OPS-005"].includes(item.ruleId)) {
    add({
      selectorType: "SYSTEM_THEN",
      selectorKey: `SYSTEM_THEN:${item.ruleId}`,
      roleCode: item.ruleId === "CMP-017" ? "FINANCE" : "SUPER_ADMIN",
      isPrimary: false,
    });
  }
  return [...responsibilities.values()];
}

function userResponsibility(userId: string, isPrimary: boolean) {
  return {
    selectorType: "USER" as const,
    selectorKey: `USER:${userId}`,
    userId,
    isPrimary,
  };
}

function globalRoleResponsibility(roleCode: string) {
  return {
    selectorType: "GLOBAL_ROLE" as const,
    selectorKey: `GLOBAL_ROLE:${roleCode}`,
    roleCode,
    isPrimary: true,
  };
}

function workItemContentParams(item: WorkItem) {
  return {
    projectCode: item.project?.projectCode ?? null,
    projectName: item.project?.name ?? null,
    reference: item.reference,
    objectLabel: item.objectLabel,
    assignedTo: item.assignedTo?.name ?? null,
    createdBy: item.createdBy?.name ?? null,
  };
}

function workItemEventPayload(item: WorkItem) {
  return {
    state: item.state,
    severity: item.severity,
    priority: item.priority,
    sourceUpdatedAt: item.updatedAt,
  };
}

async function mapInBatches<TInput, TOutput>(
  inputs: TInput[],
  batchSize: number,
  mapper: (input: TInput) => Promise<TOutput>
) {
  const output: TOutput[] = [];
  for (let index = 0; index < inputs.length; index += batchSize) {
    const batch = inputs.slice(index, index + batchSize);
    output.push(...(await Promise.all(batch.map(mapper))));
  }
  return output;
}
