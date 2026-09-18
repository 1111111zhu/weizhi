import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { z } from "zod";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditSource } from "../audit-logs/audit-source.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequireGlobalRoles } from "../auth/global-roles.decorator";
import { GlobalRolesGuard } from "../auth/global-roles.guard";
import type { RequestUser } from "../auth/request-user";
import { ApiBadRequestException } from "../common/api-error";
import {
  ConfirmationGeneralFieldsService,
  type ConfirmationGeneralFieldsLayout,
} from "./confirmation-general-fields.service";

const schema = z
  .object({
    fields: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
            name: z.string().trim().min(1).max(100),
          })
          .strict()
      )
      .max(200)
      .refine(
        (fields) =>
          new Set(fields.map((field) => field.id)).size === fields.length
      ),
  })
  .strict();

const layoutSchema = z
  .object({
    sections: z.array(
      z
        .object({
          id: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
          name: z.string().trim().min(1).max(100),
          fields: z.array(
            z
              .object({
                id: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
                name: z.string().trim().min(1).max(100),
                binding: z.string().trim().min(1).optional(),
                colSpan: z.union([z.literal(1), z.literal(2)]).optional(),
              })
              .strict()
          ),
        })
        .strict()
    ),
  })
  .strict();

@Controller("confirmations/general-fields")
@UseGuards(AuthGuard)
export class ConfirmationGeneralFieldsController {
  constructor(private readonly fields: ConfirmationGeneralFieldsService) {}

  @Get()
  list() {
    return this.fields.list();
  }

  @Get("layout")
  layout() {
    return this.fields.getLayout();
  }

  @Patch()
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  replace(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid general information fields"
      );
    return this.fields.replace(parsed.data.fields, user, source);
  }

  @Patch("layout")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("SUPER_ADMIN")
  replaceLayout(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = layoutSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Invalid general information layout"
      );
    }
    return this.fields.replaceLayout(
      parsed.data as ConfirmationGeneralFieldsLayout,
      user,
      source
    );
  }
}
