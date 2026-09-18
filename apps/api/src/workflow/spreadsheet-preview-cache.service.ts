import pathModule from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

import { Injectable, Optional } from "@nestjs/common";
import { XLSX } from "../common/xlsx";

import { ApiBadRequestException } from "../common/api-error";
import { StorageService } from "../storage/storage.service";
import type { PreviewableAttachment } from "./document-conversion.service";

const CACHE_FORMAT_VERSION = 1;
const DEFAULT_CHUNK_ROWS = 200;
const DEFAULT_MAX_CHUNK_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_FILE_BYTES = 256 * 1024 * 1024;
const DEFAULT_MAX_CELLS = 10_000_000;
const DEFAULT_MAX_COLUMNS = 4096;
const DEFAULT_MAX_SHEETS = 256;

export type SpreadsheetPreviewRow = {
  rowNumber: number;
  cells: string[];
};

export type SpreadsheetPreviewChunk = {
  offset: number;
  rowCount: number;
  objectKey: string;
};

export type SpreadsheetPreviewSheet = {
  index: number;
  name: string;
  startRowNumber: number;
  totalRows: number;
  totalColumns: number;
  chunks: SpreadsheetPreviewChunk[];
};

export type SpreadsheetPreviewManifest = {
  formatVersion: number;
  attachmentId: string;
  version: number;
  fileName: string;
  sheetNames: string[];
  sheets: SpreadsheetPreviewSheet[];
};

export type SpreadsheetPreviewSearchResult = {
  columnIndex: number;
  rowNumber: number;
  sheetIndex: number;
  value: string;
};

type SpreadsheetAttachment = PreviewableAttachment & {
  projectId?: string | null;
  fileSize?: number | null;
};

@Injectable()
export class SpreadsheetPreviewCacheService {
  constructor(@Optional() private readonly storage?: StorageService) {}

  clearAttachmentPreviewCache(attachment: {
    id: string;
    projectId?: string | null;
  }) {
    return this.fileStorage().deleteCachePrefix(
      pathModule.posix.join(
        "spreadsheet-previews",
        attachment.projectId?.trim() || "unknown-project",
        attachment.id
      )
    );
  }

  async warmAttachmentPreview(
    attachment: SpreadsheetAttachment
  ): Promise<SpreadsheetPreviewManifest> {
    const cached = await this.getManifest(attachment);
    if (cached && (await this.hasAllChunks(cached))) {
      return cached;
    }

    assertSpreadsheetFileSize(attachment.fileSize);
    const source = await this.fileStorage().getObjectBuffer(attachment.fileUrl);
    assertSpreadsheetFileSize(source.byteLength);

    const workbook = XLSX.read(source, {
      cellDates: true,
      type: "buffer",
    });
    if (
      workbook.SheetNames.length >
      configuredPositiveInteger("PREVIEW_EXCEL_MAX_SHEETS", DEFAULT_MAX_SHEETS)
    ) {
      throw new Error("Spreadsheet contains too many worksheets to preview.");
    }

    const sheets: SpreadsheetPreviewSheet[] = [];
    let totalCells = 0;
    for (
      let sheetIndex = 0;
      sheetIndex < workbook.SheetNames.length;
      sheetIndex += 1
    ) {
      const name = workbook.SheetNames[sheetIndex];
      const sheet = workbook.Sheets[name];
      const range = sheet?.["!ref"]
        ? XLSX.utils.decode_range(sheet["!ref"])
        : null;
      const totalRows = range ? range.e.r - range.s.r + 1 : 0;
      const totalColumns = range ? range.e.c - range.s.c + 1 : 0;
      if (
        totalColumns >
        configuredPositiveInteger(
          "PREVIEW_EXCEL_MAX_COLUMNS",
          DEFAULT_MAX_COLUMNS
        )
      ) {
        throw new Error(`Worksheet ${name} contains too many columns.`);
      }
      totalCells += totalRows * totalColumns;
      if (
        totalCells >
        configuredPositiveInteger("PREVIEW_EXCEL_MAX_CELLS", DEFAULT_MAX_CELLS)
      ) {
        throw new Error("Spreadsheet is too large to preview safely.");
      }

      const chunks: SpreadsheetPreviewChunk[] = [];
      const maxChunkRows = configuredPositiveInteger(
        "PREVIEW_EXCEL_CHUNK_ROWS",
        DEFAULT_CHUNK_ROWS
      );
      const maxChunkBytes = configuredPositiveInteger(
        "PREVIEW_EXCEL_MAX_CHUNK_BYTES",
        DEFAULT_MAX_CHUNK_BYTES
      );
      let pendingRows: SpreadsheetPreviewRow[] = [];
      let pendingBytes = 0;
      let pendingOffset = 0;
      const flushChunk = async () => {
        if (pendingRows.length === 0) {
          return;
        }
        const objectKey = buildSpreadsheetPreviewChunkObjectKey(
          attachment,
          sheetIndex,
          pendingOffset
        );
        await this.fileStorage().putCacheObject(
          objectKey,
          gzipSync(
            Buffer.from(
              JSON.stringify({
                offset: pendingOffset,
                rows: pendingRows,
              })
            )
          ),
          "application/gzip"
        );
        chunks.push({
          offset: pendingOffset,
          rowCount: pendingRows.length,
          objectKey,
        });
        pendingRows = [];
        pendingBytes = 0;
      };
      for (let offset = 0; offset < totalRows; offset += 1) {
        const row = range ? readRows(sheet, range, offset, 1)[0] : null;
        if (!row) {
          continue;
        }
        const rowBytes = Buffer.byteLength(JSON.stringify(row));
        if (
          pendingRows.length > 0 &&
          (pendingRows.length >= maxChunkRows ||
            pendingBytes + rowBytes > maxChunkBytes)
        ) {
          await flushChunk();
        }
        if (pendingRows.length === 0) {
          pendingOffset = offset;
        }
        pendingRows.push(row);
        pendingBytes += rowBytes;
      }
      await flushChunk();
      sheets.push({
        index: sheetIndex,
        name,
        startRowNumber: range ? range.s.r + 1 : 1,
        totalRows,
        totalColumns,
        chunks,
      });
    }

    const manifest: SpreadsheetPreviewManifest = {
      formatVersion: CACHE_FORMAT_VERSION,
      attachmentId: attachment.id,
      version: attachment.version,
      fileName: attachment.originalName ?? attachment.fileName,
      sheetNames: workbook.SheetNames,
      sheets,
    };
    await this.fileStorage().putCacheObject(
      buildSpreadsheetPreviewManifestObjectKey(attachment),
      Buffer.from(JSON.stringify(manifest)),
      "application/json"
    );
    return manifest;
  }

