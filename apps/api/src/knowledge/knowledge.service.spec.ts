import JSZip from "jszip";

import {
  ApiBadRequestException,
  ApiConflictException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import { KnowledgeService } from "./knowledge.service";

const partner = {
  id: "user-1",
  email: "partner@example.com",
  name: "Pat Partner",
  globalRole: "PARTNER" as const,
};
const storedDocument = {
  id: "doc-1",
  referenceCode: "TECH-2026-001",
  title: "Technical update",
  department: "admin",
  type: "technicalAlert",
  originalName: "update.pdf",
  objectKey: "knowledge-documents/doc-1/file.pdf",
  mimeType: "application/pdf",
  size: 12,
  updatedAt: new Date("2026-08-02T05:00:00.000Z"),
  uploader: { name: "Pat Partner" },
};

describe(KnowledgeService, () => {
  function setup() {
    const prisma = {
      knowledgeDocument: {
        findMany: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      knowledgeDocumentAttachment: {
        findUnique: vi.fn(),
      },
    };
    const storage = {
      putKnowledgeDocument: vi.fn(),
      getObjectBuffer: vi.fn(),
      deleteObject: vi.fn(),
    };
    const auditLogs = { log: vi.fn() };
    return {
      service: new KnowledgeService(
        prisma as never,
        storage as never,
        auditLogs as never
      ),
      prisma,
      storage,
      auditLogs,
    };
  }

  it("lists persisted documents using the frontend item contract", async () => {
    const { service, prisma } = setup();
    prisma.knowledgeDocument.findMany.mockResolvedValue([storedDocument]);

    await expect(service.list()).resolves.toStrictEqual([
      {
        id: "doc-1",
        referenceCode: "TECH-2026-001",
        title: "Technical update",
        department: "admin",
        type: "technicalAlert",
        fileName: "update.pdf",
        mimeType: "application/pdf",
        owner: "Pat Partner",
        ownerAvatar: undefined,
        ownerId: undefined,
        updatedAt: storedDocument.updatedAt,
        previewUrl: "/knowledge-documents/doc-1/preview",
        previewVersion: "2026-08-02T05:00:00.000Z",
        downloadUrl: "/knowledge-documents/doc-1/download",
      },
    ]);
  });

  it("lists archived items separately", async () => {
    const { service, prisma } = setup();
    prisma.knowledgeDocument.findMany.mockResolvedValue([
      { ...storedDocument, status: "ARCHIVED" },
    ]);

    const result = await service.listArchived();

    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "ARCHIVED" } })
    );
    expect(result[0]?.status).toBe("ARCHIVED");
  });

  it("archives an item and records the acting user as its latest modifier", async () => {
    const { service, prisma, auditLogs } = setup();
    prisma.knowledgeDocument.findUnique.mockResolvedValue({ id: "doc-1" });
    prisma.knowledgeDocument.update.mockResolvedValue({
      ...storedDocument,
      status: "ARCHIVED",
    });

    await service.archive("doc-1", partner);

    expect(prisma.knowledgeDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ARCHIVED",
          uploadedById: partner.id,
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "KNOWLEDGE_DOCUMENT_ARCHIVED" })
    );
  });

  it("updates notice content and metadata and refreshes the latest modifier", async () => {
    const { service, prisma, auditLogs } = setup();
    prisma.knowledgeDocument.findUnique.mockResolvedValue(storedDocument);
    prisma.knowledgeDocument.update.mockResolvedValue({
      ...storedDocument,
      title: "Updated notice",
      department: "qm",
      type: "guide",
      kind: "NOTICE",
      body: { type: "doc", content: [{ type: "paragraph" }] },
      externalLink: null,
      previewAllowed: true,
      downloadAllowed: false,
      status: "PUBLISHED",
    });

    const result = await service.update(
      "doc-1",
      {
        body: JSON.stringify({
          type: "doc",
          content: [{ type: "paragraph" }],
        }),
        department: "qm",
        downloadAllowed: "false",
        kind: "NOTICE",
        previewAllowed: "true",
        title: "Updated notice",
        type: "guide",
      },
      undefined,
      partner
    );

    expect(prisma.knowledgeDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          department: "qm",
          title: "Updated notice",
          uploadedById: partner.id,
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "KNOWLEDGE_DOCUMENT_UPDATED" })
    );
    expect(result.title).toBe("Updated notice");
  });

  it("uploads a valid PDF for a partner and writes an audit log", async () => {
    const { service, prisma, storage, auditLogs } = setup();
    const body = Buffer.from("%PDF-1.7\nbody");
    storage.putKnowledgeDocument.mockResolvedValue({
      objectKey: storedDocument.objectKey,
      fileName: "file.pdf",
    });
    prisma.knowledgeDocument.create.mockResolvedValue(storedDocument);
    auditLogs.log.mockResolvedValue({ id: "audit-1" });

    const result = await service.upload(
      {
        referenceCode: " TECH-2026-001 ",
        title: " Technical update ",
        department: " admin ",
        type: " technicalAlert ",
      },
      {
        originalname: "update.pdf",
        mimetype: "application/pdf",
        size: body.length,
        buffer: body,
      },
      partner,
      { ipAddress: "127.0.0.1" }
    );

    expect(storage.putKnowledgeDocument).toHaveBeenCalledWith(
      expect.any(String),
      "update.pdf",
      body,
      "application/pdf"
    );
    expect(prisma.knowledgeDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referenceCode: "TECH-2026-001",
          department: "admin",
          type: "technicalAlert",
          uploadedById: partner.id,
          objectKey: storedDocument.objectKey,
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: partner.id,
        action: "KNOWLEDGE_DOCUMENT_UPLOADED",
        targetId: "doc-1",
        source: { ipAddress: "127.0.0.1" },
      })
    );
    expect(result.owner).toBe("Pat Partner");
  });

  it("publishes a notice without requiring an attachment or reference code", async () => {
    const { service, prisma, storage, auditLogs } = setup();
    prisma.knowledgeDocument.create.mockResolvedValue({
      ...storedDocument,
      referenceCode: null,
      originalName: null,
      objectKey: null,
      mimeType: null,
      size: null,
      kind: "NOTICE",
      secondaryCategory: "technical",
      tertiaryCategory: "audit",
      body: { type: "doc", content: [] },
      externalLink: null,
      previewAllowed: true,
      downloadAllowed: false,
      status: "PUBLISHED",
    });
    auditLogs.log.mockResolvedValue({ id: "audit-notice" });

    const result = await service.upload(
      {
        kind: "NOTICE",
        title: "Audit methodology update",
        department: "qm",
        type: "technicalAlert",
        secondaryCategory: "technical",
        tertiaryCategory: "audit",
        body: JSON.stringify({ type: "doc", content: [] }),
        downloadAllowed: "false",
      },
      undefined,
      partner
    );

    expect(storage.putKnowledgeDocument).not.toHaveBeenCalled();
    expect(prisma.knowledgeDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "NOTICE",
          referenceCode: null,
          secondaryCategory: "technical",
          tertiaryCategory: "audit",
          objectKey: null,
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "KNOWLEDGE_NOTICE_PUBLISHED" })
    );
    expect(result.kind).toBe("NOTICE");
    expect(result.downloadUrl).toBeUndefined();
  });

  it("defensively rejects uploads from other roles", async () => {
    const { service, storage } = setup();

    await expect(
      service.upload({}, undefined, { ...partner, globalRole: "MANAGER" })
    ).rejects.toBeInstanceOf(ApiForbiddenException);
    expect(storage.putKnowledgeDocument).not.toHaveBeenCalled();
  });

  it("rejects a spoofed PDF before writing storage", async () => {
    const { service, storage } = setup();

    await expect(
      service.upload(
        {
          referenceCode: "TECH-2026-001",
          title: "Technical update",
          department: "admin",
          type: "technicalAlert",
        },
        {
          originalname: "update.pdf",
          mimetype: "application/pdf",
          size: 4,
          buffer: Buffer.from("nope"),
        },
        partner
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(storage.putKnowledgeDocument).not.toHaveBeenCalled();
  });

  it("rejects an Office extension and MIME mismatch", async () => {
    const { service, storage } = setup();
    const body = await openXmlBody("word");

    await expect(
      service.upload(
        {
          referenceCode: "ADM-001",
          title: "Administration guide",
          department: "admin",
          type: "guide",
        },
        {
          originalname: "guide.docx",
          mimetype: "application/vnd.ms-excel",
          size: body.length,
          buffer: body,
        },
        partner
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(storage.putKnowledgeDocument).not.toHaveBeenCalled();
  });

  it("defensively rejects files larger than 20 MiB", async () => {
    const { service, storage } = setup();

    await expect(
      service.upload(
        {
          referenceCode: "ADM-001",
          title: "Administration guide",
          department: "admin",
          type: "guide",
        },
        {
          originalname: "guide.pdf",
          mimetype: "application/pdf",
          size: 20 * 1024 * 1024 + 1,
          buffer: Buffer.from("%PDF-1.7"),
        },
        partner
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(storage.putKnowledgeDocument).not.toHaveBeenCalled();
  });

  it("rejects an OOXML package from a different Office application", async () => {
    const { service, storage } = setup();
    const body = await openXmlBody("xl");

    await expect(
      service.upload(
        {
          referenceCode: "ADM-001",
          title: "Administration guide",
          department: "admin",
          type: "guide",
        },
        {
          originalname: "guide.docx",
          mimetype:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: body.length,
          buffer: body,
        },
        partner
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(storage.putKnowledgeDocument).not.toHaveBeenCalled();
  });

  it.each([
    ["department", "all"],
    ["department", "technical"],
    ["type", "all"],
    ["type", "technical-alert"],
  ])("rejects invalid %s id %s", async (field, value) => {
    const { service, storage } = setup();
    const metadata = {
      referenceCode: "TECH-2026-001",
      title: "Technical update",
      department: "qm",
      type: "technicalAlert",
      [field]: value,
    };

    await expect(
      service.upload(metadata, undefined, partner)
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(storage.putKnowledgeDocument).not.toHaveBeenCalled();
  });

  it.each([
    ["report.doc", "application/msword", "ole"],
    [
      "report.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "word",
    ],
    ["report.xls", "application/vnd.ms-excel", "ole"],
    [
      "report.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "xl",
    ],
    ["report.ppt", "application/vnd.ms-powerpoint", "ole"],
    [
      "report.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "ppt",
    ],
  ])("accepts supported Portal file %s", async (fileName, mimeType, kind) => {
    const { service, prisma, storage, auditLogs } = setup();
    const body =
      kind === "ole" ? legacyOfficeBody() : await openXmlBody(String(kind));
    storage.putKnowledgeDocument.mockResolvedValue({
      objectKey: storedDocument.objectKey,
      fileName,
    });
    prisma.knowledgeDocument.create.mockResolvedValue({
      ...storedDocument,
      originalName: fileName,
      mimeType,
    });
    auditLogs.log.mockResolvedValue({ id: "audit-1" });

    const result = await service.upload(
      {
        referenceCode: "TECH-2026-001",
        title: "Technical update",
        department: "qm",
        type: "guide",
      },
      {
        originalname: fileName,
        mimetype: mimeType,
        size: body.length,
        buffer: body,
      },
      partner
    );

    expect(storage.putKnowledgeDocument).toHaveBeenCalledWith(
      expect.any(String),
      fileName,
      body,
      mimeType
    );
    expect(result.previewUrl).toBeUndefined();
    expect(result.fileName).toBe(fileName);
    expect(result.mimeType).toBe(mimeType);
    expect(result.downloadUrl).toBe("/knowledge-documents/doc-1/download");
  });

  it("removes the stored object when the reference code already exists", async () => {
    const { service, prisma, storage } = setup();
    const body = Buffer.from("%PDF-1.7\nbody");
    storage.putKnowledgeDocument.mockResolvedValue({
      objectKey: storedDocument.objectKey,
      fileName: "file.pdf",
    });
    prisma.knowledgeDocument.create.mockRejectedValue({ code: "P2002" });
    storage.deleteObject.mockResolvedValue(undefined as never);

    await expect(
      service.upload(
        {
          referenceCode: "TECH-2026-001",
          title: "Technical update",
          department: "admin",
          type: "technicalAlert",
        },
        {
          originalname: "update.pdf",
          mimetype: "application/pdf",
          size: body.length,
          buffer: body,
        },
        partner
      )
    ).rejects.toBeInstanceOf(ApiConflictException);
    expect(storage.deleteObject).toHaveBeenCalledWith(storedDocument.objectKey);
  });

  it("preserves the stored object when audit failure rollback also fails", async () => {
    const { service, prisma, storage, auditLogs } = setup();
    const body = Buffer.from("%PDF-1.7\nbody");
    const auditError = new Error("audit unavailable");
    storage.putKnowledgeDocument.mockResolvedValue({
      objectKey: storedDocument.objectKey,
      fileName: "file.pdf",
    });
    prisma.knowledgeDocument.create.mockResolvedValue(storedDocument);
    auditLogs.log.mockRejectedValue(auditError);
    prisma.knowledgeDocument.delete.mockRejectedValue(
      new Error("database unavailable")
    );

    await expect(
      service.upload(
        {
          referenceCode: "TECH-2026-001",
          title: "Technical update",
          department: "admin",
          type: "technicalAlert",
        },
        {
          originalname: "update.pdf",
          mimetype: "application/pdf",
          size: body.length,
          buffer: body,
        },
        partner
      )
    ).rejects.toBe(auditError);
    expect(prisma.knowledgeDocument.delete).toHaveBeenCalledWith({
      where: { id: "doc-1" },
    });
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it("returns the persisted PDF body", async () => {
    const { service, prisma, storage } = setup();
    prisma.knowledgeDocument.findUnique.mockResolvedValue(storedDocument);
    storage.getObjectBuffer.mockResolvedValue(Buffer.from("%PDF-file"));

    await expect(service.getFile("doc-1")).resolves.toStrictEqual({
      fileName: "update.pdf",
      mimeType: "application/pdf",
      etag: expect.stringMatching(/^W\/"doc-1-\d+"$/),
      body: Buffer.from("%PDF-file"),
    });
  });

  it("rejects archived files before reading object storage", async () => {
    const { service, prisma, storage } = setup();
    prisma.knowledgeDocument.findUnique.mockResolvedValue({
      ...storedDocument,
      status: "ARCHIVED",
    });

    await expect(service.getFile("doc-1", "preview")).rejects.toBeInstanceOf(
      ApiForbiddenException
    );
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
  });

  it("checks attachment permissions before reading object storage", async () => {
    const { service, prisma, storage } = setup();
    prisma.knowledgeDocumentAttachment.findUnique.mockResolvedValue({
      originalName: "restricted.pdf",
      objectKey: "knowledge/restricted.pdf",
      mimeType: "application/pdf",
      createdAt: new Date("2026-08-02T05:00:00.000Z"),
      document: {
        downloadAllowed: false,
        previewAllowed: false,
        status: "PUBLISHED",
      },
    });

    await expect(
      service.getAttachment("attachment-1", "preview")
    ).rejects.toBeInstanceOf(ApiForbiddenException);
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
  });

  it("does not reuse an attachment while hydrating mixed new and legacy nodes", async () => {
    const { service, prisma } = setup();
    prisma.knowledgeDocument.findMany.mockResolvedValue([
      {
        ...storedDocument,
        kind: "NOTICE",
        body: {
          type: "doc",
          content: [
            {
              type: "knowledgeAttachment",
              attrs: { attachmentId: "attachment-1" },
            },
            { type: "knowledgeAttachment", attrs: {} },
          ],
        },
        attachments: [
          {
            id: "attachment-1",
            originalName: "first.pdf",
            objectKey: "knowledge/first.pdf",
            mimeType: "application/pdf",
            size: 10,
            createdAt: new Date("2026-08-01T00:00:00.000Z"),
          },
          {
            id: "attachment-2",
            originalName: "second.pdf",
            objectKey: "knowledge/second.pdf",
            mimeType: "application/pdf",
            size: 20,
            createdAt: new Date("2026-08-02T00:00:00.000Z"),
          },
        ],
      },
    ]);

    const [item] = await service.list();
    const { content } = item.body as {
      content: { attrs: { attachmentId: string } }[];
    };
    expect(content.map((node) => node.attrs.attachmentId)).toStrictEqual([
      "attachment-1",
      "attachment-2",
    ]);
  });

  it("returns not found for an unknown document", async () => {
    const { service, prisma } = setup();
    prisma.knowledgeDocument.findUnique.mockResolvedValue(null);

    await expect(service.getFile("missing")).rejects.toBeInstanceOf(
      ApiNotFoundException
    );
  });
});

function legacyOfficeBody() {
  return Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.from("legacy-office"),
  ]);
}

async function openXmlBody(directory: string) {
  await Promise.resolve();
  const archive = new JSZip();
  archive.file("[Content_Types].xml", "<Types />");
  archive.file(`${directory}/document.xml`, "<document />");
  return archive.generateAsync({ type: "nodebuffer" });
}
