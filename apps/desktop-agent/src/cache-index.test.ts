import { mkdir, rm, writeFile } from "node:fs/promises";
import type * as FileSystemPromises from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCacheIndex } from "./cache-index.js";

const { dirname, join } = pathModule;

const roots: string[] = [];
const diskCapacity = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof FileSystemPromises>()),
  statfs: diskCapacity,
}));

describe("cache-index", () => {
  beforeEach(() => {
    // LRU tests operate on tiny isolated files; the host's free disk is not the fixture.
    diskCapacity.mockResolvedValue({
      bsize: 1024,
      blocks: 100 * 1024 * 1024,
      bavail: 100 * 1024 * 1024,
    });
  });
  afterEach(async () => {
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
    );
  });

  describe("desktop agent cache index", () => {
    it("fails closed under disk pressure without evicting dirty evidence", async () => {
      const stateRoot = makeRoot("pressure-state");
      const cacheRoot = makeRoot("pressure-cache");
      const dirtyPath = join(cacheRoot, "project", "dirty.xlsx");
      await writeSizedFile(dirtyPath, 6);
      diskCapacity.mockResolvedValue({
        bsize: 1024,
        blocks: 100 * 1024 * 1024,
        bavail: 0,
      });
      const index = createCacheIndex({ stateRoot, maxBytes: 12 });
      try {
        await index.recordAccess({
          ...makeEntry(dirtyPath, "dirty"),
          state: "DIRTY",
        });
        await expect(index.trim({ cacheRoot })).rejects.toMatchObject({
          code: "FILE_WRITE_FAILED",
        });
        await expectPathPresent(dirtyPath);
        expect(index.list()).toHaveLength(1);
      } finally {
        index.close();
      }
    });

    it("evicts the least recently opened clean file first", async () => {
      const stateRoot = makeRoot("state");
      const cacheRoot = makeRoot("cache");
      const firstPath = join(cacheRoot, "project", "first.xlsx");
      const secondPath = join(cacheRoot, "project", "second.xlsx");
      await writeSizedFile(firstPath, 6);
      await writeSizedFile(secondPath, 6);
      const timestamps = [
        new Date("2026-07-01T00:00:00.000Z"),
        new Date("2026-07-02T00:00:00.000Z"),
      ];
      const index = createCacheIndex({
        stateRoot,
        maxBytes: 10,
        now: () => timestamps.shift() ?? new Date(),
      });

      try {
        await index.recordAccess(makeEntry(firstPath, "first"));
        await index.recordAccess(makeEntry(secondPath, "second"));
        await index.trim({ cacheRoot });

        await expectPathMissing(firstPath);
        await expectPathPresent(secondPath);
        expect(index.list().map((entry) => entry.attachmentId)).toStrictEqual([
          "second",
        ]);
      } finally {
        index.close();
      }
    });

    it("never evicts dirty or active-session files", async () => {
      const stateRoot = makeRoot("state");
      const cacheRoot = makeRoot("cache");
      const dirtyPath = join(cacheRoot, "project", "dirty.xlsx");
      const activePath = join(cacheRoot, "project", "active.xlsx");
      const cleanPath = join(cacheRoot, "project", "clean.xlsx");
      await Promise.all([
        writeSizedFile(dirtyPath, 6),
        writeSizedFile(activePath, 6),
        writeSizedFile(cleanPath, 6),
      ]);
      const index = createCacheIndex({ stateRoot, maxBytes: 12 });
      try {
        await index.recordAccess({
          ...makeEntry(dirtyPath, "dirty"),
          state: "DIRTY",
        });
        await index.recordAccess(makeEntry(activePath, "active"));
        await index.recordAccess(makeEntry(cleanPath, "clean"));

        await index.trim({ cacheRoot, protectedPaths: [activePath] });

        await expectPathPresent(dirtyPath);
        await expectPathPresent(activePath);
        await expectPathMissing(cleanPath);
        expect(index.list()).toHaveLength(2);
      } finally {
        index.close();
      }
    });

    it("finds the newest clean file for the same remote content token", async () => {
      const stateRoot = makeRoot("state");
      const cacheRoot = makeRoot("cache");
      const firstPath = join(cacheRoot, "project", "first.xlsx");
      const secondPath = join(cacheRoot, "project", "second.xlsx");
      await Promise.all([
        writeSizedFile(firstPath, 6),
        writeSizedFile(secondPath, 6),
      ]);
      const timestamps = [
        new Date("2026-07-01T00:00:00.000Z"),
        new Date("2026-07-02T00:00:00.000Z"),
      ];
      const index = createCacheIndex({
        stateRoot,
        now: () => timestamps.shift() ?? new Date(),
      });

      await index.recordAccess({
        ...makeEntry(firstPath, "attachment-1"),
        contentToken: "remote-version-1",
        remoteVersionId: "version-id-1",
        remoteContentHash: "content-hash-1",
      });
      await index.recordAccess({
        ...makeEntry(secondPath, "attachment-1"),
        contentToken: "remote-version-1",
        remoteVersionId: "version-id-1",
        remoteContentHash: "content-hash-1",
      });

      expect(
        index.findReusable({
          projectId: "project-1",
          attachmentId: "attachment-1",
          contentToken: "remote-version-1",
          remoteVersionId: "version-id-1",
          remoteContentHash: "content-hash-1",
        })?.localPath
      ).toBe(secondPath);
      expect(
        index.findReusable({
          projectId: "project-1",
          attachmentId: "attachment-1",
          contentToken: "remote-version-1",
          excludePath: secondPath,
        })?.localPath
      ).toBe(firstPath);
      expect(
        index.findReusable({
          projectId: "project-1",
          attachmentId: "attachment-1",
          contentToken: "remote-version-2",
        })
      ).toBeNull();
      expect(
        index.findReusable({
          projectId: "project-1",
          attachmentId: "attachment-1",
          contentToken: "remote-version-1",
          remoteVersionId: "version-id-2",
          remoteContentHash: "content-hash-1",
        })
      ).toBeNull();
      expect(
        index.findReusable({
          projectId: "project-1",
          attachmentId: "attachment-1",
          contentToken: "remote-version-1",
          remoteVersionId: "version-id-1",
          remoteContentHash: "content-hash-2",
        })
      ).toBeNull();
      index.close();
    });

    it("removes cache accounting without deleting the managed file", async () => {
      const stateRoot = makeRoot("state");
      const cacheRoot = makeRoot("cache");
      const snapshotPath = join(cacheRoot, "project", "upload.snapshot");
      await writeSizedFile(snapshotPath, 6);
      const index = createCacheIndex({ stateRoot });
      await index.recordAccess({
        ...makeEntry(snapshotPath, "attachment-1"),
        state: "UPLOADING",
      });

      index.remove(snapshotPath);

      expect(index.get(snapshotPath)).toBeNull();
      await expectPathPresent(snapshotPath);
      index.close();
    });
  });

  function makeEntry(localPath: string, attachmentId: string) {
    return {
      localPath,
      projectId: "project-1",
      attachmentId,
      mode: "MASTER" as const,
      contentHash: `${attachmentId}-hash`,
      state: "CLEAN" as const,
    };
  }

  function makeRoot(label: string) {
    const root = join(
      tmpdir(),
      `project-wing-cache-index-${label}-${crypto.randomUUID()}`
    );
    roots.push(root);
    return root;
  }

  async function writeSizedFile(path: string, size: number) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.alloc(size, 1));
  }

  async function expectPathPresent(path: string) {
    const { access } = await import("node:fs/promises");
    await expect(access(path)).resolves.toBeUndefined();
  }

  async function expectPathMissing(path: string) {
    const { access } = await import("node:fs/promises");
    await expect(access(path)).rejects.toBeDefined();
  }
});
