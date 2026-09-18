import { Logger } from "@nestjs/common";

import {
  AttachmentPreviewWorkerService,
  attachmentPreviewDataForCommittedFile,
  attachmentPreviewDataForFile,
  queueAttachmentPreviewData,
} from "./attachment-preview-worker.service";

describe(AttachmentPreviewWorkerService, () => {
  it("does not start lifecycle or interval work in maintenance mode", async () => {
    vi.stubEnv("PROJECTWING_BACKGROUND_JOBS_ENABLED", "false");
    try {
      const worker = new AttachmentPreviewWorkerService(
        {} as never,
        {} as never
      );
      const processNext = vi
        .spyOn(worker, "processNext")
        .mockResolvedValue(false);

      worker.onModuleInit();
      worker.processScheduledPreview();
      await Promise.resolve();

      expect(processNext).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("drains the next queued job without waiting for another poll", async () => {
    const worker = new AttachmentPreviewWorkerService({} as never, {} as never);
    const processNext = vi
      .spyOn(worker, "processNext")
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    worker.processScheduledPreview();
    await vi.waitFor(() => expect(processNext).toHaveBeenCalledTimes(2));
  });

  it("claims a queued version and marks it ready only after cache generation", async () => {
    const attachment = {
      id: "attachment-1",
      projectId: "project-1",
      fileUrl: "working-papers/project-1/paper-1/report.pdf",
      fileName: "report.pdf",
      originalName: "审计报告.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
      version: 3,
      previewStatus: "QUEUED",
      previewVersion: null,
      previewError: null,
      previewAttemptCount: 0,
      previewNextAttemptAt: null,
      previewLeaseToken: null,
      previewLeaseExpiresAt: null,
      previewUpdatedAt: null,
      deletedAt: null,
      lastModifiedAt: new Date(),
      updatedAt: new Date(),
    };
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    const prisma = {
      attachment: {
        findFirst: vi.fn().mockResolvedValue(attachment),
        updateMany,
      },
    };
    const rasterPreview = {
      clearAttachmentPreviewCache: vi
        .fn()
        .mockResolvedValue(undefined as never),
      warmAttachmentRasterPreview: vi.fn().mockResolvedValue({
        attachmentId: attachment.id,
        version: attachment.version,
      }),
    };
    const worker = new AttachmentPreviewWorkerService(
      prisma as never,
      rasterPreview as never
    );

    await worker.processNext();

    expect(rasterPreview.warmAttachmentRasterPreview).toHaveBeenCalledWith(
      attachment
    );
    expect(rasterPreview.clearAttachmentPreviewCache).toHaveBeenCalledWith(
      attachment
    );
    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          id: attachment.id,
          version: 3,
          previewLeaseToken: expect.any(String),
        }),
        data: expect.objectContaining({
          previewStatus: "READY",
          previewVersion: 3,
          previewLeaseToken: null,
        }),
      })
    );
  });

  it("resets all processing state when a new version is committed", () => {
    expect(queueAttachmentPreviewData()).toStrictEqual(
      expect.objectContaining({
        previewStatus: "QUEUED",
        previewVersion: null,
        previewAttemptCount: 0,
        previewLeaseToken: null,
        previewLeaseExpiresAt: null,
      })
    );
  });

  it("reclaims an expired processing lease and fences completion by version and token", async () => {
    const attachment = {
      id: "attachment-2",
      projectId: "project-1",
      fileUrl: "working-papers/project-1/paper-1/report.pdf",
      fileName: "report.pdf",
      originalName: "report.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
      version: 4,
      previewStatus: "PROCESSING",
      previewVersion: null,
      previewError: null,
      previewAttemptCount: 1,
      previewNextAttemptAt: null,
      previewLeaseToken: "abandoned-token",
      previewLeaseExpiresAt: new Date(0),
      previewUpdatedAt: new Date(0),
      deletedAt: null,
      lastModifiedAt: new Date(),
      updatedAt: new Date(),
    };
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    const prisma = {
      attachment: {
        findFirst: vi.fn().mockResolvedValue(attachment),
        updateMany,
      },
    };
    const rasterPreview = {
      clearAttachmentPreviewCache: vi
        .fn()
        .mockResolvedValue(undefined as never),
      warmAttachmentRasterPreview: vi
        .fn()
        .mockResolvedValue(undefined as never),
    };

    await new AttachmentPreviewWorkerService(
      prisma as never,
      rasterPreview as never
    ).processNext();

    expect(updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: attachment.id,
          version: 4,
          OR: expect.arrayContaining([
            expect.objectContaining({ previewStatus: "PROCESSING" }),
          ]),
        }),
      })
    );
    const completion = updateMany.mock.calls[1]?.[0];
    expect(completion.where).toStrictEqual(
      expect.objectContaining({
        id: attachment.id,
        version: 4,
        previewLeaseToken: expect.any(String),
      })
    );
    expect(completion.where.previewLeaseToken).not.toBe("abandoned-token");
  });

  it("persists a retryable failure without throwing into the upload path", async () => {
    const warn = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => {});
    const attachment = {
      id: "attachment-3",
      projectId: "project-1",
      fileUrl: "working-papers/project-1/paper-1/report.pdf",
      fileName: "report.pdf",
      originalName: "report.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
      version: 1,
      previewStatus: "QUEUED",
      previewVersion: null,
      previewError: null,
      previewAttemptCount: 0,
      previewNextAttemptAt: null,
      previewLeaseToken: null,
      previewLeaseExpiresAt: null,
      previewUpdatedAt: null,
      deletedAt: null,
      lastModifiedAt: new Date(),
      updatedAt: new Date(),
    };
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    const prisma = {
      attachment: {
        findFirst: vi.fn().mockResolvedValue(attachment),
        updateMany,
      },
    };
    const rasterPreview = {
      clearAttachmentPreviewCache: vi
        .fn()
        .mockResolvedValue(undefined as never),
      warmAttachmentRasterPreview: vi
        .fn()
        .mockRejectedValue(new Error("converter unavailable")),
    };

    await expect(
      new AttachmentPreviewWorkerService(
        prisma as never,
        rasterPreview as never
      ).processNext()
    ).resolves.toBeTruthy();

    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          id: attachment.id,
          version: 1,
          previewLeaseToken: expect.any(String),
        }),
        data: expect.objectContaining({
          previewStatus: "FAILED",
          previewError: "converter unavailable",
          previewLeaseToken: null,
          previewNextAttemptAt: expect.any(Date),
        }),
      })
    );
    expect(warn).toHaveBeenCalledWith(
      "Preview generation failed for attachment attachment-3 v1: converter unavailable"
    );
    warn.mockRestore();
  });

  it("queues PDF, convertible Office documents, and spreadsheets", () => {
    expect(
      attachmentPreviewDataForFile({
        fileName: "report.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }).previewStatus
    ).toBe("QUEUED");
    expect(
      attachmentPreviewDataForFile({
        fileName: "ledger.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }).previewStatus
    ).toBe("QUEUED");
  });

  it("dispatches spreadsheet jobs to the persistent spreadsheet cache", async () => {
    const attachment = {
      id: "attachment-sheet",
      projectId: "project-1",
      fileUrl: "working-papers/project-1/paper-1/ledger.xlsx",
      fileName: "ledger.xlsx",
      originalName: "ledger.xlsx",
      fileSize: 1024,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      version: 1,
      previewStatus: "QUEUED",
      previewVersion: null,
      previewError: null,
      previewAttemptCount: 0,
      previewNextAttemptAt: null,
      previewLeaseToken: null,
      previewLeaseExpiresAt: null,
      previewUpdatedAt: null,
      deletedAt: null,
      lastModifiedAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = {
      attachment: {
        findFirst: vi.fn().mockResolvedValue(attachment),
        updateMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 }),
      },
    };
    const rasterPreview = {
      clearAttachmentPreviewCache: vi
        .fn()
        .mockResolvedValue(undefined as never),
      warmAttachmentRasterPreview: vi.fn(),
    };
    const spreadsheetPreview = {
      clearAttachmentPreviewCache: vi
        .fn()
        .mockResolvedValue(undefined as never),
      warmAttachmentPreview: vi.fn().mockResolvedValue(undefined as never),
    };

    await new AttachmentPreviewWorkerService(
      prisma as never,
      rasterPreview as never,
      spreadsheetPreview as never
    ).processNext();

    expect(spreadsheetPreview.warmAttachmentPreview).toHaveBeenCalledWith(
      attachment
    );
    expect(rasterPreview.warmAttachmentRasterPreview).not.toHaveBeenCalled();
  });

  it("keeps a ready cache ready when a committed version has identical bytes", () => {
    const previewUpdatedAt = new Date("2026-07-27T00:00:00.000Z");
    expect(
      attachmentPreviewDataForCommittedFile(
        {
          fileName: "report.pdf",
          mimeType: "application/pdf",
          version: 2,
          contentHash: "A".repeat(64),
          previewStatus: "READY",
          previewVersion: 2,
          previewUpdatedAt,
        },
        {
          fileName: "report.pdf",
          mimeType: "application/pdf",
          version: 3,
          contentHash: "a".repeat(64),
        }
      )
    ).toStrictEqual(
      expect.objectContaining({
        previewStatus: "READY",
        previewVersion: 3,
        previewAttemptCount: 0,
        previewUpdatedAt,
      })
    );
  });

  it("queues preview generation when committed bytes changed", () => {
    expect(
      attachmentPreviewDataForCommittedFile(
        {
          fileName: "report.pdf",
          mimeType: "application/pdf",
          version: 2,
          contentHash: "a".repeat(64),
          previewStatus: "READY",
          previewVersion: 2,
        },
        {
          fileName: "report.pdf",
          mimeType: "application/pdf",
          version: 3,
          contentHash: "b".repeat(64),
        }
      ).previewStatus
    ).toBe("QUEUED");
  });
});
