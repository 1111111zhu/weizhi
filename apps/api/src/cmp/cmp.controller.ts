import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  CmpAcceptanceActionSchema,
  CmpAcceptanceDraftAssignmentSchema,
  CmpAcceptanceDraftListQuerySchema,
  CmpAcceptanceListQuerySchema,
  CmpAcceptanceReturnSchema,
  CmpClientListQuerySchema,
  CmpClientVersionListQuerySchema,
  CmpDashboardSummarySchema,
  CreateCmpEngagementFeeNoteSchema,
  CmpEngagementFeeNoteUpdateSchema,
  CmpEngagementFeeNoteExportQuerySchema,
  CmpEngagementArchiveDraftSaveSchema,
  CmpEngagementArchiveFinalizeSchema,
  CmpEngagementArchiveReturnSchema,
  CmpEngagementArchiveSubmitSchema,
  CmpEngagementListQuerySchema,
  CmpSettingsExchangeRatesResponseSchema,
  CreateCmpAcceptanceRequestSchema,
  CreateCmpEngagementSchema,
  ResolveCmpEngagementCodeQuerySchema,
  TmsEngagementDirectoryQuerySchema,
  UpdateCmpAcceptanceRequestSchema,
  UpdateCmpBudgetExchangeRateFallbackSchema,
  UpdateCmpEngagementSchema,
  findRetiredCmpClientFields,
} from "@project-wing/shared";
import { CmpRecordPreviewQuerySchema } from "@project-wing/shared/cmp-record-preview";
import type { Response } from "express";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditSource } from "../audit-logs/audit-source.decorator";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { SkipDeclarationGate } from "../auth/declaration-gate.decorator";
import type { RequestUser } from "../auth/request-user";
import { ApiBadRequestException } from "../common/api-error";
import { InboxService } from "../inbox/inbox.service";
import { CmpService } from "./cmp.service";

@Controller("cmp")
export class CmpController {
  constructor(
    @Inject(CmpService)
    private readonly cmp: CmpService,
    @Inject(InboxService)
    private readonly inbox: InboxService
  ) {}

