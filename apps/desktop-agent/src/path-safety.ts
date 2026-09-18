import { createHash } from "node:crypto";
import pathModule from "node:path";

import type { DesktopAgentMode } from "@project-wing/shared/desktop";

import { DesktopAgentError } from "./errors.js";

const { basename, dirname, isAbsolute, relative, resolve } = pathModule;

const FALLBACK_FILE_NAME = "project-wing-file";
const UNSAFE_FILE_CHARS = /[<>:"/\\|?*]/;

export type CacheFilePathInput = {
  cacheRoot: string;
  mode: DesktopAgentMode;
  projectId: string;
  attachmentId: string;
  lockSessionId?: string;
  cacheVersionId?: string;
  fileName: string;
};

export function sanitizeFileName(fileName: string) {
  const normalized = fileName.replaceAll("\\", "/");
  const baseName = basename(normalized);
  const sanitized = [...baseName]
    .map((character) =>
      (character.codePointAt(0) ?? 0) < 32 || UNSAFE_FILE_CHARS.test(character)
        ? "_"
        : character
    )
    .join("")
    .trim();
  return sanitized || FALLBACK_FILE_NAME;
}

export function buildCacheFilePath(input: CacheFilePathInput) {
  const cacheRoot = resolve(input.cacheRoot);
  const sessionSegment =
    input.mode === "MASTER"
      ? input.cacheVersionId
        ? makeCacheVersionSegment(input.cacheVersionId)
        : sanitizePathSegment(requireLockSessionId(input.lockSessionId))
      : "read-only";
  const localPath = resolve(
    cacheRoot,
    sanitizePathSegment(input.projectId),
    sanitizePathSegment(input.attachmentId),
    input.mode === "MASTER" ? "master" : "read-only",
    sessionSegment,
    sanitizeFileName(input.fileName)
  );

  assertInsideRoot(cacheRoot, localPath);
  return localPath;
}

export function getCacheDirectory(input: CacheFilePathInput) {
  return dirname(buildCacheFilePath(input));
}

function sanitizePathSegment(value: string) {
  return sanitizeFileName(value).replaceAll(/\.+/g, "_") || FALLBACK_FILE_NAME;
}

function requireLockSessionId(lockSessionId?: string) {
  if (!lockSessionId?.trim()) {
    throw new DesktopAgentError(
      "VALIDATION_FAILED",
      "Master cache paths require lockSessionId."
    );
  }
  return lockSessionId;
}

function makeCacheVersionSegment(cacheVersionId: string) {
  return `version-${createHash("sha256")
    .update(cacheVersionId)
    .digest("hex")
    .slice(0, 32)}`;
}

function assertInsideRoot(root: string, target: string) {
  const relativePath = relative(root, target);
  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    throw new DesktopAgentError(
      "FILE_WRITE_FAILED",
      "Generated cache path escaped the cache root."
    );
  }
}
