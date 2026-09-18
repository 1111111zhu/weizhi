import { createHash } from "node:crypto";

import { PDFDocument } from "pdf-lib";

import {
  ConfirmationUploadService,
  MAX_CONFIRMATION_UPLOAD_BYTES,
} from "./confirmation-upload.service";
import type { UploadedConfirmationFile } from "./confirmation-upload.service";

const prisma = {
  project: { findUnique: vi.fn() },
  projectConfirmation: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  confirmationArtifact: {
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
};
const access = { requireMutableProject: vi.fn() };
const codes = { allocateInTransaction: vi.fn() };
const storage = {
  putConfirmationArtifact: vi.fn(),
  getObjectBuffer: vi.fn(),
  deleteConfirmationArtifact: vi.fn(),
};
const conversion = { convertOfficeBufferToPdf: vi.fn() };
const existingDraft = {
  id: "confirmation-1",
  status: "DRAFT",
  currentArtifactId: null,
  submissionVersion: 0,
};

function createService() {
  return new ConfirmationUploadService(
    prisma as never,
    access as never,
    codes as never,
    storage as never,
    conversion as never
  );
}

function uploadedFile(
  overrides: Partial<UploadedConfirmationFile> = {}
): UploadedConfirmationFile {
  const buffer = Buffer.from("opaque evidence");
  return {
    buffer,
    mimetype: "application/x-custom-evidence",
    originalname: "evidence.msg",
    size: buffer.byteLength,
    ...overrides,
  };
}

function expectNoConfirmationStorageKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(expectNoConfirmationStorageKeys);
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    expect([
      "objectKey",
      "attachmentObjectKey",
      "docxObjectKey",
      "pdfObjectKey",
      "structuredSnapshot",
    ]).not.toContain(key);
    expectNoConfirmationStorageKeys(nested);
  }
}

