import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createSessionStore,
  hashFile,
  reconcileSession,
  retryTransientFileSystemOperation,
} from "./session-store.js";

const { join } = pathModule;

const roots: string[] = [];

describe("session-store", () => {
  afterEach(async () => {
    await Promise.all(
      roots.map((root) => rm(root, { recursive: true, force: true }))
    );
    roots.length = 0;
  });

  async function makeRoot() {
    const root = await mkdtemp(join(tmpdir(), "project-wing-agent-state-"));
    roots.push(root);
    return root;
  }

  describe("desktop agent session store", () => {
    it("persists and reloads sessions without tokens", async () => {
      const stateRoot = await makeRoot();
      const store = createSessionStore({
        stateRoot,
        now: () => new Date("2026-06-05T02:00:00.000Z"),
      });

      await store.upsert({
        sessionId: "session-1",
        mode: "MASTER",
        projectId: "project-1",
        attachmentId: "attachment-1",
        fileName: "cash.xlsx",
        localPath: "C:\\ProjectWing\\cash.xlsx",
        originalHash: "hash-1",
        lastKnownHash: "hash-1",
        status: "OPEN_UNCHANGED",
        lifecycleState: "OPEN_NOT_OBSERVED",
        contentState: "UNCHANGED",
        openedAt: "2026-06-05T01:55:00.000Z",
        launchStartedAt: "2026-06-05T01:55:00.000Z",
        lastSeenAt: "2026-06-05T01:55:00.000Z",
      });

      const reloaded = createSessionStore({ stateRoot });
      await expect(reloaded.list()).resolves.toStrictEqual([
        expect.objectContaining({
          sessionId: "session-1",
          status: "OPEN_UNCHANGED",
          generation: 1,
          openSignalToken: expect.any(String),
          closeSignalToken: expect.any(String),
        }),
      ]);
      expect(JSON.stringify(await reloaded.list())).not.toContain("Bearer");
    });

    it("serializes concurrent session writes", async () => {
      const stateRoot = await makeRoot();
      const store = createSessionStore({
        stateRoot,
        now: () => new Date("2026-06-05T02:00:00.000Z"),
      });

      await Promise.all([
        store.upsert({
          ...makeSession({
            localPath: "C:\\ProjectWing\\cash.xlsx",
            originalHash: "hash-1",
          }),
          sessionId: "session-1",
          attachmentId: "attachment-1",
        }),
        store.upsert({
          ...makeSession({
            localPath: "C:\\ProjectWing\\inventory.xlsx",
            originalHash: "hash-2",
          }),
          sessionId: "session-2",
          attachmentId: "attachment-2",
        }),
      ]);

      await expect(
        store
          .list()
          .then((sessions) =>
            sessions.map((session) => session.sessionId).sort()
          )
      ).resolves.toStrictEqual(["session-1", "session-2"]);
    });

    it("retries transient file-system operations before failing", async () => {
      let attempts = 0;

      await expect(
        retryTransientFileSystemOperation(
          async () => {
            await Promise.resolve();
            attempts += 1;
            if (attempts < 3) {
              throw Object.assign(new Error("busy"), { code: "EPERM" });
            }
            return "ok";
          },
          { retries: 3, delayMs: 0 }
        )
      ).resolves.toBe("ok");
      expect(attempts).toBe(3);
    });

    it.each(["EMFILE", "ENFILE"])(
      "retries file descriptor exhaustion errors before failing",
      async (code) => {
        let attempts = 0;

        await expect(
          retryTransientFileSystemOperation(
            async () => {
              await Promise.resolve();
              attempts += 1;
              if (attempts < 3) {
                throw Object.assign(new Error("too many open files"), { code });
              }
              return "ok";
            },
            { retries: 3, delayMs: 0 }
          )
        ).resolves.toBe("ok");
        expect(attempts).toBe(3);
      }
    );

    it("stops retrying transient file-system operations after the retry budget", async () => {
      let attempts = 0;

      await expect(
        retryTransientFileSystemOperation(
          async () => {
            await Promise.resolve();
            attempts += 1;
            throw Object.assign(new Error("busy"), { code: "EBUSY" });
          },
          { retries: 2, delayMs: 0 }
        )
      ).rejects.toMatchObject({ code: "EBUSY" });
      expect(attempts).toBe(2);
    });

    it("tolerates a UTF-8 BOM in the persisted sessions file", async () => {
      const stateRoot = await makeRoot();
      await mkdir(stateRoot, { recursive: true });
      await writeFile(join(stateRoot, "sessions.json"), "\uFEFF[]", "utf-8");

      const store = createSessionStore({ stateRoot });

      await expect(store.list()).resolves.toStrictEqual([]);
    });

    it("quarantines invalid persisted sessions instead of silently dropping them", async () => {
      const stateRoot = await makeRoot();
      await mkdir(stateRoot, { recursive: true });
      const invalidSession = {
        sessionId: "future-session",
        lifecycleState: "FUTURE_STATE",
        grantSecret: "recovery-secret",
      };
      const sessionFile = join(stateRoot, "sessions.json");
      await writeFile(sessionFile, JSON.stringify([invalidSession]), "utf-8");
      const store = createSessionStore({ stateRoot });

      await expect(store.list()).resolves.toStrictEqual([]);
      expect(store.getRecoveryStatus()).toStrictEqual({
        state: "DEGRADED_NEEDS_ATTENTION",
        quarantinedCount: 1,
        message: "Desktop Agent quarantined 1 invalid persisted session(s).",
      });

      await expect(readFile(sessionFile, "utf-8")).resolves.toContain(
        "recovery-secret"
      );
      await expect(
        readFile(join(stateRoot, "sessions.quarantine.json"), "utf-8")
      ).resolves.toContain("recovery-secret");
    });

    it("keeps valid sessions alive when another persisted session is quarantined", async () => {
      const stateRoot = await makeRoot();
      const localPath = join(stateRoot, "valid.xlsx");
      await writeFile(localPath, "valid");
      const originalHash = await hashFile(localPath);
      const validSession = makeSession({ localPath, originalHash });
      await writeFile(
        join(stateRoot, "sessions.json"),
        JSON.stringify([
          validSession,
          {
            sessionId: "future-session",
            lifecycleState: "FUTURE_STATE",
            grantSecret: "recovery-secret",
          },
        ]),
        "utf-8"
      );

      const store = createSessionStore({ stateRoot });

      await expect(store.refresh()).resolves.toStrictEqual([
        expect.objectContaining({ sessionId: "session-1" }),
      ]);
      expect(store.getRecoveryStatus()).toMatchObject({
        state: "DEGRADED_NEEDS_ATTENTION",
        quarantinedCount: 1,
      });

      const restarted = createSessionStore({ stateRoot });
      await expect(restarted.list()).resolves.toHaveLength(1);
      expect(restarted.getRecoveryStatus()).toMatchObject({
        state: "DEGRADED_NEEDS_ATTENTION",
        quarantinedCount: 1,
      });
    });

    it("normalizes legacy sessions before schema validation", async () => {
      const stateRoot = await makeRoot();
      await mkdir(stateRoot, { recursive: true });
      const localPath = join(stateRoot, "legacy.xlsx");
      await writeFile(localPath, "same");
      const originalHash = await hashFile(localPath);
      await writeFile(
        join(stateRoot, "sessions.json"),
        JSON.stringify([
          {
            sessionId: "session-1",
            lockSessionId: "lock-session-1",
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "legacy.xlsx",
            localPath,
            baseVersion: 1,
            originalHash,
            lastKnownHash: originalHash,
            grantSecret: "grant-secret",
            status: "OPEN_UNCHANGED",
            openedAt: "2026-06-05T01:55:00.000Z",
            lastSeenAt: "2026-06-05T01:55:00.000Z",
          },
        ]),
        "utf-8"
      );

      const store = createSessionStore({ stateRoot });

      await expect(store.list()).resolves.toStrictEqual([
        expect.objectContaining({
          sessionId: "session-1",
          generation: 1,
          lifecycleState: "OPEN_NOT_OBSERVED",
          contentState: "UNCHANGED",
          launchStartedAt: "2026-06-05T01:55:00.000Z",
          openSignalToken: expect.any(String),
          closeSignalToken: expect.any(String),
        }),
      ]);
    });

    it("normalizes legacy closed dirty sessions to close detected", async () => {
      const stateRoot = await makeRoot();
      await mkdir(stateRoot, { recursive: true });
      const originalPath = join(stateRoot, "original.xlsx");
      const localPath = join(stateRoot, "dirty.xlsx");
      await writeFile(originalPath, "original");
      await writeFile(localPath, "changed");
      const originalHash = await hashFile(originalPath);
      const dirtyHash = await hashFile(localPath);
      await writeFile(
        join(stateRoot, "sessions.json"),
        JSON.stringify([
          {
            sessionId: "session-1",
            lockSessionId: "lock-session-1",
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "dirty.xlsx",
            localPath,
            baseVersion: 1,
            originalHash,
            lastKnownHash: dirtyHash,
            grantSecret: "grant-secret",
            status: "DIRTY_PENDING_CHECKIN",
            openedAt: "2026-06-05T01:55:00.000Z",
            lastSeenAt: "2026-06-05T01:55:00.000Z",
            closeDetectedAt: "2026-06-05T02:05:00.000Z",
          },
        ]),
        "utf-8"
      );

      const store = createSessionStore({ stateRoot });

      await expect(store.list()).resolves.toStrictEqual([
        expect.objectContaining({
          lifecycleState: "CLOSE_DETECTED",
          contentState: "DIRTY",
        }),
      ]);
    });

    it("backfills pending release fields for legacy release failures", async () => {
      const stateRoot = await makeRoot();
      await mkdir(stateRoot, { recursive: true });
      const localPath = join(stateRoot, "uploaded.xlsx");
      await writeFile(localPath, "uploaded");
      const uploadedHash = await hashFile(localPath);
      await writeFile(
        join(stateRoot, "sessions.json"),
        JSON.stringify([
          {
            sessionId: "session-1",
            lockSessionId: "lock-session-1",
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "uploaded.xlsx",
            localPath,
            baseVersion: 1,
            originalHash: "original-hash",
            lastKnownHash: uploadedHash,
            lastUploadedHash: uploadedHash,
            grantSecret: "grant-secret",
            status: "RELEASE_FAILED",
            openedAt: "2026-06-05T01:55:00.000Z",
            lastSeenAt: "2026-06-05T01:55:00.000Z",
            closeDetectedAt: "2026-06-05T02:05:00.000Z",
          },
        ]),
        "utf-8"
      );

      const store = createSessionStore({ stateRoot });

      await expect(store.list()).resolves.toStrictEqual([
        expect.objectContaining({
          lifecycleState: "RELEASE_FAILED",
          pendingReleaseReason: "CHECKED_IN",
          pendingReleaseHash: uploadedHash,
        }),
      ]);
    });

    it("derives a missing pending release hash when the pending reason is present", async () => {
      const stateRoot = await makeRoot();
      await mkdir(stateRoot, { recursive: true });
      const localPath = join(stateRoot, "uploaded.xlsx");
      await writeFile(localPath, "uploaded");
      const uploadedHash = await hashFile(localPath);
      await writeFile(
        join(stateRoot, "sessions.json"),
        JSON.stringify([
          {
            sessionId: "session-1",
            lockSessionId: "lock-session-1",
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "uploaded.xlsx",
            localPath,
            baseVersion: 1,
            originalHash: "original-hash",
            lastKnownHash: uploadedHash,
            lastUploadedHash: uploadedHash,
            grantSecret: "grant-secret",
            status: "RELEASE_FAILED",
            pendingReleaseReason: "CHECKED_IN",
            openedAt: "2026-06-05T01:55:00.000Z",
            lastSeenAt: "2026-06-05T01:55:00.000Z",
            closeDetectedAt: "2026-06-05T02:05:00.000Z",
          },
        ]),
        "utf-8"
      );

      const store = createSessionStore({ stateRoot });

      await expect(store.list()).resolves.toStrictEqual([
        expect.objectContaining({
          lifecycleState: "RELEASE_FAILED",
          pendingReleaseReason: "CHECKED_IN",
          pendingReleaseHash: uploadedHash,
        }),
      ]);
    });

    it("keeps ambiguous legacy release failures as conflict risk", async () => {
      const stateRoot = await makeRoot();
      await mkdir(stateRoot, { recursive: true });
      const localPath = join(stateRoot, "ambiguous.xlsx");
      await writeFile(localPath, "changed");
      await writeFile(
        join(stateRoot, "sessions.json"),
        JSON.stringify([
          {
            sessionId: "session-1",
            lockSessionId: "lock-session-1",
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "ambiguous.xlsx",
            localPath,
            baseVersion: 1,
            originalHash: "original-hash",
            lastKnownHash: "stale-hash",
            grantSecret: "grant-secret",
            status: "RELEASE_FAILED",
            openedAt: "2026-06-05T01:55:00.000Z",
            lastSeenAt: "2026-06-05T01:55:00.000Z",
            closeDetectedAt: "2026-06-05T02:05:00.000Z",
          },
        ]),
        "utf-8"
      );

      const store = createSessionStore({ stateRoot });

      await expect(store.list()).resolves.toStrictEqual([
        expect.objectContaining({
          lifecycleState: "CONFLICT_RISK",
          status: "CONFLICT_RISK",
          lastError: expect.stringContaining("pending release"),
        }),
      ]);
    });

    it("restores unchanged, dirty, and missing session states", async () => {
      const stateRoot = await makeRoot();
      await mkdir(stateRoot, { recursive: true });
      const unchangedPath = join(stateRoot, "unchanged.xlsx");
      const dirtyPath = join(stateRoot, "dirty.xlsx");
      const missingPath = join(stateRoot, "missing.xlsx");
      await writeFile(unchangedPath, "same");
      await writeFile(dirtyPath, "changed");
      const originalHash = await hashFile(unchangedPath);
      const changedOriginalPath = await writeTempOriginal(stateRoot);
      const changedOriginalHash = await hashFile(changedOriginalPath);

      await expect(
        reconcileSession(
          makeSession({ localPath: unchangedPath, originalHash }),
          new Date("2026-06-05T02:00:00.000Z")
        )
      ).resolves.toStrictEqual(
        expect.objectContaining({
          status: "OPEN_UNCHANGED",
          lastKnownHash: originalHash,
        })
      );
      await expect(
        reconcileSession(
          makeSession({
            localPath: dirtyPath,
            originalHash: changedOriginalHash,
          }),
          new Date("2026-06-05T02:00:00.000Z")
        )
      ).resolves.toStrictEqual(
        expect.objectContaining({
          status: "DIRTY_PENDING_CHECKIN",
        })
      );
      await expect(
        reconcileSession(
          makeSession({ localPath: missingPath, originalHash }),
          new Date("2026-06-05T02:00:00.000Z")
        )
      ).resolves.toStrictEqual(
        expect.objectContaining({
          status: "LOCAL_FILE_MISSING",
          lifecycleState: "LOCAL_FILE_MISSING",
          contentState: "MISSING",
        })
      );
    });

    it("keeps an active session when the local file temporarily cannot be hashed", async () => {
      const stateRoot = await makeRoot();
      const busyPath = join(stateRoot, "busy-workbook");
      await mkdir(busyPath);
      const observedAt = new Date("2026-06-05T02:00:00.000Z");

      await expect(
        reconcileSession(
          {
            ...makeSession({
              localPath: busyPath,
              originalHash: "hash-1",
            }),
            lastKnownHash: "hash-1",
          },
          observedAt
        )
      ).resolves.toStrictEqual(
        expect.objectContaining({
          lifecycleState: "OPEN",
          contentState: "UNCHANGED",
          status: "OPEN_UNCHANGED",
          lastKnownHash: "hash-1",
          lastSeenAt: observedAt.toISOString(),
          lastError: expect.stringContaining("temporarily unavailable"),
        })
      );
    });

    it("keeps an active check-in retryable when the local file temporarily cannot be hashed", async () => {
      const stateRoot = await makeRoot();
      const busyPath = join(stateRoot, "busy-check-in");
      await mkdir(busyPath);
      const observedAt = new Date("2026-06-05T02:10:00.000Z");

      await expect(
        reconcileSession(
          {
            ...makeSession({
              localPath: busyPath,
              originalHash: "hash-1",
            }),
            lifecycleState: "CHECKING_IN",
            status: "CHECKING_IN",
            contentState: "DIRTY",
            lastKnownHash: "dirty-hash",
            closeDetectedAt: "2026-06-05T02:05:00.000Z",
          },
          observedAt
        )
      ).resolves.toStrictEqual(
        expect.objectContaining({
          lifecycleState: "CHECKING_IN",
          contentState: "DIRTY",
          status: "CHECKING_IN",
          lastKnownHash: "dirty-hash",
          lastSeenAt: observedAt.toISOString(),
          lastError: expect.stringContaining("temporarily unavailable"),
        })
      );
    });

    it("returns interrupted releasing sessions to release pending on refresh", async () => {
      const stateRoot = await makeRoot();
      const localPath = join(stateRoot, "uploaded.xlsx");
      await writeFile(localPath, "uploaded");
      const uploadedHash = await hashFile(localPath);

      await expect(
        reconcileSession(
          {
            ...makeSession({
              localPath,
              originalHash: "original-hash",
            }),
            lastKnownHash: uploadedHash,
            lastUploadedHash: uploadedHash,
            lifecycleState: "RELEASING",
            status: "RELEASING",
            contentState: "UPLOADED",
            pendingReleaseReason: "CHECKED_IN",
            pendingReleaseHash: uploadedHash,
          },
          new Date("2026-06-05T02:00:00.000Z")
        )
      ).resolves.toStrictEqual(
        expect.objectContaining({
          lifecycleState: "RELEASE_PENDING",
          status: "RELEASE_PENDING",
          contentState: "UPLOADED",
        })
      );
    });

    it("persists release recovery when a restarted store refreshes RELEASING", async () => {
      const stateRoot = await makeRoot();
      const localPath = join(stateRoot, "uploaded.xlsx");
      await writeFile(localPath, "uploaded");
      const uploadedHash = await hashFile(localPath);
      const store = createSessionStore({ stateRoot });
      await store.upsert({
        ...makeSession({ localPath, originalHash: "original-hash" }),
        lastKnownHash: uploadedHash,
        lastUploadedHash: uploadedHash,
        lifecycleState: "RELEASING",
        status: "RELEASING",
        contentState: "UPLOADED",
        pendingReleaseReason: "CHECKED_IN",
        pendingReleaseHash: uploadedHash,
      });

      const restarted = createSessionStore({ stateRoot });
      await expect(restarted.refresh()).resolves.toStrictEqual([
        expect.objectContaining({
          lifecycleState: "RELEASE_PENDING",
          status: "RELEASE_PENDING",
          pendingReleaseReason: "CHECKED_IN",
          pendingReleaseHash: uploadedHash,
        }),
      ]);
      await expect(restarted.list()).resolves.toStrictEqual([
        expect.objectContaining({
          lifecycleState: "RELEASE_PENDING",
          status: "RELEASE_PENDING",
        }),
      ]);
    });

    it("preserves an interrupted active check-in on refresh", async () => {
      const stateRoot = await makeRoot();
      const localPath = join(stateRoot, "cash.xlsx");
      await writeFile(localPath, "changed");
      const originalPath = join(stateRoot, "original.xlsx");
      await writeFile(originalPath, "original");
      const originalHash = await hashFile(originalPath);
      const dirtyHash = await hashFile(localPath);

      await expect(
        reconcileSession(
          {
            ...makeSession({
              localPath,
              originalHash,
            }),
            lastKnownHash: dirtyHash,
            lifecycleState: "CHECKING_IN",
            status: "CHECKING_IN",
            contentState: "DIRTY",
            closeDetectedAt: "2026-06-05T02:05:00.000Z",
            lastUploadAttemptAt: "2026-06-05T02:05:01.000Z",
          },
          new Date("2026-06-05T02:05:02.000Z")
        )
      ).resolves.toStrictEqual(
        expect.objectContaining({
          lifecycleState: "CHECKING_IN",
          status: "CHECKING_IN",
          contentState: "DIRTY",
          lastKnownHash: dirtyHash,
        })
      );
    });

    it("marks a dirty session clean after a successful check-in", async () => {
      const stateRoot = await makeRoot();
      const store = createSessionStore({
        stateRoot,
        now: () => new Date("2026-06-05T02:10:00.000Z"),
      });

      await store.upsert({
        ...makeSession({
          localPath: "C:\\ProjectWing\\cash.xlsx",
          originalHash: "old-hash",
        }),
        lastKnownHash: "new-hash",
        status: "DIRTY_PENDING_CHECKIN",
      });

      await expect(
        store.markClean("session-1", "new-hash")
      ).resolves.toStrictEqual(
        expect.objectContaining({
          sessionId: "session-1",
          originalHash: "new-hash",
          lastKnownHash: "new-hash",
          status: "OPEN_UNCHANGED",
          lastSeenAt: "2026-06-05T02:10:00.000Z",
        })
      );
      await expect(store.get("session-1")).resolves.toStrictEqual(
        expect.objectContaining({
          status: "OPEN_UNCHANGED",
        })
      );
    });

    it("skips conditional updates when the current session no longer matches", async () => {
      const stateRoot = await makeRoot();
      const store = createSessionStore({
        stateRoot,
        now: () => new Date("2026-06-05T02:10:00.000Z"),
      });
      await store.upsert({
        ...makeSession({
          localPath: "C:\\ProjectWing\\cash.xlsx",
          originalHash: "hash-1",
        }),
        status: "CLEANUP_FAILED",
        lifecycleState: "CLEANUP_FAILED",
      });

      await expect(
        store.updateIf(
          "session-1",
          (session) => session.status === "OPEN_UNCHANGED",
          { status: "LOCK_REVOKED", lastError: "stale heartbeat" }
        )
      ).resolves.toBeNull();
      const current = await store.get("session-1");
      expect(current).toStrictEqual(
        expect.objectContaining({
          status: "CLEANUP_FAILED",
        })
      );
      expect(current?.lastError).toBeUndefined();
    });

    it("returns failed upload sessions to dirty pending check-in when the file is still changed", async () => {
      const stateRoot = await makeRoot();
      const originalPath = join(stateRoot, "original.xlsx");
      const dirtyPath = join(stateRoot, "dirty.xlsx");
      await writeFile(originalPath, "original");
      await writeFile(dirtyPath, "changed");
      const originalHash = await hashFile(originalPath);

      await expect(
        reconcileSession(
          {
            ...makeSession({
              localPath: dirtyPath,
              originalHash,
            }),
            lastKnownHash: "stale-dirty-hash",
            status: "CHECKIN_FAILED",
            retryCount: 1,
            lastError: "Could not upload the tracked file.",
          },
          new Date("2026-06-05T02:15:00.000Z")
        )
      ).resolves.toStrictEqual(
        expect.objectContaining({
          status: "DIRTY_PENDING_CHECKIN",
          retryCount: 1,
          lastError: "Could not upload the tracked file.",
        })
      );
    });

    it("keeps legacy dirty sessions that cannot prove a Master grant", async () => {
      const stateRoot = await makeRoot();
      const originalPath = join(stateRoot, "original.xlsx");
      const dirtyPath = join(stateRoot, "legacy-dirty.xlsx");
      await writeFile(originalPath, "original");
      await writeFile(dirtyPath, "changed");
      const originalHash = await hashFile(originalPath);
      const store = createSessionStore({
        stateRoot,
        now: () => new Date("2026-06-05T02:20:00.000Z"),
      });

      await store.upsert({
        ...makeSession({
          localPath: dirtyPath,
          originalHash,
        }),
        status: "DIRTY_PENDING_CHECKIN",
        lifecycleState: "OPEN_NOT_OBSERVED",
        contentState: "DIRTY",
        openObservedAt: undefined,
        openObservedSource: undefined,
      });

      await expect(store.refresh()).resolves.toStrictEqual([
        expect.objectContaining({
          lifecycleState: "OPEN_NOT_OBSERVED",
          contentState: "DIRTY",
        }),
      ]);
      await expect(store.list()).resolves.toHaveLength(1);
      await expect(hashFile(dirtyPath)).resolves.toBeTruthy();
    });

    it("purges clean revoked Master cache files during refresh", async () => {
      const stateRoot = await makeRoot();
      const localPath = join(stateRoot, "revoked-clean.xlsx");
      await writeFile(localPath, "uploaded");
      const uploadedHash = await hashFile(localPath);
      const store = createSessionStore({
        stateRoot,
        now: () => new Date("2026-06-05T02:21:00.000Z"),
      });

      await store.upsert({
        ...makeSession({
          localPath,
          originalHash: "original-hash",
        }),
        lockSessionId: "lock-session-1",
        grantSecret: "grant-secret",
        lastKnownHash: uploadedHash,
        lastUploadedHash: uploadedHash,
        status: "LOCK_REVOKED",
        lifecycleState: "LOCK_REVOKED",
        contentState: "UPLOADED",
        lastError: "Desktop Master grant is no longer active.",
      });

      await expect(store.refresh()).resolves.toStrictEqual([]);
      await expect(store.list()).resolves.toStrictEqual([]);
      await expect(hashFile(localPath)).rejects.toThrow("ENOENT");
    });

    it("keeps dirty revoked Master cache files during refresh", async () => {
      const stateRoot = await makeRoot();
      const localPath = join(stateRoot, "revoked-dirty.xlsx");
      await writeFile(localPath, "changed");
      const changedHash = await hashFile(localPath);
      const store = createSessionStore({
        stateRoot,
        now: () => new Date("2026-06-05T02:22:00.000Z"),
      });

      await store.upsert({
        ...makeSession({
          localPath,
          originalHash: "original-hash",
        }),
        lockSessionId: "lock-session-1",
        grantSecret: "grant-secret",
        lastKnownHash: changedHash,
        status: "LOCK_REVOKED",
        lifecycleState: "LOCK_REVOKED",
        contentState: "DIRTY",
        lastError: "Desktop Master grant is no longer active.",
      });

      await expect(store.refresh()).resolves.toStrictEqual([
        expect.objectContaining({
          lifecycleState: "LOCK_REVOKED",
          contentState: "DIRTY",
        }),
      ]);
      await expect(store.list()).resolves.toHaveLength(1);
      await expect(hashFile(localPath)).resolves.toBe(changedHash);
    });

    it("preserves lease-lost Master sessions for close detection and conflict delivery", async () => {
      const stateRoot = await makeRoot();
      const localPath = join(stateRoot, "lease-lost-dirty.xlsx");
      await writeFile(localPath, "changed");
      const changedHash = await hashFile(localPath);
      const store = createSessionStore({
        stateRoot,
        now: () => new Date("2026-06-05T02:22:00.000Z"),
      });

      await store.upsert({
        ...makeSession({
          localPath,
          originalHash: "original-hash",
        }),
        lockSessionId: "lock-session-1",
        grantSecret: "grant-secret",
        lastKnownHash: changedHash,
        status: "LEASE_LOST",
        lifecycleState: "LEASE_LOST",
        contentState: "DIRTY",
        lastError: "Desktop Master lease expired while the file was open.",
      });

      await expect(store.refresh()).resolves.toStrictEqual([
        expect.objectContaining({
          lifecycleState: "LEASE_LOST",
          contentState: "DIRTY",
          lastKnownHash: changedHash,
        }),
      ]);
      await expect(store.list()).resolves.toHaveLength(1);
      await expect(hashFile(localPath)).resolves.toBe(changedHash);
    });

    it("returns release and cleanup failures to their retryable pending states", async () => {
      const stateRoot = await makeRoot();
      const localPath = join(stateRoot, "cash.xlsx");
      await writeFile(localPath, "changed");
      const originalPath = join(stateRoot, "original.xlsx");
      await writeFile(originalPath, "original");
      const originalHash = await hashFile(originalPath);

      await expect(
        reconcileSession(
          {
            ...makeSession({ localPath, originalHash }),
            status: "RELEASE_FAILED",
            lifecycleState: "RELEASE_FAILED",
            contentState: "DIRTY",
            pendingReleaseReason: "CHECKED_IN",
            pendingReleaseHash: "uploaded-hash",
            retryCount: 1,
          },
          new Date("2026-06-05T02:16:00.000Z")
        )
      ).resolves.toStrictEqual(
        expect.objectContaining({
          status: "RELEASE_PENDING",
          retryCount: 1,
        })
      );

      await expect(
        reconcileSession(
          {
            ...makeSession({ localPath, originalHash }),
            status: "CLEANUP_FAILED",
            lifecycleState: "CLEANUP_FAILED",
            retryCount: 1,
          },
          new Date("2026-06-05T02:17:00.000Z")
        )
      ).resolves.toStrictEqual(
        expect.objectContaining({
          status: "CLEANUP_PENDING",
          retryCount: 1,
        })
      );
    });
  });

  function makeSession(input: { localPath: string; originalHash: string }) {
    return {
      sessionId: "session-1",
      mode: "MASTER" as const,
      projectId: "project-1",
      attachmentId: "attachment-1",
      fileName: "cash.xlsx",
      localPath: input.localPath,
      originalHash: input.originalHash,
      lastKnownHash: input.originalHash,
      status: "OPEN_UNCHANGED" as const,
      lifecycleState: "OPEN" as const,
      contentState: "UNCHANGED" as const,
      openedAt: "2026-06-05T01:55:00.000Z",
      launchStartedAt: "2026-06-05T01:55:00.000Z",
      openObservedAt: "2026-06-05T01:56:00.000Z",
      openObservedSource: "WATCHER_COM" as const,
      lastSeenAt: "2026-06-05T01:55:00.000Z",
    };
  }

  async function writeTempOriginal(root: string) {
    const filePath = join(root, "original.xlsx");
    await writeFile(filePath, "original");
    return filePath;
  }
});
