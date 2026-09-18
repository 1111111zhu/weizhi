import { Prisma } from "@prisma/client";

import { ConfirmationSubmissionService } from "./confirmation-submission.service";

const draftUpdatedAt = new Date("2026-07-11T08:00:00.000Z");
const queuedAt = new Date("2026-07-11T09:00:00.000Z");
const user = {
  id: "user-1",
  name: "Project Member",
  email: "member@example.test",
  globalRole: "EMPLOYEE",
};
const source = { ipAddress: "127.0.0.1", userAgent: "jest" };
const submitInput = {
  expectedDraftUpdatedAt: draftUpdatedAt.toISOString(),
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
};
const withdrawInput = {
  idempotencyKey: "00000000-0000-4000-8000-000000000002",
  reason: "Recipient details need revision",
};
const derivedSnapshot = {
  clientCode: "C-ORC",
  clientName: "Orchid Holdings",
  projectCode: "AUD-2026-0003",
  projectName: "Orchid Audit 2026",
  picName: "Engagement PIC",
  fiscalYear: 2026,
  balanceSheetDate: "2026-12-31",
  contactUserId: "user-1",
  contactName: "Project Member",
  contactEmail: "member@example.test",
  confirmationCode: "AUD-2026-0003-YH-001",
};
const draftConfirmation = {
  id: "confirmation-1",
  projectId: "project-1",
  type: "BANK",
  status: "DRAFT",
  confirmationCode: "AUD-2026-0003-YH-001",
  counterpartyName: "HSBC",
  draftTemplateCode: "PRC_BANK_TEMPLATE_1",
  draftPayload: { bankName: "HSBC" },
  draftUpdatedAt,
  submissionVersion: 0,
  currentArtifactId: null,
  queuedAt: null,
  queueClaimedBy: null,
  queueClaimedAt: null,
};
const activeArtifact = {
  id: "artifact-1",
  confirmationId: "confirmation-1",
  version: 1,
  disposition: "ACTIVE",
  templateCode: "PRC_BANK_TEMPLATE_1",
  templateVersion: "bank-prc-v1",
  pdfSha256: "a".repeat(64),
  pdfSize: 120,
  docxSize: 80,
  submissionKey: submitInput.idempotencyKey,
  submittedBy: "user-1",
  submittedAt: queuedAt,
};
const preparedConfirmation = {
  ...draftConfirmation,
  status: "PREPARED",
  submissionVersion: 1,
  currentArtifactId: "artifact-1",
  queuedAt,
  currentArtifact: activeArtifact,
};
const prisma = {
  projectConfirmation: { findFirst: vi.fn() },
  confirmationArtifact: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};
const tx = {
  projectMember: { findUnique: vi.fn() },
  projectConfirmation: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  confirmationArtifact: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  confirmationFollowUpEvent: { create: vi.fn() },
};
const access = { requireMutableProject: vi.fn() };
const derivedData = { resolve: vi.fn() };
const artifacts = {
  create: vi.fn(),
  deleteStoredFiles: vi.fn(),
};

function createService() {
  return new ConfirmationSubmissionService(
    prisma as never,
    access as never,
    derivedData as never,
    artifacts as never
  );
}

function prismaRace(code: "P2002" | "P2034") {
  return new Prisma.PrismaClientKnownRequestError("concurrent submission", {
    code,
    clientVersion: "test",
  });
}

function arrangeTransaction() {
  prisma.$transaction.mockImplementation((callback) => callback(tx));
  tx.projectMember.findUnique.mockResolvedValue({
    status: "ACTIVE",
    project: { status: "ACTIVE" },
  });
  tx.confirmationArtifact.findUnique.mockResolvedValue(null);
  tx.confirmationArtifact.findFirst.mockResolvedValue(null);
  tx.confirmationArtifact.updateMany.mockResolvedValue({ count: 1 });
  tx.projectConfirmation.updateMany.mockResolvedValue({ count: 1 });
  tx.auditLog.create.mockResolvedValue({ id: "audit-1" });
}

