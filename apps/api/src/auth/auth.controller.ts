import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { UpdateUserPreferencesSchema } from "@project-wing/shared";

import { ApiBadRequestException } from "../common/api-error";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { SkipDeclarationGate } from "./declaration-gate.decorator";
import type { RequestUser } from "./request-user";

@Controller("account")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.id);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Patch("preferences")
  updatePreferences(@Body() body: unknown, @CurrentUser() user: RequestUser) {
    const parsed = UpdateUserPreferencesSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "User preferences are invalid"
      );
    }
    return this.auth.updatePreferences(user.id, parsed.data);
  }
}
