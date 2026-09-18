import type { Prisma } from "@prisma/client";
import { canManageProjectLeadership } from "@project-wing/shared";

import {
  ApiBadRequestException,
  ApiForbiddenException,
} from "../common/api-error";

/** Same project/account lock order as PIC recovery; invitation never assigns leadership. */
export async function requirePicRecoveryInvitation(
  tx: Prisma.TransactionClient,
  projectId: string,
  actorId: string,
  recipientId: string,
  recipientEmail: string
) {
  await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM users WHERE id IN (${actorId}, ${recipientId}) OR id IN (SELECT user_id FROM project_members WHERE project_id = ${projectId}) ORDER BY id FOR SHARE`;
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { status: true },
  });
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: { status: true, globalRole: true },
  });
  if (
    !project ||
    project.status === "DELETED" ||
    actor?.status !== "ACTIVE" ||
    actor.globalRole !== "SUPER_ADMIN"
  ) {
    throw new ApiForbiddenException("FORBIDDEN", "当前不能发起 PIC 恢复邀请");
  }
  const members = await tx.projectMember.findMany({
    where: { projectId, status: "ACTIVE" },
    include: { user: { select: { status: true, globalRole: true } } },
  });
  if (
    members.some(
      (member) =>
        member.user.status === "ACTIVE" &&
        canManageProjectLeadership({
          globalRole: member.user.globalRole,
          projectRole: member.projectRole,
          inChargeRole: member.inChargeRole,
          authorizationSuspended: Boolean(member.authorizationSuspendedAt),
        })
    )
  ) {
    throw new ApiBadRequestException("VALIDATION_FAILED", "项目已有有效 PIC");
  }
  if (
    members.some(
      (member) =>
        member.user.status === "ACTIVE" &&
        ["PARTNER", "PRINCIPAL"].includes(member.user.globalRole)
    )
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "请从已加入的合资格成员中恢复 PIC"
    );
  }
  const recipient = await tx.user.findUnique({
    where: { id: recipientId },
    select: { status: true, globalRole: true, email: true },
  });
  if (
    recipient?.status !== "ACTIVE" ||
    recipient.email !== recipientEmail ||
    !["PARTNER", "PRINCIPAL"].includes(recipient.globalRole) ||
    members.some((member) => member.userId === recipientId)
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "请选择未加入项目的 Partner 或 Principal"
    );
  }
  const pending = await tx.projectInvitation.findFirst({
    where: {
      projectId,
      recipientEmail: recipient.email,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (pending) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "该用户已有待处理邀请，请勿重复邀请"
    );
  }
}
