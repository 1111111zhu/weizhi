import { ConfirmationPrintService } from "./confirmation-print.service";

describe(ConfirmationPrintService, () => {
  const prisma = {
    projectConfirmation: { findUnique: vi.fn() },
  };
  const storage = {
    getDownloadObject: vi.fn(),
    getObjectBuffer: vi.fn(),
  };
  const auditLogs = { log: vi.fn() };
  const service = new ConfirmationPrintService(
    prisma as never,
    storage as never,
    auditLogs as never
  );

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.projectConfirmation.findUnique.mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      confirmationCode: "AUD-001",
      currentArtifact: {
        id: "artifact-1",
        disposition: "ACTIVE",
        pdfObjectKey: "confirmations/artifact-1.pdf",
      },
    });
    storage.getDownloadObject.mockResolvedValue({
      redirectUrl: "https://example.test/signed-artifact.pdf",
      fileName: "AUD-001-confirmation.pdf",
      mimeType: "application/pdf",
    });
    storage.getObjectBuffer.mockResolvedValue(Buffer.from("%PDF-1.4"));
  });

  it("serves the frozen artifact for an officer preview and records preview audit semantics", async () => {
    const user = {
      id: "officer-1",
      globalRole: "CONFIRMATION_OFFICER",
    } as never;
    const source = { ipAddress: "127.0.0.1" } as never;

    await expect(
      service.getPreviewArtifact("confirmation-1", user, source)
    ).resolves.toStrictEqual({
      body: Buffer.from("%PDF-1.4"),
      fileName: "AUD-001-confirmation.pdf",
      mimeType: "application/pdf",
    });

    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "confirmations/artifact-1.pdf"
    );
    expect(storage.getDownloadObject).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONFIRMATION_DOCUMENT_PREVIEWED",
        actorId: "officer-1",
        projectId: "project-1",
        targetId: "confirmation-1",
      })
    );
  });

  it("keeps printable downloads on the signed storage URL path", async () => {
    const user = {
      id: "officer-1",
      globalRole: "CONFIRMATION_OFFICER",
    } as never;

    await service.getPrintableArtifact("confirmation-1", user, {
      ipAddress: "127.0.0.1",
    } as never);

    expect(storage.getDownloadObject).toHaveBeenCalledWith(
      "confirmations/artifact-1.pdf",
      "AUD-001-confirmation.pdf",
      "application/pdf"
    );
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
  });

  it("previews an unsupported uploaded document with its raw bytes and MIME", async () => {
    const rawBody = Buffer.from("opaque msg bytes");
    prisma.projectConfirmation.findUnique.mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      confirmationCode: "AUD-001",
      currentArtifact: {
        id: "artifact-1",
        disposition: "ACTIVE",
        templateCode: "UPLOADED_DOCUMENT",
        pdfObjectKey: "confirmations/artifact-1.pdf",
        structuredSnapshot: {
          source: "UPLOAD",
          objectKey:
            "confirmation-artifacts/project-1/artifact-1/document.docx",
          fileName: "evidence.msg",
          mimeType: "application/vnd.ms-outlook",
          size: rawBody.byteLength,
          sha256: "source-sha256",
          previewIsPdf: false,
          previewMimeType: "application/vnd.ms-outlook",
        },
      },
    });
    storage.getObjectBuffer.mockResolvedValue(rawBody);

    await expect(
      service.getPreviewArtifact(
        "confirmation-1",
        { id: "officer-1", globalRole: "CONFIRMATION_OFFICER" } as never,
        { ipAddress: "127.0.0.1" } as never
      )
    ).resolves.toStrictEqual({
      body: rawBody,
      fileName: "evidence.msg",
      mimeType: "application/vnd.ms-outlook",
    });
    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "confirmation-artifacts/project-1/artifact-1/document.docx"
    );
  });

  it("downloads an unsupported uploaded document with its raw bytes contract", async () => {
    prisma.projectConfirmation.findUnique.mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      confirmationCode: "AUD-001",
      currentArtifact: {
        id: "artifact-1",
        disposition: "ACTIVE",
        templateCode: "UPLOADED_DOCUMENT",
        pdfObjectKey: "confirmations/artifact-1.pdf",
        structuredSnapshot: {
          source: "UPLOAD",
          objectKey:
            "confirmation-artifacts/project-1/artifact-1/document.docx",
          fileName: "evidence.msg",
          mimeType: "application/vnd.ms-outlook",
          size: 16,
          sha256: "source-sha256",
          previewIsPdf: false,
          previewMimeType: "application/vnd.ms-outlook",
        },
      },
    });

    await service.getPrintableArtifact(
      "confirmation-1",
      { id: "officer-1", globalRole: "CONFIRMATION_OFFICER" } as never,
      { ipAddress: "127.0.0.1" } as never
    );

    expect(storage.getDownloadObject).toHaveBeenCalledWith(
      "confirmation-artifacts/project-1/artifact-1/document.docx",
      "evidence.msg",
      "application/vnd.ms-outlook"
    );
  });

  it("keeps a successfully converted uploaded document on the PDF contract", async () => {
    prisma.projectConfirmation.findUnique.mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      confirmationCode: "AUD-001",
      currentArtifact: {
        id: "artifact-1",
        disposition: "ACTIVE",
        templateCode: "UPLOADED_DOCUMENT",
        pdfObjectKey: "confirmations/artifact-1.pdf",
        structuredSnapshot: {
          source: "UPLOAD",
          objectKey:
            "confirmation-artifacts/project-1/artifact-1/document.docx",
          fileName: "evidence.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: 16,
          sha256: "source-sha256",
          previewIsPdf: true,
          previewMimeType: "application/pdf",
        },
      },
    });

    await service.getPrintableArtifact(
      "confirmation-1",
      { id: "officer-1", globalRole: "CONFIRMATION_OFFICER" } as never,
      { ipAddress: "127.0.0.1" } as never
    );

    expect(storage.getDownloadObject).toHaveBeenCalledWith(
      "confirmations/artifact-1.pdf",
      "evidence.pdf",
      "application/pdf"
    );
  });
});
