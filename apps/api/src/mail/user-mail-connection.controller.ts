import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ConnectUserMailSchema } from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditSource } from "../audit-logs/audit-source.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/request-user";
import { ApiBadRequestException } from "../common/api-error";
import { UserMailConnectionService } from "./user-mail-connection.service";

@UseGuards(AuthGuard)
@Controller("mail-connection")
export class UserMailConnectionController {
  constructor(private readonly mail: UserMailConnectionService) {}

  @Get()
  getStatus(@CurrentUser() user: RequestUser) {
    return this.mail.getStatus(user);
  }

  @Put()
  connect(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ConnectUserMailSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "请输入企业邮箱客户端专用密码"
      );
    }
    return this.mail.connect(user, parsed.data.clientPassword, source);
  }

  @Post("test")
  test(
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.mail.test(user, source);
  }

  @Delete()
  disconnect(
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.mail.disconnect(user, source);
  }
}
