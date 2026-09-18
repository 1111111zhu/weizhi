import { randomBytes, randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { GlobalRole, Prisma, UserStatus } from "@prisma/client";
import { getStandardHourlyRate } from "@project-wing/shared";
import type {
  ProjectInviteeDirectoryQueryInput,
  UpdateUserInput,
  UserListQueryInput,
} from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { hashProjectWingPassword } from "../auth/better-auth-options";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { projectAuthorizationImpact } from "./project-authorization-impact";

type ProjectInviteeDirectoryRequest = ProjectInviteeDirectoryQueryInput & {
  browseAll?: boolean;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async roleImpact(userId: string, globalRole: GlobalRole) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { globalRole: true },
    });
    if (!user) {
      throw new ApiNotFoundException("NOT_FOUND", "用户不存在");
    }
    const members = await this.prisma.projectMember.findMany({
      where: { userId, status: "ACTIVE" },
      include: { project: { select: { projectCode: true, name: true } } },
    });
    return projectAuthorizationImpact(globalRole, members, user.globalRole);
  }

  async list(query: UserListQueryInput = {}) {
    await Promise.resolve();
    const where = this.buildUserListWhere(query);
    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        staffNo: true,
        hourlyRate: true,
        globalRole: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async directory() {
    await Promise.resolve();
    return this.prisma.user.findMany({
      where: { status: "ACTIVE", globalRole: { not: "SUPER_ADMIN" } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        status: true,
      },
    });
  }

  async projectInvitees(
    query: ProjectInviteeDirectoryRequest,
    user: RequestUser
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.q?.trim();
    if (query.browseAll) {
      if (user.globalRole !== "PARTNER") {
        throw new ApiForbiddenException(
          "PROJECT_INVITEE_LIST_FORBIDDEN",
          "Only Partners can browse the full employee directory"
        );
      }
    } else if (!search || search.length < 2) {
      throw new ApiBadRequestException(
        "PROJECT_INVITEE_SEARCH_TOO_SHORT",
        "Enter at least two letters to search employees"
      );
    }
    const where: Prisma.UserWhereInput = {
      status: "ACTIVE",
      globalRole: { notIn: ["SUPER_ADMIN", "CONFIRMATION_OFFICER"] },
      ...(query.excludeUserIds?.length
        ? { id: { notIn: query.excludeUserIds } }
        : {}),
      ...(query.globalRole ? { globalRole: query.globalRole } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ name: "asc" }, { email: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          globalRole: true,
          status: true,
        },
      }),
    ]);
    return {
      users,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async create(
    input: {
      email: string;
      name: string;
      password: string;
      globalRole: GlobalRole;
    },
    actorId: string,
    source?: AuditLogSource
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw new ApiBadRequestException(
        "EMAIL_ALREADY_EXISTS",
        "该邮箱已被使用"
      );
    }
    const id = randomUUID();
    const staffNo = await this.nextStaffNo();
    const hourlyRate = getStandardHourlyRate(input.globalRole) ?? null;
    const credentialPasswordHash = await hashProjectWingPassword(
      input.password
    );
    const user = await this.prisma.user.create({
      data: {
        id,
        email: input.email,
        name: input.name,
        staffNo,
        hourlyRate,
        emailVerified: true,
        globalRole: input.globalRole,
        authAccounts: {
          create: {
            accountId: id,
            providerId: "credential",
            password: credentialPasswordHash,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        staffNo: true,
        hourlyRate: true,
        globalRole: true,
        status: true,
        createdAt: true,
      },
    });
    await this.auditLogs.log({
      actorId,
      action: "USER_CREATED",
      targetType: "USER",
      targetId: user.id,
      description: `创建用户 ${user.email}`,
      source,
    });
    return user;
  }

  async update(
    userId: string,
    input: UpdateUserInput,
    actorId: string,
    source?: AuditLogSource
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        staffNo: true,
        hourlyRate: true,
        globalRole: true,
        status: true,
      },
    });
    if (!user) {
      throw new ApiNotFoundException("NOT_FOUND", "用户不存在");
    }
    if (user.id === actorId) {
      if (input.status === "DISABLED") {
        throw new ApiBadRequestException(
          "BAD_REQUEST",
          "不能禁用当前登录的 Super Admin 账号"
        );
      }
      if (input.globalRole && input.globalRole !== "SUPER_ADMIN") {
        throw new ApiBadRequestException(
          "BAD_REQUEST",
          "不能移除当前登录账号的 Super Admin 职级"
        );
      }
    }
    const wouldRemoveActiveSuperAdmin =
      user.globalRole === "SUPER_ADMIN" &&
      user.status === "ACTIVE" &&
      (input.status === "DISABLED" ||
        (input.globalRole !== undefined && input.globalRole !== "SUPER_ADMIN"));
    if (wouldRemoveActiveSuperAdmin) {
      const activeSuperAdmins = await this.prisma.user.count({
        where: { globalRole: "SUPER_ADMIN", status: "ACTIVE" },
      });
      if (activeSuperAdmins <= 1) {
        throw new ApiBadRequestException(
          "LAST_SUPER_ADMIN",
          "至少保留一个启用的超级管理员"
        );
      }
    }

    const data: {
      globalRole?: GlobalRole;
      status?: UserStatus;
      hourlyRate?: number | null;
    } = {};
    if (input.globalRole !== undefined) {
      data.globalRole = input.globalRole;
      const standardRate = getStandardHourlyRate(input.globalRole);
      if (standardRate !== undefined) {
        data.hourlyRate = standardRate;
      }
    }
    if (input.status !== undefined) {
      data.status = input.status;
    }
    if (Object.keys(data).length === 0) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "用户更新信息不完整"
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          staffNo: true,
          hourlyRate: true,
          globalRole: true,
          status: true,
          createdAt: true,
        },
      });
      if (input.globalRole && input.globalRole !== user.globalRole) {
        const memberships = await tx.projectMember.findMany({
          where: { userId: user.id, status: "ACTIVE" },
          include: { project: { select: { projectCode: true, name: true } } },
        });
        const impact = projectAuthorizationImpact(
          input.globalRole,
          memberships,
          user.globalRole
        );
        if (
          impact.projects.length &&
          input.projectAuthorizationImpactToken !== impact.token
        ) {
          throw new ApiBadRequestException(
            "VALIDATION_FAILED",
            "项目授权影响已变化，请重新确认受影响的项目后再保存职级"
          );
        }
        if (impact.projects.length) {
          await tx.projectMember.updateMany({
            where: {
              id: { in: impact.projects.map((project) => project.memberId) },
            },
            data: { authorizationSuspendedAt: new Date() },
          });
          for (const project of impact.projects) {
            await this.auditLogs.logInTransaction(tx, {
              actorId,
              action: "PROJECT_AUTHORIZATION_SUSPENDED",
              targetType: "PROJECT_MEMBER",
              targetId: project.memberId,
              projectId: project.projectId,
              description: `职级 ${user.globalRole} -> ${input.globalRole}；保留历史记录，项目访问暂停，等待 PIC 重新授权`,
              source,
            });
          }
        }
      }
      if (
        (user.status !== "DISABLED" && input.status === "DISABLED") ||
        (input.globalRole && input.globalRole !== user.globalRole)
      ) {
        await tx.authSession.deleteMany({ where: { userId: user.id } });
      }
      await this.auditLogs.logInTransaction(tx, {
        actorId,
        action: "USER_UPDATED",
        targetType: "USER",
        targetId: user.id,
        description: `修改用户 ${user.email}：${this.describeUserChanges(
          user,
          input
        )}`,
        source,
      });
      return updatedUser;
    });
    return updated;
  }

  async resetPassword(
    userId: string,
    actorId: string,
    source?: AuditLogSource
  ) {
    const temporaryPassword = `Pw${randomBytes(12).toString("base64url")}!`;
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!existing) {
      throw new ApiNotFoundException("NOT_FOUND", "用户不存在");
    }
    const credentialPasswordHash =
      await hashProjectWingPassword(temporaryPassword);
    const user = await this.prisma.$transaction(async (tx) => {
      await tx.authAccount.upsert({
        where: {
          providerId_accountId: {
            providerId: "credential",
            accountId: userId,
          },
        },
        create: {
          userId,
          providerId: "credential",
          accountId: userId,
          password: credentialPasswordHash,
        },
        update: { password: credentialPasswordHash },
      });
      await tx.authSession.deleteMany({ where: { userId } });
      return existing;
    });
    await this.auditLogs.log({
      actorId,
      action: "PASSWORD_RESET",
      targetType: "USER",
      targetId: user.id,
      description: `重置用户 ${user.email} 密码`,
      source,
    });
    return { user, temporaryPassword };
  }

  private describeUserChanges(
    user: {
      globalRole: GlobalRole;
      status: UserStatus;
      staffNo?: string | null;
      hourlyRate?: unknown;
    },
    input: UpdateUserInput
  ) {
    const changes = [
      input.globalRole && input.globalRole !== user.globalRole
        ? `全局职级 ${user.globalRole} -> ${input.globalRole}`
        : null,
      input.status && input.status !== user.status
        ? `状态 ${user.status} -> ${input.status}`
        : null,
      input.globalRole !== undefined &&
      getStandardHourlyRate(input.globalRole) !== undefined &&
      String(getStandardHourlyRate(input.globalRole)) !==
        String(user.hourlyRate ?? "")
        ? `Rate ${String(user.hourlyRate ?? "未设置")} -> ${String(getStandardHourlyRate(input.globalRole))}`
        : null,
    ].filter(Boolean);
    return changes.length > 0 ? changes.join("，") : "无字段变化";
  }

  private buildUserListWhere(query: UserListQueryInput): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ];
    }
    if (query.globalRole) {
      where.globalRole = query.globalRole;
    }
    if (query.status) {
      where.status = query.status;
    }
    return where;
  }

  private async nextStaffNo() {
    const users = await this.prisma.user.findMany({
      select: { staffNo: true },
    });
    const highestStaffNo = users.reduce((highest, user) => {
      const staffNo = user.staffNo?.trim() ?? "";
      if (!/^\d+$/.test(staffNo)) {
        return highest;
      }
      return Math.max(highest, Number(staffNo));
    }, -1);
    return String(highestStaffNo + 1).padStart(3, "0");
  }
}
