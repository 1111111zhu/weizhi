import {
  ApiConflictException,
  ApiNotFoundException,
} from "../common/api-error";
import { ConfirmationInformationLibraryService } from "./confirmation-information-library.service";

const record = {
  id: "bank-012",
  bankCode: "012",
  bankNameEn: "Bank of China (Hong Kong) Limited",
  bankNameZh: "中国银行（香港）有限公司",
  bankType: "Local registered bank",
  businessAddress: "Bank of China Tower, 1 Garden Road, Central, Hong Kong",
  mailingAddress:
    "3/F, Bank of China Centre, Olympian City, 11 Hoi Fai Road, West Kowloon",
  mailingAddressSameAsBusiness: false,
  contactName: "Bank of China (Hong Kong) Limited",
  attention: "Bank confirmation",
  notes: null,
  background: "Hong Kong bank confirmation workbook",
  sourceLabel: "香港银行函证信息库.xlsx",
  sourceRow: 9,
  isActive: true,
  createdAt: new Date("2026-08-13T00:00:00.000Z"),
  updatedAt: new Date("2026-08-13T00:00:00.000Z"),
};
const transaction = {
  confirmationInformationLibraryEntry: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};
const prisma = {
  $transaction: vi.fn(),
  confirmationInformationLibraryEntry: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};
const auditLogs = {
  log: vi.fn(),
  logInTransaction: vi.fn(),
};
const user = { id: "user-1" } as never;
const source = { ipAddress: "127.0.0.1", userAgent: "jest" };

function createService() {
  return new ConfirmationInformationLibraryService(
    prisma as never,
    auditLogs as never
  );
}

