import { ApiConflictException } from "../common/api-error";
import { ConfirmationResponseService } from "./confirmation-response.service";

const prisma = {
  $transaction: vi.fn(),
  projectConfirmation: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    deleteMany: vi.fn(),
  },
  projectConfirmationResponse: {
    create: vi.fn(),
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
    delete: vi.fn(),
  },
  confirmationDispatchEvent: { create: vi.fn() },
  confirmationFollowUpEvent: { create: vi.fn() },
  confirmationResponseArtifact: {
    findFirst: vi.fn(),
    createMany: vi.fn(),
  },
  confirmationResponseLibraryFile: { update: vi.fn() },
};
const access = {
  requireMutableProject: vi.fn(),
  requireProjectMember: vi.fn(),
};
const storage = {
  putConfirmationResponseArtifact: vi.fn(),
  deleteConfirmationResponseArtifact: vi.fn(),
  deleteObject: vi.fn(),
  getObjectBuffer: vi.fn(),
};
const auditLogs = { log: vi.fn() };
const sourceStateGuard = {
  assertCanInvalidateSource: vi.fn(),
};
const user = { id: "user-1", globalRole: "STAFF" } as never;
const source = { ipAddress: "127.0.0.1" } as never;
const file = {
  buffer: Buffer.from("%PDF-1.4 response"),
  mimetype: "application/pdf",
  originalname: "bank-response.pdf",
  size: 17,
};
const input = {
  responseChannel: "PAPER" as const,
  receivedAt: "2026-07-17T08:30:00.000Z",
  responseReference: "MAILROOM-42",
  notes: "Original response received by post",
};

function expectNoConfirmationStorageKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(expectNoConfirmationStorageKeys);
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    expect([
      "objectKey",
      "attachmentObjectKey",
      "docxObjectKey",
      "pdfObjectKey",
      "structuredSnapshot",
    ]).not.toContain(key);
    expectNoConfirmationStorageKeys(nested);
  }
}

