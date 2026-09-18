import { describe, expect, it, vi } from "vitest";

import {
  isExcelWorkbookOpenInWindows,
  isFileLockedByExclusiveOpenInWindows,
  isLocalFileBusy,
  probeExcelWorkbookOpenInWindows,
  probeFileLockedByExclusiveOpenInWindows,
  probeLocalFileState,
  probeOfficeDocumentOpenInWindows,
} from "./file-busy.js";

describe("desktop agent local file busy detection", () => {
  it("reports a workbook match from Excel COM as open evidence", async () => {
    await expect(
      probeLocalFileState(
        { localPath: "C:\\ProjectWing\\cash.xlsx" },
        {
          platform: "win32",
          excelWorkbookOpenProbe: vi.fn().mockResolvedValue({
            state: "WORKBOOK_OPEN",
            busy: true,
            openObservedSource: "MONITOR_COM",
          }),
          exclusiveOpenProbe: vi.fn().mockResolvedValue({
            state: "CLOSED",
            busy: false,
          }),
        }
      )
    ).resolves.toStrictEqual({
      state: "WORKBOOK_OPEN",
      busy: true,
      openObservedSource: "MONITOR_COM",
      comAvailable: true,
    });
  });

  it("reports a presentation match from PowerPoint COM as open evidence", async () => {
    await expect(
      probeLocalFileState(
        { localPath: "C:\\ProjectWing\\board-deck.pptx" },
        {
          platform: "win32",
          officeDocumentOpenProbe: vi.fn().mockResolvedValue({
            state: "DOCUMENT_OPEN",
            busy: true,
            openObservedSource: "MONITOR_COM",
          }),
          exclusiveOpenProbe: vi.fn().mockResolvedValue({
            state: "CLOSED",
            busy: false,
          }),
        }
      )
    ).resolves.toStrictEqual({
      state: "DOCUMENT_OPEN",
      busy: true,
      openObservedSource: "MONITOR_COM",
      comAvailable: true,
    });
  });

  it("reports a PDF editor process bound to the target path as open evidence", async () => {
    await expect(
      probeLocalFileState(
        {
          localPath: "C:\\ProjectWing\\support.pdf",
          excelHelperProcessId: 7890,
        },
        {
          platform: "win32",
          editorProcessProbe: vi.fn().mockResolvedValue({
            state: "EDITOR_PROCESS_OPEN",
            busy: true,
            openObservedSource: "MONITOR_PROCESS",
          }),
          exclusiveOpenProbe: vi.fn().mockResolvedValue({
            state: "CLOSED",
            busy: false,
          }),
        }
      )
    ).resolves.toStrictEqual({
      state: "EDITOR_PROCESS_OPEN",
      busy: true,
      openObservedSource: "MONITOR_PROCESS",
    });
  });

  it("falls back to file-lock evidence for PDFs when the tracked editor process is gone", async () => {
    await expect(
      probeLocalFileState(
        {
          localPath: "C:\\ProjectWing\\support.pdf",
          excelHelperProcessId: 7890,
        },
        {
          platform: "win32",
          editorProcessProbe: vi.fn().mockResolvedValue({
            state: "CLOSED",
            busy: false,
          }),
          exclusiveOpenProbe: vi.fn().mockResolvedValue({
            state: "FILE_LOCKED",
            busy: true,
            openObservedSource: "MONITOR_FILE_LOCK",
          }),
        }
      )
    ).resolves.toStrictEqual({
      state: "FILE_LOCKED",
      busy: true,
      openObservedSource: "MONITOR_FILE_LOCK",
    });
  });

  it("reports file-lock evidence when COM is unavailable", async () => {
    await expect(
      probeLocalFileState(
        { localPath: "C:\\ProjectWing\\cash.xlsx" },
        {
          platform: "win32",
          excelWorkbookOpenProbe: vi.fn().mockResolvedValue({
            state: "PROBE_ERROR",
            busy: false,
            error: "COM unavailable",
          }),
          exclusiveOpenProbe: vi.fn().mockResolvedValue({
            state: "FILE_LOCKED",
            busy: true,
            openObservedSource: "MONITOR_FILE_LOCK",
          }),
        }
      )
    ).resolves.toStrictEqual({
      state: "FILE_LOCKED",
      busy: true,
      openObservedSource: "MONITOR_FILE_LOCK",
      comAvailable: false,
    });
  });

  it("reports an unlocked workbook as closed only when COM misses it and exclusive open succeeds", async () => {
    await expect(
      probeLocalFileState(
        { localPath: "C:\\ProjectWing\\cash.xlsx" },
        {
          platform: "win32",
          excelWorkbookOpenProbe: vi.fn().mockResolvedValue({
            state: "CLOSED",
            busy: false,
          }),
          exclusiveOpenProbe: vi.fn().mockResolvedValue({
            state: "CLOSED",
            busy: false,
          }),
        }
      )
    ).resolves.toStrictEqual({
      state: "CLOSED",
      busy: false,
      comAvailable: true,
    });
  });

  it("reports a missing file as missing rather than busy", async () => {
    await expect(
      probeLocalFileState(
        { localPath: "C:\\ProjectWing\\cash.xlsx" },
        {
          platform: "win32",
          excelWorkbookOpenProbe: vi.fn().mockResolvedValue({
            state: "CLOSED",
            busy: false,
          }),
          exclusiveOpenProbe: vi.fn().mockResolvedValue({
            state: "MISSING",
            busy: false,
          }),
        }
      )
    ).resolves.toStrictEqual({
      state: "MISSING",
      busy: false,
      comAvailable: true,
    });
  });

  it("keeps an Excel workbook busy when COM misses it but exclusive open is blocked", async () => {
    await expect(
      isLocalFileBusy(
        { localPath: "C:\\ProjectWing\\cash.xlsx" },
        {
          excelWorkbookOpenProbe: vi.fn().mockResolvedValue(false),
          exclusiveOpenProbe: vi.fn().mockResolvedValue(true),
        }
      )
    ).resolves.toBeTruthy();
  });

  it("treats an Excel workbook as closed only when COM misses it and exclusive open succeeds", async () => {
    await expect(
      isLocalFileBusy(
        { localPath: "C:\\ProjectWing\\cash.xlsx" },
        {
          excelWorkbookOpenProbe: vi.fn().mockResolvedValue(false),
          exclusiveOpenProbe: vi.fn().mockResolvedValue(false),
        }
      )
    ).resolves.toBeFalsy();
  });

  it("treats a Windows exclusive-open success as not busy", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(Object.assign(new Error("free"), { code: 1 }));
    });

    await expect(
      probeFileLockedByExclusiveOpenInWindows(
        String.raw`C:\ProjectWing\cash.xlsx`,
        {
          execFile,
        }
      )
    ).resolves.toStrictEqual({ state: "CLOSED", busy: false });
    await expect(
      isFileLockedByExclusiveOpenInWindows(
        String.raw`C:\ProjectWing\cash.xlsx`,
        {
          execFile,
        }
      )
    ).resolves.toBeFalsy();
  });

  it("treats a Windows exclusive-open failure as busy", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(null);
    });

    await expect(
      probeFileLockedByExclusiveOpenInWindows(
        String.raw`C:\ProjectWing\cash.xlsx`,
        {
          execFile,
        }
      )
    ).resolves.toStrictEqual({
      state: "FILE_LOCKED",
      busy: true,
      openObservedSource: "MONITOR_FILE_LOCK",
    });
    await expect(
      isFileLockedByExclusiveOpenInWindows(
        String.raw`C:\ProjectWing\cash.xlsx`,
        {
          execFile,
        }
      )
    ).resolves.toBeTruthy();
  });

  it("distinguishes Excel COM workbook matches, misses, and probe errors", async () => {
    await expect(
      probeExcelWorkbookOpenInWindows(String.raw`C:\ProjectWing\cash.xlsx`, {
        execFile: vi.fn((_file, _args, _options, callback) => callback(null)),
      })
    ).resolves.toStrictEqual({
      state: "WORKBOOK_OPEN",
      busy: true,
      openObservedSource: "MONITOR_COM",
    });

    await expect(
      probeExcelWorkbookOpenInWindows(String.raw`C:\ProjectWing\cash.xlsx`, {
        execFile: vi.fn((_file, _args, _options, callback) =>
          callback(Object.assign(new Error("not found"), { code: 1 }))
        ),
      })
    ).resolves.toStrictEqual({ state: "CLOSED", busy: false });

    await expect(
      probeExcelWorkbookOpenInWindows(String.raw`C:\ProjectWing\cash.xlsx`, {
        execFile: vi.fn((_file, _args, _options, callback) =>
          callback(Object.assign(new Error("COM failed"), { code: 2 }))
        ),
      })
    ).resolves.toStrictEqual({
      state: "PROBE_ERROR",
      busy: false,
      error: "Excel COM probe failed.",
    });

    await expect(
      isExcelWorkbookOpenInWindows(String.raw`C:\ProjectWing\cash.xlsx`, {
        execFile: vi.fn((_file, _args, _options, callback) =>
          callback(Object.assign(new Error("COM failed"), { code: 2 }))
        ),
      })
    ).resolves.toBeTruthy();
  });

  it("distinguishes PowerPoint COM presentation matches, misses, and probe errors", async () => {
    await expect(
      probeOfficeDocumentOpenInWindows(
        String.raw`C:\ProjectWing\board-deck.pptx`,
        {
          execFile: vi.fn((_file, _args, _options, callback) => callback(null)),
        }
      )
    ).resolves.toStrictEqual({
      state: "DOCUMENT_OPEN",
      busy: true,
      openObservedSource: "MONITOR_COM",
    });

    await expect(
      probeOfficeDocumentOpenInWindows(
        String.raw`C:\ProjectWing\board-deck.pptx`,
        {
          execFile: vi.fn((_file, _args, _options, callback) =>
            callback(Object.assign(new Error("not found"), { code: 1 }))
          ),
        }
      )
    ).resolves.toStrictEqual({ state: "CLOSED", busy: false });

    await expect(
      probeOfficeDocumentOpenInWindows(
        String.raw`C:\ProjectWing\board-deck.pptx`,
        {
          execFile: vi.fn((_file, _args, _options, callback) =>
            callback(Object.assign(new Error("COM failed"), { code: 2 }))
          ),
        }
      )
    ).resolves.toStrictEqual({
      state: "PROBE_ERROR",
      busy: false,
      error: "PowerPoint COM probe failed.",
    });
  });

  it("treats generic Windows exclusive-open probe failures as probe errors, not lock evidence", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(Object.assign(new Error("probe failed"), { code: 2 }));
    });

    await expect(
      probeFileLockedByExclusiveOpenInWindows(
        String.raw`C:\ProjectWing\cash.xlsx`,
        {
          execFile,
        }
      )
    ).resolves.toStrictEqual({
      state: "PROBE_ERROR",
      busy: true,
      error: "Exclusive-open probe failed.",
    });
  });
});
