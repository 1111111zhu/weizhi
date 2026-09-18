import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import type { Mock } from "vitest";

import { DocumentConversionService } from "./document-conversion.service";

type ExecCallback = (
  error: Error | null,
  stdout: string,
  stderr: string
) => void;

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

describe(DocumentConversionService, () => {
  const originalFetch = global.fetch;
  const originalProjectWingEnvironment = process.env.PROJECTWING_ENVIRONMENT;
  const originalLibreOfficePath = process.env.LIBREOFFICE_PATH;
  const execFileMock = execFile as unknown as Mock;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.UPLOAD_DIR = pathModule.join(
      tmpdir(),
      "project-wing-conversion-tests"
    );
    process.env.GOTENBERG_URL = "http://gotenberg:3000";
    vi.spyOn(global, "fetch").mockResolvedValue(new Response());
    return rm(process.env.UPLOAD_DIR, { force: true, recursive: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalProjectWingEnvironment === undefined) {
      delete process.env.PROJECTWING_ENVIRONMENT;
    } else {
      process.env.PROJECTWING_ENVIRONMENT = originalProjectWingEnvironment;
    }
    delete process.env.GOTENBERG_URL;
    delete process.env.DOCUMENT_CONVERSION_CACHE_VERSION;
    delete process.env.DOCUMENT_CONVERSION_TIMEOUT_MS;
    delete process.env.PROJECTWING_ENABLE_WORD_COM_FALLBACK;
    if (originalLibreOfficePath === undefined) {
      delete process.env.LIBREOFFICE_PATH;
    } else {
      process.env.LIBREOFFICE_PATH = originalLibreOfficePath;
    }
  });

  it("converts caller-provided office bytes without reading an absolute path", async () => {
    const convertedPdf = Buffer.from("%PDF-1.4 bytes");
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => {
        await Promise.resolve();
        return convertedPdf.buffer.slice(
          convertedPdf.byteOffset,
          convertedPdf.byteOffset + convertedPdf.byteLength
        );
      },
    });
    const storage = { getObjectBuffer: vi.fn() };
    const service = new DocumentConversionService(storage as never);

    await expect(
      service.convertOfficeBufferToPdf({
        fileName: "confirmation.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        body: Buffer.from("docx bytes"),
      })
    ).resolves.toStrictEqual(convertedPdf);

    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
    const request = (global.fetch as Mock).mock.calls[0]?.[1];
    const uploadedFile = (request.body as FormData).get("files") as Blob;
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(Buffer.from(await uploadedFile.arrayBuffer())).toStrictEqual(
      Buffer.from("docx bytes")
    );
  });

  it("aborts a stalled Gotenberg conversion at the configured deadline", async () => {
    process.env.PROJECTWING_ENVIRONMENT = "production";
    process.env.DOCUMENT_CONVERSION_TIMEOUT_MS = "5";
    (global.fetch as Mock).mockImplementation(
      (_url: string, request: RequestInit) =>
        new Promise((_resolve, reject) => {
          request.signal?.addEventListener(
            "abort",
            () => reject(request.signal?.reason),
            { once: true }
          );
        })
    );

    await expect(
      new DocumentConversionService().convertOfficeBufferToPdf({
        fileName: "damaged.pptx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        body: Buffer.from("damaged pptx"),
      })
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("converts caller-provided PDF bytes to DOCX through Gotenberg", async () => {
    const convertedDocx = Buffer.from("PK\u0003\u0004 converted docx");
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: () =>
        Promise.resolve(
          convertedDocx.buffer.slice(
            convertedDocx.byteOffset,
            convertedDocx.byteOffset + convertedDocx.byteLength
          )
        ),
    });
    const service = new DocumentConversionService();

    await expect(
      service.convertPdfBufferToDocx({
        fileName: "confirmation.pdf",
        mimeType: "application/pdf",
        body: Buffer.from("%PDF-1.4 source"),
      })
    ).resolves.toStrictEqual(convertedDocx);

    expect(global.fetch).toHaveBeenCalledWith(
      "http://gotenberg:3000/forms/libreoffice/convert?convert-to=docx",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("preserves a PDF layout in a visual DOCX when requested", async () => {
    const sourcePdf = await PDFDocument.create();
    sourcePdf.addPage([595.45, 841.7]);
    sourcePdf.addPage([612, 792]);
    const source = Buffer.from(await sourcePdf.save());
    execFileMock.mockImplementation(
      (
        _command: string,
        args: string[],
        optionsOrCallback: Record<string, unknown> | ExecCallback,
        maybeCallback?: ExecCallback
      ) => {
        const callback =
          typeof optionsOrCallback === "function"
            ? optionsOrCallback
            : maybeCallback;
        const outputPrefix = args.at(-1) as string;
        writeFileSync(`${outputPrefix}.png`, Buffer.from("PNG page"));
        callback?.(null, "", "");
      }
    );
    const service = new DocumentConversionService();

    const result = await service.convertPdfBufferToDocx({
      fileName: "confirmation.pdf",
      mimeType: "application/pdf",
      body: source,
      preserveLayout: true,
    });

    const packageZip = await JSZip.loadAsync(result);
    expect(packageZip.file("word/media/page-1.png")).not.toBeNull();
    expect(packageZip.file("word/media/page-2.png")).not.toBeNull();
    await expect(
      packageZip.file("word/media/page-1.png")?.async("nodebuffer")
    ).resolves.toStrictEqual(Buffer.from("PNG page"));
    const documentXml = await packageZip
      .file("word/document.xml")
      ?.async("text");
    expect(documentXml).toContain('r:embed="rId2"');
    expect(documentXml).toContain('w:w="11909" w:h="16834"');
    expect(documentXml).toContain('cx="7772400" cy="10058400"');
    expect(documentXml?.match(/<w:sectPr>/g)).toHaveLength(2);
    expect(documentXml).toContain('w:w="12240" w:h="15840"');
    expect(documentXml).toContain('w:val="nextPage"');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(execFile).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["HTML", "text/html", Buffer.from("<html>not a pdf</html>")],
    ["an empty body", "application/pdf", Buffer.alloc(0)],
    ["non-PDF bytes", "application/pdf", Buffer.from("not-pdf")],
  ])(
    "rejects successful Gotenberg output containing %s",
    async (_label, contentType, body) => {
      process.env.PROJECTWING_ENVIRONMENT = "production";
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        headers: { get: () => contentType },
        arrayBuffer: async () => {
          await Promise.resolve();
          return body.buffer.slice(
            body.byteOffset,
            body.byteOffset + body.byteLength
          );
        },
      });

      await expect(
        new DocumentConversionService().convertOfficeBufferToPdf({
          fileName: "confirmation.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          body: Buffer.from("docx"),
        })
      ).rejects.toThrow("Office document conversion returned an invalid PDF");
    }
  );

  it("returns PDF attachments without calling Gotenberg", async () => {
    const uploadRoot = process.env.UPLOAD_DIR ?? "";
    const relativeDir = pathModule.posix.join(
      "working-papers",
      "project-1",
      "paper-1"
    );
    const fileUrl = pathModule.posix.join(relativeDir, "support.pdf");
    await mkdir(pathModule.join(uploadRoot, relativeDir), { recursive: true });
    await writeFile(
      pathModule.join(uploadRoot, fileUrl),
      Buffer.from("%PDF-1.4")
    );
    const service = new DocumentConversionService();
    const preview = await service.getAttachmentPreviewPdf({
      id: "attachment-1",
      fileUrl,
      fileName: "support.pdf",
      originalName: "support.pdf",
      mimeType: "application/pdf",
      version: 1,
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(preview).toStrictEqual({
      absolutePath: pathModule.join(uploadRoot, fileUrl),
      fileName: "support.pdf",
      mimeType: "application/pdf",
    });
  });

  it("serves OSS PDF bytes rather than an expired signed redirect", async () => {
    const pdf = Buffer.from("%PDF-1.4 fixture");
    const storage = {
      getDownloadObject: vi.fn().mockReturnValue({
        redirectUrl: "https://storage.invalid/file.pdf?Expires=1",
        fileName: "file.pdf",
        mimeType: "application/pdf",
      }),
      getObjectBuffer: vi.fn().mockResolvedValue(pdf),
    };
    const preview = await new DocumentConversionService(
      storage as never
    ).getAttachmentPreviewPdf({
      id: "a",
      fileUrl: "working-papers/p/file.pdf",
      fileName: "file.pdf",
      mimeType: "application/pdf",
      version: 1,
    });
    expect(preview).toStrictEqual({
      body: pdf,
      fileName: "file.pdf",
      mimeType: "application/pdf",
    });
    expect(preview).not.toHaveProperty("redirectUrl");
    expect(storage.getObjectBuffer).toHaveBeenCalledExactlyOnceWith(
      "working-papers/p/file.pdf"
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("uses object storage for Office preview cache even when UPLOAD_DIR cannot contain directories", async () => {
    const uploadRoot = process.env.UPLOAD_DIR ?? "";
    await writeFile(uploadRoot, "not a writable directory");
    const pdf = Buffer.from("%PDF-1.4 converted");
    const cache = new Map<string, Buffer>();
    const storage = {
      getCacheObjectBuffer: vi.fn((key: string) =>
        Promise.resolve(cache.get(key) ?? null)
      ),
      putCacheObject: vi.fn((key: string, value: Buffer) => {
        cache.set(key, value);
        return Promise.resolve();
      }),
      getDownloadObject: vi.fn(() => ({
        redirectUrl: "https://private-storage.example/preview",
        mimeType: "application/pdf",
      })),
      deleteCachePrefix: vi.fn().mockResolvedValue(null),
    };
    const service = new DocumentConversionService(storage as never);
    const convert = vi.spyOn(service, "convertOfficeBufferToPdf");
    const source = Buffer.from("Office source");
    Object.assign(storage, {
      getObjectBuffer: vi.fn().mockResolvedValue(source),
    });
    convert.mockResolvedValue(pdf);
    process.env.DOCUMENT_CONVERSION_CACHE_VERSION = "storage-v1";
    const attachment = {
      id: "a-1",
      version: 2,
      fileUrl: "working-papers/p/a.docx",
      fileName: "a.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const first = await service.getAttachmentPreviewPdf(attachment);
    const second = await service.getAttachmentPreviewPdf(attachment);
    expect(first).toStrictEqual({
      body: pdf,
      fileName: "a.pdf",
      mimeType: "application/pdf",
    });
    expect(second).toStrictEqual(first);
    expect(convert).toHaveBeenCalledOnce();
    expect(storage.putCacheObject).toHaveBeenCalledExactlyOnceWith(
      "document-previews/a-1/v2-storage-v1.pdf",
      pdf,
      "application/pdf"
    );
    await service.clearAttachmentPreviewCache("a-1");
    expect(storage.deleteCachePrefix).toHaveBeenCalledExactlyOnceWith(
      "document-previews/a-1"
    );
    await expect(readFile(uploadRoot, "utf-8")).resolves.toBe(
      "not a writable directory"
    );
  });

  it("preserves cache access failures for the worker instead of treating them as a miss", async () => {
    const denied = new Error("AccessDenied");
    const storage = { getCacheObjectBuffer: vi.fn().mockRejectedValue(denied) };
    const service = new DocumentConversionService(storage as never);
    const convert = vi.spyOn(service, "convertOfficeBufferToPdf");
    await expect(
      service.getAttachmentPreviewPdf({
        id: "a-1",
        version: 1,
        fileUrl: "a.docx",
        fileName: "a.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    ).rejects.toBe(denied);
    expect(convert).not.toHaveBeenCalled();
  });

  it("converts DOCX attachments once and reuses the cached PDF", async () => {
    const uploadRoot = process.env.UPLOAD_DIR ?? "";
    const relativeDir = pathModule.posix.join(
      "working-papers",
      "project-1",
      "paper-1"
    );
    const fileUrl = pathModule.posix.join(relativeDir, "minutes.docx");
    await mkdir(pathModule.join(uploadRoot, relativeDir), { recursive: true });
    await writeFile(pathModule.join(uploadRoot, fileUrl), Buffer.from("docx"));
    const convertedPdf = Buffer.from("%PDF-1.4 converted");
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => {
        await Promise.resolve();
        return convertedPdf.buffer.slice(
          convertedPdf.byteOffset,
          convertedPdf.byteOffset + convertedPdf.byteLength
        );
      },
    });
    const service = new DocumentConversionService();
    const firstPreview = await service.getAttachmentPreviewPdf({
      id: "attachment-1",
      fileUrl,
      fileName: "minutes.docx",
      originalName: "审计文档管理系统（Web DMS）完整规划 v2.0.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      version: 2,
    });
    const secondPreview = await service.getAttachmentPreviewPdf({
      id: "attachment-1",
      fileUrl,
      fileName: "minutes.docx",
      originalName: "审计文档管理系统（Web DMS）完整规划 v2.0.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      version: 2,
    });
    expect(firstPreview.absolutePath).toBeDefined();
    const cachedPdf = await readFile(firstPreview.absolutePath ?? "", "utf-8");

    expect(global.fetch).toHaveBeenCalledExactlyOnceWith(
      "http://gotenberg:3000/forms/libreoffice/convert",
      expect.objectContaining({
        method: "POST",
        headers: expect.not.objectContaining({
          "Gotenberg-Output-Filename": expect.anything(),
        }),
      })
    );
    expect(firstPreview).toStrictEqual(secondPreview);
    expect(firstPreview.fileName).toBe(
      "审计文档管理系统（Web DMS）完整规划 v2.0.pdf"
    );
    expect(cachedPdf).toBe("%PDF-1.4 converted");
  });

  it("regenerates cached previews when the conversion environment changes", async () => {
    const uploadRoot = process.env.UPLOAD_DIR ?? "";
    const relativeDir = pathModule.posix.join(
      "working-papers",
      "project-1",
      "paper-1"
    );
    const fileUrl = pathModule.posix.join(relativeDir, "minutes.docx");
    await mkdir(pathModule.join(uploadRoot, relativeDir), { recursive: true });
    await writeFile(pathModule.join(uploadRoot, fileUrl), Buffer.from("docx"));
    const convertedPdf = Buffer.from("%PDF-1.4 converted");
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => {
        await Promise.resolve();
        return convertedPdf.buffer.slice(
          convertedPdf.byteOffset,
          convertedPdf.byteOffset + convertedPdf.byteLength
        );
      },
    });
    const service = new DocumentConversionService();
    const attachment = {
      id: "attachment-font-cache",
      fileUrl,
      fileName: "minutes.docx",
      originalName: "minutes.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      version: 2,
    };

    process.env.DOCUMENT_CONVERSION_CACHE_VERSION = "font-set/one";
    const firstPreview = await service.getAttachmentPreviewPdf(attachment);
    process.env.DOCUMENT_CONVERSION_CACHE_VERSION = "font-set-two";
    const secondPreview = await service.getAttachmentPreviewPdf(attachment);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(firstPreview.absolutePath).toContain("v2-font-set-one.pdf");
    expect(secondPreview.absolutePath).toContain("v2-font-set-two.pdf");
  });

  it.each([
    [
      "PPTX",
      "board-deck.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    ["PPT", "archive-deck.ppt", "application/vnd.ms-powerpoint"],
    [
      "XLSX",
      "trial-balance.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    ["XLS", "archive-ledger.xls", "application/vnd.ms-excel"],
    ["XLSM", "controls.xlsm", "application/vnd.ms-excel.sheet.macroEnabled.12"],
    [
      "XLSB",
      "data.xlsb",
      "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
    ],
  ])(
    "converts %s attachments once and reuses the cached PDF",
    async (_label, fileName, mimeType) => {
      const uploadRoot = process.env.UPLOAD_DIR ?? "";
      const relativeDir = pathModule.posix.join(
        "working-papers",
        "project-1",
        "paper-1"
      );
      const fileUrl = pathModule.posix.join(relativeDir, fileName);
      await mkdir(pathModule.join(uploadRoot, relativeDir), {
        recursive: true,
      });
      await writeFile(
        pathModule.join(uploadRoot, fileUrl),
        Buffer.from("powerpoint")
      );
      const convertedPdf = Buffer.from("%PDF-1.4 converted presentation");
      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: async () => {
          await Promise.resolve();
          return convertedPdf.buffer.slice(
            convertedPdf.byteOffset,
            convertedPdf.byteOffset + convertedPdf.byteLength
          );
        },
      });
      const service = new DocumentConversionService();
      const firstPreview = await service.getAttachmentPreviewPdf({
        id: `attachment-${_label.toLowerCase()}`,
        fileUrl,
        fileName,
        originalName: fileName,
        mimeType,
        version: 3,
      });
      const secondPreview = await service.getAttachmentPreviewPdf({
        id: `attachment-${_label.toLowerCase()}`,
        fileUrl,
        fileName,
        originalName: fileName,
        mimeType,
        version: 3,
      });
      expect(firstPreview.absolutePath).toBeDefined();
      const cachedPdf = await readFile(
        firstPreview.absolutePath ?? "",
        "utf-8"
      );

      expect(global.fetch).toHaveBeenCalledExactlyOnceWith(
        "http://gotenberg:3000/forms/libreoffice/convert",
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(firstPreview).toStrictEqual(secondPreview);
      expect(firstPreview.fileName).toBe(
        `${fileName.replace(/\.[^.]+$/, "")}.pdf`
      );
      expect(cachedPdf).toBe("%PDF-1.4 converted presentation");
    }
  );

  it("falls back to local LibreOffice in development when Gotenberg is unavailable", async () => {
    process.env.PROJECTWING_ENVIRONMENT = "development";
    process.env.LIBREOFFICE_PATH = String.raw`C:\Program Files\LibreOffice\program\soffice.exe`;
    const uploadRoot = process.env.UPLOAD_DIR ?? "";
    const relativeDir = pathModule.posix.join(
      "working-papers",
      "project-1",
      "paper-1"
    );
    const fileUrl = pathModule.posix.join(relativeDir, "minutes.docx");
    await mkdir(pathModule.join(uploadRoot, relativeDir), { recursive: true });
    await writeFile(pathModule.join(uploadRoot, fileUrl), Buffer.from("docx"));
    const convertedPdf = Buffer.from("%PDF-1.4 local libreoffice");
    (global.fetch as Mock).mockRejectedValue(new Error("ECONNREFUSED"));
    execFileMock.mockImplementation(
      (
        _command: string,
        args: string[],
        callback: (..._args: unknown[]) => unknown
      ) => {
        const outdir = args[args.indexOf("--outdir") + 1];
        void (async () => {
          await writeFile(pathModule.join(outdir, "minutes.pdf"), convertedPdf);
          callback(null, "", "");
        })();
      }
    );
    const service = new DocumentConversionService();
    const preview = await service.getAttachmentPreviewPdf({
      id: "attachment-local-libreoffice",
      fileUrl,
      fileName: "minutes.docx",
      originalName: "minutes.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      version: 1,
    });
    const cachedPdf = await readFile(preview.absolutePath ?? "", "utf-8");

    expect(execFile).toHaveBeenCalledWith(
      String.raw`C:\Program Files\LibreOffice\program\soffice.exe`,
      expect.arrayContaining(["--headless", "--convert-to", "pdf"]),
      expect.any(Function)
    );
    expect(cachedPdf).toBe("%PDF-1.4 local libreoffice");
  });

  it("falls back to Windows Word COM when LibreOffice is unavailable", async () => {
    process.env.PROJECTWING_ENVIRONMENT = "development";
    process.env.PROJECTWING_ENABLE_WORD_COM_FALLBACK = "true";
    delete process.env.GOTENBERG_URL;
    delete process.env.LIBREOFFICE_PATH;
    const convertedPdf = Buffer.from("%PDF-1.4 local word com");
    execFileMock.mockImplementation(
      (
        command: string,
        args: string[],
        optionsOrCallback: object | ((..._args: unknown[]) => unknown),
        maybeCallback?: (..._args: unknown[]) => unknown
      ) => {
        const callback =
          typeof optionsOrCallback === "function"
            ? optionsOrCallback
            : maybeCallback;
        if (command !== "powershell.exe") {
          callback?.(new Error(`spawn ${command} ENOENT`));
          return;
        }
        const outputPath = args[args.indexOf("-OutputPath") + 1];
        void (async () => {
          await writeFile(outputPath, convertedPdf);
          callback?.(null, "", "");
        })();
      }
    );

    await expect(
      new DocumentConversionService().convertOfficeBufferToPdf({
        fileName: "confirmation.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        body: Buffer.from("docx"),
      })
    ).resolves.toStrictEqual(convertedPdf);

    expect(execFile).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining(["-File", "-InputPath", "-OutputPath"]),
      expect.objectContaining({ windowsHide: true }),
      expect.any(Function)
    );
  });

  it.each(["production", " Production ", "PRODUCTION"])(
    "does not use local converters in %s",
    async (environment) => {
      process.env.PROJECTWING_ENVIRONMENT = environment;
      delete process.env.GOTENBERG_URL;
      execFileMock.mockImplementation((...args: unknown[]) => {
        const callback = args.at(-1) as (..._args: unknown[]) => unknown;
        callback(new Error("local converter must not run"));
      });

      await expect(
        new DocumentConversionService().convertOfficeBufferToPdf({
          fileName: "confirmation.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          body: Buffer.from("docx"),
        })
      ).rejects.toThrow("Office 文档预览服务未配置");
      expect(execFile).not.toHaveBeenCalled();
    }
  );

  it("rejects a local LibreOffice output without PDF magic bytes", async () => {
    process.env.PROJECTWING_ENVIRONMENT = "development";
    process.env.PROJECTWING_ENABLE_WORD_COM_FALLBACK = "false";
    delete process.env.GOTENBERG_URL;
    process.env.LIBREOFFICE_PATH = "fake-soffice";
    execFileMock.mockImplementation(
      (
        _command: string,
        args: string[],
        callback: (..._args: unknown[]) => unknown
      ) => {
        const outdir = args[args.indexOf("--outdir") + 1];
        void (async () => {
          await writeFile(
            pathModule.join(outdir, "confirmation.pdf"),
            Buffer.from("<html>bad</html>")
          );
          callback(null, "", "");
        })();
      }
    );

    await expect(
      new DocumentConversionService().convertOfficeBufferToPdf({
        fileName: "confirmation.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        body: Buffer.from("docx"),
      })
    ).rejects.toThrow("Office document conversion returned an invalid PDF");
  });
});
