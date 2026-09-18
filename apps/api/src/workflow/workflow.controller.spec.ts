import {
  DesktopMasterSessionController,
  WorkflowController,
} from "./workflow.controller";

describe("workflowController preview content caching", () => {
  it("does not cache or validate a signed inline redirect as document content", async () => {
    const redirectUrl = "https://storage.invalid/file.pdf?Expires=1";
    const previewAttachmentPdf = vi.fn().mockResolvedValue({
      fileName: "file.pdf",
      mimeType: "application/pdf",
      redirectUrl,
      cacheControl: "private, max-age=604800, immutable, no-transform",
      eTag: '"old-content-tag"',
      notModified: true,
    });
    const controller = new WorkflowController(
      { previewAttachmentPdf } as never,
      {} as never,
      {} as never
    );
    const response = {
      type: vi.fn(),
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      end: vi.fn(),
      redirect: vi.fn(),
    };
    await controller.previewAttachmentPdf(
      "p",
      "a",
      { id: "u" } as never,
      response as never,
      undefined,
      undefined,
      "1"
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store"
    );
    expect(response.setHeader).not.toHaveBeenCalledWith(
      "ETag",
      expect.anything()
    );
    expect(response.status).not.toHaveBeenCalledWith(304);
    expect(response.redirect).toHaveBeenCalledExactlyOnceWith(302, redirectUrl);
  });

  it("validates export event access before flushing SSE headers", async () => {
    const error = new Error("Forbidden");
    const controller = new WorkflowController(
      {} as never,
      {} as never,
      { getJob: vi.fn().mockRejectedValue(error) } as never
    );
    const response = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
    };

    await expect(
      controller.fileExportJobEvents(
        "project-1",
        "job-1",
        { id: "user-1" } as never,
        response as never
      )
    ).rejects.toBe(error);

    expect(response.setHeader).not.toHaveBeenCalled();
    expect(response.flushHeaders).not.toHaveBeenCalled();
  });

  it("returns 304 with private cache headers when the attachment is unchanged", async () => {
    const previewAttachmentContent = vi.fn().mockResolvedValue({
      fileName: "cash.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      cacheControl: "private, max-age=604800, immutable, no-transform",
      eTag: '"preview-etag"',
      notModified: true,
    });
    const controller = new WorkflowController(
      { previewAttachmentContent } as never,
      {} as never,
      {} as never
    );
    const response = {
      type: vi.fn(),
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };

    await controller.previewAttachmentContent(
      "project-1",
      "attachment-1",
      '"preview-etag"',
      { id: "user-1" } as never,
      { ip: "127.0.0.1" } as never,
      response as never,
      undefined,
      "3"
    );

    expect(previewAttachmentContent).toHaveBeenCalledWith(
      "project-1",
      "attachment-1",
      { id: "user-1" },
      { ip: "127.0.0.1" },
      '"preview-etag"',
      3
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "private, max-age=604800, immutable, no-transform"
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "Vary",
      "Accept, Authorization, Cookie, Origin"
    );
    expect(response.setHeader).toHaveBeenCalledWith("ETag", '"preview-etag"');
    expect(response.status).toHaveBeenCalledWith(304);
    expect(response.end).toHaveBeenCalledWith();
  });

  it("uses the blob transport without exposing a PDF disposition", async () => {
    const body = Buffer.from("pdf");
    const previewAttachmentContent = vi.fn().mockResolvedValue({
      fileName: "cash.pdf",
      mimeType: "application/pdf",
      body,
    });
    const controller = new WorkflowController(
      { previewAttachmentContent } as never,
      {} as never,
      {} as never
    );
    const response = {
      type: vi.fn(),
      setHeader: vi.fn(),
      send: vi.fn(),
    };

    await controller.previewAttachmentContent(
      "project-1",
      "attachment-1",
      undefined,
      { id: "user-1" } as never,
      { ip: "127.0.0.1" } as never,
      response as never,
      "application/vnd.project-wing.preview"
    );

    expect(response.type).toHaveBeenCalledWith(
      "application/vnd.project-wing.preview"
    );
    expect(response.setHeader).not.toHaveBeenCalledWith(
      "Content-Disposition",
      expect.anything()
    );
    expect(response.send).toHaveBeenCalledWith(body);
  });

  it("sends buffered attachment exports with attachment disposition", async () => {
    const body = Buffer.from("zip");
    const exportAttachment = vi.fn().mockResolvedValue({
      fileName: "A1-F001 cash-export.zip",
      mimeType: "application/zip",
      body,
    });
    const controller = new WorkflowController(
      { exportAttachment } as never,
      {} as never,
      {} as never
    );
    const response = {
      type: vi.fn(),
      setHeader: vi.fn(),
      send: vi.fn(),
    };

    await controller.exportAttachment(
      "project-1",
      "attachment-1",
      "zip",
      { id: "user-1" } as never,
      { ip: "127.0.0.1" } as never,
      response as never
    );

    expect(exportAttachment).toHaveBeenCalledWith(
      "project-1",
      "attachment-1",
      "zip",
      { id: "user-1" },
      { ip: "127.0.0.1" }
    );
    expect(response.type).toHaveBeenCalledWith("application/zip");
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringContaining("attachment;")
    );
    expect(response.send).toHaveBeenCalledWith(body);
  });

  it("rejects unknown attachment export formats", async () => {
    const exportAttachment = vi.fn();
    const controller = new WorkflowController(
      { exportAttachment } as never,
      {} as never,
      {} as never
    );

    await expect(
      controller.exportAttachment(
        "project-1",
        "attachment-1",
        "txt",
        { id: "user-1" } as never,
        { ip: "127.0.0.1" } as never,
        {} as never
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
    expect(exportAttachment).not.toHaveBeenCalled();
  });

  it("returns attachment signoff history for a project member", async () => {
    const attachmentSignoffHistory = vi.fn().mockResolvedValue({
      attachmentId: "attachment-1",
      rounds: [],
    });
    const controller = new WorkflowController(
      { attachmentSignoffHistory } as never,
      {} as never,
      {} as never
    );

    await expect(
      controller.attachmentSignoffHistory("project-1", "attachment-1", {
        id: "user-1",
      } as never)
    ).resolves.toMatchObject({ attachmentId: "attachment-1" });

    expect(attachmentSignoffHistory).toHaveBeenCalledWith(
      "project-1",
      "attachment-1",
      { id: "user-1" }
    );
  });

  it("validates and forwards a signoff revocation request", async () => {
    const revokeAttachmentSignoff = vi.fn().mockResolvedValue({
      attachmentId: "attachment-1",
      rounds: [],
    });
    const controller = new WorkflowController(
      { revokeAttachmentSignoff } as never,
      {} as never,
      {} as never
    );
    const user = { id: "user-1" };
    const source = { ip: "127.0.0.1" };

    await controller.revokeAttachmentSignoff(
      "project-1",
      "attachment-1",
      "signoff-1",
      { reason: "Superseded by the corrected review." },
      user as never,
      source as never
    );

    expect(revokeAttachmentSignoff).toHaveBeenCalledWith(
      "project-1",
      "attachment-1",
      "signoff-1",
      user,
      { reason: "Superseded by the corrected review." },
      source
    );
  });
});

