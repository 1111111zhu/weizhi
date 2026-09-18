import { Injectable } from "@nestjs/common";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiConflictException,
  ApiNotFoundException,
} from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";

export type ConfirmationInformationLibraryListOptions = {
  entryId?: string;
  query?: string;
  includeInactive?: boolean;
};

export type ConfirmationInformationLibraryCreateInput = {
  requiresBankTemplate?: boolean;
  bankCode: string;
  bankNameEn: string;
  bankNameZh: string;
  bankType: string;
  businessAddress: string;
  mailingAddress?: string | null;
  mailingAddressSameAsBusiness?: boolean;
  contactName?: string | null;
  attention?: string | null;
  notes?: string | null;
  background?: string | null;
  historicalMailingAddress?: string | null;
  cautions?: string | null;
};

export type ConfirmationInformationLibraryUpdateInput =
  Partial<ConfirmationInformationLibraryCreateInput>;

type ConfirmationInformationLibraryRow = {
  requiresBankTemplate?: boolean;
  id: string;
  bankCode: string;
  bankNameEn: string;
  bankNameZh: string;
  bankType: string;
  businessAddress: string;
  mailingAddress: string | null;
  mailingAddressSameAsBusiness: boolean;
  contactName: string | null;
  attention: string | null;
  notes: string | null;
  background: string | null;
  historicalMailingAddress?: string | null;
  cautions?: string | null;
  sourceLabel: string;
  sourceRow: number | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type EntryWhere = {
  id?: string;
  bankCode?: string;
  isActive?: boolean;
  OR?: Record<string, unknown>[];
};

type EntryDelegate = {
  findMany: (args: {
    where: EntryWhere;
    orderBy: Record<string, "asc" | "desc">[];
  }) => Promise<ConfirmationInformationLibraryRow[]>;
  findUnique: (args: {
    where: { id?: string; bankCode?: string };
  }) => Promise<ConfirmationInformationLibraryRow | null>;
  create: (args: {
    data: Record<string, unknown>;
  }) => Promise<ConfirmationInformationLibraryRow>;
  update: (args: {
    where: { id: string };
    data: Record<string, unknown>;
  }) => Promise<ConfirmationInformationLibraryRow>;
};

type PrismaWithInformationLibrary = PrismaService & {
  confirmationInformationLibraryEntry: EntryDelegate;
};

const TARGET_TYPE = "CONFIRMATION_INFORMATION_LIBRARY_ENTRY";

@Injectable()
export class ConfirmationInformationLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async list(options: ConfirmationInformationLibraryListOptions = {}) {
    const query = normalizeSearchQuery(options.query);
    const where: EntryWhere = options.includeInactive ? {} : { isActive: true };

    if (options.entryId) {
      where.id = options.entryId;
    } else if (query) {
      where.OR = [
        { bankCode: { contains: query, mode: "insensitive" } },
        { bankNameEn: { contains: query, mode: "insensitive" } },
        { bankNameZh: { contains: query, mode: "insensitive" } },
        { businessAddress: { contains: query, mode: "insensitive" } },
        { mailingAddress: { contains: query, mode: "insensitive" } },
        { contactName: { contains: query, mode: "insensitive" } },
        { attention: { contains: query, mode: "insensitive" } },
      ];
    }

    const entries = await this.entryDelegate(this.prisma).findMany({
      where,
      orderBy: [{ bankCode: "asc" }, { bankNameEn: "asc" }],
    });
    return entries.map((entry) => this.toResponse(entry));
  }

  async create(
    input: ConfirmationInformationLibraryCreateInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    try {
      const entry = await this.prisma.$transaction(async (tx) => {
        const delegate = this.entryDelegate(tx);
        const bankCode = normalizeBankCode(input.bankCode);
        await this.ensureBankCodeAvailable(delegate, bankCode);

        const created = await delegate.create({
          data: this.toCreateData(input, bankCode),
        });
        await this.auditLogs.logInTransaction(tx, {
          actorId: user.id,
          action: "CONFIRMATION_INFORMATION_LIBRARY_ENTRY_CREATED",
          targetType: TARGET_TYPE,
          targetId: created.id,
          description: `Created confirmation information library entry ${created.bankCode}`,
          source,
        });
        return created;
      });
      return this.toResponse(entry);
    } catch (error) {
      throw this.mapUniqueConflict(error);
    }
  }

  async update(
    id: string,
    input: ConfirmationInformationLibraryUpdateInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    try {
      const entry = await this.prisma.$transaction(async (tx) => {
        const delegate = this.entryDelegate(tx);
        const current = await this.requireEntry(delegate, id);
        const data = this.toUpdateData(input, current);

        if (input.bankCode !== undefined) {
          const bankCode = normalizeBankCode(input.bankCode);
          if (bankCode !== current.bankCode) {
            await this.ensureBankCodeAvailable(delegate, bankCode, id);
          }
          data.bankCode = bankCode;
        }

        const updated = await delegate.update({ where: { id }, data });
        await this.auditLogs.logInTransaction(tx, {
          actorId: user.id,
          action: "CONFIRMATION_INFORMATION_LIBRARY_ENTRY_UPDATED",
          targetType: TARGET_TYPE,
          targetId: updated.id,
          description: `Updated confirmation information library entry ${updated.bankCode}`,
          source,
        });
        return updated;
      });
      return this.toResponse(entry);
    } catch (error) {
      throw this.mapUniqueConflict(error);
    }
  }

  deactivate(id: string, user: RequestUser, source?: AuditLogSource) {
    return this.setActive(id, false, user, source);
  }

  restore(id: string, user: RequestUser, source?: AuditLogSource) {
    return this.setActive(id, true, user, source);
  }

  private async setActive(
    id: string,
    isActive: boolean,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const action = isActive
      ? "CONFIRMATION_INFORMATION_LIBRARY_ENTRY_RESTORED"
      : "CONFIRMATION_INFORMATION_LIBRARY_ENTRY_DEACTIVATED";
    const verb = isActive ? "Restored" : "Deactivated";
    const entry = await this.prisma.$transaction(async (tx) => {
      const delegate = this.entryDelegate(tx);
      const current = await this.requireEntry(delegate, id);
      const updated = await delegate.update({
        where: { id },
        data: { isActive },
      });
      await this.auditLogs.logInTransaction(tx, {
        actorId: user.id,
        action,
        targetType: TARGET_TYPE,
        targetId: updated.id,
        description: `${verb} confirmation information library entry ${current.bankCode}`,
        source,
      });
      return updated;
    });

    return this.toResponse(entry);
  }

  private async requireEntry(delegate: EntryDelegate, id: string) {
    const entry = await delegate.findUnique({ where: { id } });
    if (!entry) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation information library entry was not found"
      );
    }
    return entry;
  }

  private async ensureBankCodeAvailable(
    delegate: EntryDelegate,
    bankCode: string,
    exceptId?: string
  ) {
    const duplicate = await delegate.findUnique({ where: { bankCode } });
    if (duplicate && duplicate.id !== exceptId) {
      throw new ApiConflictException(
        "DUPLICATE_CODE",
        `Bank code ${bankCode} already exists`
      );
    }
  }

  private toCreateData(
    input: ConfirmationInformationLibraryCreateInput,
    bankCode: string
  ) {
    const mailingAddress = nullableText(input.mailingAddress);
    const mailingAddressSameAsBusiness =
      input.mailingAddressSameAsBusiness === true;
    return {
      bankCode,
      bankNameEn: trimText(input.bankNameEn),
      requiresBankTemplate: input.requiresBankTemplate === true,
      bankNameZh: trimText(input.bankNameZh),
      bankType: trimText(input.bankType),
      businessAddress: trimText(input.businessAddress),
      mailingAddress: mailingAddressSameAsBusiness ? null : mailingAddress,
      mailingAddressSameAsBusiness,
      contactName:
        nullableText(input.contactName) ?? trimText(input.bankNameZh),
      attention: nullableText(input.attention),
      notes: nullableText(input.notes),
      background: nullableText(input.background),
      ...(input.historicalMailingAddress !== undefined
        ? {
            historicalMailingAddress: nullableText(
              input.historicalMailingAddress
            ),
          }
        : {}),
      ...(input.cautions !== undefined
        ? { cautions: nullableText(input.cautions) }
        : {}),
      sourceLabel: "MANUAL",
      sourceRow: null,
      isActive: true,
    };
  }

  private toUpdateData(
    input: ConfirmationInformationLibraryUpdateInput,
    current: ConfirmationInformationLibraryRow
  ) {
    const data: Record<string, unknown> = {};
    if (input.requiresBankTemplate !== undefined) {
      data.requiresBankTemplate = input.requiresBankTemplate;
    }
    for (const field of [
      "bankNameEn",
      "bankNameZh",
      "bankType",
      "businessAddress",
    ] as const) {
      if (input[field] !== undefined) {
        data[field] = trimText(input[field]);
      }
    }
    for (const field of [
      "contactName",
      "attention",
      "notes",
      "background",
      "historicalMailingAddress",
      "cautions",
    ] as const) {
      if (input[field] !== undefined) {
        data[field] = nullableText(input[field]);
      }
    }
    const mailingAddressSameAsBusiness =
      input.mailingAddressSameAsBusiness ??
      current.mailingAddressSameAsBusiness;
    if (mailingAddressSameAsBusiness) {
      data.mailingAddress = null;
    } else if (input.mailingAddress !== undefined) {
      data.mailingAddress = nullableText(input.mailingAddress);
    }
    if (input.mailingAddressSameAsBusiness !== undefined) {
      data.mailingAddressSameAsBusiness = input.mailingAddressSameAsBusiness;
    }
    return data;
  }

  private toResponse(entry: ConfirmationInformationLibraryRow) {
    const mailingAddress = entry.mailingAddressSameAsBusiness
      ? null
      : nullableText(entry.mailingAddress);
    const businessAddress = trimText(entry.businessAddress);
    const effectiveMailingAddress = mailingAddress ?? businessAddress;

    return {
      ...entry,
      requiresBankTemplate: entry.requiresBankTemplate ?? false,
      contactName: nullableText(entry.contactName) ?? entry.bankNameZh,
      historicalMailingAddress: nullableText(entry.historicalMailingAddress),
      cautions: nullableText(entry.cautions),
      mailingAddress,
      effectiveMailingAddress,
      isReadyForDispatch: Boolean(effectiveMailingAddress),
      createdAt: toIsoString(entry.createdAt),
      updatedAt: toIsoString(entry.updatedAt),
    };
  }

  private entryDelegate(client: unknown) {
    return (client as PrismaWithInformationLibrary)
      .confirmationInformationLibraryEntry;
  }

  private mapUniqueConflict(error: unknown) {
    if (error instanceof ApiConflictException) {
      return error;
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return new ApiConflictException(
        "DUPLICATE_CODE",
        "Bank code already exists"
      );
    }
    return error;
  }
}

function normalizeBankCode(value: string) {
  return value.trim().padStart(3, "0");
}

function normalizeSearchQuery(value?: string) {
  const query = value?.trim() ?? "";
  return /^\d{1,3}$/.test(query) ? query.padStart(3, "0") : query;
}

function trimText(value: string) {
  return value.trim();
}

function nullableText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function toIsoString(value: Date | string) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}
