import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  AcceptInvitationSchema,
  CreateInvitationSchema,
  RecoverProjectPicSchema,
  CreatePicRecoveryInvitationSchema,
  ReauthorizeProjectMemberSchema,
  UpdateProjectMemberInChargeRoleSchema,
  UpdateProjectMemberRoleSchema,
} from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditSource } from "../audit-logs/audit-source.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/request-user";
import { ApiBadRequestException } from "../common/api-error";
import { MembersService } from "./members.service";

@UseGuards(AuthGuard)
@Controller()
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get("engagement/:projectId/members")
  list(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.members.list(projectId, user);
  }

  @Get("engagement/:projectId/member-directory")
  listDirectory(
    @Param("projectId") projectId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.members.listDirectory(projectId, user);
  }

  @Post("engagement/:projectId/invitations")
  createInvitation(
    @Param("projectId") projectId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateInvitationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "邀请信息无效");
    }
    return this.members.createInvitation(projectId, user, parsed.data, source);
  }

  @Post("engagement/:projectId/pic-recovery-invitations")
  createPicRecoveryInvitation(
    @Param("projectId") projectId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreatePicRecoveryInvitationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "请选择收件人并填写恢复原因"
      );
    }
    return this.members.createPicRecoveryInvitation(
      projectId,
      user,
      parsed.data,
      source
    );
  }

  @Delete("engagement/:projectId/invitations/:invitationId")
  cancelInvitation(
    @Param("projectId") projectId: string,
    @Param("invitationId") invitationId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.members.cancelInvitation(projectId, invitationId, user, source);
  }

  @Patch("engagement/:projectId/members/:memberId")
  updateMemberRole(
    @Param("projectId") projectId: string,
    @Param("memberId") memberId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UpdateProjectMemberRoleSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "项目成员职责无效");
    }
    return this.members.updateMemberRole(
      projectId,
      memberId,
      user,
      parsed.data,
      source
    );
  }

  @Patch("engagement/:projectId/members/:memberId/in-charge")
  updateMemberInChargeRole(
    @Param("projectId") projectId: string,
    @Param("memberId") memberId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UpdateProjectMemberInChargeRoleSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "项目成员 In Charge 标记无效"
      );
    }
    return this.members.updateMemberInChargeRole(
      projectId,
      memberId,
      user,
      parsed.data,
      source
    );
  }

  @Post("engagement/:projectId/members/:memberId/recover-pic")
  recoverProjectPic(
    @Param("projectId") projectId: string,
    @Param("memberId") memberId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = RecoverProjectPicSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "请填写恢复 PIC 的原因"
      );
    }
    return this.members.recoverProjectPic(
      projectId,
      memberId,
      user,
      parsed.data,
      source
    );
  }

  @Post("engagement/:projectId/members/:memberId/reauthorize")
  reauthorizeMember(
    @Param("projectId") projectId: string,
    @Param("memberId") memberId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ReauthorizeProjectMemberSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "请选择合法角色并填写重新授权原因"
      );
    }
    return this.members.reauthorizeMember(
      projectId,
      memberId,
      user,
      parsed.data,
      source
    );
  }

  @Delete("engagement/:projectId/members/:memberId")
  removeMember(
    @Param("projectId") projectId: string,
    @Param("memberId") memberId: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.members.removeMember(projectId, memberId, user, source);
  }

  @Post("invitations/:token/accept")
  acceptInvitation(
    @Param("token") token: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = AcceptInvitationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "邀请信息无效");
    }
    return this.members.acceptInvitation(token, user, parsed.data, source);
  }
}
