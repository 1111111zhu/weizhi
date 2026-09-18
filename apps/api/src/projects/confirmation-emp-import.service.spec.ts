import { createHash } from "node:crypto";

import { ConfirmationEmpImportService } from "./confirmation-emp-import.service";
import type { ConfirmationEmpImportPreview } from "./confirmation-emp-import.service";

type ImportServiceTestAccess = {
  preview: (...args: unknown[]) => Promise<ConfirmationEmpImportPreview>;
  createJob: (...args: unknown[]) => Promise<{
    items?: unknown[];
    targetWorkflowNode?: unknown;
    [key: string]: unknown;
  }>;
  executeJob: (...args: unknown[]) => Promise<unknown>;
  executeZipItems: (...args: unknown[]) => Promise<unknown>;
  retryJob: (...args: unknown[]) => Promise<unknown>;
  ensureAvailableWorkingPaperCode: (...args: unknown[]) => Promise<unknown>;
  ensureAvailableZipWorkingPaperCode: (...args: unknown[]) => Promise<unknown>;
  listJobs: (...args: unknown[]) => Promise<unknown>;
  getJobProgress: (...args: unknown[]) => Promise<unknown>;
};
type CreateJobMockData = {
  id: string;
  projectId: string;
  status?: string;
  items: { create: unknown[] };
};

