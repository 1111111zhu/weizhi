import { Readable } from "node:stream";

import { Prisma } from "@prisma/client";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  existsSync: vi.fn(() => true),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readFile: vi.fn(async (filePath: string) =>
      filePath.includes("confirmation-templates")
        ? validDocx
        : actual.readFile(filePath)
    ),
    stat: vi.fn(async (filePath: string) =>
      filePath.includes("confirmation-templates")
        ? {
            birthtime: new Date("2026-08-01T00:00:00.000Z"),
            mtime: new Date("2026-08-01T00:00:00.000Z"),
            size: validDocx.length,
          }
        : actual.stat(filePath)
    ),
  };
});

import {
  ApiBadRequestException,
  ApiForbiddenException,
} from "../common/api-error";
import { ConfirmationTemplateLibraryService } from "./confirmation-template-library.service";

const transaction = {
  confirmationTemplateLibraryFile: {
    create: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  confirmationTemplateLibraryBuiltInOverride: {
    upsert: vi.fn(),
  },
};
const prisma = {
  $transaction: vi.fn(),
  confirmationTemplateLibraryFile: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  confirmationTemplateLibraryBuiltInOverride: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
};
const storage = {
  deleteObject: vi.fn(),
  getCacheObjectBuffer: vi.fn(),
  getDownloadObject: vi.fn(),
  getObjectBuffer: vi.fn(),
  putCacheObject: vi.fn(),
  putConfirmationTemplateLibraryFile: vi.fn(),
};
const auditLogs = {
  log: vi.fn(),
  logInTransaction: vi.fn(),
};
const documentConversion = {
  convertOfficeBufferToPdf: vi.fn(),
};
const source = { ipAddress: "127.0.0.1" };
const superAdmin = { id: "admin-1", globalRole: "SUPER_ADMIN" } as never;
const partner = { id: "partner-1", globalRole: "PARTNER" } as never;
const manager = { id: "manager-1", globalRole: "MANAGER" } as never;
const staff = { id: "staff-1", globalRole: "STAFF" } as never;
let validDocx: Buffer;
let validPdf: Buffer;

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" />
</Types>`;
const RELATIONSHIPS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml" />
</Relationships>`;
const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body />
</w:document>`;

async function createDocx(
  overrides: {
    contentTypes?: string | null;
    relationships?: string | null;
    document?: string | null;
    extraFiles?: {
      data: Buffer;
      name: string;
      compression?: "DEFLATE" | "STORE";
    }[];
  } = {}
) {
  await Promise.resolve();
  const archive = new JSZip();
  const contentTypes =
    overrides.contentTypes === undefined
      ? CONTENT_TYPES_XML
      : overrides.contentTypes;
  const relationships =
    overrides.relationships === undefined
      ? RELATIONSHIPS_XML
      : overrides.relationships;
  const document =
    overrides.document === undefined ? DOCUMENT_XML : overrides.document;
  if (contentTypes !== null) {
    archive.file("[Content_Types].xml", contentTypes);
  }
  if (relationships !== null) {
    archive.file("_rels/.rels", relationships);
  }
  if (document !== null) {
    archive.file("word/document.xml", document);
  }
  for (const extra of overrides.extraFiles ?? []) {
    archive.file(extra.name, extra.data, { compression: extra.compression });
  }
  return archive.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

function createService() {
  return new ConfirmationTemplateLibraryService(
    prisma as never,
    storage as never,
    auditLogs as never,
    documentConversion as never
  );
}

function uploadedFile(
  overrides: Partial<{
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
  }> = {}
) {
  const buffer = overrides.buffer ?? validPdf;
  return {
    buffer,
    mimetype: overrides.mimetype ?? "application/octet-stream",
    originalname: overrides.originalname ?? "template.pdf",
    size: overrides.size ?? buffer.length,
  };
}

function validDesignSchema() {
  return {
    version: 1,
    fields: [
      {
        id: "client-name",
        kind: "TEXT",
        name: "Client name",
        placeholder: "Enter client name",
        options: [],
        page: 1,
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.05,
      },
      {
        id: "confirmation-type",
        kind: "SELECT",
        name: "Confirmation type",
        placeholder: "Choose one",
        options: ["Bank", "Securities"],
        page: 1,
        x: 0.1,
        y: 0.3,
        width: 0.3,
        height: 0.05,
      },
      {
        id: "redaction-mask",
        kind: "MASK",
        name: "",
        placeholder: "",
        options: [],
        page: 2,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
    ],
  };
}

function validSourceRange(overrides: Record<string, unknown> = {}) {
  return {
    end: 15,
    paragraphId: "1A2B3C4D",
    paragraphOrdinal: 4,
    paragraphXmlSha256: "a".repeat(64),
    part: "word/document.xml",
    sourceText: "____",
    start: 11,
    ...overrides,
  };
}

function saveDesign(
  service: ConfirmationTemplateLibraryService,
  id: string,
  input: { designSchema: unknown; designStatus: string },
  user: unknown
) {
  return (
    service as unknown as {
      saveDesign: (
        id: string,
        input: { designSchema: unknown; designStatus: string },
        user: unknown,
        source: unknown
      ) => Promise<unknown>;
    }
  ).saveDesign(id, input, user, source);
}

function setStatus(
  service: ConfirmationTemplateLibraryService,
  id: string,
  status: string,
  user: unknown
) {
  return (
    service as unknown as {
      setStatus: (
        id: string,
        status: string,
        user: unknown,
        source: unknown
      ) => Promise<unknown>;
    }
  ).setStatus(id, status, user, source);
}

function bulkSetStatus(
  service: ConfirmationTemplateLibraryService,
  ids: string[],
  status: string,
  user: unknown
) {
  return (
    service as unknown as {
      bulkSetStatus: (
        ids: string[],
        status: string,
        user: unknown,
        source: unknown
      ) => Promise<unknown>;
    }
  ).bulkSetStatus(ids, status, user, source);
}

describe(ConfirmationTemplateLibraryService, () => {
  beforeAll(async () => {
    validDocx = await createDocx();
    const pdf = await PDFDocument.create();
    pdf.addPage([612, 792]);
    validPdf = Buffer.from(await pdf.save());
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => unknown) => {
        await Promise.resolve();
        return callback(transaction);
      }
    );
    storage.putConfirmationTemplateLibraryFile.mockResolvedValue({
      objectKey: "confirmation-template-library/template.docx",
    });
    storage.deleteObject.mockResolvedValue(undefined as never);
    storage.getCacheObjectBuffer.mockResolvedValue(null);
    storage.getDownloadObject.mockReturnValue({
      fileName: "template.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      redirectUrl: "https://oss.example.test/template.docx",
    });
    storage.getObjectBuffer.mockResolvedValue(validDocx);
    storage.putCacheObject.mockResolvedValue({
      fileName: "template.pdf",
      objectKey:
        "confirmation-template-preview-cache/template-1/1782864000000/preview.pdf",
    });
    documentConversion.convertOfficeBufferToPdf.mockResolvedValue(validPdf);
    transaction.confirmationTemplateLibraryFile.create.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      name: "Bank confirmation",
      uploader: { id: "admin-1", name: "Admin" },
    });
    transaction.confirmationTemplateLibraryFile.delete.mockResolvedValue({
      id: "template-1",
    });
    transaction.confirmationTemplateLibraryFile.update.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      designSchema: null,
      designStatus: "DRAFT",
      enabledAt: null,
    });
    auditLogs.log.mockResolvedValue(undefined as never);
    auditLogs.logInTransaction.mockResolvedValue(undefined as never);
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      fileName: "template.docx",
      objectKey: "confirmation-template-library/template.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      uploadedById: "admin-1",
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    prisma.confirmationTemplateLibraryBuiltInOverride.findMany.mockResolvedValue(
      []
    );
    prisma.confirmationTemplateLibraryBuiltInOverride.findUnique.mockResolvedValue(
      null
    );
  });

  it("returns uploader identity as the last template updater", async () => {
    prisma.confirmationTemplateLibraryFile.findMany.mockResolvedValueOnce([]);

    await createService().list();

    expect(
      prisma.confirmationTemplateLibraryFile.findMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          uploader: {
            select: { id: true, name: true },
          },
        },
      })
    );
  });

  it("lists the four registered system templates even when the database is empty", async () => {
    prisma.confirmationTemplateLibraryFile.findMany.mockResolvedValueOnce([]);

    const result = await createService().list();

    expect(result).toHaveLength(4);
    const builtIns = result.filter((template) => template.isBuiltIn);
    expect(builtIns).toHaveLength(4);
    for (const template of builtIns) {
      expect(template.designStatus).toBe("ENABLED");
      expect(template.enabledAt).toStrictEqual(template.updatedAt);
    }
    const type1Design = builtIns.find(
      (template) => template.code === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1"
    )?.designSchema as { fields: unknown[] } | null;
    expect(type1Design?.fields).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          binding: "recipientName",
          id: "confirmation-securities-recipient-name",
          placeholder: "Recipient Name",
        }),
      ])
    );
    expect(result.map((template) => template.code)).toStrictEqual(
      expect.arrayContaining([
        "STANDARD_FINANCIAL_INSTITUTION",
        "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
        "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
      ])
    );
  });

  it("merges a persisted built-in override into the listed template", async () => {
    const designSchema = validDesignSchema();
    const updatedAt = new Date("2026-08-15T12:00:00.000Z");
    prisma.confirmationTemplateLibraryBuiltInOverride.findMany.mockResolvedValue(
      [
        {
          templateCode: "STANDARD_FINANCIAL_INSTITUTION",
          designSchema,
          designStatus: "DRAFT",
          enabledAt: null,
          updatedAt,
        },
      ]
    );

    const result = await createService().list();
    const builtIn = result.find(
      (template) => template.code === "STANDARD_FINANCIAL_INSTITUTION"
    );

    expect(builtIn).toStrictEqual(
      expect.objectContaining({
        designSchema,
        designStatus: "DRAFT",
        enabledAt: null,
        updatedAt,
        isBuiltIn: true,
      })
    );
  });

  it("serves a registered system template through preview without object storage", async () => {
    prisma.confirmationTemplateLibraryFile.findMany.mockResolvedValueOnce([]);
    const service = createService();
    const templates = await service.list();
    const builtIn = templates.find(
      (template) => template.code === "STANDARD_FINANCIAL_INSTITUTION"
    );
    const result = await service.preview(assertPresentValue(builtIn).id);

    expect(result.template).toStrictEqual(
      expect.objectContaining({
        code: "STANDARD_FINANCIAL_INSTITUTION",
        isBuiltIn: true,
      })
    );
    expect(result.body.length).toBeGreaterThan(0);
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
  });

  it("downloads a registered Word system template as its original file", async () => {
    prisma.confirmationTemplateLibraryFile.findMany.mockResolvedValueOnce([]);
    const service = createService();
    const templates = await service.list();
    const builtIn = templates.find(
      (template) => template.code === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1"
    );
    const result = await service.download(
      assertPresentValue(builtIn).id,
      manager,
      source
    );

    expect(result.file).toStrictEqual(
      expect.objectContaining({
        fileName: "securities-confirmation-english-type-1.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        body: expect.any(Buffer),
      })
    );
    expect(documentConversion.convertOfficeBufferToPdf).not.toHaveBeenCalled();
  });

  it("rejects DOCX uploads in the PDF-only template library", async () => {
    const service = createService();
    await expect(
      service.upload(
        { name: "Bank confirmation", confirmationType: "BANK" },
        uploadedFile({
          buffer: validDocx,
          originalname: "template.docx",
          mimetype:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
        superAdmin,
        source
      )
    ).rejects.toMatchObject({
      response: {
        code: "VALIDATION_FAILED",
        message: "Only PDF confirmation templates are supported",
      },
    });
    expect(storage.putConfirmationTemplateLibraryFile).not.toHaveBeenCalled();
  });

  it("stores a verified PDF with canonical metadata and transactional audit", async () => {
    const service = createService();
    const result = await service.upload(
      {
        name: " PDF bank confirmation ",
        confirmationType: "BANK",
      },
      uploadedFile({
        buffer: validPdf,
        mimetype: "application/pdf",
        originalname: "template.pdf",
      }),
      superAdmin,
      source
    );

    expect(storage.putConfirmationTemplateLibraryFile).toHaveBeenCalledWith(
      "template.pdf",
      validPdf,
      "application/pdf"
    );
    expect(
      transaction.confirmationTemplateLibraryFile.create
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileName: "template.pdf",
          fileSize: validPdf.length,
          mimeType: "application/pdf",
          name: "PDF bank confirmation",
        }),
      })
    );
    expect(result).toStrictEqual(expect.objectContaining({ id: "template-1" }));
  });

  it("preserves prompt text style when saving a design", async () => {
    const designSchema = validDesignSchema();
    Object.assign(designSchema.fields[0], {
      textAlign: "center",
      textStyle: {
        backgroundColor: "#FFF59D",
        bold: true,
        fontFamily: "Arial",
        fontSize: 14,
        italic: true,
        textColor: "#123456",
        underline: true,
      },
    });
    transaction.confirmationTemplateLibraryFile.update.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      designSchema,
      designStatus: "DRAFT",
      enabledAt: null,
      uploader: { id: "admin-1", name: "Admin" },
    });

    await saveDesign(
      createService(),
      "template-1",
      { designSchema, designStatus: "DRAFT" },
      superAdmin
    );

    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          designSchema: expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                textAlign: "center",
                textStyle: {
                  backgroundColor: "#FFF59D",
                  bold: true,
                  fontFamily: "Arial",
                  fontSize: 14,
                  italic: true,
                  textColor: "#123456",
                  underline: true,
                },
              }),
            ]),
          }),
        }),
      })
    );
  });

  it("preserves checkbox-specific behavior when saving a design", async () => {
    const designSchema = validDesignSchema();
    Object.assign(designSchema.fields[0], {
      defaultChecked: true,
      kind: "CHECKBOX",
      options: [],
      required: true,
    });
    transaction.confirmationTemplateLibraryFile.update.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      designSchema,
      designStatus: "DRAFT",
      enabledAt: null,
      uploader: { id: "admin-1", name: "Admin" },
    });

    await saveDesign(
      createService(),
      "template-1",
      { designSchema, designStatus: "DRAFT" },
      superAdmin
    );

    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          designSchema: expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                defaultChecked: true,
                kind: "CHECKBOX",
                required: true,
              }),
            ]),
          }),
        }),
      })
    );
  });

  it("accepts the expanded 32 point prompt text style", async () => {
    const designSchema = validDesignSchema();
    Object.assign(designSchema.fields[0], {
      textStyle: {
        bold: false,
        fontFamily: "Microsoft YaHei",
        fontSize: 32,
        italic: false,
        underline: false,
      },
    });
    transaction.confirmationTemplateLibraryFile.update.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      designSchema,
      designStatus: "DRAFT",
      enabledAt: null,
      uploader: { id: "admin-1", name: "Admin" },
    });
    transaction.confirmationTemplateLibraryFile.findMany.mockResolvedValue([]);

    await expect(
      saveDesign(
        createService(),
        "template-1",
        { designSchema, designStatus: "DRAFT" },
        superAdmin
      )
    ).resolves.toStrictEqual(expect.objectContaining({ id: "template-1" }));
  });

  it.each([["Super Admin", superAdmin, "someone-else"]] as const)(
    "allows %s to save a valid design for a custom template",
    async (_actor, user, uploadedById) => {
      const designSchema = validDesignSchema();
      prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
        id: "template-1",
        code: "CTPL-123456789ABC",
        uploadedById,
        fileName: "template.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      transaction.confirmationTemplateLibraryFile.update.mockResolvedValue({
        id: "template-1",
        designSchema,
        designStatus: "ENABLED",
        enabledAt: new Date(),
        uploader: { id: uploadedById, name: "Template uploader" },
      });

      await expect(
        saveDesign(
          createService(),
          "template-1",
          { designSchema, designStatus: "ENABLED" },
          user
        )
      ).resolves.toStrictEqual(
        expect.objectContaining({
          id: "template-1",
          designStatus: "ENABLED",
          uploader: { id: uploadedById, name: "Template uploader" },
        })
      );
      expect(
        transaction.confirmationTemplateLibraryFile.update
      ).toHaveBeenCalledWith({
        where: { id: "template-1" },
        data: {
          designSchema,
          designStatus: "ENABLED",
          enabledAt: expect.any(Date),
        },
        include: {
          uploader: {
            select: { id: true, name: true },
          },
        },
      });
      expect(auditLogs.logInTransaction).toHaveBeenCalledWith(
        transaction,
        expect.objectContaining({
          action: "CONFIRMATION_TEMPLATE_LIBRARY_DESIGN_SAVED",
          targetId: "template-1",
        })
      );
    }
  );

  it("preserves custom field layout when saving as enabled", async () => {
    const designSchema = {
      version: 1 as const,
      fields: [
        {
          id: "recipient",
          kind: "TEXT" as const,
          name: "Recipient",
          placeholder: "Enter recipient",
          options: [],
          page: 1,
          x: 0.1,
          y: 0.2,
          width: 0.12,
          height: 0.03,
        },
        {
          id: "date",
          kind: "TEXT" as const,
          name: "Date",
          placeholder: "Date",
          options: [],
          page: 1,
          x: 0.5,
          y: 0.225,
          width: 0.24,
          height: 0.03,
        },
      ],
    };
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      uploadedById: "manager-1",
      designSchema: null,
      fileName: "template.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    transaction.confirmationTemplateLibraryFile.update.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      designSchema,
      designStatus: "ENABLED",
      enabledAt: new Date(),
      uploader: { id: "manager-1", name: "Manager" },
    });

    await saveDesign(
      createService(),
      "template-1",
      { designSchema, designStatus: "ENABLED" },
      superAdmin
    );

    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          designSchema,
        }),
      })
    );
  });

  it("clears enabledAt when a custom design is saved as a draft", async () => {
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      uploadedById: "manager-1",
    });
    const designSchema = validDesignSchema();

    await saveDesign(
      createService(),
      "template-1",
      { designSchema, designStatus: "DRAFT" },
      superAdmin
    );

    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledWith({
      where: { id: "template-1" },
      data: {
        designSchema,
        designStatus: "DRAFT",
        enabledAt: null,
      },
      include: {
        uploader: {
          select: { id: true, name: true },
        },
      },
    });
  });

  it("accepts referenceCode binding for a TEXT field", async () => {
    const designSchema = {
      ...validDesignSchema(),
      fields: [
        {
          ...validDesignSchema().fields[0],
          binding: "referenceCode",
        },
      ],
    };

    await expect(
      saveDesign(
        createService(),
        "template-1",
        { designSchema, designStatus: "DRAFT" },
        superAdmin
      )
    ).resolves.toBeDefined();
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ designSchema }),
      })
    );
  });

  it("accepts a default fill source for a MULTILINE field", async () => {
    const designSchema = {
      ...validDesignSchema(),
      fields: [
        {
          ...validDesignSchema().fields[0],
          defaultValueSource: {
            binding: "auditorAddress",
            source: "BASE_INFORMATION",
          },
          kind: "MULTILINE",
        },
      ],
    };

    await expect(
      saveDesign(
        createService(),
        "template-1",
        { designSchema, designStatus: "DRAFT" },
        superAdmin
      )
    ).resolves.toBeDefined();
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          designSchema: expect.objectContaining({
            fields: [
              expect.objectContaining({
                baseInformationBinding: "auditorAddress",
                kind: "MULTILINE",
              }),
            ],
          }),
        }),
      })
    );
  });

  it("accepts the current date default fill for a DATE field", async () => {
    const designSchema = {
      ...validDesignSchema(),
      fields: [
        {
          ...validDesignSchema().fields[0],
          defaultValueSource: {
            source: "SYSTEM",
            value: "CURRENT_DATE",
          },
          kind: "DATE",
        },
      ],
    };

    await expect(
      saveDesign(
        createService(),
        "template-1",
        { designSchema, designStatus: "DRAFT" },
        superAdmin
      )
    ).resolves.toBeDefined();
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          designSchema: expect.objectContaining({
            fields: [
              expect.objectContaining({
                defaultValueSource: {
                  source: "SYSTEM",
                  value: "CURRENT_DATE",
                },
                kind: "DATE",
              }),
            ],
          }),
        }),
      })
    );
  });

  it("accepts a formatted STATIC_TEXT field", async () => {
    const designSchema = {
      ...validDesignSchema(),
      fields: [
        {
          ...validDesignSchema().fields[0],
          kind: "STATIC_TEXT",
          name: "Instructions",
          placeholder: "Please return this confirmation directly.",
        },
      ],
    };

    await expect(
      saveDesign(
        createService(),
        "template-1",
        { designSchema, designStatus: "DRAFT" },
        superAdmin
      )
    ).resolves.toBeDefined();
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          designSchema: expect.objectContaining({
            fields: [
              expect.objectContaining({
                kind: "STATIC_TEXT",
                placeholder: "Please return this confirmation directly.",
              }),
            ],
          }),
        }),
      })
    );
  });

  it("accepts a fail-closed source anchor for a TEXT field", async () => {
    const sourceRange = validSourceRange();
    const designSchema = {
      ...validDesignSchema(),
      fields: [
        {
          ...validDesignSchema().fields[0],
          sourceRanges: [sourceRange],
        },
      ],
    };

    await expect(
      saveDesign(
        createService(),
        "template-1",
        { designSchema, designStatus: "DRAFT" },
        superAdmin
      )
    ).resolves.toBeDefined();
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ designSchema }),
      })
    );
  });

  it.each([
    ["SELECT", validDesignSchema().fields[1]],
    ["MASK", validDesignSchema().fields[2]],
  ] as const)("rejects binding on a %s field", async (_kind, field) => {
    const designSchema = {
      ...validDesignSchema(),
      fields: [{ ...field, binding: "referenceCode" }],
    };

    await expect(
      saveDesign(
        createService(),
        "template-1",
        { designSchema, designStatus: "DRAFT" },
        superAdmin
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).not.toHaveBeenCalled();
  });

  it("rejects an unknown TEXT field binding", async () => {
    const designSchema = {
      ...validDesignSchema(),
      fields: [
        {
          ...validDesignSchema().fields[0],
          binding: "unknownField",
        },
      ],
    };

    await expect(
      saveDesign(
        createService(),
        "template-1",
        { designSchema, designStatus: "DRAFT" },
        superAdmin
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).not.toHaveBeenCalled();
  });

  it.each([
    ["baseInformationBinding", { baseInformationBinding: "recipientName" }],
    ["informationLibraryBinding", { informationLibraryBinding: "clientName" }],
  ] as const)("rejects a cross-source %s", async (_name, binding) => {
    const designSchema = {
      ...validDesignSchema(),
      fields: [{ ...validDesignSchema().fields[0], ...binding }],
    };

    await expect(
      saveDesign(
        createService(),
        "template-1",
        { designSchema, designStatus: "DRAFT" },
        superAdmin
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).not.toHaveBeenCalled();
  });

  it("rejects an empty prompt on a TEXT or SELECT field", async () => {
    const designSchema = {
      ...validDesignSchema(),
      fields: [
        {
          ...validDesignSchema().fields[0],
          placeholder: "   ",
        },
      ],
    };

    await expect(
      saveDesign(
        createService(),
        "template-1",
        { designSchema, designStatus: "DRAFT" },
        superAdmin
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a legacy paragraphText anchor",
      {
        end: 15,
        paragraphText: "Reference: ____",
        sourceText: "____",
        start: 11,
      },
    ],
    [
      "a legacy paragraphIndex anchor",
      { end: 15, paragraphIndex: 4, sourceText: "____", start: 11 },
    ],
    ["an extra source anchor property", validSourceRange({ extra: true })],
    [
      "an unsupported source part",
      validSourceRange({ part: "word/header1.xml" }),
    ],
    [
      "an invalid paragraph hash",
      validSourceRange({ paragraphXmlSha256: "invalid" }),
    ],
    [
      "a negative paragraph ordinal",
      validSourceRange({ paragraphOrdinal: -1 }),
    ],
    ["an empty paragraph id", validSourceRange({ paragraphId: "" })],
    ["an empty source range", validSourceRange({ end: 11 })],
    ["a source range length mismatch", validSourceRange({ end: 14 })],
  ] as const)("rejects a design with %s", async (_reason, sourceRange) => {
    const designSchema = {
      ...validDesignSchema(),
      fields: [
        {
          ...validDesignSchema().fields[0],
          sourceRanges: [sourceRange],
        },
      ],
    };

    await expect(
      saveDesign(
        createService(),
        "template-1",
        { designSchema, designStatus: "DRAFT" },
        superAdmin
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).not.toHaveBeenCalled();
  });

  it.each([
    ["version other than 1", { version: 2, fields: [] }],
    ["non-array fields", { version: 1, fields: {} }],
    [
      "more than 100 fields",
      {
        version: 1,
        fields: Array.from({ length: 101 }, (_, index) => ({
          ...validDesignSchema().fields[0],
          id: `field-${index}`,
        })),
      },
    ],
    [
      "duplicate field ids",
      {
        ...validDesignSchema(),
        fields: [
          validDesignSchema().fields[0],
          { ...validDesignSchema().fields[1], id: "client-name" },
        ],
      },
    ],
    [
      "empty field id",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[0], id: " " }],
      },
    ],
    [
      "unsupported field kind",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[0], kind: "RADIO" }],
      },
    ],
    [
      "page below one",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[0], page: 0 }],
      },
    ],
    [
      "coordinate outside 0 to 1",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[0], x: 1.1 }],
      },
    ],
    [
      "horizontal bounds overflow",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[0], x: 0.8, width: 0.3 }],
      },
    ],
    [
      "vertical bounds overflow",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[0], y: 0.8, height: 0.3 }],
      },
    ],
    [
      "empty text name",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[0], name: " " }],
      },
    ],
    [
      "empty select name",
      {
        ...validDesignSchema(),
        fields: [
          {
            ...validDesignSchema().fields[1],
            name: "",
          },
        ],
      },
    ],
    [
      "empty select options",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[1], options: [] }],
      },
    ],
    [
      "blank select option",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[1], options: [" "] }],
      },
    ],
    [
      "duplicate select options",
      {
        ...validDesignSchema(),
        fields: [
          { ...validDesignSchema().fields[1], options: ["Bank", "Bank"] },
        ],
      },
    ],
    ["an extra root property", { ...validDesignSchema(), extra: true }],
    [
      "an extra field property",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[0], extra: true }],
      },
    ],
    [
      "a missing required field property",
      {
        ...validDesignSchema(),
        fields: [
          Object.fromEntries(
            Object.entries(validDesignSchema().fields[0]).filter(
              ([key]) => key !== "placeholder"
            )
          ),
        ],
      },
    ],
    [
      "an id longer than 100 characters",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[0], id: "x".repeat(101) }],
      },
    ],
    [
      "a name longer than 200 characters",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[0], name: "x".repeat(201) }],
      },
    ],
    [
      "a page greater than 500",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[0], page: 501 }],
      },
    ],
    [
      "zero width",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[0], width: 0 }],
      },
    ],
    [
      "zero height",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[0], height: 0 }],
      },
    ],
    [
      "a placeholder longer than 300 characters",
      {
        ...validDesignSchema(),
        fields: [
          { ...validDesignSchema().fields[0], placeholder: "x".repeat(301) },
        ],
      },
    ],
    [
      "more than 100 SELECT options",
      {
        ...validDesignSchema(),
        fields: [
          {
            ...validDesignSchema().fields[1],
            options: Array.from(
              { length: 101 },
              (_, index) => `option-${index}`
            ),
          },
        ],
      },
    ],
    [
      "a SELECT option longer than 200 characters",
      {
        ...validDesignSchema(),
        fields: [
          { ...validDesignSchema().fields[1], options: ["x".repeat(201)] },
        ],
      },
    ],
    [
      "TEXT options",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[0], options: ["invalid"] }],
      },
    ],
    [
      "MASK options",
      {
        ...validDesignSchema(),
        fields: [{ ...validDesignSchema().fields[2], options: ["invalid"] }],
      },
    ],
  ] as const)("rejects a design with %s", async (_reason, designSchema) => {
    await expect(
      saveDesign(
        createService(),
        "template-1",
        { designSchema, designStatus: "ENABLED" },
        superAdmin
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).not.toHaveBeenCalled();
  });

  it("normalizes the manifest exactly as the HTTP contract does", async () => {
    const designSchema = {
      version: 1,
      fields: [
        {
          ...validDesignSchema().fields[1],
          id: " field-1 ",
          name: " Salutation ",
          placeholder: " Choose one ",
          options: [" Sir ", " Madam "],
        },
      ],
    };
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      uploadedById: "manager-1",
    });

    await saveDesign(
      createService(),
      "template-1",
      { designSchema, designStatus: "DRAFT" },
      superAdmin
    );

    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          designSchema: {
            version: 1,
            fields: [
              expect.objectContaining({
                id: "field-1",
                name: "Salutation",
                placeholder: "Choose one",
                options: ["Sir", "Madam"],
              }),
            ],
          },
        }),
      })
    );
  });

  it.each([
    ["Partner", partner],
    ["Manager", manager],
  ] as const)("rejects a custom design update from %s", async (_role, user) => {
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      uploadedById: "manager-1",
    });

    await expect(
      saveDesign(
        createService(),
        "template-1",
        { designSchema: validDesignSchema(), designStatus: "DRAFT" },
        user
      )
    ).rejects.toBeInstanceOf(ApiForbiddenException);
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).not.toHaveBeenCalled();
  });

  it("allows Super Admin to save a design for a built-in template", async () => {
    const designSchema = validDesignSchema();
    transaction.confirmationTemplateLibraryBuiltInOverride.upsert.mockResolvedValue(
      {
        templateCode: "STANDARD_FINANCIAL_INSTITUTION",
        designSchema,
        designStatus: "ENABLED",
        enabledAt: new Date("2026-08-15T12:00:00.000Z"),
        updatedAt: new Date("2026-08-15T12:00:00.000Z"),
      }
    );

    await expect(
      saveDesign(
        createService(),
        "builtin-STANDARD_FINANCIAL_INSTITUTION",
        { designSchema, designStatus: "ENABLED" },
        superAdmin
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        designSchema,
        designStatus: "ENABLED",
        isBuiltIn: true,
      })
    );
    expect(
      prisma.confirmationTemplateLibraryFile.findUnique
    ).not.toHaveBeenCalled();
    expect(
      transaction.confirmationTemplateLibraryBuiltInOverride.upsert
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { templateCode: "STANDARD_FINANCIAL_INSTITUTION" },
        update: expect.objectContaining({
          designSchema,
          designStatus: "ENABLED",
        }),
      })
    );
  });

  it.each([
    ["Partner", partner],
    ["Manager", manager],
    ["Staff", staff],
  ] as const)(
    "keeps built-in template design unavailable to %s",
    async (_role, user) => {
      await expect(
        saveDesign(
          createService(),
          "builtin-STANDARD_FINANCIAL_INSTITUTION",
          { designSchema: validDesignSchema(), designStatus: "ENABLED" },
          user
        )
      ).rejects.toBeInstanceOf(ApiForbiddenException);
    }
  );

  it("persists a built-in design through its override for Super Admin", async () => {
    const designSchema = validDesignSchema();
    const updatedAt = new Date("2026-08-15T12:00:00.000Z");
    transaction.confirmationTemplateLibraryBuiltInOverride.upsert.mockResolvedValue(
      {
        templateCode: "STANDARD_FINANCIAL_INSTITUTION",
        designSchema,
        designStatus: "DRAFT",
        enabledAt: null,
        updatedAt,
      }
    );

    await expect(
      saveDesign(
        createService(),
        "builtin-STANDARD_FINANCIAL_INSTITUTION",
        { designSchema, designStatus: "DRAFT" },
        superAdmin
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        id: "builtin-STANDARD_FINANCIAL_INSTITUTION",
        designSchema,
        designStatus: "DRAFT",
        enabledAt: null,
        isBuiltIn: true,
      })
    );
    expect(
      transaction.confirmationTemplateLibraryBuiltInOverride.upsert
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          templateCode: "STANDARD_FINANCIAL_INSTITUTION",
        },
        create: expect.objectContaining({
          templateCode: "STANDARD_FINANCIAL_INSTITUTION",
          designSchema,
          designStatus: "DRAFT",
          enabledAt: null,
        }),
        update: expect.objectContaining({
          designSchema,
          designStatus: "DRAFT",
          enabledAt: null,
        }),
      })
    );
    expect(auditLogs.logInTransaction).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        action: "CONFIRMATION_TEMPLATE_LIBRARY_DESIGN_SAVED",
        targetId: "builtin-STANDARD_FINANCIAL_INSTITUTION",
      })
    );
  });

  it("lets Super Admin disable a built-in template without deleting its overlay", async () => {
    const designSchema = validDesignSchema();
    transaction.confirmationTemplateLibraryBuiltInOverride.upsert.mockResolvedValue(
      {
        templateCode: "STANDARD_FINANCIAL_INSTITUTION",
        designSchema,
        designStatus: "DISABLED",
        enabledAt: null,
        updatedAt: new Date("2026-08-15T12:00:00.000Z"),
      }
    );

    await expect(
      setStatus(
        createService(),
        "builtin-STANDARD_FINANCIAL_INSTITUTION",
        "DISABLED",
        superAdmin
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        designSchema,
        designStatus: "DISABLED",
        enabledAt: null,
        isBuiltIn: true,
      })
    );
    expect(
      transaction.confirmationTemplateLibraryBuiltInOverride.upsert
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          templateCode: "STANDARD_FINANCIAL_INSTITUTION",
        },
        update: {
          designStatus: "DISABLED",
          enabledAt: null,
        },
        create: expect.objectContaining({
          designStatus: "DISABLED",
          enabledAt: null,
        }),
      })
    );
  });

  it("allows a built-in default template to be enabled without an overlay", async () => {
    transaction.confirmationTemplateLibraryBuiltInOverride.upsert.mockResolvedValue(
      {
        templateCode: "STANDARD_FINANCIAL_INSTITUTION",
        designSchema: null,
        designStatus: "ENABLED",
        enabledAt: new Date("2026-08-15T12:00:00.000Z"),
        updatedAt: new Date("2026-08-15T12:00:00.000Z"),
      }
    );

    await expect(
      setStatus(
        createService(),
        "builtin-STANDARD_FINANCIAL_INSTITUTION",
        "ENABLED",
        superAdmin
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        designSchema: expect.objectContaining({ version: 1 }),
        designStatus: "ENABLED",
        isBuiltIn: true,
      })
    );
  });

  it("restores a disabled built-in default template without requiring an overlay", async () => {
    const disabledOverride = {
      templateCode: "STANDARD_FINANCIAL_INSTITUTION",
      designSchema: null,
      designStatus: "DISABLED",
      enabledAt: null,
      updatedAt: new Date("2026-08-15T12:00:00.000Z"),
    };
    prisma.confirmationTemplateLibraryBuiltInOverride.findUnique
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValue(disabledOverride);
    transaction.confirmationTemplateLibraryBuiltInOverride.upsert
      .mockReset()
      .mockImplementation(
        async (input: {
          create: { designStatus: string; enabledAt: Date | null };
        }) => {
          await Promise.resolve();
          return {
            ...disabledOverride,
            designStatus: input.create.designStatus,
            enabledAt: input.create.enabledAt,
          };
        }
      );
    const service = createService();

    await expect(
      setStatus(
        service,
        "builtin-STANDARD_FINANCIAL_INSTITUTION",
        "DISABLED",
        superAdmin
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        designSchema: expect.objectContaining({ version: 1 }),
        designStatus: "DISABLED",
      })
    );
    await expect(
      setStatus(
        service,
        "builtin-STANDARD_FINANCIAL_INSTITUTION",
        "ENABLED",
        superAdmin
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        designSchema: expect.objectContaining({ version: 1 }),
        designStatus: "ENABLED",
      })
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(
      transaction.confirmationTemplateLibraryBuiltInOverride.upsert
    ).toHaveBeenCalledTimes(2);
  });

  it("enables a newly uploaded custom DOCX with an empty design", async () => {
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      uploadedById: "manager-1",
      designSchema: null,
      fileName: "template.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    transaction.confirmationTemplateLibraryFile.update.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      designSchema: { version: 1, fields: [] },
      designStatus: "ENABLED",
      enabledAt: new Date("2026-08-15T12:00:00.000Z"),
    });

    await expect(
      setStatus(createService(), "template-1", "ENABLED", superAdmin)
    ).resolves.toStrictEqual(
      expect.objectContaining({
        designSchema: { version: 1, fields: [] },
        designStatus: "ENABLED",
        isBuiltIn: false,
      })
    );
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "template-1" },
        data: {
          designSchema: { version: 1, fields: [] },
          designStatus: "ENABLED",
          enabledAt: expect.any(Date),
        },
      })
    );
  });

  it("preserves an existing custom design when enabled from the library", async () => {
    const designSchema = {
      version: 1,
      fields: [
        {
          id: "recipient",
          kind: "TEXT",
          name: "Recipient",
          placeholder: "Enter recipient",
          options: [],
          page: 1,
          x: 0.1,
          y: 0.2,
          width: 0.12,
          height: 0.03,
        },
        {
          id: "date",
          kind: "TEXT",
          name: "Date",
          placeholder: "Date",
          options: [],
          page: 1,
          x: 0.5,
          y: 0.225,
          width: 0.24,
          height: 0.03,
        },
      ],
    };
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      uploadedById: "manager-1",
      designSchema,
      fileName: "template.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    transaction.confirmationTemplateLibraryFile.update.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      designSchema,
      designStatus: "ENABLED",
      enabledAt: new Date(),
    });

    await setStatus(createService(), "template-1", "ENABLED", superAdmin);

    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          designSchema,
        }),
      })
    );
  });

  it("bulk enables a newly uploaded custom DOCX with an empty design", async () => {
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      uploadedById: "manager-1",
      designSchema: null,
      fileName: "template.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    transaction.confirmationTemplateLibraryFile.update.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      designSchema: { version: 1, fields: [] },
      designStatus: "ENABLED",
      enabledAt: new Date("2026-08-15T12:00:00.000Z"),
    });

    await expect(
      bulkSetStatus(createService(), ["template-1"], "ENABLED", superAdmin)
    ).resolves.toStrictEqual([
      expect.objectContaining({
        designSchema: { version: 1, fields: [] },
        designStatus: "ENABLED",
        isBuiltIn: false,
      }),
    ]);
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "template-1" },
        data: {
          designSchema: { version: 1, fields: [] },
          designStatus: "ENABLED",
          enabledAt: expect.any(Date),
        },
      })
    );
  });

  it("rejects enabling a custom template with a legacy DOC source", async () => {
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      uploadedById: "manager-1",
      designSchema: validDesignSchema(),
      mimeType: "application/msword",
      fileName: "legacy.doc",
    });

    await expect(
      setStatus(createService(), "template-1", "ENABLED", superAdmin)
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).not.toHaveBeenCalled();
  });

  it("lets Super Admin update a custom template status", async () => {
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      uploadedById: "manager-1",
    });
    transaction.confirmationTemplateLibraryFile.update.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      designSchema: validDesignSchema(),
      designStatus: "DISABLED",
      enabledAt: null,
    });

    await expect(
      setStatus(createService(), "template-1", "DISABLED", superAdmin)
    ).resolves.toStrictEqual(
      expect.objectContaining({
        id: "template-1",
        designStatus: "DISABLED",
      })
    );
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "template-1" },
        data: { designStatus: "DISABLED", enabledAt: null },
      })
    );
  });

  it("validates every id and permission before bulk status writes", async () => {
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      uploadedById: "manager-1",
    });

    await expect(
      bulkSetStatus(
        createService(),
        ["builtin-STANDARD_FINANCIAL_INSTITUTION", "template-1"],
        "DISABLED",
        manager
      )
    ).rejects.toBeInstanceOf(ApiForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(
      transaction.confirmationTemplateLibraryBuiltInOverride.upsert
    ).not.toHaveBeenCalled();
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).not.toHaveBeenCalled();
  });

  it("rejects a bulk enable when unknown custom template is not a valid DOCX", async () => {
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      uploadedById: "manager-1",
      designSchema: validDesignSchema(),
      fileName: "legacy.doc",
      mimeType: "application/msword",
    });

    await expect(
      bulkSetStatus(
        createService(),
        ["builtin-STANDARD_FINANCIAL_INSTITUTION", "template-1"],
        "ENABLED",
        superAdmin
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(
      transaction.confirmationTemplateLibraryBuiltInOverride.upsert
    ).not.toHaveBeenCalled();
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).not.toHaveBeenCalled();
  });

  it("bulk restores a disabled built-in default template without requiring an overlay", async () => {
    const designSchema = validDesignSchema();
    const disabledOverride = {
      templateCode: "STANDARD_FINANCIAL_INSTITUTION",
      designSchema: null,
      designStatus: "DISABLED",
      enabledAt: null,
      updatedAt: new Date("2026-08-15T12:00:00.000Z"),
    };
    prisma.confirmationTemplateLibraryBuiltInOverride.findUnique
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValue(disabledOverride);
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      uploadedById: "manager-1",
      designSchema,
      fileName: "template.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    transaction.confirmationTemplateLibraryBuiltInOverride.upsert
      .mockReset()
      .mockImplementation(
        async (input: {
          create: { designStatus: string; enabledAt: Date | null };
        }) => {
          await Promise.resolve();
          return {
            ...disabledOverride,
            designStatus: input.create.designStatus,
            enabledAt: input.create.enabledAt,
          };
        }
      );
    transaction.confirmationTemplateLibraryFile.update
      .mockReset()
      .mockImplementation(
        async (input: {
          data: { designStatus: string; enabledAt: Date | null };
        }) => {
          await Promise.resolve();
          return {
            id: "template-1",
            code: "CTPL-123456789ABC",
            designSchema,
            designStatus: input.data.designStatus,
            enabledAt: input.data.enabledAt,
          };
        }
      );
    const service = createService();

    await expect(
      bulkSetStatus(
        service,
        ["builtin-STANDARD_FINANCIAL_INSTITUTION", "template-1"],
        "DISABLED",
        superAdmin
      )
    ).resolves.toStrictEqual([
      expect.objectContaining({
        designSchema: expect.objectContaining({ version: 1 }),
        designStatus: "DISABLED",
      }),
      expect.objectContaining({
        designSchema,
        designStatus: "DISABLED",
      }),
    ]);
    await expect(
      bulkSetStatus(
        service,
        ["builtin-STANDARD_FINANCIAL_INSTITUTION", "template-1"],
        "ENABLED",
        superAdmin
      )
    ).resolves.toStrictEqual([
      expect.objectContaining({
        designSchema: expect.objectContaining({ version: 1 }),
        designStatus: "ENABLED",
      }),
      expect.objectContaining({
        designSchema,
        designStatus: "ENABLED",
      }),
    ]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(
      transaction.confirmationTemplateLibraryBuiltInOverride.upsert
    ).toHaveBeenCalledTimes(2);
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledTimes(2);
  });

  it("bulk updates built-in and custom statuses atomically with audit entries", async () => {
    const designSchema = validDesignSchema();
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      uploadedById: "manager-1",
      designSchema,
      fileName: "template.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    transaction.confirmationTemplateLibraryBuiltInOverride.upsert.mockResolvedValue(
      {
        templateCode: "STANDARD_FINANCIAL_INSTITUTION",
        designSchema,
        designStatus: "ENABLED",
        enabledAt: new Date("2026-08-15T12:00:00.000Z"),
        updatedAt: new Date("2026-08-15T12:00:00.000Z"),
      }
    );
    transaction.confirmationTemplateLibraryFile.update.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      designSchema,
      designStatus: "ENABLED",
      enabledAt: new Date("2026-08-15T12:00:00.000Z"),
    });

    await expect(
      bulkSetStatus(
        createService(),
        ["builtin-STANDARD_FINANCIAL_INSTITUTION", "template-1"],
        "ENABLED",
        superAdmin
      )
    ).resolves.toHaveLength(2);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(
      transaction.confirmationTemplateLibraryBuiltInOverride.upsert
    ).toHaveBeenCalledOnce();
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledOnce();
    expect(auditLogs.logInTransaction).toHaveBeenCalledTimes(2);
  });

  it("rejects new legacy DOC uploads with the DOCX-only validation message", async () => {
    const legacyDoc = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.from("legacy-doc-body"),
    ]);
    const service = createService();

    await expect(
      service.upload(
        { name: "Legacy template", confirmationType: "OTHER" },
        uploadedFile({
          buffer: legacyDoc,
          mimetype: "text/plain",
          originalname: "legacy.doc",
        }),
        superAdmin,
        source
      )
    ).rejects.toMatchObject({
      response: {
        code: "VALIDATION_FAILED",
        message: "Only PDF confirmation templates are supported",
      },
    });

    expect(storage.putConfirmationTemplateLibraryFile).not.toHaveBeenCalled();
  });

  it("keeps existing legacy DOC records available for list, preview, download, and delete", async () => {
    const legacyTemplate = {
      id: "legacy-template",
      code: "CTPL-LEGACYDOC",
      name: "Legacy bank confirmation",
      confirmationType: "BANK",
      description: null,
      fileName: "legacy.doc",
      objectKey: "confirmation-template-library/legacy.doc",
      fileSize: 128,
      mimeType: "application/msword",
      uploadedById: "manager-1",
      uploader: { id: "manager-1", name: "Legacy owner" },
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
      designSchema: null,
      designStatus: "DRAFT",
      enabledAt: null,
    };
    prisma.confirmationTemplateLibraryFile.findMany.mockResolvedValueOnce([
      legacyTemplate,
    ]);
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue(
      legacyTemplate
    );
    const service = createService();

    await expect(service.list()).resolves.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: "legacy.doc",
          isBuiltIn: false,
        }),
      ])
    );
    await expect(service.preview("legacy-template")).resolves.toStrictEqual({
      template: expect.objectContaining({ fileName: "legacy.doc" }),
      body: validPdf,
      fileName: "legacy.pdf",
      mimeType: "application/pdf",
    });
    await expect(
      service.download("legacy-template", manager, source)
    ).resolves.toStrictEqual(
      expect.objectContaining({
        template: expect.objectContaining({ fileName: "legacy.doc" }),
        file: expect.objectContaining({
          body: validDocx,
          fileName: "legacy.doc",
          mimeType: "application/msword",
        }),
      })
    );
    await expect(
      service.remove("legacy-template", superAdmin, source)
    ).resolves.toStrictEqual({ id: "legacy-template" });
    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "confirmation-template-library/legacy.doc"
    );
    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "confirmation-template-library/legacy.doc"
    );
    expect(
      transaction.confirmationTemplateLibraryFile.delete
    ).toHaveBeenCalledWith({ where: { id: "legacy-template" } });
  });

  it("rejects files that only use a Word extension", async () => {
    const service = createService();

    await expect(
      service.upload(
        { name: "Fake template", confirmationType: "BANK" },
        uploadedFile({ buffer: Buffer.from("not-a-docx") }),
        superAdmin,
        source
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(storage.putConfirmationTemplateLibraryFile).not.toHaveBeenCalled();
  });

  it("rejects a ZIP that is missing the package relationship", async () => {
    const buffer = await createDocx({ relationships: null });

    await expect(
      createService().upload(
        { name: "Fake template", confirmationType: "BANK" },
        uploadedFile({ buffer }),
        superAdmin,
        source
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(storage.putConfirmationTemplateLibraryFile).not.toHaveBeenCalled();
  });

  it.each([
    ["content types", { contentTypes: "<Types><Override /></Type>" }],
    [
      "relationships",
      { relationships: "<Relationships><Relationship></Relationships>" },
    ],
    ["document", { document: "<w:document><w:body></w:document>" }],
  ] as const)("rejects malformed %s XML", async (_part, overrides) => {
    const buffer = await createDocx(overrides);

    await expect(
      createService().upload(
        { name: "Malformed template", confirmationType: "BANK" },
        uploadedFile({ buffer }),
        superAdmin,
        source
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(storage.putConfirmationTemplateLibraryFile).not.toHaveBeenCalled();
  });

  it.each([
    [
      "the main document content type",
      {
        contentTypes: CONTENT_TYPES_XML.replace(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
          "application/xml"
        ),
      },
    ],
    [
      "the office document relationship",
      {
        relationships: RELATIONSHIPS_XML.replace(
          "officeDocument/2006/relationships/officeDocument",
          "officeDocument/2006/relationships/styles"
        ),
      },
    ],
    [
      "the relationship target",
      {
        relationships: RELATIONSHIPS_XML.replace(
          'Target="word/document.xml"',
          'Target="word/not-document.xml"'
        ),
      },
    ],
    [
      "the WordprocessingML document root",
      { document: DOCUMENT_XML.replace("w:document", "w:styles") },
    ],
  ] as const)("rejects a DOCX with an invalid %s", async (_part, overrides) => {
    const buffer = await createDocx(overrides);

    await expect(
      createService().upload(
        { name: "Fake template", confirmationType: "BANK" },
        uploadedFile({ buffer }),
        superAdmin,
        source
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(storage.putConfirmationTemplateLibraryFile).not.toHaveBeenCalled();
  });

  it("rejects XML entity declarations", async () => {
    const buffer = await createDocx({
      contentTypes: `<?xml version="1.0"?>
<!DOCTYPE Types [<!ENTITY mainType "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml">]>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/word/document.xml" ContentType="&mainType;" />
</Types>`,
    });

    await expect(
      createService().upload(
        { name: "Entity template", confirmationType: "BANK" },
        uploadedFile({ buffer }),
        superAdmin,
        source
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(storage.putConfirmationTemplateLibraryFile).not.toHaveBeenCalled();
  });

  it("rejects a ZIP with an excessive compression ratio", async () => {
    const buffer = await createDocx({
      extraFiles: [
        {
          name: "word/highly-compressed.bin",
          data: Buffer.alloc(2 * 1024 * 1024),
        },
      ],
    });

    await expect(
      createService().upload(
        { name: "Compressed template", confirmationType: "BANK" },
        uploadedFile({ buffer }),
        superAdmin,
        source
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(storage.putConfirmationTemplateLibraryFile).not.toHaveBeenCalled();
  });

  it("rejects a ZIP whose streamed uncompressed content exceeds the total limit", async () => {
    const buffer = await createDocx({
      extraFiles: [
        {
          name: "word/padding.bin",
          data: Buffer.alloc(2 * 1024 * 1024),
          compression: "STORE",
        },
      ],
    });
    const archive = await JSZip.loadAsync(buffer);
    archive.files["word/oversized.bin"] = {
      dir: false,
      nodeStream: () =>
        Readable.from(
          (function* nodeStream() {
            const chunk = Buffer.alloc(1024 * 1024);
            for (let index = 0; index < 101; index += 1) {
              yield chunk;
            }
          })()
        ),
    } as never;
    const loadArchive = vi
      .spyOn(JSZip, "loadAsync")
      .mockResolvedValueOnce(archive);

    await expect(
      createService().upload(
        { name: "Oversized template", confirmationType: "BANK" },
        uploadedFile({ buffer }),
        superAdmin,
        source
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    loadArchive.mockRestore();
    expect(storage.putConfirmationTemplateLibraryFile).not.toHaveBeenCalled();
  });

  it("rejects valid Word bytes with an unsupported extension", async () => {
    const service = createService();

    await expect(
      service.upload(
        { name: "Wrong extension", confirmationType: "BANK" },
        uploadedFile({ buffer: validDocx, originalname: "template.docx" }),
        superAdmin,
        source
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(storage.putConfirmationTemplateLibraryFile).not.toHaveBeenCalled();
  });

  it("rejects empty names and inconsistent upload sizes", async () => {
    const service = createService();

    await expect(
      service.upload(
        { name: "   ", confirmationType: "BANK" },
        uploadedFile(),
        superAdmin,
        source
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    await expect(
      service.upload(
        { name: "Bank confirmation", confirmationType: "BANK" },
        uploadedFile({ size: validDocx.length + 1 }),
        superAdmin,
        source
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(storage.putConfirmationTemplateLibraryFile).not.toHaveBeenCalled();
  });

  it("allows Super Admin to upload a library template", async () => {
    const service = createService();
    await expect(
      service.upload(
        { name: "Bank confirmation", confirmationType: "BANK" },
        uploadedFile(),
        superAdmin,
        source
      )
    ).resolves.toMatchObject({ id: "template-1" });
    expect(storage.putConfirmationTemplateLibraryFile).toHaveBeenCalledOnce();
  });

  it.each([
    ["Partner", partner],
    ["Manager", manager],
  ] as const)(
    "rejects a %s upload before storing the template",
    async (_role, user) => {
      await expect(
        createService().upload(
          { name: "Bank confirmation", confirmationType: "BANK" },
          uploadedFile(),
          user,
          source
        )
      ).rejects.toBeInstanceOf(ApiForbiddenException);
      expect(storage.putConfirmationTemplateLibraryFile).not.toHaveBeenCalled();
    }
  );

  it("assigns a type-year sequence to newly uploaded templates", async () => {
    const year = new Date().getFullYear();
    transaction.confirmationTemplateLibraryFile.findMany.mockResolvedValueOnce([
      { code: `CTPL-BANK-${year}-000005` },
    ]);

    await createService().upload(
      { name: "Bank confirmation", confirmationType: "BANK" },
      uploadedFile(),
      superAdmin,
      source
    );

    expect(
      transaction.confirmationTemplateLibraryFile.create
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: `CTPL-BANK-${year}-000006`,
        }),
      })
    );
  });

  it("enables a PDF custom template with an empty design", async () => {
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-BANK-2026-000001",
      uploadedById: "manager-1",
      designSchema: null,
      fileName: "bank-template.pdf",
      mimeType: "application/pdf",
    });

    await expect(
      setStatus(createService(), "template-1", "ENABLED", superAdmin)
    ).resolves.toStrictEqual(
      expect.objectContaining({ designStatus: "DRAFT" })
    );
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          designStatus: "ENABLED",
          enabledAt: expect.any(Date),
        }),
      })
    );
  });

  it("removes the stored object when the database transaction fails", async () => {
    prisma.$transaction.mockRejectedValueOnce(
      new Error("database unavailable")
    );
    const service = createService();

    await expect(
      service.upload(
        { name: "Bank confirmation", confirmationType: "BANK" },
        uploadedFile(),
        superAdmin,
        source
      )
    ).rejects.toThrow("database unavailable");
    expect(storage.deleteObject).toHaveBeenCalledWith(
      "confirmation-template-library/template.docx"
    );
  });

  it("removes the stored object when the transactional audit fails", async () => {
    auditLogs.logInTransaction.mockRejectedValueOnce(
      new Error("audit unavailable")
    );
    const service = createService();

    await expect(
      service.upload(
        { name: "Bank confirmation", confirmationType: "BANK" },
        uploadedFile(),
        superAdmin,
        source
      )
    ).rejects.toThrow("audit unavailable");
    expect(storage.deleteObject).toHaveBeenCalledWith(
      "confirmation-template-library/template.docx"
    );
  });

  it("returns the original template download and audits the download", async () => {
    const service = createService();
    const result = await service.download(
      "template-1",
      { id: "staff-1", globalRole: "STAFF" } as never,
      source
    );

    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "confirmation-template-library/template.docx"
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONFIRMATION_TEMPLATE_LIBRARY_FILE_DOWNLOADED",
        targetId: "template-1",
      })
    );
    expect(result.file).toStrictEqual({
      body: validDocx,
      fileName: "template.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(documentConversion.convertOfficeBufferToPdf).not.toHaveBeenCalled();
  });

  it("converts DOCX templates to the canonical PDF renderer for inline preview", async () => {
    const service = createService();

    await expect(service.preview("template-1")).resolves.toStrictEqual({
      template: expect.objectContaining({ id: "template-1" }),
      body: validPdf,
      fileName: "template.pdf",
      mimeType: "application/pdf",
    });
    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "confirmation-template-library/template.docx"
    );
    expect(documentConversion.convertOfficeBufferToPdf).toHaveBeenCalledWith({
      body: validDocx,
      fileName: "template.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(auditLogs.log).not.toHaveBeenCalled();
  });

  it("reuses a cached canonical PDF preview for unchanged DOCX templates", async () => {
    storage.getCacheObjectBuffer
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(validPdf);
    const service = createService();

    await expect(service.preview("template-1")).resolves.toMatchObject({
      body: validPdf,
      mimeType: "application/pdf",
    });
    await expect(service.preview("template-1")).resolves.toMatchObject({
      body: validPdf,
      mimeType: "application/pdf",
    });

    expect(storage.getObjectBuffer).toHaveBeenCalledTimes(1);
    expect(documentConversion.convertOfficeBufferToPdf).toHaveBeenCalledTimes(1);
    expect(storage.putCacheObject).toHaveBeenCalledOnce();
    expect(storage.putCacheObject).toHaveBeenCalledWith(
      "confirmation-template-preview-cache/template-1/1782864000000/preview.pdf",
      validPdf,
      "application/pdf"
    );
  });

  it("accepts a custom initial value alongside explicit dual associations", async () => {
    const designSchema = {
      ...validDesignSchema(),
      fields: [
        {
          ...validDesignSchema().fields[0],
          baseInformationBinding: "clientName",
          defaultValueSource: {
            source: "CUSTOM",
            value: "Optional initial value",
          },
          informationLibraryBinding: "recipientName",
        },
      ],
    };

    await expect(
      saveDesign(
        createService(),
        "template-1",
        { designSchema, designStatus: "DRAFT" },
        superAdmin
      )
    ).resolves.toBeDefined();
    expect(
      transaction.confirmationTemplateLibraryFile.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          designSchema: expect.objectContaining({
            fields: [
              expect.objectContaining({
                baseInformationBinding: "clientName",
                defaultValueSource: {
                  source: "CUSTOM",
                  value: "Optional initial value",
                },
                informationLibraryBinding: "recipientName",
              }),
            ],
          }),
        }),
      })
    );
  });

  it("migrates an information-library default source when saving a design", async () => {
    const designSchema = {
      ...validDesignSchema(),
      fields: [
        {
          ...validDesignSchema().fields[0],
          defaultValueSource: {
            binding: "recipientName",
            source: "INFORMATION_LIBRARY",
          },
          kind: "MULTILINE",
        },
      ],
    };

    await expect(
      saveDesign(
        createService(),
        "template-1",
        { designSchema, designStatus: "DRAFT" },
        superAdmin
      )
    ).resolves.toBeDefined();

    const savedDesign = transaction.confirmationTemplateLibraryFile.update.mock
      .calls[0]?.[0] as { data?: { designSchema?: { fields?: unknown[] } } };
    const savedField = savedDesign.data?.designSchema?.fields?.[0] as Record<
      string,
      unknown
    >;
    expect(savedField).toEqual(
      expect.objectContaining({ informationLibraryBinding: "recipientName" })
    );
    expect(savedField).not.toHaveProperty("defaultValueSource");
  });

  it("coalesces concurrent canonical PDF preview conversions", async () => {
    let resolveConversion: ((value: Buffer) => void) | undefined;
    documentConversion.convertOfficeBufferToPdf.mockReturnValue(
      new Promise<Buffer>((resolve) => {
        resolveConversion = resolve;
      })
    );
    const service = createService();

    const first = service.preview("template-1");
    const second = service.preview("template-1");
    await vi.waitFor(() =>
      expect(documentConversion.convertOfficeBufferToPdf).toHaveBeenCalledOnce()
    );
    resolveConversion?.(validPdf);

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(storage.getObjectBuffer).toHaveBeenCalledOnce();
    expect(storage.putCacheObject).toHaveBeenCalledOnce();
  });

  it("returns a converted preview when cache persistence fails", async () => {
    storage.putCacheObject.mockRejectedValueOnce(new Error("cache unavailable"));

    await expect(createService().preview("template-1")).resolves.toMatchObject({
      body: validPdf,
      mimeType: "application/pdf",
    });
  });

  it("uses a new preview cache key after the template is updated", async () => {
    const template = {
      id: "template-1",
      code: "CTPL-123456789ABC",
      fileName: "template.docx",
      objectKey: "confirmation-template-library/template.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      uploadedById: "admin-1",
    };
    prisma.confirmationTemplateLibraryFile.findUnique
      .mockResolvedValueOnce({
        ...template,
        updatedAt: new Date("2026-07-01T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        ...template,
        updatedAt: new Date("2026-07-02T00:00:00.000Z"),
      });
    const service = createService();

    await service.preview("template-1");
    await service.preview("template-1");

    expect(storage.putCacheObject).toHaveBeenNthCalledWith(
      1,
      "confirmation-template-preview-cache/template-1/1782864000000/preview.pdf",
      validPdf,
      "application/pdf"
    );
    expect(storage.putCacheObject).toHaveBeenNthCalledWith(
      2,
      "confirmation-template-preview-cache/template-1/1782950400000/preview.pdf",
      validPdf,
      "application/pdf"
    );
  });

  it("deletes metadata and audit atomically before cleaning storage", async () => {
    const service = createService();

    await expect(
      service.remove("template-1", superAdmin, source)
    ).resolves.toStrictEqual({ id: "template-1" });
    expect(
      transaction.confirmationTemplateLibraryFile.delete
    ).toHaveBeenCalledWith({ where: { id: "template-1" } });
    expect(auditLogs.logInTransaction).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        action: "CONFIRMATION_TEMPLATE_LIBRARY_FILE_DELETED",
        targetId: "template-1",
      })
    );
    expect(storage.deleteObject).toHaveBeenCalledWith(
      "confirmation-template-library/template.docx"
    );
  });

  it("rejects Partner deleting a custom template", async () => {
    const service = createService();
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      fileName: "template.docx",
      objectKey: "confirmation-template-library/template.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      uploadedById: "someone-else",
    });

    await expect(
      service.remove("template-1", partner, source)
    ).rejects.toBeInstanceOf(ApiForbiddenException);
  });

  it("allows Super Admin to delete a custom template uploaded by someone else", async () => {
    const service = createService();
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      id: "template-1",
      code: "CTPL-123456789ABC",
      fileName: "template.docx",
      objectKey: "confirmation-template-library/template.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      uploadedById: "someone-else",
    });

    await expect(
      service.remove("template-1", superAdmin, source)
    ).resolves.toStrictEqual({ id: "template-1" });
    expect(
      transaction.confirmationTemplateLibraryFile.delete
    ).toHaveBeenCalledWith({ where: { id: "template-1" } });
    expect(storage.deleteObject).toHaveBeenCalledWith(
      "confirmation-template-library/template.docx"
    );
  });

  it("lets Super Admin soft-delete a registered system template", async () => {
    prisma.confirmationTemplateLibraryFile.findMany.mockResolvedValueOnce([]);
    transaction.confirmationTemplateLibraryBuiltInOverride.upsert.mockResolvedValueOnce(
      {
        templateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        designSchema: null,
        designStatus: "DISABLED",
        enabledAt: null,
        deletedAt: new Date("2026-08-30T00:00:00.000Z"),
      }
    );
    const service = createService();
    const templates = await service.list();
    const builtIn = templates.find(
      (template) => template.code === "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
    );

    await expect(
      service.remove(assertPresentValue(builtIn).id, superAdmin, source)
    ).resolves.toStrictEqual({ id: assertPresentValue(builtIn).id });
    expect(
      transaction.confirmationTemplateLibraryBuiltInOverride.upsert
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { templateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH" },
        update: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
    expect(storage.deleteObject).not.toHaveBeenCalled();

    prisma.confirmationTemplateLibraryBuiltInOverride.findMany.mockResolvedValueOnce(
      [
        {
          templateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
          designSchema: null,
          designStatus: "DISABLED",
          enabledAt: null,
          deletedAt: new Date("2026-08-30T00:00:00.000Z"),
        },
      ]
    );
    const remainingTemplates = await service.list();
    expect(
      remainingTemplates.find(
        (template) => template.code === "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
      )
    ).toBeUndefined();
  });

  it("does not delete storage when the deletion transaction fails", async () => {
    prisma.$transaction.mockRejectedValueOnce(
      new Error("database unavailable")
    );
    const service = createService();

    await expect(
      service.remove("template-1", superAdmin, source)
    ).rejects.toThrow("database unavailable");
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });
});

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
