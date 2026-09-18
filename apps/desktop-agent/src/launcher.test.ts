import { execFile, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { launchFile } from "./launcher.js";

const { dirname, join } = pathModule;

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
}));

describe("desktop agent launcher", () => {
  beforeEach(() => {
    vi.mocked(execFile).mockReset();
    vi.mocked(spawn).mockReset();
    delete process.env.PROJECT_WING_EXCEL_WATCHER_EXE_PATH;
    delete process.env.PROJECT_WING_PDF_MASTER_EDITOR_EXE_PATH;
    delete process.env.PROJECT_WING_AGENT_DIAGNOSTIC_LOG_LEVEL;
  });

  it("opens Master workbooks through the .NET Excel watcher on Windows", async () => {
    const watcherChild = makeChildProcess(1234);
    vi.mocked(spawn).mockReturnValueOnce(watcherChild);
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });

    try {
      const launched = launchFile(String.raw`C:\ProjectWing\cash.xlsx`, {
        mode: "MASTER",
        sessionId: "session-1",
        generation: 2,
        openSignalToken: "open-token-1",
        closeSignalToken: "close-token-1",
        agentBaseUrl: "http://127.0.0.1:17862",
      });
      watcherChild.emit("spawn");

      await expect(launched).resolves.toStrictEqual({ helperProcessId: 1234 });
      const watcherArgs = vi.mocked(spawn).mock.calls[0]?.[1] ?? [];
      expect(spawn).toHaveBeenNthCalledWith(
        1,
        "dotnet",
        expect.arrayContaining([
          "--target-path",
          String.raw`C:\ProjectWing\cash.xlsx`,
          "--session-id",
          "session-1",
          "--generation",
          "2",
          "--open-signal-token",
          "open-token-1",
          "--close-signal-token",
          "close-token-1",
          "--agent-base-url",
          "http://127.0.0.1:17862",
        ]),
        expect.objectContaining({
          windowsHide: true,
          stdio: "ignore",
          env: expect.objectContaining({
            PROJECT_WING_AGENT_DIAGNOSTIC_LOG_LEVEL: "normal",
            PROJECT_WING_EXCEL_WATCHER_LOG_PATH: expect.stringContaining(
              "excel-watcher-session-1.timeline.log"
            ),
          }),
        })
      );
      expect(watcherArgs).toStrictEqual(
        expect.arrayContaining(["--diagnostic-log-level", "normal"])
      );
      expect(vi.mocked(spawn).mock.calls[0]?.[2]?.env).not.toHaveProperty(
        "PROJECT_WING_EXCEL_WATCHER_STDOUT_LOG_PATH"
      );
      expect(vi.mocked(spawn).mock.calls[0]?.[2]?.env).not.toHaveProperty(
        "PROJECT_WING_EXCEL_WATCHER_STDERR_LOG_PATH"
      );
      expect(watcherArgs).toContainEqual(
        expect.stringContaining("ProjectWing.ExcelWatcher")
      );
      expect(watcherArgs).not.toContain("powershell.exe");
      expect(watcherArgs).not.toContain("-Command");
      expect(watcherChild.unref).toHaveBeenCalledWith();
    } finally {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: originalPlatform,
      });
    }
  });

  it("opens Master Word documents through the Office watcher on Windows", async () => {
    const watcherChild = makeChildProcess(5678);
    vi.mocked(spawn).mockReturnValueOnce(watcherChild);
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });

    try {
      const launched = launchFile(
        String.raw`C:\ProjectWing\planning-memo.docx`,
        {
          mode: "MASTER",
          sessionId: "session-2",
          generation: 3,
          openSignalToken: "open-token-2",
          closeSignalToken: "close-token-2",
          agentBaseUrl: "http://127.0.0.1:17862",
        }
      );
      watcherChild.emit("spawn");

      await expect(launched).resolves.toStrictEqual({ helperProcessId: 5678 });
      expect(spawn).toHaveBeenNthCalledWith(
        1,
        "dotnet",
        expect.arrayContaining([
          "--office-app",
          "word",
          "--target-path",
          String.raw`C:\ProjectWing\planning-memo.docx`,
          "--session-id",
          "session-2",
          "--generation",
          "3",
        ]),
        expect.objectContaining({
          env: expect.objectContaining({
            PROJECT_WING_EXCEL_WATCHER_LOG_PATH: expect.stringContaining(
              "word-watcher-session-2.timeline.log"
            ),
          }),
        })
      );
    } finally {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: originalPlatform,
      });
    }
  });

  it("opens Master PowerPoint presentations through the Office watcher on Windows", async () => {
    const watcherChild = makeChildProcess(6789);
    vi.mocked(spawn).mockReturnValueOnce(watcherChild);
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });

    try {
      const launched = launchFile(String.raw`C:\ProjectWing\board-deck.pptx`, {
        mode: "MASTER",
        sessionId: "session-3",
        generation: 4,
        openSignalToken: "open-token-3",
        closeSignalToken: "close-token-3",
        agentBaseUrl: "http://127.0.0.1:17862",
      });
      watcherChild.emit("spawn");

      await expect(launched).resolves.toStrictEqual({ helperProcessId: 6789 });
      expect(spawn).toHaveBeenNthCalledWith(
        1,
        "dotnet",
        expect.arrayContaining([
          "--office-app",
          "powerpoint",
          "--target-path",
          String.raw`C:\ProjectWing\board-deck.pptx`,
          "--session-id",
          "session-3",
          "--generation",
          "4",
        ]),
        expect.objectContaining({
          env: expect.objectContaining({
            PROJECT_WING_EXCEL_WATCHER_LOG_PATH: expect.stringContaining(
              "powerpoint-watcher-session-3.timeline.log"
            ),
          }),
        })
      );
    } finally {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: originalPlatform,
      });
    }
  });

  it("opens Master PDFs through a configured PDF editor on Windows", async () => {
    const editorChild = makeChildProcess(7890);
    vi.mocked(spawn).mockReturnValueOnce(editorChild);
    process.env.PROJECT_WING_PDF_MASTER_EDITOR_EXE_PATH = process.execPath;
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });

    try {
      const launched = launchFile(String.raw`C:\ProjectWing\support.pdf`, {
        mode: "MASTER",
        sessionId: "session-pdf",
        generation: 5,
        openSignalToken: "open-token-pdf",
        closeSignalToken: "close-token-pdf",
        agentBaseUrl: "http://127.0.0.1:17862",
      });
      await vi.waitFor(() => expect(spawn).toHaveBeenCalledOnce());
      editorChild.emit("spawn");

      await expect(launched).resolves.toStrictEqual(
        expect.objectContaining({
          helperProcessId: 7890,
          openObservedOnSpawn: true,
          openObservedSource: "LAUNCHER_PROCESS",
        })
      );
      expect(spawn).toHaveBeenNthCalledWith(
        1,
        process.execPath,
        [String.raw`C:\ProjectWing\support.pdf`],
        expect.objectContaining({
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        })
      );
    } finally {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: originalPlatform,
      });
      delete process.env.PROJECT_WING_PDF_MASTER_EDITOR_EXE_PATH;
    }
  });

  it.each([
    [
      "Adobe Acrobat",
      ["masterpdf.exe", "FoxitPDFEditor.exe", "PDFXEdit.exe", "Acrobat.exe"],
      "Acrobat.exe",
    ],
    [
      "PDF-XChange",
      ["masterpdf.exe", "FoxitPDFEditor.exe", "PDFXEdit.exe", "PXCEditor.exe"],
      "PDFXEdit.exe",
    ],
    [
      "PDF-XChange alternate executable",
      ["masterpdf.exe", "FoxitPDFEditor.exe", "PXCEditor.exe"],
      "PXCEditor.exe",
    ],
    [
      "Foxit PDF Editor",
      ["masterpdf.exe", "FoxitPDFEditor.exe"],
      "FoxitPDFEditor.exe",
    ],
    ["PDF Master", ["masterpdf.exe"], "masterpdf.exe"],
    [
      "PDF Master alternate executable",
      ["MasterPDFEditor.exe"],
      "MasterPDFEditor.exe",
    ],
  ])(
    "opens Master PDFs with %s according to the trusted editor priority",
    async (_label, candidateNames, expectedName) => {
      const editorChild = makeChildProcess(8890);
      vi.mocked(spawn).mockReturnValueOnce(editorChild);
      const tempRoot = mkdtempSync(join(tmpdir(), "project-wing-pdf-editors-"));
      const candidatePaths = candidateNames.map((name) =>
        makeFakeExecutable(tempRoot, name)
      );
      vi.mocked(execFile).mockImplementationOnce(
        (_file, _args, _options, callback) => {
          callback(null, JSON.stringify({ candidates: candidatePaths }), "");
        }
      );
      const expectedPath = candidatePaths.find((candidatePath) =>
        candidatePath.toLowerCase().endsWith(expectedName.toLowerCase())
      );
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: "win32",
      });

      try {
        const launched = launchFile(String.raw`C:\ProjectWing\support.pdf`, {
          mode: "MASTER",
          sessionId: "session-pdf-priority",
          generation: 6,
          openSignalToken: "open-token-pdf-priority",
          closeSignalToken: "close-token-pdf-priority",
          agentBaseUrl: "http://127.0.0.1:17862",
        });
        await vi.waitFor(() => expect(spawn).toHaveBeenCalledOnce());
        editorChild.emit("spawn");

        await expect(launched).resolves.toStrictEqual(
          expect.objectContaining({
            helperProcessId: 8890,
            openObservedOnSpawn: true,
            openObservedSource: "LAUNCHER_PROCESS",
          })
        );
        expect(spawn).toHaveBeenNthCalledWith(
          1,
          expectedPath,
          [String.raw`C:\ProjectWing\support.pdf`],
          expect.objectContaining({
            detached: true,
            stdio: "ignore",
            windowsHide: true,
          })
        );
      } finally {
        Object.defineProperty(process, "platform", {
          configurable: true,
          value: originalPlatform,
        });
        rmSync(tempRoot, { recursive: true, force: true });
      }
    }
  );

  it("caches trusted PDF editor discovery for repeated PDF launches", async () => {
    const firstEditorChild = makeChildProcess(8891);
    const secondEditorChild = makeChildProcess(8892);
    vi.mocked(spawn)
      .mockReturnValueOnce(firstEditorChild)
      .mockReturnValueOnce(secondEditorChild);
    const tempRoot = mkdtempSync(join(tmpdir(), "project-wing-pdf-editors-"));
    const editorPath = makeFakeExecutable(tempRoot, "masterpdf.exe");
    vi.mocked(execFile).mockImplementation(
      (_file, _args, _options, callback) => {
        callback(null, JSON.stringify({ candidates: [editorPath] }), "");
      }
    );
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });

    try {
      const firstLaunch = launchFile(String.raw`C:\ProjectWing\support-a.pdf`, {
        mode: "MASTER",
        sessionId: "session-pdf-cache-a",
        generation: 8,
        openSignalToken: "open-token-pdf-cache-a",
        closeSignalToken: "close-token-pdf-cache-a",
        agentBaseUrl: "http://127.0.0.1:17862",
      });
      await vi.waitFor(() => expect(spawn).toHaveBeenCalledOnce());
      firstEditorChild.emit("spawn");
      await expect(firstLaunch).resolves.toStrictEqual(
        expect.objectContaining({
          helperProcessId: 8891,
          openObservedOnSpawn: true,
          openObservedSource: "LAUNCHER_PROCESS",
        })
      );

      const secondLaunch = launchFile(
        String.raw`C:\ProjectWing\support-b.pdf`,
        {
          mode: "MASTER",
          sessionId: "session-pdf-cache-b",
          generation: 9,
          openSignalToken: "open-token-pdf-cache-b",
          closeSignalToken: "close-token-pdf-cache-b",
          agentBaseUrl: "http://127.0.0.1:17862",
        }
      );
      await vi.waitFor(() => expect(spawn).toHaveBeenCalledTimes(2));
      secondEditorChild.emit("spawn");
      await expect(secondLaunch).resolves.toStrictEqual(
        expect.objectContaining({
          helperProcessId: 8892,
          openObservedOnSpawn: true,
          openObservedSource: "LAUNCHER_PROCESS",
        })
      );

      expect(execFile).toHaveBeenCalledOnce();
      expect(spawn).toHaveBeenNthCalledWith(
        1,
        editorPath,
        [String.raw`C:\ProjectWing\support-a.pdf`],
        expect.objectContaining({ windowsHide: true })
      );
      expect(spawn).toHaveBeenNthCalledWith(
        2,
        editorPath,
        [String.raw`C:\ProjectWing\support-b.pdf`],
        expect.objectContaining({ windowsHide: true })
      );
    } finally {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: originalPlatform,
      });
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("gives trusted PDF editor discovery up to 10 seconds before launching", async () => {
    const editorChild = makeChildProcess(8891);
    vi.mocked(spawn).mockReturnValueOnce(editorChild);
    const tempRoot = mkdtempSync(join(tmpdir(), "project-wing-pdf-editors-"));
    const editorPath = makeFakeExecutable(tempRoot, "masterpdf.exe");
    vi.mocked(execFile).mockImplementationOnce(
      (_file, _args, _options, callback) => {
        callback(null, JSON.stringify({ candidates: [editorPath] }), "");
      }
    );
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });

    try {
      const launched = launchFile(String.raw`C:\ProjectWing\support.pdf`, {
        mode: "MASTER",
        sessionId: "session-pdf-timeout",
        generation: 7,
        openSignalToken: "open-token-pdf-timeout",
        closeSignalToken: "close-token-pdf-timeout",
        agentBaseUrl: "http://127.0.0.1:17862",
      });
      await vi.waitFor(() => expect(spawn).toHaveBeenCalledOnce());
      editorChild.emit("spawn");

      await expect(launched).resolves.toStrictEqual(
        expect.objectContaining({
          helperProcessId: 8891,
          openObservedOnSpawn: true,
          openObservedSource: "LAUNCHER_PROCESS",
        })
      );
      expect(execFile).toHaveBeenCalledWith(
        "powershell.exe",
        expect.arrayContaining(["-NonInteractive"]),
        expect.objectContaining({
          timeout: 10_000,
          windowsHide: true,
        }),
        expect.any(Function)
      );
    } finally {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: originalPlatform,
      });
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("uses the packaged Excel watcher executable when configured", async () => {
    const watcherChild = makeChildProcess(4321);
    vi.mocked(spawn).mockReturnValueOnce(watcherChild);
    process.env.PROJECT_WING_EXCEL_WATCHER_EXE_PATH = String.raw`C:\ProjectWing\DesktopAgent\watcher\ProjectWing.ExcelWatcher.exe`;
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });

    try {
      const launched = launchFile(String.raw`C:\ProjectWing\cash.xlsx`, {
        mode: "MASTER",
        sessionId: "session-1",
        generation: 2,
        openSignalToken: "open-token-1",
        closeSignalToken: "close-token-1",
        agentBaseUrl: "http://127.0.0.1:17862",
      });
      watcherChild.emit("spawn");

      await expect(launched).resolves.toStrictEqual({ helperProcessId: 4321 });
      expect(spawn).toHaveBeenNthCalledWith(
        1,
        String.raw`C:\ProjectWing\DesktopAgent\watcher\ProjectWing.ExcelWatcher.exe`,
        expect.arrayContaining([
          "--target-path",
          String.raw`C:\ProjectWing\cash.xlsx`,
          "--session-id",
          "session-1",
        ]),
        expect.objectContaining({
          windowsHide: true,
          stdio: "ignore",
        })
      );
    } finally {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: originalPlatform,
      });
      delete process.env.PROJECT_WING_EXCEL_WATCHER_EXE_PATH;
    }
  });

  it("keeps watcher stdout and stderr logs only in diagnostic debug mode", async () => {
    const watcherChild = makeChildProcess(2468);
    vi.mocked(spawn).mockReturnValueOnce(watcherChild);
    process.env.PROJECT_WING_AGENT_DIAGNOSTIC_LOG_LEVEL = "debug";
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "win32",
    });

    try {
      const launched = launchFile(String.raw`C:\ProjectWing\cash.xlsx`, {
        mode: "MASTER",
        sessionId: "session-debug",
        generation: 5,
        openSignalToken: "open-token-debug",
        closeSignalToken: "close-token-debug",
        agentBaseUrl: "http://127.0.0.1:17862",
      });
      watcherChild.emit("spawn");

      await expect(launched).resolves.toStrictEqual({ helperProcessId: 2468 });
      expect(spawn).toHaveBeenNthCalledWith(
        1,
        "dotnet",
        expect.arrayContaining(["--diagnostic-log-level", "debug"]),
        expect.objectContaining({
          stdio: ["ignore", "pipe", "pipe"],
          env: expect.objectContaining({
            PROJECT_WING_AGENT_DIAGNOSTIC_LOG_LEVEL: "debug",
            PROJECT_WING_EXCEL_WATCHER_STDOUT_LOG_PATH: expect.stringContaining(
              "excel-watcher-session-debug.stdout.log"
            ),
            PROJECT_WING_EXCEL_WATCHER_STDERR_LOG_PATH: expect.stringContaining(
              "excel-watcher-session-debug.stderr.log"
            ),
          }),
        })
      );
      watcherChild.emit("close");
    } finally {
      Object.defineProperty(process, "platform", {
        configurable: true,
        value: originalPlatform,
      });
      delete process.env.PROJECT_WING_AGENT_DIAGNOSTIC_LOG_LEVEL;
    }
  });
});

function makeChildProcess(pid: number) {
  const child = new EventEmitter() as EventEmitter & {
    pid: number;
    unref: ReturnType<typeof vi.fn>;
  };
  child.pid = pid;
  Object.defineProperty(child, "unref", {
    configurable: true,
    value: () => child,
    writable: true,
  });
  vi.spyOn(child, "unref").mockReturnValue(child);
  return child as never;
}

function makeFakeExecutable(root: string, fileName: string) {
  const filePath = join(root, fileName);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, "");
  expect(existsSync(filePath)).toBeTruthy();
  return filePath;
}
