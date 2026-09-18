import { ProjectConfirmationCodeService } from "./project-confirmation-code.service";

const tx = {
  projectConfirmationSequence: {
    upsert: vi.fn(),
  },
};
const prisma = {
  $transaction: vi.fn(),
};

describe(ProjectConfirmationCodeService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allocates independent sequences by project and confirmation type", async () => {
    const service = new ProjectConfirmationCodeService(prisma as never);
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    tx.projectConfirmationSequence.upsert
      .mockResolvedValueOnce({ nextValue: 4 })
      .mockResolvedValueOnce({ nextValue: 2 });

    await expect(
      service.allocate("project-1", "AUD-2026-0003", "BANK")
    ).resolves.toStrictEqual({
      confirmationCode: "AUD-2026-0003-BANK-003",
      sequence: 3,
    });
    await expect(
      service.allocate("project-2", "AUD-2026-0003", "BANK")
    ).resolves.toStrictEqual({
      confirmationCode: "AUD-2026-0003-BANK-001",
      sequence: 1,
    });

    expect(tx.projectConfirmationSequence.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { projectId_type: { projectId: "project-1", type: "BANK" } },
      })
    );
    expect(tx.projectConfirmationSequence.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { projectId_type: { projectId: "project-2", type: "BANK" } },
      })
    );
  });

  it("pads the numeric type sequence in the generated confirmation code", async () => {
    const service = new ProjectConfirmationCodeService(prisma as never);
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    tx.projectConfirmationSequence.upsert.mockResolvedValue({ nextValue: 3 });

    await expect(
      service.allocate("project-1", "AUD-2026-0003", "BANK")
    ).resolves.toStrictEqual({
      confirmationCode: "AUD-2026-0003-BANK-002",
      sequence: 2,
    });
  });

  it.each([
    ["BANK", "BANK"],
    ["BALANCE", "BALANCE"],
    ["RELATED_PARTY", "RELATED_PARTY"],
    ["LAWYER", "LAWYER"],
    ["INVENTORY", "INVENTORY"],
    ["INTERMEDIARY", "INTERMEDIARY"],
    ["OTHER", "OTHER"],
    ["UNCLASSIFIED", "UNCLASSIFIED"],
  ] as const)(
    "maps %s confirmations to the %s type code",
    async (type, typeCode) => {
      const service = new ProjectConfirmationCodeService(prisma as never);
      tx.projectConfirmationSequence.upsert.mockResolvedValue({ nextValue: 2 });

      await expect(
        service.allocateInTransaction(
          tx as never,
          "project-1",
          "AUD-2026-0003",
          type
        )
      ).resolves.toStrictEqual({
        confirmationCode: `AUD-2026-0003-${typeCode}-001`,
        sequence: 1,
      });
    }
  );

  it("exposes a transaction-owned allocator for confirmation creation", async () => {
    const service = new ProjectConfirmationCodeService(prisma as never);
    tx.projectConfirmationSequence.upsert.mockResolvedValue({ nextValue: 2 });

    await expect(
      service.allocateInTransaction(
        tx as never,
        "project-1",
        "AUD-2026-0003",
        "BANK"
      )
    ).resolves.toStrictEqual({
      confirmationCode: "AUD-2026-0003-BANK-001",
      sequence: 1,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
