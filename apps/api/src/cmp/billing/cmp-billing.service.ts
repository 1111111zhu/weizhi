import { createHash, randomUUID } from "node:crypto";

import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { Injectable, Optional } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CmpBilling,
  CmpBillingBankTemplate,
  CmpBillingClientPaymentClaimInput,
  CmpBillingDefaultsResponse,
  CmpBillingExpectedVersion,
  CmpBillingFinanceReceiptInput,
  CmpBillingFirmTemplate,
  CmpBillingImportOptionsResponse,
  CmpBillingInvoiceInput,
  CmpBillingListQuery,
  CmpBillingMarkSentInput,
  CmpBillingReconcileInput,
  CmpBillingReturnInput,
  CmpBillingTemplateListResponse,
  CmpBillingTemplateVersionInput,
  CmpBudgetCurrency,
  CreateCmpBillingBankTemplateInput,
  CreateCmpBillingFirmTemplateInput,
  CmpEngagementFeeNoteCollectionStatus,
  CmpFeeNoteLocalizedContents,
  CreateCmpBillingInput,
  UpdateCmpBillingBankTemplateInput,
  UpdateCmpBillingInput,
  UpdateCmpBillingFirmTemplateInput,
} from "@project-wing/shared";
import {
  CMP_BUDGET_CURRENCIES,
  CmpBillingImportOptionsResponseSchema,
  CmpBillingListResponseSchema,
  CmpBillingDefaultsResponseSchema,
  CmpBillingSchema,
  CmpBillingTemplateListResponseSchema,
  getCmpFixedBudgetExchangeRate,
} from "@project-wing/shared";