const prisma = {
  $transaction: vi.fn(),
  project: { findUnique: vi.fn() },
  workflowNode: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  workingPaper: {
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  attachment: {
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  attachmentVersion: { create: vi.fn(), deleteMany: vi.fn() },
  workingPaperSignoff: { createMany: vi.fn(), deleteMany: vi.fn() },
  projectConfirmation: { findMany: vi.fn() },
  confirmationEmpImportJob: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  confirmationEmpImportItem: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  confirmationFollowUpEvent: { create: vi.fn() },
};
const access = {
  requireProjectAction: vi.fn(),
  requireProjectMember: vi.fn(),
};
const storage = {
  copyObjectToWorkingPaper: vi.fn(),
  getObjectBuffer: vi.fn(),
  getObjectMetadata: vi.fn(),
  putObject: vi.fn(),
  putCacheObjectIfAbsent: vi.fn(),
  deleteObject: vi.fn(),
  deleteObjectIfPresent: vi.fn(),
};
const auditLogs = { log: vi.fn() };
const archiveService = { createArchive: vi.fn() };
const jobResponseInclude = {
  items: { include: { empWorkflowNode: true } },
  targetWorkflowNode: true,
  batchWorkflowNode: true,
};
const user = {
  id: "user-1",
  email: "member@example.test",
  name: "Project Member",
  globalRole: "MANAGER",
};
const auditSource = {
  ipAddress: "127.0.0.1",
  userAgent: "confirmation-emp-import.spec",
};

function createService() {
  const service = new ConfirmationEmpImportService(
    prisma as never,
    access as never,
    storage as never,
    auditLogs as never,
    archiveService as never
  );
  return service;
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function integrityConfirmation() {
  return {
    id: "confirmation-source-integrity",
    projectId: "project-1",
    status: "CLOSED",
    differenceStatus: "MATCHED",
    confirmationCode: "CONF-INTEGRITY",
    counterpartyName: "Integrity Bank",
    createdBy: "preparer-1",
    currentArtifact: {
      id: "outgoing-source-integrity",
      disposition: "ACTIVE",
      pdfObjectKey: "confirmations/integrity-outgoing.pdf",
      pdfSize: 5,
      pdfSha256: "outgoing-integrity-sha",
      submittedAt: new Date("2026-08-01T09:00:00.000Z"),
    },
    responses: [
      {
        id: "response-source-integrity",
        routingStatus: "ROUTED",
        receivedAt: new Date("2026-08-02T09:00:00.000Z"),
        artifacts: [
          {
            id: "response-source-integrity-1",
            sequence: 1,
            objectKey: "responses/integrity-1.pdf",
            fileName: "integrity-1.pdf",
            mimeType: "application/pdf",
            fileSize: 6,
            sha256: "response-integrity-sha-1",
          },
          {
            id: "response-source-integrity-2",
            sequence: 2,
            objectKey: "responses/integrity-2.bin",
            fileName: "integrity-2.bin",
            mimeType: "application/octet-stream",
            fileSize: 7,
            sha256: "response-integrity-sha-2",
          },
        ],
      },
    ],
    followUpEvents: [],
  };
}

function testRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function testUploadedSource(snapshot: unknown) {
  const record = testRecord(snapshot);
  if (!record) {
    return null;
  }
  const nested = testRecord(record.source);
  if (!nested && record.source !== "UPLOAD") {
    return null;
  }
  const source = nested ?? record;
  return {
    size: typeof source.size === "number" ? source.size : undefined,
    mimeType: typeof source.mimeType === "string" ? source.mimeType : undefined,
    sha256: typeof source.sha256 === "string" ? source.sha256 : undefined,
  };
}

async function defaultTestObjectMetadata(objectKey: string) {
  const { results } = prisma.projectConfirmation.findMany.mock;
  const lastResult = results[results.length - 1];
  const confirmations =
    lastResult?.type === "return" ? await lastResult.value : [];

  for (const confirmation of Array.isArray(confirmations)
    ? confirmations
    : []) {
    const artifact = confirmation?.currentArtifact;
    if (artifact?.pdfObjectKey === objectKey) {
      return {
        contentLength: artifact.pdfSize,
        contentType: "application/pdf",
        contentSha256: artifact.pdfSha256,
      };
    }
    if (artifact?.docxObjectKey === objectKey) {
      const uploadedSource = testUploadedSource(artifact.structuredSnapshot);
      return {
        contentLength:
          uploadedSource?.size ?? artifact.docxSize ?? artifact.pdfSize,
        contentType: uploadedSource?.mimeType ?? "application/octet-stream",
        contentSha256: uploadedSource?.sha256,
      };
    }
    for (const response of confirmation?.responses ?? []) {
      for (const responseArtifact of response?.artifacts ?? []) {
        if (responseArtifact.objectKey === objectKey) {
          return {
            contentLength: responseArtifact.fileSize,
            contentType: responseArtifact.mimeType,
            contentSha256: responseArtifact.sha256,
          };
        }
      }
    }
  }

  return {
    contentLength: 1,
    contentType: "application/octet-stream",
  };
}

function mockZipSourceMetadata(
  items: { sourceObjectKey: string; sourceSize: number }[]
) {
  const sizes = new Map(
    items.map((item) => [item.sourceObjectKey, item.sourceSize])
  );
  storage.getObjectMetadata.mockImplementation(async (objectKey: string) => {
    await Promise.resolve();
    return {
      contentLength: sizes.get(objectKey) ?? 0,
      contentType: "application/octet-stream",
    };
  });
}

describe(ConfirmationEmpImportService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => unknown) => {
        await Promise.resolve();
        return callback(prisma);
      }
    );
    prisma.confirmationEmpImportJob.findUnique.mockReset();
    prisma.confirmationEmpImportJob.findFirst.mockReset();
    prisma.confirmationEmpImportJob.findMany.mockReset();
    prisma.confirmationEmpImportJob.create.mockReset();
    prisma.confirmationEmpImportJob.updateMany.mockReset();
    prisma.confirmationEmpImportJob.update.mockReset();
    prisma.confirmationEmpImportItem.update.mockReset();
    prisma.confirmationEmpImportItem.updateMany.mockReset();
    prisma.confirmationEmpImportItem.updateMany.mockImplementation(
      async ({ where }: { where?: { id?: { in?: string[] } } }) => {
        await Promise.resolve();
        return {
          count: where?.id?.in?.length ?? 1,
        };
      }
    );
    prisma.workingPaper.create.mockReset();
    prisma.workingPaper.delete.mockReset();
    prisma.workingPaper.count.mockReset();
    prisma.workflowNode.findMany.mockReset();
    prisma.workflowNode.create.mockReset();
    prisma.attachment.create.mockReset();
    prisma.attachment.update.mockReset();
    prisma.attachment.count.mockReset();
    prisma.attachmentVersion.create.mockReset();
    prisma.attachmentVersion.deleteMany.mockReset();
    prisma.workingPaperSignoff.createMany.mockReset();
    prisma.workingPaperSignoff.deleteMany.mockReset();
    storage.copyObjectToWorkingPaper.mockReset();
    storage.getObjectBuffer.mockReset();
    storage.getObjectMetadata.mockReset();
    storage.getObjectMetadata.mockImplementation(defaultTestObjectMetadata);
    storage.putObject.mockReset();
    storage.putCacheObjectIfAbsent.mockReset();
    storage.putCacheObjectIfAbsent.mockResolvedValue({
      fileName: "confirmation-responses.zip",
      objectKey: "working-papers/zip/confirmation-responses.zip",
      created: true,
    });
    storage.deleteObject.mockReset();
    storage.deleteObject.mockResolvedValue(undefined as never);
    storage.deleteObjectIfPresent.mockReset();
    storage.deleteObjectIfPresent.mockResolvedValue(undefined as never);
    prisma.attachment.deleteMany.mockReset();
    archiveService.createArchive.mockReset();
    access.requireProjectAction.mockResolvedValue({
      projectId: "project-1",
      userId: user.id,
    });
    access.requireProjectMember.mockResolvedValue({
      projectId: "project-1",
      userId: user.id,
    });
    prisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      status: "ACTIVE",
    });
    prisma.workflowNode.findUnique.mockResolvedValue({
      id: "node-1",
      projectId: "project-1",
      code: "A1-1000",
      title: "A1 - 1000",
      level: 3,
    });
    prisma.workingPaper.findMany.mockResolvedValue([]);
    prisma.confirmationEmpImportItem.findMany.mockResolvedValue([]);
  });

  it("previews every artifact from every completed response and excludes the outgoing file", async () => {
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "confirmation-1",
        projectId: "project-1",
        status: "CLOSED",
        differenceStatus: "MATCHED",
        counterpartyName: "Acme Ltd",
        currentArtifact: {
          id: "outgoing-artifact-2",
          disposition: "ACTIVE",
          pdfObjectKey: "confirmation-artifacts/outgoing-2.pdf",
          pdfSize: 120,
          pdfSha256: "outgoing-hash-2",
          submittedAt: new Date("2026-08-01T09:00:00.000Z"),
        },
        responses: [
          {
            id: "response-old",
            routingStatus: "ROUTED",
            responseStatus: "ASSIGNED",
            receivedAt: new Date("2026-08-01T10:00:00.000Z"),
            artifacts: [
              {
                id: "response-old-artifact",
                objectKey: "confirmation-response-artifacts/old.pdf",
                fileName: "old.pdf",
                mimeType: "application/pdf",
                fileSize: 10,
                sha256: "old-hash",
              },
            ],
          },
          {
            id: "response-latest",
            routingStatus: "ROUTED",
            responseStatus: "ASSIGNED",
            receivedAt: new Date("2026-08-02T10:00:00.000Z"),
            artifacts: [
              {
                id: "response-latest-artifact-1",
                objectKey: "confirmation-response-artifacts/latest-1.pdf",
                fileName: "latest-1.pdf",
                mimeType: "application/pdf",
                fileSize: 20,
                sha256: "latest-hash-1",
              },
              {
                id: "response-latest-artifact-2",
                objectKey: "confirmation-response-artifacts/latest-2.png",
                fileName: "latest-2.png",
                mimeType: "image/png",
                fileSize: 30,
                sha256: "latest-hash-2",
              },
            ],
          },
        ],
      },
    ]);

    const preview = await createService().preview("project-1", user as never, {
      confirmationIds: ["confirmation-1"],
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
    });

    expect(access.requireProjectAction).toHaveBeenCalledWith(
      "project-1",
      "user-1",
      "modifyIndex"
    );
    expect(
      preview.sources.map(
        (source: { sourceKind: string; sourceObjectKey: string }) => [
          source.sourceKind,
          source.sourceObjectKey,
        ]
      )
    ).toStrictEqual([
      ["RESPONSE_ARTIFACT", "confirmation-response-artifacts/old.pdf"],
      ["RESPONSE_ARTIFACT", "confirmation-response-artifacts/latest-1.pdf"],
      ["RESPONSE_ARTIFACT", "confirmation-response-artifacts/latest-2.png"],
    ]);
    expect(
      preview.sources.map((source) => source.sourceArtifactId)
    ).toStrictEqual([
      "response-old-artifact",
      "response-latest-artifact-1",
      "response-latest-artifact-2",
    ]);
  });

  it("previews the exact physical source set across confirmations and response artifacts", async () => {
    const first = integrityConfirmation();
    const second = {
      ...integrityConfirmation(),
      id: "confirmation-source-integrity-2",
      confirmationCode: "CONF-INTEGRITY-2",
      counterpartyName: "Integrity Bank 2",
      currentArtifact: {
        ...integrityConfirmation().currentArtifact,
        id: "outgoing-source-integrity-2",
        pdfObjectKey: "confirmations/integrity-outgoing-2.pdf",
      },
      responses: [
        {
          ...integrityConfirmation().responses[0],
          id: "response-source-integrity-2",
          artifacts: integrityConfirmation().responses[0].artifacts.map(
            (artifact) => ({
              ...artifact,
              id: `${artifact.id}-2`,
              objectKey: `${artifact.objectKey}-2`,
            })
          ),
        },
      ],
    };
    prisma.projectConfirmation.findMany.mockResolvedValue([first, second]);
    const selectedKeys = [
      "RESPONSE_ARTIFACT:confirmation-source-integrity:response-source-integrity:response-source-integrity-2",
      "RESPONSE_ARTIFACT:confirmation-source-integrity-2:response-source-integrity-2:response-source-integrity-1-2",
    ];
    const preview = await createService().preview("project-1", user as never, {
      activeLinkKeys: selectedKeys,
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
    });

    expect(preview.issues).toStrictEqual([]);
    expect(preview.sources.map((source) => source.activeLinkKey)).toStrictEqual(
      selectedKeys
    );
  });

  it("keeps one selected response artifact scoped and deduplicates its key", async () => {
    const selected = integrityConfirmation();
    const other = {
      ...selected,
      id: "confirmation-source-integrity-other",
      confirmationCode: "CONF-INTEGRITY-OTHER",
      counterpartyName: "Other Bank",
      responses: selected.responses.map((response) => ({
        ...response,
        id: "response-source-integrity-other",
        artifacts: response.artifacts.map((artifact) => ({
          ...artifact,
          id: `${artifact.id}-other`,
          objectKey: `${artifact.objectKey}-other`,
        })),
      })),
    };
    const selectedKey =
      "RESPONSE_ARTIFACT:confirmation-source-integrity:response-source-integrity:response-source-integrity-2";
    prisma.projectConfirmation.findMany.mockResolvedValue([selected, other]);

    const preview = await createService().preview("project-1", user as never, {
      activeLinkKeys: [selectedKey, selectedKey],
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
    });

    expect(prisma.projectConfirmation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "project-1",
          id: { in: [selected.id] },
          status: "CLOSED",
          differenceStatus: "MATCHED",
        }),
      })
    );
    expect(preview.issues).toStrictEqual([]);
    expect(preview.sources.map((source) => source.activeLinkKey)).toStrictEqual(
      [selectedKey]
    );

    expect(storage.getObjectMetadata).toHaveBeenCalledExactlyOnceWith(
      "responses/integrity-2.bin"
    );
  });

  it("rejects an empty physical source selection before preview", async () => {
    const service = createService();
    const previewSpy = vi.spyOn(service, "preview");
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(null);

    await expect(
      service.createJob("project-1", user as never, {
        activeLinkKeys: [],
        targetWorkflowNodeId: "node-1",
        mode: "FLAT",
        previewFingerprint: "empty-selection",
        idempotencyKey: "empty-physical-selection",
      })
    ).rejects.toHaveProperty(
      "response",
      expect.objectContaining({
        code: "BAD_REQUEST",
        message: "At least one physical confirmation source must be selected.",
      })
    );
    expect(previewSpy).not.toHaveBeenCalled();
  });

  it("blocks create when a selected source is no longer CLOSED and MATCHED", async () => {
    const selected = integrityConfirmation();
    const selectedKey =
      "OUTGOING_ARTIFACT:confirmation-source-integrity:outgoing-source-integrity";
    prisma.projectConfirmation.findMany
      .mockResolvedValueOnce([selected])
      .mockResolvedValueOnce([
        {
          ...selected,
          status: "PREPARED",
        },
      ]);

    const service = createService();
    const initialPreview = await service.preview("project-1", user as never, {
      activeLinkKeys: [selectedKey],
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
    });
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(null);

    await expect(
      service.createJob("project-1", user as never, {
        activeLinkKeys: [selectedKey],
        targetWorkflowNodeId: "node-1",
        mode: "FLAT",
        previewFingerprint: initialPreview.fingerprint,
        idempotencyKey: "eligibility-transition-idempotency",
      })
    ).rejects.toHaveProperty(
      "response",
      expect.objectContaining({ code: "CONFLICT_RISK" })
    );
    expect(prisma.projectConfirmation.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: "CLOSED",
          differenceStatus: "MATCHED",
        }),
      })
    );
    expect(prisma.confirmationEmpImportJob.create).not.toHaveBeenCalled();
  });

  it("orders latest response artifacts by their stored sequence", async () => {
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "confirmation-sequenced",
        projectId: "project-1",
        status: "CLOSED",
        differenceStatus: "MATCHED",
        counterpartyName: "Acme",
        currentArtifact: {
          id: "outgoing-sequenced",
          disposition: "ACTIVE",
          pdfObjectKey: "confirmations/sequenced.pdf",
          pdfSize: 1,
          pdfSha256: "sequenced-outgoing-sha",
          submittedAt: new Date("2026-08-01T09:00:00.000Z"),
        },
        responses: [
          {
            id: "response-sequenced",
            routingStatus: "ROUTED",
            receivedAt: new Date("2026-08-02T09:00:00.000Z"),
            artifacts: [
              {
                id: "response-sequenced-2",
                sequence: 2,
                objectKey: "responses/two.pdf",
                fileName: "two.pdf",
                mimeType: "application/pdf",
                fileSize: 1,
                sha256: "two-sha",
              },
              {
                id: "response-sequenced-1",
                sequence: 1,
                objectKey: "responses/one.pdf",
                fileName: "one.pdf",
                mimeType: "application/pdf",
                fileSize: 1,
                sha256: "one-sha",
              },
            ],
          },
        ],
      },
    ]);

    const preview = await createService().preview("project-1", user as never, {
      confirmationIds: ["confirmation-sequenced"],
      targetWorkflowNodeId: "node-1",
      mode: "ZIP",
    });

    expect(
      preview.sources
        .filter((source) => source.sourceKind === "RESPONSE_ARTIFACT")
        .map((source) => source.sourceArtifactId)
    ).toStrictEqual(["response-sequenced-1", "response-sequenced-2"]);
  });

  it("does not propose a reviewer signoff when reviewer and preparer are the same user", async () => {
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "confirmation-self-reviewed",
        projectId: "project-1",
        status: "CLOSED",
        differenceStatus: "MATCHED",
        counterpartyName: "Acme",
        confirmationCode: "CONF-SELF",
        createdBy: "creator-1",
        currentArtifact: {
          id: "outgoing-self",
          disposition: "ACTIVE",
          pdfObjectKey: "confirmations/self.pdf",
          pdfSize: 1,
          pdfSha256: "self-outgoing-sha",
          submittedAt: new Date("2026-08-01T09:00:00.000Z"),
        },
        responses: [
          {
            id: "response-self",
            routingStatus: "ROUTED",
            receivedAt: new Date("2026-08-02T09:00:00.000Z"),
            artifacts: [
              {
                id: "response-self-artifact",
                objectKey: "responses/self.pdf",
                fileName: "self.pdf",
                mimeType: "application/pdf",
                fileSize: 1,
                sha256: "self-response-sha",
              },
            ],
          },
        ],
        followUpEvents: [
          {
            eventType: "REVIEW_RECORDED",
            actorId: "creator-1",
            occurredAt: new Date("2026-08-03T09:00:00.000Z"),
          },
        ],
      },
    ]);

    const preview = await createService().preview("project-1", user as never, {
      confirmationIds: ["confirmation-self-reviewed"],
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
    });

    expect(
      preview.sources.every((source) => source.reviewUserId === null)
    ).toBeTruthy();
    expect(
      preview.sources.every((source) => source.reviewAt === null)
    ).toBeTruthy();
  });

  it("does not treat a failed item as an active source linkage", async () => {
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "confirmation-failed-import",
        projectId: "project-1",
        status: "CLOSED",
        differenceStatus: "MATCHED",
        counterpartyName: "Acme",
        currentArtifact: {
          id: "outgoing-failed-import",
          disposition: "ACTIVE",
          pdfObjectKey: "confirmations/failed.pdf",
          pdfSize: 1,
          pdfSha256: "failed-outgoing-sha",
          submittedAt: new Date("2026-08-01T09:00:00.000Z"),
        },
        responses: [
          {
            id: "response-failed-import",
            routingStatus: "ROUTED",
            receivedAt: new Date("2026-08-02T09:00:00.000Z"),
            artifacts: [
              {
                id: "response-failed-import-artifact",
                objectKey: "responses/failed.pdf",
                fileName: "failed.pdf",
                mimeType: "application/pdf",
                fileSize: 1,
                sha256: "failed-response-sha",
              },
            ],
          },
        ],
      },
    ]);
    prisma.confirmationEmpImportItem.findMany.mockImplementation(
      async ({ where }: { where: { status?: string } }) => {
        await Promise.resolve();
        return where.status === "SUCCEEDED"
          ? []
          : [
              {
                activeLinkKey:
                  "OUTGOING_ARTIFACT:confirmation-failed-import:outgoing-failed-import",
                jobId: "failed-job",
                status: "FAILED",
                workingPaperId: null,
                attachmentId: null,
              },
            ];
      }
    );

    const preview = await createService().preview("project-1", user as never, {
      confirmationIds: ["confirmation-failed-import"],
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
    });

    expect(preview.skipped).toStrictEqual([]);
    expect(preview.sources).toHaveLength(1);
    expect(prisma.confirmationEmpImportItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "SUCCEEDED" }),
      })
    );
  });

  it("returns the existing job for a replayed idempotency key", async () => {
    const existingJob = {
      id: "job-1",
      projectId: "project-1",
      idempotencyKey: "idem-1",
      status: "QUEUED",
      items: [
        {
          id: "item-1",
          status: "QUEUED",
          empWorkflowNode: { id: "node-1", code: "A1", title: "A1" },
        },
      ],
      targetWorkflowNode: { id: "node-1", code: "A1", title: "A1" },
      batchWorkflowNode: null,
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(existingJob);

    const job = await (
      createService() as unknown as ImportServiceTestAccess
    ).createJob("project-1", user, {
      confirmationIds: ["confirmation-1"],
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      previewFingerprint: "fingerprint-1",
      idempotencyKey: "idem-1",
    });

    expect(job).toBe(existingJob);
    expect(prisma.confirmationEmpImportJob.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: "idem-1" },
      include: jobResponseInclude,
    });
    expect(job.items).toHaveLength(1);
    expect(job.targetWorkflowNode).toBeDefined();
    expect(prisma.confirmationEmpImportJob.create).not.toHaveBeenCalled();
  });

  it("rejects a create when the second preview returns a different physical source", async () => {
    const service = createService();
    vi.spyOn(service, "preview").mockResolvedValue({
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      sources: [
        {
          activeLinkKey: "OUTGOING_ARTIFACT:confirmation-2:artifact-2",
          confirmationId: "confirmation-2",
          paperCode: "A1-F002",
          businessName: "Second confirmation",
        },
      ],
      skipped: [],
      issues: [],
      fingerprint: "physical-selection-fingerprint",
    } as unknown as ConfirmationEmpImportPreview);
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(null);

    await expect(
      service.createJob("project-1", user as never, {
        activeLinkKeys: ["OUTGOING_ARTIFACT:confirmation-1:artifact-1"],
        targetWorkflowNodeId: "node-1",
        mode: "FLAT",
        previewFingerprint: "physical-selection-fingerprint",
        idempotencyKey: "physical-selection-idempotency",
      })
    ).rejects.toHaveProperty(
      "response",
      expect.objectContaining({ code: "CONFLICT_RISK" })
    );
    expect(prisma.confirmationEmpImportJob.create).not.toHaveBeenCalled();
  });

  it("rejects an idempotency key owned by another project", async () => {
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue({
      id: "job-other-project",
      projectId: "project-2",
      idempotencyKey: "idem-cross-project",
    });

    await expect(
      createService().createJob("project-1", user as never, {
        confirmationIds: [],
        targetWorkflowNodeId: "node-1",
        mode: "FLAT",
        previewFingerprint: "fingerprint-cross-project",
        idempotencyKey: "idem-cross-project",
      })
    ).rejects.toHaveProperty(
      "response",
      expect.objectContaining({ code: "CONFLICT_RISK" })
    );
  });

  it("requires one EMP code for every source in ZIP mode", async () => {
    const preview = {
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "ZIP",
      sources: [
        { activeLinkKey: "zip-source-1", paperCode: "A1-1000-F001" },
        { activeLinkKey: "zip-source-2", paperCode: "A1-1000-F001" },
      ],
      skipped: [],
      issues: [],
      fingerprint: "zip-fingerprint",
    };
    const service = createService();
    vi.spyOn(service, "preview").mockResolvedValue(
      preview as unknown as unknown as ConfirmationEmpImportPreview
    );
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(null);

    await expect(
      service.createJob("project-1", user as never, {
        confirmationIds: [],
        targetWorkflowNodeId: "node-1",
        mode: "ZIP",
        previewFingerprint: "zip-fingerprint",
        idempotencyKey: "idem-zip-multiple-codes",
        sourceOverrides: {
          "zip-source-2": { paperCode: "A1-1000-F002" },
        },
      })
    ).rejects.toHaveProperty(
      "response",
      expect.objectContaining({ code: "BAD_REQUEST" })
    );
  });

  it("normalizes overridden business and ZIP entry names before persistence", async () => {
    const preview = {
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "ZIP",
      sources: [
        {
          activeLinkKey: "zip-name-source",
          paperCode: "A1-1000-F001",
          businessName: "Acme.pdf",
          zipEntryName: "001-Acme.pdf",
        },
      ],
      skipped: [],
      issues: [],
      fingerprint: "zip-name-fingerprint",
    };
    const service = createService();
    vi.spyOn(service, "preview").mockResolvedValue(
      preview as unknown as unknown as ConfirmationEmpImportPreview
    );
    vi.spyOn(service, "executeJob").mockResolvedValue(null);
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(null);
    prisma.confirmationEmpImportJob.create.mockImplementation(
      async ({ data }: { data: CreateJobMockData }) => {
        await Promise.resolve();
        return {
          id: data.id,
          projectId: data.projectId,
          items: data.items.create,
        };
      }
    );

    const job = await service.createJob("project-1", user as never, {
      confirmationIds: [],
      targetWorkflowNodeId: "node-1",
      mode: "ZIP",
      previewFingerprint: "zip-name-fingerprint",
      idempotencyKey: "idem-zip-names",
      sourceOverrides: {
        "zip-name-source": {
          businessName: "../unsafe name?.pdf",
          zipEntryName: "../unsafe entry?.pdf",
        },
      },
    });

    expect((job as unknown as { items: unknown[] }).items).toStrictEqual([
      expect.objectContaining({
        workingPaperTitle: ".._unsafe name_.pdf",
        zipEntryName: ".._unsafe_entry_.pdf",
      }),
    ]);
  });

  it("returns the winner when two job creations race on the idempotency key", async () => {
    const winner = {
      id: "job-race-winner",
      projectId: "project-1",
      idempotencyKey: "idem-race",
      status: "QUEUED",
      items: [{ id: "winner-item", status: "QUEUED" }],
      targetWorkflowNode: { id: "node-1", code: "A1", title: "A1" },
      batchWorkflowNode: null,
    };
    const service = createService();
    vi.spyOn(service, "preview").mockResolvedValue({
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      sources: [],
      skipped: [],
      issues: [],
      fingerprint: "race-fingerprint",
    });
    prisma.confirmationEmpImportJob.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    prisma.confirmationEmpImportJob.create.mockRejectedValue({ code: "P2002" });

    await expect(
      service.createJob("project-1", user as never, {
        confirmationIds: [],
        targetWorkflowNodeId: "node-1",
        mode: "FLAT",
        previewFingerprint: "race-fingerprint",
        idempotencyKey: "idem-race",
      })
    ).resolves.toMatchObject({
      id: winner.id,
      items: winner.items,
      targetWorkflowNode: winner.targetWorkflowNode,
    });
    expect(prisma.confirmationEmpImportJob.findUnique).toHaveBeenNthCalledWith(
      2,
      { where: { idempotencyKey: "idem-race" }, include: jobResponseInclude }
    );
  });

  it("returns persisted item progress only after membership is verified", async () => {
    const job = {
      id: "job-progress",
      projectId: "project-1",
      status: "PARTIAL_FAILURE",
      items: [
        { id: "item-ok", status: "SUCCEEDED" },
        { id: "item-retry", status: "FAILED", errorCode: "IMPORT_FAILED" },
      ],
    };
    prisma.confirmationEmpImportJob.findFirst.mockResolvedValue(job);

    await expect(
      createService().getJob("project-1", user as never, "job-progress")
    ).resolves.toBe(job);

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
  });

  it("does not execute a job after its project becomes immutable", async () => {
    const job = {
      id: "job-immutable-project",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      status: "QUEUED",
      items: [{ id: "immutable-item", status: "QUEUED" }],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      status: "ARCHIVED",
    });
    prisma.confirmationEmpImportJob.update.mockResolvedValue({
      ...job,
      status: "FAILED",
    });

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-immutable-project",
      "project-1",
      "user-1"
    );

    expect(prisma.confirmationEmpImportJob.updateMany).not.toHaveBeenCalled();
    expect(prisma.confirmationEmpImportItem.updateMany).toHaveBeenCalledWith({
      where: { jobId: "job-immutable-project", status: { not: "SUCCEEDED" } },
      data: {
        status: "FAILED",
        errorCode: "PROJECT_NOT_MUTABLE",
        errorMessage: "The project is not mutable; retry after it is active.",
      },
    });
  });

  it("does not rewrite a completed job when a duplicate worker wakes up", async () => {
    const job = {
      id: "job-already-completed",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      status: "COMPLETED",
      items: [{ id: "completed-item", status: "SUCCEEDED" }],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      status: "ARCHIVED",
    });

    await expect(
      (createService() as unknown as ImportServiceTestAccess).executeJob(
        "job-already-completed",
        "project-1",
        "user-1"
      )
    ).resolves.toBe(job);

    expect(prisma.project.findUnique).not.toHaveBeenCalled();
    expect(prisma.confirmationEmpImportJob.update).not.toHaveBeenCalled();
  });

  it("persists a queued item with source provenance and separate EMP code and title", async () => {
    const preview = {
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      skipped: [],
      issues: [],
      fingerprint: "fingerprint-1",
      sources: [
        {
          confirmationId: "confirmation-1",
          confirmationCode: "CONF-001",
          counterpartyName: "Acme Ltd",
          sourceKind: "RESPONSE_ARTIFACT",
          sourceArtifactId: "response-artifact-1",
          responseId: "response-1",
          responseArtifactId: "response-artifact-1",
          sourceCounterpartyName: "Acme Ltd",
          sourceObjectKey: "responses/response-1.pdf",
          originalFileName: "response.pdf",
          mimeType: "application/pdf",
          fileSize: 24,
          sourceSha256: "sha-1",
          activeLinkKey:
            "RESPONSE_ARTIFACT:confirmation-1:response-1:response-artifact-1",
          paperCode: "A1-1000-F001",
          businessName: "Acme Ltd-Response-01-response.pdf",
          prepareUserId: "creator-1",
          prepareAt: new Date("2026-08-01T09:00:00.000Z"),
          reviewUserId: "reviewer-1",
          reviewAt: new Date("2026-08-02T09:00:00.000Z"),
          packageSequence: null,
          zipEntryName: null,
        },
      ],
    };
    const service = createService();
    const previewSpy = vi
      .spyOn(service, "preview")
      .mockResolvedValue(
        preview as unknown as unknown as ConfirmationEmpImportPreview
      );
    const executeSpy = vi.spyOn(service, "executeJob").mockResolvedValue(null);
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(null);
    prisma.confirmationEmpImportJob.create.mockImplementation(
      async ({ data }: { data: CreateJobMockData }) => {
        await Promise.resolve();
        return {
          id: data.id,
          projectId: data.projectId,
          status: data.status,
          items: data.items.create,
        };
      }
    );

    const job = await (service as unknown as ImportServiceTestAccess).createJob(
      "project-1",
      user as never,
      {
        confirmationIds: ["confirmation-1"],
        activeLinkKeys: [
          preview.sources[0].activeLinkKey,
          preview.sources[0].activeLinkKey,
        ],
        targetWorkflowNodeId: "node-1",
        mode: "FLAT",
        previewFingerprint: "fingerprint-1",
        idempotencyKey: "idem-2",
        sourceOverrides: {
          [preview.sources[0].activeLinkKey]: {
            paperCode: "A1-1000-F009",
            businessName: "Reviewed response.pdf",
          },
        },
      },
      auditSource
    );

    expect(previewSpy).toHaveBeenCalledWith(
      "project-1",
      user,
      expect.objectContaining({
        activeLinkKeys: [preview.sources[0].activeLinkKey],
      })
    );
    expect(job.status).toBe("QUEUED");
    expect(prisma.confirmationEmpImportJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ previewedAt: expect.any(Date) }),
      })
    );
    expect(job.items).toStrictEqual([
      expect.objectContaining({
        confirmationId: "confirmation-1",
        outgoingArtifactId: null,
        responseArtifactId: "response-artifact-1",
        sourceCounterpartyName: "Acme Ltd",
        sourceObjectKey: "responses/response-1.pdf",
        activeLinkKey:
          "RESPONSE_ARTIFACT:confirmation-1:response-1:response-artifact-1",
        workingPaperCode: "A1-1000-F009",
        workingPaperTitle: "Reviewed response.pdf",
        prepareUserId: null,
        reviewUserId: "reviewer-1",
        status: "QUEUED",
      }),
    ]);
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONFIRMATION_EMP_IMPORT_JOB_CREATED",
        targetType: "CONFIRMATION_EMP_IMPORT_JOB",
        source: auditSource,
      })
    );
    expect(executeSpy).toHaveBeenCalledWith(
      expect.any(String),
      "project-1",
      "user-1"
    );
  });

  it("executes a flat item into a working paper and records its target head hash", async () => {
    const body = Buffer.from("reviewed-response-body");
    const job = {
      id: "job-3",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      status: "QUEUED",
      createdBy: "user-1",
      targetWorkflowNode: {
        id: "node-1",
        projectId: "project-1",
        code: "A1-1000",
        level: 3,
      },
      items: [
        {
          id: "item-3",
          status: "QUEUED",
          confirmationId: "confirmation-1",
          sourceKind: "RESPONSE_ARTIFACT",
          responseId: "response-1",
          responseArtifactId: "response-artifact-1",
          sourceObjectKey: "responses/response-1.pdf",
          sourceFileName: "response.pdf",
          sourceMimeType: "application/pdf",
          sourceSize: body.length,
          sourceSha256: sha256(body),
          activeLinkKey: "link-3",
          workingPaperCode: "A1-1000-F001",
          workingPaperTitle: "Reviewed response.pdf",
          prepareUserId: "creator-1",
          preparedAt: new Date("2026-08-01T09:00:00.000Z"),
          reviewUserId: "reviewer-1",
          reviewedAt: new Date("2026-08-02T09:00:00.000Z"),
        },
      ],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.confirmationEmpImportJob.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        return {
          ...job,
          ...data,
        };
      }
    );
    prisma.workingPaper.create.mockResolvedValue({
      id: "paper-3",
      projectId: "project-1",
      workflowNodeId: "node-1",
      code: "A1-1000-F001",
      title: "Reviewed response.pdf",
    });
    storage.getObjectBuffer.mockResolvedValue(body);
    storage.putObject.mockResolvedValue({
      fileName: "stored-response.pdf",
      objectKey: "working-papers/project-1/paper-3/stored-response.pdf",
    });
    prisma.attachment.create.mockResolvedValue({
      id: "attachment-3",
      headVersionId: null,
    });
    prisma.attachmentVersion.create.mockResolvedValue({ id: "version-3" });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-3",
      headVersionId: "version-3",
    });
    prisma.workingPaperSignoff.createMany.mockResolvedValue({ count: 2 });
    prisma.confirmationEmpImportItem.update.mockResolvedValue({
      id: "item-3",
      status: "SUCCEEDED",
    });
    prisma.confirmationFollowUpEvent.create.mockResolvedValue({
      id: "follow-up-archive-3",
    });

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-3",
      "project-1",
      "user-1"
    );

    expect(prisma.workingPaper.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          workflowNodeId: "node-1",
          code: "A1-1000-F001",
          title: "Reviewed response.pdf",
        }),
      })
    );
    expect(prisma.attachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalName: "Reviewed response.pdf",
          fileUrl: "working-papers/project-1/paper-3/stored-response.pdf",
          contentHash: sha256(body),
          preparerId: null,
          reviewerId: "reviewer-1",
          preparedAt: null,
        }),
      })
    );
    expect(prisma.confirmationEmpImportItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "item-3" },
        data: expect.objectContaining({
          status: "SUCCEEDED",
          targetHeadVersionId: "version-3",
          targetHeadHash: sha256(body),
          workingPaperId: "paper-3",
          attachmentId: "attachment-3",
        }),
      })
    );
    expect(prisma.confirmationEmpImportJob.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "job-3" },
        data: expect.objectContaining({ status: "COMPLETED" }),
      })
    );
    expect(prisma.confirmationFollowUpEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          confirmationId: "confirmation-1",
          eventType: "PROGRAM_COMPLETED",
          actorId: "user-1",
          notes: expect.stringContaining("A1-1000-F001"),
          payload: expect.objectContaining({
            operation: "RESPONSE_ARCHIVED_TO_EMP",
            responseId: "response-1",
            workingPaperId: "paper-3",
            workflowNodeId: "node-1",
          }),
        }),
      })
    );
  });

  it("normalizes ZIP entry names once during preview without duplicating extensions", async () => {
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "confirmation-zip",
        projectId: "project-1",
        status: "CLOSED",
        differenceStatus: "MATCHED",
        counterpartyName: "A/Acme Ltd",
        createdBy: "creator-zip",
        currentArtifact: {
          id: "outgoing-zip",
          disposition: "ACTIVE",
          pdfObjectKey: "confirmation-artifacts/zip.pdf",
          pdfSize: 10,
          pdfSha256: "zip-outgoing-sha",
          submittedAt: new Date("2026-08-01T09:00:00.000Z"),
        },
        responses: [
          {
            id: "response-zip",
            routingStatus: "ROUTED",
            receivedAt: new Date("2026-08-02T09:00:00.000Z"),
            artifacts: [
              {
                id: "response-zip-artifact",
                objectKey: "responses/zip.bin",
                fileName: "scan copy?.bin",
                mimeType: "application/octet-stream",
                fileSize: 12,
                sha256: "zip-response-sha",
              },
            ],
          },
        ],
        followUpEvents: [],
      },
    ]);

    const preview = await createService().preview("project-1", user as never, {
      confirmationIds: ["confirmation-zip"],
      targetWorkflowNodeId: "node-1",
      mode: "ZIP",
    });

    expect(preview.sources.map((source) => source.zipEntryName)).toStrictEqual([
      "A1-1000-F001.01-A_Acme_Ltd-Response-01-scan_copy_.bin",
    ]);
    expect(preview.sources[0]?.proposedCode).toBe("A1-1000-F001.01");
    expect(
      new Set(preview.sources.map((source) => source.paperCode)).size
    ).toBe(1);
  });

  it("requeues only failed items and starts an asynchronous retry", async () => {
    const job = {
      id: "job-retry",
      projectId: "project-1",
      status: "PARTIAL_FAILURE",
      items: [
        { id: "item-success", status: "SUCCEEDED" },
        { id: "item-failed", status: "FAILED" },
      ],
    };
    prisma.confirmationEmpImportJob.findFirst.mockResolvedValue(job);
    prisma.confirmationEmpImportJob.update.mockResolvedValue({
      ...job,
      status: "QUEUED",
    });
    prisma.confirmationEmpImportItem.updateMany.mockResolvedValue({ count: 1 });
    const service = createService();
    const executeSpy = vi.spyOn(service, "executeJob").mockResolvedValue(null);

    await (service as unknown as ImportServiceTestAccess).retryJob(
      "project-1",
      user as never,
      "job-retry",
      auditSource
    );

    expect(prisma.confirmationEmpImportItem.updateMany).toHaveBeenCalledWith({
      where: { jobId: "job-retry", status: "FAILED" },
      data: {
        status: "QUEUED",
        errorCode: null,
        errorMessage: null,
      },
    });
    expect(executeSpy).toHaveBeenCalledWith("job-retry", "project-1", "user-1");
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONFIRMATION_EMP_IMPORT_JOB_RETRY",
        targetType: "CONFIRMATION_EMP_IMPORT_JOB",
        targetId: "job-retry",
        source: auditSource,
      })
    );
  });

  it("removes the empty paper created by an item when source storage fails", async () => {
    const job = {
      id: "job-cleanup",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      status: "QUEUED",
      createdBy: "user-1",
      items: [
        {
          id: "item-cleanup",
          status: "QUEUED",
          sourceObjectKey: "responses/missing.pdf",
          sourceMimeType: "application/pdf",
          sourceSize: 5,
          sourceSha256: "missing-sha",
          sourceKind: "RESPONSE_ARTIFACT",
          activeLinkKey: "cleanup-link",
          workingPaperCode: "A1-1000-F002",
          workingPaperTitle: "Missing response.pdf",
          prepareUserId: null,
          reviewUserId: null,
        },
      ],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.confirmationEmpImportJob.update.mockResolvedValue({
      ...job,
      status: "FAILED",
    });
    storage.getObjectBuffer.mockRejectedValue(
      new Error("NoSuchKey responses/missing.pdf")
    );
    prisma.confirmationEmpImportItem.update.mockResolvedValue({
      id: "item-cleanup",
      status: "FAILED",
    });

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-cleanup",
      "project-1",
      "user-1"
    );

    expect(prisma.workingPaper.create).not.toHaveBeenCalled();
    expect(prisma.workingPaper.delete).not.toHaveBeenCalled();
    const failure =
      prisma.confirmationEmpImportItem.update.mock.calls.at(-1)?.[0];
    expect(failure?.data.errorCode).toBe("SOURCE_OBJECT_UNAVAILABLE");
    expect(failure?.data.errorMessage).not.toContain("responses/missing.pdf");
  });

  it("renames a conflicting ZIP paper code and records one flat manifest", async () => {
    const job = {
      id: "job-zip",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "ZIP",
      status: "QUEUED",
      createdBy: "user-1",
      batchCode: "A1-1000-F001",
      items: [
        {
          id: "zip-outgoing",
          status: "QUEUED",
          sourceKind: "OUTGOING_ARTIFACT",
          sourceCounterpartyName: "Acme Ltd",
          sourceConfirmationCode: "CONF-001",
          sourceFileName: "Acme Ltd-Outgoing.pdf",
          sourceObjectKey: "confirmations/outgoing.pdf",
          sourceMimeType: "application/pdf",
          sourceSize: 10,
          sourceSha256: "outgoing-sha",
          packageSequence: 1,
          zipEntryName: "001-Acme_Ltd-Outgoing.pdf",
          workingPaperCode: "A1-1000-F001",
          workingPaperTitle: "Acme Ltd-Outgoing.pdf",
          activeLinkKey: "zip-outgoing-link",
        },
        {
          id: "zip-response",
          status: "QUEUED",
          sourceKind: "RESPONSE_ARTIFACT",
          sourceCounterpartyName: "Acme Ltd",
          sourceConfirmationCode: "CONF-001",
          sourceFileName: "scan.pdf",
          sourceObjectKey: "responses/scan.pdf",
          sourceMimeType: "application/pdf",
          sourceSize: 12,
          sourceSha256: "response-sha",
          packageSequence: 1,
          zipEntryName: "001-Acme_Ltd-Response-01-scan.pdf",
          workingPaperCode: "A1-1000-F001",
          workingPaperTitle: "Acme Ltd-Response-01-scan.pdf",
          activeLinkKey: "zip-response-link",
        },
      ],
    };
    mockZipSourceMetadata(job.items);
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.confirmationEmpImportJob.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        return {
          ...job,
          ...data,
        };
      }
    );
    prisma.workingPaper.findMany.mockResolvedValue([{ code: "A1-1000-F001" }]);
    prisma.workingPaper.create.mockResolvedValue({
      id: "zip-paper",
      projectId: "project-1",
      workflowNodeId: "node-1",
    });
    archiveService.createArchive.mockResolvedValue({
      buffer: Buffer.from("archive-bytes"),
      sha256: "archive-sha",
      byteLength: 13,
      entries: [
        "001-Acme_Ltd-Outgoing.pdf",
        "001-Acme_Ltd-Response-01-scan.pdf",
        "confirmation-file-manifest.csv",
      ],
      manifestCsv: "内部序号,源函证代码\r\n001,CONF-001",
    });
    storage.putObject.mockResolvedValue({
      fileName: "confirmation-responses.zip",
      objectKey:
        "working-papers/project-1/zip-paper/confirmation-responses.zip",
    });
    prisma.attachment.create.mockResolvedValue({ id: "zip-attachment" });
    prisma.attachmentVersion.create.mockResolvedValue({ id: "zip-version" });
    prisma.attachment.update.mockResolvedValue({
      id: "zip-attachment",
      headVersionId: "zip-version",
    });
    prisma.confirmationEmpImportItem.update.mockResolvedValue({
      status: "SUCCEEDED",
    });

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-zip",
      "project-1",
      "user-1"
    );

    expect(prisma.workingPaper.create).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: "A1-1000-F001-2" }),
      })
    );
    expect(job.batchCode).toBe("A1-1000-F001-2");

    expect(prisma.workingPaperSignoff.createMany).not.toHaveBeenCalled();
    expect(storage.putCacheObjectIfAbsent).toHaveBeenCalledExactlyOnceWith(
      "working-papers/project-1/emp-import/job-zip/confirmation-responses.zip",
      Buffer.from("archive-bytes"),
      "application/zip"
    );
    expect(archiveService.createArchive).toHaveBeenCalledOnce();
  });

  it("reuses a staged ZIP residual without creating a second paper or archive", async () => {
    const archiveBody = Buffer.from("staged-archive");
    const archiveHash = sha256(archiveBody);
    const objectKey =
      "working-papers/project-1/emp-import/job-zip-residual/confirmation-responses.zip";
    const job = {
      id: "job-zip-residual",
      projectId: "project-1",
      mode: "ZIP",
      items: [
        {
          id: "zip-residual-item",
          status: "RUNNING",
          workingPaperId: "existing-paper",
          attachmentObjectKey: objectKey,
          targetHeadHash: archiveHash,
          attachmentId: null,
          targetHeadVersionId: null,
          sourceKind: "RESPONSE_ARTIFACT",
          sourceObjectKey: "responses/residual.pdf",
          sourceFileName: "residual.pdf",
          sourceMimeType: "application/pdf",
          sourceSize: 1,
          sourceSha256: "source-sha",
          sourceCounterpartyName: "Acme",
          sourceConfirmationCode: "CONF-RESIDUAL",
          packageSequence: 1,
          zipEntryName: "001-Acme-Response-01-residual.pdf",
          workingPaperCode: "A1-1000-F001",
          workingPaperTitle: "Residual ZIP",
        },
      ],
    };
    prisma.workingPaper.create.mockResolvedValue({
      id: "new-paper",
      projectId: "project-1",
      workflowNodeId: "node-1",
    });
    archiveService.createArchive.mockResolvedValue({
      buffer: archiveBody,
      sha256: archiveHash,
      byteLength: archiveBody.byteLength,
      entries: ["001-Acme-Response-01-residual.pdf"],
      manifestCsv: "manifest",
    });
    storage.getObjectBuffer.mockResolvedValue(archiveBody);
    storage.putObject.mockResolvedValue({
      fileName: "confirmation-responses.zip",
      objectKey:
        "working-papers/project-1/new-paper/confirmation-responses.zip",
    });
    prisma.attachment.create.mockResolvedValue({ id: "attachment" });
    prisma.attachmentVersion.create.mockResolvedValue({ id: "version" });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment",
      headVersionId: "version",
    });
    prisma.confirmationEmpImportItem.update.mockResolvedValue({
      status: "SUCCEEDED",
    });

    await (
      createService() as unknown as ImportServiceTestAccess
    ).executeZipItems(job, "node-1", "user-1", job.items);

    expect(prisma.workingPaper.create).not.toHaveBeenCalled();
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(archiveService.createArchive).not.toHaveBeenCalled();
  });

  it("keeps a ZIP atomic when one source fails validation and retries the whole package", async () => {
    const job = {
      id: "job-zip-atomic",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "ZIP",
      status: "QUEUED",
      batchCode: "A1-1000-F001",
      items: [
        {
          id: "zip-conflict",
          status: "QUEUED",
          sourceKind: "RESPONSE_ARTIFACT",
          activeLinkKey: "zip-conflict-link",
          sourceObjectKey: "responses/conflict.pdf",
          sourceFileName: "conflict.pdf",
          sourceMimeType: "application/pdf",
          sourceSize: 10,
          sourceSha256: "conflict-sha",
          workingPaperCode: "A1-1000-F001",
          workingPaperTitle: "Conflict.pdf",
          packageSequence: 1,
          zipEntryName: "001-Conflict.pdf",
        },
        {
          id: "zip-ready",
          status: "QUEUED",
          sourceKind: "RESPONSE_ARTIFACT",
          activeLinkKey: "zip-ready-link",
          sourceObjectKey: "responses/ready.pdf",
          sourceFileName: "ready.pdf",
          sourceMimeType: "application/pdf",
          sourceSize: 12,
          sourceSha256: "ready-sha",
          workingPaperCode: "A1-1000-F002",
          workingPaperTitle: "Ready.pdf",
          packageSequence: 2,
          zipEntryName: "002-Ready.pdf",
        },
      ],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.confirmationEmpImportJob.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        return {
          ...job,
          ...data,
        };
      }
    );
    prisma.workingPaper.findMany.mockImplementation(
      async ({ where }: { where: { code?: string } }) => {
        await Promise.resolve();
        return where.code === "A1-1000-F001"
          ? [{ id: "foreign-paper", code: "A1-1000-F001" }]
          : [];
      }
    );
    prisma.workingPaper.create.mockResolvedValue({
      id: "should-not-be-created",
      projectId: "project-1",
      workflowNodeId: "node-1",
    });
    archiveService.createArchive.mockResolvedValue({
      buffer: Buffer.from("archive-bytes"),
      sha256: "archive-sha",
      byteLength: 14,
      entries: ["001-Conflict.pdf", "002-Ready.pdf"],
      manifestCsv: "内部序号,源函证代码\r\n001,CONF-001",
    });
    storage.putObject.mockResolvedValue({
      fileName: "confirmation-responses.zip",
      objectKey:
        "working-papers/project-1/should-not-be-created/confirmation-responses.zip",
    });
    prisma.attachment.create.mockResolvedValue({ id: "should-not-be-created" });
    prisma.attachmentVersion.create.mockResolvedValue({
      id: "should-not-be-created",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "should-not-be-created",
      headVersionId: "should-not-be-created",
    });

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-zip-atomic",
      "project-1",
      "user-1"
    );

    expect(job.items.map((item) => item.status)).toStrictEqual([
      "FAILED",
      "FAILED",
    ]);
    expect(prisma.workingPaper.create).not.toHaveBeenCalled();
    expect(prisma.attachment.create).not.toHaveBeenCalled();
    expect(prisma.attachmentVersion.create).not.toHaveBeenCalled();
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(archiveService.createArchive).not.toHaveBeenCalled();

    const retryService = createService();
    const retryJob = {
      ...job,
      status: "FAILED",
      items: job.items.map((item) => ({ ...item, status: "FAILED" })),
    };
    prisma.confirmationEmpImportJob.findFirst.mockResolvedValue(retryJob);
    prisma.confirmationEmpImportJob.update.mockResolvedValue(retryJob);
    const executeSpy = vi
      .spyOn(retryService, "executeJob")
      .mockResolvedValue(null);

    await retryService.retryJob("project-1", user as never, "job-zip-atomic");

    expect(
      prisma.confirmationEmpImportItem.updateMany
    ).toHaveBeenLastCalledWith({
      where: { jobId: "job-zip-atomic", status: "FAILED" },
      data: { status: "QUEUED", errorCode: null, errorMessage: null },
    });
    expect(executeSpy).toHaveBeenCalledWith(
      "job-zip-atomic",
      "project-1",
      "user-1"
    );
  });

  it.each(["archive", "storage", "attachment", "item-linkage"] as const)(
    "compensates every ZIP target when %s fails",
    async (failurePoint) => {
      const job = {
        id: `job-zip-${failurePoint}`,
        projectId: "project-1",
        targetWorkflowNodeId: "node-1",
        mode: "ZIP",
        status: "QUEUED",
        batchCode: "A1-1000-F009",
        items: [
          {
            id: `zip-${failurePoint}-1`,
            status: "QUEUED",
            sourceKind: "RESPONSE_ARTIFACT",
            activeLinkKey: `zip-${failurePoint}-link-1`,
            sourceObjectKey: "responses/one.pdf",
            sourceFileName: "one.pdf",
            sourceMimeType: "application/pdf",
            sourceSize: 10,
            sourceSha256: "one-sha",
            workingPaperCode: "A1-1000-F009",
            workingPaperTitle: "One.pdf",
            packageSequence: 1,
            zipEntryName: "001-One.pdf",
          },
          {
            id: `zip-${failurePoint}-2`,
            status: "QUEUED",
            sourceKind: "RESPONSE_ARTIFACT",
            activeLinkKey: `zip-${failurePoint}-link-2`,
            sourceObjectKey: "responses/two.pdf",
            sourceFileName: "two.pdf",
            sourceMimeType: "application/pdf",
            sourceSize: 12,
            sourceSha256: "two-sha",
            workingPaperCode: "A1-1000-F009",
            workingPaperTitle: "Two.pdf",
            packageSequence: 2,
            zipEntryName: "002-Two.pdf",
          },
        ],
      };
      mockZipSourceMetadata(job.items);
      prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
      prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({
        count: 1,
      });
      prisma.confirmationEmpImportJob.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => {
          await Promise.resolve();
          return {
            ...job,
            ...data,
          };
        }
      );
      prisma.workingPaper.create.mockResolvedValue({
        id: `paper-${failurePoint}`,
        projectId: "project-1",
        workflowNodeId: "node-1",
      });
      archiveService.createArchive.mockResolvedValue({
        buffer: Buffer.from("zip-bytes"),
        sha256: "zip-sha",
        byteLength: 9,
        entries: ["001-One.pdf", "002-Two.pdf"],
        manifestCsv: "manifest",
      });
      storage.putObject.mockResolvedValue({
        fileName: "confirmation-responses.zip",
        objectKey: `working-papers/project-1/paper-${failurePoint}/confirmation-responses.zip`,
      });
      prisma.attachment.create.mockResolvedValue({
        id: `attachment-${failurePoint}`,
      });
      prisma.attachmentVersion.create.mockResolvedValue({
        id: `version-${failurePoint}`,
      });
      prisma.attachment.update.mockResolvedValue({
        id: `attachment-${failurePoint}`,
        headVersionId: `version-${failurePoint}`,
      });
      prisma.confirmationEmpImportItem.update.mockResolvedValue({
        status: "RUNNING",
      });

      if (failurePoint === "archive") {
        archiveService.createArchive.mockRejectedValue(
          new Error("ARCHIVE_FAILED")
        );
      } else if (failurePoint === "storage") {
        storage.putCacheObjectIfAbsent.mockRejectedValue(
          new Error("STORAGE_FAILED")
        );
      } else if (failurePoint === "attachment") {
        prisma.attachment.create.mockRejectedValue(
          new Error("ATTACHMENT_FAILED")
        );
      } else {
        prisma.$transaction
          .mockImplementationOnce(
            async (callback: (tx: typeof prisma) => unknown) => {
              await Promise.resolve();
              return callback(prisma);
            }
          )
          .mockRejectedValueOnce(new Error("ITEM_LINKAGE_FAILED"))
          .mockImplementationOnce(
            async (callback: (tx: typeof prisma) => unknown) => {
              await Promise.resolve();
              return callback(prisma);
            }
          );
      }

      await (createService() as unknown as ImportServiceTestAccess).executeJob(
        job.id,
        "project-1",
        "user-1"
      );

      expect(job.items.map((item) => item.status)).toStrictEqual([
        "FAILED",
        "FAILED",
      ]);
      expect(prisma.workingPaperSignoff.deleteMany.mock.calls).toStrictEqual(
        failurePoint === "archive"
          ? []
          : [[{ where: { workingPaperId: `paper-${failurePoint}` } }]]
      );
      expect(prisma.attachmentVersion.deleteMany.mock.calls).toStrictEqual(
        failurePoint === "archive"
          ? []
          : [
              [
                {
                  where: {
                    attachment: { workingPaperId: `paper-${failurePoint}` },
                  },
                },
              ],
            ]
      );
      expect(prisma.attachment.deleteMany.mock.calls).toStrictEqual(
        failurePoint === "archive"
          ? []
          : [[{ where: { workingPaperId: `paper-${failurePoint}` } }]]
      );
      expect(prisma.workingPaper.delete.mock.calls).toStrictEqual(
        failurePoint === "archive"
          ? []
          : [[{ where: { id: `paper-${failurePoint}` } }]]
      );
      expect(storage.deleteObjectIfPresent.mock.calls).toStrictEqual(
        failurePoint === "archive"
          ? []
          : [
              [
                `working-papers/project-1/emp-import/job-zip-${failurePoint}/confirmation-responses.zip`,
              ],
            ]
      );
      expect(prisma.confirmationEmpImportJob.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "FAILED" }),
        })
      );
      expect(storage.deleteObject).not.toHaveBeenCalled();
    }
  );

  it("renames a conflicting grouped directory and its generated child codes", async () => {
    const body = Buffer.from("0123456789");
    const job = {
      id: "job-grouped",
      projectId: "project-1",
      targetWorkflowNodeId: "group-parent",
      mode: "GROUPED",
      status: "QUEUED",
      createdBy: "user-1",
      batchCode: "IMPORT-001",
      batchTitle: "Confirmation responses-2026-08-05",
      targetWorkflowNode: {
        id: "group-parent",
        projectId: "project-1",
        code: "A1",
        level: 2,
      },
      items: [
        {
          id: "group-item-1",
          status: "QUEUED",
          sourceObjectKey: "responses/grouped.pdf",
          sourceMimeType: "application/pdf",
          sourceSize: body.length,
          sourceSha256: sha256(body),
          sourceKind: "RESPONSE_ARTIFACT",
          activeLinkKey: "group-link",
          workingPaperCode: "IMPORT-001.01",
          workingPaperTitle: "Acme-Response-01-grouped.pdf",
          prepareUserId: null,
          reviewUserId: null,
        },
        {
          id: "group-item-custom",
          status: "QUEUED",
          sourceObjectKey: "responses/grouped-custom.pdf",
          sourceMimeType: "application/pdf",
          sourceSize: body.length,
          sourceSha256: sha256(body),
          sourceKind: "RESPONSE_ARTIFACT",
          activeLinkKey: "group-custom-link",
          workingPaperCode: "IMPORT-001.CUSTOM",
          workingPaperTitle: "Custom grouped.pdf",
          prepareUserId: null,
          reviewUserId: null,
        },
      ],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.confirmationEmpImportJob.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        return {
          ...job,
          ...data,
        };
      }
    );
    prisma.workflowNode.findMany.mockResolvedValue([
      { sortOrder: 1, code: "IMPORT-001" },
    ]);
    prisma.workflowNode.create.mockResolvedValue({
      id: "group-child",
      projectId: "project-1",
      parentId: "group-parent",
      level: 3,
      code: "IMPORT-001-2",
      title: "Confirmation responses-2026-08-05",
    });
    prisma.workingPaper.create.mockResolvedValue({
      id: "group-paper",
      projectId: "project-1",
      workflowNodeId: "group-child",
    });
    storage.getObjectBuffer.mockResolvedValue(body);
    storage.putObject.mockResolvedValue({
      fileName: "grouped.pdf",
      objectKey: "working-papers/project-1/group-paper/grouped.pdf",
    });
    prisma.attachment.create.mockResolvedValue({ id: "group-attachment" });
    prisma.attachmentVersion.create.mockResolvedValue({ id: "group-version" });
    prisma.attachment.update.mockResolvedValue({
      id: "group-attachment",
      headVersionId: "group-version",
    });
    prisma.confirmationEmpImportItem.update.mockResolvedValue({
      status: "SUCCEEDED",
    });

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-grouped",
      "project-1",
      "user-1"
    );

    expect(prisma.workflowNode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentId: "group-parent",
          level: 3,
          code: "IMPORT-001-2",
          title: "Confirmation responses-2026-08-05",
        }),
      })
    );
    expect(prisma.workingPaper.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowNodeId: "group-child",
          code: "IMPORT-001-2.01",
        }),
      })
    );
    expect(prisma.workingPaper.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowNodeId: "group-child",
          code: "IMPORT-001.CUSTOM",
        }),
      })
    );
  });

  it("creates GROUPED directory for valid items while isolating stale items for partial retry", async () => {
    const validBody = Buffer.from("valid-grouped-source");
    const job = {
      id: "job-grouped-partial",
      projectId: "project-1",
      targetWorkflowNodeId: "group-parent",
      mode: "GROUPED",
      status: "QUEUED",
      targetWorkflowNode: {
        id: "group-parent",
        projectId: "project-1",
        code: "A1",
        level: 2,
      },
      batchCode: "IMPORT-PARTIAL",
      batchTitle: "Grouped partial",
      items: [
        {
          id: "group-stale",
          status: "QUEUED",
          sourceObjectKey: "responses/stale-grouped.bin",
          sourceMimeType: "application/octet-stream",
          sourceSize: 1,
          sourceSha256: "stale-sha",
          sourceKind: "RESPONSE_ARTIFACT",
          activeLinkKey: "group-stale-link",
          workingPaperCode: "A1-1000-F001",
          workingPaperTitle: "Stale grouped.bin",
        },
        {
          id: "group-valid",
          status: "QUEUED",
          sourceObjectKey: "responses/valid-grouped.bin",
          sourceMimeType: "application/octet-stream",
          sourceSize: validBody.byteLength,
          sourceSha256: sha256(validBody),
          sourceKind: "RESPONSE_ARTIFACT",
          activeLinkKey: "group-valid-link",
          workingPaperCode: "A1-1000-F002",
          workingPaperTitle: "Valid grouped.bin",
        },
      ],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.confirmationEmpImportJob.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        return {
          ...job,
          ...data,
        };
      }
    );
    prisma.workflowNode.findMany.mockResolvedValue([]);
    prisma.workflowNode.create.mockResolvedValue({
      id: "group-partial-child",
      projectId: "project-1",
      parentId: "group-parent",
      level: 3,
      code: "IMPORT-PARTIAL",
      title: "Grouped partial",
    });
    prisma.workingPaper.create.mockResolvedValue({
      id: "group-partial-paper",
      projectId: "project-1",
      workflowNodeId: "group-partial-child",
    });
    storage.getObjectBuffer.mockImplementation(async (objectKey: string) => {
      await Promise.resolve();
      if (objectKey === "responses/stale-grouped.bin") {
        throw new Error("stale source");
      }
      return validBody;
    });
    storage.putObject.mockResolvedValue({
      fileName: "valid-grouped.bin",
      objectKey:
        "working-papers/project-1/group-partial-paper/valid-grouped.bin",
    });
    prisma.attachment.create.mockResolvedValue({
      id: "group-partial-attachment",
    });
    prisma.attachmentVersion.create.mockResolvedValue({
      id: "group-partial-version",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "group-partial-attachment",
      headVersionId: "group-partial-version",
    });
    prisma.confirmationEmpImportItem.update.mockResolvedValue({});

    const service = createService();
    await (service as unknown as ImportServiceTestAccess).executeJob(
      "job-grouped-partial",
      "project-1",
      "user-1"
    );

    expect(prisma.workflowNode.create).toHaveBeenCalledOnce();
    expect(prisma.workingPaper.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowNodeId: "group-partial-child",
        }),
      })
    );
    expect(job.items.map((item) => item.status)).toStrictEqual([
      "FAILED",
      "SUCCEEDED",
    ]);
    expect(prisma.confirmationEmpImportItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "group-stale" },
        data: expect.objectContaining({
          errorCode: "SOURCE_OBJECT_UNAVAILABLE",
        }),
      })
    );
    expect(prisma.confirmationEmpImportJob.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PARTIAL_FAILURE" }),
      })
    );

    const retryJob = {
      ...job,
      status: "PARTIAL_FAILURE",
      batchWorkflowNodeId: "group-partial-child",
      items: [
        { ...job.items[0], status: "FAILED" },
        { ...job.items[1], status: "SUCCEEDED" },
      ],
    };
    prisma.confirmationEmpImportJob.findFirst.mockResolvedValue(retryJob);
    prisma.confirmationEmpImportJob.update.mockResolvedValue({
      ...retryJob,
      status: "QUEUED",
    });
    prisma.confirmationEmpImportItem.updateMany.mockResolvedValue({ count: 1 });
    const executeSpy = vi.spyOn(service, "executeJob").mockResolvedValue(null);

    await service.retryJob("project-1", user as never, "job-grouped-partial");

    expect(prisma.confirmationEmpImportItem.updateMany).toHaveBeenCalledWith({
      where: { jobId: "job-grouped-partial", status: "FAILED" },
      data: { status: "QUEUED", errorCode: null, errorMessage: null },
    });
    expect(executeSpy).toHaveBeenCalledWith(
      "job-grouped-partial",
      "project-1",
      "user-1"
    );
  });

  it("marks pending items failed when grouped directory creation fails", async () => {
    const body = Buffer.from("grouped-node-failure");
    const job = {
      id: "job-grouped-node-failure",
      projectId: "project-1",
      targetWorkflowNodeId: "group-parent",
      mode: "GROUPED",
      status: "QUEUED",
      targetWorkflowNode: {
        id: "group-parent",
        projectId: "project-1",
        code: "A1",
        level: 2,
      },
      items: [
        {
          id: "group-pending",
          status: "QUEUED",
          sourceObjectKey: "responses/grouped-node-failure.pdf",
          sourceMimeType: "application/pdf",
          sourceSize: body.length,
          sourceSha256: sha256(body),
          sourceKind: "RESPONSE_ARTIFACT",
          activeLinkKey: "grouped-node-failure-link",
          workingPaperCode: "A1-1000-F001",
          workingPaperTitle: "Grouped node failure.pdf",
        },
        { id: "group-success", status: "SUCCEEDED" },
      ],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.confirmationEmpImportJob.update.mockResolvedValue({
      ...job,
      status: "FAILED",
    });
    prisma.workflowNode.findMany.mockResolvedValue([]);
    prisma.workflowNode.create.mockRejectedValue(new Error("node unavailable"));
    storage.getObjectBuffer.mockResolvedValue(body);

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-grouped-node-failure",
      "project-1",
      "user-1"
    );

    expect(prisma.confirmationEmpImportItem.updateMany).toHaveBeenCalledWith({
      where: {
        jobId: "job-grouped-node-failure",
        status: { not: "SUCCEEDED" },
      },
      data: {
        status: "FAILED",
        errorCode: "IMPORT_FAILED",
        errorMessage:
          "The confirmation EMP import failed; repair the source and retry.",
      },
    });
  });

  it("renumbers and retries a flat paper after a concurrent code conflict", async () => {
    const body = Buffer.from("0123456789");
    const job = {
      id: "job-conflict",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      status: "QUEUED",
      items: [
        {
          id: "conflict-item",
          status: "QUEUED",
          sourceObjectKey: "responses/conflict.pdf",
          sourceMimeType: "application/pdf",
          sourceSize: body.length,
          sourceSha256: sha256(body),
          sourceKind: "RESPONSE_ARTIFACT",
          activeLinkKey: "conflict-link",
          workingPaperCode: "A1-1000-F001",
          workingPaperTitle: "Conflict.pdf",
        },
      ],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.confirmationEmpImportJob.update.mockResolvedValue({
      ...job,
      status: "FAILED",
    });
    prisma.workingPaper.create
      .mockRejectedValueOnce({ code: "P2002" })
      .mockResolvedValue({
        id: "conflict-paper",
        projectId: "project-1",
        workflowNodeId: "node-1",
      });
    storage.getObjectBuffer.mockResolvedValue(body);
    storage.putObject.mockResolvedValue({
      fileName: "Conflict.pdf",
      objectKey: "working-papers/project-1/conflict-paper/Conflict.pdf",
    });
    prisma.attachment.create.mockResolvedValue({ id: "conflict-attachment" });
    prisma.attachmentVersion.create.mockResolvedValue({
      id: "conflict-version",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "conflict-attachment",
      headVersionId: "conflict-version",
    });
    prisma.confirmationEmpImportItem.update.mockResolvedValue({
      id: "conflict-item",
      status: "SUCCEEDED",
    });

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-conflict",
      "project-1",
      "user-1"
    );

    expect(prisma.workingPaper.create).toHaveBeenCalledTimes(2);
    expect(prisma.workingPaper.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "A1-1000-F001-2",
        }),
      })
    );
    expect(job.items[0].status).toBe("SUCCEEDED");
  });

  it("cleans the ZIP paper when archive source storage fails", async () => {
    const job = {
      id: "job-zip-cleanup",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "ZIP",
      status: "QUEUED",
      items: [
        {
          id: "zip-cleanup-item",
          status: "QUEUED",
          sourceObjectKey: "responses/missing.zip-source",
          sourceMimeType: "application/octet-stream",
          sourceSize: 1,
          sourceSha256: "zip-missing-sha",
          sourceKind: "RESPONSE_ARTIFACT",
          sourceCounterpartyName: "Acme",
          sourceFileName: "missing.bin",
          sourceConfirmationCode: "CONF-ZIP",
          activeLinkKey: "zip-cleanup-link",
          packageSequence: 1,
          zipEntryName: "001-Acme-Response-01-missing.bin",
          workingPaperCode: "A1-1000-F001",
          workingPaperTitle: "ZIP import",
        },
      ],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.confirmationEmpImportJob.update.mockResolvedValue({
      ...job,
      status: "FAILED",
    });
    prisma.workingPaper.create.mockResolvedValue({
      id: "zip-cleanup-paper",
      projectId: "project-1",
      workflowNodeId: "node-1",
    });
    storage.getObjectBuffer.mockRejectedValue(new Error("missing source"));
    prisma.confirmationEmpImportItem.update.mockResolvedValue({
      id: "zip-cleanup-item",
      status: "FAILED",
    });

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-zip-cleanup",
      "project-1",
      "user-1"
    );

    expect(prisma.workingPaper.delete).not.toHaveBeenCalled();
  });

  it("renumbers and retries the ZIP paper when its code races", async () => {
    const job = {
      id: "job-zip-code-conflict",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "ZIP",
      status: "QUEUED",
      batchCode: "A1-1000-F001",
      items: [
        {
          id: "zip-code-conflict-item",
          status: "QUEUED",
          sourceObjectKey: "responses/conflict.zip-source",
          sourceKind: "RESPONSE_ARTIFACT",
          activeLinkKey: "zip-code-conflict-link",
          sourceCounterpartyName: "Acme",
          sourceConfirmationCode: "CONF-ZIP-CONFLICT",
          sourceFileName: "conflict.pdf",
          sourceSize: 1,
          sourceSha256: "zip-conflict-sha",
          packageSequence: 1,
          zipEntryName: "001-Acme-Response-01-conflict.pdf",
          workingPaperCode: "A1-1000-F001",
          workingPaperTitle: "ZIP import",
        },
      ],
    };
    mockZipSourceMetadata(job.items);
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.confirmationEmpImportJob.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        return {
          ...job,
          ...data,
        };
      }
    );
    prisma.workingPaper.create
      .mockRejectedValueOnce({ code: "P2002" })
      .mockResolvedValue({
        id: "zip-code-conflict-paper",
        projectId: "project-1",
        workflowNodeId: "node-1",
      });
    archiveService.createArchive.mockResolvedValue({
      buffer: Buffer.from("zip-bytes"),
      sha256: "zip-sha",
      byteLength: 9,
      entries: ["001-Acme-Response-01-conflict.pdf"],
      manifestCsv: "manifest",
    });
    prisma.attachment.create.mockResolvedValue({
      id: "zip-code-conflict-attachment",
    });
    prisma.attachmentVersion.create.mockResolvedValue({
      id: "zip-code-conflict-version",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "zip-code-conflict-attachment",
      headVersionId: "zip-code-conflict-version",
    });
    prisma.confirmationEmpImportItem.update.mockResolvedValue({
      id: "zip-code-conflict-item",
      status: "SUCCEEDED",
    });

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-zip-code-conflict",
      "project-1",
      "user-1"
    );

    expect(prisma.workingPaper.create).toHaveBeenCalledTimes(2);
    expect(prisma.workingPaper.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "A1-1000-F001-2",
        }),
      })
    );
    expect(job.items[0].status).toBe("SUCCEEDED");
  });

  it("uses only the latest effective MATCHED PROGRAM_COMPLETED review actor", async () => {
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "confirmation-review-lifecycle",
        projectId: "project-1",
        status: "CLOSED",
        differenceStatus: "MATCHED",
        counterpartyName: "Acme",
        createdBy: "preparer-1",
        currentArtifact: {
          id: "outgoing-review-lifecycle",
          disposition: "ACTIVE",
          pdfObjectKey: "confirmations/review-lifecycle.pdf",
          pdfSize: 1,
          pdfSha256: "outgoing-review-sha",
          submittedAt: new Date("2026-08-01T09:00:00.000Z"),
        },
        responses: [
          {
            id: "response-review-lifecycle",
            routingStatus: "ROUTED",
            receivedAt: new Date("2026-08-02T09:00:00.000Z"),
            artifacts: [
              {
                id: "response-review-lifecycle-artifact",
                objectKey: "responses/review-lifecycle.pdf",
                fileName: "response.pdf",
                mimeType: "application/pdf",
                fileSize: 1,
                sha256: "response-review-sha",
              },
            ],
          },
        ],
        followUpEvents: [
          {
            id: "matched-review-old",
            eventType: "PROGRAM_COMPLETED",
            actorId: "reviewer-old",
            payload: {
              transition: "REVIEW",
              result: "MATCHED",
              responseId: "response-review-lifecycle",
            },
            occurredAt: new Date("2026-08-03T09:00:00.000Z"),
          },
          {
            id: "unrelated-review",
            eventType: "REVIEW_RECORDED",
            actorId: "unrelated-reviewer",
            payload: {
              transition: "REVIEW",
              result: "MATCHED",
              responseId: "response-review-lifecycle",
            },
            occurredAt: new Date("2026-08-03T10:00:00.000Z"),
          },
          {
            id: "matched-review-retracted",
            eventType: "PROGRAM_COMPLETED",
            actorId: "reviewer-retracted",
            payload: {
              transition: "REVIEW",
              result: "MATCHED",
              responseId: "response-review-lifecycle",
            },
            occurredAt: new Date("2026-08-03T11:00:00.000Z"),
          },
          {
            id: "review-retraction",
            eventType: "REVIEW_RETRACTED",
            actorId: "retractor-1",
            payload: {
              transition: "ROLLBACK",
              targetEventId: "matched-review-retracted",
              responseId: "response-review-lifecycle",
            },
            occurredAt: new Date("2026-08-03T12:00:00.000Z"),
          },
        ],
      },
    ]);

    const preview = await createService().preview("project-1", user as never, {
      confirmationIds: ["confirmation-review-lifecycle"],
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
    });

    expect(
      preview.sources.every((source) => source.reviewUserId === "reviewer-old")
    ).toBeTruthy();
    expect(
      preview.sources.every(
        (source) =>
          source.reviewAt?.toISOString() === "2026-08-03T09:00:00.000Z"
      )
    ).toBeTruthy();
  });

  it("previews every eligible confirmation when confirmationIds are omitted", async () => {
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "confirmation-default-all",
        projectId: "project-1",
        status: "CLOSED",
        differenceStatus: "MATCHED",
        counterpartyName: "Default Eligible",
        currentArtifact: {
          id: "outgoing-default-all",
          disposition: "ACTIVE",
          pdfObjectKey: "confirmations/default-all.pdf",
          pdfSize: 1,
          pdfSha256: "default-all-sha",
          submittedAt: new Date("2026-08-01T09:00:00.000Z"),
        },
        responses: [
          {
            id: "response-default-all",
            routingStatus: "ROUTED",
            receivedAt: new Date("2026-08-02T09:00:00.000Z"),
            artifacts: [
              {
                id: "response-default-all-artifact",
                objectKey: "responses/default-all.pdf",
                fileName: "default-all.pdf",
                mimeType: "application/pdf",
                fileSize: 1,
                sha256: "default-all-response-sha",
              },
            ],
          },
        ],
      },
    ]);

    const preview = await (
      createService() as unknown as ImportServiceTestAccess
    ).preview("project-1", user, {
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
    });

    expect(prisma.projectConfirmation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "project-1",
          status: "CLOSED",
          differenceStatus: "MATCHED",
        }),
      })
    );
    expect(
      new Set(preview.sources.map((source) => source.confirmationId))
    ).toStrictEqual(new Set(["confirmation-default-all"]));
  });

  it("excludes an uploaded outgoing source while preserving response metadata", async () => {
    storage.getObjectMetadata.mockImplementation(async (objectKey: string) => {
      await Promise.resolve();
      if (objectKey === "confirmation-artifacts/raw/original.mystery") {
        return {
          contentLength: 17,
          contentType: "application/x-unknown-document",
          contentSha256: "raw-outgoing-sha",
        };
      }
      return {
        contentLength: 3,
        contentType: "application/x-response-data",
        contentSha256: "response-unknown-sha",
      };
    });
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "confirmation-unknown-outgoing",
        projectId: "project-1",
        status: "CLOSED",
        differenceStatus: "MATCHED",
        counterpartyName: "Acme",
        attachmentName: "original.mystery",
        currentArtifact: {
          id: "outgoing-unknown",
          disposition: "ACTIVE",
          docxObjectKey: "confirmation-artifacts/raw/original.mystery",
          docxSize: 17,
          structuredSnapshot: {
            source: {
              fileName: "original.mystery",
              mimeType: "application/x-unknown-document",
            },
          },
          pdfObjectKey: "confirmations/rendered.pdf",
          pdfSize: 1,
          pdfSha256: "rendered-pdf-sha",
          submittedAt: new Date("2026-08-01T09:00:00.000Z"),
        },
        responses: [
          {
            id: "response-unknown-outgoing",
            routingStatus: "ROUTED",
            receivedAt: new Date("2026-08-02T09:00:00.000Z"),
            artifacts: [
              {
                id: "response-unknown-artifact",
                objectKey: "responses/original.data",
                fileName: "original.data",
                mimeType: "application/x-response-data",
                fileSize: 3,
                sha256: "response-unknown-sha",
              },
            ],
          },
        ],
      },
    ]);

    const preview = await createService().preview("project-1", user as never, {
      confirmationIds: ["confirmation-unknown-outgoing"],
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
    });
    expect(
      preview.sources.some(
        (source) => source.sourceKind === "OUTGOING_ARTIFACT"
      )
    ).toBeFalsy();
    expect(storage.getObjectMetadata).not.toHaveBeenCalledWith(
      "confirmation-artifacts/raw/original.mystery"
    );
    expect(
      preview.sources.find(
        (source) => source.sourceKind === "RESPONSE_ARTIFACT"
      )
    ).toStrictEqual(
      expect.objectContaining({
        originalFileName: "original.data",
        mimeType: "application/x-response-data",
        businessName: "Acme-Response-01-original.data",
      })
    );
  });

  it("delegates ZIP bytes and manifest naming to the archive service once", async () => {
    const job = {
      id: "job-archive-service",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "ZIP",
      status: "QUEUED",
      batchCode: "A1-1000-F001",
      batchTitle: "Confirmation archive",
      items: [
        {
          id: "archive-outgoing-item",
          status: "QUEUED",
          sourceObjectKey: "confirmations/outgoing.pdf",
          sourceKind: "OUTGOING_ARTIFACT",
          activeLinkKey: "archive-outgoing-link",
          sourceCounterpartyName: "Acme",
          sourceConfirmationCode: "CONF-ARCHIVE",
          sourceFileName: "outgoing.pdf",
          sourceMimeType: "application/pdf",
          sourceSize: 2,
          sourceSha256: "archive-outgoing-sha",
          packageSequence: 1,
          zipEntryName: "001-Acme-Outgoing.pdf",
          workingPaperCode: "A1-1000-F001",
          workingPaperTitle: "Acme archive",
        },
        {
          id: "archive-response-item",
          confirmationId: "confirmation-archive",
          status: "QUEUED",
          sourceObjectKey: "responses/response.data",
          sourceKind: "RESPONSE_ARTIFACT",
          responseId: "response-archive",
          responseArtifactId: "response-archive-artifact",
          activeLinkKey: "archive-response-link",
          sourceCounterpartyName: "Acme",
          sourceConfirmationCode: "CONF-ARCHIVE",
          sourceFileName: "response.data",
          sourceMimeType: "application/x-response-data",
          sourceSize: 3,
          sourceSha256: "archive-response-sha",
          packageSequence: 1,
          zipEntryName: "001-Acme-Response-01-response.data",
          workingPaperCode: "A1-1000-F001",
          workingPaperTitle: "Acme archive",
        },
      ],
    };
    mockZipSourceMetadata(job.items);
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.confirmationEmpImportJob.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        return {
          ...job,
          ...data,
        };
      }
    );
    prisma.workingPaper.create.mockResolvedValue({
      id: "archive-paper",
      projectId: "project-1",
      workflowNodeId: "node-1",
    });
    archiveService.createArchive.mockResolvedValue({
      buffer: Buffer.from("archive-bytes"),
      sha256: "archive-sha",
      byteLength: 13,
      entries: [
        "001-Acme-Outgoing.pdf",
        "001-Acme-Response-01-response.data",
        "confirmation-file-manifest.csv",
      ],
      manifestCsv: "manifest",
    });
    storage.putObject.mockResolvedValue({
      objectKey: "emp/archive.zip",
      fileName: "confirmation-responses.zip",
    });
    prisma.attachment.create.mockResolvedValue({ id: "archive-attachment" });
    prisma.attachmentVersion.create.mockResolvedValue({
      id: "archive-version",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "archive-attachment",
      headVersionId: "archive-version",
    });
    prisma.confirmationEmpImportItem.update.mockResolvedValue({
      status: "SUCCEEDED",
    });

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-archive-service",
      "project-1",
      "user-1"
    );

    expect(prisma.confirmationFollowUpEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        confirmationId: "confirmation-archive",
        eventType: "PROGRAM_COMPLETED",
        actorId: "user-1",
        payload: expect.objectContaining({
          operation: "RESPONSE_ARCHIVED_TO_EMP",
          importJobId: job.id,
          responseArtifactId: "response-archive-artifact",
          mode: "ZIP",
        }),
      }),
    });
    expect(archiveService.createArchive).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({
        objectKey: "confirmations/outgoing.pdf",
        role: "OUTGOING",
        originalName: "outgoing.pdf",
      }),
      expect.objectContaining({
        objectKey: "responses/response.data",
        role: "RESPONSE_ORIGINAL",
        originalName: "response.data",
      }),
    ]);
    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "working-papers/project-1/emp-import/job-archive-service/confirmation-responses.zip"
    );
    expect(prisma.workingPaper.create).toHaveBeenCalledOnce();
    expect(prisma.attachment.create).toHaveBeenCalledOnce();
  });

  it("rechecks active modifyIndex access before a worker claims execution", async () => {
    const job = {
      id: "job-execution-access",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      status: "QUEUED",
      items: [
        { id: "pending-item", status: "QUEUED" },
        { id: "successful-item", status: "SUCCEEDED" },
      ],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      status: "ACTIVE",
    });
    access.requireProjectAction.mockRejectedValue(
      new Error("MODIFY_INDEX_REQUIRED")
    );
    prisma.confirmationEmpImportJob.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        return {
          ...job,
          ...data,
        };
      }
    );

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-execution-access",
      "project-1",
      "user-1"
    );

    expect(prisma.confirmationEmpImportItem.updateMany).toHaveBeenCalledWith({
      where: { jobId: "job-execution-access", status: { not: "SUCCEEDED" } },
      data: {
        status: "FAILED",
        errorCode: "PERMISSION_DENIED",
        errorMessage: "You are not allowed to execute this import.",
      },
    });
    expect(prisma.confirmationEmpImportJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-execution-access" },
        data: expect.objectContaining({
          status: "PARTIAL_FAILURE",
          lastError: "You are not allowed to execute this import.",
          completedAt: expect.any(Date),
        }),
      })
    );
  });

  it("fails only the pending item when its source fingerprint changed before execution", async () => {
    const job = {
      id: "job-source-fingerprint",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      status: "QUEUED",
      previewFingerprint: "preview-fingerprint",
      items: [
        {
          id: "source-fingerprint-item",
          status: "QUEUED",
          confirmationId: "confirmation-fingerprint",
          sourceKind: "RESPONSE_ARTIFACT",
          responseId: "response-fingerprint",
          responseArtifactId: "response-fingerprint-artifact",
          activeLinkKey: "fingerprint-link",
          sourceObjectKey: "responses/current.pdf",
          sourceFileName: "current.pdf",
          sourceMimeType: "application/pdf",
          sourceSize: 1,
          sourceSha256: "preview-sha",
          workingPaperCode: "A1-1000-F001",
          workingPaperTitle: "Current response",
        },
      ],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.confirmationEmpImportJob.update.mockResolvedValue({
      ...job,
      status: "FAILED",
    });
    prisma.confirmationEmpImportItem.update.mockResolvedValue({
      id: "source-fingerprint-item",
      status: "FAILED",
    });
    const service = createService();
    vi.spyOn(service, "preview").mockResolvedValue({
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      sources: [
        {
          confirmationId: "confirmation-fingerprint",
          confirmationCode: "CONF-FINGERPRINT",
          counterpartyName: "Acme",
          sourceKind: "RESPONSE_ARTIFACT",
          sourceArtifactId: "response-fingerprint-artifact",
          responseId: "response-fingerprint",
          responseArtifactId: "response-fingerprint-artifact",
          sourceObjectKey: "responses/current.pdf",
          originalFileName: "current.pdf",
          mimeType: "application/pdf",
          fileSize: 1,
          sourceSha256: "changed-sha",
          activeLinkKey: "fingerprint-link",
          paperCode: "A1-1000-F001",
          businessName: "Acme-Response-01-current.pdf",
          prepareUserId: null,
          prepareAt: null,
          reviewUserId: null,
          reviewAt: null,
          packageSequence: null,
          zipEntryName: null,
        },
      ],
      skipped: [],
      issues: [],
      fingerprint: "changed-preview",
    });

    await (service as unknown as ImportServiceTestAccess).executeJob(
      "job-source-fingerprint",
      "project-1",
      "user-1"
    );

    expect(prisma.workingPaper.create).not.toHaveBeenCalled();
    expect(prisma.confirmationEmpImportItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "source-fingerprint-item" },
        data: expect.objectContaining({
          status: "FAILED",
          errorCode: "SOURCE_FINGERPRINT_CHANGED",
        }),
      })
    );
  });

  it("automatically renames an item when its target code is unavailable", async () => {
    const job = {
      id: "job-target-code",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      status: "QUEUED",
      previewFingerprint: "target-code-preview",
      items: [
        {
          id: "target-code-item",
          status: "QUEUED",
          confirmationId: "confirmation-target-code",
          sourceKind: "RESPONSE_ARTIFACT",
          responseId: "response-target-code",
          responseArtifactId: "target-code-artifact",
          activeLinkKey: "target-code-link",
          sourceObjectKey: "responses/target-code.pdf",
          sourceFileName: "target-code.pdf",
          sourceMimeType: "application/pdf",
          sourceSize: 1,
          sourceSha256: "target-code-sha",
          workingPaperCode: "A1-1000-F001",
          workingPaperTitle: "Target code",
        },
      ],
    };
    prisma.workingPaper.findMany.mockResolvedValue([{ code: "A1-1000-F001" }]);
    prisma.confirmationEmpImportItem.update.mockResolvedValue({
      id: "target-code-item",
      workingPaperCode: "A1-1000-F001-2",
    });
    const service = createService();

    await (
      service as unknown as ImportServiceTestAccess
    ).ensureAvailableWorkingPaperCode(job, job.items[0], "node-1");

    expect(prisma.confirmationEmpImportItem.update).toHaveBeenCalledWith({
      where: { id: "target-code-item" },
      data: { workingPaperCode: "A1-1000-F001-2" },
    });
    expect(job.items[0].workingPaperCode).toBe("A1-1000-F001-2");
  });

  it("renames one ZIP code consistently across all response items", async () => {
    const items = [
      { id: "zip-item-1", workingPaperCode: "A1-1000-F001" },
      { id: "zip-item-2", workingPaperCode: "A1-1000-F001" },
    ];
    prisma.workingPaper.findMany.mockResolvedValue([{ code: "A1-1000-F001" }]);
    prisma.confirmationEmpImportItem.update.mockResolvedValue({});
    prisma.confirmationEmpImportItem.updateMany.mockResolvedValue({ count: 1 });

    await (
      createService() as unknown as ImportServiceTestAccess
    ).ensureAvailableZipWorkingPaperCode(
      { id: "zip-job", projectId: "project-1" },
      items,
      "node-1"
    );

    expect(items.map((item) => item.workingPaperCode)).toStrictEqual([
      "A1-1000-F001-2",
      "A1-1000-F001-2",
    ]);
    expect(prisma.confirmationEmpImportItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["zip-item-2"] } },
      data: { workingPaperCode: "A1-1000-F001-2" },
    });
  });

  it("maps list and progress views to the current shared job contract", async () => {
    const job = {
      id: "job-contract",
      projectId: "project-1",
      mode: "FLAT",
      status: "PARTIAL_FAILURE",
      previewFingerprint: "contract-fingerprint",
      createdAt: new Date("2026-08-05T10:00:00.000Z"),
      updatedAt: new Date("2026-08-05T10:05:00.000Z"),
      items: [
        {
          id: "contract-completed",
          confirmationId: "confirmation-1",
          sourceFileName: "completed.pdf",
          status: "SUCCEEDED",
          withdrawnAt: null,
          errorMessage: null,
          empWorkflowNode: { code: "A1-1000", title: "Bank" },
        },
        {
          id: "contract-failed",
          confirmationId: "confirmation-2",
          sourceFileName: "failed.unknown",
          status: "FAILED",
          withdrawnAt: null,
          errorMessage: "SOURCE_FINGERPRINT_CHANGED",
          empWorkflowNode: null,
        },
      ],
    };
    prisma.confirmationEmpImportJob.findMany.mockResolvedValue([job]);
    prisma.confirmationEmpImportJob.findFirst.mockResolvedValue(job);

    const service = createService() as unknown as ImportServiceTestAccess;
    await expect(service.listJobs("project-1", user)).resolves.toStrictEqual([
      expect.objectContaining({
        id: "job-contract",
        status: "PARTIAL_FAILURE",
        total: 2,
        completed: 1,
        failed: 1,
        retryable: true,
      }),
    ]);
    await expect(
      service.getJobProgress("project-1", user, "job-contract")
    ).resolves.toStrictEqual(
      expect.objectContaining({
        id: "job-contract",
        items: [
          expect.objectContaining({
            id: "contract-completed",
            status: "COMPLETED",
            targetLocation: "A1-1000 Bank",
            retryable: false,
          }),
          expect.objectContaining({
            id: "contract-failed",
            status: "FAILED",
            retryable: true,
          }),
        ],
      })
    );
  });

  it("keeps successful items and reports partial failure for an active-link race", async () => {
    const body = Buffer.from("x");
    const job = {
      id: "job-active-link-race",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      status: "QUEUED",
      items: [
        {
          id: "active-link-item",
          status: "QUEUED",
          sourceKind: "RESPONSE_ARTIFACT",
          activeLinkKey: "active-link-race",
          sourceObjectKey: "responses/race.pdf",
          sourceFileName: "race.pdf",
          sourceMimeType: "application/pdf",
          sourceSize: 1,
          sourceSha256: "race-sha",
          workingPaperCode: "A1-1000-F001",
          workingPaperTitle: "Race response",
        },
        {
          id: "successful-item",
          status: "QUEUED",
          sourceKind: "RESPONSE_ARTIFACT",
          activeLinkKey: "successful-link",
          sourceObjectKey: "responses/success.pdf",
          sourceFileName: "success.pdf",
          sourceMimeType: "application/pdf",
          sourceSize: body.length,
          sourceSha256: sha256(body),
          workingPaperCode: "A1-1000-F002",
          workingPaperTitle: "Successful response",
        },
      ],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.confirmationEmpImportJob.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        return {
          ...job,
          ...data,
        };
      }
    );
    prisma.confirmationEmpImportItem.findMany.mockImplementation(
      async ({ where }: { where: { activeLinkKey: string } }) => {
        await Promise.resolve();
        return where.activeLinkKey === "active-link-race"
          ? [{ id: "previous-success", jobId: "previous-job" }]
          : [];
      }
    );
    prisma.confirmationEmpImportItem.update.mockResolvedValue({});
    prisma.workingPaper.create.mockResolvedValue({
      id: "successful-paper",
      workflowNodeId: "node-1",
    });
    storage.getObjectBuffer.mockResolvedValue(body);
    storage.putObject.mockResolvedValue({
      fileName: "Successful_response.pdf",
      objectKey: "working-papers/successful-paper/Successful_response.pdf",
    });
    prisma.attachment.create.mockResolvedValue({ id: "successful-attachment" });
    prisma.attachmentVersion.create.mockResolvedValue({
      id: "successful-version",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "successful-attachment",
      headVersionId: "successful-version",
    });

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-active-link-race",
      "project-1",
      "user-1"
    );

    expect(prisma.workingPaper.create).toHaveBeenCalledOnce();
    expect(prisma.confirmationEmpImportItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "active-link-item" },
        data: expect.objectContaining({
          status: "FAILED",
          errorCode: "ACTIVE_IMPORT_LINK",
        }),
      })
    );
    expect(prisma.confirmationEmpImportJob.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PARTIAL_FAILURE" }),
      })
    );
  });

  it("keeps default ZIP package order and preview fingerprint stable across DB row order", async () => {
    const confirmation = (
      id: string,
      confirmationCode: string,
      counterpartyName: string
    ) => ({
      id,
      projectId: "project-1",
      status: "CLOSED",
      differenceStatus: "MATCHED",
      confirmationCode,
      counterpartyName,
      currentArtifact: {
        id: `${id}-outgoing`,
        disposition: "ACTIVE",
        pdfObjectKey: `confirmations/${id}.pdf`,
        pdfSize: 1,
        pdfSha256: `${id}-outgoing-sha`,
        submittedAt: new Date("2026-08-01T09:00:00.000Z"),
      },
      responses: [
        {
          id: `${id}-response`,
          routingStatus: "ROUTED",
          receivedAt: new Date("2026-08-02T09:00:00.000Z"),
          artifacts: [
            {
              id: `${id}-response-artifact`,
              sequence: 1,
              objectKey: `responses/${id}.pdf`,
              fileName: `${id}.pdf`,
              mimeType: "application/pdf",
              fileSize: 1,
              sha256: `${id}-response-sha`,
            },
          ],
        },
      ],
    });
    const confirmationA = confirmation("confirmation-a", "CONF-001", "Alpha");
    const confirmationB = confirmation("confirmation-b", "CONF-002", "Beta");
    const service = createService();

    prisma.projectConfirmation.findMany.mockResolvedValue([
      confirmationB,
      confirmationA,
    ]);
    const first = await (service as unknown as ImportServiceTestAccess).preview(
      "project-1",
      user,
      {
        targetWorkflowNodeId: "node-1",
        mode: "ZIP",
      }
    );

    prisma.projectConfirmation.findMany.mockResolvedValue([
      confirmationA,
      confirmationB,
    ]);
    const second = await (
      service as unknown as ImportServiceTestAccess
    ).preview("project-1", user, {
      targetWorkflowNodeId: "node-1",
      mode: "ZIP",
    });

    expect(first.sources.map((source) => source.confirmationId)).toStrictEqual([
      "confirmation-a",
      "confirmation-b",
    ]);
    expect(first.sources.map((source) => source.packageSequence)).toStrictEqual(
      [1, 2]
    );
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.sources.map((source) => source.zipEntryName)).toStrictEqual(
      second.sources.map((source) => source.zipEntryName)
    );
  });

  it("reclaims a stale RUNNING job while leaving a fresh RUNNING job untouched", async () => {
    const staleJob = {
      id: "job-stale-running",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      status: "RUNNING",
      startedAt: new Date(Date.now() - 60 * 60 * 1000),
      items: [],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(staleJob);
    prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.confirmationEmpImportJob.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        return {
          ...staleJob,
          ...data,
        };
      }
    );

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-stale-running",
      "project-1",
      "user-1"
    );

    expect(prisma.confirmationEmpImportJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "job-stale-running",
          projectId: "project-1",
          OR: expect.any(Array),
        }),
        data: expect.objectContaining({ status: "RUNNING" }),
      })
    );

    prisma.confirmationEmpImportJob.updateMany.mockClear();
    const freshJob = {
      ...staleJob,
      id: "job-fresh-running",
      startedAt: new Date(),
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(freshJob);

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-fresh-running",
      "project-1",
      "user-1"
    );

    expect(prisma.confirmationEmpImportJob.updateMany).not.toHaveBeenCalled();
  });

  it("triggers queued and stale recovery from read polling with the job creator", async () => {
    const queuedJob = {
      id: "job-poll-queued",
      projectId: "project-1",
      status: "QUEUED",
      createdBy: "creator-1",
      items: [],
    };
    const staleJob = {
      id: "job-poll-stale",
      projectId: "project-1",
      status: "RUNNING",
      startedAt: new Date(Date.now() - 60 * 60 * 1000),
      createdBy: "creator-2",
      items: [],
    };
    prisma.confirmationEmpImportJob.findFirst
      .mockResolvedValueOnce(queuedJob)
      .mockResolvedValueOnce(staleJob);
    const service = createService();
    const executeSpy = vi.spyOn(service, "executeJob").mockResolvedValue(null);

    await service.getJob("project-1", user as never, "job-poll-queued");
    await service.getJobProgress("project-1", user as never, "job-poll-stale");

    expect(executeSpy).toHaveBeenNthCalledWith(
      1,
      "job-poll-queued",
      "project-1",
      "creator-1"
    );
    expect(executeSpy).toHaveBeenNthCalledWith(
      2,
      "job-poll-stale",
      "project-1",
      "creator-2"
    );
    expect(access.requireProjectAction).not.toHaveBeenCalled();
  });

  it("lets concurrent stale recovery calls contend through the atomic claim", async () => {
    const staleJob = {
      id: "job-concurrent-stale",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      status: "RUNNING",
      startedAt: new Date(Date.now() - 60 * 60 * 1000),
      createdBy: "creator-1",
      items: [],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(staleJob);
    prisma.confirmationEmpImportJob.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.confirmationEmpImportJob.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        return {
          ...staleJob,
          ...data,
        };
      }
    );

    const service = createService();
    await Promise.all([
      (service as unknown as ImportServiceTestAccess).executeJob(
        "job-concurrent-stale",
        "project-1",
        "creator-1"
      ),
      (service as unknown as ImportServiceTestAccess).executeJob(
        "job-concurrent-stale",
        "project-1",
        "creator-1"
      ),
    ]);

    expect(prisma.confirmationEmpImportJob.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.confirmationEmpImportJob.update).toHaveBeenCalledOnce();
  });

  it("does not block default preview on non-eligible project confirmations", async () => {
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "draft-confirmation",
        projectId: "project-1",
        status: "DRAFT",
        differenceStatus: null,
      },
      {
        id: "prepared-confirmation",
        projectId: "project-1",
        status: "PREPARED",
        differenceStatus: null,
      },
      {
        id: "voided-confirmation",
        projectId: "project-1",
        status: "VOIDED",
        differenceStatus: "MATCHED",
      },
    ]);

    const preview = await (
      createService() as unknown as ImportServiceTestAccess
    ).preview("project-1", user, {
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
    });

    expect(preview.sources).toStrictEqual([]);
    expect(preview.issues).toStrictEqual([]);
  });

  it("returns real code, title, and workflow location for every skipped source", async () => {
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "confirmation-skipped-location",
        projectId: "project-1",
        status: "CLOSED",
        differenceStatus: "MATCHED",
        counterpartyName: "Acme",
        currentArtifact: {
          id: "outgoing-skipped-location",
          disposition: "ACTIVE",
          pdfObjectKey: "confirmations/skipped.pdf",
          pdfSize: 1,
          pdfSha256: "skipped-outgoing-sha",
          submittedAt: new Date("2026-08-01T09:00:00.000Z"),
        },
        responses: [
          {
            id: "response-skipped-location",
            routingStatus: "ROUTED",
            receivedAt: new Date("2026-08-02T09:00:00.000Z"),
            artifacts: [
              {
                id: "response-skipped-location-artifact",
                objectKey: "responses/skipped.pdf",
                fileName: "skipped.pdf",
                mimeType: "application/pdf",
                fileSize: 1,
                sha256: "skipped-response-sha",
              },
            ],
          },
        ],
      },
    ]);
    prisma.confirmationEmpImportItem.findMany.mockResolvedValue([
      {
        activeLinkKey:
          "OUTGOING_ARTIFACT:confirmation-skipped-location:outgoing-skipped-location",
        jobId: "job-skipped-location",
        workingPaperId: "paper-skipped-location",
        attachmentId: "attachment-skipped-location",
        workingPaper: {
          id: "paper-skipped-location",
          code: "A1-1000-F007",
          title: "Acme-Outgoing.pdf",
          workflowNode: {
            id: "node-bank",
            code: "A1-1000",
            title: "Bank confirmations",
          },
        },
      },
      {
        activeLinkKey:
          "RESPONSE_ARTIFACT:confirmation-skipped-location:response-skipped-location:response-skipped-location-artifact",
        jobId: "job-skipped-location",
        workingPaperId: "paper-skipped-location-response",
        attachmentId: "attachment-skipped-location-response",
        workingPaper: {
          id: "paper-skipped-location-response",
          code: "A1-1000-F008",
          title: "Acme-Response-01-skipped.pdf",
          workflowNode: {
            id: "node-bank",
            code: "A1-1000",
            title: "Bank confirmations",
          },
        },
      },
    ]);

    const preview = await createService().preview("project-1", user as never, {
      confirmationIds: ["confirmation-skipped-location"],
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
    });

    expect(preview.skipped).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey:
            "RESPONSE_ARTIFACT:confirmation-skipped-location:response-skipped-location:response-skipped-location-artifact",
          existingWorkingPaperCode: "A1-1000-F008",
          existingWorkingPaperTitle: "Acme-Response-01-skipped.pdf",
          existingWorkflowLocation: expect.objectContaining({
            id: "node-bank",
            code: "A1-1000",
            title: "Bank confirmations",
          }),
        }),
      ])
    );
  });

  it("reads metadata for every response artifact and skips the outgoing file", async () => {
    const confirmation = integrityConfirmation();
    prisma.projectConfirmation.findMany.mockResolvedValue([confirmation]);
    storage.getObjectMetadata.mockImplementation(async (objectKey: string) => {
      await Promise.resolve();
      const metadata: Record<string, unknown> = {
        "confirmations/integrity-outgoing.pdf": {
          contentLength: 5,
          contentType: "application/pdf",
          contentSha256: "outgoing-integrity-sha",
        },
        "responses/integrity-1.pdf": {
          contentLength: 6,
          contentType: "application/pdf",
          contentSha256: "response-integrity-sha-1",
        },
        "responses/integrity-2.bin": {
          contentLength: 7,
          contentType: "application/octet-stream",
          contentSha256: "response-integrity-sha-2",
        },
      };
      return metadata[objectKey] as never;
    });

    const preview = await createService().preview("project-1", user as never, {
      confirmationIds: [confirmation.id],
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
    });

    expect(storage.getObjectMetadata).toHaveBeenCalledTimes(2);
    expect(
      storage.getObjectMetadata.mock.calls.map(([key]) => key)
    ).toStrictEqual(["responses/integrity-1.pdf", "responses/integrity-2.bin"]);
    expect(preview.issues).toStrictEqual([]);
  });

  it.each([
    ["missing object", "SOURCE_OBJECT_UNAVAILABLE", "missing"] as const,
    ["undefined metadata", "SOURCE_OBJECT_UNAVAILABLE", "undefined"] as const,
    ["content length mismatch", "FINGERPRINT_CHANGED", "size"] as const,
    ["content hash mismatch", "FINGERPRINT_CHANGED", "hash"] as const,
  ])(
    "blocks create when preview detects a %s",
    async (_label, expectedCode, failure) => {
      const confirmation = integrityConfirmation();
      prisma.projectConfirmation.findMany.mockResolvedValue([confirmation]);
      storage.getObjectMetadata.mockImplementation(
        async (objectKey: string) => {
          await Promise.resolve();
          if (objectKey === "responses/integrity-1.pdf") {
            if (failure === "missing") {
              throw new Error("NoSuchKey responses/integrity-1.pdf");
            }
            if (failure === "undefined") {
              return;
            }
            return {
              contentLength: failure === "size" ? 999 : 6,
              contentType: "application/pdf",
              contentSha256:
                failure === "hash"
                  ? "different-integrity-sha"
                  : "response-integrity-sha-1",
            };
          }
          return {
            contentLength: objectKey.endsWith("1.pdf") ? 6 : 7,
            contentType: objectKey.endsWith("1.pdf")
              ? "application/pdf"
              : "application/octet-stream",
            contentSha256: objectKey.endsWith("1.pdf")
              ? "response-integrity-sha-1"
              : "response-integrity-sha-2",
          };
        }
      );

      const service = createService();
      const preview = await service.preview("project-1", user as never, {
        confirmationIds: [confirmation.id],
        targetWorkflowNodeId: "node-1",
        mode: "FLAT",
      });

      expect(preview.issues).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: expectedCode,
            confirmationId: confirmation.id,
          }),
        ])
      );
      expect(
        preview.issues.some((issue) =>
          issue.message.includes("responses/integrity-1.pdf")
        )
      ).toBeFalsy();

      await expect(
        service.createJob("project-1", user as never, {
          confirmationIds: [confirmation.id],
          targetWorkflowNodeId: "node-1",
          mode: "FLAT",
          previewFingerprint: preview.fingerprint,
          idempotencyKey: `integrity-${failure}`,
        })
      ).rejects.toMatchObject({
        response: {
          message: "The confirmation preview contains blocking issues.",
        },
      });
      expect(prisma.confirmationEmpImportJob.create).not.toHaveBeenCalled();
    }
  );

  it("reads and verifies a flat source buffer before writing the target object", async () => {
    const body = Buffer.from("valid-flat-source");
    const item = {
      id: "item-source-buffer",
      status: "QUEUED",
      confirmationId: "confirmation-source-buffer",
      sourceKind: "RESPONSE_ARTIFACT",
      responseId: "response-source-buffer",
      responseArtifactId: "response-artifact-source-buffer",
      sourceObjectKey: "responses/source-buffer.pdf",
      sourceFileName: "source-buffer.pdf",
      sourceMimeType: "application/pdf",
      sourceSize: body.length,
      sourceSha256: sha256(body),
      activeLinkKey: "source-buffer-link",
      workingPaperCode: "A1-1000-F001",
      workingPaperTitle: "Source buffer.pdf",
      prepareUserId: null,
      reviewUserId: null,
    };
    const job = {
      id: "job-source-buffer",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      status: "QUEUED",
      items: [item],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.confirmationEmpImportJob.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        return {
          ...job,
          ...data,
        };
      }
    );
    prisma.workingPaper.create.mockResolvedValue({
      id: "paper-source-buffer",
      projectId: "project-1",
      workflowNodeId: "node-1",
    });
    storage.getObjectBuffer.mockResolvedValue(body);
    storage.copyObjectToWorkingPaper.mockResolvedValue({
      fileName: "unused.pdf",
      objectKey: "unused/source.pdf",
    });
    storage.putObject.mockResolvedValue({
      fileName: "Source_buffer.pdf",
      objectKey: "working-papers/paper-source-buffer/Source_buffer.pdf",
    });
    prisma.attachment.create.mockResolvedValue({
      id: "attachment-source-buffer",
    });
    prisma.attachmentVersion.create.mockResolvedValue({
      id: "version-source-buffer",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-source-buffer",
      headVersionId: "version-source-buffer",
    });
    prisma.confirmationEmpImportItem.update.mockResolvedValue({
      ...item,
      status: "SUCCEEDED",
    });

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-source-buffer",
      "project-1",
      "user-1"
    );

    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "responses/source-buffer.pdf"
    );
    expect(storage.putObject).toHaveBeenCalledWith(
      "project-1",
      "paper-source-buffer",
      "Source buffer.pdf",
      body,
      "application/pdf"
    );
    expect(storage.copyObjectToWorkingPaper).not.toHaveBeenCalled();
    expect(prisma.confirmationEmpImportItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "item-source-buffer" },
        data: expect.objectContaining({
          status: "SUCCEEDED",
          targetHeadHash: sha256(body),
        }),
      })
    );
  });

  it("fails only a same-size hash-changed source and preserves the valid item", async () => {
    const badBody = Buffer.from("xxxxx");
    const goodBody = Buffer.from("right");
    const badItem = {
      id: "item-hash-changed",
      status: "QUEUED",
      sourceKind: "RESPONSE_ARTIFACT",
      sourceObjectKey: "responses/hash-changed.pdf",
      sourceFileName: "hash-changed.pdf",
      sourceMimeType: "application/pdf",
      sourceSize: badBody.length,
      sourceSha256: sha256(Buffer.from("valid")),
      activeLinkKey: "hash-changed-link",
      workingPaperCode: "A1-1000-F001",
      workingPaperTitle: "Hash changed.pdf",
      prepareUserId: null,
      reviewUserId: null,
    };
    const goodItem = {
      id: "item-hash-valid",
      status: "QUEUED",
      sourceKind: "RESPONSE_ARTIFACT",
      sourceObjectKey: "responses/hash-valid.pdf",
      sourceFileName: "hash-valid.pdf",
      sourceMimeType: "application/pdf",
      sourceSize: goodBody.length,
      sourceSha256: sha256(goodBody),
      activeLinkKey: "hash-valid-link",
      workingPaperCode: "A1-1000-F002",
      workingPaperTitle: "Hash valid.pdf",
      prepareUserId: null,
      reviewUserId: null,
    };
    const job = {
      id: "job-hash-integrity",
      projectId: "project-1",
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      status: "QUEUED",
      items: [badItem, goodItem],
    };
    prisma.confirmationEmpImportJob.findUnique.mockResolvedValue(job);
    prisma.confirmationEmpImportJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.confirmationEmpImportJob.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        return {
          ...job,
          ...data,
        };
      }
    );
    prisma.workflowNode.findUnique.mockResolvedValue({
      id: "node-1",
      projectId: "project-1",
    });
    storage.copyObjectToWorkingPaper.mockImplementation(
      async (_projectId: string, paperId: string, title: string) => {
        await Promise.resolve();
        return {
          fileName: title,
          objectKey: `unused/${paperId}/${title}`,
        };
      }
    );
    storage.getObjectBuffer.mockImplementation(async (objectKey: string) => {
      await Promise.resolve();
      return objectKey === badItem.sourceObjectKey ? badBody : goodBody;
    });
    storage.putObject.mockImplementation(
      async (_projectId: string, paperId: string, title: string) => {
        await Promise.resolve();
        return {
          fileName: title,
          objectKey: `working-papers/${paperId}/${title}`,
        };
      }
    );
    prisma.workingPaper.create.mockResolvedValueOnce({
      id: "paper-hash-valid",
      projectId: "project-1",
      workflowNodeId: "node-1",
    });
    prisma.attachment.create.mockResolvedValue({ id: "attachment-hash-valid" });
    prisma.attachmentVersion.create.mockResolvedValue({
      id: "version-hash-valid",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-hash-valid",
      headVersionId: "version-hash-valid",
    });
    prisma.confirmationEmpImportItem.update.mockResolvedValue({});

    await (createService() as unknown as ImportServiceTestAccess).executeJob(
      "job-hash-integrity",
      "project-1",
      "user-1"
    );

    expect(storage.putObject).toHaveBeenCalledExactlyOnceWith(
      "project-1",
      "paper-hash-valid",
      "Hash valid.pdf",
      goodBody,
      "application/pdf"
    );
    expect(prisma.confirmationEmpImportItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: badItem.id },
        data: expect.objectContaining({
          status: "FAILED",
          errorCode: "FINGERPRINT_CHANGED",
        }),
      })
    );
    let badFailure:
      | (typeof prisma.confirmationEmpImportItem.update.mock.calls)[number]
      | null = null;
    for (
      let index = prisma.confirmationEmpImportItem.update.mock.calls.length - 1;
      index >= 0;
      index -= 1
    ) {
      const entry = prisma.confirmationEmpImportItem.update.mock.calls[index];
      const [call] = entry as [{ where?: { id?: string } }];
      if (call.where?.id === badItem.id) {
        badFailure = entry;
        break;
      }
    }
    expect(badFailure?.[0].data.errorMessage).not.toContain(
      badItem.sourceObjectKey
    );
    expect(prisma.confirmationEmpImportItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: goodItem.id },
        data: expect.objectContaining({ status: "SUCCEEDED" }),
      })
    );
    expect(prisma.confirmationEmpImportJob.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PARTIAL_FAILURE" }),
      })
    );
  });
});
