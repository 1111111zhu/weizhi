import { mkdirSync } from "node:fs";
import { access, rm, stat, statfs } from "node:fs/promises";
import pathModule from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { DesktopAgentMode } from "@project-wing/shared/desktop";

import { getCacheMaxBytes, getStateRoot } from "./config.js";
import { DesktopAgentError } from "./errors.js";

export { DEFAULT_AGENT_CACHE_MAX_BYTES } from "./config.js";

const { dirname, isAbsolute, join, relative, resolve } = pathModule;

const CACHE_INDEX_FILE_NAME = "cache.db";
const MINIMUM_DISK_RESERVE_BYTES = 1024 * 1024 * 1024;
const MAXIMUM_DISK_RESERVE_BYTES = 5 * 1024 * 1024 * 1024;

export type CacheEntryState =
  | "CLEAN"
  | "DIRTY"
  | "UPLOADING"
  | "CONFLICT"
  | "MISSING"
  | "REVOKED";

export type DesktopAgentCacheEntry = {
  localPath: string;
  projectId: string;
  attachmentId: string;
  mode: DesktopAgentMode;
  contentToken: string | null;
  remoteVersionId: string | null;
  remoteContentHash: string | null;
  contentHash: string | null;
  sizeBytes: number;
  state: CacheEntryState;
  lastAccessedAt: string;
  accessCount: number;
  pinned: boolean;
};

type CacheEntryRow = {
  local_path: string;
  project_id: string;
  attachment_id: string;
  mode: DesktopAgentMode;
  content_token: string | null;
  remote_version_id: string | null;
  remote_content_hash: string | null;
  content_hash: string | null;
  size_bytes: number;
  state: CacheEntryState;
  last_accessed_at: string;
  access_count: number;
  pinned: number;
};

export type CacheIndexOptions = {
  stateRoot?: string;
  maxBytes?: number;
  now?: () => Date;
};

