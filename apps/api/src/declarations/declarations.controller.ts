import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditSource } from "../audit-logs/audit-source.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { SkipDeclarationGate } from "../auth/declaration-gate.decorator";
import type { RequestUser } from "../auth/request-user";
import { DeclarationsService } from "./declarations.service";

@UseGuards(AuthGuard)
@Controller("declarations")
export class DeclarationsController {
  constructor(private readonly declarations: DeclarationsService) {}

  @SkipDeclarationGate()
  @Post("accept")
  accept(
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.declarations.accept(user.id, "web", source);
  }

  @Get("engagement/:projectId/status")
  status(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string
  ) {
    return this.declarations.status(user, projectId);
  }

  @Post("engagement/:projectId/accept")
  acceptProject(
    @CurrentUser() user: RequestUser,
    @Param("projectId") projectId: string,
    @AuditSource() source: AuditLogSource
  ) {
    return this.declarations.acceptProject(user.id, projectId, "web", source);
  }
}
