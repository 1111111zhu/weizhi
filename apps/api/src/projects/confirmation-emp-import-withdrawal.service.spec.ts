import { ConfirmationEmpImportWithdrawalService } from "./confirmation-emp-import-withdrawal.service";

const access = {
  requireProjectAction: vi.fn(),
};
const store = {
  findLinkages: vi.fn(),
  readTarget: vi.fn(),
  withdrawLinkages: vi.fn(),
  withdrawZipItem: vi.fn(),
  restoreLinkages: vi.fn(),
  readSourceState: vi.fn(),
};
const auditLogs = {
  log: vi.fn(),
};
const user = { id: "user-1", globalRole: "STAFF" } as never;
const source = { ipAddress: "127.0.0.1" } as never;
const link = {
  id: "import-item-1",
  importJobId: "import-job-1",
  projectId: "project-1",
  sourceConfirmationId: "confirmation-1",
  mode: "FLAT" as const,
  active: true,
  withdrawnAt: null,
  workflowNodeId: "node-1",
  workingPaperId: "paper-1",
  attachmentId: "attachment-1",
  snapshot: {
    workflowNodeId: "node-1",
    workingPaperId: "paper-1",
    attachmentId: "attachment-1",
    location: "2026/Confirmation responses",
    code: "WP-001",
    title: "HSBC-Outgoing.pdf",
    version: 1,
    hash: "sha256:source",
  },
};

