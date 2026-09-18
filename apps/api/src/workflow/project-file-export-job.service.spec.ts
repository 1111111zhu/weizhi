import { readFile, writeFile } from "node:fs/promises";

import JSZip from "jszip";

import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiForbiddenException,
} from "../common/api-error";
import { ProjectFileExportJobService } from "./project-file-export-job.service";

const user: RequestUser = {
  id: "user-1",
  email: "user@example.com",
  name: "Export User",
  globalRole: "STAFF",
};

describe(ProjectFileExportJobService, () => {
  it("does not recover or clean up exports on maintenance-mode startup", async () => {
    vi.stubEnv("PROJECTWING_BACKGROUND_JOBS_ENABLED", "false");
    const service = makeService(makePrisma({ attachments: [] }));
    const lifecycle = service as unknown as {
      cleanupExpiredJobs: () => Promise<void>;
      cleanupStaleTempDirectories: () => Promise<void>;
      scheduleRecoverableJobs: () => Promise<void>;
    };
    const cleanupExpiredJobs = vi
      .spyOn(lifecycle, "cleanupExpiredJobs")
      .mockResolvedValue();
    const cleanupStaleTempDirectories = vi
      .spyOn(lifecycle, "cleanupStaleTempDirectories")
      .mockResolvedValue();
    const scheduleRecoverableJobs = vi
      .spyOn(lifecycle, "scheduleRecoverableJobs")
      .mockResolvedValue();
    try {
      await service.onApplicationBootstrap();

      expect(cleanupExpiredJobs).not.toHaveBeenCalled();
      expect(cleanupStaleTempDirectories).not.toHaveBeenCalled();
      expect(scheduleRecoverableJobs).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("snapshots a folder recursively with empty folders and duplicate-safe paths", async () => {
    const createdRows: Record<string, unknown>[] = [];
    const prisma = makePrisma({
      attachments: [
        {
          ...makeAttachment("attachment-1", "report.docx"),
          signoffs: [
            {
              type: "PREPARER",
              signedAt: new Date("2026-09-01T08:00:00.000Z"),
              user: { name: "Jony Ma", email: "jony@example.test" },
            },
          ],
        },
        makeAttachment("attachment-2", "report.docx"),
      ],
      onCreate: (data) => createdRows.push(data),
    });
    const service = makeService(prisma);
    mockRunJob(service);

    const job = await service.createJob("project-1", user, {
      scope: "WORKFLOW_NODE",
      workflowNodeId: "node-a1",
      bucket: "CURRENT",
    });

    expect(job.totalFiles).toBe(2);
    const snapshot = assertPresentValue(createdRows[0]).snapshotJson as {
      files: {
        zipPath: string;
        headVersionId: string;
        signoffs?: { type: string; userName: string; signedAt: string }[];
      }[];
      emptyDirectories: string[];
    };
    expect(snapshot.emptyDirectories).toStrictEqual(
      expect.arrayContaining([
        "P001 - Example Project/A/A1",
        "P001 - Example Project/A/A1/A1000",
        "P001 - Example Project/A/A1/A2000",
      ])
    );
    expect(snapshot.files.map((file) => file.zipPath)).toStrictEqual([
      "P001 - Example Project/A/A1/A1000/A1000-F001 report.docx",
      "P001 - Example Project/A/A1/A1000/A1000-F001 report (2).docx",
    ]);
    expect(snapshot.files.map((file) => file.headVersionId)).toStrictEqual([
      "version-attachment-1",
      "version-attachment-2",
    ]);
    expect(snapshot.files[0]?.signoffs).toStrictEqual([
      {
        type: "PREPARER",
        userName: "Jony Ma",
        signedAt: "2026-09-01T08:00:00.000Z",
      },
    ]);
  });

  it("snapshots every attachment selected for a multi-file export", async () => {
    const createdRows: Record<string, unknown>[] = [];
    const prisma = makePrisma({
      attachments: [
        makeAttachment("attachment-1", "first.docx"),
        makeAttachment("attachment-2", "second.docx"),
      ],
      onCreate: (data) => createdRows.push(data),
    });
    const service = makeService(prisma);
    mockRunJob(service);

    const job = await service.createJob("project-1", user, {
      scope: "ATTACHMENTS",
      attachmentIds: ["attachment-1", "attachment-2"],
    });

    expect(job.totalFiles).toBe(2);
    const snapshot = assertPresentValue(createdRows[0]).snapshotJson as {
      files: { attachmentId: string; zipPath: string }[];
    };
    expect(snapshot.files.map((file) => file.attachmentId)).toStrictEqual([
      "attachment-1",
      "attachment-2",
    ]);
    expect(snapshot.files.map((file) => file.zipPath)).toStrictEqual([
      "P001 - Example Project/A/A1/A1000/A1000-F001 first.docx",
      "P001 - Example Project/A/A1/A1000/A1000-F001 second.docx",
    ]);
  });

  it("rejects a multi-select export when a selected file is unavailable", async () => {
    const service = makeService(makePrisma({ attachments: [] }));
    mockRunJob(service);

    await expect(
      service.createJob("project-1", user, {
        scope: "ATTACHMENTS",
        attachmentIds: ["missing-attachment"],
      })
    ).rejects.toBeInstanceOf(ApiBadRequestException);
  });

  it("starts a queued export even when its audit record cannot be written", async () => {
    const service = makeService(makePrisma({ attachments: [] }), {
      log: vi.fn().mockRejectedValue(new Error("Audit unavailable")),
    });
    const run = mockRunJob(service);
    const job = await service.createJob("project-1", user, {
      scope: "WORKFLOW_NODE",
      workflowNodeId: "node-a1",
      bucket: "CURRENT",
    });

    expect(job.status).toBe("QUEUED");
    expect(run).toHaveBeenCalledWith(job.id);
  });

  it("retries a failed job with the original frozen snapshot", async () => {
    const failed = makeJobRow({
      status: "FAILED",
      errorMessage: "Missing file",
    });
    const update = vi.fn().mockImplementation(({ data }: { data: object }) => ({
      ...failed,
      ...data,
      updatedAt: new Date(),
    }));
    const prisma = makePrisma({ attachments: [], existingJob: failed, update });
    const service = makeService(prisma);
    const run = mockRunJob(service);
    const retried = await service.retryJob("project-1", "job-1", user);

    expect(retried.status).toBe("QUEUED");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({ status: "QUEUED", errorMessage: null }),
      })
    );
    expect(run).toHaveBeenCalledWith("job-1");
  });

  it("does not expose another member's export job", async () => {
    const existing = makeJobRow();
    const service = makeService(
      makePrisma({ attachments: [], existingJob: existing })
    );

    await expect(
      service.getJob("project-1", "job-1", {
        ...user,
        id: "different-user",
      })
    ).rejects.toBeInstanceOf(ApiForbiddenException);
  });

  it("only restores an in-flight export after the page is refreshed", async () => {
    const queued = makeJobRow({ status: "QUEUED" });
    const findFirst = vi.fn().mockResolvedValue(queued);
    const service = makeService({
      projectFileExportJob: {
        findFirst,
      },
    } as never);

    await expect(
      service.getActiveJob("project-1", user)
    ).resolves.toStrictEqual(expect.objectContaining({ status: "QUEUED" }));
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["QUEUED", "RUNNING"] },
        }),
      })
    );
  });

  it("retains a downloaded ZIP until its expiry window", async () => {
    const completed = makeJobRow({
      status: "COMPLETED",
      outputObjectKey: "project-file-exports/job-1/export.zip",
      outputFileName: "export.zip",
      outputFileSize: 42n,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const update = vi
      .fn()
      .mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({ ...completed, ...data, updatedAt: new Date() })
      );
    const prisma = makePrisma({
      attachments: [],
      existingJob: completed,
      update,
    });
    const storage = { deleteObject: vi.fn() };
    const service = new ProjectFileExportJobService(
      prisma as never,
      { requireProjectMember: vi.fn().mockResolvedValue({}) } as never,
      storage as never,
      { log: vi.fn().mockResolvedValue(undefined as never) } as never,
      {} as never
    );

    await service.completeDownload("project-1", "job-1", user);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DOWNLOADED" }),
      })
    );
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it("does not run a job already claimed by another worker", async () => {
    const findUnique = vi.fn();
    const service = new ProjectFileExportJobService(
      {
        projectFileExportJob: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findUnique,
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );

    await (
      service as unknown as { runJob: (jobId: string) => Promise<void> }
    ).runJob("job-1");

    expect(findUnique).not.toHaveBeenCalled();
  });

  it("generates a readable ZIP from the frozen object snapshot", async () => {
    const row = makeJobRow({
      totalFiles: 2,
      totalSourceBytes: 24n,
      snapshotJson: {
        projectRoot: "P001 - Example Project",
        emptyDirectories: ["P001 - Example Project/A/A1/A2000"],
        files: [
          {
            attachmentId: "attachment-1",
            headVersionId: "version-attachment-1",
            objectKey: "working-papers/attachment-1.docx",
            fileName: "A1000-F001 report.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            fileKind: "DOCUMENT",
            fileSize: 12,
            version: 1,
            zipPath: "P001 - Example Project/A/A1/A1000/A1000-F001 report.docx",
          },
          {
            attachmentId: "attachment-2",
            headVersionId: "version-attachment-2",
            objectKey: "working-papers\\attachment-2.docx",
            fileName: "A1000-F002 support.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            fileKind: "DOCUMENT",
            fileSize: 12,
            version: 1,
            zipPath:
              "P001 - Example Project/A/A1/A1000/A1000-F002 support.docx",
          },
        ],
      },
    });
    let current = row;
    let zipBuffer: Buffer | null = null;
    const prisma = {
      projectFileExportJob: {
        findUnique: vi.fn(() => Promise.resolve(current)),
        findUniqueOrThrow: vi.fn(() => Promise.resolve(current)),
        updateMany: vi
          .fn()
          .mockImplementation(
            ({
              where,
              data,
            }: {
              where: { workerToken?: string };
              data: object;
            }) => {
              if (
                where.workerToken &&
                current.workerToken !== where.workerToken
              ) {
                return Promise.resolve({ count: 0 });
              }
              current = { ...current, ...data, updatedAt: new Date() };
              return Promise.resolve({ count: 1 });
            }
          ),
        update: vi.fn().mockImplementation(({ data }: { data: object }) => {
          current = { ...current, ...data, updatedAt: new Date() };
          return Promise.resolve(current);
        }),
      },
    };
    const storage = {
      getProjectFileExportObject: vi.fn().mockReturnValue({
        objectKey: "project-file-exports/job-1/export.zip",
        fileName: "export.zip",
      }),
      downloadObjectToFile: vi
        .fn()
        .mockImplementation((objectKey: string, targetPath: string) =>
          writeFile(
            targetPath,
            Buffer.from(
              objectKey.endsWith("attachment-2.docx")
                ? "support body"
                : "document body"
            )
          )
        ),
      putProjectFileExport: vi
        .fn()
        .mockImplementation(
          async (
            _projectId: string,
            _jobId: string,
            _fileName: string,
            sourcePath: string
          ) => {
            zipBuffer = await readFile(sourcePath);
            return {
              objectKey: "project-file-exports/job-1/export.zip",
              fileName: "export.zip",
              fileSize: zipBuffer.length,
            };
          }
        ),
      deleteObject: vi.fn().mockResolvedValue(undefined as never),
    };
    const service = new ProjectFileExportJobService(
      prisma as never,
      {} as never,
      storage as never,
      {
        log: vi.fn().mockRejectedValue(new Error("Audit unavailable")),
      } as never,
      {} as never
    );

    await (
      service as unknown as { runJob: (jobId: string) => Promise<void> }
    ).runJob("job-1");

    expect(zipBuffer).not.toBeNull();
    const zip = await JSZip.loadAsync(assertPresentValue(zipBuffer));
    expect(
      zip.file("P001 - Example Project/A/A1/A1000/A1000-F001 report.docx")
    ).not.toBeNull();
    expect(
      zip.file("P001 - Example Project/A/A1/A1000/A1000-F002 support.docx")
    ).not.toBeNull();
    expect(zip.files["P001 - Example Project/A/A1/A2000/"]).toBeDefined();
    await expect(
      assertPresentValue(
        zip.file("P001 - Example Project/A/A1/A1000/A1000-F001 report.docx")
      ).async("string")
    ).resolves.toBe("document body");
    await expect(
      assertPresentValue(
        zip.file("P001 - Example Project/A/A1/A1000/A1000-F002 support.docx")
      ).async("string")
    ).resolves.toBe("support body");
    expect(storage.downloadObjectToFile).toHaveBeenCalledWith(
      "working-papers/attachment-2.docx",
      expect.any(String)
    );
    expect(current.status).toBe("COMPLETED");
  });
});

