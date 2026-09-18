import { readFile } from "node:fs/promises";
import pathModule from "node:path";

import { describe, expect, it } from "vitest";

const { resolve } = pathModule;

const watcherTestDirectory = import.meta.dirname;

const watcherRoot = resolve(
  watcherTestDirectory,
  "..",
  "watcher",
  "ProjectWing.ExcelWatcher"
);

describe("excel watcher COM automation", () => {
  it("does not bind to Office PIA types at runtime", async () => {
    const [projectFile, programFile] = await Promise.all([
      readFile(
        resolve(watcherRoot, "ProjectWing.ExcelWatcher.csproj"),
        "utf-8"
      ),
      readFile(resolve(watcherRoot, "Program.cs"), "utf-8"),
    ]);

    expect(projectFile).not.toContain("Microsoft.Office.Interop.Excel");
    expect(projectFile).not.toContain("MSOfficeCore.Interop");
    expect(programFile).not.toContain("Microsoft.Office.Interop.Excel");
    expect(programFile).not.toContain("using Excel =");
    expect(programFile).not.toContain("new Excel.Application");
    expect(programFile).not.toContain("Excel.Workbook");
  });

  it("uses a bounded multi-signal fallback for fragile Office COM automation", async () => {
    const programFile = await readFile(
      resolve(watcherRoot, "Program.cs"),
      "utf-8"
    );

    expect(programFile).toContain("ShellOpenFallbackStarted");
    expect(programFile).toContain("WATCHER_FILE_LOCK");
    expect(programFile).toContain("ComRecoveryGrace");
    expect(programFile).toContain("DegradedCloseFallbackDelay");
    expect(programFile).toContain("OfficeObservationDegraded");
    expect(programFile).toContain("OfficeObservationRecovered");
    expect(programFile).toContain("OfficeObservationFallbackCloseConfirmed");
    expect(programFile).toContain("GetApplicationProcessPresence");
    expect(programFile).toContain("GetApplicationWindowPresence");
    expect(programFile).toContain("GetOwnerFilePresence");
    expect(programFile).toContain(
      "ApplicationQuitSkippedAfterDegradedObservation"
    );
    expect(programFile).not.toContain(
      "WorkbookClosedObservedByFileLockAfterComLoss"
    );
  });
});
