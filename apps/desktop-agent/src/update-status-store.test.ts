import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createUpdateStatusStore,
  getUpdateStatusPath,
} from "./update-status-store.js";

const { join } = pathModule;

const roots: string[] = [];

describe("update-status-store", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
    );
  });

  async function makeRoot() {
    const root = await mkdtemp(join(tmpdir(), "project-wing-update-status-"));
    roots.push(root);
    return root;
  }

  describe("update status store", () => {
    it("writes and reads status atomically", async () => {
      const root = await makeRoot();
      const store = createUpdateStatusStore(root);

      await store.write({
        ok: true,
        status: "DOWNLOADING",
        taskId: "task-1",
        message: "Downloading Desktop Agent update.",
        startedAt: "2026-06-17T12:00:00.000Z",
        updatedAt: "2026-06-17T12:00:01.000Z",
      });

      await expect(store.read()).resolves.toMatchObject({
        ok: true,
        status: "DOWNLOADING",
        taskId: "task-1",
      });

      const raw = await readFile(getUpdateStatusPath(root), "utf-8");
      expect(JSON.parse(raw)).toMatchObject({ status: "DOWNLOADING" });
    });

    it("returns null when status file does not exist", async () => {
      const store = createUpdateStatusStore(await makeRoot());
      await expect(store.read()).resolves.toBeNull();
    });

    it("returns failed status for corrupt JSON", async () => {
      const root = await makeRoot();
      await writeFile(getUpdateStatusPath(root), "{bad json", "utf-8");
      const store = createUpdateStatusStore(root);

      await expect(store.read()).resolves.toMatchObject({
        ok: true,
        status: "FAILED",
        errorCode: "UNKNOWN_ERROR",
      });
    });

    it("uses unique temp files for concurrent writes in the same millisecond", async () => {
      vi.spyOn(Date, "now").mockReturnValue(1_781_694_000_000);
      const root = await makeRoot();
      const store = createUpdateStatusStore(root);

      await expect(
        Promise.all(
          Array.from({ length: 8 }, (_, index) =>
            store.write({
              ok: true,
              status: "DOWNLOADING",
              taskId: `task-${index}`,
              message: "Downloading Desktop Agent update.",
              updatedAt: "2026-06-17T12:00:01.000Z",
            })
          )
        )
      ).resolves.toHaveLength(8);

      await expect(store.read()).resolves.toMatchObject({
        ok: true,
        status: "DOWNLOADING",
      });
    });

    it("returns failed status for invalid status shape", async () => {
      const root = await makeRoot();
      await writeFile(
        getUpdateStatusPath(root),
        JSON.stringify({ ok: true, status: "NOT_REAL" }),
        "utf-8"
      );
      const store = createUpdateStatusStore(root);

      await expect(store.read()).resolves.toMatchObject({
        ok: true,
        status: "FAILED",
        errorCode: "UNKNOWN_ERROR",
      });
    });
  });
});
