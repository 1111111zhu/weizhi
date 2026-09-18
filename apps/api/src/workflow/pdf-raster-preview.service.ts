import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";
import { promisify } from "node:util";

import {
  Injectable,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";

import { ApiBadRequestException } from "../common/api-error";
import { StorageService } from "../storage/storage.service";
import type { DownloadObject } from "../storage/storage.service";
import { DocumentConversionService } from "./document-conversion.service";
import type { PreviewableAttachment } from "./document-conversion.service";

const execFileAsync = promisify(execFileCallback);
const DEFAULT_RASTER_DPI = 150;
const MAX_RASTER_DPI = 220;
const MIN_RASTER_DPI = 72;
const PDFINFO_TIMEOUT_MS = 10_000;
const PDFTOPPM_TIMEOUT_MS = 30_000;
const RASTER_MIME_TYPE = "image/png" as const;
const DEFAULT_MAX_SOURCE_BYTES = 128 * 1024 * 1024;
const DEFAULT_MAX_PAGES = 500;
const DEFAULT_MAX_PAGE_PIXELS = 40_000_000;
const DEFAULT_MAX_PAGE_BYTES = 32 * 1024 * 1024;
const MAX_CONCURRENT_ON_DEMAND_RENDERS = 4;
const RASTER_DPI_LEVELS = [72, 100, 150, 200, 220] as const;

export type PdfRasterPreviewManifest = {
  attachmentId: string;
  version: number;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  dpi: number;
  mimeType: typeof RASTER_MIME_TYPE;
};

export type PdfRasterPreviewPageInput = {
  pageNumber: number;
  dpi?: number;
};

type ExecuteFileOptions = {
  timeout: number;
};

type ExecuteFileResult = {
  stdout: string;
  stderr: string;
};

@Injectable()
export class PdfRasterPreviewService {
  private readonly activePageRenders = new Map<
    string,
    Promise<DownloadObject>
  >();

  constructor(
    @Optional() private readonly storage?: StorageService,
    @Optional() private readonly documentConversion?: DocumentConversionService
  ) {}

  async clearAttachmentPreviewCache(
    attachment: Pick<PreviewableAttachment, "id"> & {
      projectId?: string | null;
    }
  ) {
    await Promise.all([
      this.fileStorage().deleteCachePrefix(
        pathModule.posix.join(
          "document-raster-previews",
          attachment.projectId?.trim() || "unknown-project",
          attachment.id
        )
      ),
      this.documentPreview().clearAttachmentPreviewCache(attachment.id),
    ]);
  }

  async getAttachmentRasterPreviewManifest(
    attachment: PreviewableAttachment
  ): Promise<PdfRasterPreviewManifest> {
    const cached = await this.getCachedManifest(attachment);
    if (cached) {
      return cached;
    }
    assertRasterSourceSize(attachment.fileSize);

    const tempDir = await mkdtemp(
      pathModule.join(tmpdir(), "project-wing-pdf-preview-")
    );
    try {
      const sourcePath = await this.getSourcePdfPath(attachment, tempDir);
      const metadata = await this.readPdfMetadata(sourcePath);
      const manifest = {
        attachmentId: attachment.id,
        version: attachment.version,
        pageCount: metadata.pageCount,
        pageWidth: metadata.pageWidth,
        pageHeight: metadata.pageHeight,
        dpi: DEFAULT_RASTER_DPI,
        mimeType: RASTER_MIME_TYPE,
      };
      await this.putManifest(attachment, manifest);
      return manifest;
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  }

  readCachedAttachmentRasterPreviewManifest(attachment: PreviewableAttachment) {
    return this.getCachedManifest(attachment);
  }

  async warmAttachmentRasterPreview(
    attachment: PreviewableAttachment
  ): Promise<PdfRasterPreviewManifest> {
    const cachedManifest = await this.getCachedManifest(attachment);
    if (cachedManifest) {
      const allPagesCached = await this.hasAllCachedPages(
        attachment,
        cachedManifest
      );
      if (allPagesCached) {
        return cachedManifest;
      }
    }
    assertRasterSourceSize(attachment.fileSize);

    const tempDir = await mkdtemp(
      pathModule.join(tmpdir(), "project-wing-pdf-preview-")
    );
    try {
      const sourcePath = await this.getSourcePdfPath(attachment, tempDir);
      const metadata = await this.readPdfMetadata(sourcePath);
      const manifest: PdfRasterPreviewManifest = {
        attachmentId: attachment.id,
        version: attachment.version,
        pageCount: metadata.pageCount,
        pageWidth: metadata.pageWidth,
        pageHeight: metadata.pageHeight,
        dpi: DEFAULT_RASTER_DPI,
        mimeType: RASTER_MIME_TYPE,
      };

      const warmPage = async (pageNumber: number) => {
        const objectKey = buildPdfRasterPreviewPageObjectKey(attachment, {
          pageNumber,
          dpi: manifest.dpi,
        });
        if (await this.getCachedPage(objectKey, pageNumber)) {
          return;
        }
        const outputPrefix = pathModule.join(tempDir, `page-${pageNumber}`);
        const outputPath = `${outputPrefix}.png`;
        await this.executePdfToPng(
          sourcePath,
          outputPrefix,
          pageNumber,
          manifest.dpi
        );
        await this.fileStorage().putCacheObject(
          objectKey,
          await readRasterPage(outputPath),
          RASTER_MIME_TYPE
        );
      };

      // Publish an atomic first-screen artifact before warming the remaining
      // pages. Readers only see the manifest once page one is available.
      await warmPage(1);
      await this.putManifest(attachment, manifest);
      for (
        let pageNumber = 2;
        pageNumber <= manifest.pageCount;
        pageNumber += 1
      ) {
        await warmPage(pageNumber);
      }

      return manifest;
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  }

  async getAttachmentRasterPreviewPage(
    attachment: PreviewableAttachment,
    input: PdfRasterPreviewPageInput
  ): Promise<DownloadObject> {
    const pageNumber = parsePositiveInteger(input.pageNumber);
    const dpi = normalizeDpi(input.dpi);
    if (!pageNumber) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "PDF preview page is invalid"
      );
    }

    const objectKey = buildPdfRasterPreviewPageObjectKey(attachment, {
      pageNumber,
      dpi,
    });
    const cached = await this.getCachedPage(objectKey, pageNumber);
    if (cached) {
      return cached;
    }

    const activeRender = this.activePageRenders.get(objectKey);
    if (activeRender) {
      return activeRender;
    }
    if (this.activePageRenders.size >= MAX_CONCURRENT_ON_DEMAND_RENDERS) {
      throw new ServiceUnavailableException({
        code: "PREVIEW_BUSY",
        message: "Preview renderer is busy. Please retry shortly.",
      });
    }

    const render = this.renderAttachmentRasterPreviewPage(
      attachment,
      objectKey,
      pageNumber,
      dpi
    );
    this.activePageRenders.set(objectKey, render);
    try {
      return await render;
    } finally {
      if (this.activePageRenders.get(objectKey) === render) {
        this.activePageRenders.delete(objectKey);
      }
    }
  }

  private async renderAttachmentRasterPreviewPage(
    attachment: PreviewableAttachment,
    objectKey: string,
    pageNumber: number,
    dpi: number
  ): Promise<DownloadObject> {
    const tempDir = await mkdtemp(
      pathModule.join(tmpdir(), "project-wing-pdf-preview-")
    );
    try {
      assertRasterSourceSize(attachment.fileSize);
      const sourcePath = await this.getSourcePdfPath(attachment, tempDir);
      const metadata = await this.readPdfMetadata(sourcePath);
      if (pageNumber > metadata.pageCount) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "PDF preview page is outside the document"
        );
      }
      assertPagePixelLimit(metadata.pageWidth, metadata.pageHeight, dpi);
      const outputPrefix = pathModule.join(tempDir, "page");
      const outputPath = `${outputPrefix}.png`;
      await this.executePdfToPng(sourcePath, outputPrefix, pageNumber, dpi);
      const image = await readRasterPage(outputPath);
      await this.fileStorage().putCacheObject(
        objectKey,
        image,
        RASTER_MIME_TYPE
      );
      return this.pageBufferDownloadObject(image, pageNumber);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  }

  async readCachedAttachmentRasterPreviewPage(
    attachment: PreviewableAttachment,
    input: PdfRasterPreviewPageInput
  ) {
    await Promise.resolve();
    const pageNumber = parsePositiveInteger(input.pageNumber);
    if (!pageNumber) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "PDF preview page is invalid"
      );
    }
    return this.getCachedPage(
      buildPdfRasterPreviewPageObjectKey(attachment, {
        pageNumber,
        dpi: normalizeDpi(input.dpi),
      }),
      pageNumber
    );
  }

  protected async executeFile(
    file: string,
    args: string[],
    options: ExecuteFileOptions
  ): Promise<ExecuteFileResult> {
    const result = await execFileAsync(file, args, options);
    return {
      stdout: String(result.stdout ?? ""),
      stderr: String(result.stderr ?? ""),
    };
  }

  private async getSourcePdfPath(
    attachment: PreviewableAttachment,
    tempDir: string
  ) {
    const previewPdf =
      await this.documentPreview().getAttachmentPreviewPdf(attachment);
    if (previewPdf.absolutePath) {
      return previewPdf.absolutePath;
    }

    const sourceBuffer =
      previewPdf.body ??
      (await this.fileStorage().getObjectBuffer(attachment.fileUrl));
    const fileName = pathModule.basename(
      previewPdf.fileName || attachment.fileName
    );
    const sourcePath = pathModule.join(tempDir, fileName || "preview.pdf");
    await writeFile(sourcePath, sourceBuffer);
    return sourcePath;
  }

  private async readPdfMetadata(sourcePath: string) {
    const result = await this.executeFile(getPdfInfoBinary(), [sourcePath], {
      timeout: PDFINFO_TIMEOUT_MS,
    }).catch((error: unknown) => {
      throw createPopplerError(error, "PDF page count failed");
    });
    const match = result.stdout.match(/^Pages:\s*(\d+)\s*$/m);
    const pageCount = match ? Math.trunc(Number(match[1])) : 0;
    if (!Number.isFinite(pageCount) || pageCount <= 0) {
      throw new ServiceUnavailableException({
        code: "BAD_REQUEST",
        message: "PDF page count failed",
      });
    }
    const pageSize = parsePageSize(result.stdout);
    const maxPages = configuredPositiveInteger(
      "PREVIEW_PDF_MAX_PAGES",
      DEFAULT_MAX_PAGES
    );
    if (pageCount > maxPages) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        `PDF preview exceeds the ${maxPages}-page safety limit`
      );
    }
    const pageWidth = pageSize?.width ?? 612;
    const pageHeight = pageSize?.height ?? 792;
    assertPagePixelLimit(pageWidth, pageHeight, DEFAULT_RASTER_DPI);
    return {
      pageCount,
      pageWidth,
      pageHeight,
    };
  }

  private async executePdfToPng(
    sourcePath: string,
    outputPrefix: string,
    pageNumber: number,
    dpi: number
  ) {
    await this.executeFile(
      getPdfToPpmBinary(),
      [
        "-f",
        String(pageNumber),
        "-l",
        String(pageNumber),
        "-r",
        String(dpi),
        "-png",
        "-singlefile",
        sourcePath,
        outputPrefix,
      ],
      { timeout: PDFTOPPM_TIMEOUT_MS }
    ).catch((error: unknown) => {
      throw createPopplerError(error, "PDF page render failed");
    });
  }

  private async getCachedPage(objectKey: string, pageNumber: number) {
    const storage = this.fileStorage();
    try {
      const image = await storage.getObjectBuffer(objectKey);
      return this.pageBufferDownloadObject(image, pageNumber);
    } catch {
      return null;
    }
  }

  private async getCachedManifest(attachment: PreviewableAttachment) {
    try {
      const raw = await this.fileStorage().getObjectBuffer(
        buildPdfRasterPreviewManifestObjectKey(attachment)
      );
      const parsed = JSON.parse(
        raw.toString("utf-8")
      ) as PdfRasterPreviewManifest;
      const contentAddressed = Boolean(
        attachment.previewCacheKey?.trim() || attachment.contentHash?.trim()
      );
      if (
        parsed.attachmentId !== attachment.id ||
        (!contentAddressed && parsed.version !== attachment.version) ||
        !Number.isInteger(parsed.pageCount) ||
        parsed.pageCount <= 0
      ) {
        return null;
      }
      return parsed.version === attachment.version
        ? parsed
        : { ...parsed, version: attachment.version };
    } catch {
      return null;
    }
  }

  private putManifest(
    attachment: PreviewableAttachment,
    manifest: PdfRasterPreviewManifest
  ) {
    return this.fileStorage().putCacheObject(
      buildPdfRasterPreviewManifestObjectKey(attachment),
      Buffer.from(JSON.stringify(manifest)),
      "application/json"
    );
  }

  private async hasAllCachedPages(
    attachment: PreviewableAttachment,
    manifest: PdfRasterPreviewManifest
  ) {
    for (
      let pageNumber = 1;
      pageNumber <= manifest.pageCount;
      pageNumber += 1
    ) {
      const objectKey = buildPdfRasterPreviewPageObjectKey(attachment, {
        pageNumber,
        dpi: manifest.dpi,
      });
      try {
        await this.fileStorage().getObjectMetadata(objectKey);
      } catch {
        return false;
      }
    }
    return true;
  }

  private pageBufferDownloadObject(body: Buffer, pageNumber: number) {
    return {
      body,
      fileName: `page-${pageNumber}.png`,
      mimeType: RASTER_MIME_TYPE,
    };
  }

  private fileStorage() {
    return this.storage ?? new StorageService();
  }

  private documentPreview() {
    return (
      this.documentConversion ??
      new DocumentConversionService(this.fileStorage())
    );
  }
}

