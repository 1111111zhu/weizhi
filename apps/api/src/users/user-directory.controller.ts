import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ProjectInviteeDirectoryQuerySchema } from "@project-wing/shared";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/request-user";
import { ApiBadRequestException } from "../common/api-error";
import { UsersService } from "./users.service";

@UseGuards(AuthGuard)
@Controller("users/directory")
export class UserDirectoryController {
  constructor(private readonly users: UsersService) {}

  @Get("project-invitees")
  projectInvitees(@Query() query: unknown, @CurrentUser() user: RequestUser) {
    const parsed = ProjectInviteeDirectoryQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invitee query is invalid"
      );
    }
    return this.users.projectInvitees(parsed.data, user);
  }

  @Get()
  list() {
    return this.users.directory();
  }
}
