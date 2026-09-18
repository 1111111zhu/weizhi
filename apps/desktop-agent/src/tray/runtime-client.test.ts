import { describe, expect, it, vi } from "vitest";

import { DesktopAgentRuntimeClient } from "./runtime-client.js";

const health = {
  ok: true,
  app: "project-wing-desktop-runtime",
  version: "0.2.0",
  managerVersion: "0.2.0",
  agentVersion: "0.2.0",
  agentState: "READY",
  updateState: "IDLE",
  restoreState: "READY",
  attentionCount: 0,
} as const;

describe("desktop agent tray runtime client", () => {
  it("loads and validates a complete runtime snapshot", async () => {
    const fetcher = vi.fn(async (input: string) => {
      await Promise.resolve();
      const path = new URL(input).pathname;
      const bodies = {
        "/health": health,
        "/auth/status": { ok: true, authenticated: true, pairing: false },
        "/sessions": { ok: true, sessions: [] },
        "/update/status": { ok: true, status: "READY" },
      };
      return Response.json(bodies[path as keyof typeof bodies], {
        status: 200,
      });
    });
    const client = new DesktopAgentRuntimeClient({ fetcher });

    await expect(client.readSnapshot()).resolves.toStrictEqual({
      health,
      auth: { ok: true, authenticated: true, pairing: false },
      sessions: [],
      recentSessions: [],
      update: { ok: true, status: "READY" },
      errors: [],
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("reports offline without probing secondary endpoints", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    const client = new DesktopAgentRuntimeClient({ fetcher });

    await expect(client.readSnapshot()).resolves.toStrictEqual({
      health: null,
      auth: null,
      sessions: [],
      recentSessions: [],
      update: null,
      errors: ["health"],
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("keeps health while surfacing malformed secondary responses", async () => {
    const fetcher = vi.fn(async (input: string) => {
      await Promise.resolve();
      const path = new URL(input).pathname;
      return Response.json(path === "/health" ? health : { invalid: true }, {
        status: 200,
      });
    });
    const client = new DesktopAgentRuntimeClient({ fetcher });

    await expect(client.readSnapshot()).resolves.toStrictEqual({
      health,
      auth: null,
      sessions: [],
      recentSessions: [],
      update: null,
      errors: ["auth", "sessions", "update"],
    });
  });

  it("loads recent sessions from an upgraded runtime", async () => {
    const recentSession = {
      projectId: "project-1",
      attachmentId: "attachment-1",
      fileName: "audit.xlsx",
      mode: "MASTER",
      openedAt: "2026-08-03T08:00:00.000Z",
      closedAt: "2026-08-03T09:00:00.000Z",
    } as const;
    const fetcher = vi.fn(async (input: string) => {
      await Promise.resolve();
      const path = new URL(input).pathname;
      const bodies = {
        "/health": health,
        "/auth/status": { ok: true, authenticated: true, pairing: false },
        "/sessions": {
          ok: true,
          sessions: [],
          recentSessions: [recentSession],
        },
        "/update/status": { ok: true, status: "READY" },
      };
      return Response.json(bodies[path as keyof typeof bodies]);
    });

    await expect(
      new DesktopAgentRuntimeClient({ fetcher }).readSnapshot()
    ).resolves.toMatchObject({ recentSessions: [recentSession] });
  });

  it.each([
    "https://127.0.0.1:17862",
    "http://desktop-agent.example:17862",
    "http://127.0.0.1:17862/path",
    "http://user:secret@127.0.0.1:17862",
  ])("rejects non-loopback runtime URL %s", (baseUrl) => {
    expect(() => new DesktopAgentRuntimeClient({ baseUrl })).toThrow(
      "Desktop Agent runtime URL must be a loopback HTTP origin."
    );
  });

  it("posts update and session recovery actions with validated responses", async () => {
    const session = makeSession();
    const fetcher = vi.fn(async (input: string) => {
      await Promise.resolve();
      const path = new URL(input).pathname;
      return Response.json(
        path === "/update"
          ? { ok: true, status: "STARTED", taskId: "update-1" }
          : { ok: true, session }
      );
    });
    const client = new DesktopAgentRuntimeClient({ fetcher });

    await expect(client.startUpdate("0.2.0")).resolves.toMatchObject({
      status: "STARTED",
    });
    await expect(client.checkInSession(session)).resolves.toStrictEqual({
      ok: true,
      session,
    });
    await expect(client.releaseSession(session)).resolves.toStrictEqual({
      ok: true,
      session,
    });
    await expect(
      client.recoverLaunchFailedRelease(session)
    ).resolves.toStrictEqual({
      ok: true,
      session,
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:17862/sessions/session%2F1/recover-launch-failed-release",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          generation: 1,
          closeSignalToken: "close-1",
          confirmNoUserVisibleWorkbook: true,
        }),
      })
    );
  });

  it("preserves structured runtime errors for UI decisions", async () => {
    const client = new DesktopAgentRuntimeClient({
      fetcher: vi.fn(async () => {
        await Promise.resolve();
        return Response.json(
          {
            ok: false,
            code: "ACTIVE_MASTER_SESSIONS",
            message: "Close active workbooks first.",
          },
          { status: 409 }
        );
      }),
    });

    await expect(client.startUpdate()).rejects.toMatchObject({
      name: "DesktopAgentRuntimeRequestError",
      status: 409,
      code: "ACTIVE_MASTER_SESSIONS",
      message: "Close active workbooks first.",
    });
  });

  it("rejects unknown update states from the local runtime", async () => {
    const client = new DesktopAgentRuntimeClient({
      fetcher: vi.fn(async () => {
        await Promise.resolve();
        return Response.json({ ok: true, status: "UNKNOWN" });
      }),
    });

    await expect(client.startUpdate()).rejects.toThrow(
      "Desktop Agent runtime returned an invalid response."
    );
  });
});

function makeSession() {
  return {
    sessionId: "session/1",
    generation: 1,
    mode: "MASTER",
    projectId: "project-1",
    attachmentId: "attachment-1",
    fileName: "audit.xlsx",
    localPath: "/tmp/audit.xlsx",
    checkInUrl: "https://emp.superfx.cn/api/check-in",
    releaseUrl: "https://emp.superfx.cn/api/release",
    originalHash: "hash-1",
    lastKnownHash: "hash-1",
    status: "CONFLICT_RISK",
    lifecycleState: "LAUNCH_FAILED",
    contentState: "UNCHANGED",
    openedAt: "2026-07-15T08:00:00.000Z",
    launchStartedAt: "2026-07-15T08:00:00.000Z",
    lastSeenAt: "2026-07-15T08:00:00.000Z",
    closeSignalToken: "close-1",
  } as const;
}