describe(ConfirmationResponseService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      status: "AWAITING_RESPONSE",
      confirmationCode: "AUD-2026-001",
      responsibleUserId: "user-2",
      dispatches: [{ id: "dispatch-1" }],
    });
    prisma.projectConfirmation.findUniqueOrThrow.mockResolvedValue({
      id: "confirmation-1",
      status: "RESPONSE_RECEIVED",
      responses: [{ id: "response-1" }],
    });
    prisma.projectConfirmation.updateMany.mockResolvedValue({ count: 1 });
    prisma.projectConfirmationResponse.deleteMany.mockResolvedValue({
      count: 1,
    });
    storage.putConfirmationResponseArtifact.mockResolvedValue({
      objectKey:
        "confirmation-response-artifacts/response-1/artifact-1/response.pdf",
    });
  });

  it("sanitizes storage internals from a response mutation result recursively", async () => {
    prisma.projectConfirmation.findUniqueOrThrow.mockResolvedValue({
      id: "confirmation-1",
      currentArtifact: {
        docxObjectKey: "private/source.docx",
        pdfObjectKey: "private/preview.pdf",
        structuredSnapshot: { objectKey: "private/source.docx" },
      },
      responses: [
        {
          artifacts: [
            { objectKey: "private/response.pdf", fileName: "response.pdf" },
          ],
        },
      ],
    });

    const result = await new ConfirmationResponseService(
      prisma as never,
      access as never,
      storage as never,
      auditLogs as never,
      sourceStateGuard as never
    ).receive("project-1", "confirmation-1", input, [file], user, source);

    expect(result).toBeDefined();
    expectNoConfirmationStorageKeys(result);
  });

  it("stores and routes a scanned response without completing the confirmation program", async () => {
    const service = new ConfirmationResponseService(
      prisma as never,
      access as never,
      storage as never,
      auditLogs as never,
      sourceStateGuard as never
    );
    const result = await service.receive(
      "project-1",
      "confirmation-1",
      input,
      [file],
      user,
      source
    );

    expect(access.requireMutableProject).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(storage.putConfirmationResponseArtifact).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "pdf",
      file.buffer,
      file.mimetype
    );
    expect(prisma.projectConfirmationResponse.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        confirmationId: "confirmation-1",
        responseStatus: "RECEIVED",
        responseChannel: "PAPER",
        matchMethod: "MANUAL",
        routingStatus: "ROUTED",
        receivedBy: "user-1",
        attachmentName: "bank-response.pdf",
        artifacts: {
          create: [expect.objectContaining({ fileName: "bank-response.pdf" })],
        },
      }),
    });
    expect(prisma.confirmationDispatchEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dispatchId: "dispatch-1",
        eventType: "RECEIVED",
        actorId: "user-1",
        occurredAt: new Date(input.receivedAt),
      }),
    });
    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "confirmation-1",
        projectId: "project-1",
        status: "AWAITING_RESPONSE",
        queueClaimedBy: null,
        dispatches: {
          none: {
            executionStatus: { in: ["QUEUED", "STARTED"] },
          },
        },
      },
      data: {
        status: "RESPONSE_RECEIVED",
        differenceStatus: null,
      },
    });
    expect(prisma.confirmationFollowUpEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        confirmationId: "confirmation-1",
        eventType: "RESPONSE_RECEIVED",
        actorId: "user-1",
        source: "RESPONSE_INTAKE",
      }),
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_RESPONSE_RECEIVED",
        projectId: "project-1",
      })
    );
    expect(result).toStrictEqual(
      expect.objectContaining({
        id: "confirmation-1",
        status: "RESPONSE_RECEIVED",
      })
    );
  });

  it("allows only one concurrent receipt to claim the confirmation before creating a routed response", async () => {
    const service = new ConfirmationResponseService(
      prisma as never,
      access as never,
      storage as never,
      auditLogs as never,
      sourceStateGuard as never
    );
    let claims = 0;
    prisma.projectConfirmation.updateMany.mockImplementation(async () => {
      await Promise.resolve();
      claims += 1;
      return { count: claims === 1 ? 1 : 0 };
    });

    const results = await Promise.allSettled([
      service.receive(
        "project-1",
        "confirmation-1",
        input,
        [file],
        user,
        source
      ),
      service.receive(
        "project-1",
        "confirmation-1",
        input,
        [file],
        user,
        source
      ),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected")
    ).toHaveLength(1);
    expect(prisma.projectConfirmationResponse.create).toHaveBeenCalledOnce();
    expect(prisma.confirmationDispatchEvent.create).toHaveBeenCalledOnce();
    expect(prisma.confirmationFollowUpEvent.create).toHaveBeenCalledOnce();
  });

  it("lets the later transaction win while the earlier pre-read request loses before creating a routed response", async () => {
    const service = new ConfirmationResponseService(
      prisma as never,
      access as never,
      storage as never,
      auditLogs as never,
      sourceStateGuard as never
    );
    let claims = 0;
    let firstStorageStarted!: () => void;
    let releaseFirstStorage!: () => void;
    const firstStorageReady = new Promise<void>((resolve) => {
      firstStorageStarted = resolve;
    });
    const releaseStorage = new Promise<void>((resolve) => {
      releaseFirstStorage = resolve;
    });
    storage.putConfirmationResponseArtifact
      .mockImplementationOnce(async () => {
        firstStorageStarted();
        await releaseStorage;
        return { objectKey: "response-artifacts/first.pdf" };
      })
      .mockImplementation(async () => {
        await Promise.resolve();
        return {
          objectKey: "response-artifacts/second.pdf",
        };
      });
    prisma.projectConfirmation.updateMany.mockImplementation(async () => {
      await Promise.resolve();
      claims += 1;
      return { count: claims === 1 ? 1 : 0 };
    });

    const first = service.receive(
      "project-1",
      "confirmation-1",
      input,
      [file],
      user,
      source
    );
    await firstStorageReady;
    const second = service.receive(
      "project-1",
      "confirmation-1",
      input,
      [file],
      user,
      source
    );

    await expect(second).resolves.toStrictEqual(
      expect.objectContaining({ status: "RESPONSE_RECEIVED" })
    );
    releaseFirstStorage();
    await expect(first).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(prisma.projectConfirmationResponse.create).toHaveBeenCalledOnce();
    expect(prisma.confirmationDispatchEvent.create).toHaveBeenCalledOnce();
    expect(prisma.confirmationFollowUpEvent.create).toHaveBeenCalledOnce();
  });

  it("rejects receipt before the confirmation has been sent", async () => {
    const service = new ConfirmationResponseService(
      prisma as never,
      access as never,
      storage as never,
      auditLogs as never,
      sourceStateGuard as never
    );
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      status: "PREPARED",
      confirmationCode: "AUD-2026-001",
      responsibleUserId: "user-2",
      dispatches: [],
    });

    await expect(
      service.receive(
        "project-1",
        "confirmation-1",
        input,
        [file],
        user,
        source
      )
    ).rejects.toThrow("Only a sent confirmation can receive a response");
    expect(storage.putConfirmationResponseArtifact).not.toHaveBeenCalled();
  });

  it("lets confirmation officers receive centrally without project membership", async () => {
    const service = new ConfirmationResponseService(
      prisma as never,
      access as never,
      storage as never,
      auditLogs as never,
      sourceStateGuard as never
    );

    await service.receive(
      "project-1",
      "confirmation-1",
      input,
      [file],
      { id: "officer-1", globalRole: "CONFIRMATION_OFFICER" } as never,
      source
    );

    expect(access.requireMutableProject).not.toHaveBeenCalled();
  });

  it("downloads a response scan only after checking project access", async () => {
    const service = new ConfirmationResponseService(
      prisma as never,
      access as never,
      storage as never,
      auditLogs as never,
      sourceStateGuard as never
    );
    prisma.confirmationResponseArtifact.findFirst.mockResolvedValue({
      id: "artifact-1",
      objectKey: "confirmation-response-artifacts/r/a/response.pdf",
      fileName: "bank-response.pdf",
      mimeType: "application/pdf",
    });
    storage.getObjectBuffer.mockResolvedValue(Buffer.from("pdf"));

    await service.downloadArtifact(
      "project-1",
      "confirmation-1",
      "response-1",
      "artifact-1",
      user
    );

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "confirmation-response-artifacts/r/a/response.pdf"
    );
  });

  it("adds more files to an already recorded response", async () => {
    const service = new ConfirmationResponseService(
      prisma as never,
      access as never,
      storage as never,
      auditLogs as never,
      sourceStateGuard as never
    );
    prisma.projectConfirmationResponse.findFirst.mockResolvedValue({
      id: "response-1",
      confirmation: {
        status: "RESPONSE_RECEIVED",
        confirmationCode: "AUD-2026-001",
      },
      artifacts: [{ sequence: 1 }],
    });

    await service.addArtifacts(
      "project-1",
      "confirmation-1",
      "response-1",
      [file],
      user,
      source
    );

    expect(prisma.confirmationResponseArtifact.createMany).toHaveBeenCalledWith(
      {
        data: [
          expect.objectContaining({
            responseId: "response-1",
            sequence: 2,
            fileName: "bank-response.pdf",
          }),
        ],
      }
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_RESPONSE_ARTIFACTS_ADDED",
      })
    );
  });

  it("withdraws a recorded response and returns the confirmation to awaiting response", async () => {
    const service = new ConfirmationResponseService(
      prisma as never,
      access as never,
      storage as never,
      auditLogs as never,
      sourceStateGuard as never
    );
    prisma.projectConfirmationResponse.findFirst.mockResolvedValue({
      id: "response-1",
      confirmation: {
        status: "RESPONSE_RECEIVED",
        differenceStatus: null,
        confirmationCode: "AUD-2026-001",
        dispatches: [{ id: "dispatch-1" }],
        responses: [{ id: "response-1" }],
      },
      artifacts: [
        {
          objectKey:
            "confirmation-response-artifacts/response-1/artifact-1/response.pdf",
        },
      ],
      sourceLibraryFile: { id: "library-response-1" },
    });
    prisma.projectConfirmation.findUniqueOrThrow.mockResolvedValue({
      id: "confirmation-1",
      status: "AWAITING_RESPONSE",
      responses: [],
    });

    const result = await service.withdraw(
      "project-1",
      "confirmation-1",
      "response-1",
      user,
      source
    );

    expect(prisma.projectConfirmationResponse.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "response-1",
        confirmationId: "confirmation-1",
      },
    });
    expect(prisma.confirmationResponseLibraryFile.update).toHaveBeenCalledWith({
      where: { id: "library-response-1" },
      data: expect.objectContaining({
        confirmationId: null,
        matchedResponseId: null,
        routingStatus: "PENDING_MATCH",
      }),
    });
    expect(
      prisma.confirmationResponseLibraryFile.update.mock.invocationCallOrder[0]
    ).toBeLessThan(
      prisma.projectConfirmationResponse.deleteMany.mock.invocationCallOrder[0]
    );
    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "confirmation-1",
        status: "RESPONSE_RECEIVED",
        differenceStatus: null,
        responses: {
          some: { id: "response-1", routingStatus: "ROUTED" },
        },
      },
      data: {
        status: "AWAITING_RESPONSE",
        differenceStatus: null,
      },
    });
    expect(prisma.confirmationFollowUpEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        confirmationId: "confirmation-1",
        eventType: "RESPONSE_WITHDRAWN",
        actorId: "user-1",
        source: "RESPONSE_INTAKE",
      }),
    });
    expect(prisma.confirmationDispatchEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dispatchId: "dispatch-1",
        eventType: "VOIDED",
        actorId: "user-1",
      }),
    });
    expect(storage.deleteObject).toHaveBeenCalledWith(
      "confirmation-response-artifacts/response-1/artifact-1/response.pdf"
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_RESPONSE_WITHDRAWN",
        targetId: "response-1",
      })
    );
    expect(result).toStrictEqual(
      expect.objectContaining({
        id: "confirmation-1",
        status: "AWAITING_RESPONSE",
      })
    );
  });

  it.each([true, false])("withdraws a direct response without retaining its generated confirmation (marker matches: %s)", async (matchingMarker) => {
    prisma.projectConfirmationResponse.findFirst.mockResolvedValue({
      id: "response-1",
      confirmation: {
        status: "RESPONSE_RECEIVED", differenceStatus: null,
        confirmationCode: "AUTO-001", dispatches: [], responses: [{ id: "response-1" }],
        followUpEvents: [{ payload: { transition: "DIRECT_RESPONSE_CONFIRMATION", responseId: matchingMarker ? "response-1" : "other-response", responseLibraryFileId: "library-1" } }],
      },
      sourceLibraryFile: { id: "library-1" },
      artifacts: [{ objectKey: "copied-response.pdf" }],
    });
    prisma.projectConfirmation.deleteMany.mockResolvedValue({ count: 1 });
    const result = await new ConfirmationResponseService(prisma as never, access as never, storage as never, auditLogs as never, sourceStateGuard as never)
      .withdraw("project-1", "confirmation-1", "response-1", user, source);
    expect(prisma.confirmationResponseLibraryFile.update).toHaveBeenCalledWith({ where: { id: "library-1" }, data: expect.objectContaining({ routingStatus: "PENDING_MATCH", confirmationId: null, matchedResponseId: null }) });
    if (matchingMarker) {
      expect(result).toEqual({ deletedConfirmationId: "confirmation-1", responseLibraryFileId: "library-1" });
      expect(prisma.projectConfirmation.deleteMany).toHaveBeenCalledWith({ where: expect.objectContaining({ id: "confirmation-1", projectId: "project-1", dispatches: { none: {} }, responses: { none: {} } }) });
      expect(prisma.confirmationFollowUpEvent.create).not.toHaveBeenCalled();
    } else {
      expect(prisma.projectConfirmation.deleteMany).not.toHaveBeenCalled();
      expect(prisma.confirmationFollowUpEvent.create).toHaveBeenCalled();
    }
    expect(storage.deleteObject).toHaveBeenCalledExactlyOnceWith("copied-response.pdf");
  });

  it("blocks withdrawing a response while EMP still owns its source", async () => {
    const service = new ConfirmationResponseService(
      prisma as never,
      access as never,
      storage as never,
      auditLogs as never,
      sourceStateGuard as never
    );
    sourceStateGuard.assertCanInvalidateSource.mockRejectedValue(
      new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "来源状态受 EMP 导入保护：FLAT 导入 import-job-1（2026/Confirmation responses）。请先从 EMP 撤回该导入后，再撤回回函。"
      )
    );

    await expect(
      service.withdraw(
        "project-1",
        "confirmation-1",
        "response-1",
        user,
        source
      )
    ).rejects.toMatchObject({
      response: {
        code: "CONFIRMATION_STATE_CONFLICT",
        message: expect.stringContaining("先从 EMP 撤回"),
      },
    });
    expect(sourceStateGuard.assertCanInvalidateSource).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmationId: "confirmation-1",
        responseId: "response-1",
        projectId: "project-1",
        actorId: "user-1",
      }),
      "WITHDRAW_RESPONSE"
    );
    expect(prisma.projectConfirmationResponse.findFirst).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_SOURCE_STATE_BLOCKED",
        targetType: "PROJECT_CONFIRMATION_RESPONSE",
        targetId: "response-1",
        projectId: "project-1",
      })
    );
  });

  it("keeps response withdrawal blocked when blocked-attempt audit fails", async () => {
    const service = new ConfirmationResponseService(
      prisma as never,
      access as never,
      storage as never,
      auditLogs as never,
      sourceStateGuard as never
    );
    sourceStateGuard.assertCanInvalidateSource.mockRejectedValue(
      new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "来源状态受 EMP 导入保护：FLAT 导入 import-job-1（EMP/WP-001）。请先从 EMP 撤回该导入后，再撤回回函。"
      )
    );
    auditLogs.log.mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(
      service.withdraw(
        "project-1",
        "confirmation-1",
        "response-1",
        user,
        source
      )
    ).rejects.toMatchObject({
      response: {
        code: "CONFIRMATION_STATE_CONFLICT",
        message: expect.stringContaining("请先从 EMP 撤回"),
      },
    });
    expect(prisma.projectConfirmationResponse.findFirst).not.toHaveBeenCalled();
  });

  it("does not delete or emit events when withdrawal loses the confirmation state race", async () => {
    const service = new ConfirmationResponseService(
      prisma as never,
      access as never,
      storage as never,
      auditLogs as never,
      sourceStateGuard as never
    );
    prisma.projectConfirmationResponse.findFirst.mockResolvedValue({
      id: "response-1",
      confirmation: {
        status: "RESPONSE_RECEIVED",
        differenceStatus: null,
        confirmationCode: "AUD-2026-001",
        dispatches: [{ id: "dispatch-1" }],
        responses: [{ id: "response-1" }],
      },
      artifacts: [],
    });
    prisma.projectConfirmation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.withdraw(
        "project-1",
        "confirmation-1",
        "response-1",
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(
      prisma.projectConfirmationResponse.deleteMany
    ).not.toHaveBeenCalled();
    expect(prisma.confirmationDispatchEvent.create).not.toHaveBeenCalled();
    expect(prisma.confirmationFollowUpEvent.create).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_SOURCE_STATE_BLOCKED",
        targetType: "PROJECT_CONFIRMATION_RESPONSE",
        targetId: "response-1",
        projectId: "project-1",
      })
    );
  });

  it("rolls back the guarded withdrawal when the response delete guard loses", async () => {
    const service = new ConfirmationResponseService(
      prisma as never,
      access as never,
      storage as never,
      auditLogs as never,
      sourceStateGuard as never
    );
    prisma.projectConfirmationResponse.findFirst.mockResolvedValue({
      id: "response-1",
      confirmation: {
        status: "RESPONSE_RECEIVED",
        differenceStatus: null,
        confirmationCode: "AUD-2026-001",
        dispatches: [{ id: "dispatch-1" }],
        responses: [{ id: "response-1" }],
      },
      artifacts: [],
    });
    prisma.projectConfirmation.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.projectConfirmationResponse.deleteMany.mockResolvedValueOnce({
      count: 0,
    });

    await expect(
      service.withdraw(
        "project-1",
        "confirmation-1",
        "response-1",
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(prisma.confirmationDispatchEvent.create).not.toHaveBeenCalled();
    expect(prisma.confirmationFollowUpEvent.create).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_SOURCE_STATE_BLOCKED",
        targetType: "PROJECT_CONFIRMATION_RESPONSE",
        targetId: "response-1",
        projectId: "project-1",
      })
    );
  });
});