describe("desktopMasterSessionController native Runtime JSON compatibility", () => {
  it("accepts a numeric lockEpoch in heartbeat JSON", async () => {
    const heartbeatDesktopMasterSession = vi
      .fn()
      .mockResolvedValue({ ok: true });
    const controller = new DesktopMasterSessionController({
      heartbeatDesktopMasterSession,
    } as never);

    await controller.heartbeat("lock-session", {
      projectId: " project ",
      attachmentId: " attachment ",
      grantSecret: " secret ",
      lockEpoch: 7,
    });

    expect(heartbeatDesktopMasterSession).toHaveBeenCalledWith({
      projectId: "project",
      attachmentId: "attachment",
      lockSessionId: "lock-session",
      grantSecret: "secret",
      lockEpoch: 7,
    });
  });

  it("accepts numeric baseVersion, lockEpoch, and fileSize in check-in JSON", async () => {
    const checkInDesktopMasterSession = vi.fn().mockResolvedValue({ ok: true });
    const controller = new DesktopMasterSessionController({
      checkInDesktopMasterSession,
    } as never);

    await controller.checkIn(
      "lock-session",
      {
        projectId: "project",
        attachmentId: "attachment",
        grantSecret: "secret",
        baseVersion: 3,
        baseVersionId: "base-version",
        lockEpoch: 7,
        localContentHash: "a".repeat(64),
        localContentCrc64: "11051210869376104954",
        idempotencyKey: "idempotency",
        objectKey: "desktop-master-check-ins/object",
        fileName: "working-paper.xlsx",
        fileSize: 2048,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uploadAttemptId: "attempt-1",
      },
      undefined,
      undefined as never
    );

    expect(checkInDesktopMasterSession).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project",
        attachmentId: "attachment",
        lockSessionId: "lock-session",
        baseVersion: 3,
        lockEpoch: 7,
        fileSize: 2048,
      }),
      undefined,
      undefined
    );
  });

  it.each(["CHECKED_IN", "RECOVERY_ENDED"])(
    "accepts a numeric lockEpoch and %s reason in release JSON",
    async (reason) => {
      const releaseDesktopMasterSession = vi
        .fn()
        .mockResolvedValue({ ok: true });
      const controller = new DesktopMasterSessionController({
        releaseDesktopMasterSession,
      } as never);

      await controller.release(
        "lock-session",
        {
          projectId: "project",
          attachmentId: "attachment",
          grantSecret: "secret",
          lockEpoch: 7,
          reason,
        },
        undefined as never
      );

      expect(releaseDesktopMasterSession).toHaveBeenCalledWith(
        {
          projectId: "project",
          attachmentId: "attachment",
          lockSessionId: "lock-session",
          grantSecret: "secret",
          lockEpoch: 7,
          reason,
        },
        undefined
      );
    }
  );
});
