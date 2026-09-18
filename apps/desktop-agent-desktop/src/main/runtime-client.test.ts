import { afterEach, describe, expect, it, vi } from "vitest";

import { DesktopAgentRuntimeClient } from "./runtime-client";

const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("runtime client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("retains explicitly stale files after partial failure and refuses mutation", async () => {
    let failSessions = false;
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      await Promise.resolve();
      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({
          agentState: failSessions ? "DEGRADED_NEEDS_ATTENTION" : "READY",
          version: "test",
        });
      }
      if (url.endsWith("/auth/status")) {
        return jsonResponse({
          authenticated: true,
          user: { id: "u1", name: "A", email: "a@example.com" },
        });
      }
      if (failSessions) {
        throw new Error("worker unavailable");
      }
      return jsonResponse({
        sessions: [
          {
            sessionId: "s1",
            fileName: "unsynced.xlsx",
            projectId: "p1",
            status: "DIRTY_PENDING_CHECKIN",
            checkInUrl: "https://example.com/check-in",
            releaseUrl: "https://example.com/release",
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetcher);
    const client = new DesktopAgentRuntimeClient();
    const before = await client.snapshot();
    failSessions = true;
    const after = await client.snapshot();
    expect(after).toMatchObject({
      state: "ATTENTION",
      stale: true,
      observedAt: before.observedAt,
      sessions: before.sessions,
    });
    await expect(client.release("s1")).rejects.toThrow(
      "Current session state is unavailable"
    );
    expect(
      fetcher.mock.calls.every(
        ([url]) => !String(url).includes("/sessions/s1/")
      )
    ).toBeTruthy();
  });

  it.each([
    "STARTING",
    "RECOVERING",
    "UPDATING",
    "DEGRADED_NEEDS_ATTENTION",
    "UNRECOGNIZED",
    "",
  ])(
    "does not report %s as ready even when every endpoint responds",
    async (agentState) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL | Request) => {
          await Promise.resolve();
          return String(input).endsWith("/health")
            ? jsonResponse({ agentState })
            : String(input).endsWith("/auth/status")
              ? jsonResponse({ authenticated: true })
              : jsonResponse({ sessions: [] });
        })
      );
      const snapshot = await new DesktopAgentRuntimeClient().snapshot();
      expect(snapshot.state).not.toBe("READY");
    }
  );

  it("coalesces overlapping snapshot polls into one set of requests", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      await Promise.resolve();
      return String(input).endsWith("/health")
        ? jsonResponse({ agentState: "READY" })
        : jsonResponse({ authenticated: false, sessions: [] });
    });
    vi.stubGlobal("fetch", fetcher);
    const client = new DesktopAgentRuntimeClient();
    await Promise.all([
      client.snapshot(),
      client.snapshot(),
      client.snapshot(),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("includes the authenticated web account in a tray snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return Promise.resolve(
            jsonResponse({
              version: "0.3.0",
              agentState: "READY",
              attentionCount: 0,
            })
          );
        }
        if (url.endsWith("/auth/status")) {
          return Promise.resolve(
            jsonResponse({
              authenticated: true,
              pairing: false,
              user: {
                id: "user-1",
                email: "auditor@example.com",
                name: "Auditor One",
                globalRole: "MANAGER",
              },
            })
          );
        }
        return Promise.resolve(jsonResponse({ sessions: [] }));
      })
    );

    await expect(
      new DesktopAgentRuntimeClient().snapshot()
    ).resolves.toMatchObject({
      state: "READY",
      user: {
        email: "auditor@example.com",
        name: "Auditor One",
        globalRole: "MANAGER",
      },
    });
  });

  it("exposes five recent files and excludes an active attachment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/health"))
          return Promise.resolve(
            jsonResponse({ agentState: "READY", attentionCount: 0 })
          );
        if (url.endsWith("/auth/status"))
          return Promise.resolve(
            jsonResponse({
              authenticated: true,
              user: { id: "u1", name: "A", email: "a@example.com" },
            })
          );
        return Promise.resolve(
          jsonResponse({
            sessions: [
              {
                sessionId: "active",
                projectId: "p1",
                attachmentId: "a1",
                fileName: "active.xlsx",
                status: "OPEN",
              },
            ],
            recentSessions: [
              {
                projectId: "p1",
                attachmentId: "a1",
                fileName: "active.xlsx",
                mode: "MASTER",
                openedAt: "2026-09-08T01:00:00.000Z",
                closedAt: "2026-09-08T02:00:00.000Z",
              },
              ...Array.from({ length: 6 }, (_, index) => ({
                projectId: `p${index + 2}`,
                attachmentId: `a${index + 2}`,
                fileName: `recent-${index + 1}.xlsx`,
                mode: "READ_ONLY",
                openedAt: "2026-09-08T01:00:00.000Z",
                closedAt: "2026-09-08T02:00:00.000Z",
              })),
            ],
          })
        );
      })
    );

    const client = new DesktopAgentRuntimeClient();
    const snapshot = await client.snapshot();
    expect(snapshot.recentFiles?.map((file) => file.fileName)).toStrictEqual([
      "recent-1.xlsx",
      "recent-2.xlsx",
      "recent-3.xlsx",
      "recent-4.xlsx",
      "recent-5.xlsx",
    ]);
    await expect(client.recentProjectUrl("p2")).resolves.toBe(
      "https://emp.superfx.cn/zh-CN/engagement/p2"
    );
    await expect(client.recentProjectUrl("unknown-project")).rejects.toThrow(
      "no longer available"
    );
  });

  it("does not label a standard Better Auth user as Guest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return Promise.resolve(
            jsonResponse({ agentState: "READY", attentionCount: 0 })
          );
        }
        if (url.endsWith("/auth/status")) {
          return Promise.resolve(
            jsonResponse({
              authenticated: true,
              pairing: false,
              user: {
                id: "user-1",
                email: "auditor@example.com",
                name: "Auditor One",
              },
            })
          );
        }
        return Promise.resolve(jsonResponse({ sessions: [] }));
      })
    );

    await expect(
      new DesktopAgentRuntimeClient().snapshot()
    ).resolves.toMatchObject({
      user: { name: "Auditor One", globalRole: "USER" },
    });
  });

  it("signs out locally and refreshes the unauthenticated tray state", async () => {
    const fetcher = vi.fn((input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/auth/sign-out")) {
        return Promise.resolve(
          jsonResponse({ ok: true, authenticated: false, pairing: false })
        );
      }
      if (url.endsWith("/health")) {
        return Promise.resolve(
          jsonResponse({
            version: "0.3.0",
            agentState: "READY",
            attentionCount: 0,
          })
        );
      }
      if (url.endsWith("/auth/status")) {
        return Promise.resolve(
          jsonResponse({ authenticated: false, pairing: false })
        );
      }
      return Promise.resolve(jsonResponse({ sessions: [] }));
    });
    vi.stubGlobal("fetch", fetcher);

    await expect(
      new DesktopAgentRuntimeClient().signOut()
    ).resolves.toMatchObject({
      state: "PAIR_REQUIRED",
      user: null,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:17862/auth/sign-out",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("preserves a safe runtime error instead of replacing it with an HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            {
              ok: false,
              code: "LOCK_REVOKED",
              message: "This file is no longer assigned to this device.",
            },
            409
          )
        )
      )
    );

    await expect(new DesktopAgentRuntimeClient().signOut()).rejects.toThrow(
      "This file is no longer assigned to this device."
    );
  });
});
