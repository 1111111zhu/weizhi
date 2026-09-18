import { Injectable } from "@nestjs/common";
import type { WorkItemDomain, WorkItemView } from "@project-wing/shared";

import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiForbiddenException,
} from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { finalizeWorkItems } from "./work-item-common";
import type { WorkItemLocale } from "./work-item-common";
import { buildCmpPersonalWorkItems } from "./work-items-cmp";
import { buildEmpPersonalWorkItems } from "./work-items-emp";
import { buildOpsWorkItems } from "./work-items-ops";
import {
  buildProjectPersonalWorkItems,
  buildProjectTeamWorkItems,
} from "./work-items-project";
import { WorkItemsSynchronizerService } from "./work-items-synchronizer.service";
import { buildTmsPersonalWorkItems } from "./work-items-tms";

type WorkItemQuery = {
  view: WorkItemView;
  scope?: WorkItemDomain;
  projectId?: string;
  locale: WorkItemLocale;
};

@Injectable()
export class WorkItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly synchronizer: WorkItemsSynchronizerService
  ) {}

  async list(user: RequestUser, query: WorkItemQuery) {
    this.synchronizer.syncForRead();
    if (query.view === "TEAM") {
      this.assertScope(query.scope, "PROJECT");
      if (!query.projectId) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "projectId is required for team work items"
        );
      }
      await this.assertProjectAccess(user, query.projectId);
      const items = await buildProjectTeamWorkItems(
        this.prisma,
        user,
        query.projectId,
        query.locale
      );
      return finalizeWorkItems(items, query.locale);
    }

    if (query.view === "OPS") {
      this.assertScope(query.scope, "OPS");
      this.assertOpsAccess(user);
      const items = await buildOpsWorkItems(this.prisma, user, query.locale);
      return finalizeWorkItems(items, query.locale);
    }

    if (!query.scope) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "scope is required for personal work items"
      );
    }
    const items = await this.buildPersonalScope(user, query);
    return finalizeWorkItems(items, query.locale);
  }

  private async buildPersonalScope(user: RequestUser, query: WorkItemQuery) {
    switch (query.scope) {
      case "EMP": {
        return buildEmpPersonalWorkItems(this.prisma, user, query.locale);
      }
      case "PROJECT": {
        if (query.projectId) {
          await this.assertProjectAccess(user, query.projectId);
        }
        return buildProjectPersonalWorkItems(
          this.prisma,
          user,
          query.locale,
          query.projectId
        );
      }
      case "CMP": {
        return buildCmpPersonalWorkItems(this.prisma, user, query.locale);
      }
      case "TMS": {
        return buildTmsPersonalWorkItems(this.prisma, user, query.locale);
      }
      case "OPS": {
        this.assertOpsAccess(user);
        return buildOpsWorkItems(this.prisma, user, query.locale);
      }
      default: {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "Personal work item scope is invalid"
        );
      }
    }
  }

  private async assertProjectAccess(user: RequestUser, projectId: string) {
    if (user.globalRole === "SUPER_ADMIN") {
      return;
    }
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
      select: { status: true },
    });
    if (member?.status !== "ACTIVE") {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "You cannot view this project's team work items"
      );
    }
  }

  private assertOpsAccess(user: RequestUser) {
    if (user.globalRole !== "SUPER_ADMIN") {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only super administrators can view OPS work items"
      );
    }
  }

  private assertScope(
    scope: WorkItemDomain | undefined,
    expected: WorkItemDomain
  ) {
    if (scope && scope !== expected) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        `${expected} scope is required for ${expected.toLowerCase()} work items`
      );
    }
  }
}
