import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildCacheFilePath, sanitizeFileName } from "./path-safety.js";

const { basename, join, resolve } = pathModule;

const roots: string[] = [];

describe("path-safety", () => {
  afterEach(async () => {
    await Promise.all(
      roots.map((root) => rm(root, { recursive: true, force: true }))
    );
    roots.length = 0;
  });

  async function makeRoot() {
    const root = await mkdtemp(join(tmpdir(), "project-wing-agent-"));
    roots.push(root);
    return root;
  }

  describe("desktop agent path safety", () => {
    it("sanitizes unsafe file names", () => {
      expect(sanitizeFileName("../cash?.xlsx")).toBe("cash_.xlsx");
      expect(sanitizeFileName("   ")).toBe("project-wing-file");
    });

    it("keeps generated cache paths inside the cache root", async () => {
      const cacheRoot = await makeRoot();
      const localPath = buildCacheFilePath({
        cacheRoot,
        mode: "MASTER",
        projectId: "../project-1",
        attachmentId: "..\\attachment-1",
        lockSessionId: "lock-session-1",
        fileName: "../cash?.xlsx",
      });

      expect(resolve(localPath).startsWith(resolve(cacheRoot))).toBeTruthy();
      expect(basename(localPath)).toBe("cash_.xlsx");
    });

    it("separates master and read-only cache paths", async () => {
      const cacheRoot = await makeRoot();
      const masterPath = buildCacheFilePath({
        cacheRoot,
        mode: "MASTER",
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        fileName: "cash.xlsx",
      });
      const readOnlyPath = buildCacheFilePath({
        cacheRoot,
        mode: "READ_ONLY",
        projectId: "project-1",
        attachmentId: "attachment-1",
        fileName: "cash.xlsx",
      });

      expect(masterPath).not.toBe(readOnlyPath);
    });

    it("keeps separate master cache paths for separate lock sessions", async () => {
      const cacheRoot = await makeRoot();
      const firstPath = buildCacheFilePath({
        cacheRoot,
        mode: "MASTER",
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        fileName: "cash.xlsx",
      });
      const secondPath = buildCacheFilePath({
        cacheRoot,
        mode: "MASTER",
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-2",
        fileName: "cash.xlsx",
      });

      expect(firstPath).not.toBe(secondPath);
      expect(firstPath).toContain("lock-session-1");
      expect(secondPath).toContain("lock-session-2");
    });

    it("reuses a versioned master cache path across lock sessions", async () => {
      const cacheRoot = await makeRoot();
      const firstPath = buildCacheFilePath({
        cacheRoot,
        mode: "MASTER",
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        cacheVersionId: "attachment-version-2",
        fileName: "cash.xlsx",
      });
      const secondPath = buildCacheFilePath({
        cacheRoot,
        mode: "MASTER",
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-2",
        cacheVersionId: "attachment-version-2",
        fileName: "cash.xlsx",
      });

      expect(firstPath).toBe(secondPath);
      expect(firstPath).not.toContain("attachment-version-2");
      expect(firstPath).toContain("version-");
    });

    it("requires lockSessionId for master cache paths", async () => {
      const cacheRoot = await makeRoot();

      expect(() =>
        buildCacheFilePath({
          cacheRoot,
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
        })
      ).toThrow("Master cache paths require lockSessionId.");
    });
  });
});
