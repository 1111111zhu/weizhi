import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import { StorageService } from "../storage/storage.service";
import { DocumentConversionService } from "./document-conversion.service";
import {
  PdfRasterPreviewService,
  buildPdfRasterPreviewManifestObjectKey,
  buildPdfRasterPreviewPageObjectKey,
} from "./pdf-raster-preview.service";

class TestPdfRasterPreviewService extends PdfRasterPreviewService {
  readonly commands: { file: string; args: string[] }[] = [];
  readonly sourcePdfs: Buffer[] = [];

  protected override async executeFile(file: string, args: string[]) {
    this.commands.push({ file, args });
    if (file.includes("pdfinfo")) {
      this.sourcePdfs.push(await readFile(args[0]));
      return {
        stdout: "Pages:          7\nPage size:      612 x 792 pts\n",
        stderr: "",
      };
    }
    if (file.includes("pdftoppm")) {
      const outputPrefix = args[args.length - 1];
      await writeFile(`${outputPrefix}.png`, Buffer.from("rendered-page"));
      return { stdout: "", stderr: "" };
    }
    throw new Error(`Unexpected command: ${file}`);
  }
}

describe(PdfRasterPreviewService, () => {
  let documentConversion: DocumentConversionService;
  let service: TestPdfRasterPreviewService;
  let storage: StorageService;
  let uploadRoot: string;

  beforeEach(async () => {
    uploadRoot = await mkdtemp(
      pathModule.join(tmpdir(), "project-wing-pdf-raster-")
    );
    process.env.STORAGE_DRIVER = "local";
    process.env.UPLOAD_DIR = uploadRoot;
    storage = new StorageService();
    documentConversion = new DocumentConversionService(storage);
    service = new TestPdfRasterPreviewService(storage, documentConversion);
  });

  afterEach(async () => {
    await rm(uploadRoot, { force: true, recursive: true });
    delete process.env.STORAGE_DRIVER;
    delete process.env.UPLOAD_DIR;
    delete process.env.PREVIEW_PDF_MAX_PAGES;
    delete process.env.PREVIEW_PDF_MAX_SOURCE_BYTES;
  });

  it("reads raster preview metadata without rendering pages", async () => {
    const attachment = await storePdfAttachment();
    const manifest =
      await service.getAttachmentRasterPreviewManifest(attachment);

    expect(manifest).toStrictEqual({
      attachmentId: "attachment-1",
      dpi: 150,
      mimeType: "image/png",
      pageHeight: 792,
      pageCount: 7,
      pageWidth: 612,
      version: 2,
    });
    expect(service.commands).toStrictEqual([
      {
        file: "pdfinfo",
        args: [pathModule.join(uploadRoot, attachment.fileUrl)],
      },
    ]);
  });

  it("rasterizes converted Office PDF bytes rather than reading the original Office object", async () => {
    const pdf = Buffer.from("%PDF-1.4 converted Office content");
    const attachment = {
      id: "office-1",
      version: 1,
      fileUrl: "missing-original.docx",
      fileName: "report.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    vi.spyOn(documentConversion, "getAttachmentPreviewPdf").mockResolvedValue({
      body: pdf,
      fileName: "report.pdf",
      mimeType: "application/pdf",
    });
    const preview = new TestPdfRasterPreviewService(
      storage,
      documentConversion
    );
    await expect(
      preview.getAttachmentRasterPreviewManifest(attachment)
    ).resolves.toMatchObject({ pageCount: 7 });
    expect(preview.sourcePdfs).toStrictEqual([pdf]);
  });

  it("returns cached raster pages without invoking poppler", async () => {
    const attachment = await storePdfAttachment();
    const objectKey = buildPdfRasterPreviewPageObjectKey(attachment, {
      dpi: 150,
      pageNumber: 3,
    });
    await storage.putCacheObject(objectKey, Buffer.from("cached"), "image/png");

    const page = await service.getAttachmentRasterPreviewPage(attachment, {
      pageNumber: 3,
    });

    expect(page).toStrictEqual({
      body: Buffer.from("cached"),
      fileName: "page-3.png",
      mimeType: "image/png",
    });
    expect(service.commands).toStrictEqual([]);
  });

  it("uses preview cache keys when provided", async () => {
    await Promise.resolve();
    const objectKey = buildPdfRasterPreviewPageObjectKey(
      {
        id: "attachment-smart-form",
        projectId: "project-1",
        version: 3,
        previewCacheKey: "v3-generated-pdf",
      },
      {
        dpi: 150,
        pageNumber: 1,
      }
    );

    expect(objectKey).toBe(
      "document-raster-previews/project-1/attachment-smart-form/v3-generated-pdf/dpi-150/page-1.png"
    );
  });

  it("renders only the requested page and stores it in cache", async () => {
    const attachment = await storePdfAttachment();
    const firstPage = await service.getAttachmentRasterPreviewPage(attachment, {
      pageNumber: 4,
    });
    const secondPage = await service.getAttachmentRasterPreviewPage(
      attachment,
      {
        pageNumber: 4,
      }
    );
    const objectKey = buildPdfRasterPreviewPageObjectKey(attachment, {
      dpi: 150,
      pageNumber: 4,
    });
    const cached = await readFile(pathModule.join(uploadRoot, objectKey));

    expect(firstPage).toStrictEqual(secondPage);
    expect(firstPage).toStrictEqual({
      body: Buffer.from("rendered-page"),
      fileName: "page-4.png",
      mimeType: "image/png",
    });
    expect(cached).toStrictEqual(Buffer.from("rendered-page"));
    expect(service.commands).toHaveLength(2);
    expect(service.commands[0].file).toBe("pdfinfo");
    expect(service.commands[1].file).toBe("pdftoppm");
    expect(service.commands[1].args).toStrictEqual(
      expect.arrayContaining(["-f", "4", "-l", "4", "-r", "150", "-png"])
    );
    expect(service.commands[1].args).toContain("-singlefile");
  });

  it("deduplicates concurrent renders and bounds DPI cache variants", async () => {
    const attachment = await storePdfAttachment();

    const [first, second] = await Promise.all([
      service.getAttachmentRasterPreviewPage(attachment, {
        pageNumber: 2,
        dpi: 149,
      }),
      service.getAttachmentRasterPreviewPage(attachment, {
        pageNumber: 2,
        dpi: 149,
      }),
    ]);

    expect(first.body).toStrictEqual(second.body);
    expect(
      service.commands.filter((command) => command.file.includes("pdftoppm"))
    ).toHaveLength(1);
    expect(
      service.commands.find((command) => command.file.includes("pdftoppm"))
        ?.args
    ).toStrictEqual(expect.arrayContaining(["-r", "150"]));
  });

  it("warms metadata and every page before the first user preview", async () => {
    const attachment = await storePdfAttachment();
    const writes: string[] = [];
    const putCacheObject = storage.putCacheObject.bind(storage);
    vi.spyOn(storage, "putCacheObject").mockImplementation(
      (objectKey, body, mimeType) => {
        writes.push(objectKey);
        return putCacheObject(objectKey, body, mimeType);
      }
    );

    const manifest = await service.warmAttachmentRasterPreview(attachment);
    const cachedManifestBuffer = await storage.getObjectBuffer(
      buildPdfRasterPreviewManifestObjectKey(attachment)
    );
    const cachedManifest = JSON.parse(cachedManifestBuffer.toString("utf-8"));

    expect(manifest.pageCount).toBe(7);
    expect(cachedManifest).toStrictEqual(manifest);
    expect(
      service.commands.filter((command) => command.file.includes("pdfinfo"))
    ).toHaveLength(1);
    expect(
      service.commands.filter((command) => command.file.includes("pdftoppm"))
    ).toHaveLength(7);
    expect(
      writes.indexOf(
        buildPdfRasterPreviewPageObjectKey(attachment, {
          dpi: 150,
          pageNumber: 1,
        })
      )
    ).toBeLessThan(
      writes.indexOf(buildPdfRasterPreviewManifestObjectKey(attachment))
    );
    expect(
      writes.indexOf(buildPdfRasterPreviewManifestObjectKey(attachment))
    ).toBeLessThan(
      writes.indexOf(
        buildPdfRasterPreviewPageObjectKey(attachment, {
          dpi: 150,
          pageNumber: 2,
        })
      )
    );
    await expect(
      storage.getObjectBuffer(
        buildPdfRasterPreviewPageObjectKey(attachment, {
          dpi: 150,
          pageNumber: 7,
        })
      )
    ).resolves.toStrictEqual(Buffer.from("rendered-page"));
  });

  it("reuses content-addressed pages across versions with identical bytes", async () => {
    const attachment = {
      ...(await storePdfAttachment()),
      contentHash: "a".repeat(64),
    };
    await service.warmAttachmentRasterPreview(attachment);
    service.commands.length = 0;

    const nextVersion = {
      ...attachment,
      version: 3,
      fileUrl: "working-papers/project-1/paper-1/not-downloaded-again.pdf",
    };
    const manifest = await service.warmAttachmentRasterPreview(nextVersion);
    const firstPage = await service.getAttachmentRasterPreviewPage(
      nextVersion,
      {
        pageNumber: 1,
      }
    );

    expect(manifest.version).toBe(3);
    expect(firstPage.body).toStrictEqual(Buffer.from("rendered-page"));
    expect(service.commands).toStrictEqual([]);
    expect(
      buildPdfRasterPreviewPageObjectKey(attachment, {
        dpi: 150,
        pageNumber: 1,
      })
    ).toBe(
      buildPdfRasterPreviewPageObjectKey(nextVersion, {
        dpi: 150,
        pageNumber: 1,
      })
    );
  });

  it("rejects invalid page numbers before rendering", async () => {
    const attachment = await storePdfAttachment();

    await expect(
      service.getAttachmentRasterPreviewPage(attachment, { pageNumber: 0 })
    ).rejects.toThrow("PDF preview page is invalid");
    expect(service.commands).toStrictEqual([]);
  });

  it("rejects pages outside the document before rasterization", async () => {
    const attachment = await storePdfAttachment();

    await expect(
      service.getAttachmentRasterPreviewPage(attachment, { pageNumber: 8 })
    ).rejects.toThrow("PDF preview page is outside the document");
    expect(
      service.commands.filter((command) => command.file.includes("pdftoppm"))
    ).toHaveLength(0);
  });

  it("enforces page-count and source-size safety limits", async () => {
    const attachment = await storePdfAttachment();
    process.env.PREVIEW_PDF_MAX_PAGES = "6";

    await expect(
      service.getAttachmentRasterPreviewManifest(attachment)
    ).rejects.toThrow("6-page safety limit");

    process.env.PREVIEW_PDF_MAX_PAGES = "7";
    process.env.PREVIEW_PDF_MAX_SOURCE_BYTES = "4";
    await expect(
      service.warmAttachmentRasterPreview({ ...attachment, fileSize: 5 })
    ).rejects.toThrow("raster preview size limit");
  });

  async function storePdfAttachment() {
    const relativeDir = pathModule.posix.join(
      "working-papers",
      "project-1",
      "paper-1"
    );
    const fileUrl = pathModule.posix.join(relativeDir, "support.pdf");
    await writeFile(
      pathModule.join(uploadRoot, fileUrl),
      Buffer.from("%PDF-1.4"),
      {
        flag: "w",
      }
    ).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") {
        throw error;
      }
      await storage.putCacheObject(
        fileUrl,
        Buffer.from("%PDF-1.4"),
        "application/pdf"
      );
    });
    return {
      id: "attachment-1",
      projectId: "project-1",
      fileUrl,
      fileName: "support.pdf",
      originalName: "support.pdf",
      mimeType: "application/pdf",
      version: 2,
    };
  }
});
