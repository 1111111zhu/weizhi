import { Body, Controller, Delete, Get, Put, UseGuards } from "@nestjs/common";
import { CmpAmlConfigurationInputSchema } from "@project-wing/shared";

import type { AuditLogSource } from "../../audit-logs/audit-log-source";
import { AuditSource } from "../../audit-logs/audit-source.decorator";
import { AuthGuard } from "../../auth/auth.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import { RequireGlobalRoles } from "../../auth/global-roles.decorator";
import { GlobalRolesGuard } from "../../auth/global-roles.guard";
import type { RequestUser } from "../../auth/request-user";
import { ApiBadRequestException } from "../../common/api-error";
import { CmpAmlConfigurationService } from "./cmp-aml-configuration.service";

@Controller("cmp/settings/aml")
@UseGuards(AuthGuard, GlobalRolesGuard)
@RequireGlobalRoles("SUPER_ADMIN")
export class CmpAmlConfigurationController {
  constructor(private readonly configuration: CmpAmlConfigurationService) {}

  @Get()
  getStatus() {
    return this.configuration.getPublicStatus();
  }

  @Put()
  save(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpAmlConfigurationInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "AML API Key must contain 1 to 4096 characters"
      );
    }
    return this.configuration.save(user, parsed.data.apiKey, source);
  }

  @Delete()
  disable(
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.configuration.disable(user, source);
  }
}
