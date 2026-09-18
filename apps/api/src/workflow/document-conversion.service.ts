import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";
import { promisify } from "node:util";

import {
  Injectable,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

import { ApiBadRequestException } from "../common/api-error";
import { StorageService } from "../storage/storage.service";

const { basename, join, parse } = pathModule;

const execFileAsync = promisify(execFile);
const DEFAULT_DOCUMENT_CONVERSION_CACHE_VERSION = "gotenberg-fonts-v1";
const DEFAULT_DOCUMENT_CONVERSION_TIMEOUT_MS = 120_000;
const PDF_TO_DOCX_RASTER_DPI = 150;
const PDF_TO_DOCX_PAGE_TIMEOUT_MS = 30_000;
const EMU_PER_POINT = 12_700;
const TWIPS_PER_POINT = 20;
const WINDOWS_WORD_CONVERSION_SCRIPT = `param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath
)
$word = $null
$document = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $document = $word.Documents.Open($InputPath, $false, $true)
  $document.ExportAsFixedFormat($OutputPath, 17)
} finally {
  if ($null -ne $document) {
    try { $document.Close($false) } catch {}
    try {
      [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document)
    } catch {}
  }
  if ($null -ne $word) {
    try { $word.Quit() } catch {}
    try {
      [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word)
    } catch {}
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
if (-not (Test-Path -LiteralPath $OutputPath)) {
  throw "Microsoft Word did not produce a PDF file"
}
`;
const WINDOWS_WORD_PDF_TO_DOCX_SCRIPT = `param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath
)
$word = $null
$document = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $document = $word.Documents.Open($InputPath, $false, $true)
  $document.SaveAs2($OutputPath, 16)
} finally {
  if ($null -ne $document) {
    try { $document.Close($false) } catch {}
    try {
      [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document)
    } catch {}
  }
  if ($null -ne $word) {
    try { $word.Quit() } catch {}
    try {
      [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word)
    } catch {}
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
if (-not (Test-Path -LiteralPath $OutputPath)) {
  throw "Microsoft Word did not produce a DOCX file"
}
`;

export type PreviewableAttachment = {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
  originalName?: string | null;
  mimeType: string;
  version: number;
  previewCacheKey?: string | null;
  contentHash?: string | null;
};

export type DocumentPreviewPdf = {
  absolutePath?: string;
  redirectUrl?: string;
  body?: Buffer;
  fileName: string;
  mimeType: "application/pdf";
};

export type OfficeBufferInput = {
  fileName: string;
  mimeType: string;
  body: Buffer;
  preserveLayout?: boolean;
};

@Injectable()
export class DocumentConversionService {
  constructor(@Optional() private readonly storage?: StorageService) {}

  async getAttachmentPreviewPdf(
    attachment: PreviewableAttachment
  ): Promise<DocumentPreviewPdf> {
    if (isPdfAttachment(attachment)) {
      const storage = this.fileStorage();
      const download = storage.getDownloadObject(
        attachment.fileUrl,
        normalizePdfFileName(attachment.originalName ?? attachment.fileName),
        "application/pdf"
      );
      // Preview bytes may be cached by document version. A short-lived OSS
      // redirect must never become the cached representation of that version.
      return download.redirectUrl
        ? {
            body: await storage.getObjectBuffer(attachment.fileUrl),
            fileName: download.fileName,
            mimeType: "application/pdf",
          }
        : (download as DocumentPreviewPdf);
    }
    if (!isConvertibleOfficeAttachment(attachment)) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "该文件类型暂不支持文档预览"
      );
    }

    const storage = this.fileStorage();
    const objectKey = getPreviewPdfObjectKey(attachment);
    let pdf = await storage.getCacheObjectBuffer(objectKey);
    if (!pdf) {
      pdf = await this.convertWithGotenberg(attachment);
      await storage.putCacheObject(objectKey, pdf, "application/pdf");
    }
    const fileName = `${parsePreviewName(attachment)}.pdf`;
    const download = storage.getDownloadObject(
      objectKey,
      fileName,
      "application/pdf"
    );
    // Raster workers need the converted PDF bytes, not the original Office file.
    // OSS-backed previews must not write an intermediate cache to UPLOAD_DIR.
    return {
      ...(download.absolutePath
        ? { absolutePath: download.absolutePath }
        : { body: pdf }),
      fileName,
      mimeType: "application/pdf",
    };
  }

  async convertOfficeBufferToPdf(input: OfficeBufferInput): Promise<Buffer> {
    const attachment = {
      fileName: input.fileName,
      originalName: input.fileName,
      mimeType: input.mimeType,
    };
    if (!isConvertibleOfficeAttachment(attachment)) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "该文件类型暂不支持转换为 PDF"
      );
    }

    const gotenbergUrl = process.env.GOTENBERG_URL?.trim();
    if (!gotenbergUrl && !shouldUseLocalLibreOfficeFallback()) {
      throw new ServiceUnavailableException({
        code: "BAD_REQUEST",
        message: "Office 文档预览服务未配置",
      });
    }
    if (!gotenbergUrl) {
      return convertWithLocalLibreOffice(attachment, input.body);
    }

    const formData = new FormData();
    formData.set(
      "files",
      new Blob([new Uint8Array(input.body)], { type: input.mimeType }),
      pathModule.basename(input.fileName)
    );

    try {
      const response = await fetch(
        `${gotenbergUrl.replace(/\/+$/, "")}/forms/libreoffice/convert`,
        {
          method: "POST",
          body: formData,
          headers: { "Gotenberg-Trace": randomUUID() },
          signal: documentConversionSignal(),
        }
      );
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new ServiceUnavailableException({
          code: "BAD_REQUEST",
          message: body
            ? `Office 文档转 PDF 失败：${body}`
            : `Office 文档转 PDF 失败：${response.status}`,
        });
      }
      const output = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers?.get?.("content-type") ?? undefined;
      assertValidPdfOutput(output, contentType);
      return output;
    } catch (error) {
      if (!shouldUseLocalLibreOfficeFallback()) {
        throw error;
      }
      return convertWithLocalLibreOffice(attachment, input.body);
    }
  }

  async convertPdfBufferToDocx(input: OfficeBufferInput): Promise<Buffer> {
    if (!isPdfAttachment(input)) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "该文件类型暂不支持转换为 Word"
      );
    }

    if (input.preserveLayout) {
      return convertPdfBufferToVisualDocx(input);
    }

    const gotenbergUrl = process.env.GOTENBERG_URL?.trim();
    if (!gotenbergUrl && !shouldUseLocalLibreOfficeFallback()) {
      throw new ServiceUnavailableException({
        code: "BAD_REQUEST",
        message: "文档转换服务未配置",
      });
    }
    if (!gotenbergUrl) {
      return convertWithLocalLibreOfficeToDocx(input, input.body);
    }

    const formData = new FormData();
    formData.set(
      "files",
      new Blob([new Uint8Array(input.body)], { type: "application/pdf" }),
      basename(input.fileName)
    );

    try {
      const response = await fetch(
        `${gotenbergUrl.replace(/\/+$/, "")}/forms/libreoffice/convert?convert-to=docx`,
        {
          method: "POST",
          body: formData,
          headers: { "Gotenberg-Trace": randomUUID() },
          signal: documentConversionSignal(),
        }
      );
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new ServiceUnavailableException({
          code: "BAD_REQUEST",
          message: body
            ? `PDF 转 Word 失败：${body}`
            : `PDF 转 Word 失败：${response.status}`,
        });
      }
      const output = Buffer.from(await response.arrayBuffer());
      assertValidDocxOutput(output);
      return output;
    } catch (error) {
      if (!shouldUseLocalLibreOfficeFallback()) {
        throw error;
      }
      return convertWithLocalLibreOfficeToDocx(input, input.body);
    }
  }

  async clearAttachmentPreviewCache(attachmentId: string) {
    await this.fileStorage().deleteCachePrefix(
      pathModule.posix.join("document-previews", attachmentId)
    );
  }

  private async convertWithGotenberg(attachment: PreviewableAttachment) {
    const sourceFile = await this.fileStorage().getObjectBuffer(
      attachment.fileUrl
    );
    return this.convertOfficeBufferToPdf({
      fileName: attachment.originalName ?? attachment.fileName,
      mimeType: attachment.mimeType,
      body: sourceFile,
    });
  }

  private fileStorage() {
    return this.storage ?? new StorageService();
  }
}