export function buildPdfRasterPreviewPageObjectKey(
  attachment: Pick<PreviewableAttachment, "id" | "version"> & {
    projectId?: string | null;
    previewCacheKey?: string | null;
    contentHash?: string | null;
  },
  input: { pageNumber: number; dpi: number }
) {
  const projectId = attachment.projectId?.trim() || "unknown-project";
  const versionSegment =
    attachment.previewCacheKey?.trim() ||
    attachment.contentHash?.trim().toLowerCase() ||
    `v${attachment.version}`;
  return pathModule.posix.join(
    "document-raster-previews",
    projectId,
    attachment.id,
    versionSegment,
    `dpi-${input.dpi}`,
    `page-${input.pageNumber}.png`
  );
}

export function buildPdfRasterPreviewManifestObjectKey(
  attachment: Pick<PreviewableAttachment, "id" | "version"> & {
    projectId?: string | null;
    previewCacheKey?: string | null;
    contentHash?: string | null;
  }
) {
  const projectId = attachment.projectId?.trim() || "unknown-project";
  const versionSegment =
    attachment.previewCacheKey?.trim() ||
    attachment.contentHash?.trim().toLowerCase() ||
    `v${attachment.version}`;
  return pathModule.posix.join(
    "document-raster-previews",
    projectId,
    attachment.id,
    versionSegment,
    "metadata.json"
  );
}

