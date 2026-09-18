import { describe, expect, it, vi } from "vitest";

import type {
  DesktopAgentRuntimeClient,
  DesktopAgentRuntimeSnapshot,
} from "./runtime-client.js";
import { DesktopAgentTrayController } from "./tray-controller.js";

describe("desktop agent tray controller", () => {
  it("publishes a refreshed view model and timestamp", async () => {
    const client = makeClient(readySnapshot());
    const controller = new DesktopAgentTrayController({
      client,
      now: () => 42,
    });
    const listener = vi.fn();
    controller.subscribe(listener);

    await controller.refresh();

    expect(controller.getSnapshot()).toMatchObject({
      refreshing: false,
      lastUpdatedAt: 42,
      viewModel: { state: "READY", version: "0.2.0" },
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("deduplicates overlapping refreshes", async () => {
    let resolveSnapshot!: (snapshot: DesktopAgentRuntimeSnapshot) => void;
    const readSnapshot = vi.fn(
      () =>
        new Promise<DesktopAgentRuntimeSnapshot>((resolve) => {
          resolveSnapshot = resolve;
        })
    );
    const controller = new DesktopAgentTrayController({
      client: makeClient(undefined, { readSnapshot }),
    });
    const first = controller.refresh();
    const second = controller.refresh();
    resolveSnapshot(readySnapshot());
    await Promise.all([first, second]);

    expect(readSnapshot).toHaveBeenCalledOnce();
  });

  it("runs session actions from the latest snapshot and refreshes afterward", async () => {
    const snapshot = readySnapshot({ sessions: [makeSession()] });
    const client = makeClient(snapshot);
    const controller = new DesktopAgentTrayController({ client });
    await controller.refresh();

    await controller.releaseSession("session-1");

    expect(client.releaseSession).toHaveBeenCalledWith(snapshot.sessions[0]);
    expect(client.readSnapshot).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().action).toBeNull();
  });

  it("surfaces action errors without discarding the last snapshot", async () => {
    const client = makeClient(readySnapshot(), {
      startUpdate: vi.fn().mockRejectedValue(new Error("update unavailable")),
    });
    const controller = new DesktopAgentTrayController({ client });
    await controller.refresh();

    await expect(controller.startUpdate()).rejects.toThrow(
      "update unavailable"
    );

    expect(controller.getSnapshot()).toMatchObject({
      action: null,
      actionError: "update unavailable",
      viewModel: { state: "READY" },
    });
  });
});

function makeClient(snapshot?: DesktopAgentRuntimeSnapshot, patch = {}) {
  return {
    readSnapshot: vi.fn().mockResolvedValue(snapshot),
    startUpdate: vi.fn().mockResolvedValue({ ok: true, status: "STARTED" }),
    checkInSession: vi.fn(),
    releaseSession: vi.fn().mockResolvedValue({ ok: true }),
    recoverLaunchFailedRelease: vi.fn(),
    ...patch,
  } as unknown as DesktopAgentRuntimeClient;
}

function readySnapshot(patch: Partial<DesktopAgentRuntimeSnapshot> = {}) {
  return {
    health: {
      ok: true,
      app: "project-wing-desktop-runtime",
      version: "0.2.0",
      managerVersion: "0.2.0",
      agentVersion: "0.2.0",
      agentState: "READY",
      updateState: "READY",
      restoreState: "READY",
      attentionCount: 0,
    },
    auth: { ok: true, authenticated: true, pairing: false },
    sessions: [],
    recentSessions: [],
    update: { ok: true, status: "READY" },
    errors: [],
    ...patch,
  } satisfies DesktopAgentRuntimeSnapshot;
}

function makeSession() {
  return {
    sessionId: "session-1",
    generation: 1,
    mode: "MASTER",
    projectId: "project-1",
    attachmentId: "attachment-1",
    fileName: "audit.xlsx",
    localPath: "/tmp/audit.xlsx",
    originalHash: "hash-1",
    lastKnownHash: "hash-1",
    status: "RELEASE_FAILED",
    lifecycleState: "RELEASE_FAILED",
    contentState: "UNCHANGED",
    openedAt: "2026-07-15T08:00:00.000Z",
    launchStartedAt: "2026-07-15T08:00:00.000Z",
    lastSeenAt: "2026-07-15T08:00:00.000Z",
    releaseUrl: "https://emp.superfx.cn/api/release",
  } as const;
}
