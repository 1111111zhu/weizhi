import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserListQuerySchema,
  GlobalRoleSchema,
} from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditSource } from "../audit-logs/audit-source.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequireGlobalRoles } from "../auth/global-roles.decorator";
import { GlobalRolesGuard } from "../auth/global-roles.guard";
import type { RequestUser } from "../auth/request-user";
import { ApiBadRequestException } from "../common/api-error";
import { UsersService } from "./users.service";

@UseGuards(AuthGuard, GlobalRolesGuard)
@RequireGlobalRoles("SUPER_ADMIN")
@Controller("admin/users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: unknown) {
    const parsed = UserListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "用户查询条件无效");
    }
    return this.users.list(parsed.data);
  }

  @Post()
  create(
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "用户信息不完整或格式无效"
      );
    }
    return this.users.create(parsed.data, actor.id, source);
  }

  @Post(":id/reset-password")
  resetPassword(
    @Param("id") id: string,
    @CurrentUser() actor: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.users.resetPassword(id, actor.id, source);
  }

  @Get(":id/role-impact")
  roleImpact(@Param("id") id: string, @Query("globalRole") grade: unknown) {
    const parsed = GlobalRoleSchema.safeParse(grade);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "请选择有效职级");
    }
    return this.users.roleImpact(id, parsed.data);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "用户更新信息不完整或格式无效"
      );
    }
    return this.users.update(id, parsed.data, actor.id, source);
  }
}