describe(ConfirmationEmpImportWithdrawalService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.requireProjectAction.mockResolvedValue({
      projectRole: "PREPARER",
    });
    store.findLinkages.mockResolvedValue([link]);
    store.readTarget.mockResolvedValue(link.snapshot);
    store.withdrawLinkages.mockResolvedValue(undefined as never);
    store.withdrawZipItem.mockResolvedValue(undefined as never);
    auditLogs.log.mockResolvedValue(undefined as never);
  });

  it("withdraws an unchanged flat import item to the EMP recycle bin", async () => {
    const service = new ConfirmationEmpImportWithdrawalService(
      store as never,
      access as never,
      auditLogs as never
    );

    await expect(
      service.withdraw(
        "project-1",
        "import-job-1",
        "confirmation-1",
        user,
        source
      )
    ).resolves.toMatchObject({
      importJobId: "import-job-1",
      linkIds: ["import-item-1"],
    });

    expect(access.requireProjectAction).toHaveBeenCalledWith(
      "project-1",
      "user-1",
      "modifyIndex"
    );
    expect(store.findLinkages).toHaveBeenCalledWith({
      projectId: "project-1",
      importJobId: "import-job-1",
      sourceConfirmationId: "confirmation-1",
      state: "ACTIVE",
    });
    expect(store.withdrawLinkages).toHaveBeenCalledWith(
      expect.objectContaining({
        linkIds: ["import-item-1"],
        recycleDirectory: false,
        actorId: "user-1",
        expectedTargets: [{ linkId: "import-item-1", snapshot: link.snapshot }],
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_EMP_IMPORT_WITHDRAWN",
        targetId: "import-job-1",
        projectId: "project-1",
      })
    );
  });

  it("withdraws every active EMP import linked to one confirmation", async () => {
    const service = new ConfirmationEmpImportWithdrawalService(
      store as never,
      access as never,
      auditLogs as never
    );

    await expect(
      service.withdrawForConfirmation(
        "project-1",
        "confirmation-1",
        user,
        source
      )
    ).resolves.toEqual({ importJobIds: ["import-job-1"] });
    expect(store.withdrawLinkages).toHaveBeenCalledWith(
      expect.objectContaining({
        importJobId: "import-job-1",
        linkIds: ["import-item-1"],
      })
    );
  });

  it("blocks grouped withdrawal when the target directory contains a foreign item", async () => {
    const groupedLink = {
      ...link,
      mode: "GROUPED" as const,
      snapshot: {
        ...link.snapshot,
        directoryEntries: [
          {
            id: "attachment-1",
            path: "HSBC-Outgoing.pdf",
            kind: "GENERATED" as const,
            version: 1,
            hash: "sha256:source",
          },
        ],
      },
    };
    store.findLinkages.mockResolvedValue([groupedLink]);
    store.readTarget.mockResolvedValue({
      ...groupedLink.snapshot,
      directoryEntries: [
        ...groupedLink.snapshot.directoryEntries,
        {
          id: "foreign-1",
          path: "team-notes.txt",
          kind: "EXTERNAL" as const,
          version: 1,
          hash: "sha256:foreign",
        },
      ],
    });

    await expect(
      new ConfirmationEmpImportWithdrawalService(
        store as never,
        access as never,
        auditLogs as never
      ).withdraw("project-1", "import-job-1", "confirmation-1", user, source)
    ).rejects.toMatchObject({
      response: {
        code: "CONFIRMATION_STATE_CONFLICT",
        message: expect.stringContaining("目录混入外来项"),
      },
    });
    expect(store.withdrawLinkages).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_EMP_IMPORT_WITHDRAWAL_BLOCKED",
        targetId: "import-job-1",
        projectId: "project-1",
      })
    );
  });

  it("continues after the warning when the caller confirms a changed target withdrawal", async () => {
    const groupedLink = {
      ...link,
      mode: "GROUPED" as const,
      snapshot: {
        ...link.snapshot,
        directoryEntries: [
          {
            id: "attachment-1",
            path: "HSBC-Outgoing.pdf",
            kind: "GENERATED" as const,
            version: 1,
            hash: "sha256:source",
          },
        ],
      },
    };
    store.findLinkages.mockResolvedValue([groupedLink]);
    store.readTarget.mockResolvedValue({
      ...groupedLink.snapshot,
      directoryEntries: [
        ...groupedLink.snapshot.directoryEntries,
        {
          id: "foreign-1",
          path: "team-notes.txt",
          kind: "EXTERNAL" as const,
          version: 1,
          hash: "sha256:foreign",
        },
      ],
    });

    await expect(
      new ConfirmationEmpImportWithdrawalService(
        store as never,
        access as never,
        auditLogs as never
      ).withdraw(
        "project-1",
        "import-job-1",
        "confirmation-1",
        user,
        source,
        undefined,
        true
      )
    ).resolves.toMatchObject({ importJobId: "import-job-1" });

    expect(store.withdrawLinkages).toHaveBeenCalledWith(
      expect.objectContaining({ linkIds: ["import-item-1"] })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_EMP_IMPORT_WITHDRAWAL_FORCED",
        targetId: "import-job-1",
        description: expect.stringContaining("目录混入外来项"),
      })
    );
  });

  it("blocks grouped source and whole-job withdrawal when the persisted snapshot already contains a foreign item", async () => {
    const groupedLink = {
      ...link,
      mode: "GROUPED" as const,
      snapshot: {
        ...link.snapshot,
        directoryEntries: [
          {
            id: "attachment-1",
            path: "HSBC-Outgoing.pdf",
            kind: "GENERATED" as const,
            version: 1,
            hash: "sha256:source",
          },
          {
            id: "foreign-1",
            path: "team-notes.txt",
            kind: "EXTERNAL" as const,
            version: 1,
            hash: "sha256:foreign",
          },
        ],
      },
    };
    store.findLinkages.mockResolvedValue([groupedLink]);
    store.readTarget.mockResolvedValue(groupedLink.snapshot);
    const service = new ConfirmationEmpImportWithdrawalService(
      store as never,
      access as never,
      auditLogs as never
    );

    for (const sourceConfirmationId of ["confirmation-1", undefined]) {
      await expect(
        service.withdraw(
          "project-1",
          "import-job-1",
          sourceConfirmationId,
          user,
          source
        )
      ).rejects.toMatchObject({
        response: {
          code: "CONFIRMATION_STATE_CONFLICT",
          message: expect.stringContaining("目录混入外来项"),
        },
      });
    }

    expect(store.withdrawLinkages).not.toHaveBeenCalled();
  });

  it("recycles a grouped directory only when its generated contents are unchanged", async () => {
    const groupedLink = {
      ...link,
      mode: "GROUPED" as const,
      snapshot: {
        ...link.snapshot,
        directoryEntries: [
          {
            id: "attachment-1",
            path: "HSBC-Outgoing.pdf",
            kind: "GENERATED" as const,
            version: 1,
            hash: "sha256:source",
          },
        ],
      },
    };
    store.findLinkages.mockResolvedValue([groupedLink]);
    store.readTarget.mockResolvedValue(groupedLink.snapshot);

    await expect(
      new ConfirmationEmpImportWithdrawalService(
        store as never,
        access as never,
        auditLogs as never
      ).withdraw("project-1", "import-job-1", "confirmation-1", user, source)
    ).resolves.toMatchObject({
      mode: "GROUPED",
      recycleDirectory: true,
    });
    expect(store.withdrawLinkages).toHaveBeenCalledWith(
      expect.objectContaining({ recycleDirectory: true })
    );
  });

  it("withdraws one grouped confirmation without recycling a non-empty shared folder", async () => {
    const groupedLink = {
      ...link,
      mode: "GROUPED" as const,
      snapshot: {
        ...link.snapshot,
        directoryEntries: [
          {
            id: "attachment-1",
            path: "HSBC-Outgoing.pdf",
            kind: "GENERATED" as const,
            version: 1,
            hash: "sha256:source",
          },
          {
            id: "attachment-2",
            path: "ABC-Response.pdf",
            kind: "GENERATED" as const,
            version: 1,
            hash: "sha256:source-2",
          },
        ],
      },
    };
    store.findLinkages.mockResolvedValue([groupedLink]);
    store.readTarget.mockResolvedValue(groupedLink.snapshot);

    await expect(
      new ConfirmationEmpImportWithdrawalService(
        store as never,
        access as never,
        auditLogs as never
      ).withdraw("project-1", "import-job-1", "confirmation-1", user, source)
    ).resolves.toMatchObject({
      mode: "GROUPED",
      recycleDirectory: false,
    });
    expect(store.withdrawLinkages).toHaveBeenCalledWith(
      expect.objectContaining({ recycleDirectory: false })
    );
  });

  it("withdraws the complete ZIP job even when one confirmation is selected", async () => {
    const zipFirst = {
      ...link,
      mode: "ZIP" as const,
      sourceConfirmationId: "confirmation-1",
    };
    const zipSecond = {
      ...link,
      id: "import-item-2",
      mode: "ZIP" as const,
      sourceConfirmationId: "confirmation-2",
      snapshot: { ...link.snapshot, title: "HSBC-Response-01.pdf" },
    };
    store.findLinkages.mockImplementation(
      async (input: { sourceConfirmationId?: string }) => {
        await Promise.resolve();
        return input.sourceConfirmationId ? [zipFirst] : [zipFirst, zipSecond];
      }
    );
    store.readTarget.mockImplementation(async (candidate: { id: string }) => {
      await Promise.resolve();
      return candidate.id === zipSecond.id
        ? zipSecond.snapshot
        : zipFirst.snapshot;
    });

    await expect(
      new ConfirmationEmpImportWithdrawalService(
        store as never,
        access as never,
        auditLogs as never
      ).withdraw("project-1", "import-job-1", "confirmation-1", user, source)
    ).resolves.toMatchObject({
      mode: "ZIP",
      linkIds: ["import-item-1", "import-item-2"],
    });
    expect(store.withdrawLinkages).toHaveBeenCalledWith(
      expect.objectContaining({
        linkIds: ["import-item-1", "import-item-2"],
        recycleDirectory: false,
      })
    );
  });

  it("restores a withdrawn import and reactivates its linkage while every source remains matched", async () => {
    const withdrawnLink = {
      ...link,
      active: false,
      withdrawnAt: new Date("2026-08-05T09:00:00.000Z"),
    };
    store.findLinkages.mockResolvedValue([withdrawnLink]);
    store.readSourceState.mockResolvedValue({
      confirmationId: "confirmation-1",
      valid: true,
      matched: true,
      status: "CLOSED",
      differenceStatus: "MATCHED",
      artifactValid: true,
    });
    store.restoreLinkages.mockResolvedValue(undefined as never);

    await expect(
      new ConfirmationEmpImportWithdrawalService(
        store as never,
        access as never,
        auditLogs as never
      ).restore(
        "project-1",
        "import-job-1",
        {
          scope: "SOURCE_CONFIRMATION",
          sourceConfirmationId: "confirmation-1",
        },
        user,
        source
      )
    ).resolves.toMatchObject({
      importJobId: "import-job-1",
      linkIds: ["import-item-1"],
    });
    expect(store.restoreLinkages).toHaveBeenCalledWith(
      expect.objectContaining({
        importJobId: "import-job-1",
        linkIds: ["import-item-1"],
        actorId: "user-1",
        expectedTargets: [
          { linkId: "import-item-1", snapshot: withdrawnLink.snapshot },
        ],
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_EMP_IMPORT_RESTORED",
        targetId: "import-job-1",
      })
    );
  });

  it("blocks restoring an import when its source is no longer matched", async () => {
    const withdrawnLink = {
      ...link,
      active: false,
      withdrawnAt: new Date("2026-08-05T09:00:00.000Z"),
    };
    store.findLinkages.mockResolvedValue([withdrawnLink]);
    store.readSourceState.mockResolvedValue({
      confirmationId: "confirmation-1",
      valid: true,
      matched: false,
      status: "RESPONSE_RECEIVED",
      differenceStatus: "EXCEPTION",
      reason: "review was undone",
    });

    await expect(
      new ConfirmationEmpImportWithdrawalService(
        store as never,
        access as never,
        auditLogs as never
      ).restore(
        "project-1",
        "import-job-1",
        {
          scope: "SOURCE_CONFIRMATION",
          sourceConfirmationId: "confirmation-1",
        },
        user,
        source
      )
    ).rejects.toMatchObject({
      response: {
        code: "CONFIRMATION_STATE_CONFLICT",
        message: expect.stringContaining("review was undone"),
      },
    });
    expect(store.restoreLinkages).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_EMP_IMPORT_RESTORE_BLOCKED",
        targetId: "import-job-1",
        projectId: "project-1",
      })
    );
  });

  it("resolves source-level restore by sourceConfirmationId rather than linkage id", async () => {
    const withdrawnLink = {
      ...link,
      active: false,
      withdrawnAt: new Date("2026-08-05T09:00:00.000Z"),
    };
    store.findLinkages.mockResolvedValue([withdrawnLink]);
    store.readSourceState.mockResolvedValue({
      confirmationId: "confirmation-1",
      valid: true,
      matched: true,
      status: "CLOSED",
      differenceStatus: "MATCHED",
      artifactValid: true,
    });

    await (
      new ConfirmationEmpImportWithdrawalService(
        store as never,
        access as never,
        auditLogs as never
      ) as unknown as {
        restore: (...args: unknown[]) => Promise<unknown>;
      }
    ).restore(
      "project-1",
      "import-job-1",
      {
        scope: "SOURCE_CONFIRMATION",
        sourceConfirmationId: "confirmation-1",
      },
      user,
      source
    );

    expect(store.findLinkages).toHaveBeenCalledWith({
      projectId: "project-1",
      importJobId: "import-job-1",
      sourceConfirmationId: "confirmation-1",
      state: "WITHDRAWN",
    });
  });

  it("withdraws one ZIP item when an item scope is selected", async () => {
    const zipFirst = { ...link, mode: "ZIP" as const };
    const zipSecond = {
      ...link,
      id: "import-item-2",
      mode: "ZIP" as const,
      sourceConfirmationId: "confirmation-2",
      snapshot: { ...link.snapshot, title: "HSBC-Response-01.pdf" },
    };
    store.findLinkages.mockImplementation(
      async (input: { linkId?: string }) =>
        input.linkId ? [zipFirst] : [zipFirst, zipSecond]
    );
    store.readTarget.mockImplementation(async (candidate: { id: string }) =>
      candidate.id === zipSecond.id ? zipSecond.snapshot : zipFirst.snapshot
    );

    await expect(
      new ConfirmationEmpImportWithdrawalService(
        store as never,
        access as never,
        auditLogs as never
      ).withdraw(
        "project-1",
        "import-job-1",
        undefined,
        user,
        source,
        undefined,
        false,
        "import-item-1"
      )
    ).resolves.toMatchObject({
      mode: "ZIP",
      linkIds: ["import-item-1"],
    });
    expect(store.findLinkages).toHaveBeenCalledWith({
      projectId: "project-1",
      importJobId: "import-job-1",
      linkId: "import-item-1",
      state: "ACTIVE",
    });
    expect(store.withdrawZipItem).toHaveBeenCalledWith(
      expect.objectContaining({ linkId: "import-item-1" })
    );
  });

  it("does not recycle a grouped directory for one item", async () => {
    const groupedLink = {
      ...link,
      mode: "GROUPED" as const,
      snapshot: {
        ...link.snapshot,
        directoryEntries: [
          {
            id: "attachment-1",
            path: "HSBC-Outgoing.pdf",
            kind: "GENERATED" as const,
          },
        ],
      },
    };
    store.findLinkages.mockResolvedValue([groupedLink]);
    store.readTarget.mockResolvedValue(groupedLink.snapshot);

    await new ConfirmationEmpImportWithdrawalService(
      store as never,
      access as never,
      auditLogs as never
    ).withdraw(
      "project-1",
      "import-job-1",
      undefined,
      user,
      source,
      undefined,
      false,
      "import-item-1"
    );

    expect(store.withdrawLinkages).toHaveBeenCalledWith(
      expect.objectContaining({ linkIds: ["import-item-1"], recycleDirectory: false })
    );
  });

  it("treats restoring an already active linkage as idempotent", async () => {
    store.findLinkages.mockResolvedValue([link]);
    const service = new ConfirmationEmpImportWithdrawalService(
      store as never,
      access as never,
      auditLogs as never
    );

    await expect(
      service.restore(
        "project-1",
        "import-job-1",
        {
          scope: "SOURCE_CONFIRMATION",
          sourceConfirmationId: "confirmation-1",
        },
        user,
        source
      )
    ).resolves.toMatchObject({
      importJobId: "import-job-1",
      linkIds: ["import-item-1"],
      mode: "FLAT",
    });
    expect(store.restoreLinkages).not.toHaveBeenCalled();
  });

  it("keeps withdrawal blocked when its conflict audit write fails", async () => {
    const groupedLink = {
      ...link,
      mode: "GROUPED" as const,
      snapshot: {
        ...link.snapshot,
        directoryEntries: [
          {
            id: "attachment-1",
            path: "HSBC-Outgoing.pdf",
            kind: "GENERATED" as const,
            version: 1,
            hash: "sha256:source",
          },
        ],
      },
    };
    store.findLinkages.mockResolvedValue([groupedLink]);
    store.readTarget.mockResolvedValue({
      ...groupedLink.snapshot,
      directoryEntries: [
        ...groupedLink.snapshot.directoryEntries,
        {
          id: "foreign-1",
          path: "foreign.txt",
          kind: "EXTERNAL" as const,
          version: 1,
          hash: "foreign",
        },
      ],
    });
    auditLogs.log.mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(
      new ConfirmationEmpImportWithdrawalService(
        store as never,
        access as never,
        auditLogs as never
      ).withdraw("project-1", "import-job-1", "confirmation-1", user, source)
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });
    expect(store.withdrawLinkages).not.toHaveBeenCalled();
  });
});
