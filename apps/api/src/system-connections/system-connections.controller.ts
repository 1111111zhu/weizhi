import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ConnectTracking17TrackSchema } from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditSource } from "../audit-logs/audit-source.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequireGlobalRoles } from "../auth/global-roles.decorator";
import { GlobalRolesGuard } from "../auth/global-roles.guard";
import type { RequestUser } from "../auth/request-user";
import { ApiBadRequestException } from "../common/api-error";
import { SystemConnectionsService } from "./system-connections.service";

@UseGuards(AuthGuard, GlobalRolesGuard)
@RequireGlobalRoles("SUPER_ADMIN")
@Controller("system-connections")
export class SystemConnectionsController {
  constructor(private readonly connections: SystemConnectionsService) {}

  @Get("17track")
  getTracking17TrackStatus() {
    return this.connections.getTracking17TrackStatus();
  }

  @Put("17track")
  connectTracking17Track(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = ConnectTracking17TrackSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "请输入 17TRACK API Key"
      );
    }
    return this.connections.connect(user, parsed.data.apiKey, source);
  }

  @Post("17track/test")
  testTracking17Track(
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.connections.test(user, source);
  }

  @Delete("17track")
  disconnectTracking17Track(
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.connections.disconnect(user, source);
  }
}
