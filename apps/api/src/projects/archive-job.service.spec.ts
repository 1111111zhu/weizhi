import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";
import { promisify } from "node:util";

import { path7za } from "7zip-bin";
import {
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
} from "@project-wing/shared";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

import { ArchiveJobService } from "./archive-job.service";

const execFileAsync = promisify(execFile);
const ARCHIVE_TEST_PASSWORD = "ProjectWing@2026";
const prisma = {
  project: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  projectMember: {
    findMany: vi.fn(),
  },
  workingPaper: {
    findMany: vi.fn(),
  },
  workflowNode: {
    findMany: vi.fn(),
  },
  projectArchiveArtifact: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  projectArchiveJob: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
};
const access = {
  requireProjectMember: vi.fn(),
  requireProjectRole: vi.fn(),
  requireProjectAction: vi.fn(),
};
const archiveChecks = {
  assertReadyForArchive: vi.fn(),
  renderReportPdf: vi.fn(),
};
const storage = {
  getObjectBuffer: vi.fn(),
  putProjectArchive: vi.fn(),
  getDownloadObject: vi.fn(),
};
const smartFormPdf = {
  renderSmartFormV2Pdf: vi.fn(),
};
const inbox = {
  createCollaborationMessage: vi.fn(),
};

let archiveArtifactRows: Map<string, Record<string, unknown>>;
let archiveJobRows: Map<string, Record<string, unknown>>;

