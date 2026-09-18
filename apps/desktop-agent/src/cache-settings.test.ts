import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  getDesktopAgentCacheSettings,
  updateDesktopAgentCacheSettings,
} from "./cache-settings.js";

const { join } = pathModule;

const roots: string[] = [];

describe("cache-settings", () => {
  afterEach(async () => {
    const { rm } = await import("node:fs/promises");
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
    );
  });

  describe("desktop agent cache settings", () => {
    it("persists a user-selected cache root outside the state directory", async () => {
      const stateRoot = makeRoot("state");
      const cacheRoot = makeRoot("cache");
      const env = {
        PROJECT_WING_AGENT_STATE_ROOT: stateRoot,
      } as NodeJS.ProcessEnv;

      await updateDesktopAgentCacheSettings(
        { cacheRoot, maxBytes: 7_000_000_000 },
        { env, stateRoot }
      );

      expect(getDesktopAgentCacheSettings(env)).toStrictEqual({
        cacheRoot,
        maxBytes: 7_000_000_000,
      });
      expect(
        JSON.parse(
          await readFile(join(stateRoot, "cache-settings.json"), "utf-8")
        )
      ).toStrictEqual({
        cacheRoot,
        maxBytes: 7_000_000_000,
      });
    });

    it("does not override an administrator-managed cache root", async () => {
      const stateRoot = makeRoot("state");
      const managedRoot = makeRoot("managed");
      await expect(
        updateDesktopAgentCacheSettings(
          { cacheRoot: makeRoot("cache") },
          {
            stateRoot,
            env: {
              PROJECT_WING_AGENT_STATE_ROOT: stateRoot,
              PROJECT_WING_AGENT_CACHE_ROOT: managedRoot,
            } as NodeJS.ProcessEnv,
          }
        )
      ).rejects.toThrow("PROJECT_WING_AGENT_CACHE_ROOT");
    });
  });

  function makeRoot(label: string) {
    const root = join(
      tmpdir(),
      `project-wing-cache-settings-${label}-${crypto.randomUUID()}`
    );
    roots.push(root);
    return root;
  }
});
