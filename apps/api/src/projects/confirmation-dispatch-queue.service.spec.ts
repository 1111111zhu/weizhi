import {
  ApiConflictException,
  ApiForbiddenException,
} from "../common/api-error";
import { ConfirmationDispatchQueueService } from "./confirmation-dispatch-queue.service";

const prisma = {
  $transaction: vi.fn(),
  projectConfirmation: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  confirmationArtifact: { updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
};
const officer = {
  id: "officer-1",
  globalRole: "CONFIRMATION_OFFICER",
} as never;
const otherOfficer = {
  id: "officer-2",
  globalRole: "CONFIRMATION_OFFICER",
} as never;
const projectMember = { id: "member-1", globalRole: "STAFF" } as never;
const source = { ipAddress: "127.0.0.1" };
const queuedAt = new Date("2026-07-12T09:00:00.000Z");

function queueRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "confirmation-1",
    projectId: "project-1",
    type: "BANK",
    status: "PREPARED",
    confirmationCode: "AUD-2026-0001-YH-001",
    counterpartyName: "HSBC Hong Kong",
    draftTemplateCode: "PRC_BANK_TEMPLATE_1",
    plannedSendDate: null,
    queuedAt,
    updatedAt: queuedAt,
    preparedDispatchMethod: "COURIER",
    queueClaimedBy: null,
    queueClaimedAt: null,
    revisionReason: null,
    revisionRequestedAt: null,
    responsibleUser: {
      id: "partner-1",
      name: "Engagement PIC",
      email: "pic@example.test",
    },
    project: {
      id: "project-1",
      name: "Orchid audit",
      projectCode: "AUD-2026-0001",
    },
    currentArtifact: {
      id: "artifact-1",
      version: 1,
      disposition: "ACTIVE",
      templateCode: "PRC_BANK_TEMPLATE_1",
      templateVersion: "1",
      pdfSha256: "abc123",
      submittedAt: queuedAt,
    },
    dispatches: [],
    ...overrides,
  };
}

describe(ConfirmationDispatchQueueService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
  });

  it("restricts queue access to confirmation officers and super admins", async () => {
    const service = new ConfirmationDispatchQueueService(prisma as never);

    await expect(service.list({}, projectMember)).rejects.toBeInstanceOf(
      ApiForbiddenException
    );
  });

  it("filters minimal queue rows without loading the confirmation aggregate", async () => {
    const service = new ConfirmationDispatchQueueService(prisma as never);
    prisma.projectConfirmation.findMany.mockResolvedValue([queueRecord()]);

    await expect(
      service.list(
        {
          type: "BANK",
          projectId: "project-1",
          queueStatus: "UNCLAIMED",
        },
        officer
      )
    ).resolves.toStrictEqual([
      expect.objectContaining({
        confirmationId: "confirmation-1",
        queueStatus: "UNCLAIMED",
        artifact: expect.objectContaining({ id: "artifact-1" }),
      }),
    ]);
    expect(prisma.projectConfirmation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ AND: expect.any(Array) }),
        select: expect.objectContaining({ dispatches: expect.anything() }),
      })
    );
  });

  it("claims atomically and records an audit event", async () => {
    const service = new ConfirmationDispatchQueueService(prisma as never);
    prisma.projectConfirmation.findUnique
      .mockResolvedValueOnce(queueRecord())
      .mockResolvedValueOnce(
        queueRecord({ queueClaimedBy: "officer-1", queueClaimedAt: new Date() })
      );
    prisma.projectConfirmation.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.claim(
        "confirmation-1",
        {
          artifactId: "artifact-1",
          expectedQueuedAt: queuedAt.toISOString(),
          idempotencyKey: "00000000-0000-4000-8000-000000000001",
        },
        officer,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({ queueStatus: "CLAIMED" })
    );
    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          currentArtifactId: "artifact-1",
          queueClaimedBy: null,
          queuedAt,
        }),
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CONFIRMATION_QUEUE_CLAIMED" }),
      })
    );
  });

  it("returns a conflict when another officer wins the claim race", async () => {
    const service = new ConfirmationDispatchQueueService(prisma as never);
    prisma.projectConfirmation.findUnique.mockResolvedValue(queueRecord());
    prisma.projectConfirmation.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.claim(
        "confirmation-1",
        {
          artifactId: "artifact-1",
          expectedQueuedAt: queuedAt.toISOString(),
          idempotencyKey: "00000000-0000-4000-8000-000000000001",
        },
        otherOfficer,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "QUEUE_ITEM_ALREADY_CLAIMED" },
    });
  });

  it("treats an exact self-claim as idempotent", async () => {
    const service = new ConfirmationDispatchQueueService(prisma as never);
    prisma.projectConfirmation.findUnique.mockResolvedValue(
      queueRecord({ queueClaimedBy: "officer-1", queueClaimedAt: new Date() })
    );

    await expect(
      service.claim(
        "confirmation-1",
        {
          artifactId: "artifact-1",
          expectedQueuedAt: queuedAt.toISOString(),
          idempotencyKey: "00000000-0000-4000-8000-000000000001",
        },
        officer,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({ queueStatus: "CLAIMED" })
    );
    expect(prisma.projectConfirmation.updateMany).not.toHaveBeenCalled();
  });

  it("requires ownership to release or return a claimed item", async () => {
    const service = new ConfirmationDispatchQueueService(prisma as never);
    prisma.projectConfirmation.findUnique.mockResolvedValue(
      queueRecord({ queueClaimedBy: "officer-2", queueClaimedAt: new Date() })
    );

    await expect(
      service.release(
        "confirmation-1",
        {
          artifactId: "artifact-1",
          idempotencyKey: "00000000-0000-4000-8000-000000000001",
        },
        officer,
        source
      )
    ).rejects.toMatchObject({ response: { code: "QUEUE_CLAIM_NOT_OWNED" } });
    await expect(
      service.returnToProject(
        "confirmation-1",
        {
          artifactId: "artifact-1",
          idempotencyKey: "00000000-0000-4000-8000-000000000001",
          reason: "Recipient address requires correction",
        },
        officer,
        source
      )
    ).rejects.toBeInstanceOf(ApiConflictException);
  });

  it("returns an owned item to draft and marks its artifact returned", async () => {
    const service = new ConfirmationDispatchQueueService(prisma as never);
    prisma.projectConfirmation.findUnique
      .mockResolvedValueOnce(
        queueRecord({ queueClaimedBy: "officer-1", queueClaimedAt: new Date() })
      )
      .mockResolvedValueOnce(
        queueRecord({
          status: "DRAFT",
          currentArtifact: null,
          queuedAt: null,
          queueClaimedBy: null,
          queueClaimedAt: null,
          revisionReason: "Recipient address requires correction",
          revisionRequestedAt: new Date(),
        })
      );
    prisma.confirmationArtifact.updateMany.mockResolvedValue({ count: 1 });
    prisma.projectConfirmation.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.returnToProject(
        "confirmation-1",
        {
          artifactId: "artifact-1",
          idempotencyKey: "00000000-0000-4000-8000-000000000001",
          reason: "Recipient address requires correction",
        },
        officer,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        queueStatus: "RETURNED",
        validationStatus: "NEEDS_REVISION",
      })
    );
    expect(prisma.confirmationArtifact.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ disposition: "RETURNED" }),
      })
    );
  });
});
