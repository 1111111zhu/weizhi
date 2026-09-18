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
  CreateDesktopFolderSchema,
  ReorderDesktopProjectPlacementsSchema,
  UpdateDesktopFolderSchema,
  UpdateDesktopProjectPlacementSchema,
} from "@project-wing/shared";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/request-user";
import { ApiBadRequestException } from "../common/api-error";
import { DesktopService } from "./desktop.service";

@UseGuards(AuthGuard)
@Controller("desktop")
export class DesktopController {
  constructor(private readonly desktop: DesktopService) {}

  @Get()
  getDesktop(@CurrentUser() user: RequestUser) {
    return this.desktop.getDesktop(user);
  }

  @Post("folders")
  createFolder(@Body() body: unknown, @CurrentUser() user: RequestUser) {
    const parsed = CreateDesktopFolderSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Folder information is invalid"
      );
    }
    return this.desktop.createFolder(user, parsed.data);
  }

  @Patch("folders/:id")
  updateFolder(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = UpdateDesktopFolderSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Folder update is invalid"
      );
    }
    return this.desktop.updateFolder(id, user, parsed.data);
  }

  @Delete("folders/:id")
  deleteFolder(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.desktop.deleteFolder(id, user);
  }

  @Patch("folders/:id/placements/order")
  reorderProjectPlacements(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = ReorderDesktopProjectPlacementsSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Desktop placement order is invalid"
      );
    }
    return this.desktop.reorderProjectPlacements(id, user, parsed.data);
  }

  @Patch("engagement/:projectId/placement")
  updateProjectPlacement(
    @Param("projectId") projectId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = UpdateDesktopProjectPlacementSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Desktop placement update is invalid"
      );
    }
    return this.desktop.updateProjectPlacement(projectId, user, parsed.data);
  }
}