function getPreviewPdfObjectKey(attachment: PreviewableAttachment) {
  return pathModule.posix.join(
    "document-previews",
    attachment.id,
    `v${attachment.version}-${getDocumentConversionCacheVersion()}.pdf`
  );
}

function getDocumentConversionCacheVersion() {
  const configuredVersion =
    process.env.DOCUMENT_CONVERSION_CACHE_VERSION?.trim() ||
    DEFAULT_DOCUMENT_CONVERSION_CACHE_VERSION;
  return configuredVersion.replaceAll(/[^a-zA-Z0-9._-]/g, "-");
}

function documentConversionSignal() {
  const configuredTimeout = Number(process.env.DOCUMENT_CONVERSION_TIMEOUT_MS);
  const timeoutMs =
    Number.isSafeInteger(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : DEFAULT_DOCUMENT_CONVERSION_TIMEOUT_MS;
  return AbortSignal.timeout(timeoutMs);
}

function shouldUseLocalLibreOfficeFallback() {
  return (
    process.env.PROJECTWING_ENVIRONMENT?.trim().toLowerCase() !== "production"
  );
}

async function convertWithLocalLibreOffice(
  attachment: Pick<PreviewableAttachment, "fileName" | "originalName">,
  sourceFile: Buffer
) {
  const tempDir = await mkdtemp(
    pathModule.join(tmpdir(), "project-wing-libreoffice-")
  );
  try {
    const inputFileName =
      pathModule.basename(attachment.originalName ?? attachment.fileName) ||
      "document.docx";
    const inputPath = pathModule.join(tempDir, inputFileName);
    const outputPath = pathModule.join(
      tempDir,
      `${pathModule.parse(inputFileName).name}.pdf`
    );
    await writeFile(inputPath, sourceFile);

    let lastError: unknown;
    for (const command of getLibreOfficeCommands()) {
      try {
        await execFileAsync(command, [
          "--headless",
          "--convert-to",
          "pdf",
          "--outdir",
          tempDir,
          inputPath,
        ]);
        if (existsSync(outputPath)) {
          const output = await readFile(outputPath);
          assertValidPdfOutput(output);
          return output;
        }
        lastError = new Error("LibreOffice did not produce a PDF file");
      } catch (error) {
        lastError = error;
      }
    }

    if (shouldUseWindowsWordComFallback()) {
      try {
        const scriptPath = pathModule.join(tempDir, "convert-with-word.ps1");
        await writeFile(scriptPath, WINDOWS_WORD_CONVERSION_SCRIPT, "utf-8");
        await execFileAsync(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            scriptPath,
            "-InputPath",
            inputPath,
            "-OutputPath",
            outputPath,
          ],
          { timeout: 120_000, windowsHide: true }
        );
        if (existsSync(outputPath)) {
          const output = await readFile(outputPath);
          assertValidPdfOutput(output);
          return output;
        }
        lastError = new Error("Microsoft Word did not produce a PDF file");
      } catch (error) {
        lastError = error;
      }
    }

    throw new ServiceUnavailableException({
      code: "BAD_REQUEST",
      message:
        lastError instanceof Error
          ? `Office 文档本地转 PDF 失败：${lastError.message}`
          : "Office 文档本地转 PDF 失败",
    });
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function convertWithLocalLibreOfficeToDocx(
  input: OfficeBufferInput,
  sourceFile: Buffer
) {
  const tempDir = await mkdtemp(join(tmpdir(), "project-wing-pdf-to-docx-"));
  try {
    const inputFileName = basename(input.fileName) || "document.pdf";
    const inputPath = join(tempDir, inputFileName);
    const outputPath = join(tempDir, `${parse(inputFileName).name}.docx`);
    await writeFile(inputPath, sourceFile);

    let lastError: unknown;
    for (const command of getLibreOfficeCommands()) {
      try {
        await execFileAsync(command, [
          "--headless",
          "--convert-to",
          "docx",
          "--outdir",
          tempDir,
          inputPath,
        ]);
        if (existsSync(outputPath)) {
          const output = await readFile(outputPath);
          assertValidDocxOutput(output);
          return output;
        }
        lastError = new Error("LibreOffice did not produce a DOCX file");
      } catch (error) {
        lastError = error;
      }
    }

    if (shouldUseWindowsWordComFallback()) {
      try {
        const scriptPath = join(tempDir, "convert-pdf-with-word.ps1");
        await writeFile(scriptPath, WINDOWS_WORD_PDF_TO_DOCX_SCRIPT, "utf-8");
        await execFileAsync(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            scriptPath,
            "-InputPath",
            inputPath,
            "-OutputPath",
            outputPath,
          ],
          { timeout: 120_000, windowsHide: true }
        );
        if (existsSync(outputPath)) {
          const output = await readFile(outputPath);
          assertValidDocxOutput(output);
          return output;
        }
        lastError = new Error("Microsoft Word did not produce a DOCX file");
      } catch (error) {
        lastError = error;
      }
    }

    throw new ServiceUnavailableException({
      code: "BAD_REQUEST",
      message:
        lastError instanceof Error
          ? `PDF 本地转 Word 失败：${lastError.message}`
          : "PDF 本地转 Word 失败",
    });
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

type VisualDocxPage = {
  body: Buffer;
  fileName: string;
  width: number;
  height: number;
};

async function convertPdfBufferToVisualDocx(input: OfficeBufferInput) {
  const tempDir = await mkdtemp(
    join(tmpdir(), "project-wing-pdf-visual-docx-")
  );
  try {
    const document = await PDFDocument.load(input.body);
    const pages = document.getPages();
    if (pages.length === 0) {
      throw new Error("PDF does not contain any pages");
    }

    const inputPath = join(tempDir, normalizePdfInputFileName(input.fileName));
    await writeFile(inputPath, input.body);

    const renderedPages: VisualDocxPage[] = [];
    for (let index = 0; index < pages.length; index += 1) {
      const pageNumber = index + 1;
      const outputPrefix = join(tempDir, `page-${pageNumber}`);
      try {
        await execFileAsync(
          getPdfToPpmBinary(),
          [
            "-f",
            String(pageNumber),
            "-l",
            String(pageNumber),
            "-r",
            String(PDF_TO_DOCX_RASTER_DPI),
            "-png",
            "-singlefile",
            inputPath,
            outputPrefix,
          ],
          { timeout: PDF_TO_DOCX_PAGE_TIMEOUT_MS }
        );
      } catch (error) {
        throw new Error(
          `PDF page ${pageNumber} rasterization failed: ${errorMessage(error)}`,
          { cause: error }
        );
      }

      const imagePath = `${outputPrefix}.png`;
      if (!existsSync(imagePath)) {
        throw new Error(
          `PDF page ${pageNumber} rasterization produced no image`
        );
      }

      const rotation = pages[index].getRotation().angle;
      const quarterTurn = Math.abs(rotation % 180) === 90;
      renderedPages.push({
        body: await readFile(imagePath),
        fileName: `page-${pageNumber}.png`,
        width: quarterTurn ? pages[index].getHeight() : pages[index].getWidth(),
        height: quarterTurn
          ? pages[index].getWidth()
          : pages[index].getHeight(),
      });
    }

    return buildVisualDocx(renderedPages);
  } catch (error) {
    if (error instanceof ServiceUnavailableException) {
      throw error;
    }
    throw new ServiceUnavailableException({
      code: "BAD_REQUEST",
      message: `PDF 转 Word 排版保真失败：${errorMessage(error)}`,
    });
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function buildVisualDocx(pages: VisualDocxPage[]) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", buildVisualDocxContentTypes());
  zip.file("_rels/.rels", buildVisualDocxRootRelationships());
  zip.file("word/document.xml", buildVisualDocxDocumentXml(pages));
  zip.file(
    "word/_rels/document.xml.rels",
    buildVisualDocxDocumentRelationships(pages)
  );
  zip.file("word/styles.xml", buildVisualDocxStyles());
  for (const page of pages) {
    zip.file(`word/media/${page.fileName}`, page.body);
  }
  return await zip.generateAsync({ type: "nodebuffer" });
}

function buildVisualDocxContentTypes() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function buildVisualDocxRootRelationships() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function buildVisualDocxDocumentRelationships(pages: VisualDocxPage[]) {
  const imageRelationships = pages
    .map(
      (page, index) =>
        `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${page.fileName}"/>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  ${imageRelationships}
</Relationships>`;
}

function buildVisualDocxStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:sz w:val="20"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>`;
}

function buildVisualDocxDocumentXml(pages: VisualDocxPage[]) {
  const pageParagraphs = pages
    .map((page, index) => {
      const cx = pointsToEmu(page.width);
      const cy = pointsToEmu(page.height);
      const imageRelationshipId = `rId${index + 2}`;
      const sectionBreak =
        index < pages.length - 1
          ? buildVisualDocxSectionProperties(page, "nextPage")
          : "";
      return `<w:p>
  <w:pPr>
    <w:spacing w:before="0" w:after="0"/>
    ${sectionBreak}
  </w:pPr>
  <w:r>
    <w:drawing>
      <wp:anchor xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">
        <wp:simplePos x="0" y="0"/>
        <wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>
        <wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV>
        <wp:extent cx="${cx}" cy="${cy}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:wrapNone/>
        <wp:docPr id="${index + 1}" name="Page ${index + 1}"/>
        <wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic>
              <pic:nvPicPr><pic:cNvPr id="${index + 1}" name="${page.fileName}"/><pic:cNvPicPr/></pic:nvPicPr>
              <pic:blipFill><a:blip r:embed="${imageRelationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
              <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"/></pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:anchor>
    </w:drawing>
  </w:r>
</w:p>`;
    })
    .join("");
  const lastPage = pages[pages.length - 1];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mo="http://schemas.microsoft.com/office/mac/office/2008/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:mv="urn:schemas-microsoft-com:mac:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">
  <w:body>
    ${pageParagraphs}
    ${buildVisualDocxSectionProperties(lastPage)}
  </w:body>
</w:document>`;
}

function buildVisualDocxSectionProperties(
  page: VisualDocxPage,
  sectionType?: "nextPage"
) {
  const orientation = page.width > page.height ? ' w:orient="landscape"' : "";
  return `<w:sectPr>${sectionType ? `<w:type w:val="${sectionType}"/>` : ""}<w:pgSz w:w="${pointsToTwips(page.width)}" w:h="${pointsToTwips(page.height)}"${orientation}/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="0"/></w:sectPr>`;
}

function pointsToEmu(points: number) {
  return Math.max(1, Math.round(points * EMU_PER_POINT));
}

function pointsToTwips(points: number) {
  return Math.max(1, Math.round(points * TWIPS_PER_POINT));
}

function normalizePdfInputFileName(fileName: string) {
  const safeName = basename(fileName) || "confirmation.pdf";
  return `${parse(safeName).name || "confirmation"}.pdf`;
}

function getPdfToPpmBinary() {
  return process.env.PDF_RENDERER_PDFTOPPM_PATH?.trim() || "pdftoppm";
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "unknown conversion error";
}

function assertValidPdfOutput(body: Buffer, contentType?: string) {
  const normalizedContentType = contentType
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (
    (normalizedContentType && normalizedContentType !== "application/pdf") ||
    body.byteLength < 5 ||
    body.subarray(0, 5).toString("ascii") !== "%PDF-"
  ) {
    throw new ServiceUnavailableException({
      code: "BAD_REQUEST",
      message: "Office document conversion returned an invalid PDF",
    });
  }
}

function assertValidDocxOutput(body: Buffer) {
  if (
    body.byteLength < 4 ||
    body.subarray(0, 4).toString("binary") !== "PK\u0003\u0004"
  ) {
    throw new ServiceUnavailableException({
      code: "BAD_REQUEST",
      message: "PDF 转 Word 返回了无效的 DOCX 文件",
    });
  }
}

function getLibreOfficeCommands() {
  return [
    process.env.LIBREOFFICE_PATH?.trim(),
    "soffice",
    "libreoffice",
    String.raw`C:\Program Files\LibreOffice\program\soffice.exe`,
    String.raw`C:\Program Files (x86)\LibreOffice\program\soffice.exe`,
  ].filter(Boolean) as string[];
}

function shouldUseWindowsWordComFallback() {
  const configured =
    process.env.PROJECTWING_ENABLE_WORD_COM_FALLBACK?.trim().toLowerCase();
  if (configured === "true") {
    return true;
  }
  if (configured === "false") {
    return false;
  }
  return process.platform === "win32";
}

function parsePreviewName(attachment: PreviewableAttachment) {
  const displayName = attachment.originalName ?? attachment.fileName;
  return pathModule.parse(displayName).name || "document-preview";
}

function normalizePdfFileName(fileName: string) {
  return pathModule.extname(fileName).toLowerCase() === ".pdf"
    ? fileName
    : `${pathModule.parse(fileName).name || "document-preview"}.pdf`;
}

export function isPdfAttachment<
  T extends Pick<
    PreviewableAttachment,
    "fileName" | "originalName" | "mimeType"
  >,
>(attachment: T) {
  return (
    attachment.mimeType.toLowerCase() === "application/pdf" ||
    attachment.fileName.toLowerCase().endsWith(".pdf") ||
    (attachment.originalName ?? "").toLowerCase().endsWith(".pdf")
  );
}

export function isConvertibleOfficeAttachment(
  attachment: Pick<
    PreviewableAttachment,
    "fileName" | "originalName" | "mimeType"
  >
) {
  return (
    isWordAttachment(attachment) ||
    isPowerPointAttachment(attachment) ||
    isSpreadsheetAttachment(attachment)
  );
}

function isWordAttachment(
  attachment: Pick<
    PreviewableAttachment,
    "fileName" | "originalName" | "mimeType"
  >
) {
  const mimeType = attachment.mimeType.toLowerCase();
  const fileName =
    `${attachment.originalName ?? attachment.fileName}`.toLowerCase();
  return (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    fileName.endsWith(".docx") ||
    fileName.endsWith(".doc")
  );
}

function isPowerPointAttachment(
  attachment: Pick<
    PreviewableAttachment,
    "fileName" | "originalName" | "mimeType"
  >
) {
  const mimeType = attachment.mimeType.toLowerCase();
  const fileName =
    `${attachment.originalName ?? attachment.fileName}`.toLowerCase();
  return (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType === "application/vnd.ms-powerpoint" ||
    fileName.endsWith(".pptx") ||
    fileName.endsWith(".ppt")
  );
}

function isSpreadsheetAttachment(
  attachment: Pick<
    PreviewableAttachment,
    "fileName" | "originalName" | "mimeType"
  >
) {
  const mimeType = attachment.mimeType.toLowerCase();
  const fileName =
    `${attachment.originalName ?? attachment.fileName}`.toLowerCase();
  return (
    [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/vnd.ms-excel.sheet.macroenabled.12",
      "application/vnd.ms-excel.sheet.binary.macroenabled.12",
    ].includes(mimeType) || /\.(xls|xlsx|xlsm|xlsb)$/.test(fileName)
  );
}
