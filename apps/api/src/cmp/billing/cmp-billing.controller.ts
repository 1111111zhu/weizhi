import { readFile } from "node:fs/promises";

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  CmpBillingClientPaymentClaimSchema,
  CmpBillingExpectedVersionSchema,
  CmpBillingFinanceReceiptSchema,
  CmpBillingInvoiceInputSchema,
  CmpBillingListQuerySchema,
  CmpBillingMarkSentSchema,
  CmpBillingReconcileSchema,
  CmpBillingReturnSchema,
  CmpBillingTemplateVersionSchema,
  CreateCmpBillingBankTemplateSchema,
  CreateCmpBillingFirmTemplateSchema,
  CreateCmpBillingSchema,
  UpdateCmpBillingBankTemplateSchema,
  UpdateCmpBillingSchema,
  UpdateCmpBillingFirmTemplateSchema,
} from "@project-wing/shared";
import type { Response } from "express";

import type { AuditLogSource } from "../../audit-logs/audit-log-source";
import { AuditSource } from "../../audit-logs/audit-source.decorator";
import { AuthGuard } from "../../auth/auth.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import { SkipDeclarationGate } from "../../auth/declaration-gate.decorator";
import type { RequestUser } from "../../auth/request-user";
import { ApiBadRequestException } from "../../common/api-error";
import { CmpBillingService, type BillingUpload } from "./cmp-billing.service";

@Controller("cmp")
@UseGuards(AuthGuard)
@SkipDeclarationGate()
export class CmpBillingController {
  constructor(private readonly billing: CmpBillingService) {}

  @Get("billing")
  list(@Query() query: unknown, @CurrentUser() user: RequestUser) {
    const parsed = CmpBillingListQuerySchema.safeParse(query);
    if (!parsed.success) invalid();
    return this.billing.list(user, parsed.data);
  }

  @Post("billing")
  create(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateCmpBillingSchema.safeParse(body);
    if (!parsed.success) invalid();
    return this.billing.create(parsed.data, user, source);
  }

  @Get("billing/templates")
  templates(
    @Query("includeInactive") includeInactive: string | undefined,
    @CurrentUser() user: RequestUser
  ) {
    return this.billing.listTemplates(user, includeInactive === "true");
  }

  @Post("billing/templates/firm")
  createFirmTemplate(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateCmpBillingFirmTemplateSchema.safeParse(body);
    if (!parsed.success) invalid();
    return this.billing.createFirmTemplate(parsed.data, user, source);
  }

  @Patch("billing/templates/firm/:id")
  updateFirmTemplate(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UpdateCmpBillingFirmTemplateSchema.safeParse(body);
    if (!parsed.success) invalid();
    return this.billing.updateFirmTemplate(id, parsed.data, user, source);
  }

  @Post("billing/templates/firm/:id/deactivate")
  deactivateFirmTemplate(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpBillingTemplateVersionSchema.safeParse(body);
    if (!parsed.success) invalid();
    return this.billing.deactivateFirmTemplate(id, parsed.data, user, source);
  }

  @Post("billing/templates/bank")
  createBankTemplate(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CreateCmpBillingBankTemplateSchema.safeParse(body);
    if (!parsed.success) invalid();
    return this.billing.createBankTemplate(parsed.data, user, source);
  }

  @Patch("billing/templates/bank/:id")
  updateBankTemplate(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UpdateCmpBillingBankTemplateSchema.safeParse(body);
    if (!parsed.success) invalid();
    return this.billing.updateBankTemplate(id, parsed.data, user, source);
  }

  @Post("billing/templates/bank/:id/deactivate")
  deactivateBankTemplate(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpBillingTemplateVersionSchema.safeParse(body);
    if (!parsed.success) invalid();
    return this.billing.deactivateBankTemplate(id, parsed.data, user, source);
  }

  @Get("billing/:id")
  get(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.billing.get(id, user);
  }

  @Get("billing/:id/defaults")
  defaults(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.billing.getDefaults(id, user);
  }

  @Get("billing/:id/import-options")
  importOptions(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.billing.getImportOptions(id, user);
  }