function makeService(
  prisma: ReturnType<typeof makePrisma>,
  auditLogs?: { log: ReturnType<typeof vi.fn> }
) {
  const resolvedAuditLogs = auditLogs ?? {
    log: vi.fn().mockResolvedValue(undefined as never),
  };
  return new ProjectFileExportJobService(
    prisma as never,
    { requireProjectMember: vi.fn().mockResolvedValue({}) } as never,
    {} as never,
    resolvedAuditLogs as never,
    {} as never
  );
}

function mockRunJob(service: ProjectFileExportJobService) {
  return vi
    .spyOn(
      service as unknown as { runJob: (jobId: string) => Promise<void> },
      "runJob"
    )
    .mockResolvedValue(undefined as never);
}

function makePrisma({
  attachments,
  onCreate,
  existingJob,
  update = vi.fn(),
}: {
  attachments: Record<string, unknown>[];
  onCreate?: (data: Record<string, unknown>) => void;
  existingJob?: Record<string, unknown>;
  update?: ReturnType<typeof vi.fn>;
}) {
  return {
    project: {
      findUnique: vi.fn().mockResolvedValue({
        projectCode: "P001",
        name: "Example Project",
      }),
    },
    workflowNode: {
      findMany: vi.fn().mockResolvedValue([
        { id: "node-a", parentId: null, code: "A", title: "Planning" },
        { id: "node-a1", parentId: "node-a", code: "A1", title: "Cash" },
        {
          id: "node-a1000",
          parentId: "node-a1",
          code: "A1000",
          title: "Bank",
        },
        {
          id: "node-a2000",
          parentId: "node-a1",
          code: "A2000",
          title: "Petty cash",
        },
      ]),
    },
    attachment: { findMany: vi.fn().mockResolvedValue(attachments) },
    projectFileExportJob: {
      findFirst: vi
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(where?.id ? (existingJob ?? null) : null)
        ),
      findUnique: vi.fn().mockResolvedValue(existingJob ?? null),
      create: vi
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          onCreate?.(data);
          return makeJobRow({ ...data, snapshotJson: data.snapshotJson });
        }),
      update,
    },
  };
}

