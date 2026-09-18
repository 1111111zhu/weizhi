import { Controller, Get, Param, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/request-user";
import { ApiNotFoundException } from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogsService } from "./audit-logs.service";

@UseGuards(AuthGuard)
@Controller("engagement/:projectId/audit-logs")
export class AuditLogsController {
  constructor(
    private readonly auditLogs: AuditLogsService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  async list(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!project) {
      throw new ApiNotFoundException(
        "PROJECT_NOT_FOUND",
        "项目不存在或无权访问"
      );
    }
    if (user.globalRole === "SUPER_ADMIN") {
      return this.auditLogs.listForProject(projectId);
    }

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (!member || member.status !== "ACTIVE") {
      throw new ApiNotFoundException(
        "PROJECT_NOT_FOUND",
        "项目不存在或无权访问"
      );
    }
    return this.auditLogs.listForProject(projectId);
  }
}