  async readPreview(
    attachment: SpreadsheetAttachment,
    input: {
      sheetIndex?: number;
      offset?: number;
      limit?: number;
      columnOffset?: number;
      columnLimit?: number;
      targetRow?: number;
    }
  ) {
    const manifest = await this.getManifest(attachment);
    if (!manifest) {
      throw new ApiBadRequestException(
        "PREVIEW_FAILED",
        "Spreadsheet preview cache is unavailable."
      );
    }
    if (manifest.sheets.length === 0) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "表格文件没有可预览的工作表"
      );
    }
    const sheetIndex = clampInteger(
      input.sheetIndex,
      0,
      manifest.sheets.length - 1
    );
    const sheet = manifest.sheets[sheetIndex];
    const limit = clampInteger(input.limit, 1, 200, 50);
    const columnOffset = clampInteger(
      input.columnOffset,
      0,
      Math.max(0, sheet.totalColumns - 1)
    );
    const columnLimit = clampInteger(input.columnLimit, 1, 200, 30);
    const requestedOffset =
      input.targetRow === undefined
        ? Math.max(0, Math.trunc(input.offset ?? 0))
        : Math.max(
            0,
            Math.trunc(input.targetRow) -
              sheet.startRowNumber -
              Math.floor(limit / 2)
          );
    const rows: SpreadsheetPreviewRow[] = [];
    for (const chunk of sheet.chunks) {
      const chunkEnd = chunk.offset + chunk.rowCount;
      if (chunkEnd <= requestedOffset) {
        continue;
      }
      if (chunk.offset >= requestedOffset + limit) {
        break;
      }
      const payload = JSON.parse(
        gunzipSync(
          await this.fileStorage().getObjectBuffer(chunk.objectKey)
        ).toString("utf-8")
      ) as { offset: number; rows: SpreadsheetPreviewRow[] };
      const from = Math.max(0, requestedOffset - payload.offset);
      const remaining = limit - rows.length;
      rows.push(
        ...payload.rows.slice(from, from + remaining).map((row) => ({
          ...row,
          cells: row.cells.slice(columnOffset, columnOffset + columnLimit),
        }))
      );
      if (rows.length >= limit) {
        break;
      }
    }

    return {
      attachmentId: attachment.id,
      fileName: manifest.fileName,
      sheetNames: manifest.sheetNames,
      sheetIndex,
      sheetName: sheet.name,
      offset: requestedOffset,
      limit,
      columnOffset,
      columnLimit,
      totalRows: sheet.totalRows,
      totalColumns: sheet.totalColumns,
      rows,
      hasMore: requestedOffset + rows.length < sheet.totalRows,
      hasMoreColumns: columnOffset + columnLimit < sheet.totalColumns,
    };
  }

  async searchPreview(
    attachment: SpreadsheetAttachment,
    query: string,
    limit = 100
  ) {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return { results: [] };
    }

    const manifest =
      (await this.getManifest(attachment)) ??
      (await this.warmAttachmentPreview(attachment));
    const results: SpreadsheetPreviewSearchResult[] = [];

    for (const sheet of manifest.sheets) {
      for (const chunk of sheet.chunks) {
        const payload = JSON.parse(
          gunzipSync(
            await this.fileStorage().getObjectBuffer(chunk.objectKey)
          ).toString("utf-8")
        ) as { rows: SpreadsheetPreviewRow[] };
        for (const row of payload.rows) {
          for (const [columnIndex, value] of row.cells.entries()) {
            if (!value.toLocaleLowerCase().includes(normalizedQuery)) {
              continue;
            }
            results.push({
              columnIndex,
              rowNumber: row.rowNumber,
              sheetIndex: sheet.index,
              value,
            });
            if (results.length >= limit) {
              return { results };
            }
          }
        }
      }
    }

    return { results };
  }

  async getManifest(attachment: SpreadsheetAttachment) {
    try {
      const manifestBuffer = await this.fileStorage().getObjectBuffer(
        buildSpreadsheetPreviewManifestObjectKey(attachment)
      );
      const parsed = JSON.parse(
        manifestBuffer.toString("utf-8")
      ) as SpreadsheetPreviewManifest;
      const contentAddressed = Boolean(attachment.contentHash?.trim());
      if (
        parsed.formatVersion !== CACHE_FORMAT_VERSION ||
        parsed.attachmentId !== attachment.id ||
        (!contentAddressed && parsed.version !== attachment.version) ||
        !Array.isArray(parsed.sheets)
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

  private async hasAllChunks(manifest: SpreadsheetPreviewManifest) {
    for (const sheet of manifest.sheets) {
      for (const chunk of sheet.chunks) {
        try {
          await this.fileStorage().getObjectMetadata(chunk.objectKey);
        } catch {
          return false;
        }
      }
    }
    return true;
  }

  private fileStorage() {
    return this.storage ?? new StorageService();
  }
}

export function isSpreadsheetPreviewAttachment(attachment: {
  fileName: string;
  originalName?: string | null;
  mimeType: string;
}) {
  const displayName = (
    attachment.originalName ?? attachment.fileName
  ).toLowerCase();
  return (
    /\.(xlsx|xls|xlsm|xlsb|csv|tsv)$/.test(displayName) ||
    /(?:spreadsheet|excel|csv|tab-separated-values)/i.test(attachment.mimeType)
  );
}

export function buildSpreadsheetPreviewManifestObjectKey(
  attachment: Pick<PreviewableAttachment, "id" | "version" | "contentHash"> & {
    projectId?: string | null;
  }
) {
  return pathModule.posix.join(
    spreadsheetPreviewPrefix(attachment),
    "metadata.json"
  );
}

export function buildSpreadsheetPreviewChunkObjectKey(
  attachment: Pick<PreviewableAttachment, "id" | "version" | "contentHash"> & {
    projectId?: string | null;
  },
  sheetIndex: number,
  offset: number
) {
  return pathModule.posix.join(
    spreadsheetPreviewPrefix(attachment),
    `sheet-${String(sheetIndex + 1).padStart(3, "0")}`,
    `rows-${String(offset).padStart(9, "0")}.json.gz`
  );
}

function spreadsheetPreviewPrefix(
  attachment: Pick<PreviewableAttachment, "id" | "version" | "contentHash"> & {
    projectId?: string | null;
  }
) {
  return pathModule.posix.join(
    "spreadsheet-previews",
    attachment.projectId?.trim() || "unknown-project",
    attachment.id,
    attachment.contentHash?.trim().toLowerCase() || `v${attachment.version}`
  );
}

function readRows(
  sheet: XLSX.WorkSheet,
  range: XLSX.Range,
  offset: number,
  limit: number
) {
  const rows: SpreadsheetPreviewRow[] = [];
  const startRow = range.s.r + offset;
  const endRow = Math.min(range.e.r, startRow + limit - 1);
  for (let row = startRow; row <= endRow; row += 1) {
    const cells: string[] = [];
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      cells.push(formatCell(cell));
    }
    rows.push({ rowNumber: row + 1, cells });
  }
  return rows;
}

function formatCell(cell: XLSX.CellObject | undefined) {
  if (!cell) {
    return "";
  }
  if (typeof cell.w === "string") {
    return cell.w;
  }
  if (cell.v instanceof Date) {
    return cell.v.toISOString().slice(0, 10);
  }
  return cell.v === undefined || cell.v === null ? "" : String(cell.v);
}

function assertSpreadsheetFileSize(fileSize?: number | null) {
  if (
    fileSize !== undefined &&
    fileSize !== null &&
    fileSize >
      configuredPositiveInteger(
        "PREVIEW_EXCEL_MAX_FILE_BYTES",
        DEFAULT_MAX_FILE_BYTES
      )
  ) {
    throw new Error("Spreadsheet exceeds the configured preview size limit.");
  }
}

function configuredPositiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function clampInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback = min
) {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