function normalizeDpi(value?: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_RASTER_DPI;
  }
  const requested = Math.min(
    MAX_RASTER_DPI,
    Math.max(MIN_RASTER_DPI, Math.trunc(value as number))
  );
  return RASTER_DPI_LEVELS.reduce((closest, candidate) =>
    Math.abs(candidate - requested) < Math.abs(closest - requested)
      ? candidate
      : closest
  );
}

function parsePositiveInteger(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const parsed = Math.trunc(value);
  return parsed > 0 ? parsed : null;
}

function parsePageSize(value: string) {
  const match = value.match(/^Page size:\s*([\d.]+)\s+x\s+([\d.]+)\s+pts\b/m);
  if (!match) {
    return null;
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function getPdfInfoBinary() {
  return process.env.PDF_RENDERER_PDFINFO_PATH?.trim() || "pdfinfo";
}

function getPdfToPpmBinary() {
  return process.env.PDF_RENDERER_PDFTOPPM_PATH?.trim() || "pdftoppm";
}

async function readRasterPage(outputPath: string) {
  const metadata = await stat(outputPath);
  const maxBytes = configuredPositiveInteger(
    "PREVIEW_PDF_MAX_PAGE_BYTES",
    DEFAULT_MAX_PAGE_BYTES
  );
  if (metadata.size > maxBytes) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Rendered PDF preview page exceeds the configured safety limit"
    );
  }
  return readFile(outputPath);
}

function assertRasterSourceSize(fileSize?: number | null) {
  const maxBytes = configuredPositiveInteger(
    "PREVIEW_PDF_MAX_SOURCE_BYTES",
    DEFAULT_MAX_SOURCE_BYTES
  );
  if (typeof fileSize === "number" && fileSize > maxBytes) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Document exceeds the configured raster preview size limit"
    );
  }
}

function assertPagePixelLimit(width: number, height: number, dpi: number) {
  const pixels = (width / 72) * dpi * ((height / 72) * dpi);
  const maxPagePixels = configuredPositiveInteger(
    "PREVIEW_PDF_MAX_PAGE_PIXELS",
    DEFAULT_MAX_PAGE_PIXELS
  );
  if (pixels > maxPagePixels) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "PDF preview page dimensions exceed the configured safety limit"
    );
  }
}

function configuredPositiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function createPopplerError(error: unknown, message: string) {
  const detail =
    error instanceof Error && error.message ? `: ${error.message}` : "";
  return new ServiceUnavailableException({
    code: "BAD_REQUEST",
    message: `${message}${detail}`,
  });
}