describe(ArchiveJobService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    archiveJobRows = new Map();
    archiveArtifactRows = new Map();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => unknown) => {
        await Promise.resolve();
        return callback(prisma);
      }
    );
    prisma.projectArchiveJob.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        const now = new Date("2026-06-20T10:00:00Z");
        const row = {
          id: data.id,
          projectId: data.projectId,
          status: data.status,
          currentPhase: data.currentPhase,
          currentLabel: data.currentLabel ?? null,
          completedUnits: data.completedUnits ?? 0,
          totalUnits: data.totalUnits ?? 4,
          errorMessage: data.errorMessage ?? null,
          artifactId: data.artifactId ?? null,
          createdBy: data.createdBy,
          startedAt: data.startedAt ?? null,
          completedAt: data.completedAt ?? null,
          createdAt: data.createdAt ?? now,
          updatedAt: data.updatedAt ?? now,
        };
        archiveJobRows.set(String(row.id), row);
        return hydrateArchiveJobRow(row);
      }
    );
    prisma.projectArchiveJob.findFirst.mockImplementation(
      async ({ where }: { where: { id?: string; projectId?: string } }) => {
        await Promise.resolve();
        const row = where.id ? archiveJobRows.get(where.id) : null;
        if (!row || row.projectId !== where.projectId) {
          return null;
        }
        return hydrateArchiveJobRow(row);
      }
    );
    prisma.projectArchiveJob.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        await Promise.resolve();
        const row = archiveJobRows.get(where.id);
        return row ? hydrateArchiveJobRow(row) : null;
      }
    );
    prisma.projectArchiveJob.update.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        await Promise.resolve();
        const row = archiveJobRows.get(where.id);
        if (!row) {
          throw new Error(`Archive job ${where.id} was not found`);
        }
        for (const [key, value] of Object.entries(data)) {
          row[key] = value;
        }
        row.updatedAt = new Date();
        archiveJobRows.set(where.id, row);
        return hydrateArchiveJobRow(row);
      }
    );
    archiveChecks.assertReadyForArchive.mockResolvedValue({
      project: {
        id: "project-1",
        projectCode: "ABC-2026",
        name: "ABC Audit",
      },
      generatedAt: new Date("2026-06-20T10:00:00Z"),
      ready: true,
      summary: {
        workingPapers: 1,
        blockers: 0,
        warnings: 0,
      },
      issues: [],
    });
    prisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      projectCode: "ABC-2026",
      name: "ABC Audit",
      language: "zh-CN",
      yearEndDate: new Date("2026-12-31T00:00:00.000Z"),
      workspace: { clientName: "Workspace Client" },
      cmpClient: { nameZh: "ABC 客户", nameEn: "ABC Client" },
      cmpEngagement: { engagementCode: "ABC-2026-AUD" },
      archivePassword: ARCHIVE_TEST_PASSWORD,
      status: "ACTIVE",
    });
    prisma.workingPaper.findMany.mockResolvedValue([
      {
        id: "paper-current",
        code: "A1-1000-F001",
        title: "Cash",
        workflowNodeId: "node-a1-1000",
        bucket: "CURRENT",
        signoffs: [
          {
            attachmentId: "attachment-current",
            type: "PREPARER",
            signedAt: new Date("2026-06-18T09:00:00.000Z"),
            user: { name: "Amy Chan", email: "amy@example.com" },
          },
          {
            attachmentId: "attachment-current",
            type: "REVIEWER",
            signedAt: new Date("2026-06-19T10:30:00.000Z"),
            user: { name: "Edric Han", email: "edric@example.com" },
          },
        ],
        attachments: [
          {
            id: "attachment-current",
            code: "A1-1000-F001",
            originalName: "support.pdf",
            fileName: "support-generated.pdf",
            fileUrl: "working-papers/project-1/paper-current/support.pdf",
            fileSize: 12,
            mimeType: "application/pdf",
            fileKind: "SUPPORTING",
            smartFormInstance: null,
          },
        ],
      },
    ]);
    prisma.workflowNode.findMany.mockResolvedValue([
      {
        id: "node-reporting",
        parentId: null,
        code: "Reporting",
        title: "Reporting",
        level: 1,
        sortOrder: 1,
      },
      {
        id: "node-a1",
        parentId: "node-reporting",
        code: "A1",
        title: "A1",
        level: 2,
        sortOrder: 1,
      },
      {
        id: "node-a1-1000",
        parentId: "node-a1",
        code: "A1-1000",
        title: "A1 - 1000",
        level: 3,
        sortOrder: 1,
      },
    ]);
    storage.getObjectBuffer.mockResolvedValue(Buffer.from("%PDF-1.4"));
    storage.putProjectArchive.mockResolvedValue({
      fileName: "ABC-2026-archive.zip",
      objectKey: "project-archives/project-1/archive.zip",
    });
    smartFormPdf.renderSmartFormV2Pdf.mockResolvedValue(
      Buffer.from("%PDF-1.7\n% Smart Form snapshot\n", "utf-8")
    );
    archiveChecks.renderReportPdf.mockReturnValue(
      Buffer.from("%PDF-1.7\n% File Check report\n", "utf-8")
    );
    prisma.projectArchiveArtifact.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        await Promise.resolve();
        const artifact = {
          id: "artifact-1",
          projectId: data.projectId,
          fileName: data.fileName,
          objectKey: data.objectKey,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          createdBy: data.createdBy,
          createdAt: new Date("2026-06-20T10:01:00Z"),
        };
        archiveArtifactRows.set(artifact.id, artifact);
        return artifact;
      }
    );
    prisma.project.update.mockResolvedValue({
      id: "project-1",
      status: "ARCHIVED",
    });
    prisma.projectMember.findMany.mockResolvedValue([
      { userId: "partner-1" },
      { userId: "manager-1" },
    ]);
  });

  function service() {
    return new ArchiveJobService(
      prisma as never,
      access as never,
      archiveChecks as never,
      storage as never,
      inbox as never,
      undefined,
      smartFormPdf as never
    );
  }

  it("reads archive jobs from persisted storage", async () => {
    const createdAt = new Date("2026-06-20T10:00:00Z");
    const updatedAt = new Date("2026-06-20T10:01:00Z");
    prisma.projectArchiveJob.findFirst.mockResolvedValue({
      id: "archive-job-db",
      projectId: "project-1",
      status: "running",
      currentPhase: "uploading",
      currentLabel: "Uploading archive package",
      completedUnits: 2,
      totalUnits: 4,
      errorMessage: null,
      artifactId: null,
      createdBy: "admin-1",
      startedAt: createdAt,
      completedAt: null,
      createdAt,
      updatedAt,
      artifact: null,
    });
    const instance = service();
    const job = await instance.getJob("project-1", "archive-job-db", {
      id: "admin-1",
      globalRole: "SUPER_ADMIN",
    } as never);

    expect(prisma.projectArchiveJob.findFirst).toHaveBeenCalledWith({
      where: { id: "archive-job-db", projectId: "project-1" },
      include: { artifact: true },
    });
    expect(job).toStrictEqual({
      jobId: "archive-job-db",
      projectId: "project-1",
      status: "running",
      currentPhase: "uploading",
      currentLabel: "Uploading archive package",
      progress: {
        completedUnits: 2,
        totalUnits: 4,
      },
      createdAt,
      updatedAt,
    });
  });

  it("archives by packaging current workpapers, persisting an artifact, and notifying members", async () => {
    const instance = service();
    const started = await instance.startJob("project-1", {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);
    const completed = await waitForArchiveJob(instance, started.jobId);

    expect(access.requireProjectAction).toHaveBeenCalledWith(
      "project-1",
      "partner-1",
      "archiveProject"
    );
    expect(prisma.workingPaper.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: "project-1", bucket: "CURRENT" },
      })
    );
    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "working-papers/project-1/paper-current/support.pdf"
    );
    expect(storage.putProjectArchive).toHaveBeenCalledWith(
      "project-1",
      "ABC-2026-archive.zip",
      expect.any(Buffer),
      "application/zip"
    );
    const archiveBody = storage.putProjectArchive.mock.calls[0][2] as Buffer;
    const zip = await loadEncryptedArchive(archiveBody);
    expect(zip.file("archive-plain.zip")).toBeNull();
    expect(zip.file("项目归档文件索引.pdf")).toBeTruthy();
    expect(zip.file("file-check-report.pdf")).toBeTruthy();
    expect(zip.file("manifest.xlsx")).toBeNull();
    expect(zip.file("项目归档文件清单.xlsx")).toBeNull();
    expect(zip.file("manifest.json")).toBeNull();
    expect(zip.file("file-check-report.json")).toBeNull();
    await expect(
      assertPresentValue(zip.file("file-check-report.pdf")).async("string")
    ).resolves.toContain("%PDF");
    expect(zip.files["workpapers/Reporting/A1/A1-1000/"]?.dir).toBeTruthy();
    expect(
      zip.file("workpapers/Reporting/A1/A1-1000/A1-1000-F001 support.pdf")
    ).toBeTruthy();
    const archiveIndexPdf = await assertPresentValue(
      zip.file("项目归档文件索引.pdf")
    ).async("nodebuffer");
    expect(archiveIndexPdf.subarray(0, 4).toString()).toBe("%PDF");
    const archiveIndexDocument = await PDFDocument.load(archiveIndexPdf);
    expect(archiveIndexDocument.getPageCount()).toBeGreaterThanOrEqual(2);
    const artifactInput = prisma.projectArchiveArtifact.create.mock.calls[0][0]
      .data as Record<string, unknown>;
    const manifest = artifactInput.manifestJson as {
      files: Record<string, unknown>[];
      project: Record<string, unknown>;
    };
    expect(manifest.project).not.toHaveProperty("archivePassword");
    expect(manifest.files).toContainEqual(
      expect.objectContaining({
        attachmentId: "attachment-current",
        fileName: "A1-1000-F001 support.pdf",
        archivePath: "workpapers/Reporting/A1/A1-1000/A1-1000-F001 support.pdf",
        preparerSignoff: expect.objectContaining({ name: "Amy Chan" }),
        reviewerSignoff: expect.objectContaining({ name: "Edric Han" }),
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    );
    expect(archiveChecks.renderReportPdf).toHaveBeenCalledWith(
      expect.objectContaining({ ready: true })
    );
    expect(prisma.projectArchiveArtifact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project-1",
        objectKey: "project-archives/project-1/archive.zip",
        createdBy: "partner-1",
      }),
    });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { status: "ARCHIVED" },
    });
    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "manager-1",
        senderId: "partner-1",
        projectId: "project-1",
        type: "SYSTEM_NOTIFICATION",
        title: "Project successfully archived: ABC-2026",
        body: "ABC-2026 has been successfully archived. The archive package is ready to download.",
      })
    );
    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "partner-1",
        senderId: null,
        projectId: "project-1",
        type: "SYSTEM_NOTIFICATION",
        title: "Project successfully archived: ABC-2026",
        body: "ABC-2026 has been successfully archived. The archive package is ready to download.",
      })
    );
    expect(completed).toStrictEqual(
      expect.objectContaining({
        status: "completed",
        artifact: expect.objectContaining({ id: "artifact-1" }),
      })
    );
  });

  it("allows super admins to start archive jobs for pending final check projects", async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      projectCode: "ABC-2026",
      name: "ABC Audit",
      language: "zh-CN",
      yearEndDate: new Date("2026-12-31T00:00:00.000Z"),
      workspace: { clientName: "Workspace Client" },
      cmpClient: { nameZh: "ABC 客户", nameEn: "ABC Client" },
      cmpEngagement: { engagementCode: "ABC-2026-AUD" },
      archivePassword: ARCHIVE_TEST_PASSWORD,
      status: "PENDING_FINAL_CHECK",
    });
    const instance = service();
    const started = await instance.startJob("project-1", {
      id: "admin-1",
      globalRole: "SUPER_ADMIN",
    } as never);
    const completed = await waitForArchiveJob(instance, started.jobId);

    expect(access.requireProjectAction).not.toHaveBeenCalled();
    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "project-1",
          status: { in: ["ACTIVE", "PENDING_FINAL_CHECK"] },
        }),
      })
    );
    expect(completed.status).toBe("completed");
  });

  it("archives an empty folder structure when current workpapers have no files", async () => {
    prisma.workingPaper.findMany.mockResolvedValue([]);
    const instance = service();
    const started = await instance.startJob("project-1", {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);
    const completed = await waitForArchiveJob(instance, started.jobId);

    expect(completed.status).toBe("completed");
    expect(storage.putProjectArchive).toHaveBeenCalledWith(
      "project-1",
      "ABC-2026-archive.zip",
      expect.any(Buffer),
      "application/zip"
    );
    const archiveBody = storage.putProjectArchive.mock.calls[0][2] as Buffer;
    const zip = await loadEncryptedArchive(archiveBody);
    expect(zip.file("项目归档文件索引.pdf")).toBeTruthy();
    expect(zip.file("file-check-report.pdf")).toBeTruthy();
    expect(zip.files["workpapers/Reporting/A1/A1-1000/"]?.dir).toBeTruthy();
    const manifest = prisma.projectArchiveArtifact.create.mock.calls[0][0].data
      .manifestJson as {
      files: unknown[];
      folders: Record<string, unknown>[];
    };
    expect(manifest.files).toStrictEqual([]);
    expect(manifest.folders).toContainEqual(
      expect.objectContaining({
        workflowNodeId: "node-a1-1000",
        entryPath: "workpapers/Reporting/A1/A1-1000/",
      })
    );
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { status: "ARCHIVED" },
    });
  });

  it("exports Smart Forms as readable PDF snapshots in the archive package", async () => {
    const smartFormPackage = {
      packageType: "PROJECT_WING_SMART_FORM",
      formatVersion: 2,
      template: {
        id: "smart-form-template-1",
        versionId: "smart-form-version-1",
        code: "SF-1",
        title: "Independence checklist",
        publishedAt: "2026-06-01T00:00:00.000Z",
        language: "en-US",
      },
      definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
      response: DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
      createdAt: "2026-06-02T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
    };
    prisma.workingPaper.findMany.mockResolvedValue([
      {
        id: "paper-current",
        code: "A1-1000-F001",
        title: "Cash",
        workflowNodeId: "node-a1-1000",
        bucket: "CURRENT",
        signoffs: [],
        attachments: [
          {
            id: "attachment-smart-form",
            code: "A1-1000-F002",
            originalName: "independence.sf",
            fileName: "independence.sf",
            fileUrl: "working-papers/project-1/paper-current/independence.sf",
            fileSize: 512,
            mimeType: "application/vnd.project-wing.smart-form+json",
            fileKind: "SMART_FORM",
            smartFormInstance: {
              status: "COMPLETE",
              completedAt: new Date("2026-06-03T00:00:00.000Z"),
              lastSavedAt: new Date("2026-06-03T00:00:00.000Z"),
            },
            reviewQuestions: [
              {
                id: "question-1",
                smartFormNodeId: "deferred-income-general-procedures",
                smartFormRowId: "deferred-income-procedure-2-a",
                body: "Explain the variance.",
                status: "OPEN",
                createdAt: new Date("2026-06-03T01:00:00.000Z"),
              },
            ],
          },
        ],
      },
    ]);
    storage.getObjectBuffer.mockResolvedValue(
      Buffer.from(JSON.stringify(smartFormPackage), "utf-8")
    );
    const instance = service();
    const started = await instance.startJob("project-1", {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);

    await waitForArchiveJob(instance, started.jobId);

    const archiveBody = storage.putProjectArchive.mock.calls[0][2] as Buffer;
    const zip = await loadEncryptedArchive(archiveBody);
    expect(
      zip.file("workpapers/Reporting/A1/A1-1000/independence.sf")
    ).toBeNull();
    expect(
      zip.file("workpapers/Reporting/A1/A1-1000/A1-1000-F002 independence.docx")
    ).toBeNull();
    const smartFormPdfEntry = zip.file(
      "workpapers/Reporting/A1/A1-1000/A1-1000-F002 independence.pdf"
    );
    expect(smartFormPdfEntry).toBeTruthy();
    await expect(
      assertPresentValue(smartFormPdfEntry).async("string")
    ).resolves.toContain("%PDF");
    expect(smartFormPdf.renderSmartFormV2Pdf).toHaveBeenCalledWith(
      expect.objectContaining({
        definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
        response: DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
        locale: "en-US",
        fileName: "A1-1000-F002 independence.sf",
        engagementDetails: {
          clientName: "ABC Client",
          engagementCode: "ABC-2026-AUD",
          financialStatementDate: new Date("2026-12-31T00:00:00.000Z"),
        },
        reviewQuestions: [expect.objectContaining({ id: "question-1" })],
      })
    );
    const manifest = prisma.projectArchiveArtifact.create.mock.calls[0][0].data
      .manifestJson as { files: Record<string, unknown>[] };
    expect(manifest.files).toContainEqual(
      expect.objectContaining({
        attachmentId: "attachment-smart-form",
        fileName: "A1-1000-F002 independence.pdf",
        archivePath:
          "workpapers/Reporting/A1/A1-1000/A1-1000-F002 independence.pdf",
        mimeType: "application/pdf",
        fileKind: "SMART_FORM_EXPORT",
        sourceFileName: "A1-1000-F002 independence.sf",
        sourceFileKind: "SMART_FORM",
        smartFormStatus: "COMPLETE",
      })
    );
  });

  it("does not archive or upload when File Check has blockers", async () => {
    archiveChecks.assertReadyForArchive.mockRejectedValue(
      new Error("Archive File Check failed with 1 blocker(s)")
    );
    const instance = service();
    const started = await instance.startJob("project-1", {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);
    const failed = await waitForArchiveJob(instance, started.jobId);

    expect(failed.status).toBe("failed");
    expect(storage.putProjectArchive).not.toHaveBeenCalled();
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});

function hydrateArchiveJobRow(row: Record<string, unknown>) {
  const artifactId = row.artifactId ? String(row.artifactId) : null;
  return {
    ...row,
    artifact: artifactId ? (archiveArtifactRows.get(artifactId) ?? null) : null,
  };
}

async function waitForArchiveJob(
  service: ArchiveJobService,
  jobId: string,
  attempts = 400
) {
  for (let index = 0; index < attempts; index += 1) {
    const job = await service.getJob("project-1", jobId, {
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);
    if (job.status === "completed" || job.status === "failed") {
      return job;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
  }
  throw new Error("Timed out waiting for archive job");
}

async function loadEncryptedArchive(archiveBody: Buffer) {
  const tempRoot = await mkdtemp(
    pathModule.join(tmpdir(), "projectwing-archive-test-")
  );
  const encryptedPath = pathModule.join(tempRoot, "archive-encrypted.zip");
  const outputDir = pathModule.join(tempRoot, "output");
  const repackedPath = pathModule.join(tempRoot, "archive-repacked.zip");
  try {
    await writeFile(encryptedPath, archiveBody);
    await execFileAsync(
      path7za,
      ["x", `-p${ARCHIVE_TEST_PASSWORD}`, `-o${outputDir}`, encryptedPath],
      { windowsHide: true }
    );
    await execFileAsync(path7za, ["a", "-tzip", repackedPath, "*"], {
      cwd: outputDir,
      windowsHide: true,
    });
    return JSZip.loadAsync(await readFile(repackedPath));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