  @Get("health")
  getHealth() {
    return { ok: true, service: "cmp" };
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("dashboard")
  async getDashboard(@CurrentUser() user: RequestUser) {
    return CmpDashboardSummarySchema.parse(await this.cmp.dashboard(user));
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("users")
  listUsers() {
    return this.cmp.listUsers();
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("budget/exchange-rates")
  listBudgetExchangeRates() {
    return this.cmp.getBudgetExchangeRates();
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("settings/exchange-rates")
  async getSettingsExchangeRates(@CurrentUser() user: RequestUser) {
    return CmpSettingsExchangeRatesResponseSchema.parse(
      await this.cmp.getSettingsExchangeRates(user)
    );
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Post("settings/exchange-rates/refresh")
  async refreshSettingsExchangeRates(
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return CmpSettingsExchangeRatesResponseSchema.parse(
      await this.cmp.refreshSettingsExchangeRates(user, source)
    );
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Put("settings/exchange-rates/fallback")
  async updateSettingsExchangeRateFallback(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UpdateCmpBudgetExchangeRateFallbackSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Fallback exchange rate is invalid"
      );
    }
    return CmpSettingsExchangeRatesResponseSchema.parse(
      await this.cmp.updateSettingsExchangeRateFallback(user, parsed.data, source)
    );
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/resolve-project-code")
  resolveEngagementProjectCode(@Query() query: unknown) {
    const parsed = ResolveCmpEngagementCodeQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Engagement code is invalid"
      );
    }
    return this.cmp.resolveEngagementForProjectCode(parsed.data.code);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("inbox/messages")
  listInboxMessages(@CurrentUser() user: RequestUser) {
    return this.inbox.list(user.id, "CMP");
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Post("inbox/messages/:messageId/read")
  markInboxMessageRead(
    @Param("messageId") messageId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.inbox.markRead(messageId, user.id, "CMP");
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Post("inbox/messages/:messageId/unread")
  markInboxMessageUnread(
    @Param("messageId") messageId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.inbox.markUnread(messageId, user.id, "CMP");
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("acceptance")
  listAcceptance(@Query() query: unknown, @CurrentUser() user: RequestUser) {
    const parsed = CmpAcceptanceListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Acceptance query is invalid"
      );
    }
    return this.cmp.listAcceptance(parsed.data, user);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("acceptance/drafts")
  listAcceptanceDrafts(
    @Query() query: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = CmpAcceptanceDraftListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Acceptance draft query is invalid"
      );
    }
    return this.cmp.listMasterDrafts(parsed.data.type, user);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Post("acceptance")
  createAcceptance(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    assertNoRetiredClientFields(body);
    const parsed = CreateCmpAcceptanceRequestSchema.safeParse(
      normalizeLegacyEngagementDateBody(body)
    );
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Acceptance input is invalid"
      );
    }
    return this.cmp.createAcceptance(parsed.data, user, source);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("acceptance/:id/changes")
  getAcceptanceChanges(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.cmp.getAcceptanceChanges(id, user);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("acceptance/:id")
  getAcceptance(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.cmp.getAcceptance(id, user);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Patch("acceptance/:id")
  updateAcceptance(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    assertNoRetiredClientFields(body);
    const parsed = UpdateCmpAcceptanceRequestSchema.safeParse(
      normalizeLegacyEngagementDateBody(body)
    );
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Acceptance input is invalid"
      );
    }
    return this.cmp.updateAcceptance(id, parsed.data, user, source);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Delete("acceptance/:id")
  deleteAcceptanceDraft(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.cmp.deleteAcceptanceDraft(id, user, source);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Post("acceptance/:id/submit")
  submitAcceptance(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.cmp.submitAcceptance(id, user, source);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Post("acceptance/:id/assign-draft")
  assignAcceptanceDraft(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpAcceptanceDraftAssignmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Draft assignee is invalid"
      );
    }
    return this.cmp.assignAcceptanceDraft(id, parsed.data, user, source);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Post("acceptance/:id/recall-draft")
  recallAcceptanceDraft(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.cmp.recallAcceptanceDraft(id, user, source);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Post("acceptance/:id/complete-draft")
  completeAcceptanceDraft(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.cmp.completeAcceptanceDraft(id, user, source);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Post("acceptance/:id/approve")
  approveAcceptance(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpAcceptanceActionSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Acceptance action input is invalid"
      );
    }
    return this.cmp.approveAcceptance(id, user, parsed.data.comment, source);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Post("acceptance/:id/return")
  returnAcceptance(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpAcceptanceReturnSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Acceptance return input is invalid"
      );
    }
    return this.cmp.returnAcceptance(id, parsed.data, user, source);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("approvals")
  listApprovals(@CurrentUser() user: RequestUser) {
    return this.cmp.listApprovals(user);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("client-groups")
  listClientGroups() {
    return this.cmp.listClientGroups();
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("client-groups/:id/structure")
  getClientGroupStructure(@Param("id") id: string) {
    return this.cmp.getClientGroupStructure(id);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Post("client-groups")
  createClientGroup() {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Client Groups are retired. Create an Entity Map instead."
    );
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Patch("client-groups/:id")
  updateClientGroup() {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Client Groups are retired. Maintain relationships in Entity Maps instead."
    );
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("clients")
  listClients(@Query() query: unknown) {
    const parsed = CmpClientListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Client query is invalid"
      );
    }
    return this.cmp.listClients(parsed.data);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("clients/:id/versions")
  listClientVersions(@Param("id") id: string, @Query() query: unknown) {
    const parsed = CmpClientVersionListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Client version query is invalid"
      );
    }
    return this.cmp.listClientVersions(id, parsed.data);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("clients/:clientId/versions/:versionId")
  getClientVersion(
    @Param("clientId") clientId: string,
    @Param("versionId") versionId: string
  ) {
    return this.cmp.getClientVersion(clientId, versionId);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("clients/:clientId/versions/:versionId/compare-current")
  compareClientVersion(
    @Param("clientId") clientId: string,
    @Param("versionId") versionId: string
  ) {
    return this.cmp.compareClientVersionToCurrent(clientId, versionId);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("clients/:clientId/versions/:versionId/export.pdf")
  async exportClientVersionPdf(
    @Param("clientId") clientId: string,
    @Param("versionId") versionId: string,
    @Res() response: Response
  ) {
    const file = await this.cmp.exportClientVersionPdf(clientId, versionId);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.fileName}"`
    );
    response.send(file.body);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("clients/:id/preview")
  getClientPreview(@Param("id") id: string, @Query() query: unknown) {
    const parsed = CmpRecordPreviewQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Preview query is invalid"
      );
    }
    return this.cmp.getClientPreview(id, parsed.data.locale);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("clients/:id/export.pdf")
  async exportClientPreviewPdf(
    @Param("id") id: string,
    @Query() query: unknown,
    @Res() response: Response
  ) {
    const parsed = CmpRecordPreviewQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Preview query is invalid"
      );
    }
    const file = await this.cmp.exportClientPreviewPdf(id, parsed.data.locale);
    sendPdf(response, file);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("clients/:id")
  getClient(@Param("id") id: string) {
    return this.cmp.getClient(id);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements")
  listEngagements(@Query() query: unknown) {
    const parsed = CmpEngagementListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Engagement query is invalid"
      );
    }
    return this.cmp.listEngagements(parsed.data);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagement-archives")
  listEngagementArchives(@CurrentUser() user: RequestUser) {
    return this.cmp.listEngagementArchives(user);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("integrations/tms/engagements")
  listTmsEngagements(
    @Query() query: unknown,
    @CurrentUser() user: RequestUser
  ) {
    const parsed = TmsEngagementDirectoryQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "TMS engagement query is invalid"
      );
    }
    return this.cmp.listTmsEngagements(parsed.data, user);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Post("engagements")
  createEngagement(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateCmpEngagementSchema.safeParse(
      normalizeLegacyEngagementDateBody(body)
    );
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Engagement input is invalid"
      );
    }
    if (parsed.data.deliverables !== undefined) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Reports and deliverables can only be changed through Engagement Acceptance"
      );
    }
    return this.cmp.createEngagement(parsed.data, user, source);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id/fee-notes")
  getEngagementFeeNotes(@Param("id") id: string) {
    return this.cmp.getEngagementFeeNotes(id);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Post("engagements/:id/fee-notes")
  createEngagementFeeNote(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateCmpEngagementFeeNoteSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "Fee note input is invalid");
    }
    return this.cmp.createEngagementFeeNote(id, parsed.data, user, source);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id/fee-notes/:feeNoteId")
  getEngagementFeeNoteById(
    @Param("id") id: string,
    @Param("feeNoteId") feeNoteId: string
  ) {
    return this.cmp.getEngagementFeeNote(id, feeNoteId);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Patch("engagements/:id/fee-notes/:feeNoteId")
  updateEngagementFeeNoteById(
    @Param("id") id: string,
    @Param("feeNoteId") feeNoteId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpEngagementFeeNoteUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "Fee note input is invalid");
    }
    return this.cmp.updateEngagementFeeNote(id, parsed.data, user, source, feeNoteId);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id/fee-notes/:feeNoteId/original.pdf")
  async viewEngagementFeeNoteOriginal(
    @Param("id") id: string,
    @Param("feeNoteId") feeNoteId: string,
    @Query() query: unknown,
    @Res() response: Response
  ) {
    const parsed = CmpEngagementFeeNoteExportQuerySchema.safeParse(query);
    if (!parsed.success) throw new ApiBadRequestException("VALIDATION_FAILED", "Fee note export query is invalid");
    sendInlinePdf(response, await this.cmp.exportEngagementFeeNote(id, parsed.data.locale, "pdf", feeNoteId));
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id/fee-notes/:feeNoteId/export.pdf")
  async exportEngagementFeeNoteByIdPdf(
    @Param("id") id: string,
    @Param("feeNoteId") feeNoteId: string,
    @Query() query: unknown,
    @Res() response: Response
  ) {
    const parsed = CmpEngagementFeeNoteExportQuerySchema.safeParse(query);
    if (!parsed.success) throw new ApiBadRequestException("VALIDATION_FAILED", "Fee note export query is invalid");
    sendPdf(response, await this.cmp.exportEngagementFeeNote(id, parsed.data.locale, "pdf", feeNoteId));
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id/fee-notes/:feeNoteId/export.docx")
  async exportEngagementFeeNoteByIdDocx(
    @Param("id") id: string,
    @Param("feeNoteId") feeNoteId: string,
    @Query() query: unknown,
    @Res() response: Response
  ) {
    const parsed = CmpEngagementFeeNoteExportQuerySchema.safeParse(query);
    if (!parsed.success) throw new ApiBadRequestException("VALIDATION_FAILED", "Fee note export query is invalid");
    sendDocx(response, await this.cmp.exportEngagementFeeNote(id, parsed.data.locale, "docx", feeNoteId));
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id/fee-note")
  getEngagementFeeNote(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.cmp.getEngagementFeeNote(id, user);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id/archive-review")
  getEngagementArchiveReview(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.cmp.getEngagementArchiveReview(id, user);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Put("engagements/:id/archive-draft")
  saveEngagementArchiveDraft(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpEngagementArchiveDraftSaveSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Archive draft input is invalid"
      );
    }
    return this.cmp.saveEngagementArchiveDraft(id, parsed.data, user, source);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Delete("engagements/:id/archive-draft")
  deleteEngagementArchiveDraft(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    return this.cmp.deleteEngagementArchiveDraft(id, user, source);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Post("engagements/:id/archive-submit")
  submitEngagementArchive(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpEngagementArchiveSubmitSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Archive submission is invalid"
      );
    }
    return this.cmp.submitEngagementArchive(id, parsed.data, user, source);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Post("engagements/:id/archive-return")
  returnEngagementArchive(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpEngagementArchiveReturnSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Archive return is invalid"
      );
    }
    return this.cmp.returnEngagementArchive(id, parsed.data, user, source);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Post("engagements/:id/archive")
  archiveEngagement(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpEngagementArchiveFinalizeSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Archive confirmation is invalid"
      );
    }
    return this.cmp.archiveEngagement(id, parsed.data, user, source);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id/archive-snapshot")
  getEngagementArchiveSnapshot(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.cmp.getEngagementArchiveSnapshot(id, user);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id/archive/export.pdf")
  async exportEngagementArchivePdf(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    sendPdf(response, await this.cmp.exportEngagementArchivePdf(id, user));
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id/archive/export.xlsx")
  async exportEngagementArchiveWorkbook(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    sendWorkbook(
      response,
      await this.cmp.exportEngagementArchiveWorkbook(id, user)
    );
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Patch("engagements/:id/fee-note")
  updateEngagementFeeNote(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    void id;
    void body;
    void user;
    void source;
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Fee Note has been replaced by Billing. Use /cmp/billing instead."
    );
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id/fee-note/export.pdf")
  async exportEngagementFeeNotePdf(
    @Param("id") id: string,
    @Query() query: unknown,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    const parsed = CmpEngagementFeeNoteExportQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Fee note export query is invalid"
      );
    }
    sendPdf(
      response,
      await this.cmp.exportEngagementFeeNote(
        id,
        parsed.data.locale,
        "pdf",
        user
      )
    );
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id/fee-note/export.docx")
  async exportEngagementFeeNoteDocx(
    @Param("id") id: string,
    @Query() query: unknown,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    const parsed = CmpEngagementFeeNoteExportQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Fee note export query is invalid"
      );
    }
    sendDocx(
      response,
      await this.cmp.exportEngagementFeeNote(
        id,
        parsed.data.locale,
        "docx",
        user
      )
    );
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id/preview")
  getEngagementPreview(@Param("id") id: string, @Query() query: unknown) {
    const parsed = CmpRecordPreviewQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Preview query is invalid"
      );
    }
    return this.cmp.getEngagementPreview(id, parsed.data.locale);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id/export.pdf")
  async exportEngagementPreviewPdf(
    @Param("id") id: string,
    @Query() query: unknown,
    @Res() response: Response
  ) {
    const parsed = CmpRecordPreviewQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Preview query is invalid"
      );
    }
    const file = await this.cmp.exportEngagementPreviewPdf(
      id,
      parsed.data.locale
    );
    sendPdf(response, file);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id/export.xlsx")
  async exportEngagementBudgetWorkbook(
    @Param("id") id: string,
    @Query() query: unknown,
    @Res() response: Response
  ) {
    const parsed = CmpRecordPreviewQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Preview query is invalid"
      );
    }
    const file = await this.cmp.exportEngagementBudgetWorkbook(
      id,
      parsed.data.locale
    );
    sendWorkbook(response, file);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id")
  getEngagement(@Param("id") id: string) {
    return this.cmp.getEngagement(id);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Get("engagements/:id/tms-summary")
  getTmsEngagementSummary(@Param("id") id: string) {
    return this.cmp.getTmsEngagementSummary(id);
  }

  @UseGuards(AuthGuard)
  @SkipDeclarationGate()
  @Patch("engagements/:id")
  updateEngagement(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UpdateCmpEngagementSchema.safeParse(
      normalizeLegacyEngagementDateBody(body)
    );
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Engagement input is invalid"
      );
    }
    if (parsed.data.deliverables !== undefined) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Reports and deliverables can only be changed through Engagement Acceptance"
      );
    }
    return this.cmp.updateEngagement(id, parsed.data, user, source);
  }
}