describe(ConfirmationUploadService, () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.projectConfirmation.findFirst.mockResolvedValue(existingDraft);
    prisma.projectConfirmation.findUnique.mockResolvedValue(existingDraft);
    prisma.projectConfirmation.create.mockResolvedValue({});
    prisma.projectConfirmation.update.mockResolvedValue(existingDraft);
    prisma.projectConfirmation.updateMany.mockResolvedValue({ count: 1 });
    prisma.project.findUnique.mockResolvedValue({ projectCode: "P-001" });
    codes.allocateInTransaction.mockResolvedValue({
      confirmationCode: "P-001-C-001",
      sequence: 1,
    });
    prisma.confirmationArtifact.create.mockResolvedValue({});
    prisma.confirmationArtifact.delete.mockResolvedValue({});
    prisma.confirmationArtifact.findFirst.mockResolvedValue(undefined as never);
    prisma.confirmationArtifact.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (callback) => {
      await Promise.resolve();
      return callback({
        confirmationArtifact: {
          create: prisma.confirmationArtifact.create,
          delete: prisma.confirmationArtifact.delete,
          findFirst: prisma.confirmationArtifact.findFirst,
          update: prisma.confirmationArtifact.update,
        },
        projectConfirmation: {
          update: prisma.projectConfirmation.update,
          updateMany: prisma.projectConfirmation.updateMany,
          findUnique: prisma.projectConfirmation.findUnique,
          create: prisma.projectConfirmation.create,
        },
        auditLog: { create: prisma.auditLog.create },
      });
    });
    storage.putConfirmationArtifact
      .mockResolvedValueOnce({ objectKey: "source-object" })
      .mockResolvedValueOnce({ objectKey: "preview-object" });
    storage.deleteConfirmationArtifact.mockResolvedValue(undefined as never);
  });

  it("sanitizes storage internals from a remove-content mutation result recursively", async () => {
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      ...existingDraft,
      draftTemplateCode: null,
    });
    prisma.projectConfirmation.findUnique.mockResolvedValue({
      id: "confirmation-1",
      currentArtifact: {
        docxObjectKey: "private/source.docx",
        pdfObjectKey: "private/preview.pdf",
        structuredSnapshot: { objectKey: "private/source.docx" },
      },
      nested: { artifacts: [{ objectKey: "private/response.pdf" }] },
    });

    const result = await createService().removeDraftContent(
      "project-1",
      "confirmation-1",
      { id: "user-1" } as never,
      {} as never
    );

    expect(result).toBeDefined();
    expectNoConfirmationStorageKeys(result);
  });

  it("removes a generated draft artifact when replacing its template", async () => {
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      ...existingDraft,
      currentArtifactId: "artifact-1",
      draftTemplateCode: "CTPL-OLD",
      currentArtifact: {
        templateCode: "CTPL-OLD",
        dispatches: [],
      },
    });

    await expect(
      createService().removeDraftContent(
        "project-1",
        "confirmation-1",
        { id: "user-1" } as never,
        {} as never
      )
    ).resolves.toBeDefined();

    expect(prisma.confirmationArtifact.delete).toHaveBeenCalledWith({
      where: { id: "artifact-1" },
    });
    expect(prisma.projectConfirmation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentArtifactId: null }),
      })
    );
  });

  it("merges a batch and appends later uploads without losing earlier pages", async () => {
    const makePdf = async (width: number) => {
      const pdf = await PDFDocument.create();
      pdf.addPage([width, 300]);
      const buffer = Buffer.from(await pdf.save());
      return uploadedFile({
        buffer,
        size: buffer.length,
        mimetype: "application/pdf",
        originalname: `${width}.pdf`,
      });
    };
    const first = await makePdf(100);
    const second = await makePdf(200);
    const third = await makePdf(250);
    await createService().attachToDraft(
      "project-1",
      "confirmation-1",
      "Bank",
      [first, second],
      { id: "user-1" } as never,
      {} as never
    );
    const [, firstPreviewCall] = storage.putConfirmationArtifact.mock.calls;
    const mergedBytes = firstPreviewCall?.[4];
    const mergedPdf = await PDFDocument.load(mergedBytes);
    expect(mergedPdf.getPages().map((page) => page.getWidth())).toStrictEqual([
      100, 200,
    ]);
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      ...existingDraft,
      currentArtifactId: "old",
      currentArtifact: {
        templateCode: "UPLOADED_DOCUMENT",
        pdfObjectKey: "old.pdf",
        structuredSnapshot: { fileNames: ["100.pdf", "200.pdf"] },
      },
    });
    storage.getObjectBuffer.mockResolvedValue(mergedBytes);
    storage.putConfirmationArtifact.mockReset();
    storage.putConfirmationArtifact.mockResolvedValue({
      objectKey: "next.pdf",
    });
    await createService().attachToDraft(
      "project-1",
      "confirmation-1",
      "Bank",
      [third],
      { id: "user-1" } as never,
      {} as never
    );
    const [, secondPreviewCall] = storage.putConfirmationArtifact.mock.calls;
    const appendedBytes = secondPreviewCall?.[4];
    const appendedPdf = await PDFDocument.load(appendedBytes);
    expect(appendedPdf.getPages().map((page) => page.getWidth())).toStrictEqual(
      [100, 200, 250]
    );
    expect(prisma.confirmationArtifact.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          structuredSnapshot: expect.objectContaining({
            fileNames: ["100.pdf", "200.pdf", "250.pdf"],
          }),
        }),
      })
    );
    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "confirmation-1",
          status: "DRAFT",
          currentArtifactId: "old",
        },
      })
    );
  });

  it("accepts a non-empty file with an arbitrary MIME type and keeps its raw bytes", async () => {
    const file = uploadedFile();

    await createService().attachToDraft(
      "project-1",
      "confirmation-1",
      "Example counterparty",
      file,
      { id: "user-1" } as never,
      {} as never
    );

    expect(storage.putConfirmationArtifact).toHaveBeenNthCalledWith(
      1,
      "project-1",
      "confirmation-1",
      expect.any(String),
      "docx",
      file.buffer,
      file.mimetype
    );
    expect(storage.putConfirmationArtifact).toHaveBeenNthCalledWith(
      2,
      "project-1",
      "confirmation-1",
      expect.any(String),
      "pdf",
      file.buffer,
      file.mimetype
    );
    expect(conversion.convertOfficeBufferToPdf).not.toHaveBeenCalled();
    expect(prisma.confirmationArtifact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        docxSize: file.size,
        pdfSize: file.size,
        structuredSnapshot: {
          source: "UPLOAD",
          objectKey: "source-object",
          fileName: file.originalname,
          fileNames: [file.originalname],
          mimeType: file.mimetype,
          size: file.size,
          sha256: createHash("sha256").update(file.buffer).digest("hex"),
          previewIsPdf: false,
          previewMimeType: file.mimetype,
        },
      }),
    });
  });

  it("uses the next artifact version when re-uploading after a previous upload", async () => {
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      ...existingDraft,
      submissionVersion: 1,
    });

    await createService().attachToDraft(
      "project-1",
      "confirmation-1",
      "Example counterparty",
      uploadedFile(),
      { id: "user-1" } as never,
      {} as never
    );

    expect(prisma.confirmationArtifact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ version: 2 }),
    });
    expect(prisma.projectConfirmation.update).toHaveBeenCalledWith({
      where: { id: "confirmation-1" },
      data: expect.objectContaining({ submissionVersion: 2 }),
    });
  });

  it("uses the latest retained artifact version when the draft counter is stale", async () => {
    prisma.confirmationArtifact.findFirst.mockResolvedValue({ version: 2 });

    await createService().attachToDraft(
      "project-1",
      "confirmation-1",
      "Example counterparty",
      uploadedFile(),
      { id: "user-1" } as never,
      {} as never
    );

    expect(prisma.confirmationArtifact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ version: 3 }),
    });
    expect(prisma.projectConfirmation.update).toHaveBeenCalledWith({
      where: { id: "confirmation-1" },
      data: expect.objectContaining({ submissionVersion: 3 }),
    });
  });

  it("keeps an uploaded artifact with dispatch history when removing it from a draft", async () => {
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      ...existingDraft,
      currentArtifactId: "artifact-1",
      currentArtifact: {
        templateCode: "UPLOADED_DOCUMENT",
        dispatches: [{ id: "dispatch-1" }],
      },
    });
    prisma.confirmationArtifact.findFirst.mockResolvedValue({ version: 2 });

    await createService().removeFromDraft(
      "project-1",
      "confirmation-1",
      { id: "user-1" } as never,
      {} as never
    );

    expect(prisma.confirmationArtifact.delete).not.toHaveBeenCalled();
    expect(prisma.confirmationArtifact.update).toHaveBeenCalledWith({
      where: { id: "artifact-1" },
      data: expect.objectContaining({
        disposition: "INVALIDATED",
        invalidatedBy: "user-1",
        invalidationReason: "REMOVED_FROM_DRAFT",
        invalidatedAt: expect.any(Date),
      }),
    });
    expect(prisma.projectConfirmation.update).toHaveBeenCalledWith({
      where: { id: "confirmation-1" },
      data: expect.objectContaining({
        currentArtifactId: null,
        submissionVersion: 2,
      }),
    });
    expect(storage.deleteConfirmationArtifact).not.toHaveBeenCalled();
  });

  it.each(["attachToDraft", "createFromUpload"])(
    "cleans the source object when the preview object write fails for %s",
    async (operation) => {
      storage.putConfirmationArtifact.mockReset();
      storage.putConfirmationArtifact.mockResolvedValueOnce({
        objectKey: "source-object",
      });
      storage.putConfirmationArtifact.mockRejectedValueOnce(
        new Error("preview write failed")
      );

      const file = uploadedFile();
      const promise =
        operation === "attachToDraft"
          ? createService().attachToDraft(
              "project-1",
              "confirmation-1",
              "Example counterparty",
              file,
              { id: "user-1" } as never,
              {} as never
            )
          : createService().createFromUpload(
              "project-1",
              "BANK" as never,
              "Example counterparty",
              file,
              { id: "user-1" } as never,
              {} as never
            );

      await expect(promise).rejects.toThrow("preview write failed");
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(storage.deleteConfirmationArtifact).toHaveBeenCalledWith(
        "project-1",
        expect.any(String),
        expect.any(String),
        "docx"
      );
    }
  );

  it("creates an arbitrary .msg upload with a safe basename and traceable audit name", async () => {
    const file = uploadedFile({
      originalname: "../../evil\r\nname.msg",
    });
    prisma.projectConfirmation.findUnique.mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      currentArtifact: {
        id: "artifact-1",
        docxObjectKey: "private/source-object",
        structuredSnapshot: {
          source: "UPLOAD",
          objectKey: "private/source-object",
          fileName: "evilname.msg",
          mimeType: file.mimetype,
          size: file.buffer.byteLength,
          sha256: createHash("sha256").update(file.buffer).digest("hex"),
          previewIsPdf: false,
          previewMimeType: file.mimetype,
        },
      },
      responses: [],
    });

    const result = await createService().createFromUpload(
      "project-1",
      "BANK" as never,
      "Example counterparty",
      file,
      { id: "user-1" } as never,
      {} as never
    );

    expect(prisma.projectConfirmation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attachmentName: "evilname.msg" }),
      })
    );
    expect(prisma.confirmationArtifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          docxSize: file.buffer.byteLength,
          structuredSnapshot: expect.objectContaining({
            fileName: "evilname.msg",
            originalFileName:
              "..[U+002f]..[U+002f]evil[U+000d][U+000a]name.msg",
            mimeType: "application/x-custom-evidence",
          }),
        }),
      })
    );
    expect(result).toStrictEqual(
      expect.objectContaining({
        attachment: expect.objectContaining({
          originalFileName: "evilname.msg",
          originalMimeType: file.mimetype,
          previewability: "DOWNLOAD_ONLY",
          downloadUrl:
            "/engagement/project-1/confirmations/confirmation-1/preview.pdf",
        }),
      })
    );
    expectNoConfirmationStorageKeys(result);
  });

  it("rejects a multipart size mismatch before writing storage", async () => {
    const file = uploadedFile({ size: 1 });

    await expect(
      createService().createFromUpload(
        "project-1",
        "BANK" as never,
        "Example counterparty",
        file,
        { id: "user-1" } as never,
        {} as never
      )
    ).rejects.toThrow("size does not match");

    expect(storage.putConfirmationArtifact).not.toHaveBeenCalled();
  });

  it("rejects an empty file in create-from-upload before writing storage", async () => {
    const file = uploadedFile({ buffer: Buffer.alloc(0), size: 0 });

    await expect(
      createService().createFromUpload(
        "project-1",
        "BANK" as never,
        "Example counterparty",
        file,
        { id: "user-1" } as never,
        {} as never
      )
    ).rejects.toThrow("cannot be empty");

    expect(storage.putConfirmationArtifact).not.toHaveBeenCalled();
  });

  it("rejects a file over the 20 MiB upload limit before writing storage", async () => {
    const buffer = Buffer.alloc(MAX_CONFIRMATION_UPLOAD_BYTES + 1, 1);
    const file = uploadedFile({ buffer, size: buffer.byteLength });

    await expect(
      createService().createFromUpload(
        "project-1",
        "BANK" as never,
        "Example counterparty",
        file,
        { id: "user-1" } as never,
        {} as never
      )
    ).rejects.toThrow("20 MiB");

    expect(storage.putConfirmationArtifact).not.toHaveBeenCalled();
  });

  it("records a real PDF preview only after Office conversion succeeds", async () => {
    const file = uploadedFile({
      mimetype:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      originalname: "evidence.docx",
    });
    const converted = Buffer.from("%PDF-1.4 converted");
    conversion.convertOfficeBufferToPdf.mockResolvedValue(converted);

    await createService().attachToDraft(
      "project-1",
      "confirmation-1",
      "Example counterparty",
      file,
      { id: "user-1" } as never,
      {} as never
    );

    expect(storage.putConfirmationArtifact).toHaveBeenNthCalledWith(
      2,
      "project-1",
      "confirmation-1",
      expect.any(String),
      "pdf",
      converted,
      "application/pdf"
    );
    expect(prisma.confirmationArtifact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        structuredSnapshot: expect.objectContaining({
          objectKey: "source-object",
          fileName: "evidence.docx",
          mimeType: file.mimetype,
          size: file.size,
          sha256: createHash("sha256").update(file.buffer).digest("hex"),
          previewIsPdf: true,
          previewMimeType: "application/pdf",
        }),
      }),
    });
  });

  it("rejects an empty file before writing either stored object", async () => {
    const file = uploadedFile({ buffer: Buffer.alloc(0), size: 0 });

    await expect(
      createService().attachToDraft(
        "project-1",
        "confirmation-1",
        "Example counterparty",
        file,
        { id: "user-1" } as never,
        {} as never
      )
    ).rejects.toThrow("cannot be empty");

    expect(storage.putConfirmationArtifact).not.toHaveBeenCalled();
  });

  it("projects safe original upload metadata in the draft upload response", async () => {
    const file = uploadedFile();
    prisma.projectConfirmation.findUnique.mockResolvedValue({
      ...existingDraft,
      projectId: "project-1",
      responses: [],
      currentArtifact: {
        id: "artifact-1",
        docxObjectKey: "private/source-object",
        structuredSnapshot: {
          source: "UPLOAD",
          objectKey: "private/source-object",
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          sha256: createHash("sha256").update(file.buffer).digest("hex"),
          previewIsPdf: false,
          previewMimeType: file.mimetype,
        },
      },
    });

    const result = await createService().attachToDraft(
      "project-1",
      "confirmation-1",
      "Example counterparty",
      file,
      { id: "user-1" } as never,
      {} as never
    );

    expect(result).toStrictEqual(
      expect.objectContaining({
        attachment: {
          originalFileName: file.originalname,
          originalMimeType: file.mimetype,
          previewability: "DOWNLOAD_ONLY",
          downloadUrl:
            "/engagement/project-1/confirmations/confirmation-1/preview.pdf",
        },
      })
    );
    expect(result?.currentArtifact).not.toHaveProperty("docxObjectKey");
    expect(result?.currentArtifact).not.toHaveProperty("structuredSnapshot");
  });
});
