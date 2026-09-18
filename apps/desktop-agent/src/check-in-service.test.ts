import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import type { DesktopAgentSession } from "@project-wing/shared/desktop";
import { getDesktopAgentCompatibilityStatus } from "@project-wing/shared/desktop";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkInDesktopSession,
  cleanupOrphanedCheckInSnapshots,
  releaseDesktopSession,
} from "./check-in-service.js";
import { DesktopAgentError } from "./errors.js";
import { hashFile } from "./session-store.js";

const { join } = pathModule;

type TestFetchInit = {
  body?: BodyInit | NodeJS.ReadableStream;
  signal?: AbortSignal;
};

const roots: string[] = [];

describe("check-in-service", () => {
  afterEach(async () => {
    await Promise.all(
      roots.map((root) => rm(root, { recursive: true, force: true }))
    );
    roots.length = 0;
  });

  async function makeRoot() {
    const root = await mkdtemp(join(tmpdir(), "project-wing-agent-checkin-"));
    roots.push(root);
    return root;
  }

  describe("desktop agent check-in service", () => {
    it.each(["OPEN", "LAUNCHING"] as const)(
      "does not upload or release %s sessions",
      async (lifecycleState) => {
        const localPath = await writeLocalFile("updated");
        const session = await makeSession({
          localPath,
          lifecycleState,
          contentState: "DIRTY",
          lastKnownHash: "dirty-hash",
        });
        const store = createMemoryStore(session);
        const fetchUpload = vi.fn();
        const waitForStableFile = vi.fn();

        await expect(
          checkInDesktopSession(makeRequest(), {
            allowedUploadOrigins: ["http://localhost:3000"],
            fetchUpload,
            waitForStableFile,
            sessionStore: store,
          })
        ).rejects.toStrictEqual(
          new DesktopAgentError(
            "LOCAL_FILE_BUSY_OR_OPEN",
            "The tracked local file has not been closed."
          )
        );

        expect(fetchUpload).not.toHaveBeenCalled();
        expect(waitForStableFile).not.toHaveBeenCalled();
      }
    );

    it("manually releases an open Master without checking whether the local file is closed", async () => {
      const localPath = await writeLocalFile("updated");
      const session = await makeSession({
        localPath,
        lockEpoch: 3,
        lifecycleState: "OPEN",
        contentState: "DIRTY",
        lastKnownHash: "dirty-hash",
      });
      const store = createMemoryStore(session);
      const fetchUpload = vi
        .fn()
        .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
      const waitForStableFile = vi.fn();
      const result = await releaseDesktopSession(makeReleaseRequest(), {
        allowedUploadOrigins: ["http://localhost:3000"],
        fetchUpload,
        waitForStableFile,
        sessionStore: store,
      });

      expect(waitForStableFile).not.toHaveBeenCalled();
      expect(fetchUpload).toHaveBeenCalledOnce();
      expect(fetchUpload.mock.calls[0][0]).toContain("/release");
      expect(
        JSON.parse(fetchUpload.mock.calls[0][1].body as string)
      ).toStrictEqual({
        projectId: "project-1",
        attachmentId: "attachment-1",
        grantSecret: "grant-secret",
        lockEpoch: 3,
        reason: "UNCHANGED_RELEASE",
      });
      expect(result.session.lifecycleState).toBe("CLOSED");
      expect(result.session.contentState).toBe("DIRTY");
      await expect(store.get("session-1")).resolves.toBeNull();
    });

    it("releases an unchanged closed Master without uploading", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "UNCHANGED",
        closeDetectedAt: "2026-06-05T02:08:00.000Z",
      });
      const store = createMemoryStore(session);
      const fetchUpload = vi
        .fn()
        .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
      const waitForStableFile = vi.fn().mockResolvedValue();
      const result = await checkInDesktopSession(makeRequest(), {
        allowedUploadOrigins: ["http://localhost:3000"],
        fetchUpload,
        waitForStableFile,
        sessionStore: store,
      });

      expect(waitForStableFile).toHaveBeenCalledWith(localPath);
      expect(fetchUpload).toHaveBeenCalledOnce();
      expect(fetchUpload.mock.calls[0][0]).toContain("/release");
      expect(
        JSON.parse(fetchUpload.mock.calls[0][1].body as string)
      ).toStrictEqual({
        projectId: "project-1",
        attachmentId: "attachment-1",
        grantSecret: "grant-secret",
        reason: "UNCHANGED_RELEASE",
      });
      expect(result.session.lifecycleState).toBe("CLOSED");
      expect(result.session.status).toBe("CLOSED");
      await expect(readFile(localPath, "utf-8")).resolves.toBe("original");
      await expect(store.get("session-1")).resolves.toBeNull();
    });

    it("uploads a dirty closed Master, releases it, and retains the cache file", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      await writeFile(localPath, "updated");
      const uploadedHash = await hashFile(localPath);
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
        closeDetectedAt: "2026-06-05T02:08:00.000Z",
      });
      const store = createMemoryStore(session);
      const fetchUpload = vi
        .fn()
        .mockResolvedValueOnce(
          new Response('{"ok":true,"version":3}', { status: 200 })
        )
        .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
      const waitForStableFile = vi.fn().mockResolvedValue();
      const result = await checkInDesktopSession(makeRequest(), {
        allowedUploadOrigins: ["http://localhost:3000"],
        fetchUpload,
        waitForStableFile,
        sessionStore: store,
      });

      expect(fetchUpload).toHaveBeenCalledTimes(2);
      expect(fetchUpload.mock.calls[0][0]).toContain("/check-in");
      const uploadBody = fetchUpload.mock.calls[0][1].body as FormData;
      expect(uploadBody.get("localContentHash")).toBe(uploadedHash);
      expect(uploadBody.get("idempotencyKey")).toBe(
        `lock-session-1:${uploadedHash}`
      );
      const uploadedFile = uploadBody.get("file") as Blob;
      await expect(uploadedFile.text()).resolves.toBe("updated");
      expect(fetchUpload.mock.calls[1][0]).toContain("/release");
      expect(
        JSON.parse(fetchUpload.mock.calls[1][1].body as string).reason
      ).toBe("CHECKED_IN");
      expect(result.session).toStrictEqual(
        expect.objectContaining({
          lifecycleState: "CLOSED",
          status: "CLOSED",
          lastKnownHash: uploadedHash,
          lastUploadedHash: uploadedHash,
        })
      );
      expect(store.events).toContain("update:CLEANUP_PENDING");
      expect(store.events.at(-1)).toBe("remove");
      await expect(readFile(localPath, "utf-8")).resolves.toBe("updated");
    });

    it("probes direct upload for a legacy session and falls back only when unsupported", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      await writeFile(localPath, "legacy update");
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
        directUploadSupported: undefined,
      });
      const store = createMemoryStore(session);
      const fetchUpload = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(jsonResponse({ ok: true, version: 3 }))
        .mockResolvedValueOnce(jsonResponse({ ok: true }));

      await checkInDesktopSession(makeRequest(), {
        allowedUploadOrigins: ["http://localhost:3000"],
        fetchUpload,
        waitForStableFile: vi.fn().mockResolvedValue(),
        sessionStore: store,
      });

      expect(fetchUpload.mock.calls[0][0]).toContain("/check-in/prepare");
      expect(fetchUpload.mock.calls[1][1].body).toBeInstanceOf(FormData);
      expect(fetchUpload.mock.calls[2][0]).toContain("/release");
    });

    it("cancels an in-flight check-in before forcing release for the same session", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      await writeFile(localPath, "unsynced update");
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
      });
      const store = createMemoryStore(session);
      let uploadStarted!: () => void;
      const started = new Promise<void>((resolve) => {
        uploadStarted = resolve;
      });
      const fetchUpload = vi.fn(async (url: string, init: TestFetchInit) => {
        await Promise.resolve();
        if (url.endsWith("/release")) {
          return jsonResponse({ ok: true });
        }
        uploadStarted();
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true }
          );
        });
      });
      const checkIn = checkInDesktopSession(makeRequest(), {
        allowedUploadOrigins: ["http://localhost:3000"],
        fetchUpload,
        waitForStableFile: vi.fn().mockResolvedValue(),
        sessionStore: store,
      });
      const checkInRejection = checkIn.then(
        () => {
          throw new Error("Expected check-in to reject.");
        },
        (error) => {
          expect(error).toStrictEqual(
            new DesktopAgentError(
              "UPLOAD_FAILED",
              "Could not upload the tracked file."
            )
          );
        }
      );
      await started;
      const released = await releaseDesktopSession(makeReleaseRequest(), {
        allowedUploadOrigins: ["http://localhost:3000"],
        fetchUpload,
        sessionStore: store,
      });

      await checkInRejection;
      expect(released.session.lifecycleState).toBe("CLOSED");
      expect(
        fetchUpload.mock.calls.some(([url]) => url.endsWith("/release"))
      ).toBeTruthy();
      await expect(store.get("session-1")).resolves.toBeNull();
    });

    it("keeps a server-preserved conflict candidate locally and does not release the session", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      await writeFile(localPath, "offline changes");
      const uploadedHash = await hashFile(localPath);
      const session = await makeSession({
        localPath,
        baseVersionId: "base-version-2",
        lockEpoch: 3,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
        closeDetectedAt: "2026-06-05T02:08:00.000Z",
      });
      const store = createMemoryStore(session);
      const fetchUpload = vi.fn().mockResolvedValueOnce(
        Response.json(
          {
            ok: true,
            conflict: true,
            candidateVersionId: "candidate-version-4",
          },
          { status: 200 }
        )
      );

      await expect(
        checkInDesktopSession(makeRequest(), {
          allowedUploadOrigins: ["http://localhost:3000"],
          fetchUpload,
          waitForStableFile: vi.fn().mockResolvedValue(),
          sessionStore: store,
        })
      ).rejects.toStrictEqual(
        new DesktopAgentError(
          "CONFLICT_RISK",
          "The server preserved this upload as conflict candidate candidate-version-4. PIC resolution is required."
        )
      );

      expect(fetchUpload).toHaveBeenCalledOnce();
      const uploadBody = fetchUpload.mock.calls[0][1].body as FormData;
      expect(uploadBody.get("baseVersionId")).toBe("base-version-2");
      expect(uploadBody.get("lockEpoch")).toBe("3");
      await expect(store.get("session-1")).resolves.toStrictEqual(
        expect.objectContaining({
          lifecycleState: "CONFLICT_RISK",
          status: "CONFLICT_RISK",
          contentState: "DIRTY",
          lastKnownHash: uploadedHash,
          lastUploadedHash: uploadedHash,
        })
      );
      await expect(readFile(localPath, "utf-8")).resolves.toBe(
        "offline changes"
      );
    });

    it("resumes an interrupted active check-in idempotently", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      await writeFile(localPath, "updated");
      const uploadedHash = await hashFile(localPath);
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: uploadedHash,
        lifecycleState: "CHECKING_IN",
        contentState: "DIRTY",
        closeDetectedAt: "2026-06-05T02:08:00.000Z",
        lastUploadAttemptAt: "2026-06-05T02:08:01.000Z",
      });
      const store = createMemoryStore(session);
      const fetchUpload = vi
        .fn()
        .mockResolvedValueOnce(
          new Response('{"ok":true,"version":3}', { status: 200 })
        )
        .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
      const result = await checkInDesktopSession(makeRequest(), {
        allowedUploadOrigins: ["http://localhost:3000"],
        fetchUpload,
        waitForStableFile: vi.fn().mockResolvedValue(),
        sessionStore: store,
      });
      const uploadBody = fetchUpload.mock.calls[0][1].body as FormData;
      expect(uploadBody.get("idempotencyKey")).toBe(
        `lock-session-1:${uploadedHash}`
      );
      expect(result.session).toStrictEqual(
        expect.objectContaining({
          lifecycleState: "CLOSED",
          status: "CLOSED",
          lastKnownHash: uploadedHash,
          lastUploadedHash: uploadedHash,
        })
      );
      expect(store.events).toContain("update:CHECKING_IN");
      expect(store.events).toContain("update:RELEASE_PENDING");
      expect(store.events.at(-1)).toBe("remove");
    });

    it("retries RELEASE_FAILED with the stored release decision only", async () => {
      const missingPath = join(await makeRoot(), "missing.xlsx");
      const session = await makeSession({
        localPath: missingPath,
        originalHash: "hash-1",
        lastKnownHash: "hash-2",
        lastUploadedHash: "hash-2",
        lifecycleState: "RELEASE_FAILED",
        contentState: "UPLOADED",
        pendingReleaseReason: "CHECKED_IN",
        pendingReleaseHash: "hash-2",
        retryCount: 1,
        lastError: "Could not release Master.",
      });
      const store = createMemoryStore(session);
      const fetchUpload = vi
        .fn()
        .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
      const waitForStableFile = vi.fn();
      const result = await checkInDesktopSession(makeRequest(), {
        allowedUploadOrigins: ["http://localhost:3000"],
        fetchUpload,
        waitForStableFile,
        sessionStore: store,
      });

      expect(waitForStableFile).not.toHaveBeenCalled();
      expect(fetchUpload).toHaveBeenCalledOnce();
      expect(fetchUpload.mock.calls[0][0]).toContain("/release");
      expect(
        JSON.parse(fetchUpload.mock.calls[0][1].body as string).reason
      ).toBe("CHECKED_IN");
      expect(result.session.lifecycleState).toBe("CLOSED");
    });

    it.each(["CLEANUP_PENDING", "CLEANUP_FAILED"] as const)(
      "retries %s as local cleanup only",
      async (lifecycleState) => {
        const localPath = await writeLocalFile("uploaded");
        const uploadedHash = await hashFile(localPath);
        const session = await makeSession({
          localPath,
          originalHash: "hash-1",
          lastKnownHash: uploadedHash,
          lastUploadedHash: uploadedHash,
          lifecycleState,
          contentState: "UPLOADED",
        });
        const store = createMemoryStore(session);
        const fetchUpload = vi.fn();
        const result = await checkInDesktopSession(makeRequest(), {
          allowedUploadOrigins: ["http://localhost:3000"],
          fetchUpload,
          waitForStableFile: vi.fn(),
          sessionStore: store,
        });

        expect(fetchUpload).not.toHaveBeenCalled();
        expect(result.session.lifecycleState).toBe("CLOSED");
        await expect(readFile(localPath, "utf-8")).resolves.toBe("uploaded");
        await expect(store.get("session-1")).resolves.toBeNull();
      }
    );

    it("marks upload network failures as failed check-ins with retry metadata", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      await writeFile(localPath, "updated");
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
        closeDetectedAt: "2026-06-05T02:08:00.000Z",
      });
      const store = createMemoryStore(session);

      await expect(
        checkInDesktopSession(makeRequest(), {
          allowedUploadOrigins: ["http://localhost:3000"],
          fetchUpload: vi.fn().mockRejectedValue(new Error("offline")),
          waitForStableFile: vi.fn().mockResolvedValue(),
          sessionStore: store,
        })
      ).rejects.toStrictEqual(
        new DesktopAgentError(
          "UPLOAD_FAILED",
          "Could not upload the tracked file."
        )
      );
      await expect(store.get("session-1")).resolves.toStrictEqual(
        expect.objectContaining({
          lifecycleState: "CHECKIN_FAILED",
          status: "CHECKIN_FAILED",
          retryCount: 1,
          lastError: "Could not upload the tracked file.",
        })
      );
    });

    it("marks release failures as failed releases with the pending decision preserved", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "UNCHANGED",
        closeDetectedAt: "2026-06-05T02:08:00.000Z",
      });
      const store = createMemoryStore(session);

      await expect(
        checkInDesktopSession(makeRequest(), {
          allowedUploadOrigins: ["http://localhost:3000"],
          fetchUpload: vi.fn().mockRejectedValue(new Error("offline")),
          waitForStableFile: vi.fn().mockResolvedValue(),
          sessionStore: store,
        })
      ).rejects.toStrictEqual(
        new DesktopAgentError("RELEASE_FAILED", "Could not release Master.")
      );
      await expect(store.get("session-1")).resolves.toStrictEqual(
        expect.objectContaining({
          lifecycleState: "RELEASE_FAILED",
          status: "RELEASE_FAILED",
          pendingReleaseReason: "UNCHANGED_RELEASE",
          pendingReleaseHash: originalHash,
          retryCount: 1,
          lastError: "Could not release Master.",
        })
      );
    });

    it("does not release if the session becomes attention-required before release starts", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "UNCHANGED",
        closeDetectedAt: "2026-06-05T02:08:00.000Z",
      });
      const store = createMemoryStore(session);
      vi.spyOn(store, "updateIf").mockImplementation(
        async (sessionId, predicate, patch) => {
          const current = await store.get(sessionId);
          if (!current || !predicate(current)) {
            return null;
          }
          if (patch.lifecycleState === "RELEASING") {
            return null;
          }
          return store.update(sessionId, patch);
        }
      );
      const fetchUpload = vi.fn();

      await expect(
        checkInDesktopSession(makeRequest(), {
          allowedUploadOrigins: ["http://localhost:3000"],
          fetchUpload,
          waitForStableFile: vi.fn().mockResolvedValue(),
          sessionStore: store,
        })
      ).rejects.toStrictEqual(
        new DesktopAgentError(
          "SESSION_STATE_CHANGED",
          "Tracked file session state changed."
        )
      );
      expect(fetchUpload).not.toHaveBeenCalled();
    });

    it("does not overwrite a changed session when release metadata is missing", async () => {
      const localPath = await writeLocalFile("uploaded");
      const session = await makeSession({
        localPath,
        originalHash: "hash-1",
        lastKnownHash: "hash-2",
        lastUploadedHash: "hash-2",
        lifecycleState: "RELEASE_PENDING",
        contentState: "UPLOADED",
        pendingReleaseReason: undefined,
        pendingReleaseHash: undefined,
      });
      const store = createMemoryStore(session);
      vi.spyOn(store, "updateIf").mockImplementation(async () => {
        await Promise.resolve();
        return null;
      });

      await expect(
        checkInDesktopSession(makeRequest(), {
          allowedUploadOrigins: ["http://localhost:3000"],
          fetchUpload: vi.fn(),
          waitForStableFile: vi.fn(),
          sessionStore: store,
        })
      ).rejects.toStrictEqual(
        new DesktopAgentError(
          "SESSION_STATE_CHANGED",
          "Tracked file session state changed."
        )
      );
    });

    it("retries a transient OSS rejection before commit confirmation", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      await writeFile(localPath, "direct upload");
      const uploadedHash = await hashFile(localPath);
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
        directUploadSupported: true,
      });
      const store = createMemoryStore(session);
      const uploadedBodies: string[] = [];
      const fetchUpload = vi.fn(async (url: string) => {
        await Promise.resolve();
        if (url.endsWith("/prepare")) {
          return jsonResponse({
            ok: true,
            mode: "DIRECT_PUT",
            objectKey: `desktop-master-check-ins/file-${uploadedHash}.xlsx`,
            uploadUrl: "https://oss.example/signed-put",
            headers: {
              "Content-Type": "application/octet-stream",
              "x-oss-meta-sha256": uploadedHash,
            },
            expiresAt: "2099-06-05T03:00:00.000Z",
          });
        }
        return jsonResponse({ ok: true, version: 3 });
      });
      const fetchTransfer = vi.fn(async (_url: string, init: TestFetchInit) => {
        uploadedBodies.push(await readNodeStream(init.body));
        return new Response(null, {
          status: uploadedBodies.length === 1 ? 429 : 200,
        });
      });
      const result = await checkInDesktopSession(makeRequest(), {
        allowedUploadOrigins: ["http://localhost:3000"],
        fetchUpload,
        fetchTransfer,
        waitForStableFile: vi.fn().mockResolvedValue(),
        sessionStore: store,
      });

      expect(uploadedBodies).toStrictEqual(["direct upload", "direct upload"]);
      expect(fetchUpload).toHaveBeenCalledTimes(3);
      expect(fetchTransfer).toHaveBeenCalledTimes(2);
      expect(fetchTransfer.mock.calls[0][0]).toBe(
        "https://oss.example/signed-put"
      );
      const commitCall = fetchUpload.mock.calls.find(
        ([url]) => url === makeRequest().checkInUrl
      );
      expect(JSON.parse(commitCall?.[1].body as string)).toStrictEqual(
        expect.objectContaining({
          localContentHash: uploadedHash,
          fileSize: Buffer.byteLength("direct upload"),
          objectKey: `desktop-master-check-ins/file-${uploadedHash}.xlsx`,
        })
      );
      expect(result.session.status).toBe("CLOSED");
    });

    it("uploads an immutable snapshot and preserves changes made afterwards", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      await writeFile(localPath, "snapshot content");
      const uploadedHash = await hashFile(localPath);
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
        directUploadSupported: true,
      });
      const store = createMemoryStore(session);
      const uploadedBodies: string[] = [];
      const fetchUpload = vi.fn(async (url: string) => {
        await Promise.resolve();
        if (url.endsWith("/prepare")) {
          return jsonResponse({
            ok: true,
            mode: "DIRECT_PUT",
            objectKey: `desktop-master-check-ins/file-${uploadedHash}.xlsx`,
            uploadUrl: "https://oss.example/signed-put",
            headers: {
              "Content-Type": "application/octet-stream",
              "x-oss-meta-sha256": uploadedHash,
            },
            expiresAt: "2099-06-05T03:00:00.000Z",
          });
        }
        return jsonResponse({ ok: true, version: 3 });
      });
      const fetchTransfer = vi.fn(async (_url: string, init: TestFetchInit) => {
        await writeFile(localPath, "newer local changes");
        uploadedBodies.push(await readNodeStream(init.body));
        return new Response(null, { status: 200 });
      });

      await expect(
        checkInDesktopSession(makeRequest(), {
          allowedUploadOrigins: ["http://localhost:3000"],
          fetchUpload,
          fetchTransfer,
          waitForStableFile: vi.fn().mockResolvedValue(),
          sessionStore: store,
        })
      ).rejects.toMatchObject({ code: "CONFLICT_RISK" });

      expect(uploadedBodies).toStrictEqual(["snapshot content"]);
      await expect(readFile(localPath, "utf-8")).resolves.toBe(
        "newer local changes"
      );
      await expect(store.get("session-1")).resolves.toMatchObject({
        lifecycleState: "CONFLICT_RISK",
        contentState: "DIRTY",
        lastUploadedHash: uploadedHash,
      });
      expect(
        fetchUpload.mock.calls.some(([url]) => url.endsWith("/release"))
      ).toBeFalsy();
    });

    it("removes expired orphan snapshots without deleting active snapshots", async () => {
      const localPath = await writeLocalFile("working");
      const stagingRoot = join(localPath, "..", ".check-in-staging");
      await mkdir(stagingRoot, { recursive: true });
      const activePath = join(stagingRoot, "active.snapshot");
      const orphanPath = join(stagingRoot, "orphan.snapshot");
      const recentPath = join(stagingRoot, "recent.tmp");
      await writeFile(activePath, "active");
      await writeFile(orphanPath, "orphan");
      await writeFile(recentPath, "recent");
      const oldDate = new Date("2026-06-01T00:00:00.000Z");
      await utimes(activePath, oldDate, oldDate);
      await utimes(orphanPath, oldDate, oldDate);
      const session = await makeSession({
        localPath,
        checkInSnapshot: {
          snapshotId: "active",
          path: activePath,
          fileSize: 6,
          contentHash: await hashFile(activePath),
          createdAt: oldDate.toISOString(),
        },
      });

      await cleanupOrphanedCheckInSnapshots([session], {
        now: new Date("2026-06-03T00:00:00.000Z"),
        ttlMs: 24 * 60 * 60 * 1000,
      });

      await expect(readFile(activePath, "utf-8")).resolves.toBe("active");
      await expect(readFile(recentPath, "utf-8")).resolves.toBe("recent");
      await expect(readFile(orphanPath, "utf-8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    });

    it("discovers and removes unreferenced staging snapshots from the cache root", async () => {
      const cacheRoot = await makeRoot();
      const stagingRoot = join(
        cacheRoot,
        "project-1",
        "attachment-1",
        ".check-in-staging"
      );
      await mkdir(stagingRoot, { recursive: true });
      const orphanPath = join(stagingRoot, "orphan.snapshot");
      const unrelatedPath = join(stagingRoot, "keep.txt");
      await writeFile(orphanPath, "orphan");
      await writeFile(unrelatedPath, "keep");
      const oldDate = new Date("2026-06-01T00:00:00.000Z");
      await utimes(orphanPath, oldDate, oldDate);

      await cleanupOrphanedCheckInSnapshots([], {
        cacheRoot,
        now: new Date("2026-06-03T00:00:00.000Z"),
        ttlMs: 24 * 60 * 60 * 1000,
      });

      await expect(readFile(orphanPath, "utf-8")).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(readFile(unrelatedPath, "utf-8")).resolves.toBe("keep");
    });

    it("fails before snapshot copy when local disk capacity is insufficient", async () => {
      const localPath = await writeLocalFile("changed");
      const session = await makeSession({
        localPath,
        originalHash: "original-hash",
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
      });
      const copySnapshotFile = vi.fn();

      await expect(
        checkInDesktopSession(makeRequest(), {
          allowedUploadOrigins: ["http://localhost:3000"],
          fetchUpload: vi.fn(),
          waitForStableFile: vi.fn().mockResolvedValue(),
          sessionStore: createMemoryStore(session),
          getSnapshotAvailableBytes: vi.fn().mockResolvedValue(0),
          copySnapshotFile,
        })
      ).rejects.toMatchObject({ code: "DESKTOP_AGENT_STORAGE_FULL" });

      expect(copySnapshotFile).not.toHaveBeenCalled();
    });

    it("accounts for active snapshots in the cache index until cleanup", async () => {
      const localPath = await writeLocalFile("unchanged");
      const originalHash = await hashFile(localPath);
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "UNCHANGED",
      });
      const cacheIndex = {
        trim: vi.fn().mockResolvedValue({ freedBytes: 0 }),
        recordAccess: vi.fn().mockResolvedValue(null),
        setPinned: vi.fn(),
        remove: vi.fn(),
      };

      await checkInDesktopSession(makeRequest(), {
        allowedUploadOrigins: ["http://localhost:3000"],
        fetchUpload: vi.fn().mockResolvedValue(jsonResponse({ ok: true })),
        waitForStableFile: vi.fn().mockResolvedValue(),
        sessionStore: createMemoryStore(session),
        cacheRoot: join(localPath, ".."),
        cacheIndex,
        getSnapshotAvailableBytes: vi
          .fn()
          .mockResolvedValue(Number.MAX_SAFE_INTEGER),
      });

      expect(cacheIndex.trim).toHaveBeenCalledWith(
        expect.objectContaining({
          incomingBytes: Buffer.byteLength("unchanged"),
          protectedPaths: expect.arrayContaining([localPath]),
        })
      );
      expect(cacheIndex.recordAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          localPath: expect.stringMatching(/\.snapshot$/),
          state: "UPLOADING",
          contentHash: originalHash,
        })
      );
      const snapshotPath = cacheIndex.recordAccess.mock.calls[0][0].localPath;
      expect(cacheIndex.setPinned).toHaveBeenCalledWith(snapshotPath, true);
      expect(cacheIndex.remove).toHaveBeenCalledWith(snapshotPath);
    });

    it("preserves ENOSPC diagnostics when snapshot copy exhausts the disk", async () => {
      const localPath = await writeLocalFile("changed");
      const session = await makeSession({
        localPath,
        originalHash: "original-hash",
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
      });

      await expect(
        checkInDesktopSession(makeRequest(), {
          allowedUploadOrigins: ["http://localhost:3000"],
          fetchUpload: vi.fn(),
          waitForStableFile: vi.fn().mockResolvedValue(),
          sessionStore: createMemoryStore(session),
          getSnapshotAvailableBytes: vi
            .fn()
            .mockResolvedValue(Number.MAX_SAFE_INTEGER),
          copySnapshotFile: vi
            .fn()
            .mockRejectedValue(
              Object.assign(new Error("disk full"), { code: "ENOSPC" })
            ),
        })
      ).rejects.toStrictEqual(
        new DesktopAgentError(
          "DESKTOP_AGENT_STORAGE_FULL",
          "There is not enough local disk space to create the upload snapshot."
        )
      );
    });

    it("persists safe OSS diagnostics when direct PUT is rejected", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      await writeFile(localPath, "rejected direct upload");
      const uploadedHash = await hashFile(localPath);
      const objectKey = `desktop-master-check-ins/file-${uploadedHash}.xlsx`;
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
        directUploadSupported: true,
      });
      const store = createMemoryStore(session);
      const fetchUpload = vi.fn(async (url: string) => {
        await Promise.resolve();
        if (url.endsWith("/prepare")) {
          return jsonResponse({
            ok: true,
            mode: "DIRECT_PUT",
            objectKey,
            uploadUrl: "https://oss.example/signed-put",
            headers: {
              "Content-Type": "application/octet-stream",
              "x-oss-meta-sha256": uploadedHash,
            },
            expiresAt: "2099-06-05T03:00:00.000Z",
          });
        }
        if (url === makeRequest().checkInUrl) {
          return jsonResponse(
            {
              code: "UPLOAD_FAILED",
              message: "Could not upload the tracked file to object storage.",
            },
            400
          );
        }
        throw new Error("Commit should not be attempted.");
      });
      const fetchTransfer = vi.fn(async () => {
        await Promise.resolve();
        return new Response(
          "<Error><Code>SignatureDoesNotMatch</Code><RequestId>oss-body-request</RequestId></Error>",
          {
            status: 403,
            headers: { "x-oss-request-id": "oss-header-request" },
          }
        );
      });

      await expect(
        checkInDesktopSession(makeRequest(), {
          allowedUploadOrigins: ["http://localhost:3000"],
          fetchUpload,
          fetchTransfer,
          waitForStableFile: vi.fn().mockResolvedValue(),
          sessionStore: store,
        })
      ).rejects.toStrictEqual(
        new DesktopAgentError(
          "UPLOAD_FAILED",
          "Could not upload the tracked file to object storage."
        )
      );
      await expect(store.get("session-1")).resolves.toStrictEqual(
        expect.objectContaining({
          lifecycleState: "CHECKIN_FAILED",
          uploadCheckpoint: expect.objectContaining({
            objectKey,
            lastTransferStatus: 403,
            lastTransferErrorCode: "SignatureDoesNotMatch",
            lastTransferRequestId: "oss-header-request",
          }),
        })
      );
    });

    it("refreshes an expired OSS signature and resumes the direct upload", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      await writeFile(localPath, "refresh direct upload");
      const uploadedHash = await hashFile(localPath);
      const objectKey = `desktop-master-check-ins/file-${uploadedHash}.xlsx`;
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
        directUploadSupported: true,
      });
      const store = createMemoryStore(session);
      let prepareCount = 0;
      const uploadAttemptIds: string[] = [];
      const fetchUpload = vi.fn(async (url: string, init: TestFetchInit) => {
        await Promise.resolve();
        if (url.endsWith("/prepare")) {
          prepareCount += 1;
          uploadAttemptIds.push(JSON.parse(String(init.body)).uploadAttemptId);
          return jsonResponse({
            ok: true,
            mode: "DIRECT_PUT",
            objectKey,
            uploadUrl: `https://oss.example/signed-put-${prepareCount}`,
            headers: {
              "Content-Type": "application/octet-stream",
              "x-oss-meta-sha256": uploadedHash,
            },
            expiresAt: "2099-06-05T03:00:00.000Z",
          });
        }
        return jsonResponse({ ok: true, version: 3 });
      });
      const fetchTransfer = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            "<Error><Code>SignatureDoesNotMatch</Code><RequestId>expired-1</RequestId></Error>",
            { status: 403 }
          )
        )
        .mockResolvedValueOnce(new Response(null, { status: 200 }));
      const result = await checkInDesktopSession(makeRequest(), {
        allowedUploadOrigins: ["http://localhost:3000"],
        fetchUpload,
        fetchTransfer,
        waitForStableFile: vi.fn().mockResolvedValue(),
        sessionStore: store,
      });

      expect(prepareCount).toBe(2);
      expect(new Set(uploadAttemptIds).size).toBe(1);
      expect(fetchTransfer.mock.calls.map(([url]) => url)).toStrictEqual([
        "https://oss.example/signed-put-1",
        "https://oss.example/signed-put-2",
      ]);
      expect(result.session.status).toBe("CLOSED");
    });

    it("refreshes a grant before transfer when its signature is near expiry", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      await writeFile(localPath, "proactive grant refresh");
      const uploadedHash = await hashFile(localPath);
      const objectKey = `desktop-master-check-ins/file-${uploadedHash}.xlsx`;
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
        directUploadSupported: true,
      });
      const store = createMemoryStore(session);
      let prepareCount = 0;
      const fetchUpload = vi.fn(async (url: string) => {
        await Promise.resolve();
        if (url.endsWith("/prepare")) {
          prepareCount += 1;
          return jsonResponse({
            ok: true,
            mode: "DIRECT_PUT",
            objectKey,
            uploadUrl: `https://oss.example/signed-put-${prepareCount}`,
            headers: {
              "Content-Type": "application/octet-stream",
              "x-oss-meta-sha256": uploadedHash,
            },
            expiresAt:
              prepareCount === 1
                ? new Date(Date.now() + 30_000).toISOString()
                : "2099-06-05T03:00:00.000Z",
          });
        }
        return jsonResponse({ ok: true, version: 3 });
      });
      const fetchTransfer = vi.fn(async () => {
        await Promise.resolve();
        return new Response(null, { status: 200 });
      });

      await checkInDesktopSession(makeRequest(), {
        allowedUploadOrigins: ["http://localhost:3000"],
        fetchUpload,
        fetchTransfer,
        waitForStableFile: vi.fn().mockResolvedValue(),
        sessionStore: store,
      });

      expect(prepareCount).toBe(2);
      expect(fetchTransfer).toHaveBeenCalledOnce();
      expect(fetchTransfer.mock.calls[0][0]).toBe(
        "https://oss.example/signed-put-2"
      );
    });

    it("retries direct upload when server verification reports a missing object", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      await writeFile(localPath, "retry direct upload");
      const uploadedHash = await hashFile(localPath);
      const objectKey = `desktop-master-check-ins/file-${uploadedHash}.xlsx`;
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
        directUploadSupported: true,
      });
      const store = createMemoryStore(session);
      let directCommitCount = 0;
      let prepareCount = 0;
      const uploadAttemptIds: string[] = [];
      const fetchUpload = vi.fn(async (url: string, init: TestFetchInit) => {
        await Promise.resolve();
        if (url.endsWith("/prepare")) {
          prepareCount += 1;
          uploadAttemptIds.push(JSON.parse(String(init.body)).uploadAttemptId);
          return jsonResponse({
            ok: true,
            mode: "DIRECT_PUT",
            objectKey,
            uploadUrl: `https://oss.example/signed-put-${prepareCount}`,
            headers: {
              "Content-Type": "application/octet-stream",
              "x-oss-meta-sha256": uploadedHash,
            },
            expiresAt: "2099-06-05T03:00:00.000Z",
          });
        }
        if (url.endsWith("/release")) {
          return jsonResponse({ ok: true });
        }
        if (init.body instanceof FormData) {
          throw new TypeError("Proxy fallback should not be used.");
        }
        directCommitCount += 1;
        return directCommitCount === 1
          ? jsonResponse(
              {
                code: "DIRECT_UPLOAD_NOT_FOUND",
                message: "The direct upload object is not available yet.",
              },
              409
            )
          : jsonResponse({ ok: true, version: 3 });
      });
      const fetchTransfer = vi.fn(async () => {
        await Promise.resolve();
        return new Response(null, { status: 409 });
      });
      const result = await checkInDesktopSession(makeRequest(), {
        allowedUploadOrigins: ["http://localhost:3000"],
        fetchUpload,
        fetchTransfer,
        waitForStableFile: vi.fn().mockResolvedValue(),
        sessionStore: store,
      });

      expect(prepareCount).toBe(2);
      expect(new Set(uploadAttemptIds).size).toBe(2);
      expect(fetchTransfer).toHaveBeenCalledTimes(2);
      expect(directCommitCount).toBe(2);
      expect(result.session.status).toBe("CLOSED");
    });

    it("falls back to proxy after repeated direct verification failures", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      await writeFile(localPath, "retry then proxy");
      const uploadedHash = await hashFile(localPath);
      const objectKey = `desktop-master-check-ins/file-${uploadedHash}.xlsx`;
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
        directUploadSupported: true,
      });
      const store = createMemoryStore(session);
      let prepareCount = 0;
      const fetchUpload = vi.fn(async (url: string, init: TestFetchInit) => {
        await Promise.resolve();
        if (url.endsWith("/prepare")) {
          prepareCount += 1;
          return jsonResponse({
            ok: true,
            mode: "DIRECT_PUT",
            objectKey,
            uploadUrl: `https://oss.example/signed-put-${prepareCount}`,
            headers: {
              "Content-Type": "application/octet-stream",
              "x-oss-meta-sha256": uploadedHash,
            },
            expiresAt: "2099-06-05T03:00:00.000Z",
          });
        }
        if (url.endsWith("/release")) {
          return jsonResponse({ ok: true });
        }
        if (init.body instanceof FormData) {
          return jsonResponse({ ok: true, version: 3 });
        }
        return jsonResponse(
          {
            code: "DIRECT_UPLOAD_NOT_FOUND",
            message: "The direct upload object is not available yet.",
          },
          409
        );
      });
      const fetchTransfer = vi.fn(async () => {
        await Promise.resolve();
        return new Response(null, { status: 409 });
      });
      const result = await checkInDesktopSession(makeRequest(), {
        allowedUploadOrigins: ["http://localhost:3000"],
        fetchUpload,
        fetchTransfer,
        waitForStableFile: vi.fn().mockResolvedValue(),
        sessionStore: store,
      });

      expect(prepareCount).toBe(3);
      expect(fetchTransfer).toHaveBeenCalledTimes(3);
      const commitCalls = fetchUpload.mock.calls.filter(
        ([url]) => url === makeRequest().checkInUrl
      );
      expect(commitCalls).toHaveLength(4);
      expect(commitCalls[3][1].body).toStrictEqual(expect.any(FormData));
      expect(result.session.status).toBe("CLOSED");
    });

    it("falls back to an idempotent proxy commit when direct commit confirmation fails", async () => {
      const localPath = await writeLocalFile("original");
      const originalHash = await hashFile(localPath);
      await writeFile(localPath, "direct upload with recovery");
      const uploadedHash = await hashFile(localPath);
      const objectKey = `desktop-master-check-ins/file-${uploadedHash}.xlsx`;
      const session = await makeSession({
        localPath,
        originalHash,
        lastKnownHash: originalHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
        directUploadSupported: true,
      });
      const store = createMemoryStore(session);
      const fetchUpload = vi.fn(async (url: string, init: TestFetchInit) => {
        await Promise.resolve();
        if (url.endsWith("/prepare")) {
          return jsonResponse({
            ok: true,
            mode: "DIRECT_PUT",
            objectKey,
            uploadUrl: "https://oss.example/signed-put",
            headers: {
              "Content-Type": "application/octet-stream",
              "x-oss-meta-sha256": uploadedHash,
            },
            expiresAt: "2099-06-05T03:00:00.000Z",
          });
        }
        if (url.endsWith("/release")) {
          return jsonResponse({ ok: true });
        }
        if (init.body instanceof FormData) {
          return jsonResponse({ ok: true, version: 3 });
        }
        return jsonResponse({ code: "INTERNAL_ERROR" }, 500);
      });
      const fetchTransfer = vi.fn(async () => {
        await Promise.resolve();
        return new Response(null, { status: 200 });
      });
      const result = await checkInDesktopSession(makeRequest(), {
        allowedUploadOrigins: ["http://localhost:3000"],
        fetchUpload,
        fetchTransfer,
        waitForStableFile: vi.fn().mockResolvedValue(),
        sessionStore: store,
      });

      expect(fetchTransfer).toHaveBeenCalledOnce();
      const commitCalls = fetchUpload.mock.calls.filter(
        ([url]) => url === makeRequest().checkInUrl
      );
      expect(commitCalls).toHaveLength(4);
      expect(commitCalls[0][1].body).toStrictEqual(expect.any(String));
      const fallbackBody = commitCalls[3][1].body as FormData;
      expect(fallbackBody.get("idempotencyKey")).toBe(
        `lock-session-1:${uploadedHash}`
      );
      await expect((fallbackBody.get("file") as Blob).text()).resolves.toBe(
        "direct upload with recovery"
      );
      expect(result.session.status).toBe("CLOSED");
    });

    it("resumes only missing OSS multipart parts from a persisted checkpoint", async () => {
      const localPath = await writeLocalFile("abcdefgh");
      const uploadedHash = await hashFile(localPath);
      const objectKey = `desktop-master-check-ins/${uploadedHash}.xlsx`;
      const session = await makeSession({
        localPath,
        originalHash: "original-hash",
        lastKnownHash: uploadedHash,
        lifecycleState: "CHECKIN_FAILED",
        contentState: "DIRTY",
        directUploadSupported: true,
        uploadCheckpoint: {
          localContentHash: uploadedHash,
          fileSize: 8,
          objectKey,
          uploadAttemptId: "attempt-1",
          uploadId: "upload-1",
          partSize: 4,
          completedParts: [{ partNumber: 1, etag: '"etag-1"' }],
        },
      });
      const store = createMemoryStore(session);
      const uploadedParts: string[] = [];
      let prepareBody: unknown;
      const fetchUpload = vi.fn(async (url: string, init: TestFetchInit) => {
        if (url.endsWith("/prepare")) {
          prepareBody = JSON.parse(String(init.body));
          return jsonResponse({
            ok: true,
            mode: "DIRECT_MULTIPART",
            objectKey,
            uploadId: "upload-1",
            partSize: 4,
            uploadedParts: [{ partNumber: 1, etag: '"etag-1"' }],
            parts: [
              { partNumber: 1, uploadUrl: "https://oss.example/part-1" },
              { partNumber: 2, uploadUrl: "https://oss.example/part-2" },
            ],
            expiresAt: "2099-06-05T03:00:00.000Z",
          });
        }
        if (url === "https://oss.example/part-2") {
          uploadedParts.push(await readNodeStream(init.body));
          return new Response(null, {
            status: 200,
            headers: { etag: '"etag-2"' },
          });
        }
        return jsonResponse({ ok: true });
      });

      await checkInDesktopSession(makeRequest(), {
        allowedUploadOrigins: ["http://localhost:3000"],
        fetchUpload,
        waitForStableFile: vi.fn().mockResolvedValue(),
        sessionStore: store,
      });

      expect(prepareBody).toStrictEqual(
        expect.objectContaining({
          resumeUploadId: "upload-1",
          uploadAttemptId: "attempt-1",
        })
      );
      expect(uploadedParts).toStrictEqual(["efgh"]);
      expect(
        fetchUpload.mock.calls.some(
          ([url]) => url === "https://oss.example/part-1"
        )
      ).toBeFalsy();
      const completeCall = fetchUpload.mock.calls.find(([url]) =>
        String(url).endsWith("/complete")
      );
      expect(JSON.parse(completeCall?.[1].body as string).parts).toStrictEqual([
        { partNumber: 1, etag: '"etag-1"' },
        { partNumber: 2, etag: '"etag-2"' },
      ]);
    });

    it("persists completed multipart parts and aborts siblings when a batch fails", async () => {
      const localPath = await writeLocalFile("abcdefghijkl");
      const uploadedHash = await hashFile(localPath);
      const objectKey = `desktop-master-check-ins/${uploadedHash}.xlsx`;
      const session = await makeSession({
        localPath,
        originalHash: "original-hash",
        lastKnownHash: uploadedHash,
        lifecycleState: "CLOSE_DETECTED",
        contentState: "DIRTY",
        directUploadSupported: true,
      });
      const store = createMemoryStore(session);
      let siblingAborted = false;
      const fetchUpload = vi.fn(async (url: string) => {
        await Promise.resolve();
        if (url.endsWith("/prepare")) {
          return jsonResponse({
            ok: true,
            mode: "DIRECT_MULTIPART",
            objectKey,
            uploadId: "upload-1",
            partSize: 4,
            uploadedParts: [],
            parts: [
              { partNumber: 1, uploadUrl: "https://oss.example/part-1" },
              { partNumber: 2, uploadUrl: "https://oss.example/part-2" },
              { partNumber: 3, uploadUrl: "https://oss.example/part-3" },
            ],
            expiresAt: "2099-06-05T03:00:00.000Z",
          });
        }
        return jsonResponse({ ok: true });
      });
      const fetchTransfer = vi.fn(async (url: string, init: TestFetchInit) => {
        if (url.endsWith("/part-1")) {
          return new Response(null, {
            status: 200,
            headers: { etag: '"etag-1"' },
          });
        }
        if (url.endsWith("/part-2")) {
          await new Promise((resolve) => {
            setTimeout(resolve, 10);
          });
          return jsonResponse(
            { code: "UPLOAD_FAILED", message: "Part rejected." },
            400
          );
        }
        return new Promise<Response>((_resolve, reject) => {
          const rejectAsAborted = () => {
            siblingAborted = true;
            reject(new DOMException("Aborted", "AbortError"));
          };
          if (init.signal?.aborted) {
            rejectAsAborted();
            return;
          }
          init.signal?.addEventListener("abort", rejectAsAborted, {
            once: true,
          });
        });
      });

      await expect(
        checkInDesktopSession(makeRequest(), {
          allowedUploadOrigins: ["http://localhost:3000"],
          fetchUpload,
          fetchTransfer,
          waitForStableFile: vi.fn().mockResolvedValue(),
          sessionStore: store,
        })
      ).rejects.toStrictEqual(
        new DesktopAgentError("UPLOAD_FAILED", "Part rejected.")
      );

      expect(siblingAborted).toBeTruthy();
      await expect(store.get("session-1")).resolves.toStrictEqual(
        expect.objectContaining({
          lifecycleState: "CHECKIN_FAILED",
          uploadCheckpoint: expect.objectContaining({
            uploadId: "upload-1",
            completedParts: [{ partNumber: 1, etag: '"etag-1"' }],
          }),
        })
      );
    });
  });

  function jsonResponse(body: unknown, status = 200) {
    return Response.json(body, {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  async function readNodeStream(stream: NodeJS.ReadableStream) {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf-8");
  }

  function makeRequest() {
    return {
      sessionId: "session-1",
      checkInUrl:
        "http://localhost:3000/desktop/master-sessions/lock-session-1/check-in",
      releaseUrl:
        "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
    };
  }

  function makeReleaseRequest() {
    return {
      sessionId: "session-1",
      releaseUrl:
        "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
    };
  }

  async function writeLocalFile(contents: string) {
    const root = await makeRoot();
    const localPath = join(root, "cash.xlsx");
    await writeFile(localPath, contents);
    return localPath;
  }

  async function makeSession(
    input: Partial<DesktopAgentSession> = {}
  ): Promise<DesktopAgentSession> {
    const lifecycleState = input.lifecycleState ?? "CLOSE_DETECTED";
    const contentState = input.contentState ?? "UNCHANGED";
    return {
      sessionId: "session-1",
      lockSessionId: "lock-session-1",
      mode: "MASTER",
      projectId: "project-1",
      attachmentId: "attachment-1",
      fileName: "cash.xlsx",
      localPath: input.localPath ?? (await writeLocalFile("original")),
      baseVersion: 2,
      originalHash: "hash-1",
      lastKnownHash: "hash-1",
      grantSecret: "grant-secret",
      status: getDesktopAgentCompatibilityStatus({
        lifecycleState,
        contentState,
      }),
      lifecycleState,
      contentState,
      openedAt: "2026-06-05T02:00:00.000Z",
      launchStartedAt: "2026-06-05T02:00:00.000Z",
      lastSeenAt: "2026-06-05T02:05:00.000Z",
      retryCount: 0,
      directUploadSupported: false,
      ...input,
    };
  }

  function createMemoryStore(initial: DesktopAgentSession) {
    let current: DesktopAgentSession | null = initial;
    const events: string[] = [];
    return {
      events,
      list: vi.fn(async () => {
        await Promise.resolve();
        return current ? [current] : [];
      }),
      get: vi.fn(async (sessionId: string) => {
        await Promise.resolve();
        return current?.sessionId === sessionId ? current : null;
      }),
      update: vi.fn(
        async (sessionId: string, patch: Partial<DesktopAgentSession>) => {
          await Promise.resolve();
          if (!current || current.sessionId !== sessionId) {
            return null;
          }
          current = { ...current, ...patch };
          events.push(
            `update:${patch.lifecycleState ?? patch.status ?? "patch"}`
          );
          return current;
        }
      ),
      updateIf: vi.fn(
        async (
          sessionId: string,
          predicate: (session: DesktopAgentSession) => boolean,
          patch: Partial<DesktopAgentSession>
        ) => {
          await Promise.resolve();
          if (
            !current ||
            current.sessionId !== sessionId ||
            !predicate(current)
          ) {
            return null;
          }
          current = { ...current, ...patch };
          events.push(
            `update:${patch.lifecycleState ?? patch.status ?? "patch"}`
          );
          return current;
        }
      ),
      remove: vi.fn(async (sessionId: string) => {
        await Promise.resolve();
        if (!current || current.sessionId !== sessionId) {
          return null;
        }
        const removed = current;
        current = null;
        events.push("remove");
        return removed;
      }),
    };
  }
});
