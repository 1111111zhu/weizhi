import { afterEach, describe, expect, it, vi } from "vitest";

import { DesktopAgentRuntimeClient } from "./runtime-client";

function record(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "master",
    fileName: "work.xlsx",
    projectId: "project",
    mode: "MASTER",
    status: "DIRTY_PENDING_CHECKIN",
    lifecycleState: "CLOSE_DETECTED",
    checkInUrl: "https://example.test/check-in",
    releaseUrl: "https://example.test/release",
    ...overrides,
  };
}
function service(rows: Record<string, unknown>[]) {
  const fetcher = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    if (init?.method === "POST") {
      return Promise.resolve(Response.json({ ok: true }));
    }
    const url = String(input);
    return Promise.resolve(
      Response.json(
        url.endsWith("/health")
          ? {
              ok: true,
              app: "project-wing-desktop-runtime",
              agentState: "READY_WITH_ATTENTION",
              version: "test",
              attentionCount: 6,
            }
          : url.endsWith("/auth/status")
            ? {
                ok: true,
                authenticated: true,
                user: {
                  id: "user",
                  name: "Auditor",
                  email: "auditor@example.test",
                },
              }
            : { ok: true, sessions: rows }
      )
    );
  });
  vi.stubGlobal("fetch", fetcher);
  return { client: new DesktopAgentRuntimeClient(), fetcher };
}
describe("session display and mutation capabilities", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("resolves missing read-only records without calling upload or release", async () => {
    const { client, fetcher } = service([
      record({
        mode: "READ_ONLY",
        status: "LOCAL_FILE_MISSING",
        lifecycleState: "LOCAL_FILE_MISSING",
        checkInUrl: undefined,
        releaseUrl: undefined,
      }),
    ]);
    await client.endTracking("master");
    const posts = fetcher.mock.calls.filter(
      ([, init]) => init?.method === "POST"
    );
    expect(posts).toHaveLength(1);
    expect(posts[0][0]).toBe(
      "http://127.0.0.1:17862/sessions/master/end-tracking"
    );
    expect(JSON.parse(posts[0][1]!.body as string)).toEqual({
      confirmed: true,
    });
  });

  it("revalidates a reopened session before ending tracking", async () => {
    const { client, fetcher } = service([record({ lifecycleState: "OPEN" })]);
    await expect(client.endTracking("master")).rejects.toThrow(
      "session changed"
    );
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false
    );
  });

  it("displays all six mixed records without misreporting a disconnected service", async () => {
    const rows = [
      ...[1, 2, 3].map((id) =>
        record({
          sessionId: `missing-${id}`,
          status: "LOCAL_FILE_MISSING",
          lifecycleState: "LOCAL_FILE_MISSING",
        })
      ),
      record({
        sessionId: "readonly",
        mode: "READ_ONLY",
        checkInUrl: undefined,
        releaseUrl: undefined,
        status: "LOCAL_FILE_MISSING",
        lifecycleState: "LOCAL_FILE_MISSING",
      }),
      ...[1, 2].map((id) =>
        record({
          sessionId: `lease-${id}`,
          status: "LEASE_LOST",
          lifecycleState: "LEASE_LOST",
        })
      ),
    ];
    const { client } = service(rows);
    const snapshot = await client.snapshot();
    expect(snapshot).toMatchObject({
      state: "ATTENTION",
      stale: false,
      error: null,
    });
    expect(snapshot.sessions.map((s) => s.sessionId)).toStrictEqual(
      rows.map((s) => s.sessionId)
    );
    expect(snapshot.sessions.every((s) => s.canCheckIn === false)).toBeTruthy();
    expect(snapshot.sessions[3]).toMatchObject({
      mode: "READ_ONLY",
      status: "LOCAL_FILE_MISSING",
    });
    expect(snapshot.sessions[0]).not.toHaveProperty("checkInUrl");
    expect(snapshot.sessions[0]).not.toHaveProperty("releaseUrl");
  });

  it.each(["checkIn", "release"] as const)(
    "refuses %s for read-only records, even if URLs or a forged capability are supplied",
    async (action) => {
      const { client, fetcher } = service([
        record({ mode: "READ_ONLY", canCheckIn: true }),
      ]);
      await expect(client[action]("master")).rejects.toThrow(
        "not currently safe"
      );
      expect(
        fetcher.mock.calls.every(([, init]) => init?.method !== "POST")
      ).toBeTruthy();
    }
  );

  it("keeps a partial master visible without preventing another valid master from syncing", async () => {
    const { client, fetcher } = service([
      record({ sessionId: "partial", releaseUrl: undefined }),
      record(),
    ]);
    const snapshot = await client.snapshot();
    expect(snapshot.sessions).toHaveLength(2);
    expect(snapshot.stale).toBeFalsy();
    expect(snapshot.sessions[0].canCheckIn).toBeFalsy();
    await expect(client.checkIn("partial")).rejects.toThrow(
      "not currently safe"
    );
    await client.release("master");
    const posts = fetcher.mock.calls.filter(
      ([, init]) => init?.method === "POST"
    );
    expect(posts).toHaveLength(1);
    expect(posts[0][0]).toBe("http://127.0.0.1:17862/sessions/master/check-in");
  });

  it.each([
    "OPEN",
    "OPEN_NOT_OBSERVED",
    "LAUNCHING",
    "LOCAL_FILE_MISSING",
    "LEASE_LOST",
    "LOCK_REVOKED",
    "CHECKING_IN",
    "UNRECOGNIZED",
  ])("blocks mutation in %s state", async (status) => {
    const { client, fetcher } = service([
      record({ status, lifecycleState: status }),
    ]);
    await expect(client.checkIn("master")).rejects.toThrow(
      "not currently safe"
    );
    expect(
      fetcher.mock.calls.every(([, init]) => init?.method !== "POST")
    ).toBeTruthy();
  });

  it("revalidates mode when an old writable UI selection becomes read-only", async () => {
    const rows = [record()];
    const { client, fetcher } = service(rows);
    const before = await client.snapshot();
    expect(before.sessions[0].canCheckIn).toBeTruthy();
    rows[0] = record({ mode: "READ_ONLY" });
    await expect(client.checkIn("master")).rejects.toThrow(
      "not currently safe"
    );
    expect(
      fetcher.mock.calls.every(([, init]) => init?.method !== "POST")
    ).toBeTruthy();
  });

  it("does not treat an unknown explicit mode as writable", async () => {
    const { client } = service([record({ mode: "UNRECOGNIZED" })]);
    const snapshot = await client.snapshot();
    expect(snapshot.sessions[0]).toMatchObject({
      mode: "UNKNOWN",
      canCheckIn: false,
    });
  });

  it("retains the fail-closed snapshot boundary for truly malformed metadata", async () => {
    const rows: Record<string, unknown>[] = [record()];
    const { client } = service(rows);
    const before = await client.snapshot();
    rows.push({ mode: "READ_ONLY" });
    await expect(client.snapshot()).resolves.toMatchObject({
      stale: true,
      sessions: before.sessions,
    });
    await expect(client.checkIn("master")).rejects.toThrow(
      "Current session state is unavailable"
    );
  });
});
