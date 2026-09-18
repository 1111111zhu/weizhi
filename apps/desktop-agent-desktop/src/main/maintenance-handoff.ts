import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type { UpdateInfo, VelopackAsset } from "velopack";

export type PreparedMaintenance = {
  commit: () => Promise<void>;
  cancel: () => Promise<void>;
};

type MaintenanceOptions = {
  executablePath: string;
  resourcesPath: string;
  stateRoot: string;
  update: UpdateInfo;
};

export async function verifyDownloadedUpdate(options: MaintenanceOptions) {
  const executablePath = await realpath(options.executablePath);
  const asset = options.update.TargetFullRelease;
  const locations = resolveMaintenancePaths(executablePath, asset.FileName);
  const packagePath = await realpath(locations.packagePath);
  if (packagePath.toLowerCase() !== locations.packagePath.toLowerCase()) {
    throw new Error(
      "The downloaded package is redirected; the running application was retained."
    );
  }
  if (
    asset.PackageId !== "com.superfx.projectwing.desktop-agent" ||
    !Number.isSafeInteger(asset.Size) ||
    asset.Size <= 0 ||
    !(asset.SHA256
      ? /^[a-fA-F0-9]{64}$/.test(asset.SHA256)
      : /^[a-fA-F0-9]{40}$/.test(asset.SHA1 ?? ""))
  ) {
    throw new Error(
      "Trusted update metadata is unavailable. Check for updates again before applying this package."
    );
  }
  const sha256 = createHash("sha256");
  const sha1 = createHash("sha1");
  for await (const chunk of createReadStream(packagePath)) {
    sha256.update(chunk);
    sha1.update(chunk);
  }
  const digest256 = sha256.digest("hex");
  const digest1 = sha1.digest("hex");
  const packageStat = await stat(packagePath);
  const matches =
    packageStat.size === asset.Size &&
    (asset.SHA256
      ? digest256 === asset.SHA256.toLowerCase()
      : digest1 === asset.SHA1.toLowerCase());
  if (!matches) {
    // Only the strictly resolved disposable package is quarantined, never
    // session state or workpapers. Velopack's next retry can download it afresh.
    await rename(packagePath, `${packagePath}.rejected-${randomUUID()}`);
    throw new Error(
      "The cached update failed integrity verification and was isolated. Retry Check for updates; your running service and working files were retained."
    );
  }
  const receipts = path.join(options.stateRoot, "verified-update-receipts");
  await mkdir(receipts, { recursive: true });
  const receipt = path.join(receipts, `${asset.FileName}.json`);
  const temporary = `${receipt}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(options.update), {
    encoding: "utf-8",
    flag: "wx",
  });
  await rename(temporary, receipt);
  return digest256;
}

export async function restoreVerifiedPendingUpdate(
  asset: VelopackAsset,
  stateRoot: string
): Promise<UpdateInfo | null> {
  if (
    path.basename(asset.FileName) !== asset.FileName ||
    asset.FileName.includes("\\")
  ) {
    return null;
  }
  try {
    const update = JSON.parse(
      await readFile(
        path.join(
          stateRoot,
          "verified-update-receipts",
          `${asset.FileName}.json`
        ),
        "utf-8"
      )
    ) as UpdateInfo;
    const expected = update.TargetFullRelease;
    return expected.FileName === asset.FileName &&
      expected.Version === asset.Version &&
      expected.PackageId === asset.PackageId &&
      expected.Size === asset.Size
      ? update
      : null;
  } catch {
    return null;
  }
}

export function resolveMaintenancePaths(
  executablePath: string,
  packageName: string
) {
  if (
    path.basename(path.dirname(executablePath)).toLowerCase() !== "current" ||
    path.basename(executablePath).toLowerCase() !==
      "projectwingdesktopagent.exe"
  ) {
    throw new Error(
      "This installation layout cannot safely apply an update in place."
    );
  }
  if (
    path.basename(packageName) !== packageName ||
    packageName.includes("\\") ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.nupkg$/.test(packageName)
  ) {
    throw new Error("Invalid update package name.");
  }
  const installRoot = path.dirname(path.dirname(executablePath));
  return {
    installRoot,
    packagePath: path.join(installRoot, "packages", packageName),
    updaterPath: path.join(installRoot, "Update.exe"),
    manifestPath: path.join(installRoot, "current", "sq.version"),
  };
}

// The immutable helper lives outside Velopack's replaceable current directory.
// It owns both the maintenance lease and the exact updater child across UI exit.
export async function createMaintenanceStagingDirectory(
  stateRoot: string
): Promise<string> {
  const helperParent = path.join(stateRoot, "recovery-helper");
  await mkdir(helperParent, { recursive: true });
  const container = await mkdtemp(path.join(helperParent, "handoff-"));
  // fs.cp with errorOnExist rejects an existing target directory in the
  // packaged Electron runtime. Reserve the container, not the copy target.
  return path.join(container, "runtime");
}

export async function prepareMaintenanceHandoff(
  options: MaintenanceOptions
): Promise<PreparedMaintenance> {
  const executablePath = await realpath(options.executablePath);
  const releaseConfig = JSON.parse(
    await readFile(
      path.join(options.resourcesPath, "desktop-release.json"),
      "utf-8"
    )
  ) as { signaturePolicy?: string };
  if (
    releaseConfig.signaturePolicy !== "optional" &&
    releaseConfig.signaturePolicy !== "required"
  ) {
    throw new Error(
      "The installed update trust policy is missing. The running application was retained."
    );
  }
  const locations = resolveMaintenancePaths(
    executablePath,
    options.update.TargetFullRelease.FileName
  );
  await Promise.all([
    stat(locations.manifestPath),
    stat(locations.updaterPath),
  ]);
  const packageHash = await verifyDownloadedUpdate(options);
  const helperDirectory = await createMaintenanceStagingDirectory(
    options.stateRoot
  );
  // No old helper directories are removed here: another updater may own them.
  await cp(
    path.join(options.resourcesPath, "DesktopRuntime", "managed"),
    helperDirectory,
    { recursive: true, errorOnExist: true, force: false }
  );
  const manifest = JSON.parse(
    await readFile(
      path.join(options.resourcesPath, "desktop-runtime-integrity.json"),
      "utf-8"
    )
  ) as { schemaVersion?: number; files?: Record<string, string> };
  if (
    manifest.schemaVersion !== 1 ||
    !manifest.files?.["ProjectWing.AgentManager.exe"]
  ) {
    throw new Error(
      "The installed recovery helper integrity manifest is invalid."
    );
  }
  for (const [relative, expected] of Object.entries(manifest.files)) {
    if (
      relative.includes("\\") ||
      path.isAbsolute(relative) ||
      relative
        .split("/")
        .some((part) => !part || part === "." || part === "..") ||
      !/^[a-f0-9]{64}$/.test(expected)
    ) {
      throw new Error(
        "The recovery helper integrity manifest contains an invalid path or digest."
      );
    }
    const helperFile = await realpath(path.join(helperDirectory, relative));
    if (
      !helperFile.startsWith(`${await realpath(helperDirectory)}${path.sep}`) ||
      (await hashFile(helperFile)) !== expected
    ) {
      throw new Error(
        "Recovery helper integrity verification failed; the running application was retained."
      );
    }
  }
  const handoffId = randomUUID();
  const child = spawn(
    path.join(helperDirectory, "ProjectWing.AgentManager.exe"),
    [
      "maintenance-handoff",
      "--install-root",
      locations.installRoot,
      "--package-name",
      options.update.TargetFullRelease.FileName,
      "--package-sha256",
      packageHash,
      "--parent-pid",
      String(process.pid),
      "--target-version",
      options.update.TargetFullRelease.Version,
      "--state-root",
      options.stateRoot,
      "--signature-policy",
      releaseConfig.signaturePolicy,
      "--handoff-id",
      handoffId,
    ],
    { cwd: helperDirectory, windowsHide: true, stdio: "pipe" }
  );
  return await awaitMaintenancePreparation(child, async () => {
    try {
      const status = JSON.parse(
        await readFile(
          path.join(options.stateRoot, "update-status.json"),
          "utf-8"
        )
      ) as Record<string, unknown>;
      return (
        child.exitCode === null &&
        child.signalCode === null &&
        status.taskId === handoffId &&
        status.ownerPid === child.pid &&
        status.ownerKind === "velopack-handoff-v1" &&
        status.status === "REPAIRING_ENVIRONMENT" &&
        status.handoffPhase === "AWAITING_APP_EXIT"
      );
    } catch {
      return false;
    }
  });
}

export async function awaitMaintenancePreparation(
  child: ChildProcessWithoutNullStreams,
  confirmCommitted: () => Promise<boolean> = () => Promise.resolve(false)
): Promise<PreparedMaintenance> {
  let buffer = "";
  let errorText = "";
  let committed = false;
  let childExited = false;
  let wait: {
    status: string;
    resolve: () => void;
    reject: (error: Error) => void;
  } | null = null;
  let failure: Error | null = null;
  const fail = (error: Error) => {
    failure = error;
    wait?.reject(error);
    wait = null;
  };
  child.on("error", fail);
  child.stdin.on("error", fail);
  child.stdout.on("error", fail);
  child.stderr.on("error", fail);
  child.on("exit", (code) => {
    childExited = true;
    if (!committed) {
      fail(
        new Error(
          `Update preparation stopped (${code ?? "signal"}). ${errorText}`
        )
      );
    }
  });
  child.stderr.on("data", (chunk) => {
    errorText = (errorText + String(chunk)).slice(-2000);
  });
  child.stdout.on("data", (chunk) => {
    buffer += String(chunk);
    if (buffer.length > 65_536) {
      fail(new Error("Invalid update helper response."));
      child.stdin.end();
      return;
    }
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      try {
        const message = JSON.parse(line) as { status?: string; error?: string };
        if (wait && message.status === wait.status) {
          wait.resolve();
          wait = null;
        } else if (message.status === "FAILED") {
          fail(new Error(message.error ?? "Update preparation failed."));
        }
      } catch {
        /* Non-protocol diagnostics are not readiness. */
      }
    }
  });
  const waitFor = (status: string, timeoutMs: number) =>
    new Promise<void>((resolve, reject) => {
      if (failure) {
        reject(failure);
        return;
      }
      const timer = setTimeout(() => {
        wait = null;
        reject(
          new Error(
            "The update helper did not confirm readiness; the application was retained."
          )
        );
      }, timeoutMs);
      wait = {
        status,
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
    });
  try {
    await waitFor("PREPARED", 60_000);
  } catch (error) {
    child.stdin.end();
    throw error;
  }
  return {
    async commit() {
      const ready = waitFor("COMMITTED", 15_000);
      child.stdin.write(`${JSON.stringify({ command: "commit" })}\n`);
      try {
        await ready;
      } catch (error) {
        if (childExited || !(await confirmCommitted())) {
          throw error;
        }
      }
      committed = true;
      // The helper continues independently; it is deliberately not killed.
      child.unref();
    },
    cancel() {
      if (!child.stdin.writableEnded) {
        child.stdin.write(`${JSON.stringify({ command: "cancel" })}\n`);
        child.stdin.end();
      }
      return Promise.resolve();
    },
  };
}

async function hashFile(filePath: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}
