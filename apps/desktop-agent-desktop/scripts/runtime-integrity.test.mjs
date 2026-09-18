import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createRuntimeIntegrityManifest } from "./runtime-integrity.mjs";

describe("packaged runtime integrity", () => {
  it("hashes all managed payload files with deterministic relative paths", async () => {
    const fixture = await mkdtemp(
      path.join(os.tmpdir(), "project-wing-integrity-")
    );
    try {
      await mkdir(path.join(fixture, "native"));
      await writeFile(
        path.join(fixture, "ProjectWing.AgentManager.exe"),
        "synthetic manager"
      );
      await writeFile(
        path.join(fixture, "native", "dependency.dll"),
        "synthetic dependency"
      );
      const manifest = await createRuntimeIntegrityManifest(fixture);
      expect(manifest).toEqual({
        schemaVersion: 1,
        files: {
          "native/dependency.dll": createHash("sha256")
            .update("synthetic dependency")
            .digest("hex"),
          "ProjectWing.AgentManager.exe": createHash("sha256")
            .update("synthetic manager")
            .digest("hex"),
        },
      });
      await writeFile(
        path.join(fixture, "native", "dependency.dll"),
        "changed dependency"
      );
      expect(await createRuntimeIntegrityManifest(fixture)).not.toEqual(
        manifest
      );
    } finally {
      if (path.basename(fixture).startsWith("project-wing-integrity-")) {
        await rm(fixture, { recursive: true, force: true });
      }
    }
  });
  it("rejects incomplete payloads instead of producing a recovery manifest", async () => {
    const fixture = await mkdtemp(
      path.join(os.tmpdir(), "project-wing-integrity-")
    );
    try {
      await expect(createRuntimeIntegrityManifest(fixture)).rejects.toThrow(
        "missing its Manager"
      );
    } finally {
      if (path.basename(fixture).startsWith("project-wing-integrity-")) {
        await rm(fixture, { recursive: true, force: true });
      }
    }
  });
});