describe(ConfirmationSubmissionService, () => {
  beforeEach(() => {
    vi.resetAllMocks();
    access.requireMutableProject.mockResolvedValue({ id: "member-1" });
    prisma.projectConfirmation.findFirst.mockResolvedValue(draftConfirmation);
    prisma.confirmationArtifact.findUnique.mockResolvedValue(null);
    derivedData.resolve.mockResolvedValue(derivedSnapshot);
    artifacts.create.mockResolvedValue(activeArtifact);
    artifacts.deleteStoredFiles.mockResolvedValue(undefined as never);
    arrangeTransaction();
    tx.projectConfirmation.findFirst
      .mockResolvedValueOnce(draftConfirmation)
      .mockResolvedValueOnce(preparedConfirmation);
  });

  it("submits an authoritative artifact and queues the active version", async () => {
    await expect(
      createService().submit(
        "project-1",
        "confirmation-1",
        submitInput,
        user as never,
        source as never
      )
    ).resolves.toStrictEqual(preparedConfirmation);

    expect(access.requireMutableProject).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(derivedData.resolve).toHaveBeenCalledWith(
      "project-1",
      user,
      draftConfirmation.confirmationCode
    );
    expect(derivedData.resolve.mock.invocationCallOrder[0]).toBeLessThan(
      artifacts.create.mock.invocationCallOrder[0]
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
      timeout: 120_000,
    });
    expect(artifacts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmation: draftConfirmation,
        derivedSnapshot,
        version: 1,
        submissionKey: submitInput.idempotencyKey,
        submittedBy: "user-1",
        artifactId: expect.any(String),
      }),
      tx
    );
    expect(tx.projectConfirmation.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "confirmation-1",
        projectId: "project-1",
        status: "DRAFT",
        submissionVersion: 0,
        currentArtifactId: null,
        draftUpdatedAt,
      }),
      data: expect.objectContaining({
        status: "PREPARED",
        submissionVersion: 1,
        currentArtifactId: "artifact-1",
        queuedAt: expect.any(Date),
        responsibleUserId: "user-1",
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "user-1",
        action: "PROJECT_CONFIRMATION_SUBMITTED",
        targetId: "confirmation-1",
        projectId: "project-1",
      }),
    });
  });

  it("blocks missing derived data before rendering, storage, or a transaction", async () => {
    derivedData.resolve.mockRejectedValue(
      Object.assign(new Error("CMP client is required"), {
        response: { code: "CMP_CLIENT_REQUIRED" },
      })
    );

    await expect(
      createService().submit(
        "project-1",
        "confirmation-1",
        submitInput,
        user as never,
        source as never
      )
    ).rejects.toMatchObject({ response: { code: "CMP_CLIENT_REQUIRED" } });

    expect(artifacts.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("leaves the confirmation draft untouched when rendering fails", async () => {
    const renderFailure = new Error("renderer unavailable");
    artifacts.create.mockRejectedValue(renderFailure);

    await expect(
      createService().submit(
        "project-1",
        "confirmation-1",
        submitInput,
        user as never,
        source as never
      )
    ).rejects.toBe(renderFailure);

    expect(tx.projectConfirmation.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(artifacts.deleteStoredFiles).not.toHaveBeenCalled();
  });

  it("returns the existing artifact result for the same submission key", async () => {
    prisma.projectConfirmation.findFirst.mockResolvedValue(
      preparedConfirmation
    );
    prisma.confirmationArtifact.findUnique.mockResolvedValue(activeArtifact);

    await expect(
      createService().submit(
        "project-1",
        "confirmation-1",
        submitInput,
        user as never,
        source as never
      )
    ).resolves.toStrictEqual(preparedConfirmation);

    expect(derivedData.resolve).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(artifacts.create).not.toHaveBeenCalled();
  });

  it("rejects replay when the request draft timestamp has changed", async () => {
    prisma.projectConfirmation.findFirst.mockResolvedValue(
      preparedConfirmation
    );
    prisma.confirmationArtifact.findUnique.mockResolvedValue(activeArtifact);

    await expect(
      createService().submit(
        "project-1",
        "confirmation-1",
        { ...submitInput, expectedDraftUpdatedAt: "2026-07-11T07:59:59.000Z" },
        user as never,
        source as never
      )
    ).rejects.toMatchObject({
      status: 409,
      response: { code: "CONFIRMATION_DRAFT_CHANGED" },
    });
  });

  it.each([
    [
      "a historical key",
      { ...preparedConfirmation, currentArtifactId: "artifact-2" },
      { ...activeArtifact, disposition: "INVALIDATED" },
    ],
    [
      "a key whose artifact is not current",
      { ...preparedConfirmation, currentArtifactId: "artifact-2" },
      activeArtifact,
    ],
    [
      "a draft with no current artifact",
      { ...draftConfirmation, submissionVersion: 1 },
      activeArtifact,
    ],
  ])("rejects replay for %s", async (_label, confirmation, artifact) => {
    prisma.projectConfirmation.findFirst.mockResolvedValue(confirmation);
    prisma.confirmationArtifact.findUnique.mockResolvedValue(artifact);

    await expect(
      createService().submit(
        "project-1",
        "confirmation-1",
        submitInput,
        user as never,
        source as never
      )
    ).rejects.toMatchObject({
      status: 409,
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns HTTP 409 CONFIRMATION_DRAFT_CHANGED for a stale draft timestamp", async () => {
    await expect(
      createService().submit(
        "project-1",
        "confirmation-1",
        { ...submitInput, expectedDraftUpdatedAt: "2026-07-11T07:59:59.000Z" },
        user as never,
        source as never
      )
    ).rejects.toMatchObject({
      status: 409,
      response: {
        code: "CONFIRMATION_DRAFT_CHANGED",
        message: "Confirmation draft changed before submission",
      },
    });

    expect(derivedData.resolve).not.toHaveBeenCalled();
    expect(artifacts.create).not.toHaveBeenCalled();
  });

  it("compensates stored objects when the caller-owned transaction later fails", async () => {
    const commitFailure = new Error("serialization failure");
    prisma.$transaction.mockImplementation((callback) =>
      Promise.resolve(callback(tx)).then(() => {
        throw commitFailure;
      })
    );

    await expect(
      createService().submit(
        "project-1",
        "confirmation-1",
        submitInput,
        user as never,
        source as never
      )
    ).rejects.toBe(commitFailure);

    expect(artifacts.deleteStoredFiles).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      expect.any(String)
    );
  });

  it("preserves the transaction failure when outer compensation also fails", async () => {
    const commitFailure = new Error("serialization failure");
    prisma.$transaction.mockImplementation((callback) =>
      Promise.resolve(callback(tx)).then(() => {
        throw commitFailure;
      })
    );
    artifacts.deleteStoredFiles.mockRejectedValue(new Error("cleanup failed"));

    await expect(
      createService().submit(
        "project-1",
        "confirmation-1",
        submitInput,
        user as never,
        source as never
      )
    ).rejects.toBe(commitFailure);

    expect(artifacts.deleteStoredFiles).toHaveBeenCalledOnce();
  });

  it("returns the committed same-key winner after a P2034 race and cleans up first", async () => {
    const race = prismaRace("P2034");
    prisma.$transaction.mockImplementation((callback) =>
      Promise.resolve(callback(tx)).then(() => {
        throw race;
      })
    );
    prisma.confirmationArtifact.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(activeArtifact);
    prisma.projectConfirmation.findFirst
      .mockResolvedValueOnce(draftConfirmation)
      .mockResolvedValueOnce(preparedConfirmation);

    await expect(
      createService().submit(
        "project-1",
        "confirmation-1",
        submitInput,
        user as never,
        source as never
      )
    ).resolves.toStrictEqual(preparedConfirmation);

    expect(artifacts.deleteStoredFiles).toHaveBeenCalledOnce();
    expect(
      artifacts.deleteStoredFiles.mock.invocationCallOrder[0]
    ).toBeLessThan(
      prisma.confirmationArtifact.findUnique.mock.invocationCallOrder[1]
    );
  });

  it("normalizes a competing-key P2034 race to a state conflict", async () => {
    prisma.$transaction.mockImplementation((callback) =>
      Promise.resolve(callback(tx)).then(() => {
        throw prismaRace("P2034");
      })
    );
    prisma.confirmationArtifact.findUnique.mockResolvedValue(null);

    await expect(
      createService().submit(
        "project-1",
        "confirmation-1",
        submitInput,
        user as never,
        source as never
      )
    ).rejects.toMatchObject({
      status: 409,
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(artifacts.deleteStoredFiles).toHaveBeenCalledOnce();
  });

  it("normalizes a relevant P2002 race to a state conflict after cleanup", async () => {
    prisma.$transaction.mockImplementation((callback) =>
      Promise.resolve(callback(tx)).then(() => {
        throw prismaRace("P2002");
      })
    );
    prisma.confirmationArtifact.findUnique.mockResolvedValue(null);

    await expect(
      createService().submit(
        "project-1",
        "confirmation-1",
        submitInput,
        user as never,
        source as never
      )
    ).rejects.toMatchObject({
      status: 409,
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(artifacts.deleteStoredFiles).toHaveBeenCalledOnce();
  });

  it("withdraws an active unclaimed prepared artifact without changing immutable metadata", async () => {
    prisma.projectConfirmation.findFirst.mockResolvedValue(
      preparedConfirmation
    );
    tx.projectConfirmation.findFirst
      .mockReset()
      .mockResolvedValueOnce(preparedConfirmation)
      .mockResolvedValueOnce({
        ...preparedConfirmation,
        status: "DRAFT",
        currentArtifactId: null,
        queuedAt: null,
        currentArtifact: null,
      });

    const result = await createService().withdraw(
      "project-1",
      "confirmation-1",
      withdrawInput,
      user as never,
      source as never
    );

    expect(result).toStrictEqual(expect.objectContaining({ status: "DRAFT" }));
    expect(tx.confirmationArtifact.updateMany).toHaveBeenCalledWith({
      where: {
        id: "artifact-1",
        confirmationId: "confirmation-1",
        disposition: "ACTIVE",
      },
      data: {
        disposition: "INVALIDATED",
        invalidatedBy: "user-1",
        invalidatedAt: expect.any(Date),
        invalidationReason: "WITHDRAWN: Recipient details need revision",
      },
    });
    expect(
      tx.confirmationArtifact.updateMany.mock.calls[0][0].data
    ).not.toStrictEqual(
      expect.objectContaining({
        docxObjectKey: expect.anything(),
        pdfObjectKey: expect.anything(),
        pdfSha256: expect.anything(),
        structuredSnapshot: expect.anything(),
        derivedSnapshot: expect.anything(),
      })
    );
    expect(tx.projectConfirmation.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "confirmation-1",
        projectId: "project-1",
        status: "PREPARED",
        currentArtifactId: "artifact-1",
        queueClaimedAt: null,
      }),
      data: expect.objectContaining({
        status: "DRAFT",
        currentArtifactId: null,
        queuedAt: null,
        queueClaimedBy: null,
        queueClaimedAt: null,
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "PROJECT_CONFIRMATION_WITHDRAWN",
      }),
    });
  });

  it("rejects withdrawal after a confirmation officer claims the queue item", async () => {
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      ...preparedConfirmation,
      queueClaimedBy: "officer-1",
      queueClaimedAt: queuedAt,
    });

    await expect(
      createService().withdraw(
        "project-1",
        "confirmation-1",
        withdrawInput,
        user as never,
        source as never
      )
    ).rejects.toMatchObject({ status: 409 });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.confirmationArtifact.updateMany).not.toHaveBeenCalled();
  });

  it("normalizes a P2034 withdrawal claim race to a state conflict", async () => {
    prisma.projectConfirmation.findFirst.mockResolvedValue(
      preparedConfirmation
    );
    prisma.$transaction.mockRejectedValue(prismaRace("P2034"));

    await expect(
      createService().withdraw(
        "project-1",
        "confirmation-1",
        withdrawInput,
        user as never,
        source as never
      )
    ).rejects.toMatchObject({
      status: 409,
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("resubmits as version 2, supersedes version 1, and queues the new artifact", async () => {
    const withdrawn = {
      ...draftConfirmation,
      submissionVersion: 1,
    };
    const version2 = {
      ...activeArtifact,
      id: "artifact-2",
      version: 2,
      submissionKey: "00000000-0000-4000-8000-000000000003",
    };
    const resubmitted = {
      ...preparedConfirmation,
      submissionVersion: 2,
      currentArtifactId: "artifact-2",
      currentArtifact: version2,
    };
    prisma.projectConfirmation.findFirst.mockResolvedValue(withdrawn);
    artifacts.create.mockResolvedValue(version2);
    tx.projectConfirmation.findFirst
      .mockReset()
      .mockResolvedValueOnce(withdrawn)
      .mockResolvedValueOnce(resubmitted);
    tx.confirmationArtifact.findFirst.mockResolvedValue({
      ...activeArtifact,
      disposition: "INVALIDATED",
    });

    await expect(
      createService().submit(
        "project-1",
        "confirmation-1",
        {
          expectedDraftUpdatedAt: draftUpdatedAt.toISOString(),
          idempotencyKey: version2.submissionKey,
        },
        user as never,
        source as never
      )
    ).resolves.toStrictEqual(resubmitted);

    expect(artifacts.create).toHaveBeenCalledWith(
      expect.objectContaining({ version: 2 }),
      tx
    );
    expect(tx.confirmationArtifact.updateMany).toHaveBeenCalledWith({
      where: {
        id: "artifact-1",
        confirmationId: "confirmation-1",
        disposition: "INVALIDATED",
      },
      data: expect.objectContaining({
        disposition: "INVALIDATED",
        invalidationReason: "SUPERSEDED_BY_VERSION_2",
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "PROJECT_CONFIRMATION_RESUBMITTED",
      }),
    });
  });

  it("rejects resubmission when the previous artifact is missing", async () => {
    const withdrawn = { ...draftConfirmation, submissionVersion: 1 };
    prisma.projectConfirmation.findFirst.mockResolvedValue(withdrawn);
    tx.projectConfirmation.findFirst.mockReset().mockResolvedValue(withdrawn);
    tx.confirmationArtifact.findFirst.mockResolvedValue(null);

    await expect(
      createService().submit(
        "project-1",
        "confirmation-1",
        {
          ...submitInput,
          idempotencyKey: "00000000-0000-4000-8000-000000000003",
        },
        user as never,
        source as never
      )
    ).rejects.toMatchObject({
      status: 409,
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(artifacts.create).not.toHaveBeenCalled();
  });

  it("conflicts when resubmission does not supersede exactly one artifact", async () => {
    const withdrawn = { ...draftConfirmation, submissionVersion: 1 };
    prisma.projectConfirmation.findFirst.mockResolvedValue(withdrawn);
    tx.projectConfirmation.findFirst.mockReset().mockResolvedValue(withdrawn);
    tx.confirmationArtifact.findFirst.mockResolvedValue({
      ...activeArtifact,
      disposition: "INVALIDATED",
    });
    tx.confirmationArtifact.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      createService().submit(
        "project-1",
        "confirmation-1",
        {
          ...submitInput,
          idempotencyKey: "00000000-0000-4000-8000-000000000003",
        },
        user as never,
        source as never
      )
    ).rejects.toMatchObject({
      status: 409,
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(artifacts.deleteStoredFiles).toHaveBeenCalledOnce();
    expect(tx.projectConfirmation.updateMany).not.toHaveBeenCalled();
  });
});