  @Patch("billing/:id")
  update(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = UpdateCmpBillingSchema.safeParse(body);
    if (!parsed.success) invalid();
    return this.billing.update(id, parsed.data, user, source);
  }

  @Delete("billing/:id")
  remove(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpBillingExpectedVersionSchema.safeParse(body);
    if (!parsed.success) invalid();
    return this.billing.remove(id, parsed.data.expectedVersion, user, source);
  }

  @Post("billing/:id/submit")
  submit(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpBillingExpectedVersionSchema.safeParse(body);
    if (!parsed.success) invalid();
    return this.billing.submit(id, parsed.data, user, source);
  }

  @Post("billing/:id/return")
  returnToDraft(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpBillingReturnSchema.safeParse(body);
    if (!parsed.success) invalid();
    return this.billing.returnToDraft(id, parsed.data, user, source);
  }

  @Post("billing/:id/approve")
  approve(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpBillingExpectedVersionSchema.safeParse(body);
    if (!parsed.success) invalid();
    return this.billing.approve(id, parsed.data, user, source);
  }

  @Post("billing/:id/mark-sent")
  markSent(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpBillingMarkSentSchema.safeParse(body);
    if (!parsed.success) invalid();
    return this.billing.markSent(id, parsed.data, user, source);
  }

  @Post("billing/:id/client-payment-claims")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 50 * 1024 * 1024 } })
  )
  claimClientPayment(
    @Param("id") id: string,
    @Body() body: unknown,
    @UploadedFile() file: BillingUpload | undefined,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpBillingClientPaymentClaimSchema.safeParse(
      normalizeMultipartBody(body)
    );
    if (!parsed.success) invalid();
    return this.billing.claimClientPayment(id, parsed.data, file, user, source);
  }

  @Post("billing/:id/finance-receipts")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 50 * 1024 * 1024 } })
  )
  addFinanceReceipt(
    @Param("id") id: string,
    @Body() body: unknown,
    @UploadedFile() file: BillingUpload | undefined,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpBillingFinanceReceiptSchema.safeParse(
      normalizeMultipartBody(body)
    );
    if (!parsed.success) invalid();
    return this.billing.addFinanceReceipt(id, parsed.data, file, user, source);
  }

  @Post("billing/:id/reconcile")
  reconcile(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource
  ) {
    const parsed = CmpBillingReconcileSchema.safeParse(body);
    if (!parsed.success) invalid();
    return this.billing.reconcile(id, parsed.data, user, source);
  }

  @Post("billing/:id/invoices")
  async generateInvoice(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @AuditSource() source: AuditLogSource,
    @Res() response: Response
  ) {
    const parsed = CmpBillingInvoiceInputSchema.safeParse(body);
    if (!parsed.success) invalid();
    const invoice = await this.billing.generateInvoice(
      id,
      parsed.data,
      user,
      source
    );
    response.type(invoice.mimeType);
    response.setHeader(
      "Content-Disposition",
      attachmentDisposition(invoice.fileName)
    );
    return response.send(invoice.body);
  }

  @Get("billing/artifacts/:artifactId/download")
  async download(
    @Param("artifactId") artifactId: string,
    @CurrentUser() user: RequestUser,
    @Res() response: Response
  ) {
    const file = await this.billing.downloadArtifact(artifactId, user);
    response.type(file.mimeType);
    response.setHeader(
      "Content-Disposition",
      attachmentDisposition(file.fileName)
    );
    if (file.redirectUrl) return response.redirect(302, file.redirectUrl);
    if (!file.absolutePath)
      throw new ApiBadRequestException("BAD_REQUEST", "File is unavailable");
    return response.send(await readFile(file.absolutePath));
  }

  @Get("engagements/:id/billing")
  listForEngagement(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.billing.listForEngagement(id, user);
  }
}

function invalid(): never {
  throw new ApiBadRequestException(
    "VALIDATION_FAILED",
    "Billing request is invalid"
  );
}

function normalizeMultipartBody(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const body = value as Record<string, unknown>;
  return {
    ...body,
    expectedVersion: numberValue(body.expectedVersion),
  };
}

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return value;
}

function attachmentDisposition(fileName: string) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