function assertNoRetiredClientFields(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return;
  }
  const { clientPayload } = body as Record<string, unknown>;
  const retiredFields = findRetiredCmpClientFields(clientPayload);
  if (retiredFields.length === 0) {
    return;
  }
  throw new ApiBadRequestException(
    "VALIDATION_FAILED",
    `Retired CMP Client fields are no longer supported: ${retiredFields.join(", ")}`
  );
}

/**
 * `approvalDate` was the historic Engagement business-date key. Keep request
 * compatibility at the API boundary while ensuring all parsed DTOs and all
 * responses use the canonical `engagementDate` key. Client payloads are never
 * normalised here because Client Approval Date remains a separate field.
 */
function normalizeLegacyEngagementDateBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }
  const record = body as Record<string, unknown>;
  const next = normalizeLegacyEngagementDate(record);
  if (
    record.engagementPayload &&
    typeof record.engagementPayload === "object"
  ) {
    next.engagementPayload = normalizeLegacyEngagementDate(
      record.engagementPayload as Record<string, unknown>
    );
  }
  return next;
}

function normalizeLegacyEngagementDate(
  value: Record<string, unknown>
): Record<string, unknown> {
  const legacy = value.approvalDate;
  const canonical = value.engagementDate;
  if (legacy !== undefined && canonical !== undefined && legacy !== canonical) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "approvalDate and engagementDate must have the same value when both are provided"
    );
  }
  const { approvalDate: _legacyApprovalDate, ...rest } = value;
  return {
    ...rest,
    ...(canonical !== undefined || legacy === undefined
      ? {}
      : { engagementDate: legacy }),
  };
}

function sendPdf(response: Response, file: { fileName: string; body: Buffer }) {
  const asciiName = file.fileName.replaceAll(/[^\u0020-\u007E]/g, "-");
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
  );
  response.send(file.body);
}

function sendInlinePdf(response: Response, file: { fileName: string; body: Buffer }) {
  const asciiName = file.fileName.replaceAll(/[^\u0020-\u007E]/g, "-");
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader(
    "Content-Disposition",
    `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
  );
  response.send(file.body);
}

function sendWorkbook(
  response: Response,
  file: { fileName: string; body: Buffer }
) {
  const asciiName = file.fileName.replaceAll(/[^\u0020-\u007E]/g, "-");
  response.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
  );
  response.send(file.body);
}

function sendDocx(
  response: Response,
  file: { fileName: string; body: Buffer }
) {
  const asciiName = file.fileName.replaceAll(/[^\u0020-\u007E]/g, "-");
  response.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
  );
  response.send(file.body);
}