import type { AuditLogSource } from "../../audit-logs/audit-log-source";
import { AuditLogsService } from "../../audit-logs/audit-logs.service";
import type { RequestUser } from "../../auth/request-user";
import {
  ApiBadRequestException,
  ApiConflictException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../../common/api-error";
import { InboxService } from "../../inbox/inbox.service";
import { PrismaService } from "../../prisma/prisma.service";
import { StorageService } from "../../storage/storage.service";
import { CmpBudgetExchangeRatesService } from "../cmp-budget-exchange-rates.service";
import {
  buildFeeNoteExportDocument,
  buildFeeNoteDocx,
  buildFeeNotePdfSource,
} from "../cmp-engagement-fee-note-export";

export type BillingUpload = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

const MONEY_TOLERANCE = new Prisma.Decimal("0.01");
const FINANCE_ROLES = new Set(["PARTNER", "MANAGER", "SUPER_ADMIN"]);
const BILLING_INCLUDE = Prisma.validator<Prisma.CmpBillingInclude>()({
  engagement: {
    include: {
      client: true,
    },
  },
  lineItems: { orderBy: { sortOrder: "asc" } },
  artifacts: {
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  },
  financeReceipts: {
    orderBy: [{ receiptDate: "asc" }, { createdAt: "asc" }],
    include: {
      exchangeRateBatch: {
        select: { id: true, provider: true, sourceDate: true },
      },
    },
  },
});

@Injectable()
export class CmpBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly storage: StorageService,
    private readonly exchangeRates: CmpBudgetExchangeRatesService,
    @Optional() private readonly inbox?: InboxService
  ) {}

  async list(user: RequestUser, query: CmpBillingListQuery = {}) {
    const finance = isFinanceUser(user);
    if (!finance && !query.engagementId) {
      forbidden();
    }
    const collectionOverview = await this.collectionOverview(
      user,
      query.engagementId
    );
    const where: Prisma.CmpBillingWhereInput = {
      ...(query.queue === "PENDING_RECONCILIATION"
        ? { status: "CLIENT_PAID" }
        : query.queue === "RECONCILED"
          ? { status: "RECONCILED" }
          : {}),
      ...(query.engagementId ? { engagementId: query.engagementId } : {}),
      ...(query.query
        ? {
            OR: [
              { billNumber: { contains: query.query, mode: "insensitive" } },
              {
                engagement: {
                  engagementCode: {
                    contains: query.query,
                    mode: "insensitive",
                  },
                },
              },
              {
                engagement: {
                  client: {
                    OR: [
                      {
                        nameZh: { contains: query.query, mode: "insensitive" },
                      },
                      {
                        nameEn: { contains: query.query, mode: "insensitive" },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
      ...(finance
        ? {}
        : {
            engagement: {
              OR: [{ picUserId: user.id }, { micUserId: user.id }],
            },
          }),
    };
    const billings = await this.prisma.cmpBilling.findMany({
      where,
      include: BILLING_INCLUDE,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
    return CmpBillingListResponseSchema.parse({
      billings: billings.map((billing) => this.formatBilling(billing, user)),
      revenue: aggregateRevenue(billings),
      collectionOverview,
    });
  }

  async listForEngagement(engagementId: string, user: RequestUser) {
    await this.requireEngagementAccess(engagementId, user);
    return this.list(user, { engagementId, queue: "ALL" });
  }

  async get(id: string, user: RequestUser) {
    const billing = await this.findBilling(id);
    await this.requireBillingRead(billing, user);
    return CmpBillingSchema.parse(this.formatBilling(billing, user));
  }

  async getDefaults(
    id: string,
    user: RequestUser
  ): Promise<CmpBillingDefaultsResponse> {
    const billing = await this.prisma.cmpBilling.findUnique({
      where: { id },
      include: {
        engagement: {
          include: {
            client: {
              include: {
                addresses: { orderBy: [{ type: "asc" }, { sortOrder: "asc" }] },
              },
            },
            picUser: { select: { name: true } },
          },
        },
      },
    });
    if (!billing) {
      throw new ApiNotFoundException(
        "CMP_BILLING_NOT_FOUND",
        "Billing was not found"
      );
    }
    await this.requireBillingRead(billing, user);
    return CmpBillingDefaultsResponseSchema.parse(
      buildBillingDefaults(billing.engagement)
    );
  }

  async getImportOptions(
    id: string,
    user: RequestUser
  ): Promise<CmpBillingImportOptionsResponse> {
    const [defaults, templates] = await Promise.all([
      this.getDefaults(id, user),
      this.readTemplates(false),
    ]);
    const client = defaults.clientSnapshot;
    const zh = defaults.localizedContent["zh-CN"];
    const en = defaults.localizedContent["en-US"];
    return CmpBillingImportOptionsResponseSchema.parse({
      defaults,
      cmpFields: [
        {
          key: "clientSnapshot",
          section: "CLIENT",
          source: "Client master",
          editable: false,
          value: {
            zh: `${snapshotString(client, "clientCode")} · ${snapshotString(client, "nameZh")}`.trim(),
            en: `${snapshotString(client, "clientCode")} · ${snapshotString(client, "nameEn")}`.trim(),
          },
        },
        {
          key: "recipientName",
          section: "RECIPIENT",
          source: "Client master",
          editable: true,
          value: { zh: zh.recipientName, en: en.recipientName },
        },
        {
          key: "recipientAddress",
          section: "RECIPIENT",
          source: "Client registered / principal address",
          editable: true,
          value: { zh: zh.recipientAddress, en: en.recipientAddress },
        },
        {
          key: "recipientAttention",
          section: "RECIPIENT",
          source: "System billing default",
          editable: true,
          value: { zh: zh.recipientAttention, en: en.recipientAttention },
        },
        {
          key: "recipientSalutation",
          section: "RECIPIENT",
          source: "System billing default",
          editable: true,
          value: { zh: zh.recipientSalutation, en: en.recipientSalutation },
        },
        {
          key: "engagementSnapshot",
          section: "ENGAGEMENT",
          source: "Engagement master",
          editable: false,
          value: {
            zh: snapshotString(client, "engagementCode"),
            en: snapshotString(client, "engagementCode"),
          },
        },
        {
          key: "signatoryName",
          section: "ENGAGEMENT",
          source: "Engagement PIC",
          editable: true,
          value: { zh: zh.signatoryName, en: en.signatoryName },
        },
      ],
      firmTemplates: templates.firmTemplates.filter(
        (template) => template.status === "ACTIVE"
      ),
      bankTemplates: templates.bankTemplates.filter(
        (template) => template.status === "ACTIVE"
      ),
      canManageTemplates: isFinanceUser(user),
    });
  }

  async listTemplates(
    user: RequestUser,
    includeInactive: boolean
  ): Promise<CmpBillingTemplateListResponse> {
    this.requireTemplateManager(user);
    return this.readTemplates(includeInactive);
  }

  private async readTemplates(
    includeInactive: boolean
  ): Promise<CmpBillingTemplateListResponse> {
    const activeOnly = !includeInactive;
    const [firmTemplates, bankTemplates] = await Promise.all([
      this.prisma.cmpBillingFirmTemplate.findMany({
        where: activeOnly ? { status: "ACTIVE" } : {},
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      }),
      this.prisma.cmpBillingBankTemplate.findMany({
        where: activeOnly ? { status: "ACTIVE" } : {},
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      }),
    ]);
    return CmpBillingTemplateListResponseSchema.parse({
      canManage: true,
      firmTemplates: firmTemplates.map(formatFirmTemplate),
      bankTemplates: bankTemplates.map(formatBankTemplate),
    });
  }

  async createFirmTemplate(
    input: CreateCmpBillingFirmTemplateInput,
    user: RequestUser,
    source?: AuditLogSource
  ): Promise<CmpBillingFirmTemplate> {
    this.requireTemplateManager(user);
    try {
      const template = await this.prisma.$transaction(async (tx) => {
        if (input.isDefault) {
          await tx.cmpBillingFirmTemplate.updateMany({
            where: { status: "ACTIVE", isDefault: true },
            data: {
              isDefault: false,
              version: { increment: 1 },
              updatedById: user.id,
            },
          });
        }
        return tx.cmpBillingFirmTemplate.create({
          data: {
            name: input.name,
            isDefault: input.isDefault ?? false,
            firmLegalNameZh: input.firmLegalNameZh,
            firmLegalNameEn: input.firmLegalNameEn,
            firmAddressZh: input.firmAddressZh,
            firmAddressEn: input.firmAddressEn,
            phone: input.phone,
            email: input.email,
            website: input.website,
            createdById: user.id,
            updatedById: user.id,
          },
        });
      });
      await this.auditTemplate(
        user,
        "CMP_BILLING_FIRM_TEMPLATE_CREATED",
        template.id,
        `Created firm template ${template.name}`,
        source
      );
      return formatFirmTemplate(template);
    } catch (error) {
      throwTemplateNameConflict(error);
    }
  }

  async updateFirmTemplate(
    id: string,
    input: UpdateCmpBillingFirmTemplateInput,
    user: RequestUser,
    source?: AuditLogSource
  ): Promise<CmpBillingFirmTemplate> {
    this.requireTemplateManager(user);
    try {
      const template = await this.prisma.$transaction(async (tx) => {
        const current = await tx.cmpBillingFirmTemplate.findUnique({
          where: { id },
        });
        if (!current) {
          templateNotFound();
        }
        if (input.isDefault) {
          await tx.cmpBillingFirmTemplate.updateMany({
            where: { status: "ACTIVE", isDefault: true, id: { not: id } },
            data: {
              isDefault: false,
              version: { increment: 1 },
              updatedById: user.id,
            },
          });
        }
        const changed = await tx.cmpBillingFirmTemplate.updateMany({
          where: { id, version: input.expectedVersion, status: "ACTIVE" },
          data: {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.firmLegalNameZh === undefined
              ? {}
              : { firmLegalNameZh: input.firmLegalNameZh }),
            ...(input.firmLegalNameEn === undefined
              ? {}
              : { firmLegalNameEn: input.firmLegalNameEn }),
            ...(input.firmAddressZh === undefined
              ? {}
              : { firmAddressZh: input.firmAddressZh }),
            ...(input.firmAddressEn === undefined
              ? {}
              : { firmAddressEn: input.firmAddressEn }),
            ...(input.phone === undefined ? {} : { phone: input.phone }),
            ...(input.email === undefined ? {} : { email: input.email }),
            ...(input.website === undefined ? {} : { website: input.website }),
            ...(input.isDefault === undefined
              ? {}
              : { isDefault: input.isDefault }),
            version: { increment: 1 },
            updatedById: user.id,
          },
        });
        if (changed.count !== 1) {
          versionConflict();
        }
        return tx.cmpBillingFirmTemplate.findUniqueOrThrow({ where: { id } });
      });
      await this.auditTemplate(
        user,
        "CMP_BILLING_FIRM_TEMPLATE_UPDATED",
        template.id,
        `Updated firm template ${template.name}`,
        source
      );
      return formatFirmTemplate(template);
    } catch (error) {
      throwTemplateNameConflict(error);
    }
  }

  async deactivateFirmTemplate(
    id: string,
    input: CmpBillingTemplateVersionInput,
    user: RequestUser,
    source?: AuditLogSource
  ): Promise<CmpBillingFirmTemplate> {
    this.requireTemplateManager(user);
    const template = await this.prisma.cmpBillingFirmTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      templateNotFound();
    }
    if (template.version !== input.expectedVersion) {
      versionConflict();
    }
    if (template.status !== "ACTIVE") {
      stateConflict("Template is already inactive");
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.cmpBillingFirmTemplate.updateMany({
        where: { id, version: input.expectedVersion, status: "ACTIVE" },
        data: {
          status: "INACTIVE",
          isDefault: false,
          version: { increment: 1 },
          updatedById: user.id,
        },
      });
      if (changed.count !== 1) {
        versionConflict();
      }
      return tx.cmpBillingFirmTemplate.findUniqueOrThrow({ where: { id } });
    });
    await this.auditTemplate(
      user,
      "CMP_BILLING_FIRM_TEMPLATE_DEACTIVATED",
      id,
      `Deactivated firm template ${updated.name}`,
      source
    );
    return formatFirmTemplate(updated);
  }

  async createBankTemplate(
    input: CreateCmpBillingBankTemplateInput,
    user: RequestUser,
    source?: AuditLogSource
  ): Promise<CmpBillingBankTemplate> {
    this.requireTemplateManager(user);
    try {
      const template = await this.prisma.$transaction(async (tx) => {
        if (input.isDefault) {
          await tx.cmpBillingBankTemplate.updateMany({
            where: { status: "ACTIVE", isDefault: true },
            data: {
              isDefault: false,
              version: { increment: 1 },
              updatedById: user.id,
            },
          });
        }
        return tx.cmpBillingBankTemplate.create({
          data: {
            name: input.name,
            isDefault: input.isDefault ?? false,
            bankPayeeNameZh: input.bankPayeeNameZh,
            bankPayeeNameEn: input.bankPayeeNameEn,
            bankNameZh: input.bankNameZh,
            bankNameEn: input.bankNameEn,
            hkdAccountNumber: input.hkdAccountNumber,
            hkdSwiftCode: input.hkdSwiftCode,
            cnyAccountNumber: input.cnyAccountNumber,
            cnySwiftCode: input.cnySwiftCode,
            usdAccountNumber: input.usdAccountNumber,
            usdSwiftCode: input.usdSwiftCode,
            createdById: user.id,
            updatedById: user.id,
          },
        });
      });
      await this.auditTemplate(
        user,
        "CMP_BILLING_BANK_TEMPLATE_CREATED",
        template.id,
        `Created bank template ${template.name}`,
        source
      );
      return formatBankTemplate(template);
    } catch (error) {
      throwTemplateNameConflict(error);
    }
  }

  async updateBankTemplate(
    id: string,
    input: UpdateCmpBillingBankTemplateInput,
    user: RequestUser,
    source?: AuditLogSource
  ): Promise<CmpBillingBankTemplate> {
    this.requireTemplateManager(user);
    try {
      const template = await this.prisma.$transaction(async (tx) => {
        const current = await tx.cmpBillingBankTemplate.findUnique({
          where: { id },
        });
        if (!current) {
          templateNotFound();
        }
        if (input.isDefault) {
          await tx.cmpBillingBankTemplate.updateMany({
            where: { status: "ACTIVE", isDefault: true, id: { not: id } },
            data: {
              isDefault: false,
              version: { increment: 1 },
              updatedById: user.id,
            },
          });
        }
        const changed = await tx.cmpBillingBankTemplate.updateMany({
          where: { id, version: input.expectedVersion, status: "ACTIVE" },
          data: {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.bankPayeeNameZh === undefined
              ? {}
              : { bankPayeeNameZh: input.bankPayeeNameZh }),
            ...(input.bankPayeeNameEn === undefined
              ? {}
              : { bankPayeeNameEn: input.bankPayeeNameEn }),
            ...(input.bankNameZh === undefined
              ? {}
              : { bankNameZh: input.bankNameZh }),
            ...(input.bankNameEn === undefined
              ? {}
              : { bankNameEn: input.bankNameEn }),
            ...(input.hkdAccountNumber === undefined
              ? {}
              : { hkdAccountNumber: input.hkdAccountNumber }),
            ...(input.hkdSwiftCode === undefined
              ? {}
              : { hkdSwiftCode: input.hkdSwiftCode }),
            ...(input.cnyAccountNumber === undefined
              ? {}
              : { cnyAccountNumber: input.cnyAccountNumber }),
            ...(input.cnySwiftCode === undefined
              ? {}
              : { cnySwiftCode: input.cnySwiftCode }),
            ...(input.usdAccountNumber === undefined
              ? {}
              : { usdAccountNumber: input.usdAccountNumber }),
            ...(input.usdSwiftCode === undefined
              ? {}
              : { usdSwiftCode: input.usdSwiftCode }),
            ...(input.isDefault === undefined
              ? {}
              : { isDefault: input.isDefault }),
            version: { increment: 1 },
            updatedById: user.id,
          },
        });
        if (changed.count !== 1) {
          versionConflict();
        }
        return tx.cmpBillingBankTemplate.findUniqueOrThrow({ where: { id } });
      });
      await this.auditTemplate(
        user,
        "CMP_BILLING_BANK_TEMPLATE_UPDATED",
        template.id,
        `Updated bank template ${template.name}`,
        source
      );
      return formatBankTemplate(template);
    } catch (error) {
      throwTemplateNameConflict(error);
    }
  }

  async deactivateBankTemplate(
    id: string,
    input: CmpBillingTemplateVersionInput,
    user: RequestUser,
    source?: AuditLogSource
  ): Promise<CmpBillingBankTemplate> {
    this.requireTemplateManager(user);
    const template = await this.prisma.cmpBillingBankTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      templateNotFound();
    }
    if (template.version !== input.expectedVersion) {
      versionConflict();
    }
    if (template.status !== "ACTIVE") {
      stateConflict("Template is already inactive");
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.cmpBillingBankTemplate.updateMany({
        where: { id, version: input.expectedVersion, status: "ACTIVE" },
        data: {
          status: "INACTIVE",
          isDefault: false,
          version: { increment: 1 },
          updatedById: user.id,
        },
      });
      if (changed.count !== 1) {
        versionConflict();
      }
      return tx.cmpBillingBankTemplate.findUniqueOrThrow({ where: { id } });
    });
    await this.auditTemplate(
      user,
      "CMP_BILLING_BANK_TEMPLATE_DEACTIVATED",
      id,
      `Deactivated bank template ${updated.name}`,
      source
    );
    return formatBankTemplate(updated);
  }

  async create(
    input: CreateCmpBillingInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const engagement = await this.requireEngagementAccess(
      input.engagementId,
      user
    );
    if (
      !isFinanceUser(user) &&
      engagement.picUserId !== user.id &&
      engagement.micUserId !== user.id
    ) {
      forbidden();
    }
    const now = new Date();
    const year = now.getUTCFullYear();
    const defaults = buildBillingDefaults(engagement);
    const localized = mergeBillingLocalizedContent(
      defaults.localizedContent,
      input.localizedContent,
      engagement
    );
    const clientSnapshot = input.clientSnapshot ?? defaults.clientSnapshot;
    const firmSnapshot = input.firmSnapshot ?? defaults.firmSnapshot;
    const lines = normalizeLineItems(input.lineItems);
    const total = sumLines(lines);
    const created = await this.prisma.$transaction(async (tx) => {
      const sequence = await tx.$queryRaw<{ lastNumber: number }[]>(Prisma.sql`
        INSERT INTO "cmp_billing_sequences" ("id", "year", "last_number", "created_at", "updated_at")
        VALUES (${randomUUID()}, ${year}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("year") DO UPDATE
        SET "last_number" = "cmp_billing_sequences"."last_number" + 1,
            "updated_at" = CURRENT_TIMESTAMP
        RETURNING "last_number" AS "lastNumber"
      `);
      const number = sequence[0]?.lastNumber;
      if (!number) {
        throw new ApiConflictException(
          "CMP_BILLING_STATE_CONFLICT",
          "Unable to allocate a billing number"
        );
      }
      const billing = await tx.cmpBilling.create({
        data: {
          engagementId: engagement.id,
          billNumber: `${year}-${String(number).padStart(4, "0")}`,
          numberYear: year,
          sequenceNumber: number,
          issueDate: toDate(input.issueDate) ?? now,
          currency: input.currency ?? engagement.feeCurrency,
          subtotalAmount: total,
          totalAmount: total,
          clientSnapshot: clientSnapshot as Prisma.InputJsonValue,
          firmSnapshot: firmSnapshot as Prisma.InputJsonValue,
          localizedContent: localized as Prisma.InputJsonValue,
          createdById: user.id,
          lineItems: {
            create: lines.map((line, index) => ({
              descriptionZh: line.descriptionZh,
              descriptionEn: line.descriptionEn,
              amount: line.amount,
              sortOrder: line.sortOrder ?? index,
            })),
          },
          statusEvents: {
            create: {
              toStatus: "DRAFT",
              action: "CREATED",
              actorId: user.id,
              payload: {
                billNumber: `${year}-${String(number).padStart(4, "0")}`,
              },
            },
          },
        },
        include: BILLING_INCLUDE,
      });
      return billing;
    });
    await this.audit(
      user,
      "CMP_BILLING_CREATED",
      created.id,
      `Created billing ${created.billNumber}`,
      source
    );
    return CmpBillingSchema.parse(this.formatBilling(created, user));
  }

  async update(
    id: string,
    input: UpdateCmpBillingInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const billing = await this.findBilling(id);
    await this.requireEngagementWrite(billing, user);
    requireDraft(billing);
    requireVersion(billing, input.expectedVersion);
    if (input.importAudit) {
      await this.validateImportAudit(input.importAudit);
    }
    const lines = input.lineItems ? normalizeLineItems(input.lineItems) : null;
    const total = lines
      ? sumLines(lines)
      : new Prisma.Decimal(billing.totalAmount);
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.cmpBilling.updateMany({
        where: { id, version: input.expectedVersion, status: "DRAFT" },
        data: {
          version: { increment: 1 },
          ...(input.issueDate === undefined
            ? {}
            : { issueDate: toDate(input.issueDate) ?? billing.issueDate }),
          ...(input.currency ? { currency: input.currency } : {}),
          ...(input.clientSnapshot
            ? { clientSnapshot: input.clientSnapshot as Prisma.InputJsonValue }
            : {}),
          ...(input.firmSnapshot
            ? { firmSnapshot: input.firmSnapshot as Prisma.InputJsonValue }
            : {}),
          ...(input.localizedContent
            ? {
                localizedContent: normalizeLocalizedContent(
                  input.localizedContent,
                  billing.engagement
                ) as Prisma.InputJsonValue,
              }
            : {}),
          ...(lines ? { subtotalAmount: total, totalAmount: total } : {}),
        },
      });
      if (changed.count !== 1) {
        versionConflict();
      }
      if (lines) {
        await tx.cmpBillingLineItem.deleteMany({ where: { billingId: id } });
        await tx.cmpBillingLineItem.createMany({
          data: lines.map((line, index) => ({
            billingId: id,
            descriptionZh: line.descriptionZh,
            descriptionEn: line.descriptionEn,
            amount: line.amount,
            sortOrder: line.sortOrder ?? index,
          })),
        });
      }
      await tx.cmpBillingStatusEvent.create({
        data: {
          billingId: id,
          fromStatus: "DRAFT",
          toStatus: "DRAFT",
          action: "UPDATED",
          actorId: user.id,
        },
      });
      return tx.cmpBilling.findUniqueOrThrow({
        where: { id },
        include: BILLING_INCLUDE,
      });
    });
    await this.audit(
      user,
      "CMP_BILLING_UPDATED",
      id,
      `Updated billing ${updated.billNumber}`,
      source
    );
    if (input.importAudit) {
      await this.auditLogs.log({
        actorId: user.id,
        action: "CMP_BILLING_DATA_IMPORTED",
        targetType: "CMP_BILLING",
        targetId: id,
        description: `Imported ${input.importAudit.fieldKeys.join(", ")} from ${input.importAudit.sources.join(", ")}`,
        source,
      });
    }
    return CmpBillingSchema.parse(this.formatBilling(updated, user));
  }

  async remove(
    id: string,
    expectedVersion: number,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const billing = await this.findBilling(id);
    await this.requireEngagementWrite(billing, user);
    requireDraft(billing);
    requireVersion(billing, expectedVersion);
    const deleted = await this.prisma.cmpBilling.deleteMany({
      where: { id, status: "DRAFT", version: expectedVersion },
    });
    if (deleted.count !== 1) {
      versionConflict();
    }
    await this.audit(
      user,
      "CMP_BILLING_DELETED",
      id,
      `Deleted draft billing ${billing.billNumber}`,
      source
    );
    return { deleted: true };
  }

  async submit(
    id: string,
    input: CmpBillingExpectedVersion,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const billing = await this.findBilling(id);
    await this.requireEngagementWrite(billing, user);
    return this.transition(
      billing,
      input.expectedVersion,
      "DRAFT",
      "SUBMITTED",
      "SUBMITTED",
      user,
      source,
      {
        submittedAt: new Date(),
        submittedById: user.id,
        returnReason: null,
      },
      [billing.engagement.picUserId]
    );
  }

  async returnToDraft(
    id: string,
    input: CmpBillingReturnInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const billing = await this.findBilling(id);
    this.requirePic(billing, user);
    return this.transition(
      billing,
      input.expectedVersion,
      "SUBMITTED",
      "DRAFT",
      "RETURNED",
      user,
      source,
      {
        returnedAt: new Date(),
        returnReason: input.reason,
      },
      [billing.createdById, billing.engagement.micUserId]
    );
  }

  async approve(
    id: string,
    input: CmpBillingExpectedVersion,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const billing = await this.findBilling(id);
    this.requirePic(billing, user);
    return this.transition(
      billing,
      input.expectedVersion,
      "SUBMITTED",
      "APPROVED",
      "APPROVED",
      user,
      source,
      {
        approvedAt: new Date(),
        approvedById: user.id,
      },
      [billing.createdById, billing.engagement.micUserId]
    );
  }

  async markSent(
    id: string,
    input: CmpBillingMarkSentInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const billing = await this.findBilling(id);
    await this.requireEngagementWrite(billing, user);
    return this.transition(
      billing,
      input.expectedVersion,
      "APPROVED",
      "SENT",
      "MARKED_SENT",
      user,
      source,
      {
        sentAt: new Date(),
        sentById: user.id,
        sentMethod: input.method,
        sentNote: input.note ?? null,
      },
      [billing.engagement.picUserId, billing.engagement.micUserId]
    );
  }

  async claimClientPayment(
    id: string,
    input: CmpBillingClientPaymentClaimInput,
    file: BillingUpload | undefined,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const billing = await this.findBilling(id);
    await this.requireEngagementWrite(billing, user);
    if (!file?.buffer?.length) {
      throw new ApiBadRequestException(
        "CMP_BILLING_RECEIPT_REQUIRED",
        "Client payment evidence is required"
      );
    }
    if (input.currency !== billing.currency) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Client payment claims must use the billing currency; finance receipts support cross-currency settlement"
      );
    }
    const artifactId = randomUUID();
    const artifact = await this.storeArtifact(
      billing,
      artifactId,
      "CLIENT_PAYMENT_EVIDENCE",
      file,
      user
    );
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const changed = await tx.cmpBilling.updateMany({
          where: { id, version: input.expectedVersion, status: "SENT" },
          data: {
            status: "CLIENT_PAID",
            version: { increment: 1 },
            clientClaimAmount: new Prisma.Decimal(input.amount),
            clientClaimCurrency: input.currency,
            clientClaimPaidAt: toDate(input.paidAt),
            clientClaimReference: input.reference,
            clientClaimNote: input.note ?? null,
            clientPaidAt: new Date(),
          },
        });
        if (changed.count !== 1) {
          versionConflict();
        }
        await tx.cmpBilling.update({
          where: { id },
          data: { clientPaidBy: { connect: { id: user.id } } },
        });
        await tx.cmpBillingArtifact.create({ data: artifact });
        await tx.cmpBillingStatusEvent.create({
          data: {
            billingId: id,
            fromStatus: "SENT",
            toStatus: "CLIENT_PAID",
            action: "CLIENT_PAYMENT_CLAIMED",
            actorId: user.id,
            payload: {
              amount: input.amount,
              currency: input.currency,
              artifactId,
            },
          },
        });
        return tx.cmpBilling.findUniqueOrThrow({
          where: { id },
          include: BILLING_INCLUDE,
        });
      });
      await this.audit(
        user,
        "CMP_BILLING_CLIENT_PAYMENT_CLAIMED",
        id,
        `Client payment claimed for ${billing.billNumber}`,
        source
      );
      await this.notifyFinance(
        updated,
        `待确收账单 ${updated.billNumber}`,
        "客户已上传付款佐证，请进行银行到账核对。"
      );
      return CmpBillingSchema.parse(this.formatBilling(updated, user));
    } catch (error) {
      // The object is immutable and safe to retain if a concurrent update wins;
      // it is not exposed because no artifact database row was created.
      throw error;
    }
  }

  async addFinanceReceipt(
    id: string,
    input: CmpBillingFinanceReceiptInput,
    file: BillingUpload | undefined,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const billing = await this.findBilling(id);
    this.requireFinance(user);
    if (billing.status !== "CLIENT_PAID") {
      stateConflict(
        "Finance receipts can only be added after client payment is claimed"
      );
    }
    requireVersion(billing, input.expectedVersion);
    if (!file?.buffer?.length) {
      throw new ApiBadRequestException(
        "CMP_BILLING_RECEIPT_REQUIRED",
        "A finance bank receipt is required"
      );
    }
    const receiptId = randomUUID();
    const artifactId = randomUUID();
    const conversion = await this.exchangeRates.conversionForReceipt(
      input.currency,
      billing.currency as CmpBillingFinanceReceiptInput["currency"]
    );
    const rate = conversion.exchangeRateToBill;
    const billAmount = new Prisma.Decimal(input.amount)
      .mul(rate)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const artifact = await this.storeArtifact(
      billing,
      artifactId,
      "FINANCE_RECEIPT",
      file,
      user,
      receiptId
    );
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.cmpBilling.updateMany({
        where: { id, version: input.expectedVersion, status: "CLIENT_PAID" },
        data: { version: { increment: 1 } },
      });
      if (changed.count !== 1) {
        versionConflict();
      }
      await tx.cmpBillingFinanceReceipt.create({
        data: {
          id: receiptId,
          billingId: id,
          receiptDate: toDate(input.receiptDate)!,
          bankReference: input.bankReference,
          receiptAmount: new Prisma.Decimal(input.amount),
          receiptCurrency: input.currency,
          exchangeRateToBill: rate,
          exchangeRateBatchId: conversion.batchId,
          billCurrencyAmount: billAmount,
          internalNote: input.internalNote ?? null,
          createdById: user.id,
        },
      });
      await tx.cmpBillingArtifact.create({ data: artifact });
      await tx.cmpBillingStatusEvent.create({
        data: {
          billingId: id,
          fromStatus: "CLIENT_PAID",
          toStatus: "CLIENT_PAID",
          action: "FINANCE_RECEIPT_ADDED",
          actorId: user.id,
          payload: {
            receiptId,
            billCurrencyAmount: billAmount.toFixed(2),
            exchangeRateBatchId: conversion.batchId,
            artifactId,
          },
        },
      });
      return tx.cmpBilling.findUniqueOrThrow({
        where: { id },
        include: BILLING_INCLUDE,
      });
    });
    await this.audit(
      user,
      "CMP_BILLING_FINANCE_RECEIPT_ADDED",
      id,
      `Added finance receipt to ${billing.billNumber}`,
      source
    );
    return CmpBillingSchema.parse(this.formatBilling(updated, user));
  }

  async reconcile(
    id: string,
    input: CmpBillingReconcileInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const billing = await this.findBilling(id);
    this.requireFinance(user);
    requireVersion(billing, input.expectedVersion);
    if (user.globalRole === "SUPER_ADMIN" && !input.overrideReason?.trim()) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A super administrator must state a finance override reason"
      );
    }
    if (billing.status !== "CLIENT_PAID") {
      stateConflict("Only client-paid bills can be reconciled");
    }
    const evidenceReceiptIds = new Set(
      billing.artifacts
        .filter(
          (artifact) =>
            artifact.type === "FINANCE_RECEIPT" && artifact.financeReceiptId
        )
        .map((artifact) => artifact.financeReceiptId)
    );
    if (
      !billing.financeReceipts.length ||
      billing.financeReceipts.some(
        (receipt) => !evidenceReceiptIds.has(receipt.id)
      )
    ) {
      throw new ApiBadRequestException(
        "CMP_BILLING_RECEIPT_REQUIRED",
        "Each finance receipt must include its own bank evidence"
      );
    }
    const received = receiptTotal(billing.financeReceipts);
    if (
      received
        .sub(new Prisma.Decimal(billing.totalAmount))
        .abs()
        .gt(MONEY_TOLERANCE)
    ) {
      throw new ApiConflictException(
        "CMP_BILLING_NOT_BALANCED",
        "Actual receipts must equal the billing total within 0.01",
        {
          received: received.toFixed(2),
          total: decimalText(billing.totalAmount),
        }
      );
    }
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.cmpBilling.updateMany({
        where: { id, version: input.expectedVersion, status: "CLIENT_PAID" },
        data: {
          status: "RECONCILED",
          version: { increment: 1 },
          reconciledAt: now,
          financeOverrideReason:
            user.globalRole === "SUPER_ADMIN"
              ? input.overrideReason!.trim()
              : null,
        },
      });
      if (changed.count !== 1) {
        versionConflict();
      }
      await tx.cmpBilling.update({
        where: { id },
        data: { reconciledBy: { connect: { id: user.id } } },
      });
      await tx.cmpBillingArtifact.updateMany({
        where: { billingId: id },
        data: { retentionUntil: sevenYearsAfter(now) },
      });
      await tx.cmpBillingStatusEvent.create({
        data: {
          billingId: id,
          fromStatus: "CLIENT_PAID",
          toStatus: "RECONCILED",
          action: "RECONCILED",
          reason:
            user.globalRole === "SUPER_ADMIN"
              ? input.overrideReason!.trim()
              : null,
          actorId: user.id,
          payload: {
            received: received.toFixed(2),
            total: decimalText(billing.totalAmount),
          },
        },
      });
      return tx.cmpBilling.findUniqueOrThrow({
        where: { id },
        include: BILLING_INCLUDE,
      });
    });
    await this.audit(
      user,
      "CMP_BILLING_RECONCILED",
      id,
      `Reconciled billing ${billing.billNumber}`,
      source
    );
    await this.notifyUsers(
      [updated.engagement.picUserId, updated.engagement.micUserId],
      `账单已确收 ${updated.billNumber}`,
      "财务已完成银行到账核对。"
    );
    return CmpBillingSchema.parse(this.formatBilling(updated, user));
  }

  async generateInvoice(
    id: string,
    input: CmpBillingInvoiceInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const billing = await this.findBilling(id);
    await this.requireBillingRead(billing, user);
    requireVersion(billing, input.expectedVersion);
    if (!["SENT", "CLIENT_PAID", "RECONCILED"].includes(billing.status)) {
      stateConflict(
        "An invoice can only be generated after the bill is marked sent"
      );
    }
    const document = buildBillingInvoiceDocument(billing, input.locale);
    const format = input.format ?? "pdf";
    const body =
      format === "docx"
        ? await buildFeeNoteDocx(document)
        : compileFeeNotePdf(document);
    const mimeType =
      format === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf";
    // The database unique index is the source of truth for version allocation.
    // Retrying after a collision keeps parallel generation immutable and sequential.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const latest = await this.prisma.cmpBillingArtifact.aggregate({
        where: { billingId: id, type: "INVOICE", locale: input.locale },
        _max: { version: true },
      });
      const version = (latest._max.version ?? 0) + 1;
      const fileName = `${safeFileName(billing.billNumber)}-invoice-${input.locale}-v${version}.${format}`;
      const artifactId = randomUUID();
      const stored = await this.storeArtifact(
        billing,
        artifactId,
        "INVOICE",
        {
          buffer: body,
          originalname: fileName,
          mimetype: mimeType,
          size: body.length,
        },
        user
      );
      try {
        const created = await this.prisma.cmpBillingArtifact.create({
          data: { ...stored, locale: input.locale, version },
          include: { uploadedBy: { select: { id: true, name: true } } },
        });
        await this.audit(
          user,
          "CMP_BILLING_INVOICE_GENERATED",
          id,
          `Generated ${input.locale} invoice ${fileName}`,
          source
        );
        return { artifact: created, fileName, body, mimeType };
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2002" ||
          attempt === 2
        ) {
          throw error;
        }
      }
    }
    throw new ApiConflictException(
      "CMP_BILLING_VERSION_CONFLICT",
      "Invoice version allocation conflicted; please retry"
    );
  }

  async downloadArtifact(artifactId: string, user: RequestUser) {
    const artifact = await this.prisma.cmpBillingArtifact.findUnique({
      where: { id: artifactId },
      include: { billing: { include: { engagement: true } } },
    });
    if (!artifact) {
      throw new ApiNotFoundException(
        "CMP_BILLING_ARTIFACT_NOT_FOUND",
        "Billing artifact was not found"
      );
    }
    const finance = isFinanceUser(user);
    const member =
      artifact.billing.engagement.picUserId === user.id ||
      artifact.billing.engagement.micUserId === user.id;
    if (!finance && !member) {
      forbidden();
    }
    if (!finance && artifact.type === "FINANCE_RECEIPT") {
      forbidden();
    }
    return this.storage.getDownloadObject(
      artifact.objectKey,
      artifact.fileName,
      artifact.mimeType
    );
  }

  private async transition(
    billing: any,
    expectedVersion: number,
    fromStatus: "DRAFT" | "SUBMITTED" | "APPROVED",
    toStatus: "DRAFT" | "SUBMITTED" | "APPROVED" | "SENT",
    action: string,
    user: RequestUser,
    source: AuditLogSource | undefined,
    data: Record<string, unknown>,
    notify: (string | null | undefined)[]
  ) {
    requireVersion(billing, expectedVersion);
    if (billing.status !== fromStatus) {
      stateConflict(`Billing is not ${fromStatus}`);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const relationData = billingRelationData(data);
      const changed = await tx.cmpBilling.updateMany({
        where: { id: billing.id, version: expectedVersion, status: fromStatus },
        data: {
          ...billingScalarData(data),
          status: toStatus,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        versionConflict();
      }
      if (Object.keys(relationData).length) {
        await tx.cmpBilling.update({
          where: { id: billing.id },
          data: relationData,
        });
      }
      await tx.cmpBillingStatusEvent.create({
        data: {
          billingId: billing.id,
          fromStatus,
          toStatus,
          action,
          reason: (data as { returnReason?: string }).returnReason ?? null,
          actorId: user.id,
        },
      });
      return tx.cmpBilling.findUniqueOrThrow({
        where: { id: billing.id },
        include: BILLING_INCLUDE,
      });
    });
    await this.audit(
      user,
      `CMP_BILLING_${action}`,
      billing.id,
      `${action} billing ${billing.billNumber}`,
      source
    );
    await this.notifyUsers(
      notify,
      `账单状态更新 ${updated.billNumber}`,
      `账单现处于 ${updated.status}。`
    );
    return CmpBillingSchema.parse(this.formatBilling(updated, user));
  }

  private async findBilling(id: string) {
    const billing = await this.prisma.cmpBilling.findUnique({
      where: { id },
      include: BILLING_INCLUDE,
    });
    if (!billing) {
      throw new ApiNotFoundException(
        "CMP_BILLING_NOT_FOUND",
        "Billing was not found"
      );
    }
    return billing;
  }

  private async collectionOverview(user: RequestUser, engagementId?: string) {
    const selectedEngagement = engagementId
      ? await this.requireEngagementAccess(engagementId, user)
      : null;
    const engagements = selectedEngagement
      ? [selectedEngagement]
      : await this.prisma.cmpEngagement.findMany({
          where: { status: { not: "ARCHIVED" } },
          select: {
            id: true,
            engagementCode: true,
            agreedFee: true,
            feeCurrency: true,
            feeExchangeRateHkdPerUnit: true,
            serviceType: true,
            status: true,
            client: {
              select: {
                clientCode: true,
                nameZh: true,
                nameEn: true,
              },
            },
          },
        });
    const engagementIds = engagements.map((engagement) => engagement.id);
    const receiptBillings = engagementIds.length
      ? await this.prisma.cmpBilling.findMany({
          where: { engagementId: { in: engagementIds } },
          select: {
            currency: true,
            financeReceipts: { select: { billCurrencyAmount: true } },
            engagement: {
              select: {
                feeCurrency: true,
                feeExchangeRateHkdPerUnit: true,
              },
            },
          },
        })
      : [];
    const currency = selectedEngagement
      ? asBillingCurrency(selectedEngagement.feeCurrency)
      : "HKD";
    const hkdRateFor = (engagement: {
      feeCurrency: string;
      feeExchangeRateHkdPerUnit?: Prisma.Decimal | null;
    }) =>
      engagement.feeCurrency === "HKD"
        ? new Prisma.Decimal(1)
        : (engagement.feeExchangeRateHkdPerUnit ??
          new Prisma.Decimal(
            getCmpFixedBudgetExchangeRate(
              asBillingCurrency(engagement.feeCurrency)
            ).hkdPerUnit
          ));
    const agreedFee = engagements.reduce((total, engagement) => {
      const original = new Prisma.Decimal(engagement.agreedFee);
      return total.add(
        selectedEngagement ? original : original.mul(hkdRateFor(engagement))
      );
    }, new Prisma.Decimal(0));
    const actualReceived = receiptBillings.reduce(
      (total, billing) =>
        total.add(
          selectedEngagement
            ? receiptTotal(billing.financeReceipts)
            : receiptTotal(billing.financeReceipts).mul(
                hkdRateFor(billing.engagement)
              )
        ),
      new Prisma.Decimal(0)
    );
    const outstanding = Prisma.Decimal.max(agreedFee.sub(actualReceived), 0);
    const overReceived = Prisma.Decimal.max(actualReceived.sub(agreedFee), 0);
    const receivedRate = agreedFee.gt(0)
      ? decimalText(actualReceived.div(agreedFee).mul(100))
      : null;

    return {
      scope: selectedEngagement ? "ENGAGEMENT" : "ALL",
      currency,
      agreedFee: decimalText(agreedFee),
      actualReceived: decimalText(actualReceived),
      outstanding: decimalText(outstanding),
      receivedRate,
      overReceived: decimalText(overReceived),
      engagement: selectedEngagement
        ? {
            id: selectedEngagement.id,
            engagementCode: selectedEngagement.engagementCode,
            clientCode: selectedEngagement.client.clientCode,
            clientName:
              selectedEngagement.client.nameZh ||
              selectedEngagement.client.nameEn ||
              "",
            serviceType: selectedEngagement.serviceType,
            status: selectedEngagement.status,
          }
        : null,
    };
  }

  private async requireEngagementAccess(
    engagementId: string,
    user: RequestUser
  ) {
    const engagement = await this.prisma.cmpEngagement.findUnique({
      where: { id: engagementId },
      include: {
        client: {
          include: {
            addresses: { orderBy: [{ type: "asc" }, { sortOrder: "asc" }] },
          },
        },
        picUser: { select: { name: true } },
      },
    });
    if (!engagement) {
      throw new ApiNotFoundException("NOT_FOUND", "Engagement was not found");
    }
    if (
      isFinanceUser(user) ||
      engagement.picUserId === user.id ||
      engagement.micUserId === user.id
    ) {
      return engagement;
    }
    forbidden();
  }

  private async requireEngagementWrite(billing: any, user: RequestUser) {
    const financeDraftCreator =
      isFinanceUser(user) &&
      billing.createdById === user.id &&
      billing.status === "DRAFT";
    if (
      financeDraftCreator ||
      billing.engagement.picUserId === user.id ||
      billing.engagement.micUserId === user.id
    ) {
      return;
    }
    forbidden();
  }

  private requirePic(billing: any, user: RequestUser) {
    if (billing.engagement.picUserId === user.id) {
      return;
    }
    forbidden();
  }

  private requireFinance(user: RequestUser) {
    if (isFinanceUser(user)) {
      return;
    }
    forbidden();
  }

  private requireTemplateManager(user: RequestUser) {
    if (isFinanceUser(user)) {
      return;
    }
    forbidden();
  }

  private async requireBillingRead(billing: any, user: RequestUser) {
    if (
      isFinanceUser(user) ||
      billing.engagement.picUserId === user.id ||
      billing.engagement.micUserId === user.id
    ) {
      return;
    }
    forbidden();
  }

  private formatBilling(billing: any, user: RequestUser): CmpBilling {
    const finance = isFinanceUser(user);
    const receipts = finance ? billing.financeReceipts : [];
    const artifacts = billing.artifacts.filter(
      (artifact: any) => finance || artifact.type !== "FINANCE_RECEIPT"
    );
    const total = new Prisma.Decimal(billing.totalAmount);
    const received = receiptTotal(billing.financeReceipts);
    const localized = normalizeLocalizedContent(
      billing.localizedContent,
      billing.engagement
    );
    return {
      id: billing.id,
      engagementId: billing.engagementId,
      engagementCode: billing.engagement.engagementCode,
      clientName:
        billing.engagement.client.nameZh ||
        billing.engagement.client.nameEn ||
        "",
      billNumber: billing.billNumber,
      legacyFeeNoteNumber: billing.legacyFeeNoteNumber,
      status: billing.status,
      version: billing.version,
      issueDate: billing.issueDate.toISOString().slice(0, 10),
      currency: billing.currency,
      lineItems: billing.lineItems.map((line: any) => ({
        id: line.id,
        descriptionZh: line.descriptionZh,
        descriptionEn: line.descriptionEn,
        amount: decimalText(line.amount),
        sortOrder: line.sortOrder,
      })),
      subtotalAmount: decimalText(billing.subtotalAmount),
      totalAmount: decimalText(total),
      clientSnapshot: (billing.clientSnapshot ?? {}) as Record<string, unknown>,
      firmSnapshot: (billing.firmSnapshot ?? {}) as Record<string, unknown>,
      localizedContent: localized,
      clientClaim:
        billing.clientClaimAmount === null
          ? null
          : {
              amount: decimalText(billing.clientClaimAmount),
              currency: billing.clientClaimCurrency,
              paidAt: billing.clientClaimPaidAt.toISOString().slice(0, 10),
              reference: billing.clientClaimReference ?? "",
              note: billing.clientClaimNote ?? "",
            },
      receiptTotalInBillCurrency: decimalText(received),
      remainingAmount: decimalText(Prisma.Decimal.max(total.sub(received), 0)),
      sentAt: billing.sentAt?.toISOString() ?? null,
      returnReason: billing.returnReason,
      createdAt: billing.createdAt.toISOString(),
      updatedAt: billing.updatedAt.toISOString(),
      artifacts: artifacts.map((artifact: any) => ({
        id: artifact.id,
        type: artifact.type,
        locale:
          artifact.locale === "zh-CN" || artifact.locale === "en-US"
            ? artifact.locale
            : null,
        version: artifact.version,
        fileName: artifact.fileName,
        originalName: artifact.originalName,
        mimeType: artifact.mimeType,
        sizeBytes: artifact.sizeBytes,
        sha256: artifact.sha256,
        financeReceiptId: artifact.financeReceiptId,
        createdAt: artifact.createdAt.toISOString(),
        retentionUntil: artifact.retentionUntil.toISOString(),
        uploadedBy: artifact.uploadedBy,
      })),
      financeReceipts: receipts.map((receipt: any) => ({
        id: receipt.id,
        receiptDate: receipt.receiptDate.toISOString().slice(0, 10),
        bankReference: receipt.bankReference,
        receiptAmount: decimalText(receipt.receiptAmount),
        receiptCurrency: receipt.receiptCurrency,
        exchangeRateToBill: decimalText(receipt.exchangeRateToBill, 8),
        exchangeRateBatchId: receipt.exchangeRateBatchId ?? null,
        exchangeRateSourceDate: receipt.exchangeRateBatch
          ? receipt.exchangeRateBatch.sourceDate.toISOString().slice(0, 10)
          : null,
        exchangeRateProvider: receipt.exchangeRateBatch?.provider ?? null,
        exchangeRateOrigin: receipt.exchangeRateBatchId
          ? "UNIFIED_BATCH"
          : "LEGACY_MANUAL",
        billCurrencyAmount: decimalText(receipt.billCurrencyAmount),
        internalNote: receipt.internalNote,
        createdAt: receipt.createdAt.toISOString(),
      })),
      capabilities: capabilities(billing, user),
    };
  }

  private async storeArtifact(
    billing: any,
    artifactId: string,
    type: "INVOICE" | "CLIENT_PAYMENT_EVIDENCE" | "FINANCE_RECEIPT",
    file: BillingUpload,
    user: RequestUser,
    financeReceiptId?: string
  ) {
    const category =
      type === "INVOICE"
        ? "invoices"
        : type === "CLIENT_PAYMENT_EVIDENCE"
          ? "client-payment-evidence"
          : "finance-receipts";
    const stored = await this.storage.putCmpBillingArtifact(
      billing.engagementId,
      billing.id,
      category,
      artifactId,
      safeFileName(file.originalname),
      file.buffer,
      file.mimetype || "application/octet-stream"
    );
    const createdAt = new Date();
    return {
      id: artifactId,
      billingId: billing.id,
      financeReceiptId: financeReceiptId ?? null,
      type,
      objectKey: stored.objectKey,
      fileName: stored.fileName,
      originalName: file.originalname,
      mimeType: file.mimetype || "application/octet-stream",
      sizeBytes: file.size || file.buffer.length,
      sha256: createHash("sha256").update(file.buffer).digest("hex"),
      uploadedById: user.id,
      createdAt,
      retentionUntil: sevenYearsAfter(billing.reconciledAt ?? createdAt),
    };
  }

  private async audit(
    user: RequestUser,
    action: string,
    id: string,
    description: string,
    source?: AuditLogSource
  ) {
    await this.auditLogs.log({
      actorId: user.id,
      action,
      targetType: "CMP_BILLING",
      targetId: id,
      description,
      source,
    });
  }

  private async auditTemplate(
    user: RequestUser,
    action: string,
    id: string,
    description: string,
    source?: AuditLogSource
  ) {
    await this.auditLogs.log({
      actorId: user.id,
      action,
      targetType: "CMP_BILLING_TEMPLATE",
      targetId: id,
      description,
      source,
    });
  }

  private async validateImportAudit(
    input: UpdateCmpBillingInput["importAudit"]
  ) {
    if (!input) {
      return;
    }
    const allowedFields = new Set([
      "clientSnapshot",
      "recipientName",
      "recipientAddress",
      "recipientAttention",
      "recipientSalutation",
      "engagementSnapshot",
      "signatoryName",
      "firm.firmLegalNameZh",
      "firm.firmLegalNameEn",
      "firm.firmAddressZh",
      "firm.firmAddressEn",
      "firm.phone",
      "firm.email",
      "firm.website",
      "bank.bankPayeeNameZh",
      "bank.bankPayeeNameEn",
      "bank.bankNameZh",
      "bank.bankNameEn",
      "bank.hkdAccountNumber",
      "bank.hkdSwiftCode",
      "bank.cnyAccountNumber",
      "bank.cnySwiftCode",
      "bank.usdAccountNumber",
      "bank.usdSwiftCode",
    ]);
    if (input.fieldKeys.some((key) => !allowedFields.has(key))) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "The billing import contains an unsupported field"
      );
    }
    const hasFirmSource = input.sources.includes("FIRM_TEMPLATE");
    const hasBankSource = input.sources.includes("BANK_TEMPLATE");
    const hasCmpSource = input.sources.includes("CMP");
    if (
      input.fieldKeys.some((key) => key.startsWith("firm.")) &&
      !hasFirmSource
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Firm fields require a firm template source"
      );
    }
    if (
      input.fieldKeys.some((key) => key.startsWith("bank.")) &&
      !hasBankSource
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Bank fields require a bank template source"
      );
    }
    if (
      input.fieldKeys.some(
        (key) => !key.startsWith("firm.") && !key.startsWith("bank.")
      ) &&
      !hasCmpSource
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "CMP fields require the CMP data source"
      );
    }
    if (hasFirmSource !== Boolean(input.firmTemplateId)) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A firm template source must include its template ID"
      );
    }
    if (hasBankSource !== Boolean(input.bankTemplateId)) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A bank template source must include its template ID"
      );
    }
    if (input.firmTemplateId) {
      const template = await this.prisma.cmpBillingFirmTemplate.findUnique({
        where: { id: input.firmTemplateId },
        select: { status: true },
      });
      if (!template || template.status !== "ACTIVE") {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "The selected firm template is unavailable"
        );
      }
    }
    if (input.bankTemplateId) {
      const template = await this.prisma.cmpBillingBankTemplate.findUnique({
        where: { id: input.bankTemplateId },
        select: { status: true },
      });
      if (!template || template.status !== "ACTIVE") {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "The selected bank template is unavailable"
        );
      }
    }
  }

  private async notifyUsers(
    recipients: (string | null | undefined)[],
    title: string,
    body: string
  ) {
    if (!this.inbox) {
      return;
    }
    await Promise.all(
      [...new Set(recipients.filter((id): id is string => Boolean(id)))].map(
        (recipientId) =>
          this.inbox!.createCollaborationMessage({
            recipientId,
            type: "SYSTEM_NOTIFICATION",
            title,
            body,
            actionUrl: "/cmp/billing",
          })
      )
    );
  }

  private async notifyFinance(billing: any, title: string, body: string) {
    if (!this.inbox) {
      return;
    }
    const users = await this.prisma.user.findMany({
      where: {
        status: "ACTIVE",
        globalRole: { in: ["PARTNER", "MANAGER", "SUPER_ADMIN"] },
      },
      select: { id: true },
    });
    await this.notifyUsers(
      users.map((user) => user.id),
      title,
      body
    );
    void billing;
  }
}

