import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  buildLegacyWindowsCleanupScript,
  cleanupLegacyWindowsInstall,
} from "./legacy-windows-migration";

const windowsOptions = {
  isPackaged: true,
  localAppDataPath: String.raw`C:\Users\tester\AppData\Local`,
  platform: "win32" as const,
};

describe("legacy lifecycle retirement", () => {
  it("keeps legacy workpaper paths unchanged", () => {
    const fixture = mkdtempSync(path.join(tmpdir(), "project-wing-migration-"));
    const legacy = path.join(fixture, "ProjectWing", "DesktopAgent");
    const master = path.join(legacy, "custom-cache", "unsynced.xlsx");
    try {
      mkdirSync(path.dirname(master), { recursive: true });
      writeFileSync(master, "unsynced content");
      const run = vi.fn(() => ({ status: 0 }));
      const writeMarker = vi.fn();
      expect(
        cleanupLegacyWindowsInstall(
          { ...windowsOptions, localAppDataPath: fixture },
          {
            pathExists: () => false,
            run,
            writeMarker,
          }
        )
      ).toBeTruthy();
      expect(existsSync(legacy)).toBeTruthy();
      expect(readFileSync(master, "utf-8")).toBe("unsynced content");
      expect(run).toHaveBeenCalledOnce();
      expect(writeMarker).toHaveBeenCalledOnce();
    } finally {
      if (path.basename(fixture).startsWith("project-wing-migration-")) {
        rmSync(fixture, { recursive: true, force: true });
      }
    }
  });

  it.each([
    { ...windowsOptions, isPackaged: false },
    { ...windowsOptions, platform: "darwin" as const },
    { ...windowsOptions, localAppDataPath: undefined },
  ])("skips unsupported environments", (options) => {
    const run = vi.fn();
    const pathExists = vi.fn();
    expect(
      cleanupLegacyWindowsInstall(options, {
        pathExists,
        run,
        writeMarker: vi.fn(),
      })
    ).toBeFalsy();
    expect(run).not.toHaveBeenCalled();
    expect(pathExists).not.toHaveBeenCalled();
  });

  it("does not repeatedly maintain an already retired directory", () => {
    const run = vi.fn();
    expect(
      cleanupLegacyWindowsInstall(windowsOptions, {
        pathExists: () => true,
        run,
        writeMarker: vi.fn(),
      })
    ).toBeFalsy();
    expect(run).not.toHaveBeenCalled();
  });

  it("does not mark retirement complete if process/task ownership cannot be verified", () => {
    const writeMarker = vi.fn();
    expect(() =>
      cleanupLegacyWindowsInstall(windowsOptions, {
        pathExists: () => false,
        writeMarker,
        run: () => ({
          status: 1,
          stderr: "Scheduled task belongs to an unverified installation",
        }),
      })
    ).toThrow("unverified installation");
    expect(writeMarker).not.toHaveBeenCalled();
  });

  it("checks action ownership before stopping a task and never deletes workpaper directories", () => {
    const script = buildLegacyWindowsCleanupScript(
      Buffer.from(
        String.raw`C:\Users\tester\AppData\Local\ProjectWing\DesktopAgent`
      ).toString("base64")
    );
    expect(script.indexOf("$executable.StartsWith")).toBeLessThan(
      script.indexOf("Stop-ScheduledTask")
    );
    expect(script).toContain("Unregister-ScheduledTask -InputObject $task");
    expect(script).toContain("Get-CimInstance Win32_Process -Filter");
    expect(script).not.toContain("CommandLine.IndexOf");
    expect(script).not.toContain("Remove-Item -LiteralPath $legacyRoot");
    expect(script).not.toContain("Move-Item");
    expect(script).toContain("Wait-Process -Id $legacyProcessIds -Timeout 5");
  });
});
