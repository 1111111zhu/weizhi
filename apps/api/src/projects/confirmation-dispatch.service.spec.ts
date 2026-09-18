import type { Mock } from "vitest";

import { ConfirmationDispatchService } from "./confirmation-dispatch.service";

const prisma = {
  $transaction: vi.fn(),
  confirmationDispatchBatch: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  confirmationDispatchBatchItem: { findUnique: vi.fn(), update: vi.fn() },
  projectConfirmation: { updateMany: vi.fn() },
  projectConfirmationDispatch: { aggregate: vi.fn(), create: vi.fn() },
  confirmationDispatchEvent: { create: vi.fn() },
  auditLog: { create: vi.fn() },
};
const channel = {
  validate: vi.fn(),
  dispatch: vi.fn(),
};
const mockCourierChannel = {
  validate: vi.fn(),
  dispatch: vi.fn(),
};
const officer = {
  id: "officer-1",
  globalRole: "CONFIRMATION_OFFICER",
} as never;
const source = { ipAddress: "127.0.0.1" };
const batchInput = {
  method: "COURIER" as const,
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
  items: [
    { confirmationId: "confirmation-1", artifactId: "artifact-1" },
    { confirmationId: "confirmation-2", artifactId: "artifact-2" },
  ],
};

function batch(status: string, itemStatuses: string[] = ["QUEUED", "QUEUED"]) {
  return {
    id: "batch-1",
    method: "COURIER",
    status,
    idempotencyKey: batchInput.idempotencyKey,
    createdBy: "officer-1",
    items: itemStatuses.map((itemStatus, index) => ({
      id: `item-${index + 1}`,
      batchId: "batch-1",
      confirmationId: `confirmation-${index + 1}`,
      artifactId: `artifact-${index + 1}`,
      status: itemStatus,
      idempotencyKey: `item-key-${index + 1}`,
      confirmation: {
        id: `confirmation-${index + 1}`,
        projectId: `project-${index + 1}`,
        confirmationCode: `AUD-${index + 1}`,
        counterpartyName: `Bank ${index + 1}`,
      },
      artifact: {
        id: `artifact-${index + 1}`,
        version: 1,
        disposition: "ACTIVE",
        templateCode: "PRC_BANK_TEMPLATE_1",
      },
      dispatch: null,
    })),
  };
}