describe(ConfirmationInformationLibraryService, () => {
  it.each([true, false])("persists the own-format restriction as %s", async (requiresBankTemplate) => {
    transaction.confirmationInformationLibraryEntry.findUnique.mockResolvedValue(record);
    transaction.confirmationInformationLibraryEntry.update.mockResolvedValue({ ...record, requiresBankTemplate });
    const result = await createService().update(record.id, { requiresBankTemplate }, user, source);
    expect(transaction.confirmationInformationLibraryEntry.update).toHaveBeenCalledWith({
      where: { id: record.id }, data: { requiresBankTemplate },
    });
    expect(result.requiresBankTemplate).toBe(requiresBankTemplate);
    expect(auditLogs.logInTransaction).toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => unknown) => {
        await Promise.resolve();
        return callback(transaction);
      }
    );
    transaction.confirmationInformationLibraryEntry.findUnique.mockResolvedValue(
      record
    );
    transaction.confirmationInformationLibraryEntry.create.mockResolvedValue(
      record
    );
    transaction.confirmationInformationLibraryEntry.update.mockResolvedValue(
      record
    );
    prisma.confirmationInformationLibraryEntry.findMany.mockResolvedValue([
      record,
    ]);
    auditLogs.log.mockResolvedValue(undefined as never);
    auditLogs.logInTransaction.mockResolvedValue(undefined as never);
  });

  it("searches active entries by code, names, both addresses, contact, and attention", async () => {
    const service = createService();
    const result = await service.list({
      query: " 012 ",
      includeInactive: false,
    });

    expect(
      prisma.confirmationInformationLibraryEntry.findMany
    ).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [
          { bankCode: { contains: "012", mode: "insensitive" } },
          { bankNameEn: { contains: "012", mode: "insensitive" } },
          { bankNameZh: { contains: "012", mode: "insensitive" } },
          { businessAddress: { contains: "012", mode: "insensitive" } },
          { mailingAddress: { contains: "012", mode: "insensitive" } },
          { contactName: { contains: "012", mode: "insensitive" } },
          { attention: { contains: "012", mode: "insensitive" } },
        ],
      },
      orderBy: [{ bankCode: "asc" }, { bankNameEn: "asc" }],
    });
    expect(result[0]).toMatchObject({
      bankCode: "012",
      effectiveMailingAddress: record.mailingAddress,
      isReadyForDispatch: true,
    });
  });

  it("defaults list results to active entries only and falls back to the business address", async () => {
    prisma.confirmationInformationLibraryEntry.findMany.mockResolvedValue([
      {
        ...record,
        mailingAddress: null,
        mailingAddressSameAsBusiness: true,
      },
      {
        ...record,
        id: "bank-no-mailing-address",
        mailingAddress: null,
        mailingAddressSameAsBusiness: false,
      },
    ]);
    const service = createService();
    const result = await service.list({});

    expect(
      prisma.confirmationInformationLibraryEntry.findMany
    ).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ bankCode: "asc" }, { bankNameEn: "asc" }],
    });
    expect(result[0].effectiveMailingAddress).toBe(record.businessAddress);
    expect(result[0].isReadyForDispatch).toBe(true);
    expect(result[1].effectiveMailingAddress).toBe(record.businessAddress);
    expect(result[1].isReadyForDispatch).toBe(true);
  });

  it("loads one applied entry by its stable id", async () => {
    const service = createService();

    await service.list({ entryId: record.id, includeInactive: true });

    expect(
      prisma.confirmationInformationLibraryEntry.findMany
    ).toHaveBeenCalledWith({
      where: { id: record.id },
      orderBy: [{ bankCode: "asc" }, { bankNameEn: "asc" }],
    });
  });

  it("uses the bank name as the default contact when the source contact is blank", async () => {
    transaction.confirmationInformationLibraryEntry.findUnique.mockResolvedValueOnce(
      null
    );

    await createService().create(
      {
        bankCode: "003",
        bankNameEn: "Standard Chartered Bank",
        bankNameZh: "渣打银行",
        bankType: "Local",
        businessAddress: "Hong Kong",
        mailingAddress: null,
        contactName: null,
      },
      user,
      source
    );

    expect(
      transaction.confirmationInformationLibraryEntry.create
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mailingAddressSameAsBusiness: false,
        mailingAddress: null,
        contactName: "渣打银行",
      }),
    });
  });

  it("persists the editable historical address and caution fields", async () => {
    await createService().update(
      "bank-012",
      {
        historicalMailingAddress: "Old address",
        cautions: "Use bank format",
      },
      user,
      source
    );

    expect(
      transaction.confirmationInformationLibraryEntry.update
    ).toHaveBeenCalledWith({
      where: { id: "bank-012" },
      data: {
        historicalMailingAddress: "Old address",
        cautions: "Use bank format",
      },
    });
  });

  it("uses the business address when same-address is set even if stale mailing data exists", async () => {
    prisma.confirmationInformationLibraryEntry.findMany.mockResolvedValue([
      {
        ...record,
        mailingAddress: "Stale mailing address",
        mailingAddressSameAsBusiness: true,
      },
    ]);

    const [result] = await createService().list({});

    expect(result.mailingAddress).toBeNull();
    expect(result.effectiveMailingAddress).toBe(record.businessAddress);
  });

  it("creates a normalized entry and records a transactional audit event", async () => {
    transaction.confirmationInformationLibraryEntry.findUnique.mockResolvedValueOnce(
      null
    );
    const service = createService();

    await service.create(
      {
        bankCode: "3",
        bankNameEn: " Standard Chartered Bank (Hong Kong) Limited ",
        bankNameZh: " 渣打银行（香港）有限公司 ",
        bankType: " Local registered bank ",
        businessAddress: " 4-4A Des Voeux Road Central ",
        mailingAddress: null,
        mailingAddressSameAsBusiness: true,
        contactName: null,
        attention: null,
        notes: null,
        background: null,
      },
      user,
      source
    );

    expect(
      transaction.confirmationInformationLibraryEntry.create
    ).toHaveBeenCalledWith({
      data: {
        bankCode: "003",
        requiresBankTemplate: false,
        bankNameEn: "Standard Chartered Bank (Hong Kong) Limited",
        bankNameZh: "渣打银行（香港）有限公司",
        bankType: "Local registered bank",
        businessAddress: "4-4A Des Voeux Road Central",
        mailingAddress: null,
        mailingAddressSameAsBusiness: true,
        contactName: "渣打银行（香港）有限公司",
        attention: null,
        notes: null,
        background: null,
        sourceLabel: "MANUAL",
        sourceRow: null,
        isActive: true,
      },
    });
    expect(auditLogs.logInTransaction).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        action: "CONFIRMATION_INFORMATION_LIBRARY_ENTRY_CREATED",
        targetType: "CONFIRMATION_INFORMATION_LIBRARY_ENTRY",
        targetId: record.id,
        source,
      })
    );
  });

  it("always creates an active entry even if an untyped caller supplies a status", async () => {
    transaction.confirmationInformationLibraryEntry.findUnique.mockResolvedValueOnce(
      null
    );
    const service = createService();

    await service.create(
      {
        bankCode: "003",
        bankNameEn: "Standard Chartered Bank",
        bankNameZh: "渣打银行",
        bankType: "Local",
        businessAddress: "Hong Kong",
        isActive: false,
      } as never,
      user,
      source
    );

    expect(
      transaction.confirmationInformationLibraryEntry.create
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({ isActive: true }),
    });
  });

  it("does not persist a separate mailing address when it is marked as the business address", async () => {
    transaction.confirmationInformationLibraryEntry.findUnique.mockResolvedValueOnce(
      null
    );

    await createService().create(
      {
        bankCode: "003",
        bankNameEn: "Standard Chartered Bank",
        bankNameZh: "渣打银行",
        bankType: "Local",
        businessAddress: "Hong Kong",
        mailingAddress: "Stale mailing address",
        mailingAddressSameAsBusiness: true,
      },
      user,
      source
    );

    expect(
      transaction.confirmationInformationLibraryEntry.create
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({ mailingAddress: null }),
    });
  });

  it("rejects a duplicate bank code before creating an entry", async () => {
    const service = createService();

    await expect(
      service.create(
        {
          bankCode: "012",
          bankNameEn: record.bankNameEn,
          bankNameZh: record.bankNameZh,
          bankType: record.bankType,
          businessAddress: record.businessAddress,
          mailingAddress: record.mailingAddress,
          mailingAddressSameAsBusiness: false,
        },
        user,
        source
      )
    ).rejects.toBeInstanceOf(ApiConflictException);
    expect(
      transaction.confirmationInformationLibraryEntry.create
    ).not.toHaveBeenCalled();
    expect(auditLogs.logInTransaction).not.toHaveBeenCalled();
  });

  it("updates an entry and audits the update", async () => {
    const service = createService();

    await service.update(
      "bank-012",
      { bankNameEn: " Updated Bank Name " },
      user,
      source
    );

    expect(
      transaction.confirmationInformationLibraryEntry.update
    ).toHaveBeenCalledWith({
      where: { id: "bank-012" },
      data: { bankNameEn: "Updated Bank Name" },
    });
    expect(auditLogs.logInTransaction).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        action: "CONFIRMATION_INFORMATION_LIBRARY_ENTRY_UPDATED",
        targetId: "bank-012",
      })
    );
  });

  it("clears a stale mailing address when an entry is changed to same-address", async () => {
    await createService().update(
      "bank-012",
      { mailingAddressSameAsBusiness: true },
      user,
      source
    );

    expect(
      transaction.confirmationInformationLibraryEntry.update
    ).toHaveBeenCalledWith({
      where: { id: "bank-012" },
      data: {
        mailingAddress: null,
        mailingAddressSameAsBusiness: true,
      },
    });
  });

  it("soft-deactivates and restores an entry with separate audit events", async () => {
    const service = createService();

    await service.deactivate("bank-012", user, source);
    await service.restore("bank-012", user, source);

    expect(
      transaction.confirmationInformationLibraryEntry.update
    ).toHaveBeenNthCalledWith(1, {
      where: { id: "bank-012" },
      data: { isActive: false },
    });
    expect(
      transaction.confirmationInformationLibraryEntry.update
    ).toHaveBeenNthCalledWith(2, {
      where: { id: "bank-012" },
      data: { isActive: true },
    });
    expect(auditLogs.logInTransaction).toHaveBeenNthCalledWith(
      1,
      transaction,
      expect.objectContaining({
        action: "CONFIRMATION_INFORMATION_LIBRARY_ENTRY_DEACTIVATED",
      })
    );
    expect(auditLogs.logInTransaction).toHaveBeenNthCalledWith(
      2,
      transaction,
      expect.objectContaining({
        action: "CONFIRMATION_INFORMATION_LIBRARY_ENTRY_RESTORED",
      })
    );
  });

  it("reports a missing entry when updating it", async () => {
    transaction.confirmationInformationLibraryEntry.findUnique.mockResolvedValueOnce(
      null
    );
    const service = createService();

    await expect(
      service.update("missing-entry", { bankNameEn: "Updated" }, user, source)
    ).rejects.toBeInstanceOf(ApiNotFoundException);
  });
});
