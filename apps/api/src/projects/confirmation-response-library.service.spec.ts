import JSZip from "jszip";

import {
  ApiBadRequestException,
  ApiConflictException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import { ConfirmationResponseLibraryService } from "./confirmation-response-library.service";

const transaction = {
  confirmationResponseLibraryFile: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  projectConfirmation: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  projectConfirmationResponse: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  confirmationEmpImportItem: { updateMany: vi.fn(), findMany: vi.fn() },
  projectConfirmationDispatch: { findFirst: vi.fn() },
  confirmationDispatchEvent: { create: vi.fn() },
  confirmationFollowUpEvent: { create: vi.fn() },
};
const prisma = {
  $transaction: vi.fn(),
  confirmationResponseLibraryFile: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  projectConfirmation: { findFirst: vi.fn() },
  confirmationEmpImportItem: { findMany: vi.fn() },
  project: { findUnique: vi.fn() },
};
const storage = {
  deleteObject: vi.fn(),
  getDownloadObject: vi.fn(),
  getObjectBuffer: vi.fn(),
  putConfirmationResponseLibraryFile: vi.fn(),
  putConfirmationResponseArtifactFile: vi.fn(),
};
const auditLogs = {
  log: vi.fn(),
  logInTransaction: vi.fn(),
};
const access = {
  requireProjectMember: vi.fn(),
  requireMutableProject: vi.fn(),
};
const confirmationCodes = {
  allocateInTransaction: vi.fn(),
};
const empImportWithdrawal = {
  withdraw: vi.fn(),
};
const user = { id: "staff-1", globalRole: "STAFF" } as never;
const confirmationOfficer = {
  id: "confirmation-officer-1",
  globalRole: "CONFIRMATION_OFFICER",
} as never;
const source = { ipAddress: "127.0.0.1" };
let validXlsx: Buffer;

function createService() {
  return new ConfirmationResponseLibraryService(
    prisma as never,
    storage as never,
    auditLogs as never,
    access as never,
    confirmationCodes as never,
    empImportWithdrawal as never
  );
}

describe(ConfirmationResponseLibraryService, () => {
  beforeAll(async () => {
    const archive = new JSZip();
    archive.file("[Content_Types].xml", "<Types />");
    archive.folder("xl")?.file("workbook.xml", "<workbook />");
    validXlsx = await archive.generateAsync({ type: "nodebuffer" });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => unknown) => {
        await Promise.resolve();
        return callback(transaction);
      }
    );
    storage.putConfirmationResponseLibraryFile.mockResolvedValue({
      objectKey: "confirmation-response-library/register.xlsx",
    });
    storage.deleteObject.mockResolvedValue(undefined as never);
    transaction.confirmationResponseLibraryFile.create.mockResolvedValue({
      id: "response-1",
      code: "CRSP-123456789ABC",
      title: "Response register",
    });
    transaction.confirmationResponseLibraryFile.updateMany.mockResolvedValue({
      count: 1,
    });
    transaction.projectConfirmation.updateMany.mockResolvedValue({ count: 1 });
    transaction.projectConfirmationResponse.updateMany.mockResolvedValue({
      count: 1,
    });
    transaction.projectConfirmationResponse.deleteMany.mockResolvedValue({
      count: 1,
    });
    transaction.confirmationEmpImportItem.updateMany.mockResolvedValue({
      count: 0,
    });
    prisma.confirmationEmpImportItem.findMany.mockResolvedValue([]);
    empImportWithdrawal.withdraw.mockResolvedValue(undefined);
    transaction.confirmationFollowUpEvent.create.mockResolvedValue(undefined);
    confirmationCodes.allocateInTransaction.mockResolvedValue({
      confirmationCode: "AUD-2026-YH-001",
      sequence: 1,
    });
    auditLogs.logInTransaction.mockResolvedValue(undefined);
  });

  it("allows a confirmation officer to upload a verified spreadsheet to the global warehouse", async () => {
    const result = await createService().upload(
      {
        title: " Response register ",
        receivedAt: new Date("2026-08-01T00:00:00.000Z"),
        courierTrackingNumber: " SF123456 ",
        referenceNumber: " REF-001 ",
        clientName: " Example Client ",
        respondingEntity: " Example Bank ",
        notes: " Original received ",
      },
      {
        buffer: validXlsx,
        mimetype: "application/octet-stream",
        originalname: "register.xlsx",
        size: validXlsx.length,
      },
      confirmationOfficer,
      source
    );

    expect(storage.putConfirmationResponseLibraryFile).toHaveBeenCalledWith(
      "register.xlsx",
      validXlsx,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(
      transaction.confirmationResponseLibraryFile.create
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Response register",
          receivedAt: new Date("2026-08-01T00:00:00.000Z"),
          courierTrackingNumber: "SF123456",
          referenceNumber: "REF-001",
          clientName: "Example Client",
          respondingEntity: "Example Bank",
          notes: "Original received",
          uploadedById: "confirmation-officer-1",
        }),
        include: expect.objectContaining({
          uploader: { select: { id: true, name: true } },
        }),
      })
    );
    expect(auditLogs.logInTransaction).toHaveBeenCalledOnce();
    expect(result).toStrictEqual(
      expect.objectContaining({ id: "response-1", title: "Response register" })
    );
  });

  it("rejects a regular user's upload to the global warehouse", async () => {
    await expect(
      createService().upload(
        {
          title: "Response register",
          receivedAt: new Date("2026-08-01T00:00:00.000Z"),
          clientName: "Example Client",
          respondingEntity: "Example Bank",
        },
        {
          buffer: validXlsx,
          mimetype: "application/octet-stream",
          originalname: "register.xlsx",
          size: validXlsx.length,
        },
        user,
        source
      )
    ).rejects.toBeInstanceOf(ApiForbiddenException);

    expect(storage.putConfirmationResponseLibraryFile).not.toHaveBeenCalled();
  });

  it("uploads directly into the current project's pending-match warehouse", async () => {
    await createService().upload(
      {
        projectId: "project-1",
        title: "Project response register",
        receivedAt: new Date("2026-08-01T00:00:00.000Z"),
        clientName: "Example Client",
        respondingEntity: "Example Bank",
      },
      {
        buffer: validXlsx,
        mimetype: "application/octet-stream",
        originalname: "response.xlsx",
        size: validXlsx.length,
      },
      user,
      source
    );

    expect(access.requireMutableProject).toHaveBeenCalledWith(
      "project-1",
      "staff-1"
    );
    expect(
      transaction.confirmationResponseLibraryFile.create
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          routingStatus: "PENDING_MATCH",
          routedById: "staff-1",
          routedAt: expect.any(Date),
        }),
      })
    );
  });

  it("rejects an extension-spoofed spreadsheet before storage", async () => {
    await expect(
      createService().upload(
        {
          title: "Spoofed response",
          receivedAt: new Date("2026-08-01T00:00:00.000Z"),
          clientName: "Example Client",
          respondingEntity: "Example Bank",
        },
        {
          buffer: Buffer.from("not an xlsx"),
          mimetype: "application/octet-stream",
          originalname: "response.xlsx",
          size: 11,
        },
        confirmationOfficer,
        source
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);

    expect(storage.putConfirmationResponseLibraryFile).not.toHaveBeenCalled();
  });

  it("returns uploader identity for the shared warehouse", async () => {
    prisma.confirmationResponseLibraryFile.findMany.mockResolvedValue([]);

    await createService().list();

    expect(
      prisma.confirmationResponseLibraryFile.findMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          uploader: { select: { id: true, name: true } },
        }),
        orderBy: [
          { receivedAt: "desc" },
          { updatedAt: "desc" },
          { title: "asc" },
        ],
      })
    );
  });

  it("returns pending and matched responses for a project's response warehouse", async () => {
    prisma.confirmationResponseLibraryFile.findMany.mockResolvedValue([]);

    await createService().listForProject("project-1", user);

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "staff-1"
    );
    expect(
      prisma.confirmationResponseLibraryFile.findMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: "project-1",
          routingStatus: {
            in: ["PENDING_MATCH", "NO_SOURCE_REQUEST", "MATCHED"],
          },
        },
        include: expect.objectContaining({
          confirmation: {
            select: expect.objectContaining({ differenceStatus: true }),
          },
        }),
      })
    );
  });

  it("clears the current claimant when a project response is returned", async () => {
    const existing = {
      id: "response-claimed",
      code: "CRSP-CLAIMED",
      projectId: "project-1",
      confirmationId: null,
      matchedResponseId: null,
      routingStatus: "PENDING_MATCH",
      updatedAt: new Date("2026-08-03T08:00:00.000Z"),
    };
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue(
      existing
    );
    transaction.confirmationResponseLibraryFile.update.mockResolvedValue({
      ...existing,
      projectId: null,
      routingStatus: "UNASSIGNED_PROJECT",
      routedById: null,
      routedAt: null,
    });

    await createService().route(
      "response-claimed",
      { action: "UNASSIGN_PROJECT" },
      user,
      source
    );

    expect(
      transaction.confirmationResponseLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: null,
          routingStatus: "UNASSIGNED_PROJECT",
          routedById: null,
          routedAt: null,
        }),
      })
    );
  });

  it("returns a matched response and reopens its confirmation with an audit trail", async () => {
    const updatedAt = new Date("2026-08-03T08:00:00.000Z");
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-matched",
      code: "CRSP-MATCHED",
      projectId: "project-1",
      confirmationId: "confirmation-1",
      matchedResponseId: "project-response-1",
      routingStatus: "MATCHED",
      updatedAt,
      notes: "returned for correction",
    });
    transaction.projectConfirmationResponse.findUnique.mockResolvedValue({
      id: "project-response-1",
      confirmationId: "confirmation-1",
      responseStatus: "RECEIVED",
      routingStatus: "ROUTED",
      artifacts: [],
    });
    transaction.projectConfirmation.findUnique.mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      status: "RESPONSE_RECEIVED",
      differenceStatus: null,
      counterpartyName: "Example Bank",
      responses: [{ id: "project-response-1" }],
    });
    transaction.projectConfirmationDispatch.findFirst.mockResolvedValue({
      id: "dispatch-1",
    });
    transaction.confirmationResponseLibraryFile.update.mockResolvedValue({
      id: "response-matched",
      projectId: null,
      confirmationId: null,
      matchedResponseId: null,
      routingStatus: "UNASSIGNED_PROJECT",
    });

    await createService().route(
      "response-matched",
      { action: "UNASSIGN_PROJECT" },
      user,
      source
    );

    expect(access.requireMutableProject).toHaveBeenCalledWith(
      "project-1",
      "staff-1"
    );
    expect(transaction.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "confirmation-1",
          status: "RESPONSE_RECEIVED",
        }),
        data: { status: "AWAITING_RESPONSE", differenceStatus: null },
      })
    );
    expect(
      transaction.projectConfirmationResponse.updateMany
    ).not.toHaveBeenCalled();
    expect(
      transaction.projectConfirmationResponse.deleteMany
    ).toHaveBeenCalledWith({
      where: { id: "project-response-1", confirmationId: "confirmation-1" },
    });
    expect(transaction.confirmationDispatchEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dispatchId: "dispatch-1",
          eventType: "VOIDED",
          actorId: "staff-1",
          source: "RESPONSE_INTAKE",
          payload: expect.objectContaining({
            responseId: "project-response-1",
            responseLibraryFileId: "response-matched",
            transition: "RESPONSE_WITHDRAWN",
          }),
          occurredAt: expect.any(Date),
        }),
      })
    );
    expect(transaction.confirmationFollowUpEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "RESPONSE_WITHDRAWN",
          confirmationId: "confirmation-1",
          actorId: "staff-1",
          source: "RESPONSE_INTAKE",
          payload: expect.objectContaining({
            responseId: "project-response-1",
            responseLibraryFileId: "response-matched",
            previous: { status: "RESPONSE_RECEIVED", differenceStatus: null },
            next: { status: "AWAITING_RESPONSE", differenceStatus: null },
          }),
          occurredAt: expect.any(Date),
        }),
      })
    );
    expect(
      transaction.confirmationResponseLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "response-matched" },
        data: expect.objectContaining({
          projectId: null,
          confirmationId: null,
          matchedResponseId: null,
          routingStatus: "UNASSIGNED_PROJECT",
        }),
      })
    );
    expect(auditLogs.logInTransaction).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        action: "CONFIRMATION_RESPONSE_LIBRARY_FILE_RETURNED",
        projectId: "project-1",
      })
    );
  });

  it("withdraws an imported response before returning the matched response", async () => {
    const updatedAt = new Date("2026-08-03T08:00:00.000Z");
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-archived",
      code: "CRSP-ARCHIVED",
      projectId: "project-1",
      confirmationId: "confirmation-1",
      matchedResponseId: "project-response-1",
      routingStatus: "MATCHED",
      updatedAt,
    });
    prisma.confirmationEmpImportItem.findMany.mockResolvedValue([
      { jobId: "import-job-1" },
    ]);
    transaction.projectConfirmationResponse.findUnique.mockResolvedValue({
      id: "project-response-1",
      confirmationId: "confirmation-1",
      responseStatus: "RECEIVED",
      routingStatus: "ROUTED",
      artifacts: [{ id: "response-artifact-1" }],
    });
    transaction.projectConfirmation.findUnique.mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      status: "RESPONSE_RECEIVED",
      differenceStatus: null,
      counterpartyName: "Example Bank",
      responses: [{ id: "project-response-1" }],
    });
    transaction.projectConfirmationDispatch.findFirst.mockResolvedValue({
      id: "dispatch-1",
    });
    transaction.confirmationResponseLibraryFile.update.mockResolvedValue({
      id: "response-archived",
      projectId: null,
      confirmationId: null,
      matchedResponseId: null,
      routingStatus: "UNASSIGNED_PROJECT",
    });

    await createService().route(
      "response-archived",
      { action: "UNASSIGN_PROJECT" },
      user,
      source
    );

    expect(empImportWithdrawal.withdraw).toHaveBeenCalledWith(
      "project-1",
      "import-job-1",
      "confirmation-1",
      user,
      source,
      expect.stringContaining("Returned matched response CRSP-ARCHIVED"),
      true
    );
    expect(
      transaction.confirmationEmpImportItem.updateMany
    ).toHaveBeenCalledWith({
      where: {
        OR: [
          { responseId: "project-response-1" },
          { responseArtifactId: { in: ["response-artifact-1"] } },
        ],
      },
      data: { responseId: null, responseArtifactId: null },
    });
    expect(
      transaction.projectConfirmationResponse.deleteMany
    ).toHaveBeenCalledWith({
      where: { id: "project-response-1", confirmationId: "confirmation-1" },
    });
  });

  it("retracts a completed matched review before returning the response", async () => {
    const updatedAt = new Date("2026-08-03T08:00:00.000Z");
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-closed",
      code: "CRSP-CLOSED",
      projectId: "project-1",
      confirmationId: "confirmation-1",
      matchedResponseId: "project-response-1",
      routingStatus: "MATCHED",
      updatedAt,
    });
    transaction.projectConfirmationResponse.findUnique.mockResolvedValue({
      id: "project-response-1",
      confirmationId: "confirmation-1",
      routingStatus: "ROUTED",
      artifacts: [],
    });
    transaction.projectConfirmation.findUnique.mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      status: "CLOSED",
      differenceStatus: "MATCHED",
      responses: [{ id: "project-response-1" }],
    });
    transaction.confirmationResponseLibraryFile.update.mockResolvedValue({
      id: "response-closed",
      projectId: null,
      confirmationId: null,
      matchedResponseId: null,
      routingStatus: "UNASSIGNED_PROJECT",
    });

    await createService().route(
      "response-closed",
      { action: "UNASSIGN_PROJECT" },
      user,
      source
    );

    expect(transaction.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "CLOSED",
          differenceStatus: "MATCHED",
        }),
        data: { status: "AWAITING_RESPONSE", differenceStatus: null },
      })
    );
    expect(transaction.confirmationFollowUpEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "RESPONSE_WITHDRAWN",
          payload: expect.objectContaining({
            previous: { status: "CLOSED", differenceStatus: "MATCHED" },
            next: { status: "AWAITING_RESPONSE", differenceStatus: null },
          }),
        }),
      })
    );
  });

  it("directly unassigns a no-source response without touching a project confirmation", async () => {
    const existing = {
      id: "response-no-source",
      code: "CRSP-NO-SOURCE",
      projectId: "project-1",
      confirmationId: null,
      matchedResponseId: null,
      routingStatus: "NO_SOURCE_REQUEST",
      updatedAt: new Date("2026-08-03T08:00:00.000Z"),
    };
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue(
      existing
    );
    transaction.confirmationResponseLibraryFile.update.mockResolvedValue({
      ...existing,
      projectId: null,
      routingStatus: "UNASSIGNED_PROJECT",
    });

    await createService().route(
      "response-no-source",
      { action: "UNASSIGN_PROJECT" },
      user,
      source
    );

    expect(
      transaction.confirmationResponseLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: null,
          confirmationId: null,
          matchedResponseId: null,
          routingStatus: "UNASSIGNED_PROJECT",
        }),
      })
    );
    expect(transaction.projectConfirmation.findUnique).not.toHaveBeenCalled();
    expect(
      transaction.projectConfirmationResponse.deleteMany
    ).not.toHaveBeenCalled();
  });

  it("rejects a matched response when its project is not mutable", async () => {
    const existing = {
      id: "response-immutable",
      code: "CRSP-IMMUTABLE",
      projectId: "project-1",
      confirmationId: "confirmation-1",
      matchedResponseId: "project-response-1",
      routingStatus: "MATCHED",
      updatedAt: new Date("2026-08-03T08:00:00.000Z"),
    };
    const denied = new ApiConflictException(
      "CONFIRMATION_STATE_CONFLICT",
      "Project is not mutable"
    );
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue(
      existing
    );
    access.requireMutableProject.mockRejectedValueOnce(denied);

    await expect(
      createService().route(
        "response-immutable",
        { action: "UNASSIGN_PROJECT" },
        user,
        source
      )
    ).rejects.toBe(denied);

    expect(access.requireMutableProject).toHaveBeenCalledWith(
      "project-1",
      "staff-1"
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(
      transaction.projectConfirmationResponse.deleteMany
    ).not.toHaveBeenCalled();
    expect(
      transaction.confirmationResponseLibraryFile.update
    ).not.toHaveBeenCalled();
  });

  it.each([
    {
      projectId: null,
      confirmationId: "confirmation-1",
      matchedResponseId: "project-response-1",
    },
    {
      projectId: "project-1",
      confirmationId: null,
      matchedResponseId: "project-response-1",
    },
    {
      projectId: "project-1",
      confirmationId: "confirmation-1",
      matchedResponseId: null,
    },
  ])("rejects a matched response with an incomplete link %#", async (links) => {
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-incomplete",
      code: "CRSP-INCOMPLETE",
      ...links,
      routingStatus: "MATCHED",
      updatedAt: new Date("2026-08-03T08:00:00.000Z"),
    });

    await expect(
      createService().route(
        "response-incomplete",
        { action: "UNASSIGN_PROJECT" },
        user,
        source
      )
    ).rejects.toBeInstanceOf(ApiConflictException);

    expect(access.requireMutableProject).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a matched response whose library version is stale before deleting the project response", async () => {
    const updatedAt = new Date("2026-08-03T08:00:00.000Z");
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-stale",
      code: "CRSP-STALE",
      projectId: "project-1",
      confirmationId: "confirmation-1",
      matchedResponseId: "project-response-1",
      routingStatus: "MATCHED",
      updatedAt,
    });
    transaction.confirmationResponseLibraryFile.updateMany.mockResolvedValueOnce(
      { count: 0 }
    );

    await expect(
      createService().route(
        "response-stale",
        { action: "UNASSIGN_PROJECT" },
        user,
        source
      )
    ).rejects.toBeInstanceOf(ApiConflictException);

    expect(
      transaction.confirmationResponseLibraryFile.updateMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "response-stale",
          updatedAt,
          routingStatus: "MATCHED",
          matchedResponseId: "project-response-1",
        }),
      })
    );
    expect(
      transaction.projectConfirmationResponse.deleteMany
    ).not.toHaveBeenCalled();
    expect(transaction.confirmationDispatchEvent.create).not.toHaveBeenCalled();
    expect(transaction.confirmationFollowUpEvent.create).not.toHaveBeenCalled();
    expect(
      transaction.confirmationResponseLibraryFile.update
    ).not.toHaveBeenCalled();
  });

  it("does not clean the source library file when the matched-return transaction fails", async () => {
    const updatedAt = new Date("2026-08-03T08:00:00.000Z");
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-transaction-failure",
      code: "CRSP-TRANSACTION-FAILURE",
      projectId: "project-1",
      confirmationId: "confirmation-1",
      matchedResponseId: "project-response-1",
      routingStatus: "MATCHED",
      updatedAt,
      objectKey: "confirmation-response-library/original.pdf",
    });
    transaction.projectConfirmationResponse.findUnique.mockResolvedValue({
      id: "project-response-1",
      confirmationId: "confirmation-1",
      routingStatus: "ROUTED",
      artifacts: [],
    });
    transaction.projectConfirmation.findUnique.mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      status: "RESPONSE_RECEIVED",
      differenceStatus: null,
      responses: [{ id: "project-response-1" }],
    });
    transaction.projectConfirmationDispatch.findFirst.mockResolvedValue({
      id: "dispatch-1",
    });
    transaction.projectConfirmationResponse.deleteMany.mockRejectedValueOnce(
      new Error("transaction failed")
    );

    await expect(
      createService().route(
        "response-transaction-failure",
        { action: "UNASSIGN_PROJECT" },
        user,
        source
      )
    ).rejects.toThrow("transaction failed");

    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(
      transaction.confirmationResponseLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "response-transaction-failure" },
        data: expect.objectContaining({
          matchedResponseId: null,
          routingStatus: "UNASSIGNED_PROJECT",
        }),
      })
    );
    expect(transaction.confirmationDispatchEvent.create).not.toHaveBeenCalled();
  });

  it("lets confirmation officers read a project's response warehouse", async () => {
    prisma.confirmationResponseLibraryFile.findMany.mockResolvedValue([]);

    await expect(
      createService().listForProject("project-1", confirmationOfficer)
    ).resolves.toStrictEqual([]);
    await expect(
      createService().listPendingForProject("project-1", confirmationOfficer)
    ).resolves.toStrictEqual([]);

    expect(access.requireProjectMember).not.toHaveBeenCalled();
  });

  it("rejects project response downloads before audit or storage for non-members", async () => {
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-project",
      code: "CRSP-PROJECT",
      projectId: "project-2",
      objectKey: "confirmation-response-library/project-response.pdf",
      fileName: "project-response.pdf",
      mimeType: "application/pdf",
    });
    const denied = new ApiNotFoundException(
      "PROJECT_NOT_FOUND",
      "Project does not exist or you do not have access"
    );
    access.requireProjectMember.mockRejectedValue(denied);

    await expect(
      createService().download("response-project", user, source)
    ).rejects.toBe(denied);

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-2",
      "staff-1"
    );
    expect(auditLogs.log).not.toHaveBeenCalled();
    expect(storage.getDownloadObject).not.toHaveBeenCalled();
  });

  it("rejects project response previews before storage for non-members", async () => {
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-project",
      projectId: "project-2",
      objectKey: "confirmation-response-library/project-response.pdf",
    });
    const denied = new ApiNotFoundException(
      "PROJECT_NOT_FOUND",
      "Project does not exist or you do not have access"
    );
    access.requireProjectMember.mockRejectedValue(denied);

    const service = createService();
    await expect(service.preview("response-project", user)).rejects.toBe(
      denied
    );

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-2",
      "staff-1"
    );
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
  });

  it("keeps global intake response previews available without project membership", async () => {
    const body = Buffer.from("%PDF-global");
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-global",
      projectId: null,
      objectKey: "confirmation-response-library/global-response.pdf",
    });
    storage.getObjectBuffer.mockResolvedValue(body);

    const service = createService();
    await expect(
      service.preview("response-global", user)
    ).resolves.toStrictEqual({
      response: expect.objectContaining({
        id: "response-global",
        projectId: null,
      }),
      body,
    });

    expect(access.requireProjectMember).not.toHaveBeenCalled();
    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "confirmation-response-library/global-response.pdf"
    );
  });

  it("keeps global intake response downloads available without project membership", async () => {
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-global",
      code: "CRSP-GLOBAL",
      projectId: null,
      objectKey: "confirmation-response-library/global-response.pdf",
      fileName: "global-response.pdf",
      mimeType: "application/pdf",
    });
    const file = {
      absolutePath: "C:/project-wing/uploads/global-response.pdf",
      fileName: "global-response.pdf",
      mimeType: "application/pdf",
    };
    storage.getDownloadObject.mockReturnValue(file);
    auditLogs.log.mockImplementation(async () => {
      await Promise.resolve();
      expect(storage.getDownloadObject).not.toHaveBeenCalled();
    });

    await expect(
      createService().download("response-global", user, source)
    ).resolves.toStrictEqual({
      response: expect.objectContaining({
        id: "response-global",
        projectId: null,
      }),
      file,
    });

    expect(access.requireProjectMember).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "staff-1",
        action: "CONFIRMATION_RESPONSE_LIBRARY_FILE_DOWNLOADED",
        targetId: "response-global",
        source,
      })
    );
    expect(storage.getDownloadObject).toHaveBeenCalledWith(
      "confirmation-response-library/global-response.pdf",
      "global-response.pdf",
      "application/pdf"
    );
  });

  it("routes an unidentified response into a project's pending-match queue", async () => {
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-1",
      code: "CRSP-001",
      projectId: null,
      routingStatus: "UNASSIGNED_PROJECT",
      updatedAt: new Date("2026-08-03T08:00:00.000Z"),
    });
    transaction.confirmationResponseLibraryFile.update.mockResolvedValue({
      id: "response-1",
      code: "CRSP-001",
      projectId: "project-1",
      routingStatus: "PENDING_MATCH",
    });

    await createService().route(
      "response-1",
      {
        action: "PENDING_MATCH",
        projectId: "project-1",
        provisionalType: "BANK",
      },
      user,
      source
    );

    expect(access.requireMutableProject).toHaveBeenCalledWith(
      "project-1",
      "staff-1"
    );
    expect(
      transaction.confirmationResponseLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "response-1" },
        data: expect.objectContaining({
          projectId: "project-1",
          provisionalType: "BANK",
          routingStatus: "PENDING_MATCH",
        }),
      })
    );
    expect(auditLogs.logInTransaction).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ projectId: "project-1" })
    );
  });

  it("requires source-project permission before moving a pending response", async () => {
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-1",
      code: "CRSP-001",
      projectId: "project-a",
      routingStatus: "PENDING_MATCH",
      updatedAt: new Date("2026-08-03T08:00:00.000Z"),
    });

    await createService().route(
      "response-1",
      { action: "PENDING_MATCH", projectId: "project-b" },
      user,
      source
    );

    expect(access.requireMutableProject).toHaveBeenNthCalledWith(
      1,
      "project-a",
      "staff-1"
    );
    expect(access.requireMutableProject).toHaveBeenNthCalledWith(
      2,
      "project-b",
      "staff-1"
    );
  });

  it("atomically matches one warehouse response to one awaiting confirmation", async () => {
    const matchingStartedAt = Date.now();
    const updatedAt = new Date("2026-08-03T08:00:00.000Z");
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-1",
      code: "CRSP-001",
      projectId: null,
      routingStatus: "UNASSIGNED_PROJECT",
      matchedResponseId: null,
      updatedAt,
      objectKey: "confirmation-response-library/response.pdf",
      fileName: "response.pdf",
      mimeType: "application/pdf",
      uploadedById: "staff-1",
      receivedAt: new Date("2026-08-01T08:00:00.000Z"),
      referenceNumber: "REF-001",
      notes: null,
    });
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      status: "AWAITING_RESPONSE",
      type: "BANK",
      confirmationCode: "AUD-2026-YH-001",
      responsibleUserId: "staff-2",
      dispatches: [{ id: "dispatch-1" }],
    });
    storage.getObjectBuffer.mockResolvedValue(Buffer.from("%PDF-1.4 response"));
    storage.putConfirmationResponseArtifactFile.mockResolvedValue({
      objectKey:
        "confirmation-response-artifacts/response-1/artifact-1/response.pdf",
    });
    transaction.confirmationResponseLibraryFile.update.mockResolvedValue({
      id: "response-1",
      code: "CRSP-001",
      projectId: "project-1",
      routingStatus: "MATCHED",
    });

    await createService().route(
      "response-1",
      {
        action: "MATCH_CONFIRMATION",
        projectId: "project-1",
        confirmationId: "confirmation-1",
      },
      user,
      source
    );

    expect(
      transaction.confirmationResponseLibraryFile.updateMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "response-1", updatedAt }),
      })
    );
    expect(transaction.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "confirmation-1",
          status: "AWAITING_RESPONSE",
          responses: {
            none: { responseStatus: "RECEIVED", routingStatus: "ROUTED" },
          },
        }),
      })
    );
    expect(
      transaction.projectConfirmationResponse.create
    ).toHaveBeenCalledOnce();
    expect(
      transaction.confirmationResponseLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          confirmationId: "confirmation-1",
          routingStatus: "MATCHED",
        }),
      })
    );
    expect(transaction.confirmationDispatchEvent.create).not.toHaveBeenCalled();
    const event = transaction.projectConfirmation.update.mock.calls[0][0].data.followUpEvents.create;
    expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(matchingStartedAt);
    expect(event.occurredAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(transaction.projectConfirmationResponse.create.mock.calls[0][0].data.receivedAt)
      .toEqual(new Date("2026-08-01T08:00:00.000Z"));
  });

  it("creates a direct-response confirmation when no outgoing request exists", async () => {
    const updatedAt = new Date("2026-08-03T08:00:00.000Z");
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-direct",
      code: "CRSP-DIRECT",
      projectId: "project-1",
      routingStatus: "PENDING_MATCH",
      matchedResponseId: null,
      updatedAt,
      objectKey: "confirmation-response-library/direct.pdf",
      fileName: "direct.pdf",
      mimeType: "application/pdf",
      uploadedById: "staff-1",
      receivedAt: new Date("2026-08-01T08:00:00.000Z"),
      referenceNumber: "REF-DIRECT-001",
      clientName: "Example Client",
      respondingEntity: "Example Bank",
      notes: "direct response",
    });
    prisma.project.findUnique.mockResolvedValue({
      projectCode: "AUD-2026",
    });
    storage.getObjectBuffer.mockResolvedValue(Buffer.from("%PDF-1.4 response"));
    storage.putConfirmationResponseArtifactFile.mockResolvedValue({
      objectKey:
        "confirmation-response-artifacts/response-direct/artifact-1/direct.pdf",
    });
    transaction.projectConfirmation.create.mockResolvedValue({
      id: "confirmation-direct",
      confirmationCode: "AUD-2026-YH-001",
      counterpartyName: "Example Bank",
    });
    transaction.confirmationResponseLibraryFile.update.mockResolvedValue({
      id: "response-direct",
      projectId: "project-1",
      confirmationId: "confirmation-direct",
      matchedResponseId: "response-record-direct",
      routingStatus: "MATCHED",
    });

    await createService().route(
      "response-direct",
      {
        action: "NO_SOURCE_REQUEST",
        projectId: "project-1",
        provisionalType: "BANK",
      },
      user,
      source
    );

    expect(transaction.projectConfirmation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "BANK",
          status: "RESPONSE_RECEIVED",
          confirmationCode: "AUD-2026-YH-001",
          displayName: "无需发函 · Example Bank",
        }),
      })
    );
    expect(transaction.projectConfirmationResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          confirmationId: "confirmation-direct",
          responseStatus: "RECEIVED",
          responseChannel: "OTHER",
          routingStatus: "ROUTED",
          responseReference: "REF-DIRECT-001",
        }),
      })
    );
    expect(transaction.projectConfirmation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          followUpEvents: expect.objectContaining({
            create: expect.objectContaining({ eventType: "RESPONSE_RECEIVED" }),
          }),
        }),
      })
    );
    expect(
      transaction.projectConfirmationDispatch.findFirst
    ).not.toHaveBeenCalled();
    expect(
      transaction.confirmationResponseLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          confirmationId: "confirmation-direct",
          routingStatus: "MATCHED",
          matchedResponseId: expect.any(String),
        }),
      })
    );
  });

  it("matches a no-source response to a newly created draft confirmation", async () => {
    const updatedAt = new Date("2026-08-03T08:00:00.000Z");
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-no-source",
      code: "CRSP-NS-001",
      projectId: "project-1",
      routingStatus: "NO_SOURCE_REQUEST",
      matchedResponseId: null,
      updatedAt,
      objectKey: "confirmation-response-library/no-source.pdf",
      fileName: "no-source.pdf",
      mimeType: "application/pdf",
      uploadedById: "staff-1",
      receivedAt: new Date("2026-08-01T08:00:00.000Z"),
      referenceNumber: "REF-NS-001",
      notes: null,
    });
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-draft",
      status: "DRAFT",
      type: "BANK",
      confirmationCode: "AUD-2026-NS-001",
      responsibleUserId: "staff-2",
      dispatches: [],
    });
    storage.getObjectBuffer.mockResolvedValue(Buffer.from("%PDF-1.4 response"));
    storage.putConfirmationResponseArtifactFile.mockResolvedValue({
      objectKey:
        "confirmation-response-artifacts/response-no-source/artifact-1/no-source.pdf",
    });
    transaction.confirmationResponseLibraryFile.update.mockResolvedValue({
      id: "response-no-source",
      code: "CRSP-NS-001",
      projectId: "project-1",
      confirmationId: "confirmation-draft",
      routingStatus: "MATCHED",
    });

    await createService().route(
      "response-no-source",
      {
        action: "MATCH_CONFIRMATION",
        projectId: "project-1",
        confirmationId: "confirmation-draft",
      },
      user,
      source
    );

    expect(transaction.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "confirmation-draft",
          status: "DRAFT",
          responses: {
            none: { responseStatus: "RECEIVED", routingStatus: "ROUTED" },
          },
        }),
        data: { status: "RESPONSE_RECEIVED" },
      })
    );
    expect(
      transaction.projectConfirmationResponse.create
    ).toHaveBeenCalledOnce();
    expect(transaction.confirmationDispatchEvent.create).not.toHaveBeenCalled();
  });

  it.each([
    ["DRAFT", "UNASSIGNED_PROJECT"], ["PREPARED", "UNASSIGNED_PROJECT"],
    ["DRAFT", "PENDING_MATCH"], ["PREPARED", "PENDING_MATCH"],
    ["CLOSED", "UNASSIGNED_PROJECT"], ["VOIDED", "UNASSIGNED_PROJECT"],
    ["CLOSED", "PENDING_MATCH"], ["VOIDED", "PENDING_MATCH"],
  ] as const)(
    "matches a %s confirmation from %s",
    async (status, routingStatus) => {
      prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
        id: "response-stage",
        code: "CRSP-STAGE",
        projectId: routingStatus === "PENDING_MATCH" ? "project-1" : null,
        routingStatus,
        matchedResponseId: null,
        updatedAt: new Date("2026-08-03T08:00:00.000Z"),
        objectKey: "confirmation-response-library/stage.pdf",
        fileName: "stage.pdf",
        mimeType: "application/pdf",
        uploadedById: "staff-1",
        receivedAt: new Date("2026-08-01T08:00:00.000Z"),
        referenceNumber: null,
        notes: null,
      });
      prisma.projectConfirmation.findFirst.mockResolvedValue({
        id: "confirmation-stage",
        status,
        type: "BANK",
        confirmationCode: "AUD-2026-STAGE-001",
        responsibleUserId: "staff-2",
        responses: [],
      });
      storage.getObjectBuffer.mockResolvedValue(Buffer.from("response"));
      storage.putConfirmationResponseArtifactFile.mockResolvedValue({
        objectKey: "confirmation-response-artifacts/stage.pdf",
      });

      await createService().route(
        "response-stage",
        {
          action: "MATCH_CONFIRMATION",
          projectId: "project-1",
          confirmationId: "confirmation-stage",
        },
        user,
        source
      );

      expect(transaction.projectConfirmation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "confirmation-stage",
            status,
          }),
          data: { status: "RESPONSE_RECEIVED" },
        })
      );
      expect(transaction.confirmationFollowUpEvent.create).not.toHaveBeenCalled();
      expect(transaction.confirmationDispatchEvent.create).not.toHaveBeenCalled();
      expect(transaction.projectConfirmation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            followUpEvents: expect.objectContaining({
              create: expect.objectContaining({ eventType: "RESPONSE_RECEIVED" }),
            }),
          }),
        })
      );
    }
  );

  it.each(["RESPONSE_RECEIVED"] as const)(
    "rejects matching a %s confirmation",
    async (status) => {
      prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
        id: "response-rejected",
        code: "CRSP-REJECTED",
        projectId: null,
        routingStatus: "UNASSIGNED_PROJECT",
        matchedResponseId: null,
        updatedAt: new Date("2026-08-03T08:00:00.000Z"),
      });
      prisma.projectConfirmation.findFirst.mockResolvedValue({
        id: "confirmation-rejected",
        status,
        type: "BANK",
        confirmationCode: "AUD-2026-REJECTED-001",
        responsibleUserId: "staff-2",
        responses: [],
      });

      await expect(
        createService().route(
          "response-rejected",
          {
            action: "MATCH_CONFIRMATION",
            projectId: "project-1",
            confirmationId: "confirmation-rejected",
          },
          user,
          source
        )
      ).rejects.toBeInstanceOf(ApiConflictException);
      expect(storage.getObjectBuffer).not.toHaveBeenCalled();
      expect(transaction.projectConfirmation.updateMany).not.toHaveBeenCalled();
    }
  );

  it("rejects an otherwise matchable confirmation that already has an active received response", async () => {
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-active",
      code: "CRSP-ACTIVE",
      projectId: null,
      routingStatus: "UNASSIGNED_PROJECT",
      matchedResponseId: null,
      updatedAt: new Date("2026-08-03T08:00:00.000Z"),
    });
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-active",
      status: "PREPARED",
      type: "BANK",
      confirmationCode: "AUD-2026-ACTIVE-001",
      responsibleUserId: "staff-2",
      responses: [{ id: "response-existing" }],
    });

    await expect(
      createService().route(
        "response-active",
        {
          action: "MATCH_CONFIRMATION",
          projectId: "project-1",
          confirmationId: "confirmation-active",
        },
        user,
        source
      )
    ).rejects.toBeInstanceOf(ApiConflictException);
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
  });

  it("rejects a stale routing request before it can overwrite another match", async () => {
    prisma.confirmationResponseLibraryFile.findUnique.mockResolvedValue({
      id: "response-1",
      code: "CRSP-001",
      projectId: null,
      routingStatus: "UNASSIGNED_PROJECT",
      updatedAt: new Date("2026-08-03T08:00:00.000Z"),
    });
    transaction.confirmationResponseLibraryFile.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      createService().route(
        "response-1",
        { action: "PENDING_MATCH", projectId: "project-1" },
        user,
        source
      )
    ).rejects.toBeInstanceOf(ApiConflictException);

    expect(
      transaction.confirmationResponseLibraryFile.update
    ).not.toHaveBeenCalled();
  });
});
