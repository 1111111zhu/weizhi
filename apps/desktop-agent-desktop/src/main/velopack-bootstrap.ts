import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { VelopackApp } from "velopack";

import { cleanupLegacyWindowsInstall } from "./legacy-windows-migration";

type VelopackBootstrapOptions = {
  isPackaged: boolean;
  localAppDataPath?: string;
  platform: NodeJS.Platform;
};

type MigrationCallback = () => unknown;

export function createSafeMigrationCallback(
  migrate: MigrationCallback,
  reportFailure: (error: unknown) => void,
  clearFailure: () => void = () => null
) {
  return () => {
    try {
      migrate();
      clearFailure();
      return true;
    } catch (error) {
      try {
        reportFailure(error);
      } catch (reportingError) {
        console.error(
          "Unable to record Desktop Agent migration failure.",
          reportingError
        );
      }
      return false;
    }
  };
}

export function runVelopackBootstrap(options: VelopackBootstrapOptions) {
  const cleanupLegacyInstall = () => cleanupLegacyWindowsInstall(options);
  const safeCleanup = createSafeMigrationCallback(
    cleanupLegacyInstall,
    (error) => writeMigrationFailure(options, error),
    () => clearMigrationFailure(options)
  );

  VelopackApp.build()
    .onAfterInstallFastCallback(safeCleanup)
    .setAutoApplyOnStartup(false)
    .run();
  // Migration is installer-owned. Never run destructive synchronous maintenance
  // during normal/recovery startup, including when another install reappears.
  return safeCleanup;
}

function writeMigrationFailure(
  options: VelopackBootstrapOptions,
  error: unknown
) {
  const failurePath = resolveFailurePath(options);
  if (!failurePath) {
    return;
  }
  mkdirSync(path.win32.dirname(failurePath), { recursive: true });
  writeFileSync(
    failurePath,
    `${JSON.stringify({
      failedAt: new Date().toISOString(),
      message: (error instanceof Error ? error.message : String(error)).slice(
        0,
        2000
      ),
    })}\n`,
    "utf-8"
  );
}

function clearMigrationFailure(options: VelopackBootstrapOptions) {
  const failurePath = resolveFailurePath(options);
  if (failurePath) {
    rmSync(failurePath, { force: true });
  }
}

function resolveFailurePath(options: VelopackBootstrapOptions) {
  if (options.platform !== "win32" || !options.localAppDataPath) {
    return null;
  }
  return path.win32.join(
    options.localAppDataPath,
    "ProjectWing",
    "AgentState",
    "migrations",
    "electron-host-v1.failed.json"
  );
}