function isFinanceUser(user: RequestUser) {
  return FINANCE_ROLES.has(user.globalRole);
}

function snapshotString(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return typeof value === "string" ? value : "";
}

function formatFirmTemplate(template: any): CmpBillingFirmTemplate {
  return {
    id: template.id,
    name: template.name,
    status: template.status,
    isDefault: template.isDefault,
    version: template.version,
    firmLegalNameZh: template.firmLegalNameZh,
    firmLegalNameEn: template.firmLegalNameEn,
    firmAddressZh: template.firmAddressZh,
    firmAddressEn: template.firmAddressEn,
    phone: template.phone,
    email: template.email,
    website: template.website,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function formatBankTemplate(template: any): CmpBillingBankTemplate {
  return {
    id: template.id,
    name: template.name,
    status: template.status,
    isDefault: template.isDefault,
    version: template.version,
    bankPayeeNameZh: template.bankPayeeNameZh,
    bankPayeeNameEn: template.bankPayeeNameEn,
    bankNameZh: template.bankNameZh,
    bankNameEn: template.bankNameEn,
    hkdAccountNumber: template.hkdAccountNumber,
    hkdSwiftCode: template.hkdSwiftCode,
    cnyAccountNumber: template.cnyAccountNumber,
    cnySwiftCode: template.cnySwiftCode,
    usdAccountNumber: template.usdAccountNumber,
    usdSwiftCode: template.usdSwiftCode,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function templateNotFound(): never {
  throw new ApiNotFoundException(
    "CMP_BILLING_TEMPLATE_NOT_FOUND",
    "Billing template was not found"
  );
}

function throwTemplateNameConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ApiConflictException(
      "CMP_BILLING_TEMPLATE_NAME_EXISTS",
      "A billing template with this name already exists"
    );
  }
  throw error;
}

function capabilities(billing: any, user: RequestUser) {
  const member =
    billing.engagement.picUserId === user.id ||
    billing.engagement.micUserId === user.id;
  const pic = billing.engagement.picUserId === user.id;
  const finance = isFinanceUser(user);
  const financeDraftCreator = finance && billing.createdById === user.id;
  return {
    canEdit: (member || financeDraftCreator) && billing.status === "DRAFT",
    canDelete: (member || financeDraftCreator) && billing.status === "DRAFT",
    canSubmit: (member || financeDraftCreator) && billing.status === "DRAFT",
    canApprove: pic && billing.status === "SUBMITTED",
    canReturn: pic && billing.status === "SUBMITTED",
    canMarkSent: member && billing.status === "APPROVED",
    canClaimClientPayment: member && billing.status === "SENT",
    canAddFinanceReceipt: finance && billing.status === "CLIENT_PAID",
    canReconcile: finance && billing.status === "CLIENT_PAID",
    canGenerateInvoice:
      member && ["SENT", "CLIENT_PAID", "RECONCILED"].includes(billing.status),
  };
}

function billingScalarData(data: Record<string, unknown>) {
  const {
    submittedById: _submittedById,
    approvedById: _approvedById,
    sentById: _sentById,
    clientPaidById: _clientPaidById,
    reconciledById: _reconciledById,
    ...scalar
  } = data;
  return scalar;
}

function billingRelationData(
  data: Record<string, unknown>
): Prisma.CmpBillingUpdateInput {
  const relationData: Prisma.CmpBillingUpdateInput = {};
  if (typeof data.submittedById === "string") {
    relationData.submittedBy = { connect: { id: data.submittedById } };
  }
  if (typeof data.approvedById === "string") {
    relationData.approvedBy = { connect: { id: data.approvedById } };
  }
  if (typeof data.sentById === "string") {
    relationData.sentBy = { connect: { id: data.sentById } };
  }
  if (typeof data.clientPaidById === "string") {
    relationData.clientPaidBy = { connect: { id: data.clientPaidById } };
  }
  if (typeof data.reconciledById === "string") {
    relationData.reconciledBy = { connect: { id: data.reconciledById } };
  }
  return relationData;
}

function normalizeLineItems(input: CreateCmpBillingInput["lineItems"]) {
  const source = input?.length
    ? input
    : [{ descriptionZh: "", descriptionEn: "", amount: "0.00" }];
  return source.map((line, index) => ({
    ...line,
    amount: new Prisma.Decimal(line.amount),
    sortOrder: line.sortOrder ?? index,
  }));
}

function sumLines(lines: { amount: Prisma.Decimal }[]) {
  return lines
    .reduce((sum, line) => sum.add(line.amount), new Prisma.Decimal(0))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function asBillingCurrency(value: string): CmpBudgetCurrency {
  if (CMP_BUDGET_CURRENCIES.includes(value as CmpBudgetCurrency)) {
    return value as CmpBudgetCurrency;
  }
  throw new ApiBadRequestException(
    "VALIDATION_FAILED",
    `Unsupported billing currency: ${value}`
  );
}

function receiptTotal(
  receipts: { billCurrencyAmount: Prisma.Decimal | string | number }[]
) {
  return receipts
    .reduce(
      (sum, receipt) => sum.add(new Prisma.Decimal(receipt.billCurrencyAmount)),
      new Prisma.Decimal(0)
    )
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function aggregateRevenue(billings: any[]) {
  const byCurrency = new Map<string, any[]>();
  for (const billing of billings) {
    const rows = byCurrency.get(billing.currency) ?? [];
    rows.push(billing);
    byCurrency.set(billing.currency, rows);
  }
  return [...byCurrency.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, rows]) => {
      const approved = rows.filter((billing) =>
        ["APPROVED", "SENT", "CLIENT_PAID", "RECONCILED"].includes(
          billing.status
        )
      );
      const claimed = rows.filter((billing) =>
        ["CLIENT_PAID", "RECONCILED"].includes(billing.status)
      );
      const reconciled = rows.filter(
        (billing) => billing.status === "RECONCILED"
      );
      const sum = (items: any[], field: string) =>
        items.reduce(
          (total, item) => total.add(new Prisma.Decimal(item[field] ?? 0)),
          new Prisma.Decimal(0)
        );
      const approvedInvoiced = sum(approved, "totalAmount");
      const clientClaimed = sum(claimed, "clientClaimAmount");
      const actualReceived = rows.reduce(
        (total, bill) => total.add(receiptTotal(bill.financeReceipts)),
        new Prisma.Decimal(0)
      );
      const reconciledRevenue = sum(reconciled, "totalAmount");
      return {
        currency,
        approvedInvoiced: decimalText(approvedInvoiced),
        clientClaimed: decimalText(clientClaimed),
        actualReceived: decimalText(actualReceived),
        reconciledRevenue: decimalText(reconciledRevenue),
        outstanding: decimalText(
          Prisma.Decimal.max(approvedInvoiced.sub(actualReceived), 0)
        ),
      };
    });
}

function buildClientSnapshot(engagement: any) {
  return {
    clientId: engagement.clientId,
    clientCode: engagement.client.clientCode,
    nameZh: engagement.client.nameZh ?? "",
    nameEn: engagement.client.nameEn ?? "",
    engagementCode: engagement.engagementCode,
  };
}

function buildFirmSnapshot(engagementCode = "") {
  return {
    issuerReference: engagementCode,
    phone: "(852) 53667568",
    fax: "",
    email: "info@wzcpa.hk",
    website: "www.wzcpa.hk",
    hkdAccountNumber: "",
    cnyAccountNumber: "",
    usdAccountNumber: "",
    swiftCode: "",
    hkdSwiftCode: "",
    cnySwiftCode: "",
    usdSwiftCode: "",
  };
}

function buildBillingDefaults(engagement: any) {
  const recipientAddress =
    engagement.client.addresses?.find(
      (address: { type: string }) => address.type === "REGISTERED"
    )?.address ??
    engagement.client.addresses?.find(
      (address: { type: string }) => address.type === "PRINCIPAL"
    )?.address ??
    "";
  const localizedContent = normalizeLocalizedContent(
    {
      "zh-CN": {
        recipientName:
          engagement.client.nameZh?.trim() ||
          engagement.client.nameEn?.trim() ||
          engagement.client.clientCode,
        recipientAttention: "董事",
        recipientSalutation: "贵公司",
        recipientAddress,
        serviceDescription: "",
        lineItemDescriptions: {},
        signatoryName: engagement.picUser?.name ?? "",
        bankPayeeName: "",
        bankName: "",
        firmLegalName: "维致（香港）会计师事务所",
        firmAddress: "香港灣仔駱克道193號東超商業中心17樓1703至1704室",
      },
      "en-US": {
        recipientName:
          engagement.client.nameEn?.trim() ||
          engagement.client.nameZh?.trim() ||
          engagement.client.clientCode,
        recipientAttention: "Director",
        recipientSalutation: "Your company",
        recipientAddress,
        serviceDescription: "",
        lineItemDescriptions: {},
        signatoryName: engagement.picUser?.name ?? "",
        bankPayeeName: "",
        bankName: "",
        firmLegalName: "Wing Zenith",
        firmAddress:
          "Rooms 1703-4, 17/F, Tung Chiu Commercial Centre, 193 Lockhart Road, Wan Chai, Hong Kong",
      },
    },
    engagement
  );
  return {
    clientSnapshot: buildClientSnapshot(engagement),
    firmSnapshot: buildFirmSnapshot(engagement.engagementCode),
    localizedContent,
  };
}

function mergeBillingLocalizedContent(
  defaults: CmpFeeNoteLocalizedContents,
  value: unknown,
  engagement: any
): CmpFeeNoteLocalizedContents {
  const input = value as Partial<CmpFeeNoteLocalizedContents> | undefined;
  return normalizeLocalizedContent(
    {
      "zh-CN": {
        ...defaults["zh-CN"],
        ...input?.["zh-CN"],
        lineItemDescriptions:
          input?.["zh-CN"]?.lineItemDescriptions ??
          defaults["zh-CN"].lineItemDescriptions,
      },
      "en-US": {
        ...defaults["en-US"],
        ...input?.["en-US"],
        lineItemDescriptions:
          input?.["en-US"]?.lineItemDescriptions ??
          defaults["en-US"].lineItemDescriptions,
      },
    },
    engagement
  );
}

function normalizeLocalizedContent(
  value: unknown,
  engagement: any
): CmpFeeNoteLocalizedContents {
  const empty = (recipientName: string) => ({
    recipientName,
    recipientAttention: "",
    recipientSalutation: "",
    recipientAddress: "",
    serviceDescription: "",
    lineItemDescriptions: {},
    signatoryName: "",
    bankPayeeName: "",
    bankName: "",
    firmLegalName: "",
    firmAddress: "",
  });
  const fallback = {
    "zh-CN": {
      ...empty(engagement?.client?.nameZh ?? ""),
      firmLegalName: "维致（香港）会计师事务所",
      firmAddress: "香港灣仔駱克道193號東超商業中心17樓1703至1704室",
    },
    "en-US": {
      ...empty(engagement?.client?.nameEn ?? ""),
      firmLegalName: "Wing Zenith",
      firmAddress:
        "Rooms 1703-4, 17/F, Tung Chiu Commercial Centre, 193 Lockhart Road, Wan Chai, Hong Kong",
    },
  } satisfies CmpFeeNoteLocalizedContents;
  const input = value as Partial<CmpFeeNoteLocalizedContents> | undefined;
  return {
    "zh-CN": {
      ...fallback["zh-CN"],
      ...input?.["zh-CN"],
      lineItemDescriptions:
        input?.["zh-CN"]?.lineItemDescriptions ??
        fallback["zh-CN"].lineItemDescriptions,
    },
    "en-US": {
      ...fallback["en-US"],
      ...input?.["en-US"],
      lineItemDescriptions:
        input?.["en-US"]?.lineItemDescriptions ??
        fallback["en-US"].lineItemDescriptions,
    },
  };
}

function buildBillingInvoiceDocument(billing: any, locale: "zh-CN" | "en-US") {
  const localized = normalizeLocalizedContent(
    billing.localizedContent,
    billing.engagement
  );
  const issueDate = billing.issueDate.toISOString().slice(0, 10);
  const plannedAmount = decimalText(billing.totalAmount);
  const receivedAmount = receiptTotal(billing.financeReceipts ?? []);
  const outstandingAmount = Prisma.Decimal.max(
    new Prisma.Decimal(billing.totalAmount).sub(receivedAmount),
    0
  );
  const latestReceipt = billing.financeReceipts?.at(-1);
  const collectionStatus: CmpEngagementFeeNoteCollectionStatus =
    (billing.financeReceipts?.length ?? 0) === 0
      ? "UNRECORDED"
      : outstandingAmount.isZero()
        ? "RECEIVED"
        : receivedAmount.gt(0)
          ? "PARTIALLY_RECEIVED"
          : "OUTSTANDING";
  const lineItems = billing.lineItems.map((line: any) => ({
    id: line.id,
    description: locale === "zh-CN" ? line.descriptionZh : line.descriptionEn,
    amount: decimalText(line.amount),
  }));
  const note = {
    id: billing.id,
    engagementId: billing.engagementId,
    periodNumber: 1,
    plannedIssueDate: issueDate,
    plannedAmount,
    receivedAmount: receivedAmount.toFixed(2),
    receivedDate: latestReceipt
      ? latestReceipt.receiptDate.toISOString().slice(0, 10)
      : "",
    collectionStatus,
    outstandingAmount: outstandingAmount.toFixed(2),
    feeNoteNumber: billing.billNumber,
    engagementReference: billing.engagement.engagementCode,
    issueDate,
    recipientName: localized[locale].recipientName,
    recipientAttention: localized[locale].recipientAttention,
    recipientSalutation: localized[locale].recipientSalutation,
    recipientAddress: localized[locale].recipientAddress,
    currency: billing.currency,
    serviceDescription: localized[locale].serviceDescription,
    lineItems,
    amount: plannedAmount,
    disbursementAmount: "0.00",
    totalAmount: plannedAmount,
    issuerReference: stringSnapshot(
      billing.firmSnapshot,
      "issuerReference",
      billing.engagement.engagementCode
    ),
    signatoryName: localized[locale].signatoryName,
    bankPayeeName: localized[locale].bankPayeeName,
    bankPayeeNameZh: localized["zh-CN"].bankPayeeName,
    bankName: localized[locale].bankName,
    hkdAccountNumber: stringSnapshot(billing.firmSnapshot, "hkdAccountNumber"),
    cnyAccountNumber: stringSnapshot(billing.firmSnapshot, "cnyAccountNumber"),
    usdAccountNumber: stringSnapshot(billing.firmSnapshot, "usdAccountNumber"),
    swiftCode: stringSnapshot(billing.firmSnapshot, "swiftCode"),
    hkdSwiftCode: stringSnapshot(billing.firmSnapshot, "hkdSwiftCode"),
    cnySwiftCode: stringSnapshot(billing.firmSnapshot, "cnySwiftCode"),
    usdSwiftCode: stringSnapshot(billing.firmSnapshot, "usdSwiftCode"),
    firmLegalName: localized[locale].firmLegalName,
    firmAddress: localized[locale].firmAddress,
    firmPhone: stringSnapshot(billing.firmSnapshot, "phone"),
    firmFax: stringSnapshot(billing.firmSnapshot, "fax"),
    firmEmail: stringSnapshot(billing.firmSnapshot, "email"),
    firmWebsite: stringSnapshot(billing.firmSnapshot, "website"),
    localizedContent: localized,
    createdAt: billing.createdAt.toISOString(),
    updatedAt: billing.updatedAt.toISOString(),
  };
  return buildFeeNoteExportDocument(note, locale);
}

function compileFeeNotePdf(
  document: ReturnType<typeof buildBillingInvoiceDocument>
) {
  const compiler = NodeCompiler.create();
  const compiled = compiler.compile({
    mainFileContent: buildFeeNotePdfSource(document),
  });
  if (compiled.hasError() || !compiled.result) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Billing invoice PDF generation is temporarily unavailable"
    );
  }
  return Buffer.from(compiler.pdf(compiled.result));
}

function stringSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
  key: string,
  fallback = ""
) {
  const value = snapshot?.[key];
  return typeof value === "string" ? value : fallback;
}

function requireDraft(billing: { status: string }) {
  if (billing.status !== "DRAFT") {
    stateConflict("Only draft billings can be edited or deleted");
  }
}

function requireVersion(billing: { version: number }, expectedVersion: number) {
  if (billing.version !== expectedVersion) {
    versionConflict();
  }
}

function versionConflict(): never {
  throw new ApiConflictException(
    "CMP_BILLING_VERSION_CONFLICT",
    "This billing was changed by another user. Refresh and try again."
  );
}

function stateConflict(message: string): never {
  throw new ApiConflictException("CMP_BILLING_STATE_CONFLICT", message);
}

function forbidden(): never {
  throw new ApiForbiddenException(
    "CMP_BILLING_FORBIDDEN",
    "You do not have permission for this billing action"
  );
}

function toDate(value: string | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function decimalText(value: Prisma.Decimal | string | number, scale = 2) {
  return new Prisma.Decimal(value).toFixed(scale);
}

function sevenYearsAfter(value: Date) {
  const next = new Date(value);
  next.setUTCFullYear(next.getUTCFullYear() + 7);
  return next;
}

function safeFileName(value: string) {
  return value.replaceAll(/[\\/:*?"<>|]+/g, "-").trim() || "billing";
}
