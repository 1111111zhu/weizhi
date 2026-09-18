import { Injectable } from "@nestjs/common";
import type { ProjectRole } from "@prisma/client";
import {
  canProjectMemberPerformAction,
  isProjectPermissionSubjectConsistent,
  LEGACY_PROJECT_ROLE_ACTIONS,
} from "@project-wing/shared";
import type { ProjectPermissionAction } from "@project-wing/shared";

import {
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  // Administrator visibility is not a business membership or a leadership grant.
  private async findSuperAdminProjectMember(projectId: string, userId: string) {
    const user = await this.prisma.user?.findUnique({
      where: { id: userId },
      select: { globalRole: true, status: true },
    });
    if (user?.globalRole !== "SUPER_ADMIN" || user.status !== "ACTIVE") {
      return null;
    }

    const project = await this.prisma.project?.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    });
    if (!project) {
      return null;
    }

    return {
      id: `super-admin:${projectId}:${userId}`,
      projectId,
      userId,
      projectRole: "PREPARER" as const,
      inChargeRole: null,
      authorizationSuspendedAt: null,
      status: "ACTIVE" as const,
      joinedAt: new Date(0),
      createdAt: new Date(0),
      updatedAt: new Date(0),
      isVirtualSuperAdmin: true as const,
      user,
      project,
    };
  }

  async requireProjectMember(projectId: string, userId: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: {
        project: { select: { status: true } },
        user: { select: { globalRole: true, status: true } },
      },
    });
    const effectiveMember =
      member?.status === "ACTIVE" && member.user.globalRole !== "SUPER_ADMIN"
        ? member
        : await this.findSuperAdminProjectMember(projectId, userId);
    if (!effectiveMember) {
      throw new ApiNotFoundException(
        "PROJECT_NOT_FOUND",
        "Project does not exist or you do not have access"
      );
    }
    if (
      !("isVirtualSuperAdmin" in effectiveMember) &&
      (effectiveMember.user.status !== "ACTIVE" ||
        !isProjectPermissionSubjectConsistent({
          authorizationSuspended: Boolean(
            effectiveMember.authorizationSuspendedAt
          ),
          globalRole: effectiveMember.user.globalRole,
          projectRole: effectiveMember.projectRole,
          inChargeRole: effectiveMember.inChargeRole,
        }))
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "项目授权与当前职级不一致，请联系项目负责人或系统管理员处理"
      );
    }
    return effectiveMember;
  }

  async requireMutableProject(projectId: string, userId: string) {
    const effectiveMember = await this.requireProjectMember(projectId, userId);
    if (effectiveMember.project.status === "DELETED") {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Project is deleted and cannot be modified"
      );
    }
    if (effectiveMember.project.status === "ARCHIVED") {
      throw new ApiForbiddenException(
        "PROJECT_ARCHIVED",
        "Project is archived and cannot be modified"
      );
    }
    if (effectiveMember.project.status === "PENDING_FINAL_CHECK") {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Project is pending final check and read-only"
      );
    }
    return effectiveMember;
  }

  async requireActiveProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    });
    if (!project || project.status !== "ACTIVE") {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Project is not active and is read-only"
      );
    }
    return project;
  }

  requireProjectRole(
    projectId: string,
    userId: string,
    minimumRole: ProjectRole
  ) {
    return this.requireProjectAction(
      projectId,
      userId,
      LEGACY_PROJECT_ROLE_ACTIONS[minimumRole]
    );
  }

  async requireProjectAction(
    projectId: string,
    userId: string,
    action: ProjectPermissionAction
  ) {
    if (action === "restoreProject") {
      const member = await this.requireProjectMember(projectId, userId);
      if (
        member.project.status !== "DELETED" ||
        !canProjectMemberPerformAction(
          {
            globalRole: member.user.globalRole,
            projectRole: member.projectRole,
            inChargeRole: member.inChargeRole,
            authorizationSuspended: Boolean(member.authorizationSuspendedAt),
          },
          action
        )
      ) {
        throw new ApiForbiddenException(
          "FORBIDDEN",
          "Project cannot be restored by this account"
        );
      }
      return member;
    }
    if (
      ["viewRecycleBin", "viewTemporaryFiles", "viewNotifications"].includes(
        action
      )
    ) {
      const member = await this.requireProjectMember(projectId, userId);
      if ("isVirtualSuperAdmin" in member) {
        return member;
      }
    }
    const effectiveMember = await this.requireMutableProject(projectId, userId);
    if (
      !canProjectMemberPerformAction(
        {
          authorizationSuspended: Boolean(
            effectiveMember.authorizationSuspendedAt
          ),
          globalRole: effectiveMember.user.globalRole,
          projectRole: effectiveMember.projectRole,
          inChargeRole: effectiveMember.inChargeRole,
        },
        action
      )
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "You do not have permission to perform this action"
      );
    }
    return effectiveMember;
  }
}
