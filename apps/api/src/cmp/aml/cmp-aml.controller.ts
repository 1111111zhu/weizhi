import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  CmpAmlHitReviewInputSchema,
  CmpAmlRunInputSchema,
} from "@project-wing/shared";

import type { AuditLogSource } from "../../audit-logs/audit-log-source";
import { AuditSource } from "../../audit-logs/audit-source.decorator";
import { AuthGuard } from "../../auth/auth.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import { SkipDeclarationGate } from "../../auth/declaration-gate.decorator";
import type { RequestUser } from "../../auth/request-user";
import { ApiBadRequestException } from "../../common/api-error";
import { CmpAmlService } from "./cmp-aml.service";

@Controller("cmp")
@UseGuards(AuthGuard)
@SkipDeclarationGate()
export class CmpAmlController {
  constructor(private readonly aml: CmpAmlService) {}

  @Post("acceptance/:id/aml-screenings")
  run(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpAmlRunInputSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "AML screening input is invalid"
      );
    }
    return this.aml.run(id, parsed.data, user, source);
  }

  @Get("acceptance/:id/aml-screenings/latest")
  latest(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.aml.latest(id, user);
  }

  @Patch("aml-screenings/:screeningId/hits/:hitId")
  reviewHit(
    @Param("screeningId") screeningId: string,
    @Param("hitId") hitId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpAmlHitReviewInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "AML hit review input is invalid"
      );
    }
    return this.aml.reviewHit(screeningId, hitId, parsed.data, user, source);
  }
}
