import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import { XLSX } from "../common/xlsx";

import { StorageService } from "../storage/storage.service";
import {
  SpreadsheetPreviewCacheService,
  buildSpreadsheetPreviewManifestObjectKey,
  isSpreadsheetPreviewAttachment,
} from "./spreadsheet-preview-cache.service";

describe(SpreadsheetPreviewCacheService, () => {
  let service: SpreadsheetPreviewCacheService;
  let storage: StorageService;
  let uploadRoot: string;

  beforeEach(async () => {
    uploadRoot = await mkdtemp(
      pathModule.join(tmpdir(), "project-wing-sheet-preview-")
    );
    process.env.STORAGE_DRIVER = "local";
    process.env.UPLOAD_DIR = uploadRoot;
    storage = new StorageService();
    service = new SpreadsheetPreviewCacheService(storage);
  });

  afterEach(async () => {
    await rm(uploadRoot, { force: true, recursive: true });
    delete process.env.STORAGE_DRIVER;
    delete process.env.UPLOAD_DIR;
    delete process.env.PREVIEW_EXCEL_CHUNK_ROWS;
    delete process.env.PREVIEW_EXCEL_MAX_FILE_BYTES;
  });

  it("recognizes tab-separated files as cacheable spreadsheets", () => {
    expect(
      isSpreadsheetPreviewAttachment({
        fileName: "accounts.tsv",
        mimeType: "text/tab-separated-values",
      })
    ).toBeTruthy();
  });

  it("warms persistent chunks and reads only the requested rows", async () => {
    process.env.PREVIEW_EXCEL_CHUNK_ROWS = "2";
    const attachment = await storeWorkbook();
    const manifest = await service.warmAttachmentPreview(attachment);
    const preview = await service.readPreview(attachment, {
      sheetIndex: 0,
      offset: 1,
      limit: 3,
    });

    expect(manifest.sheetNames).toStrictEqual(["余额表", "Notes"]);
    expect(manifest.sheets[0].chunks).toHaveLength(3);
    expect(preview).toStrictEqual(
      expect.objectContaining({
        sheetName: "余额表",
        offset: 1,
        columnOffset: 0,
        columnLimit: 30,
        totalRows: 5,
        totalColumns: 2,
        hasMore: true,
        hasMoreColumns: false,
        rows: [
          { rowNumber: 2, cells: ["1001", "现金"] },
          { rowNumber: 3, cells: ["1002", "银行存款"] },
          { rowNumber: 4, cells: ["1003", "应收账款"] },
        ],
      })
    );
    await expect(
      storage.getObjectBuffer(
        buildSpreadsheetPreviewManifestObjectKey(attachment)
      )
    ).resolves.toBeInstanceOf(Buffer);
  });

  it("returns only the requested column window from cached row chunks", async () => {
    const attachment = await storeWorkbook();
    await service.warmAttachmentPreview(attachment);

    const preview = await service.readPreview(attachment, {
      offset: 0,
      limit: 2,
      columnOffset: 1,
      columnLimit: 1,
    });

    expect(preview).toStrictEqual(
      expect.objectContaining({
        columnOffset: 1,
        columnLimit: 1,
        hasMoreColumns: false,
        rows: [
          { rowNumber: 1, cells: ["科目名称"] },
          { rowNumber: 2, cells: ["现金"] },
        ],
      })
    );
  });

  it("searches every cached sheet and returns cell coordinates", async () => {
    process.env.PREVIEW_EXCEL_CHUNK_ROWS = "2";
    const attachment = await storeWorkbook();
    await service.warmAttachmentPreview(attachment);

    await expect(
      service.searchPreview(attachment, "银")
    ).resolves.toStrictEqual({
      results: [
        {
          columnIndex: 1,
          rowNumber: 3,
          sheetIndex: 0,
          value: "银行存款",
        },
      ],
    });
  });

  it("reuses content-addressed chunks after a version changes", async () => {
    const attachment = await storeWorkbook();
    await service.warmAttachmentPreview(attachment);
    const nextVersion = {
      ...attachment,
      version: 2,
      fileUrl: "working-papers/project-1/paper-1/missing.xlsx",
    };
    const manifest = await new SpreadsheetPreviewCacheService(
      storage
    ).warmAttachmentPreview(nextVersion);
    const preview = await service.readPreview(nextVersion, {
      offset: 0,
      limit: 1,
    });

    expect(manifest.version).toBe(2);
    expect(preview.rows[0]).toStrictEqual({
      rowNumber: 1,
      cells: ["科目编号", "科目名称"],
    });
  });

  it("rejects oversized workbooks before downloading them", async () => {
    process.env.PREVIEW_EXCEL_MAX_FILE_BYTES = "10";
    await expect(
      service.warmAttachmentPreview({
        id: "attachment-large",
        projectId: "project-1",
        fileUrl: "missing.xlsx",
        fileName: "large.xlsx",
        originalName: "large.xlsx",
        fileSize: 11,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        version: 1,
      })
    ).rejects.toThrow("configured preview size limit");
  });

  async function storeWorkbook() {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["科目编号", "科目名称"],
        ["1001", "现金"],
        ["1002", "银行存款"],
        ["1003", "应收账款"],
        ["1004", "存货"],
      ]),
      "余额表"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["note"]]),
      "Notes"
    );
    const body = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    }) as Buffer;
    const fileUrl = pathModule.posix.join(
      "working-papers",
      "project-1",
      "paper-1",
      "ledger.xlsx"
    );
    await storage.putCacheObject(
      fileUrl,
      body,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    return {
      id: "attachment-1",
      projectId: "project-1",
      fileUrl,
      fileName: "ledger.xlsx",
      originalName: "ledger.xlsx",
      fileSize: body.byteLength,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      version: 1,
      contentHash: "a".repeat(64),
    };
  }
});
