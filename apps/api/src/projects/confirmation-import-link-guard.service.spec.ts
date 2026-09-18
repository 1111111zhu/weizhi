import { ConfirmationImportLinkGuardService } from "./confirmation-import-link-guard.service";

const prisma = {
  confirmationEmpImportItem: {
    findMany: vi.fn(),
  },
};

describe(ConfirmationImportLinkGuardService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks voiding a confirmation while an active EMP linkage exists", async () => {
    prisma.confirmationEmpImportItem.findMany.mockResolvedValue([
      {
        id: "import-item-1",
        importJobId: "import-job-1",
        sourceConfirmationId: "confirmation-1",
        mode: "GROUPED",
        active: true,
        workflowNodeId: "node-1",
        workingPaperId: "paper-1",
        attachmentId: "attachment-1",
        snapshotLocation: "2026/Confirmation responses",
      },
    ]);

    const service = new ConfirmationImportLinkGuardService(prisma as never);

    await expect(
      service.assertCanInvalidateSource(
        {
          confirmationId: "confirmation-1",
        },
        "VOID_CONFIRMATION"
      )
    ).rejects.toMatchObject({
      response: {
        code: "CONFIRMATION_STATE_CONFLICT",
        message: expect.stringContaining("2026/Confirmation responses"),
      },
    });
    await expect(
      service.assertCanInvalidateSource(
        {
          confirmationId: "confirmation-1",
        },
        "VOID_CONFIRMATION"
      )
    ).rejects.toMatchObject({
      response: {
        message: expect.stringContaining("先从 EMP 撤回"),
      },
    });
  });

  it("reads active linkages through the transaction client supplied by the caller", async () => {
    const txQueryRaw = vi.fn().mockResolvedValue([]);
    const txFindMany = vi.fn().mockResolvedValue([
      {
        id: "import-item-1",
        importJobId: "import-job-1",
        sourceConfirmationId: "confirmation-1",
        mode: "FLAT",
        active: true,
        snapshotLocation: "2026/Confirmation responses",
      },
    ]);
    const service = new ConfirmationImportLinkGuardService(prisma as never);

    await expect(
      service.findActiveLinkages(
        { confirmationId: "confirmation-1" },
        {
          $queryRaw: txQueryRaw,
          confirmationEmpImportItem: { findMany: txFindMany },
        }
      )
    ).resolves.toMatchObject([
      { id: "import-item-1", importJobId: "import-job-1" },
    ]);
    expect(txFindMany).toHaveBeenCalledOnce();
    expect(txQueryRaw).toHaveBeenCalledOnce();
    expect(prisma.confirmationEmpImportItem.findMany).not.toHaveBeenCalled();
  });

  it("locks the source confirmation before reading active links in a transaction", async () => {
    const events: string[] = [];
    const txQueryRaw = vi.fn().mockImplementation(async () => {
      await Promise.resolve();
      events.push("lock-source");
      return [];
    });
    const txFindMany = vi.fn().mockImplementation(async () => {
      await Promise.resolve();
      events.push("read-links");
      return [];
    });
    const service = new ConfirmationImportLinkGuardService(prisma as never);

    await service.findActiveLinkages(
      { confirmationId: "confirmation-1", projectId: "project-1" },
      {
        $queryRaw: txQueryRaw,
        confirmationEmpImportItem: { findMany: txFindMany },
      } as never
    );

    expect(events).toStrictEqual(["lock-source", "read-links"]);
    expect(txQueryRaw).toHaveBeenCalledOnce();
  });

  it("does not audit or swallow a guarded conflict", async () => {
    prisma.confirmationEmpImportItem.findMany.mockResolvedValue([
      {
        id: "import-item-1",
        importJobId: "import-job-1",
        sourceConfirmationId: "confirmation-1",
        mode: "FLAT",
        status: "SUCCEEDED",
        withdrawnAt: null,
        active: true,
        snapshotLocation: "2026/Confirmation responses",
      },
    ]);
    const service = new ConfirmationImportLinkGuardService(prisma as never);

    await expect(
      service.assertCanInvalidateSource(
        { confirmationId: "confirmation-1" },
        "UNDO_REVIEW"
      )
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });
  });

  it("treats only SUCCEEDED items without withdrawnAt as active in the current schema", async () => {
    prisma.confirmationEmpImportItem.findMany.mockResolvedValue([
      {
        id: "failed-item",
        jobId: "job-1",
        confirmationId: "confirmation-1",
        status: "FAILED",
        withdrawnAt: null,
      },
    ]);

    await expect(
      new ConfirmationImportLinkGuardService(
        prisma as never
      ).findActiveLinkages({
        confirmationId: "confirmation-1",
      })
    ).resolves.toStrictEqual([]);
  });
});
