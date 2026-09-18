import { Injectable } from "@nestjs/common";
import type { UpdateWorkspaceInput } from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import { ApiNotFoundException } from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async list(user: RequestUser) {
    const workspaces = await this.prisma.workspace.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        placements: {
          where: { project: { status: "ACTIVE" } },
          orderBy: { updatedAt: "desc" },
          include: { project: { include: { frameworkTemplate: true } } },
        },
      },
    });
    return workspaces.map(({ placements, ...workspace }) => ({
      ...workspace,
      projects: placements.map((placement) => ({
        ...placement.project,
        workspaceId: workspace.id,
      })),
    }));
  }

  async create(
    input: { name: string; clientName: string; description?: string },
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const workspace = await this.prisma.workspace.create({
      data: {
        name: input.name,
        clientName: input.clientName,
        description: input.description,
        ownerId: user.id,
      },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "WORKSPACE_CREATED",
      targetType: "WORKSPACE",
      targetId: workspace.id,
      description: `创建 Workspace ${workspace.name}`,
      source,
    });
    return { ...workspace, projects: [] };
  }

  async update(
    workspaceId: string,
    user: RequestUser,
    input: UpdateWorkspaceInput,
    source?: AuditLogSource
  ) {
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId, ownerId: user.id },
      data: {
        name: input.name,
        clientName: input.clientName,
        description: input.description,
      },
      include: {
        placements: {
          where: { project: { status: "ACTIVE" } },
          orderBy: { updatedAt: "desc" },
          include: { project: { include: { frameworkTemplate: true } } },
        },
      },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "WORKSPACE_UPDATED",
      source,
      targetType: "WORKSPACE",
      targetId: workspace.id,
      description: `更新 Workspace ${workspace.name}`,
    });
    const { placements, ...rest } = workspace;
    return {
      ...rest,
      projects: placements.map((placement) => ({
        ...placement.project,
        workspaceId: workspace.id,
      })),
    };
  }

  async requireWorkspaceOwner(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, ownerId: userId },
    });
    if (!workspace) {
      throw new ApiNotFoundException("NOT_FOUND", "Workspace 不存在或无权访问");
    }
    return workspace;
  }
}
