import { describe, expect, it, vi } from "vitest";

import { createExcelDiagnosticsProvider } from "./excel-diagnostics.js";

describe("excel diagnostics", () => {
  it("uses passive Office checks that do not create COM application instances", async () => {
    let command = "";
    const execFile = vi.fn((_file, args, _options, callback) => {
      command = args.join(" ");

      callback(
        null,
        JSON.stringify({
          excel: {
            installed: true,
            hiddenAutomationProcessIds: [],
          },
          word: {
            installed: true,
            hiddenAutomationProcessIds: [],
          },
          powerPoint: {
            installed: true,
            hiddenAutomationProcessIds: [],
          },
        }),
        ""
      );
    });

    await createExcelDiagnosticsProvider({
      platform: "win32",
      execFile,
      now: () => new Date("2026-06-15T12:00:00.000Z"),
    })();

    expect(execFile).toHaveBeenCalledOnce();
    expect(command).not.toMatch(/\bNew-Object\b/i);
    expect(command).not.toMatch(/\bComObject\b/i);
    expect(command).not.toMatch(/\bWorkbooks\b/i);
    expect(command).not.toMatch(/\bDocuments\b/i);
  });

  it("searches trusted PDF editors in Adobe, PDF-XChange, Foxit, then PDF Master order", async () => {
    let command = "";
    const execFile = vi.fn((_file, args, _options, callback) => {
      command = args.join(" ");

      callback(
        null,
        JSON.stringify({
          excel: {
            installed: true,
            hiddenAutomationProcessIds: [],
          },
          word: {
            installed: true,
            hiddenAutomationProcessIds: [],
          },
          powerPoint: {
            installed: true,
            hiddenAutomationProcessIds: [],
          },
          pdfEditor: {
            installed: false,
            trustedEditor: false,
          },
        }),
        ""
      );
    });

    await createExcelDiagnosticsProvider({
      platform: "win32",
      execFile,
      now: () => new Date("2026-06-15T12:00:00.000Z"),
    })();

    const normalizedCommand = command.toLowerCase();
    const adobeIndex = normalizedCommand.indexOf("acrobat.exe");
    const xchangeIndex = normalizedCommand.indexOf("pdfxedit.exe");
    const foxitIndex = normalizedCommand.indexOf("foxitpdfeditor.exe");
    const masterIndex = normalizedCommand.indexOf("masterpdf.exe");
    const masterEditorIndex = normalizedCommand.indexOf("masterpdfeditor.exe");
    expect(adobeIndex).toBeGreaterThanOrEqual(0);
    expect(xchangeIndex).toBeGreaterThanOrEqual(0);
    expect(foxitIndex).toBeGreaterThanOrEqual(0);
    expect(masterIndex).toBeGreaterThanOrEqual(0);
    expect(masterEditorIndex).toBeGreaterThanOrEqual(0);
    expect(adobeIndex).toBeLessThan(xchangeIndex);
    expect(xchangeIndex).toBeLessThan(foxitIndex);
    expect(foxitIndex).toBeLessThan(masterIndex);
  });

  it("probes trusted uninstall executable paths without requiring display name matches", async () => {
    let command = "";
    const execFile = vi.fn((_file, args, _options, callback) => {
      command = args.join(" ");

      callback(
        null,
        JSON.stringify({
          excel: {
            installed: true,
            hiddenAutomationProcessIds: [],
          },
          word: {
            installed: true,
            hiddenAutomationProcessIds: [],
          },
          powerPoint: {
            installed: true,
            hiddenAutomationProcessIds: [],
          },
          pdfEditor: {
            installed: false,
            trustedEditor: false,
          },
        }),
        ""
      );
    });

    await createExcelDiagnosticsProvider({
      platform: "win32",
      execFile,
      now: () => new Date("2026-06-15T12:00:00.000Z"),
    })();

    expect(command).not.toMatch(/if \(-not \$matchesFamily\) \{ continue \}/);
  });

  it("normalizes uninstall install locations before joining trusted executable names", async () => {
    let command = "";
    const execFile = vi.fn((_file, args, _options, callback) => {
      command = args.join(" ");

      callback(
        null,
        JSON.stringify({
          excel: {
            installed: true,
            hiddenAutomationProcessIds: [],
          },
          word: {
            installed: true,
            hiddenAutomationProcessIds: [],
          },
          powerPoint: {
            installed: true,
            hiddenAutomationProcessIds: [],
          },
          pdfEditor: {
            installed: false,
            trustedEditor: false,
          },
        }),
        ""
      );
    });

    await createExcelDiagnosticsProvider({
      platform: "win32",
      execFile,
      now: () => new Date("2026-06-15T12:00:00.000Z"),
    })();

    expect(command).toContain(
      "$installLocation = ConvertTo-ProjectWingPdfEditorPath -Value ([string]$item.InstallLocation)"
    );
    expect(command).toContain(
      "Test-Path -LiteralPath $installLocation -PathType Container -ErrorAction SilentlyContinue"
    );
  });

  it("skips Excel COM checks outside Windows", async () => {
    const diagnostics = await createExcelDiagnosticsProvider({
      platform: "linux",
      now: () => new Date("2026-06-15T12:00:00.000Z"),
    })();

    expect(diagnostics).toStrictEqual({
      excel: {
        status: "SKIPPED",
        checkedAt: "2026-06-15T12:00:00.000Z",
        comAutomation: "SKIPPED",
        hiddenAutomationProcessCount: 0,
        message: "Excel diagnostics are only available on Windows.",
      },
      word: {
        status: "SKIPPED",
        checkedAt: "2026-06-15T12:00:00.000Z",
        comAutomation: "SKIPPED",
        hiddenAutomationProcessCount: 0,
        message: "Word diagnostics are only available on Windows.",
      },
      powerPoint: {
        status: "SKIPPED",
        checkedAt: "2026-06-15T12:00:00.000Z",
        comAutomation: "SKIPPED",
        hiddenAutomationProcessCount: 0,
        message: "PowerPoint diagnostics are only available on Windows.",
      },
    });
  });

  it("reports hidden automation Excel processes and COM failures", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(
        null,
        JSON.stringify({
          comAvailable: false,
          hresult: -2_146_233_087,
          error: "TYPE_E_CANTLOADLIBRARY",
          hiddenAutomationProcessIds: [1234, 5678],
          probeProcessIds: [9012],
          cleanedProbeProcessIds: [9012],
        }),
        ""
      );
    });
    const diagnostics = await createExcelDiagnosticsProvider({
      platform: "win32",
      execFile,
      now: () => new Date("2026-06-15T12:00:00.000Z"),
    })();

    expect(diagnostics).toStrictEqual({
      excel: {
        status: "NEEDS_ATTENTION",
        checkedAt: "2026-06-15T12:00:00.000Z",
        comAutomation: "UNAVAILABLE",
        hiddenAutomationProcessCount: 2,
        hiddenAutomationProcessIds: [1234, 5678],
        hresult: -2_146_233_087,
        message: "Excel COM automation is unavailable.",
        recommendedAction:
          "Close hidden Excel automation processes or repair Office.",
      },
    });
  });

  it("reports hidden automation processes from passive Office checks", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(
        null,
        JSON.stringify({
          excel: {
            installed: true,
            hiddenAutomationProcessIds: [1234],
          },
          word: {
            installed: true,
            hiddenAutomationProcessIds: [],
          },
          powerPoint: {
            installed: true,
            hiddenAutomationProcessIds: [],
          },
        }),
        ""
      );
    });
    const diagnostics = await createExcelDiagnosticsProvider({
      platform: "win32",
      execFile,
      now: () => new Date("2026-06-15T12:00:00.000Z"),
    })();

    expect(diagnostics.excel).toStrictEqual({
      status: "NEEDS_ATTENTION",
      installed: true,
      checkedAt: "2026-06-15T12:00:00.000Z",
      comAutomation: "UNKNOWN",
      hiddenAutomationProcessCount: 1,
      hiddenAutomationProcessIds: [1234],
      message: "Hidden Excel automation processes were detected.",
      recommendedAction:
        "Close hidden Excel automation processes or repair Office.",
    });
  });

  it("reports when Microsoft Excel is missing", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(
        null,
        JSON.stringify({
          excelInstalled: false,
          comAvailable: false,
          error: "Microsoft Excel is not installed or registered.",
          hiddenAutomationProcessIds: [],
        }),
        ""
      );
    });
    const diagnostics = await createExcelDiagnosticsProvider({
      platform: "win32",
      execFile,
      now: () => new Date("2026-06-15T12:00:00.000Z"),
    })();

    expect(diagnostics).toStrictEqual({
      excel: {
        status: "MISSING",
        installed: false,
        checkedAt: "2026-06-15T12:00:00.000Z",
        comAutomation: "UNAVAILABLE",
        hiddenAutomationProcessCount: 0,
        hiddenAutomationProcessIds: [],
        message: "Microsoft Excel is not installed or registered.",
        recommendedAction:
          "Install Microsoft Excel, then restart Desktop Agent.",
      },
    });
  });

  it("reports when Microsoft Word is missing", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(
        null,
        JSON.stringify({
          excel: {
            installed: true,
            comAvailable: true,
            hiddenAutomationProcessIds: [],
          },
          word: {
            installed: false,
            comAvailable: false,
            error: "Microsoft Word is not installed or registered.",
            hiddenAutomationProcessIds: [],
          },
        }),
        ""
      );
    });
    const diagnostics = await createExcelDiagnosticsProvider({
      platform: "win32",
      execFile,
      now: () => new Date("2026-06-15T12:00:00.000Z"),
    })();

    expect(diagnostics).toStrictEqual({
      excel: {
        status: "OK",
        installed: true,
        checkedAt: "2026-06-15T12:00:00.000Z",
        comAutomation: "AVAILABLE",
        hiddenAutomationProcessCount: 0,
        hiddenAutomationProcessIds: [],
      },
      word: {
        status: "MISSING",
        installed: false,
        checkedAt: "2026-06-15T12:00:00.000Z",
        comAutomation: "UNAVAILABLE",
        hiddenAutomationProcessCount: 0,
        hiddenAutomationProcessIds: [],
        message: "Microsoft Word is not installed or registered.",
        recommendedAction:
          "Install Microsoft Word, then restart Desktop Agent.",
      },
      powerPoint: {
        status: "UNKNOWN",
        checkedAt: "2026-06-15T12:00:00.000Z",
        comAutomation: "UNKNOWN",
        hiddenAutomationProcessCount: 0,
        hiddenAutomationProcessIds: [],
        message: "PowerPoint diagnostics could not complete.",
      },
    });
  });

  it("reports when Microsoft PowerPoint is missing", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(
        null,
        JSON.stringify({
          excel: {
            installed: true,
            comAvailable: true,
            hiddenAutomationProcessIds: [],
          },
          word: {
            installed: true,
            comAvailable: true,
            hiddenAutomationProcessIds: [],
          },
          powerPoint: {
            installed: false,
            comAvailable: false,
            error: "Microsoft PowerPoint is not installed or registered.",
            hiddenAutomationProcessIds: [],
          },
        }),
        ""
      );
    });
    const diagnostics = await createExcelDiagnosticsProvider({
      platform: "win32",
      execFile,
      now: () => new Date("2026-06-15T12:00:00.000Z"),
    })();

    expect(diagnostics.powerPoint).toStrictEqual({
      status: "MISSING",
      installed: false,
      checkedAt: "2026-06-15T12:00:00.000Z",
      comAutomation: "UNAVAILABLE",
      hiddenAutomationProcessCount: 0,
      hiddenAutomationProcessIds: [],
      message: "Microsoft PowerPoint is not installed or registered.",
      recommendedAction:
        "Install Microsoft PowerPoint, then restart Desktop Agent.",
    });
  });

  it("reports when a supported PDF Master editor is missing", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(
        null,
        JSON.stringify({
          excel: {
            installed: true,
            comAvailable: true,
            hiddenAutomationProcessIds: [],
          },
          word: {
            installed: true,
            comAvailable: true,
            hiddenAutomationProcessIds: [],
          },
          powerPoint: {
            installed: true,
            comAvailable: true,
            hiddenAutomationProcessIds: [],
          },
          pdfEditor: {
            installed: false,
            trustedEditor: false,
            error: "A supported PDF editor is not installed or configured.",
          },
        }),
        ""
      );
    });
    const diagnostics = await createExcelDiagnosticsProvider({
      platform: "win32",
      execFile,
      now: () => new Date("2026-06-15T12:00:00.000Z"),
    })();

    expect(diagnostics.pdfEditor).toStrictEqual({
      status: "MISSING",
      installed: false,
      checkedAt: "2026-06-15T12:00:00.000Z",
      trustedEditor: false,
      message: "A supported PDF editor is not installed or configured.",
      recommendedAction:
        "Install Adobe Acrobat, PDF-XChange Editor, Foxit PDF Editor, or PDF Master Editor, then restart Desktop Agent.",
    });
  });
});
