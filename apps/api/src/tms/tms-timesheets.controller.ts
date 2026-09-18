import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import {
  TmsApprovalActionInputSchema,
  TmsApprovalEditInputSchema,
  TmsApprovalReturnInputSchema,
  TmsApprovalStatusSchema,
  TmsApproveInputSchema,
  TmsOverviewQuerySchema,
  TmsProjectLinkInputSchema,
  TmsProjectLinkQuerySchema,
  TmsSaveDraftInputSchema,
  TmsSubmitInputSchema,
  TmsTimesheetHalfSchema,
  TmsTimesheetQuerySchema,
} from "@project-wing/shared";
import type { Response } from "express";
import { z } from "zod";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { SkipDeclarationGate } from "../auth/declaration-gate.decorator";
import { RequireGlobalRoles } from "../auth/global-roles.decorator";
import { GlobalRolesGuard } from "../auth/global-roles.guard";
import type { RequestUser } from "../auth/request-user";
import { ApiBadRequestException } from "../common/api-error";
import { buildTmsQueryWorkbook } from "./tms-timesheet-query-export";
import { TmsTimesheetQueryService } from "./tms-timesheet-query.service";
import { TmsTimesheetsService } from "./tms-timesheets.service";

const yearSchema = z.coerce.number().int().min(2000).max(2200);
const monthSchema = z.coerce.number().int().min(1).max(12);

@UseGuards(AuthGuard)
@SkipDeclarationGate()
@Controller("tms/timesheets")
export class TmsTimesheetsController {
  constructor(
    private readonly timesheets: TmsTimesheetsService,
    private readonly queryService: TmsTimesheetQueryService
  ) {}

  @Get("query")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("PARTNER", "MANAGER")
  queryTimesheets(@Query() query: unknown, @CurrentUser() actor: RequestUser) {
    return this.queryService.query(
      actor,
      parse(TmsTimesheetQuerySchema, query)
    );
  }

  @Get("overview")
  overview(@Query() query: unknown, @CurrentUser() actor: RequestUser) {
    return this.timesheets.getOverview(
      actor,
      parse(TmsOverviewQuerySchema, query)
    );
  }

  @Get("query/export")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("PARTNER", "MANAGER")
  async exportTimesheets(
    @Query() query: unknown,
    @CurrentUser() actor: RequestUser,
    @Res({ passthrough: true }) response: Response
  ) {
    const input = parse(TmsTimesheetQuerySchema, query);
    const rows = await this.queryService.queryAll(actor, input);
    const buffer = buildTmsQueryWorkbook(input.mode, rows);
    response.type(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    response.attachment(
      `tms-timesheet-${input.mode.toLowerCase()}-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );
    return new StreamableFile(buffer);
  }

  @Get("approvals/engagements")
  listApprovalProjects(
    @Query() query: unknown,
    @CurrentUser() actor: RequestUser
  ) {
    const parsed = approvalProjectQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "审批项目查询无效");
    }
    return this.timesheets.listApprovalProjects(
      actor,
      parsed.data.year,
      parsed.data.month,
      parsed.data.q
    );
  }

  @Get("approvals/engagements/:engagementId/submissions")
  listApprovalRecords(
    @Param("engagementId") engagementId: string,
    @Query() query: unknown,
    @CurrentUser() actor: RequestUser
  ) {
    const parsed = approvalRecordsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "审批记录查询无效");
    }
    return this.timesheets.listApprovalRecords(
      actor,
      engagementId,
      parsed.data.year,
      parsed.data.month,
      { status: parsed.data.status, q: parsed.data.q }
    );
  }

  @Post("approvals/:submissionId/approve")
  approveSubmission(
    @Param("submissionId") submissionId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser
  ) {
    return this.timesheets.approveSubmission(
      actor,
      submissionId,
      parse(TmsApprovalActionInputSchema, body)
    );
  }

  @Post("approvals/:submissionId/return")
  returnSubmission(
    @Param("submissionId") submissionId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser
  ) {
    return this.timesheets.returnSubmission(
      actor,
      submissionId,
      parse(TmsApprovalReturnInputSchema, body)
    );
  }

  @Put("approvals/:submissionId")
  editSubmission(
    @Param("submissionId") submissionId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser
  ) {
    return this.timesheets.editSubmission(
      actor,
      submissionId,
      parse(TmsApprovalEditInputSchema, body)
    );
  }

  @Get("project-links")
  listProjectLinks(@Query() query: unknown, @CurrentUser() actor: RequestUser) {
    return this.timesheets.listProjectLinks(
      actor,
      parse(TmsProjectLinkQuerySchema, query)
    );
  }

  @Post("project-links")
  linkProjectRow(@Body() body: unknown, @CurrentUser() actor: RequestUser) {
    const input = parse(TmsProjectLinkInputSchema, body);
    return this.timesheets.linkProjectRow(actor, input.rowId, input.projectId);
  }

  @Delete("project-links/:rowId")
  unlinkProjectRow(
    @Param("rowId") rowId: string,
    @CurrentUser() actor: RequestUser
  ) {
    return this.timesheets.unlinkProjectRow(actor, rowId);
  }

  @Get(":year/:month")
  getMonth(
    @Param("year") year: string,
    @Param("month") month: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.timesheets.getMonth(
      user,
      parse(yearSchema, year),
      parse(monthSchema, month)
    );
  }

  @Put(":year/:month/draft")
  saveDraft(
    @Param("year") year: string,
    @Param("month") month: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    return this.timesheets.saveDraft(
      user,
      parse(yearSchema, year),
      parse(monthSchema, month),
      parse(TmsSaveDraftInputSchema, body)
    );
  }

  @Post(":year/:month/submit")
  submit(
    @Param("year") year: string,
    @Param("month") month: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser
  ) {
    return this.timesheets.submit(
      user,
      parse(yearSchema, year),
      parse(monthSchema, month),
      parse(TmsSubmitInputSchema, body)
    );
  }

  @Post(":ownerUserId/:year/:month/:half/approve")
  @UseGuards(GlobalRolesGuard)
  @RequireGlobalRoles("PARTNER", "MANAGER")
  approve(
    @Param("ownerUserId") ownerUserId: string,
    @Param("year") year: string,
    @Param("month") month: string,
    @Param("half") half: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser
  ) {
    return this.timesheets.approve(
      actor,
      ownerUserId,
      parse(yearSchema, year),
      parse(monthSchema, month),
      parse(TmsTimesheetHalfSchema, half),
      parse(TmsApproveInputSchema, body)
    );
  }
}

const approvalProjectQuerySchema = z
  .object({
    year: yearSchema.optional(),
    month: monthSchema.optional(),
    q: z.string().trim().max(120).optional().default(""),
  })
  .refine(
    (value) =>
      (value.year === undefined && value.month === undefined) ||
      (value.year !== undefined && value.month !== undefined),
    { message: "Year and month must be provided together" }
  );
const approvalRecordsQuerySchema = z.object({
  year: yearSchema,
  month: monthSchema,
  q: z.string().trim().max(120).optional().default(""),
  status: TmsApprovalStatusSchema.optional(),
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      result.error.issues[0]?.message ?? "工时数据无效"
    );
  }
  return result.data;
}
