import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CreateCmpClientProfileSchema } from "@project-wing/shared/cmp-client-profile";

import type { AuditLogSource } from "../../audit-logs/audit-log-source";
import { AuditSource } from "../../audit-logs/audit-source.decorator";
import { AuthGuard } from "../../auth/auth.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import { SkipDeclarationGate } from "../../auth/declaration-gate.decorator";
import type { RequestUser } from "../../auth/request-user";
import { ApiBadRequestException } from "../../common/api-error";
import { CmpClientMasterService } from "./cmp-client-master.service";

@Controller("cmp/clients")
@UseGuards(AuthGuard)
@SkipDeclarationGate()
export class CmpClientMasterController {
  constructor(private readonly clientMaster: CmpClientMasterService) {}

  @Post()
  createClientProfile(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateCmpClientProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Client profile input is invalid"
      );
    }
    return this.clientMaster.createClientProfile(parsed.data, user, source);
  }

  @Get(":id/profile")
  getClientProfile(@Param("id") id: string) {
    return this.clientMaster.getClientProfile(id);
  }
}
