import { constants } from "node:fs";
import { access, mkdir, open, rename, rm } from "node:fs/promises";
import pathModule from "node:path";

import {
  AGENT_CACHE_SETTINGS_FILE_NAME,
  DEFAULT_AGENT_CACHE_MAX_BYTES,
  getCacheMaxBytes,
  getCacheRoot,
  getStateRoot,
} from "./config.js";

const { isAbsolute, join, resolve } = pathModule;

export type DesktopAgentCacheSettings = {
  cacheRoot: string;
  maxBytes: number;
};

export type UpdateDesktopAgentCacheSettingsInput = {
  cacheRoot: string;
  maxBytes?: number;
};

export function getDesktopAgentCacheSettings(
  env: NodeJS.ProcessEnv = process.env
): DesktopAgentCacheSettings {
  return {
    cacheRoot: getCacheRoot(env),
    maxBytes: getCacheMaxBytes(env),
  };
}

export async function updateDesktopAgentCacheSettings(
  input: UpdateDesktopAgentCacheSettingsInput,
  options: {
    env?: NodeJS.ProcessEnv;
    stateRoot?: string;
  } = {}
): Promise<DesktopAgentCacheSettings> {
  const env = options.env ?? process.env;
  if (env.PROJECT_WING_AGENT_CACHE_ROOT?.trim()) {
    throw new Error(
      "Cache location is managed by PROJECT_WING_AGENT_CACHE_ROOT."
    );
  }
  if (env.PROJECT_WING_AGENT_CACHE_MAX_BYTES?.trim()) {
    throw new Error(
      "Cache capacity is managed by PROJECT_WING_AGENT_CACHE_MAX_BYTES."
    );
  }

  const cacheRoot = input.cacheRoot.trim();
  if (!cacheRoot || !isAbsolute(cacheRoot)) {
    throw new Error("Cache location must be an absolute local path.");
  }
  const resolvedCacheRoot = resolve(cacheRoot);
  const maxBytes = input.maxBytes ?? DEFAULT_AGENT_CACHE_MAX_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("Cache capacity must be a positive integer.");
  }

  await mkdir(resolvedCacheRoot, { recursive: true });
  await access(resolvedCacheRoot, constants.R_OK | constants.W_OK);

  const stateRoot = options.stateRoot ?? getStateRoot(env);
  await mkdir(stateRoot, { recursive: true });
  const settingsPath = join(stateRoot, AGENT_CACHE_SETTINGS_FILE_NAME);
  const temporaryPath = `${settingsPath}.${process.pid}.${Date.now()}.tmp`;
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    handle = await open(temporaryPath, "wx");
    await handle.writeFile(
      JSON.stringify({ cacheRoot: resolvedCacheRoot, maxBytes }, null, 2)
    );
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, settingsPath);
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {});
    }
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }

  return { cacheRoot: resolvedCacheRoot, maxBytes };
}
