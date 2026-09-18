import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { UpdateInfo } from "velopack";
import { describe, expect, it } from "vitest";

import {
  verifyDownloadedUpdate,
  restoreVerifiedPendingUpdate,
} from "./maintenance-handoff";

async function withPackageFixture(
  run: (
    options: {
      executablePath: string;
      resourcesPath: string;
      stateRoot: string;
      update: UpdateInfo;
    },
    packagePath: string
  ) => Promise<void>
) {
  const fixture = await mkdtemp(
    path.join(os.tmpdir(), "project-wing-package-trust-")
  );
  try {
    await mkdir(path.join(fixture, "current"));
    await mkdir(path.join(fixture, "packages"));
    const executablePath = path.join(
      fixture,
      "current",
      "ProjectWingDesktopAgent.exe"
    );
    await writeFile(executablePath, "synthetic exe, never launched");
    const packagePath = path.join(
      fixture,
      "packages",
      "agent-0.3.5-full.nupkg"
    );
    const payload = "synthetic package bytes";
    await writeFile(packagePath, payload);
    await run(
      {
        executablePath,
        resourcesPath: path.join(fixture, "resources"),
        stateRoot: path.join(fixture, "state"),
        update: {
          TargetFullRelease: {
            PackageId: "com.superfx.projectwing.desktop-agent",
            Version: "0.3.5",
            Type: "Full",
            FileName: path.basename(packagePath),
            Size: Buffer.byteLength(payload),
            SHA256: createHash("sha256").update(payload).digest("hex"),
            SHA1: createHash("sha1").update(payload).digest("hex"),
            NotesMarkdown: "",
            NotesHtml: "",
          },
          DeltasToTarget: [],
          IsDowngrade: false,
        },
      },
      packagePath
    );
  } finally {
    if (path.basename(fixture).startsWith("project-wing-package-trust-")) {
      await rm(fixture, { recursive: true, force: true });
    }
  }
}

describe("downloaded update provenance", () => {
  it("persists verified feed metadata for offline pending updates", async () => {
    await withPackageFixture(async (options) => {
      await expect(verifyDownloadedUpdate(options)).resolves.toBe(
        options.update.TargetFullRelease.SHA256
      );
      const pending = {
        ...options.update.TargetFullRelease,
        SHA256: "",
        SHA1: "",
      };
      await expect(
        restoreVerifiedPendingUpdate(pending, options.stateRoot)
      ).resolves.toStrictEqual(options.update);
    });
  });

  it("supports explicitly supplied SHA1 plus size metadata", async () => {
    await withPackageFixture(async (options) => {
      options.update.TargetFullRelease.SHA256 = "";
      await expect(verifyDownloadedUpdate(options)).resolves.toHaveLength(64);
    });
  });

  it("refuses a package with no expected digest instead of inventing trust from cache bytes", async () => {
    await withPackageFixture(async (options, packagePath) => {
      options.update.TargetFullRelease.SHA256 = "";
      options.update.TargetFullRelease.SHA1 = "";
      await expect(verifyDownloadedUpdate(options)).rejects.toThrow(
        "Trusted update metadata is unavailable"
      );
      await expect(readFile(packagePath, "utf-8")).resolves.toBe(
        "synthetic package bytes"
      );
    });
  });

  it("isolates a corrupt cached package so a normal retry can download it afresh", async () => {
    await withPackageFixture(async (options, packagePath) => {
      await writeFile(packagePath, "corrupt cached bytes");
      await expect(verifyDownloadedUpdate(options)).rejects.toThrow(
        "was isolated"
      );
      const entries = await readdir(path.dirname(packagePath));
      expect(entries).toHaveLength(1);
      expect(entries[0]).toContain(".rejected-");
      await expect(
        readFile(path.join(path.dirname(packagePath), entries[0]), "utf-8")
      ).resolves.toBe("corrupt cached bytes");
    });
  });
});
