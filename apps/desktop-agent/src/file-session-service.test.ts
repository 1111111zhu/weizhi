import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import type { DesktopAgentSession } from "@project-wing/shared/desktop";
import { afterEach, describe, expect, it, vi } from "vitest";

import { checkInDesktopSession } from "./check-in-service.js";
import { DesktopAgentError, openDesktopFile } from "./file-session-service.js";
import { buildCacheFilePath } from "./path-safety.js";
import { createSessionStore } from "./session-store.js";

const { basename, dirname, join } = pathModule;

const roots: string[] = [];

describe("file-session-service", () => {
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

  describe("desktop agent file sessions", () => {
    it("downloads, caches, and launches a master file", async () => {
      const cacheRoot = await makeRoot();
      const storedSessions: unknown[] = [];
      const fetchFile = vi
        .fn()
        .mockResolvedValue(new Response("cash file", { status: 200 }));
      const launchFile = vi.fn().mockResolvedValue();
      const result = await openDesktopFile(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          downloadUrl:
            "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/download",
          authorization: "Bearer token",
          lockSessionId: "lock-session-1",
          baseVersion: 2,
          grantSecret: "grant-secret",
          checkInUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/check-in",
          releaseUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/release",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          fetchFile,
          launchFile,
          now: () => new Date("2026-06-05T02:00:00.000Z"),
          randomUUID: () => "session-1",
          sessionStore: {
            upsert: async (session) => {
              await Promise.resolve();
              storedSessions.push(session);
              return session;
            },
          },
        }
      );

      expect(result).toStrictEqual(
        expect.objectContaining({
          ok: true,
          sessionId: "session-1",
          openedAt: "2026-06-05T02:00:00.000Z",
        })
      );
      await expect(readFile(result.localPath, "utf-8")).resolves.toBe(
        "cash file"
      );
      const manifest = await readMasterCacheManifest(result.localPath);
      expect(manifest).toStrictEqual(
        expect.objectContaining({
          projectId: "project-1",
          attachmentId: "attachment-1",
          lockSessionId: "lock-session-1",
          fileName: "cash.xlsx",
          originalHash: hashText("cash file"),
        })
      );
      expect(fetchFile).toHaveBeenCalledWith(
        "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/download",
        { headers: { Authorization: "Bearer token" } }
      );
      expect(launchFile).toHaveBeenCalledWith(
        result.localPath,
        expect.objectContaining({
          mode: "MASTER",
          sessionId: "session-1",
          generation: 1,
          openSignalToken: expect.any(String),
          closeSignalToken: expect.any(String),
          agentBaseUrl: "http://127.0.0.1:17862",
        })
      );
      expect(storedSessions).toStrictEqual([
        expect.objectContaining({
          sessionId: "session-1",
          generation: 1,
          mode: "MASTER",
          openSignalToken: expect.any(String),
          closeSignalToken: expect.any(String),
          originalHash: expect.any(String),
          lastKnownHash: expect.any(String),
          status: "OPEN_UNCHANGED",
          lifecycleState: "LAUNCHING",
          contentState: "UNCHANGED",
          launchStartedAt: "2026-06-05T02:00:00.000Z",
          lockSessionId: "lock-session-1",
          checkInUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/check-in",
          releaseUrl:
            "http://localhost:3000/desktop/zip-entry-master-sessions/lock-session-1/release",
        }),
      ]);
    });

    it("reserves cache capacity and records access only after a successful open", async () => {
      const cacheRoot = await makeRoot();
      const trim = vi.fn().mockResolvedValue({ freedBytes: 0 });
      const recordAccess = vi.fn().mockResolvedValue({});
      const sessionStore = {
        list: vi.fn().mockResolvedValue([]),
        upsert: vi.fn(async (session: DesktopAgentSession) => {
          await Promise.resolve();
          return session;
        }),
      };
      const result = await openDesktopFile(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          downloadUrl: "http://localhost:3000/download",
          authorization: "Bearer token",
          lockSessionId: "lock-session-1",
          baseVersion: 1,
          grantSecret: "grant-secret",
          checkInUrl: "http://localhost:3000/check-in",
          releaseUrl: "http://localhost:3000/release",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          cacheIndex: { trim, recordAccess } as never,
          fetchFile: vi.fn().mockResolvedValue(
            new Response("cash file", {
              status: 200,
              headers: { "content-length": "9" },
            })
          ),
          launchFile: vi.fn().mockResolvedValue(),
          randomUUID: () => "session-1",
          sessionStore,
        }
      );

      expect(trim).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ cacheRoot, incomingBytes: 9 })
      );
      expect(recordAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          localPath: result.localPath,
          attachmentId: "attachment-1",
          state: "CLEAN",
        })
      );
      expect(trim).toHaveBeenCalledTimes(2);
    });

    it("reuses a locally verified master version without downloading it again", async () => {
      const cacheRoot = await makeRoot();
      const cachedPath = join(
        cacheRoot,
        "project-1",
        "attachment-1",
        "master",
        "old-lock",
        "cash.xlsx"
      );
      await mkdir(dirname(cachedPath), { recursive: true });
      await writeFile(cachedPath, "cached cash file");
      const contentHash = hashText("cached cash file");
      const fetchFile = vi.fn();
      const recordAccess = vi.fn().mockResolvedValue({});
      const trim = vi.fn().mockResolvedValue({ freedBytes: 0 });
      const launchFile = vi.fn().mockResolvedValue();
      const result = await openDesktopFile(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          downloadUrl: "http://localhost:3000/download",
          authorization: "Bearer token",
          lockSessionId: "new-lock",
          baseVersion: 2,
          grantSecret: "grant-secret",
          contentToken: "remote-version-2",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          cacheIndex: {
            findReusable: () => ({
              localPath: cachedPath,
              projectId: "project-1",
              attachmentId: "attachment-1",
              mode: "MASTER",
              contentToken: "remote-version-2",
              contentHash,
              sizeBytes: Buffer.byteLength("cached cash file"),
              state: "CLEAN",
              lastAccessedAt: "2026-07-01T00:00:00.000Z",
              accessCount: 1,
              pinned: false,
            }),
            recordAccess,
            trim,
          },
          fetchFile,
          launchFile,
          randomUUID: () => "session-1",
          sessionStore: {
            list: async () => {
              await Promise.resolve();
              return [];
            },
            upsert: async (session) => {
              await Promise.resolve();
              return session;
            },
          },
        }
      );

      expect(fetchFile).not.toHaveBeenCalled();
      await expect(readFile(result.localPath, "utf-8")).resolves.toBe(
        "cached cash file"
      );
      expect(recordAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          localPath: result.localPath,
          contentToken: "remote-version-2",
          contentHash,
        })
      );
      expect(launchFile).toHaveBeenCalledWith(
        result.localPath,
        expect.objectContaining({ mode: "MASTER" })
      );
    });

    it.each([
      "planning-memo.docx",
      "legacy-memo.doc",
      "board-deck.pptx",
      "archive-deck.ppt",
      "support.pdf",
    ])(
      "downloads, caches, and launches a read-only desktop file: %s",
      async (fileName) => {
        const cacheRoot = await makeRoot();
        const fetchFile = vi
          .fn()
          .mockResolvedValue(new Response("office file", { status: 200 }));
        const launchFile = vi.fn().mockResolvedValue();
        const upsert = vi.fn();
        const result = await openDesktopFile(
          {
            mode: "READ_ONLY",
            projectId: "project-1",
            attachmentId: "attachment-office",
            fileName,
            downloadUrl: "http://localhost:3000/file",
          },
          {
            allowedDownloadOrigins: ["http://localhost:3000"],
            cacheRoot,
            fetchFile,
            launchFile,
            sessionStore: { upsert },
          }
        );

        expect(result).toStrictEqual(
          expect.objectContaining({
            ok: true,
            sessionId: expect.any(String),
            localPath: join(
              cacheRoot,
              "project-1",
              "attachment-office",
              "read-only",
              "read-only",
              fileName
            ),
          })
        );
        await expect(readFile(result.localPath, "utf-8")).resolves.toBe(
          "office file"
        );
        expect(fetchFile).toHaveBeenCalledWith("http://localhost:3000/file", {
          headers: {},
        });
        expect(launchFile).toHaveBeenCalledWith(
          result.localPath,
          expect.objectContaining({
            mode: "READ_ONLY",
          })
        );
        expect(upsert).not.toHaveBeenCalled();
      }
    );

    it("streams read-only downloads without requiring arrayBuffer", async () => {
      const cacheRoot = await makeRoot();
      const launchFile = vi.fn().mockResolvedValue();
      const fetchFile = vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("%PDF-"));
            controller.enqueue(new TextEncoder().encode("1.7"));
            controller.close();
          },
        }),
        arrayBuffer: vi.fn(async () => {
          await Promise.resolve();
          throw new Error("arrayBuffer should not be used for streamed files");
        }),
      } as unknown as Response);
      const result = await openDesktopFile(
        {
          mode: "READ_ONLY",
          projectId: "project-1",
          attachmentId: "attachment-pdf",
          fileName: "support.pdf",
          downloadUrl: "http://localhost:3000/file",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          fetchFile,
          launchFile,
          sessionStore: { upsert: vi.fn() },
        }
      );

      await expect(readFile(result.localPath, "utf-8")).resolves.toBe(
        "%PDF-1.7"
      );
      expect(launchFile).toHaveBeenCalledWith(
        result.localPath,
        expect.objectContaining({ mode: "READ_ONLY" })
      );
    });

    it("downloads, caches, and launches a PDF Master file", async () => {
      const cacheRoot = await makeRoot();
      let storedSession: DesktopAgentSession | null = null;
      const fetchFile = vi
        .fn()
        .mockResolvedValue(new Response("%PDF-1.4", { status: 200 }));
      const upsert = vi.fn(async (session: DesktopAgentSession) => {
        await Promise.resolve();
        storedSession = session;
        return session;
      });
      const update = vi.fn(
        async (sessionId: string, patch: Partial<DesktopAgentSession>) => {
          await Promise.resolve();
          if (!storedSession || storedSession.sessionId !== sessionId) {
            return null;
          }
          storedSession = { ...storedSession, ...patch };
          return storedSession;
        }
      );
      const launchFile = vi.fn(async () => {
        await update("session-1", {
          excelHelperProcessId: 7890,
          lifecycleState: "OPEN",
          openObservedAt: "2026-06-05T02:00:01.000Z",
          openObservedSource: "MONITOR_PROCESS",
        });
        return { helperProcessId: 7890 };
      });
      const result = await openDesktopFile(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-pdf",
          fileName: "support.pdf",
          downloadUrl: "http://localhost:3000/file",
          lockSessionId: "lock-session-1",
          baseVersion: 1,
          grantSecret: "grant-secret",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          fetchFile,
          launchFile,
          now: () => new Date("2026-06-05T02:00:00.000Z"),
          randomUUID: () => "session-1",
          openObservationTimeoutMs: 1000,
          openObservationPollIntervalMs: 0,
          sessionStore: {
            upsert,
            update,
            get: async () => {
              await Promise.resolve();
              return storedSession;
            },
          },
        }
      );

      expect(launchFile).toHaveBeenCalledWith(
        result.localPath,
        expect.objectContaining({ mode: "MASTER" })
      );
      expect(storedSession).toStrictEqual(
        expect.objectContaining({
          fileName: "support.pdf",
          lifecycleState: "OPEN",
          openObservedSource: "MONITOR_PROCESS",
          excelHelperProcessId: 7890,
        })
      );
    });

    it("streams master downloads while still computing the original hash", async () => {
      const cacheRoot = await makeRoot();
      let storedSession: DesktopAgentSession | null = null;
      const payload = "%PDF-1.7 streamed";
      const fetchFile = vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("%PDF-1.7 "));
            controller.enqueue(new TextEncoder().encode("streamed"));
            controller.close();
          },
        }),
        arrayBuffer: vi.fn(async () => {
          await Promise.resolve();
          throw new Error("arrayBuffer should not be used for streamed files");
        }),
      } as unknown as Response);
      const upsert = vi.fn(async (session: DesktopAgentSession) => {
        await Promise.resolve();
        storedSession = session;
        return session;
      });
      const update = vi.fn(
        async (sessionId: string, patch: Partial<DesktopAgentSession>) => {
          await Promise.resolve();
          if (!storedSession || storedSession.sessionId !== sessionId) {
            return null;
          }
          storedSession = { ...storedSession, ...patch };
          return storedSession;
        }
      );
      const launchFile = vi.fn(async () => {
        await update("session-1", {
          lifecycleState: "OPEN",
          openObservedAt: "2026-06-05T02:00:01.000Z",
          openObservedSource: "MONITOR_PROCESS",
        });
        return { helperProcessId: 7890 };
      });
      const result = await openDesktopFile(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-pdf",
          fileName: "support.pdf",
          downloadUrl: "http://localhost:3000/file",
          lockSessionId: "lock-session-1",
          baseVersion: 1,
          grantSecret: "grant-secret",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          fetchFile,
          launchFile,
          now: () => new Date("2026-06-05T02:00:00.000Z"),
          randomUUID: () => "session-1",
          openObservationTimeoutMs: 1000,
          openObservationPollIntervalMs: 0,
          sessionStore: {
            upsert,
            update,
            get: async () => {
              await Promise.resolve();
              return storedSession;
            },
          },
        }
      );

      await expect(readFile(result.localPath, "utf-8")).resolves.toBe(payload);
      expect(storedSession).toStrictEqual(
        expect.objectContaining({
          originalHash: hashText(payload),
          lastKnownHash: hashText(payload),
          contentState: "UNCHANGED",
        })
      );
    });

    it("accepts launcher-confirmed PDF Master opens without probe observation", async () => {
      const cacheRoot = await makeRoot();
      let storedSession: DesktopAgentSession | null = null;
      const fetchFile = vi
        .fn()
        .mockResolvedValue(new Response("%PDF-1.4", { status: 200 }));
      const upsert = vi.fn(async (session: DesktopAgentSession) => {
        await Promise.resolve();
        storedSession = session;
        return session;
      });
      const update = vi.fn(
        async (sessionId: string, patch: Partial<DesktopAgentSession>) => {
          await Promise.resolve();
          if (!storedSession || storedSession.sessionId !== sessionId) {
            return null;
          }
          storedSession = { ...storedSession, ...patch };
          return storedSession;
        }
      );
      const get = vi.fn(async () => {
        await Promise.resolve();
        return storedSession;
      });
      const launchFile = vi.fn().mockResolvedValue({
        helperProcessId: 7890,
        openObservedOnSpawn: true,
        openObservedSource: "LAUNCHER_PROCESS",
      });
      const result = await openDesktopFile(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-pdf",
          fileName: "support.pdf",
          downloadUrl: "http://localhost:3000/file",
          lockSessionId: "lock-session-1",
          baseVersion: 1,
          grantSecret: "grant-secret",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          fetchFile,
          launchFile,
          now: () => new Date("2026-06-05T02:00:00.000Z"),
          randomUUID: () => "session-1",
          openObservationTimeoutMs: 0,
          openObservationPollIntervalMs: 0,
          sessionStore: {
            upsert,
            update,
            get,
          },
        }
      );

      expect(result.sessionId).toBe("session-1");
      expect(get).toHaveBeenCalledWith("session-1");
      expect(storedSession).toStrictEqual(
        expect.objectContaining({
          lifecycleState: "OPEN",
          status: "OPEN_UNCHANGED",
          openObservedAt: "2026-06-05T02:00:00.000Z",
          openObservedSource: "LAUNCHER_PROCESS",
          lastObservationAt: "2026-06-05T02:00:00.000Z",
          excelHelperProcessId: 7890,
        })
      );
    });

    it("uses the PDF-specific open observation timeout for PDF Master launches", async () => {
      const previousGenericTimeout =
        process.env.PROJECT_WING_AGENT_OPEN_OBSERVATION_TIMEOUT_MS;
      const previousPdfTimeout =
        process.env.PROJECT_WING_AGENT_PDF_OPEN_OBSERVATION_TIMEOUT_MS;
      process.env.PROJECT_WING_AGENT_OPEN_OBSERVATION_TIMEOUT_MS = "0";
      process.env.PROJECT_WING_AGENT_PDF_OPEN_OBSERVATION_TIMEOUT_MS = "50";
      const cacheRoot = await makeRoot();
      let getCount = 0;
      let storedSession: DesktopAgentSession | null = null;
      const fetchFile = vi
        .fn()
        .mockResolvedValue(new Response("%PDF-1.4", { status: 200 }));
      const upsert = vi.fn(async (session: DesktopAgentSession) => {
        await Promise.resolve();
        storedSession = session;
        return session;
      });
      const update = vi.fn(
        async (
          sessionId: string,
          patch: Partial<DesktopAgentSession>
        ): Promise<DesktopAgentSession | null> => {
          await Promise.resolve();
          if (!storedSession || storedSession.sessionId !== sessionId) {
            return null;
          }
          storedSession = { ...storedSession, ...patch };
          return storedSession;
        }
      );
      const get = vi.fn(async () => {
        await Promise.resolve();
        getCount += 1;
        if (getCount >= 2 && storedSession) {
          storedSession = {
            ...storedSession,
            lifecycleState: "OPEN",
            openObservedAt: "2026-06-05T02:00:01.000Z",
            openObservedSource: "MONITOR_PROCESS",
          };
        }
        return storedSession;
      });

      try {
        const result = await openDesktopFile(
          {
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-pdf",
            fileName: "support.pdf",
            downloadUrl: "http://localhost:3000/file",
            lockSessionId: "lock-session-1",
            baseVersion: 1,
            grantSecret: "grant-secret",
          },
          {
            allowedDownloadOrigins: ["http://localhost:3000"],
            cacheRoot,
            fetchFile,
            launchFile: vi.fn().mockResolvedValue({ helperProcessId: 7891 }),
            now: () => new Date("2026-06-05T02:00:00.000Z"),
            randomUUID: () => "session-1",
            openObservationPollIntervalMs: 0,
            sessionStore: {
              upsert,
              update,
              get,
            },
          }
        );

        expect(result.sessionId).toBe("session-1");
        expect(get).toHaveBeenCalledTimes(2);
        expect(storedSession).toStrictEqual(
          expect.objectContaining({
            lifecycleState: "OPEN",
            openObservedSource: "MONITOR_PROCESS",
            excelHelperProcessId: 7891,
          })
        );
      } finally {
        restoreEnv(
          "PROJECT_WING_AGENT_OPEN_OBSERVATION_TIMEOUT_MS",
          previousGenericTimeout
        );
        restoreEnv(
          "PROJECT_WING_AGENT_PDF_OPEN_OBSERVATION_TIMEOUT_MS",
          previousPdfTimeout
        );
      }
    });

    it("reports PDF-specific open observation timeout errors", async () => {
      const cacheRoot = await makeRoot();
      let storedSession: DesktopAgentSession | null = null;
      const update = vi.fn(
        async (
          sessionId: string,
          patch: Partial<DesktopAgentSession>
        ): Promise<DesktopAgentSession | null> => {
          await Promise.resolve();
          if (!storedSession || storedSession.sessionId !== sessionId) {
            return null;
          }
          storedSession = {
            ...storedSession,
            ...patch,
            lastSeenAt: "2026-06-05T02:00:01.000Z",
          };
          return storedSession;
        }
      );

      await expect(
        openDesktopFile(
          {
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-pdf",
            fileName: "support.pdf",
            downloadUrl: "http://localhost:3000/file",
            lockSessionId: "lock-session-1",
            baseVersion: 1,
            grantSecret: "grant-secret",
          },
          {
            allowedDownloadOrigins: ["http://localhost:3000"],
            cacheRoot,
            fetchFile: vi
              .fn()
              .mockResolvedValue(new Response("%PDF-1.4", { status: 200 })),
            launchFile: vi.fn().mockResolvedValue({ helperProcessId: 7890 }),
            terminateHelperProcess: vi.fn(),
            randomUUID: () => "session-1",
            openObservationTimeoutMs: 0,
            openObservationPollIntervalMs: 0,
            sessionStore: {
              get: vi.fn(async () => {
                await Promise.resolve();
                return storedSession;
              }),
              upsert: vi.fn(async (session: DesktopAgentSession) => {
                await Promise.resolve();
                storedSession = session;
                return session;
              }),
              update,
            },
          }
        )
      ).rejects.toStrictEqual(
        new DesktopAgentError(
          "OPEN_FAILED",
          "PDF open was not observed before the launch observation timeout."
        )
      );
      expect(update).toHaveBeenCalledWith(
        "session-1",
        expect.objectContaining({
          lifecycleState: "LAUNCH_FAILED",
          launchFailedReason: "OPEN_OBSERVATION_TIMEOUT",
          lastError:
            "PDF open was not observed before the launch observation timeout.",
        })
      );
    });

    it("downloads and launches unsupported Master formats in read-only mode", async () => {
      const cacheRoot = await makeRoot();
      const fetchFile = vi
        .fn()
        .mockResolvedValue(new Response("archive", { status: 200 }));
      const launchFile = vi.fn().mockResolvedValue();
      const result = await openDesktopFile(
        {
          mode: "READ_ONLY",
          projectId: "project-1",
          attachmentId: "attachment-zip",
          fileName: "support.zip",
          downloadUrl: "http://localhost:3000/file",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          fetchFile,
          launchFile,
          sessionStore: { upsert: vi.fn() },
        }
      );

      expect(fetchFile).toHaveBeenCalledOnce();
      expect(launchFile).toHaveBeenCalledWith(
        result.localPath,
        expect.objectContaining({ mode: "READ_ONLY" })
      );
    });

    it("persists a recoverable master session before launching the desktop application", async () => {
      const cacheRoot = await makeRoot();
      const events: string[] = [];
      const fetchFile = vi
        .fn()
        .mockResolvedValue(new Response("cash file", { status: 200 }));
      const launchFile = vi.fn().mockImplementation(async () => {
        await Promise.resolve();
        events.push("launch");
      });
      const upsert = vi.fn().mockImplementation(async (session) => {
        await Promise.resolve();
        events.push("upsert");
        return session;
      });

      await openDesktopFile(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          downloadUrl: "http://localhost:3000/file",
          lockSessionId: "lock-session-1",
          baseVersion: 2,
          grantSecret: "grant-secret",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          fetchFile,
          launchFile,
          randomUUID: () => "session-1",
          sessionStore: { upsert },
        }
      );

      expect(events).toStrictEqual(["upsert", "launch"]);
    });

    it("waits for a Master open observation before reporting launch success", async () => {
      const cacheRoot = await makeRoot();
      let storedSession: DesktopAgentSession | null = null;
      const fetchFile = vi
        .fn()
        .mockResolvedValue(new Response("cash file", { status: 200 }));
      const get = vi.fn(async () => {
        await Promise.resolve();
        return storedSession;
      });
      const upsert = vi.fn(async (session: DesktopAgentSession) => {
        await Promise.resolve();
        storedSession = session;
        return session;
      });
      const update = vi.fn(
        async (
          sessionId: string,
          patch: Partial<DesktopAgentSession>
        ): Promise<DesktopAgentSession | null> => {
          await Promise.resolve();
          if (!storedSession || storedSession.sessionId !== sessionId) {
            return null;
          }
          storedSession = {
            ...storedSession,
            ...patch,
            lastSeenAt: "2026-06-05T02:00:01.000Z",
          };
          return storedSession;
        }
      );
      const launchFile = vi.fn(async () => {
        await update("session-1", {
          lifecycleState: "OPEN",
          openObservedAt: "2026-06-05T02:00:01.000Z",
          openObservedSource: "WATCHER_COM",
        });
        return { helperProcessId: 1234 };
      });
      const result = await openDesktopFile(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          downloadUrl: "http://localhost:3000/file",
          lockSessionId: "lock-session-1",
          baseVersion: 2,
          grantSecret: "grant-secret",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          fetchFile,
          launchFile,
          randomUUID: () => "session-1",
          openObservationTimeoutMs: 1000,
          openObservationPollIntervalMs: 0,
          sessionStore: {
            get,
            upsert,
            update,
          },
        }
      );

      expect(result.sessionId).toBe("session-1");
      expect(get).toHaveBeenCalledWith("session-1");
      expect(storedSession).toStrictEqual(
        expect.objectContaining({
          lifecycleState: "OPEN",
          openObservedAt: "2026-06-05T02:00:01.000Z",
        })
      );
    });

    it("marks a Master launch failed when open observation is not recorded before timeout", async () => {
      const cacheRoot = await makeRoot();
      let storedSession: DesktopAgentSession | null = null;
      const update = vi.fn(
        async (
          sessionId: string,
          patch: Partial<DesktopAgentSession>
        ): Promise<DesktopAgentSession | null> => {
          await Promise.resolve();
          if (!storedSession || storedSession.sessionId !== sessionId) {
            return null;
          }
          storedSession = {
            ...storedSession,
            ...patch,
            lastSeenAt: "2026-06-05T02:00:01.000Z",
          };
          return storedSession;
        }
      );

      await expect(
        openDesktopFile(
          {
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "cash.xlsx",
            downloadUrl: "http://localhost:3000/file",
            lockSessionId: "lock-session-1",
            baseVersion: 2,
            grantSecret: "grant-secret",
          },
          {
            allowedDownloadOrigins: ["http://localhost:3000"],
            cacheRoot,
            fetchFile: vi
              .fn()
              .mockResolvedValue(new Response("cash file", { status: 200 })),
            launchFile: vi.fn().mockResolvedValue({ helperProcessId: 1234 }),
            terminateHelperProcess: vi.fn(),
            randomUUID: () => "session-1",
            openObservationTimeoutMs: 0,
            openObservationPollIntervalMs: 0,
            sessionStore: {
              get: vi.fn(async () => {
                await Promise.resolve();
                return storedSession;
              }),
              upsert: vi.fn(async (session: DesktopAgentSession) => {
                await Promise.resolve();
                storedSession = session;
                return session;
              }),
              update,
            },
          }
        )
      ).rejects.toStrictEqual(
        new DesktopAgentError(
          "OPEN_FAILED",
          "Excel open was not observed before the launch observation timeout."
        )
      );
      expect(update).toHaveBeenCalledWith(
        "session-1",
        expect.objectContaining({
          lifecycleState: "LAUNCH_FAILED",
          launchFailedReason: "OPEN_OBSERVATION_TIMEOUT",
          lastError:
            "Excel open was not observed before the launch observation timeout.",
        })
      );
    });

    it("recovers an orphan master cache without overwriting local changes", async () => {
      const cacheRoot = await makeRoot();
      const localPath = join(
        cacheRoot,
        "project-1",
        "attachment-1",
        "master",
        "lock-session-1",
        "cash.xlsx"
      );
      await mkdir(dirname(localPath), { recursive: true });
      await writeFile(localPath, "edited local cash file");
      await writeMasterCacheManifest(localPath, {
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        fileName: "cash.xlsx",
        originalHash: hashText("server cash file"),
      });

      const storedSessions: unknown[] = [];
      const fetchFile = vi
        .fn()
        .mockResolvedValue(new Response("server cash file", { status: 200 }));
      const launchFile = vi.fn().mockResolvedValue();
      const result = await openDesktopFile(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          downloadUrl: "http://localhost:3000/file",
          lockSessionId: "lock-session-1",
          baseVersion: 2,
          grantSecret: "grant-secret",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          fetchFile,
          launchFile,
          randomUUID: () => "session-1",
          sessionStore: {
            list: async () => {
              await Promise.resolve();
              return [];
            },
            upsert: async (session) => {
              await Promise.resolve();
              storedSessions.push(session);
              return session;
            },
          },
        }
      );

      await expect(readFile(localPath, "utf-8")).resolves.toBe(
        "edited local cash file"
      );
      expect(result.localPath).toBe(localPath);
      expect(launchFile).toHaveBeenCalledWith(
        localPath,
        expect.objectContaining({
          mode: "MASTER",
          sessionId: "session-1",
          generation: 1,
          openSignalToken: expect.any(String),
          closeSignalToken: expect.any(String),
        })
      );
      expect(storedSessions).toStrictEqual([
        expect.objectContaining({
          sessionId: "session-1",
          lockSessionId: "lock-session-1",
          status: "DIRTY_PENDING_CHECKIN",
          lifecycleState: "LAUNCHING",
          contentState: "DIRTY",
          originalHash: expect.any(String),
          lastKnownHash: expect.any(String),
        }),
      ]);
      const [session] = storedSessions as DesktopAgentSession[];
      expect(session.originalHash).toBe(hashText("server cash file"));
      expect(session.lastKnownHash).toBe(hashText("edited local cash file"));
    });

    it("rejects unmarked dirty master caches instead of uploading unsafe content", async () => {
      const cacheRoot = await makeRoot();
      const localPath = join(
        cacheRoot,
        "project-1",
        "attachment-1",
        "master",
        "lock-session-1",
        "cash.xlsx"
      );
      await mkdir(dirname(localPath), { recursive: true });
      await writeFile(localPath, "unknown local content");
      const upsert = vi.fn();
      const launchFile = vi.fn();

      await expect(
        openDesktopFile(
          {
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "cash.xlsx",
            downloadUrl: "http://localhost:3000/file",
            lockSessionId: "lock-session-1",
            baseVersion: 2,
            grantSecret: "grant-secret",
          },
          {
            allowedDownloadOrigins: ["http://localhost:3000"],
            cacheRoot,
            fetchFile: vi
              .fn()
              .mockResolvedValue(
                new Response("server cash file", { status: 200 })
              ),
            launchFile,
            sessionStore: {
              list: async () => {
                await Promise.resolve();
                return [];
              },
              upsert,
            },
          }
        )
      ).rejects.toStrictEqual(
        new DesktopAgentError(
          "CACHE_RECOVERY_UNSAFE",
          "Existing Master cache cannot be recovered automatically."
        )
      );
      await expect(readFile(localPath, "utf-8")).resolves.toBe(
        "unknown local content"
      );
      expect(upsert).not.toHaveBeenCalled();
      expect(launchFile).not.toHaveBeenCalled();
    });

    it("repairs an unmarked unchanged master cache without marking it dirty", async () => {
      const cacheRoot = await makeRoot();
      const localPath = join(
        cacheRoot,
        "project-1",
        "attachment-1",
        "master",
        "lock-session-1",
        "cash.xlsx"
      );
      await mkdir(dirname(localPath), { recursive: true });
      await writeFile(localPath, "server cash file");
      const storedSessions: unknown[] = [];

      await openDesktopFile(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          downloadUrl: "http://localhost:3000/file",
          lockSessionId: "lock-session-1",
          baseVersion: 2,
          grantSecret: "grant-secret",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          fetchFile: vi
            .fn()
            .mockResolvedValue(
              new Response("server cash file", { status: 200 })
            ),
          launchFile: vi.fn(),
          randomUUID: () => "session-1",
          sessionStore: {
            list: async () => {
              await Promise.resolve();
              return [];
            },
            upsert: async (session) => {
              await Promise.resolve();
              storedSessions.push(session);
              return session;
            },
          },
        }
      );

      expect(storedSessions).toStrictEqual([
        expect.objectContaining({
          status: "OPEN_UNCHANGED",
          lifecycleState: "LAUNCHING",
          contentState: "UNCHANGED",
          originalHash: hashText("server cash file"),
          lastKnownHash: hashText("server cash file"),
        }),
      ]);
      await expect(readMasterCacheManifest(localPath)).resolves.toStrictEqual(
        expect.objectContaining({
          originalHash: hashText("server cash file"),
        })
      );
    });

    it("recovers an orphan dirty cache through check-in, release, and cleanup", async () => {
      const cacheRoot = await makeRoot();
      const stateRoot = await makeRoot();
      const store = createSessionStore({
        stateRoot,
        now: () => new Date("2026-06-05T02:10:00.000Z"),
      });
      const localPath = join(
        cacheRoot,
        "project-1",
        "attachment-1",
        "master",
        "lock-session-1",
        "cash.xlsx"
      );
      await mkdir(dirname(localPath), { recursive: true });
      await writeFile(localPath, "edited local cash file");
      await writeMasterCacheManifest(localPath, {
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        fileName: "cash.xlsx",
        originalHash: hashText("server cash file"),
      });

      const opened = await openDesktopFile(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          downloadUrl: "http://localhost:3000/file",
          lockSessionId: "lock-session-1",
          baseVersion: 2,
          grantSecret: "grant-secret",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          fetchFile: vi
            .fn()
            .mockResolvedValue(
              new Response("server cash file", { status: 200 })
            ),
          launchFile: vi.fn(async () => {
            await store.update("session-1", {
              lifecycleState: "OPEN",
              openObservedAt: "2026-06-05T02:10:01.000Z",
              openObservedSource: "WATCHER_COM",
            });
          }),
          randomUUID: () => "session-1",
          sessionStore: store,
        }
      );

      await expect(store.get(opened.sessionId)).resolves.toStrictEqual(
        expect.objectContaining({
          status: "DIRTY_PENDING_CHECKIN",
          lifecycleState: "OPEN",
          contentState: "DIRTY",
        })
      );

      const fetchUpload = vi.fn();
      await expect(
        checkInDesktopSession(
          {
            sessionId: opened.sessionId,
            checkInUrl:
              "http://localhost:3000/desktop/master-sessions/lock-session-1/check-in",
            releaseUrl:
              "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
          },
          {
            allowedUploadOrigins: ["http://localhost:3000"],
            fetchUpload,
            waitForStableFile: vi.fn().mockResolvedValue(),
            sessionStore: store,
          }
        )
      ).rejects.toMatchObject({
        code: "LOCAL_FILE_BUSY_OR_OPEN",
      });
      expect(fetchUpload).not.toHaveBeenCalled();
      await expect(readFile(localPath, "utf-8")).resolves.toBe(
        "edited local cash file"
      );
      await expect(store.get(opened.sessionId)).resolves.toStrictEqual(
        expect.objectContaining({
          lifecycleState: "OPEN",
          contentState: "DIRTY",
        })
      );
    });

    it("rejects duplicate local master opens for the same attachment and lock session", async () => {
      const cacheRoot = await makeRoot();
      const existingSession = makeStoredSession({
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        status: "OPEN_UNCHANGED",
      });
      const fetchFile = vi.fn();

      await expect(
        openDesktopFile(
          {
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "cash.xlsx",
            downloadUrl: "http://localhost:3000/file",
            lockSessionId: "lock-session-1",
            baseVersion: 2,
            grantSecret: "grant-secret",
          },
          {
            allowedDownloadOrigins: ["http://localhost:3000"],
            cacheRoot,
            fetchFile,
            launchFile: vi.fn(),
            sessionStore: {
              list: async () => {
                await Promise.resolve();
                return [existingSession];
              },
              upsert: vi.fn(),
              update: vi.fn(),
            },
          }
        )
      ).rejects.toStrictEqual(
        new DesktopAgentError(
          "SESSION_ALREADY_OPEN",
          "This Master file is already being tracked locally."
        )
      );
      expect(fetchFile).not.toHaveBeenCalled();
    });

    it("does not stale-fail launching PDF sessions when guarding another Master open", async () => {
      const cacheRoot = await makeRoot();
      const existingPdfSession = makeStoredSession({
        sessionId: "session-pdf",
        attachmentId: "attachment-pdf",
        lockSessionId: "lock-session-pdf",
        status: "OPEN_UNCHANGED",
        fileName: "support.pdf",
        localPath: "C:\\ProjectWing\\support.pdf",
        lifecycleState: "LAUNCHING",
        openObservedAt: undefined,
        launchStartedAt: "2026-06-05T02:00:00.000Z",
      });
      let storedSession: DesktopAgentSession | null = null;
      const update = vi.fn(
        async (
          sessionId: string,
          patch: Partial<DesktopAgentSession>
        ): Promise<DesktopAgentSession | null> => {
          await Promise.resolve();
          if (storedSession && storedSession.sessionId === sessionId) {
            storedSession = { ...storedSession, ...patch };
            return storedSession;
          }
          if (sessionId === existingPdfSession.sessionId) {
            return { ...existingPdfSession, ...patch };
          }
          return null;
        }
      );
      const makeId = vi
        .fn()
        .mockReturnValueOnce("session-cash")
        .mockReturnValueOnce("open-token-cash")
        .mockReturnValueOnce("close-token-cash");
      const launchFile = vi.fn(async () => {
        await update("session-cash", {
          lifecycleState: "OPEN",
          openObservedAt: "2026-06-05T02:00:22.000Z",
          openObservedSource: "WATCHER_COM",
        });
      });

      await openDesktopFile(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-cash",
          fileName: "cash.xlsx",
          downloadUrl: "http://localhost:3000/file",
          lockSessionId: "lock-session-cash",
          baseVersion: 2,
          grantSecret: "grant-secret",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          fetchFile: vi
            .fn()
            .mockResolvedValue(new Response("cash file", { status: 200 })),
          launchFile,
          now: () => new Date("2026-06-05T02:00:21.000Z"),
          randomUUID: makeId,
          openObservationPollIntervalMs: 0,
          sessionStore: {
            list: async () => {
              await Promise.resolve();
              return [existingPdfSession];
            },
            get: async () => {
              await Promise.resolve();
              return storedSession;
            },
            upsert: vi.fn(async (session: DesktopAgentSession) => {
              await Promise.resolve();
              storedSession = session;
              return session;
            }),
            update,
          },
        }
      );

      expect(update).not.toHaveBeenCalledWith(
        "session-pdf",
        expect.objectContaining({
          lifecycleState: "LAUNCH_FAILED",
        })
      );
    });

    it("rejects duplicate local master opens while launch observation is still pending", async () => {
      const cacheRoot = await makeRoot();
      const existingSession = makeStoredSession({
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        status: "OPEN_UNCHANGED",
        lifecycleState: "LAUNCHING",
        openObservedAt: undefined,
        openObservedSource: undefined,
        launchStartedAt: "2026-06-05T02:00:00.000Z",
      });
      const fetchFile = vi.fn();

      await expect(
        openDesktopFile(
          {
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "cash.xlsx",
            downloadUrl: "http://localhost:3000/file",
            lockSessionId: "lock-session-1",
            baseVersion: 2,
            grantSecret: "grant-secret",
          },
          {
            allowedDownloadOrigins: ["http://localhost:3000"],
            cacheRoot,
            fetchFile,
            launchFile: vi.fn(),
            now: () => new Date("2026-06-05T02:00:10.000Z"),
            openObservationTimeoutMs: 20_000,
            sessionStore: {
              list: async () => {
                await Promise.resolve();
                return [existingSession];
              },
              upsert: vi.fn(),
              update: vi.fn(),
            },
          }
        )
      ).rejects.toStrictEqual(
        new DesktopAgentError(
          "SESSION_ALREADY_OPEN",
          "This Master file is already being tracked locally."
        )
      );
      expect(fetchFile).not.toHaveBeenCalled();
    });

    it("does not treat stale unobserved launches as active local master opens", async () => {
      const cacheRoot = await makeRoot();
      const existingSession = makeStoredSession({
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        status: "OPEN_UNCHANGED",
        lifecycleState: "LAUNCHING",
        openObservedAt: undefined,
        openObservedSource: undefined,
        launchStartedAt: "2026-06-05T02:00:00.000Z",
      });
      let storedSession: DesktopAgentSession | null = null;
      const update = vi.fn(
        async (
          sessionId: string,
          patch: Partial<DesktopAgentSession>
        ): Promise<DesktopAgentSession | null> => {
          await Promise.resolve();
          if (sessionId === existingSession.sessionId) {
            return { ...existingSession, ...patch };
          }
          if (!storedSession || storedSession.sessionId !== sessionId) {
            return null;
          }
          storedSession = { ...storedSession, ...patch };
          return storedSession;
        }
      );

      await openDesktopFile(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          downloadUrl: "http://localhost:3000/file",
          lockSessionId: "lock-session-1",
          baseVersion: 2,
          grantSecret: "grant-secret",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          fetchFile: vi
            .fn()
            .mockResolvedValue(new Response("cash file", { status: 200 })),
          launchFile: vi.fn(async () => {
            await update("session-2", {
              lifecycleState: "OPEN",
              openObservedAt: "2026-06-05T02:01:01.000Z",
              openObservedSource: "WATCHER_COM",
            });
          }),
          now: () => new Date("2026-06-05T02:01:00.000Z"),
          randomUUID: () => "session-2",
          openObservationTimeoutMs: 20_000,
          openObservationPollIntervalMs: 0,
          sessionStore: {
            list: async () => {
              await Promise.resolve();
              return [existingSession];
            },
            get: async (sessionId) => {
              await Promise.resolve();
              return sessionId === "session-2"
                ? storedSession
                : existingSession;
            },
            upsert: vi.fn(async (session: DesktopAgentSession) => {
              await Promise.resolve();
              storedSession = session;
              return session;
            }),
            update,
          },
        }
      );

      expect(update).toHaveBeenCalledWith(
        "session-1",
        expect.objectContaining({
          lifecycleState: "LAUNCH_FAILED",
          launchFailedReason: "OPEN_OBSERVATION_TIMEOUT",
          lastError:
            "Excel open was not observed before the launch observation timeout.",
        })
      );
      expect(storedSession).toStrictEqual(
        expect.objectContaining({
          sessionId: "session-2",
          lifecycleState: "OPEN",
          openObservedAt: "2026-06-05T02:01:01.000Z",
        })
      );
    });

    it("does not treat an unobserved launch residue as an active local master open", async () => {
      const cacheRoot = await makeRoot();
      const existingSession = makeStoredSession({
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        status: "OPEN_UNCHANGED",
        lifecycleState: "OPEN_NOT_OBSERVED",
        openObservedAt: undefined,
        openObservedSource: undefined,
      });
      const fetchFile = vi
        .fn()
        .mockResolvedValue(new Response("cash file", { status: 200 }));
      const upsert = vi.fn().mockImplementation(async (session) => {
        await Promise.resolve();
        return session;
      });

      await openDesktopFile(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          downloadUrl: "http://localhost:3000/file",
          lockSessionId: "lock-session-1",
          baseVersion: 2,
          grantSecret: "grant-secret",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          fetchFile,
          launchFile: vi.fn(),
          randomUUID: () => "session-2",
          sessionStore: {
            list: async () => {
              await Promise.resolve();
              return [existingSession];
            },
            upsert,
            update: vi.fn(),
          },
        }
      );

      expect(fetchFile).toHaveBeenCalledWith("http://localhost:3000/file", {
        headers: {},
      });
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "session-2",
          lifecycleState: "LAUNCHING",
        })
      );
    });

    it("marks a persisted Master session launch failed when opening Excel fails", async () => {
      const cacheRoot = await makeRoot();
      const update = vi.fn();

      await expect(
        openDesktopFile(
          {
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "cash.xlsx",
            downloadUrl: "http://localhost:3000/file",
            lockSessionId: "lock-session-1",
            baseVersion: 2,
            grantSecret: "grant-secret",
          },
          {
            allowedDownloadOrigins: ["http://localhost:3000"],
            cacheRoot,
            fetchFile: vi
              .fn()
              .mockResolvedValue(new Response("cash file", { status: 200 })),
            launchFile: vi
              .fn()
              .mockRejectedValue(new Error("Excel could not start")),
            randomUUID: () => "session-1",
            sessionStore: {
              upsert: vi.fn().mockImplementation(async (session) => {
                await Promise.resolve();
                return session;
              }),
              update,
            },
          }
        )
      ).rejects.toStrictEqual(
        new DesktopAgentError("OPEN_FAILED", "Excel could not start")
      );
      expect(update).toHaveBeenCalledWith("session-1", {
        lifecycleState: "LAUNCH_FAILED",
        contentState: "UNCHANGED",
        status: "OPEN_UNCHANGED",
        launchFailedReason: "WATCHER_START_FAILED",
        lastError: "Excel could not start",
      });
    });

    it("preserves dirty content state when Excel launch fails after cache recovery", async () => {
      const cacheRoot = await makeRoot();
      const localPath = join(
        cacheRoot,
        "project-1",
        "attachment-1",
        "master",
        "lock-session-1",
        "cash.xlsx"
      );
      await mkdir(dirname(localPath), { recursive: true });
      await writeFile(localPath, "edited local cash file");
      await writeMasterCacheManifest(localPath, {
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        fileName: "cash.xlsx",
        originalHash: hashText("server cash file"),
      });
      const update = vi.fn();

      await expect(
        openDesktopFile(
          {
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "cash.xlsx",
            downloadUrl: "http://localhost:3000/file",
            lockSessionId: "lock-session-1",
            baseVersion: 2,
            grantSecret: "grant-secret",
          },
          {
            allowedDownloadOrigins: ["http://localhost:3000"],
            cacheRoot,
            fetchFile: vi
              .fn()
              .mockResolvedValue(
                new Response("server cash file", { status: 200 })
              ),
            launchFile: vi
              .fn()
              .mockRejectedValue(new Error("Excel could not start")),
            randomUUID: () => "session-1",
            sessionStore: {
              list: async () => {
                await Promise.resolve();
                return [];
              },
              upsert: vi.fn().mockImplementation(async (session) => {
                await Promise.resolve();
                return session;
              }),
              update,
            },
          }
        )
      ).rejects.toStrictEqual(
        new DesktopAgentError("OPEN_FAILED", "Excel could not start")
      );
      expect(update).toHaveBeenCalledWith("session-1", {
        lifecycleState: "LAUNCH_FAILED",
        contentState: "DIRTY",
        status: "DIRTY_PENDING_CHECKIN",
        launchFailedReason: "WATCHER_START_FAILED",
        lastError: "Excel could not start",
      });
    });

    it("keeps older local sessions deliverable after accepting a newer lock session for the same attachment", async () => {
      const cacheRoot = await makeRoot();
      const existingSession = makeStoredSession({
        attachmentId: "attachment-1",
        lockSessionId: "old-lock-session",
        status: "OPEN_UNCHANGED",
      });
      const retryingSession = makeStoredSession({
        sessionId: "retry-session",
        attachmentId: "attachment-1",
        lockSessionId: "retry-lock-session",
        status: "CHECKIN_FAILED",
        lifecycleState: "CHECKIN_FAILED",
        contentState: "DIRTY",
        closeDetectedAt: "2026-06-05T02:05:00.000Z",
      });
      const update = vi.fn().mockResolvedValue(existingSession);
      const upsert = vi.fn().mockImplementation(async (session) => {
        await Promise.resolve();
        return session;
      });
      const fetchFile = vi
        .fn()
        .mockResolvedValue(new Response("new cash file", { status: 200 }));

      await openDesktopFile(
        {
          mode: "MASTER",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          downloadUrl: "http://localhost:3000/file",
          lockSessionId: "new-lock-session",
          baseVersion: 3,
          grantSecret: "grant-secret",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          fetchFile,
          launchFile: vi.fn(),
          randomUUID: () => "session-2",
          sessionStore: {
            list: async () => {
              await Promise.resolve();
              return [existingSession, retryingSession];
            },
            update,
            upsert,
          },
        }
      );

      expect(update).toHaveBeenCalledWith(
        "session-1",
        expect.objectContaining({
          status: "LEASE_LOST",
          lifecycleState: "LEASE_LOST",
          leaseLostAt: expect.any(String),
        })
      );
      expect(update).toHaveBeenCalledWith(
        "retry-session",
        expect.objectContaining({
          leaseLostAt: expect.any(String),
          lastError: "A newer Master session was opened for this file.",
        })
      );
      const retryPatch = update.mock.calls.find(
        ([sessionId]) => sessionId === "retry-session"
      )?.[1];
      expect(retryPatch).not.toHaveProperty("status");
      expect(retryPatch).not.toHaveProperty("lifecycleState");
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "session-2",
          lockSessionId: "new-lock-session",
          status: "OPEN_UNCHANGED",
          lifecycleState: "LAUNCHING",
        })
      );
    });

    it("does not persist read-only files as tracked sessions", async () => {
      const cacheRoot = await makeRoot();
      const upsert = vi.fn();

      await openDesktopFile(
        {
          mode: "READ_ONLY",
          projectId: "project-1",
          attachmentId: "attachment-1",
          fileName: "cash.xlsx",
          downloadUrl: "http://localhost:3000/file",
        },
        {
          allowedDownloadOrigins: ["http://localhost:3000"],
          cacheRoot,
          fetchFile: vi
            .fn()
            .mockResolvedValue(new Response("read only", { status: 200 })),
          launchFile: vi.fn(),
          sessionStore: { upsert },
        }
      );

      expect(upsert).not.toHaveBeenCalled();
    });

    it("rejects download origins outside the allow list", async () => {
      const cacheRoot = await makeRoot();

      await expect(
        openDesktopFile(
          {
            mode: "READ_ONLY",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "cash.xlsx",
            downloadUrl: "http://evil.example/file",
          },
          {
            allowedDownloadOrigins: ["http://localhost:3000"],
            cacheRoot,
            fetchFile: vi.fn(),
            launchFile: vi.fn(),
          }
        )
      ).rejects.toStrictEqual(
        new DesktopAgentError(
          "ORIGIN_NOT_ALLOWED",
          "Download URL origin is not allowed: http://evil.example"
        )
      );
    });

    it("maps failed downloads to structured agent errors", async () => {
      const cacheRoot = await makeRoot();

      await expect(
        openDesktopFile(
          {
            mode: "MASTER",
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "cash.xlsx",
            downloadUrl: "http://localhost:3000/file",
          },
          {
            allowedDownloadOrigins: ["http://localhost:3000"],
            cacheRoot,
            fetchFile: vi
              .fn()
              .mockResolvedValue(new Response("no", { status: 423 })),
            launchFile: vi.fn(),
          }
        )
      ).rejects.toMatchObject({
        code: "DOWNLOAD_FAILED",
      });
    });

    it("resumes an interrupted versioned download with a range request", async () => {
      const cacheRoot = await makeRoot();
      const request = {
        mode: "MASTER" as const,
        projectId: "project-1",
        attachmentId: "attachment-1",
        fileName: "cash.xlsx",
        downloadUrl: "http://localhost:3000/file",
        authorization: "Bearer token",
        lockSessionId: "lock-session-1",
        baseVersion: 2,
        cacheVersionId: "attachment-version-2",
        cacheOwnerId: "user-1",
        fileSize: 11,
        grantSecret: "grant-secret-1",
      };
      const localPath = buildCacheFilePath({ cacheRoot, ...request });
      const partialPath = join(
        dirname(localPath),
        `.${basename(localPath)}.download.part`
      );
      await mkdir(dirname(partialPath), { recursive: true });
      await writeFile(partialPath, "version ");
      const fetchFile = vi.fn().mockResolvedValue(
        new Response("two", {
          status: 206,
          headers: { "Content-Range": "bytes 8-10/11" },
        })
      );
      const result = await openDesktopFile(request, {
        allowedDownloadOrigins: ["http://localhost:3000"],
        cacheRoot,
        fetchFile,
        launchFile: vi.fn().mockResolvedValue(),
        randomUUID: () => "session-1",
        sessionStore: {
          list: async () => {
            await Promise.resolve();
            return [];
          },
          upsert: async (session) => {
            await Promise.resolve();
            return session;
          },
        },
      });

      expect(fetchFile).toHaveBeenCalledWith("http://localhost:3000/file", {
        headers: { Authorization: "Bearer token", Range: "bytes=8-" },
      });
      await expect(readFile(result.localPath, "utf-8")).resolves.toBe(
        "version two"
      );
    });

    it("discards a partial download when a 206 response omits Content-Range", async () => {
      const cacheRoot = await makeRoot();
      const request = {
        mode: "MASTER" as const,
        projectId: "project-1",
        attachmentId: "attachment-1",
        fileName: "cash.xlsx",
        downloadUrl: "http://localhost:3000/file",
        authorization: "Bearer token",
        lockSessionId: "lock-session-1",
        baseVersion: 2,
        cacheVersionId: "attachment-version-2",
        cacheOwnerId: "user-1",
        fileSize: 11,
        grantSecret: "grant-secret-1",
      };
      const localPath = buildCacheFilePath({ cacheRoot, ...request });
      const partialPath = join(
        dirname(localPath),
        `.${basename(localPath)}.download.part`
      );
      await mkdir(dirname(partialPath), { recursive: true });
      await writeFile(partialPath, "version ");
      const fetchFile = vi
        .fn()
        .mockResolvedValueOnce(new Response("two", { status: 206 }))
        .mockResolvedValueOnce(new Response("version two", { status: 200 }));
      const result = await openDesktopFile(request, {
        allowedDownloadOrigins: ["http://localhost:3000"],
        cacheRoot,
        fetchFile,
        launchFile: vi.fn().mockResolvedValue(),
        randomUUID: () => "session-1",
        sessionStore: {
          list: async () => {
            await Promise.resolve();
            return [];
          },
          upsert: async (session) => {
            await Promise.resolve();
            return session;
          },
        },
      });

      expect(fetchFile.mock.calls[0][1]).toStrictEqual({
        headers: { Authorization: "Bearer token", Range: "bytes=8-" },
      });
      expect(fetchFile.mock.calls[1][1]).toStrictEqual({
        headers: { Authorization: "Bearer token" },
      });
      await expect(readFile(result.localPath, "utf-8")).resolves.toBe(
        "version two"
      );
    });
  });

  function makeStoredSession(
    input: Pick<
      DesktopAgentSession,
      "attachmentId" | "lockSessionId" | "status"
    > &
      Partial<DesktopAgentSession>
  ): DesktopAgentSession {
    const lifecycleState =
      input.lifecycleState ??
      (input.status === "LOCK_REVOKED" ? "LOCK_REVOKED" : "OPEN");
    return {
      sessionId: "session-1",
      mode: "MASTER",
      projectId: "project-1",
      attachmentId: input.attachmentId,
      fileName: "cash.xlsx",
      localPath: "C:\\ProjectWing\\cash.xlsx",
      lockSessionId: input.lockSessionId,
      baseVersion: 2,
      originalHash: "hash-1",
      lastKnownHash: "hash-1",
      grantSecret: "grant-secret",
      status: input.status,
      lifecycleState,
      contentState: "UNCHANGED",
      openedAt: "2026-06-05T02:00:00.000Z",
      launchStartedAt: "2026-06-05T02:00:00.000Z",
      openObservedAt:
        "openObservedAt" in input
          ? input.openObservedAt
          : input.status === "LOCK_REVOKED"
            ? undefined
            : "2026-06-05T02:01:00.000Z",
      openObservedSource:
        "openObservedSource" in input
          ? input.openObservedSource
          : input.status === "LOCK_REVOKED"
            ? undefined
            : "WATCHER_COM",
      lastSeenAt: "2026-06-05T02:00:00.000Z",
      retryCount: 0,
      ...input,
    };
  }

  function hashText(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, name);
      return;
    }
    process.env[name] = value;
  }

  async function writeMasterCacheManifest(
    localPath: string,
    input: {
      projectId: string;
      attachmentId: string;
      lockSessionId: string;
      fileName: string;
      originalHash: string;
    }
  ) {
    await writeFile(
      join(dirname(localPath), ".project-wing-cache.json"),
      JSON.stringify({
        version: 1,
        ...input,
        createdAt: "2026-06-05T02:00:00.000Z",
      })
    );
  }

  async function readMasterCacheManifest(localPath: string) {
    const raw = await readFile(
      join(dirname(localPath), ".project-wing-cache.json"),
      "utf-8"
    );
    return JSON.parse(raw) as unknown;
  }
});
