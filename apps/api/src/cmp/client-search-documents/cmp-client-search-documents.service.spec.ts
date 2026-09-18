import { ApiBadRequestException } from "../../common/api-error";
import {
  CmpClientSearchDocumentsService,
  normalizeMultipartFileName,
} from "./cmp-client-search-documents.service";

describe(CmpClientSearchDocumentsService, () => {
  const user = {
    id: "user-1",
    email: "partner@example.com",
    name: "Partner",
    globalRole: "PARTNER" as const,
  };
  const document = {
    id: "document-1",
    clientId: "client-1",
    category: "AML_SEARCH" as const,
    fileName: "stored.docx",
    originalName: "aml-result.docx",
    fileUrl: "cmp-client-search-documents/client-1/document-1/stored.docx",
    fileSize: 1024,
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    version: 1,
    contentHash: "hash",
    uploadedById: user.id,
    createdAt: new Date("2026-08-12T00:00:00.000Z"),
    updatedAt: new Date("2026-08-12T00:00:00.000Z"),
    uploadedBy: { id: user.id, name: user.name },
  };

  function setup() {
    const prisma = {
      cmpClient: {
        findUnique: vi.fn().mockResolvedValue({ id: "client-1" }),
      },
      cmpClientSearchDocument: {
        create: vi.fn().mockResolvedValue(document),
        delete: vi.fn().mockResolvedValue(document),
        findMany: vi.fn().mockResolvedValue([document]),
        findUnique: vi.fn().mockResolvedValue(document),
      },
    };
    const storage = {
      deleteObjectIfPresent: vi.fn().mockResolvedValue(undefined as never),
      getObjectBuffer: vi.fn().mockResolvedValue(Buffer.from("%PDF-preview")),
      getDownloadObject: vi.fn().mockReturnValue({
        absolutePath: "C:/uploads/stored.docx",
        fileName: document.originalName,
        mimeType: document.mimeType,
      }),
      putCmpClientSearchDocument: vi.fn().mockResolvedValue({
        fileName: document.fileName,
        objectKey: document.fileUrl,
      }),
    };
    const conversion = {
      clearAttachmentPreviewCache: vi
        .fn()
        .mockResolvedValue(undefined as never),
      getAttachmentPreviewPdf: vi.fn().mockResolvedValue({
        absolutePath: "C:/uploads/preview.pdf",
        fileName: "aml-result.pdf",
        mimeType: "application/pdf",
      }),
    };
    const spreadsheetPreview = {
      warmAttachmentPreview: vi.fn().mockResolvedValue({ sheets: [] }),
    };
    const auditLogs = {
      log: vi.fn().mockResolvedValue(undefined as never),
    };
    return {
      auditLogs,
      conversion,
      prisma,
      service: new CmpClientSearchDocumentsService(
        prisma as never,
        storage as never,
        conversion as never,
        spreadsheetPreview as never,
        auditLogs as never
      ),
      spreadsheetPreview,
      storage,
    };
  }

  it("stores an allowed Office file and warms its preview cache", async () => {
    const { conversion, prisma, service, storage } = setup();
    const result = await service.upload(
      "client-1",
      "AML_SEARCH",
      {
        originalname: "aml-result.docx",
        mimetype: "application/octet-stream",
        size: 1024,
        buffer: Buffer.from("document"),
      },
      user
    );

    expect(storage.putCmpClientSearchDocument).toHaveBeenCalledOnce();
    expect(prisma.cmpClientSearchDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "AML_SEARCH",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      })
    );
    expect(conversion.getAttachmentPreviewPdf).toHaveBeenCalledWith(document);
    expect(result.fileName).toBe("aml-result.docx");
  });

  it("repairs UTF-8 multipart file names before storing and when reading legacy rows", async () => {
    const { prisma, service, storage } = setup();
    const expected = "函证控制表_20201231.xlsx";
    const mojibake = Buffer.from(expected, "utf-8").toString("latin1");
    prisma.cmpClientSearchDocument.create.mockResolvedValueOnce({
      ...document,
      fileName: expected,
      originalName: expected,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await service.upload(
      "client-1",
      "AML_SEARCH",
      {
        originalname: mojibake,
        mimetype: "application/octet-stream",
        size: 1024,
        buffer: Buffer.from("workbook"),
      },
      user
    );

    expect(storage.putCmpClientSearchDocument).toHaveBeenCalledWith(
      "client-1",
      expect.any(String),
      expected,
      expect.any(Buffer),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(normalizeMultipartFileName(mojibake)).toBe(expected);
    expect(normalizeMultipartFileName(expected)).toBe(expected);
  });

  it("warms an Excel workbook with the spreadsheet cache without converting it to PDF", async () => {
    const { conversion, prisma, service, spreadsheetPreview } = setup();
    const workbookDocument = {
      ...document,
      fileName: "stored.xlsx",
      originalName: "aml-result.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    prisma.cmpClientSearchDocument.create.mockResolvedValueOnce(
      workbookDocument
    );

    await service.upload(
      "client-1",
      "AML_SEARCH",
      {
        originalname: "aml-result.xlsx",
        mimetype: "application/octet-stream",
        size: 1024,
        buffer: Buffer.from("workbook"),
      },
      user
    );

    expect(spreadsheetPreview.warmAttachmentPreview).toHaveBeenCalledWith(
      workbookDocument
    );
    expect(conversion.getAttachmentPreviewPdf).not.toHaveBeenCalled();
  });

  it("rejects unsupported uploads before writing storage", async () => {
    const { service, storage } = setup();
    await expect(
      service.upload(
        "client-1",
        "COMPANY_SEARCH",
        {
          originalname: "search.exe",
          mimetype: "application/octet-stream",
          size: 10,
          buffer: Buffer.from("x"),
        },
        user
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(storage.putCmpClientSearchDocument).not.toHaveBeenCalled();
  });

  it("removes the file and its preview cache", async () => {
    const { conversion, prisma, service, storage } = setup();
    await service.remove(document.id, user);
    expect(prisma.cmpClientSearchDocument.delete).toHaveBeenCalledWith({
      where: { id: document.id },
    });
    expect(storage.deleteObjectIfPresent).toHaveBeenCalledWith(
      document.fileUrl
    );
    expect(conversion.clearAttachmentPreviewCache).toHaveBeenCalledWith(
      document.id
    );
  });
});