describe(ConfirmationDispatchService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    channel.validate.mockResolvedValue({ ok: true });
    channel.dispatch.mockResolvedValue({
      providerName: "MANUAL",
      providerReference: "manual:COURIER:abc",
    });
    mockCourierChannel.validate.mockResolvedValue({ ok: true });
    mockCourierChannel.dispatch.mockResolvedValue({
      providerName: "MOCK_COURIER",
      providerReference: "mock-courier:order:abc",
      courierName: "Mock Courier",
      dispatchReference: "Mock courier order created",
      trackingNumber: "MOCKABC",
    });
  });

  it("persists the full batch before item execution with deterministic item keys", async () => {
    const service = new ConfirmationDispatchService(
      prisma as never,
      channel as never,
      mockCourierChannel as never
    );
    prisma.confirmationDispatchBatch.findUnique.mockResolvedValue(null);
    prisma.confirmationDispatchBatch.create.mockResolvedValue(batch("QUEUED"));

    await service.createBatch(batchInput, officer, source);

    const create = prisma.confirmationDispatchBatch.create.mock.calls[0]?.[0];
    expect(create.data.items.create).toHaveLength(2);
    expect(create.data.items.create[0].idempotencyKey).toMatch(
      /^[a-f0-9]{64}$/
    );
    expect(create.data.items.create[0].idempotencyKey).not.toStrictEqual(
      create.data.items.create[1].idempotencyKey
    );
  });

  it("returns an existing batch for the same idempotency key", async () => {
    const service = new ConfirmationDispatchService(
      prisma as never,
      channel as never,
      mockCourierChannel as never
    );
    prisma.confirmationDispatchBatch.findUnique.mockResolvedValue(
      batch("QUEUED")
    );

    await expect(
      service.createBatch(batchInput, officer, source)
    ).resolves.toStrictEqual(expect.objectContaining({ id: "batch-1" }));
    expect(prisma.confirmationDispatchBatch.create).not.toHaveBeenCalled();
  });

  it("keeps successful items when a sibling fails and marks the batch partial", async () => {
    const service = new ConfirmationDispatchService(
      prisma as never,
      channel as never,
      mockCourierChannel as never
    );
    const initial = batch("QUEUED");
    const completed = batch("EXECUTING", ["SENT", "FAILED"]);
    prisma.confirmationDispatchBatch.findUnique
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(completed);
    vi.spyOn(service as unknown as { executeItem: Mock }, "executeItem")
      .mockResolvedValueOnce({ status: "SENT" })
      .mockResolvedValueOnce({ status: "FAILED" });
    prisma.confirmationDispatchBatch.update.mockResolvedValue(
      batch("PARTIAL_FAILURE", ["SENT", "FAILED"])
    );

    await expect(
      service.executeBatch(
        "batch-1",
        { idempotencyKey: batchInput.idempotencyKey },
        officer,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({ status: "PARTIAL_FAILURE" })
    );
    expect(prisma.confirmationDispatchBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PARTIAL_FAILURE" }),
      })
    );
  });

  it("does not execute a completed batch twice", async () => {
    const service = new ConfirmationDispatchService(
      prisma as never,
      channel as never,
      mockCourierChannel as never
    );
    prisma.confirmationDispatchBatch.findUnique.mockResolvedValue(
      batch("COMPLETED", ["SENT"])
    );

    await service.executeBatch(
      "batch-1",
      { idempotencyKey: batchInput.idempotencyKey },
      officer,
      source
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("records a stale artifact as an independent failed item", async () => {
    const service = new ConfirmationDispatchService(
      prisma as never,
      channel as never,
      mockCourierChannel as never
    );
    prisma.confirmationDispatchBatchItem.findUnique.mockResolvedValue({
      id: "item-1",
      batchId: "batch-1",
      confirmationId: "confirmation-1",
      artifactId: "artifact-1",
      status: "QUEUED",
      idempotencyKey: "item-key",
      dispatch: null,
      artifact: {
        id: "artifact-1",
        disposition: "ACTIVE",
        templateCode: "PRC_BANK_TEMPLATE_1",
      },
      confirmation: {
        id: "confirmation-1",
        projectId: "project-1",
        confirmationCode: "AUD-1",
        counterpartyName: "Bank 1",
        status: "PREPARED",
        currentArtifactId: "artifact-newer",
        queueClaimedBy: "officer-1",
        currentArtifact: { id: "artifact-newer", disposition: "ACTIVE" },
      },
    });
    prisma.confirmationDispatchBatchItem.update.mockResolvedValue({
      status: "FAILED",
    });

    await (
      service as unknown as {
        executeItem: (...args: unknown[]) => Promise<unknown>;
      }
    ).executeItem("batch-1", "COURIER", "item-1", officer, source);

    expect(prisma.confirmationDispatchBatchItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorCode: "CONFIRMATION_STATE_CONFLICT",
        }),
      })
    );
    expect(prisma.projectConfirmationDispatch.create).not.toHaveBeenCalled();
  });

  it("fails an item owned by another officer without creating a dispatch", async () => {
    const service = new ConfirmationDispatchService(
      prisma as never,
      channel as never,
      mockCourierChannel as never
    );
    prisma.confirmationDispatchBatchItem.findUnique.mockResolvedValue({
      id: "item-1",
      batchId: "batch-1",
      confirmationId: "confirmation-1",
      artifactId: "artifact-1",
      status: "QUEUED",
      idempotencyKey: "item-key",
      dispatch: null,
      artifact: {
        id: "artifact-1",
        disposition: "ACTIVE",
        templateCode: "PRC_BANK_TEMPLATE_1",
      },
      confirmation: {
        id: "confirmation-1",
        projectId: "project-1",
        confirmationCode: "AUD-1",
        counterpartyName: "Bank 1",
        status: "PREPARED",
        currentArtifactId: "artifact-1",
        queueClaimedBy: "officer-2",
        currentArtifact: { id: "artifact-1", disposition: "ACTIVE" },
      },
    });
    prisma.confirmationDispatchBatchItem.update.mockResolvedValue({
      status: "FAILED",
    });

    await (
      service as unknown as {
        executeItem: (...args: unknown[]) => Promise<unknown>;
      }
    ).executeItem("batch-1", "COURIER", "item-1", officer, source);

    expect(prisma.confirmationDispatchBatchItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorCode: "QUEUE_CLAIM_NOT_OWNED" }),
      })
    );
  });

  it("keeps unimplemented channels as per-item failures", async () => {
    const service = new ConfirmationDispatchService(
      prisma as never,
      channel as never,
      mockCourierChannel as never
    );
    channel.validate.mockResolvedValue({
      ok: false,
      code: "CHANNEL_NOT_IMPLEMENTED",
      message: "Dispatch channel EMAIL is not implemented",
    });
    prisma.confirmationDispatchBatchItem.findUnique.mockResolvedValue({
      id: "item-1",
      batchId: "batch-1",
      confirmationId: "confirmation-1",
      artifactId: "artifact-1",
      status: "QUEUED",
      idempotencyKey: "item-key",
      dispatch: null,
      artifact: {
        id: "artifact-1",
        disposition: "ACTIVE",
        templateCode: "PRC_BANK_TEMPLATE_1",
      },
      confirmation: {
        id: "confirmation-1",
        projectId: "project-1",
        confirmationCode: "AUD-1",
        counterpartyName: "Bank 1",
        status: "PREPARED",
        currentArtifactId: "artifact-1",
        queueClaimedBy: "officer-1",
        currentArtifact: { id: "artifact-1", disposition: "ACTIVE" },
      },
    });
    prisma.confirmationDispatchBatchItem.update.mockResolvedValue({
      status: "FAILED",
    });

    await (
      service as unknown as {
        executeItem: (...args: unknown[]) => Promise<unknown>;
      }
    ).executeItem("batch-1", "EMAIL", "item-1", officer, source);

    expect(prisma.confirmationDispatchBatchItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorCode: "CHANNEL_NOT_IMPLEMENTED" }),
      })
    );
  });
});