export function createCacheIndex(options: CacheIndexOptions = {}) {
  const stateRoot = options.stateRoot ?? getStateRoot();
  const now = options.now ?? (() => new Date());
  mkdirSync(stateRoot, { recursive: true });
  const database = new DatabaseSync(join(stateRoot, CACHE_INDEX_FILE_NAME));
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA synchronous = FULL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA busy_timeout = 5000;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS cache_entries (
      local_path TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      attachment_id TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('MASTER', 'READ_ONLY')),
      content_token TEXT,
      remote_version_id TEXT,
      remote_content_hash TEXT,
      content_hash TEXT,
      size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
      state TEXT NOT NULL CHECK (
        state IN ('CLEAN', 'DIRTY', 'UPLOADING', 'CONFLICT', 'MISSING', 'REVOKED')
      ),
      last_accessed_at TEXT NOT NULL,
      access_count INTEGER NOT NULL DEFAULT 0 CHECK (access_count >= 0),
      pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1))
    );
    CREATE INDEX IF NOT EXISTS cache_entries_lru
      ON cache_entries (pinned, last_accessed_at ASC);
  `);
  ensureContentTokenColumn(database);
  ensureCacheIdentityColumns(database);
  database.exec(`
    CREATE INDEX IF NOT EXISTS cache_entries_content_token
      ON cache_entries (project_id, attachment_id, content_token, last_accessed_at DESC);
  `);

  const upsertStatement = database.prepare(`
    INSERT INTO cache_entries (
      local_path,
      project_id,
      attachment_id,
      mode,
      content_token,
      remote_version_id,
      remote_content_hash,
      content_hash,
      size_bytes,
      state,
      last_accessed_at,
      access_count,
      pinned
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
    ON CONFLICT(local_path) DO UPDATE SET
      project_id = excluded.project_id,
      attachment_id = excluded.attachment_id,
      mode = excluded.mode,
      content_token = excluded.content_token,
      remote_version_id = excluded.remote_version_id,
      remote_content_hash = excluded.remote_content_hash,
      content_hash = excluded.content_hash,
      size_bytes = excluded.size_bytes,
      state = excluded.state,
      last_accessed_at = excluded.last_accessed_at,
      access_count = cache_entries.access_count + 1
  `);
  const deleteStatement = database.prepare(
    "DELETE FROM cache_entries WHERE local_path = ?"
  );

  return {
    async recordAccess(input: {
      localPath: string;
      projectId: string;
      attachmentId: string;
      mode: DesktopAgentMode;
      contentToken?: string | null;
      remoteVersionId?: string | null;
      remoteContentHash?: string | null;
      contentHash?: string | null;
      state?: CacheEntryState;
    }) {
      const file = await stat(input.localPath);
      const accessedAt = now().toISOString();
      upsertStatement.run(
        resolve(input.localPath),
        input.projectId,
        input.attachmentId,
        input.mode,
        input.contentToken ?? null,
        input.remoteVersionId ?? null,
        input.remoteContentHash ?? null,
        input.contentHash ?? null,
        file.size,
        input.state ?? "CLEAN",
        accessedAt
      );
      return this.get(input.localPath);
    },

    findReusable(input: {
      projectId: string;
      attachmentId: string;
      contentToken: string;
      remoteVersionId?: string;
      remoteContentHash?: string;
      excludePath?: string;
    }): DesktopAgentCacheEntry | null {
      const rows = database
        .prepare(
          `SELECT * FROM cache_entries
           WHERE project_id = ?
             AND attachment_id = ?
             AND content_token = ?
             AND (? IS NULL OR remote_version_id = ?)
             AND (? IS NULL OR remote_content_hash = ?)
             AND state = 'CLEAN'
           ORDER BY last_accessed_at DESC`
        )
        .all(
          input.projectId,
          input.attachmentId,
          input.contentToken,
          input.remoteVersionId ?? null,
          input.remoteVersionId ?? null,
          input.remoteContentHash ?? null,
          input.remoteContentHash ?? null
        ) as CacheEntryRow[];
      const excluded = input.excludePath ? resolve(input.excludePath) : null;
      const row = rows.find((candidate) => candidate.local_path !== excluded);
      return row ? mapCacheEntry(row) : null;
    },

    get(localPath: string): DesktopAgentCacheEntry | null {
      const row = database
        .prepare("SELECT * FROM cache_entries WHERE local_path = ?")
        .get(resolve(localPath)) as CacheEntryRow | undefined;
      return row ? mapCacheEntry(row) : null;
    },

    list(): DesktopAgentCacheEntry[] {
      return (
        database
          .prepare("SELECT * FROM cache_entries ORDER BY last_accessed_at ASC")
          .all() as CacheEntryRow[]
      ).map(mapCacheEntry);
    },

    setState(localPath: string, state: CacheEntryState) {
      database
        .prepare("UPDATE cache_entries SET state = ? WHERE local_path = ?")
        .run(state, resolve(localPath));
    },

    setPinned(localPath: string, pinned: boolean) {
      database
        .prepare("UPDATE cache_entries SET pinned = ? WHERE local_path = ?")
        .run(pinned ? 1 : 0, resolve(localPath));
    },

    remove(localPath: string) {
      deleteStatement.run(resolve(localPath));
    },

    async trim(input: {
      cacheRoot: string;
      incomingBytes?: number;
      protectedPaths?: Iterable<string>;
    }) {
      const maxBytes = options.maxBytes ?? getCacheMaxBytes();
      const cacheRoot = resolve(input.cacheRoot);
      const incomingBytes = Math.max(0, input.incomingBytes ?? 0);
      const protectedPaths = new Set(
        [...(input.protectedPaths ?? [])].map((value) => resolve(value))
      );
      const rows = database
        .prepare("SELECT * FROM cache_entries ORDER BY last_accessed_at ASC")
        .all() as CacheEntryRow[];

      let indexedBytes = 0;
      const evictionCandidates: CacheEntryRow[] = [];
      for (const row of rows) {
        if (!(await pathExists(row.local_path))) {
          deleteStatement.run(row.local_path);
          continue;
        }
        indexedBytes += row.size_bytes;
        if (
          row.pinned === 0 &&
          (row.state === "CLEAN" || row.state === "REVOKED")
        ) {
          evictionCandidates.push(row);
        }
      }

      const disk = await readDiskCapacity(cacheRoot);
      const reserveBytes = disk
        ? Math.min(
            MAXIMUM_DISK_RESERVE_BYTES,
            Math.max(
              MINIMUM_DISK_RESERVE_BYTES,
              Math.floor(disk.totalBytes * 0.1)
            )
          )
        : 0;
      let bytesToFree = Math.max(
        0,
        indexedBytes + incomingBytes - maxBytes,
        disk ? incomingBytes + reserveBytes - disk.availableBytes : 0
      );
      let freedBytes = 0;

      for (const row of evictionCandidates) {
        if (bytesToFree <= 0) {
          break;
        }
        const localPath = resolve(row.local_path);
        if (
          protectedPaths.has(localPath) ||
          !isInsideRoot(cacheRoot, localPath)
        ) {
          continue;
        }
        try {
          await rm(localPath, { force: true });
          await removeEmptyLeafDirectory(cacheRoot, dirname(localPath));
          deleteStatement.run(localPath);
          freedBytes += row.size_bytes;
          bytesToFree -= row.size_bytes;
        } catch {
          // An open or externally locked file is skipped and remains indexed.
        }
      }

      if (bytesToFree > 0) {
        throw new DesktopAgentError(
          "FILE_WRITE_FAILED",
          "The Desktop Agent cache does not have enough safe free space."
        );
      }

      return { freedBytes };
    },

    close() {
      database.close();
    },
  };
}

export type DesktopAgentCacheIndex = ReturnType<typeof createCacheIndex>;

function mapCacheEntry(row: CacheEntryRow): DesktopAgentCacheEntry {
  return {
    localPath: row.local_path,
    projectId: row.project_id,
    attachmentId: row.attachment_id,
    mode: row.mode,
    contentToken: row.content_token,
    remoteVersionId: row.remote_version_id,
    remoteContentHash: row.remote_content_hash,
    contentHash: row.content_hash,
    sizeBytes: row.size_bytes,
    state: row.state,
    lastAccessedAt: row.last_accessed_at,
    accessCount: row.access_count,
    pinned: row.pinned === 1,
  };
}

function ensureContentTokenColumn(database: DatabaseSync) {
  const columns = database
    .prepare("PRAGMA table_info(cache_entries)")
    .all() as {
    name: string;
  }[];
  if (!columns.some((column) => column.name === "content_token")) {
    database.exec("ALTER TABLE cache_entries ADD COLUMN content_token TEXT;");
  }
}

function ensureCacheIdentityColumns(database: DatabaseSync) {
  const columns = database
    .prepare("PRAGMA table_info(cache_entries)")
    .all() as { name: string }[];
  if (!columns.some((column) => column.name === "remote_version_id")) {
    database.exec(
      "ALTER TABLE cache_entries ADD COLUMN remote_version_id TEXT;"
    );
  }
  if (!columns.some((column) => column.name === "remote_content_hash")) {
    database.exec(
      "ALTER TABLE cache_entries ADD COLUMN remote_content_hash TEXT;"
    );
  }
}

async function readDiskCapacity(cacheRoot: string) {
  try {
    await access(cacheRoot);
    const result = await statfs(cacheRoot);
    return {
      totalBytes: result.blocks * result.bsize,
      availableBytes: result.bavail * result.bsize,
    };
  } catch {
    return null;
  }
}

function isInsideRoot(root: string, target: string) {
  if (!isAbsolute(root) || !isAbsolute(target)) {
    return false;
  }
  const value = relative(root, target);
  return value !== "" && !value.startsWith("..") && !isAbsolute(value);
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function removeEmptyLeafDirectory(cacheRoot: string, directory: string) {
  if (!isInsideRoot(cacheRoot, directory)) {
    return;
  }
  await rm(directory, { recursive: false }).catch(() => {});
}
