import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { WorkItemDomainSchema, WorkItemViewSchema } from "@project-wing/shared";
import { z } from "zod";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { SkipDeclarationGate } from "../auth/declaration-gate.decorator";
import type { RequestUser } from "../auth/request-user";
import { ApiBadRequestException } from "../common/api-error";
import { WorkItemsService } from "./work-items.service";

const WorkItemQuerySchema = z
  .object({
    view: WorkItemViewSchema.default("PERSONAL"),
    scope: WorkItemDomainSchema.optional(),
    domain: WorkItemDomainSchema.optional(),
    projectId: z.string().trim().min(1).optional(),
    locale: z.enum(["zh-CN", "en-US"]).default("zh-CN"),
  })
  .superRefine((query, context) => {
    if (query.scope && query.domain && query.scope !== query.domain) {
      context.addIssue({
        code: "custom",
        message: "scope and domain must match when both are provided",
        path: ["scope"],
      });
    }
  });

@UseGuards(AuthGuard)
@SkipDeclarationGate()
@Controller("work-items")
export class WorkItemsController {
  constructor(private readonly workItems: WorkItemsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() query: unknown) {
    const parsed = WorkItemQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Work item query is invalid"
      );
    }
    const { domain, ...normalizedQuery } = parsed.data;
    return this.workItems.list(user, {
      ...normalizedQuery,
      scope: normalizedQuery.scope ?? domain,
    });
  }
}
