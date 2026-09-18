import {
  canManageProjectLeadership,
  isProjectPermissionSubjectConsistent,
} from "@project-wing/shared";
import type {
  InChargeRole,
  ReauthorizeProjectMemberInput,
} from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import type { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiForbiddenException,
} from "../common/api-error";
import type { PrismaService } from "../prisma/prisma.service";

/** Leadership changes are serialized per project; the audit record commits with the grant. */
export function changeProjectLeadership(
  prisma: PrismaService,
  audit: AuditLogsService,
  projectId: string,
  memberId: string,
  actor: RequestUser,
  inChargeRole: InChargeRole | null,
  source?: AuditLogSource,
  recoveryReason?: string,
  reauthorization?: ReauthorizeProjectMemberInput
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`;
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });
    if (
      !project ||
      project.status === "DELETED" ||
      (project.status !== "ACTIVE" &&
        recoveryReason === undefined &&
        !reauthorization)
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "只有进行中的项目可以设置负责人"
      );
    }
    // Lock account eligibility and existing member grants until the change commits.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.id} OR id IN (SELECT user_id FROM project_members WHERE project_id = ${projectId}) ORDER BY id FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM project_members WHERE project_id = ${projectId} ORDER BY id FOR UPDATE`;
    const account = await tx.user.findUnique({
      where: { id: actor.id },
      select: { globalRole: true, status: true },
    });
    const members = await tx.projectMember.findMany({
      where: { projectId, status: "ACTIVE" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            globalRole: true,
            status: true,
          },
        },
      },
    });
    const subject = (member: (typeof members)[number]) => ({
      authorizationSuspended: Boolean(member.authorizationSuspendedAt),
      globalRole: member.user.globalRole,
      projectRole: member.projectRole,
      inChargeRole: member.inChargeRole,
    });
    const effectivePics = members.filter(
      (member) =>
        member.user.status === "ACTIVE" &&
        canManageProjectLeadership(subject(member))
    );
    const actingMember = members.find((member) => member.userId === actor.id);
    const recovering = recoveryReason !== undefined;
    if (!account || account.status !== "ACTIVE") {
      throw new ApiForbiddenException("FORBIDDEN", "账号不可用");
    }
    if (recovering) {
      if (account.globalRole !== "SUPER_ADMIN") {
        throw new ApiForbiddenException(
          "FORBIDDEN",
          "只有系统管理员可以恢复项目 PIC"
        );
      }
      if (
        !recoveryReason.trim() ||
        recoveryReason.length > 1000 ||
        inChargeRole !== "PARTNER_IN_CHARGE"
      ) {
        throw new ApiBadRequestException("VALIDATION_FAILED", "请填写恢复原因");
      }
      if (effectivePics.length) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "项目已有有效 PIC，请由 PIC 管理负责人"
        );
      }
    } else if (
      account.globalRole !== "SUPER_ADMIN" &&
      (!actingMember ||
        !effectivePics.some((member) => member.id === actingMember.id))
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "只有当前有效 PIC 可以设置或更换负责人；无有效 PIC 时请联系管理员恢复"
      );
    }
    const member = members.find((item) => item.id === memberId);
    if (!member) {
      throw new ApiBadRequestException("NOT_FOUND", "项目成员不存在或已被移除");
    }
    if (
      reauthorization &&
      (!reauthorization.reason.trim() || reauthorization.reason.length > 1000)
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "请填写重新授权原因"
      );
    }
    if (
      reauthorization &&
      isProjectPermissionSubjectConsistent(subject(member))
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "该成员授权仍然有效，无需恢复"
      );
    }
    const projectRole = inChargeRole
      ? inChargeRole === "PARTNER_IN_CHARGE"
        ? "PARTNER"
        : "REVIEWER"
      : (reauthorization?.projectRole ?? member.projectRole);
    if ((inChargeRole || reauthorization) && member.userId === actor.id) {
      throw new ApiForbiddenException("FORBIDDEN", "不能为自己设置负责人身份");
    }
    if (
      (inChargeRole || reauthorization) &&
      (member.user.status !== "ACTIVE" ||
        !isProjectPermissionSubjectConsistent({
          ...subject(member),
          authorizationSuspended: false,
          projectRole,
          inChargeRole,
        }))
    ) {
      throw new ApiBadRequestException(
        "INVALID_IN_CHARGE_ROLE",
        "该成员当前职级或项目职责不能承担此负责人身份"
      );
    }
    if (
      !recovering &&
      inChargeRole !== "PARTNER_IN_CHARGE" &&
      effectivePics.some((item) => item.id === memberId) &&
      effectivePics.length === 1
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "请先指定另一位有效 PIC，再取消当前 PIC"
      );
    }
    const updated = await tx.projectMember.update({
      where: { id: memberId },
      data: {
        inChargeRole,
        projectRole,
        ...(inChargeRole || reauthorization
          ? { authorizationSuspendedAt: null }
          : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, globalRole: true },
        },
      },
    });
    await audit.logInTransaction(tx, {
      actorId: actor.id,
      action: recovering
        ? "PROJECT_PIC_RECOVERED"
        : reauthorization
          ? "PROJECT_AUTHORIZATION_RESTORED"
          : "PROJECT_MEMBER_IN_CHARGE_UPDATED",
      targetType: "PROJECT_MEMBER",
      targetId: memberId,
      projectId,
      description: `${member.user.email}: ${member.projectRole}/${member.inChargeRole ?? "none"} -> ${projectRole}/${inChargeRole ?? "none"}${recovering ? `; recovery reason: ${recoveryReason}` : reauthorization ? `; reauthorization reason: ${reauthorization.reason}` : ""}`,
      source,
    });
    return updated;
  });
}
