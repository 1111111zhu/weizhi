import { afterEach, describe, expect, it, vi } from "vitest";

import { DesktopAgentRuntimeClient } from "./runtime-client";

// Regression cases from the adversarial audit. No live service is used.
describe("adversarial state recovery regressions", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("routes ordinary release through upload-before-release even for older runtimes", async () => {
    const requests: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "POST") {
          requests.push({ url, body: JSON.parse(String(init.body)) });
          return Response.json({ ok: true });
        }
        if (url.endsWith("/health")) {
          return Response.json({
            agentState: "READY_WITH_ATTENTION",
            attentionCount: 1,
          });
        }
        if (url.endsWith("/auth/status")) {
          return Response.json({
            authenticated: true,
            user: { id: "u", name: "Auditor", email: "audit@example.test" },
          });
        }
        return Response.json({
          sessions: [
            {
              sessionId: "s",
              fileName: "unuploaded.xlsx",
              projectId: "p",
              status: "DIRTY_PENDING_CHECKIN",
              checkInUrl: "https://example.test/check-in",
              releaseUrl: "https://example.test/release",
            },
          ],
        });
      })
    );

    await new DesktopAgentRuntimeClient().release("s");

    expect(requests).toStrictEqual([
      {
        url: "http://127.0.0.1:17862/sessions/s/check-in",
        body: {
          sessionId: "s",
          releaseUrl: "https://example.test/release",
          checkInUrl: "https://example.test/check-in",
        },
      },
    ]);
  });

  it("preserves last-known work after state quarantine with a recovery warning", async () => {
    let quarantined = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/health")) {
          return Response.json({
            agentState: quarantined ? "READY_WITH_ATTENTION" : "READY",
            restoreState: quarantined ? "READY_WITH_ATTENTION" : "READY",
            quarantineCount: quarantined ? 1 : 0,
            attentionCount: quarantined ? 1 : 0,
          });
        }
        if (url.endsWith("/auth/status")) {
          return Response.json({
            authenticated: true,
            user: { id: "u", name: "Auditor", email: "audit@example.test" },
          });
        }
        return Response.json({
          sessions: quarantined
            ? []
            : [
                {
                  sessionId: "s",
                  fileName: "unuploaded.xlsx",
                  projectId: "p",
                  status: "DIRTY_PENDING_CHECKIN",
                  checkInUrl: "https://example.test/check-in",
                  releaseUrl: "https://example.test/release",
                },
              ],
        });
      })
    );
    const client = new DesktopAgentRuntimeClient();
    const before = await client.snapshot();
    expect(before.sessions).toHaveLength(1);
    quarantined = true;

    const recovered = await client.snapshot();
    expect(recovered).toMatchObject({
      state: "ATTENTION",
      stale: true,
      recoveryRequired: true,
      error: null,
    });
    expect(
      recovered.sessions.map((session) => session.sessionId)
    ).toStrictEqual(["s"]);
  });
});
