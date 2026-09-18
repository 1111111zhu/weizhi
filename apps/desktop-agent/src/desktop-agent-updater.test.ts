import type { DesktopAgentSession } from "@project-wing/shared/desktop";
import { describe, expect, it, vi } from "vitest";

import { createDesktopAgentUpdater } from "./desktop-agent-updater.js";

const updateRequest = () => ({
  expectedVersion: "0.1.19",
  expectedSha256: "a".repeat(64),
  expectedFileSize: 123_456,
  signaturePolicy: "required" as const,
});

describe("desktop agent updater", () => {
  it("returns the existing update task when start is called twice concurrently", async () => {
    const startManagerUpdate = vi.fn().mockResolvedValue(true);
    const updater = createDesktopAgentUpdater({
      apiBaseUrl: "http://localhost:3000",
      downloadUrl:
        "http://localhost:3000/downloads/desktop-agent/windows/latest",
      sessionStore: {
        refresh: vi.fn().mockResolvedValue([]),
      },
      startManagerUpdate,
      randomUUID: () => "update-task-1",
    });
    const first = await updater.startUpdate(updateRequest());
    const second = await updater.startUpdate(updateRequest());
    await vi.waitFor(() => {
      expect(startManagerUpdate).toHaveBeenCalledOnce();
    });
    expect(first).toStrictEqual({
      ok: true,
      status: "STARTED",
      taskId: "update-task-1",
      expectedVersion: "0.1.19",
      downloadUrl:
        "http://localhost:3000/downloads/desktop-agent/windows/latest",
    });
    expect(second).toStrictEqual({
      ok: true,
      status: "IN_PROGRESS",
      taskId: "update-task-1",
      expectedVersion: "0.1.19",
      downloadUrl:
        "http://localhost:3000/downloads/desktop-agent/windows/latest",
      message: "Desktop Agent update is already running.",
    });
  });

  it("releases safe Master sessions serially before starting the installer", async () => {
    const calls: string[] = [];
    const releaseDesktopSession = vi.fn(async (request) => {
      await Promise.resolve();
      calls.push(`release:${request.sessionId}`);
      return {
        ok: true,
        session: makeSession({
          sessionId: request.sessionId,
          lifecycleState: "CLOSED",
          status: "CLOSED",
        }),
      };
    });
    const startManagerUpdate = vi.fn(async () => {
      await Promise.resolve();
      calls.push("manager");
      return true;
    });
    const updater = createDesktopAgentUpdater({
      apiBaseUrl: "http://localhost:3000",
      downloadUrl:
        "http://localhost:3000/downloads/desktop-agent/windows/latest",
      sessionStore: {
        refresh: vi.fn().mockResolvedValue([
          makeSession({
            sessionId: "session-1",
            lockSessionId: "lock-session-1",
            lifecycleState: "RELEASE_PENDING",
            status: "RELEASE_PENDING",
            pendingReleaseReason: "UNCHANGED_RELEASE",
            pendingReleaseHash: "hash-1",
          }),
          makeSession({
            sessionId: "session-2",
            lockSessionId: "lock-session-2",
            lifecycleState: "RELEASE_FAILED",
            status: "RELEASE_FAILED",
            pendingReleaseReason: "UNCHANGED_RELEASE",
            pendingReleaseHash: "hash-1",
          }),
        ]),
      },
      releaseDesktopSession,
      startManagerUpdate,
      randomUUID: () => "update-task-1",
    });

    await updater.startUpdate(updateRequest());
    await vi.waitFor(() => {
      expect(startManagerUpdate).toHaveBeenCalledOnce();
    });

    expect(calls).toStrictEqual([
      "release:session-1",
      "release:session-2",
      "manager",
    ]);
    expect(releaseDesktopSession).toHaveBeenNthCalledWith(1, {
      sessionId: "session-1",
      releaseUrl:
        "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
    });
    expect(releaseDesktopSession).toHaveBeenNthCalledWith(2, {
      sessionId: "session-2",
      releaseUrl:
        "http://localhost:3000/desktop/master-sessions/lock-session-2/release",
    });
  });

  it("passes the release manifest to the trusted manager", async () => {
    const updater = createDesktopAgentUpdater({
      apiBaseUrl: "http://localhost:3000",
      downloadUrl:
        "http://localhost:3000/downloads/desktop-agent/windows/latest",
      sessionStore: {
        refresh: vi.fn().mockResolvedValue([]),
      },
      startManagerUpdate: vi.fn().mockResolvedValue(true),
      randomUUID: () => "update-task-1",
    });

    await updater.startUpdate(updateRequest());

    await vi.waitFor(() => {
      expect(updater.getCurrentUpdate()?.status).toBe("IN_PROGRESS");
    });
  });

  it("delegates full download update to the trusted manager when available", async () => {
    const startManagerUpdate = vi.fn().mockResolvedValue(true);
    const updater = createDesktopAgentUpdater({
      apiBaseUrl: "http://localhost:3000",
      downloadUrl:
        "http://localhost:3000/downloads/desktop-agent/windows/latest",
      sessionStore: {
        refresh: vi.fn().mockResolvedValue([]),
      },
      startManagerUpdate,
      randomUUID: () => "update-task-1",
    });

    await updater.startUpdate(updateRequest());

    await vi.waitFor(() => {
      expect(startManagerUpdate).toHaveBeenCalledWith({
        downloadUrl:
          "http://localhost:3000/downloads/desktop-agent/windows/latest",
        expectedVersion: "0.1.19",
        expectedSha256: "a".repeat(64),
        expectedFileSize: 123_456,
        signaturePolicy: "required",
      });
    });
    expect(updater.getCurrentUpdate()).toStrictEqual(
      expect.objectContaining({
        status: "IN_PROGRESS",
        message: "Desktop Agent manager is updating.",
      })
    );
  });

  it("requires the trusted manager instead of executing an installer directly", async () => {
    const updater = createDesktopAgentUpdater({
      apiBaseUrl: "http://localhost:3000",
      downloadUrl:
        "http://localhost:3000/downloads/desktop-agent/windows/latest",
      sessionStore: {
        refresh: vi.fn().mockResolvedValue([]),
      },
      startManagerUpdate: vi.fn().mockResolvedValue(false),
      randomUUID: () => "update-task-1",
    });

    await updater.startUpdate(updateRequest());

    await vi.waitFor(() => {
      expect(updater.getCurrentUpdate()).toStrictEqual(
        expect.objectContaining({
          status: "FAILED",
          message:
            "Desktop Agent Manager is unavailable. Download and run the repair installer.",
        })
      );
    });
  });

  it("prefers durable update status when available", async () => {
    const updater = createDesktopAgentUpdater({
      apiBaseUrl: "http://localhost:3000",
      downloadUrl:
        "http://localhost:3000/downloads/desktop-agent/windows/latest",
      sessionStore: {
        refresh: vi.fn().mockResolvedValue([]),
      },
      readUpdateStatus: vi.fn().mockResolvedValue({
        ok: true,
        status: "VERIFYING_HEALTH",
        taskId: "update-task-1",
        expectedVersion: "0.1.19",
      }),
      randomUUID: () => "update-task-1",
    });

    await expect(updater.getCurrentUpdateStatus()).resolves.toStrictEqual({
      ok: true,
      status: "VERIFYING_HEALTH",
      taskId: "update-task-1",
      expectedVersion: "0.1.19",
    });
  });

  it("waits for an observed workbook to close before starting the installer", async () => {
    const session = makeSession({
      lifecycleState: "OPEN",
      openObservedAt: "2026-06-05T02:05:00.000Z",
    });
    let allowWorkbookCloseCheck = () => {};
    const workbookCloseCheck = new Promise<void>((resolve) => {
      allowWorkbookCloseCheck = resolve;
    });
    const isLocalFileBusy = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockImplementationOnce(async () => {
        await workbookCloseCheck;
        return false;
      });
    const updateIf = vi.fn().mockResolvedValue({
      ...session,
      lifecycleState: "CLOSE_DETECTED",
      closeDetectedAt: "2026-06-05T02:10:00.000Z",
    });
    const checkInDesktopSession = vi.fn().mockResolvedValue({
      ok: true,
      session: {
        ...session,
        lifecycleState: "CLOSED",
        status: "CLOSED",
      },
    });
    const startManagerUpdate = vi.fn().mockResolvedValue(true);
    const updater = createDesktopAgentUpdater({
      apiBaseUrl: "http://localhost:3000",
      downloadUrl:
        "http://localhost:3000/downloads/desktop-agent/windows/latest",
      sessionStore: {
        refresh: vi
          .fn()
          .mockResolvedValueOnce([session])
          .mockResolvedValueOnce([session])
          .mockResolvedValue([]),
        updateIf,
      },
      checkInDesktopSession,
      isLocalFileBusy,
      pollIntervalMs: 1,
      now: () => new Date("2026-06-05T02:10:00.000Z"),
      startManagerUpdate,
      randomUUID: () => "update-task-1",
    });

    await updater.startUpdate(updateRequest());
    await vi.waitFor(() => {
      expect(updater.getCurrentUpdate()).toStrictEqual(
        expect.objectContaining({
          status: "WAITING_FOR_WORKBOOK_CLOSE",
          message: "Close cash.xlsx to continue the Desktop Agent update.",
        })
      );
    });
    allowWorkbookCloseCheck();
    await vi.waitFor(() => {
      expect(startManagerUpdate).toHaveBeenCalledOnce();
    });

    expect(checkInDesktopSession).toHaveBeenCalledWith({
      sessionId: "session-1",
      checkInUrl:
        "http://localhost:3000/desktop/master-sessions/lock-session-1/check-in",
      releaseUrl:
        "http://localhost:3000/desktop/master-sessions/lock-session-1/release",
    });
  }, 15_000);
});

function makeSession(
  overrides: Partial<DesktopAgentSession> = {}
): DesktopAgentSession {
  return {
    sessionId: "session-1",
    generation: 1,
    lockSessionId: "lock-session-1",
    mode: "MASTER",
    projectId: "project-1",
    attachmentId: "attachment-1",
    fileName: "cash.xlsx",
    localPath: "C:\\ProjectWing\\cash.xlsx",
    baseVersion: 2,
    originalHash: "hash-1",
    lastKnownHash: "hash-1",
    grantSecret: "grant-secret",
    openSignalToken: "open-token-1",
    closeSignalToken: "close-token-1",
    status: "OPEN_UNCHANGED",
    lifecycleState: "OPEN",
    contentState: "UNCHANGED",
    openedAt: "2026-06-05T02:00:00.000Z",
    launchStartedAt: "2026-06-05T02:00:00.000Z",
    openObservedAt: "2026-06-05T02:05:00.000Z",
    openObservedSource: "WATCHER_COM",
    lastSeenAt: "2026-06-05T02:05:00.000Z",
    retryCount: 0,
    ...overrides,
  };
}