function makeAttachment(id: string, originalName: string) {
  return {
    id,
    projectId: "project-1",
    workingPaperId: "paper-1",
    workflowNodeId: null,
    code: null,
    bucket: "CURRENT",
    fileKind: "DOCUMENT",
    fileName: originalName,
    originalName,
    fileUrl: `working-papers/${id}.docx`,
    fileSize: 128,
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    version: 1,
    headVersionId: `version-${id}`,
    workingPaper: { code: "A1000-F001", workflowNodeId: "node-a1000" },
    headVersion: {
      id: `version-${id}`,
      fileUrl: `working-papers/${id}.docx`,
      fileName: originalName,
      originalName,
      fileSize: 128,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileKind: "DOCUMENT",
      version: 1,
    },
  };
}

function makeJobRow(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-08-01T00:00:00.000Z");
  return {
    id: "job-1",
    projectId: "project-1",
    createdBy: "user-1",
    scope: "WORKFLOW_NODE",
    bucket: "CURRENT",
    workflowNodeId: "node-a1",
    snapshotJson: { files: [], emptyDirectories: [] },
    status: "QUEUED",
    currentPhase: "COLLECTING",
    completedFiles: 0,
    totalFiles: 0,
    totalSourceBytes: 0n,
    outputObjectKey: null,
    outputFileName: null,
    outputFileSize: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    downloadedAt: null,
    expiresAt: null,
    workerToken: null,
    leaseExpiresAt: null,
    ...overrides,
  };
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
