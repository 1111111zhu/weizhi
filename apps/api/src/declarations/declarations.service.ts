import { Injectable } from "@nestjs/common";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import { ApiForbiddenException } from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectAccessService } from "../projects/project-access.service";

@Injectable()
export class DeclarationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly access: ProjectAccessService
  ) {}

  async status(user: RequestUser, projectId: string) {
    if (
      user.globalRole === "SUPER_ADMIN" ||
      user.globalRole === "CONFIRMATION_OFFICER"
    ) {
      return { accepted: true, acceptedAt: null };
    }
    const member = await this.access.requireProjectMember(projectId, user.id);
    const declaration = await this.prisma.independenceDeclaration.findFirst({
      where: {
        userId: user.id,
        projectId,
        declarationVersion: "v1",
        acceptedAt: { gte: member.joinedAt },
      },
      orderBy: { acceptedAt: "desc" },
    });
    return {
      accepted: Boolean(declaration),
      acceptedAt: declaration?.acceptedAt ?? null,
    };
  }

  async acceptProject(
    userId: string,
    projectId: string,
    source = "web",
    auditSource?: AuditLogSource
  ) {
    const member = await this.access.requireProjectMember(projectId, userId);
    if ("isVirtualSuperAdmin" in member) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "系统管理员查看项目不需要签署项目成员声明"
      );
    }
    const existing = await this.prisma.independenceDeclaration.findFirst({
      where: {
        userId,
        projectId,
        declarationVersion: "v1",
        acceptedAt: { gte: member.joinedAt },
      },
      orderBy: { acceptedAt: "desc" },
    });
    if (existing) {
      return existing;
    }
    const declaration = await this.prisma.independenceDeclaration.create({
      data: {
        userId,
        projectId,
        declarationVersion: "v1",
        source,
      },
    });
    await this.auditLogs.log({
      actorId: userId,
      action: "DECLARATION_ACCEPTED",
      targetType: "INDEPENDENCE_DECLARATION",
      targetId: declaration.id,
      projectId,
      description: "确认项目独立性声明",
      source: auditSource,
    });
    return declaration;
  }

  async accept(userId: string, source = "web", auditSource?: AuditLogSource) {
    const existing = await this.prisma.independenceDeclaration.findFirst({
      where: { userId, projectId: null, declarationVersion: "v1" },
    });
    if (existing) {
      return existing;
    }
    const declaration = await this.prisma.independenceDeclaration.create({
      data: {
        userId,
        projectId: null,
        declarationVersion: "v1",
        source,
      },
    });
    await this.auditLogs.log({
      actorId: userId,
      action: "DECLARATION_ACCEPTED",
      targetType: "INDEPENDENCE_DECLARATION",
      targetId: declaration.id,
      description: "确认独立性声明",
      source: auditSource,
    });
    return declaration;
  }
}
