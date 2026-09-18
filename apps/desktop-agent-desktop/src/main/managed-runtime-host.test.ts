import { afterEach, describe, expect, it, vi } from "vitest";

import { ManagedRuntimeHost, isReadyRuntime } from "./managed-runtime-host";

const options = {
  appDataPath: "fixture",
  appVersion: "test",
  isPackaged: false,
  platform: "win32" as const,
  resourcesPath: "fixture",
};
const health = (state: string, extra = {}) => ({
  app: "project-wing-desktop-runtime",
  agentState: state,
  ...extra,
});

describe("managed runtime recovery", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not equate an HTTP response or degraded state with readiness", () => {
    expect(isReadyRuntime({ ok: true })).toBeFalsy();
    expect(isReadyRuntime(health("DEGRADED_NEEDS_ATTENTION"))).toBeFalsy();
    expect(isReadyRuntime(health("READY_WITH_ATTENTION"))).toBeTruthy();
  });

  it("allows the Manager's hung-worker probe to finish before classifying ownership", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Response.json(health("READY")))
      );
      await new ManagedRuntimeHost(options).recover();
      // Manager's native worker probe is bounded at 1,500 ms.
      expect(
        timeout.mock.calls.every(([milliseconds]) => milliseconds > 1500)
      ).toBeTruthy();
    } finally {
      timeout.mockRestore();
    }
  });

  it("refuses a foreign listener without issuing control requests", async () => {
    const fetcher = vi.fn(() =>
      Response.json({ app: "another-application", agentState: "READY" })
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(new ManagedRuntimeHost(options).recover()).rejects.toThrow(
      "unrecognized service"
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not take over another installed version", async () => {
    const fetcher = vi.fn(() =>
      Response.json(health("READY", { version: "another-version" }))
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(new ManagedRuntimeHost(options).recover()).rejects.toThrow(
      "Another Agent version"
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("fails closed on a malformed listener or a timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Response("not-json"))
    );
    await expect(new ManagedRuntimeHost(options).recover()).rejects.toThrow(
      "unrecognized service"
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new DOMException("timeout", "TimeoutError");
      })
    );
    await expect(new ManagedRuntimeHost(options).recover()).rejects.toThrow(
      "unrecognized service"
    );
  });

  it("coalesces recovery and targets the current Manager instance", async () => {
    let recovered = false;
    const fetcher = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        recovered = true;
        return Response.json({ ok: true }, { status: 202 });
      }
      return Response.json(
        health(recovered ? "READY" : "DEGRADED_NEEDS_ATTENTION", {
          recoverySupported: true,
          managerInstanceId: "generation-1",
        })
      );
    });
    vi.stubGlobal("fetch", fetcher);
    const host = new ManagedRuntimeHost(options);
    await Promise.all([host.recover(), host.recover()]);
    const posts = fetcher.mock.calls.filter(
      ([, init]) => init?.method === "POST"
    );
    expect(posts).toHaveLength(1);
    expect(posts[0][1]?.body).toBe(
      JSON.stringify({ managerInstanceId: "generation-1" })
    );
  });

  it("does not recover over an update or silently take over an old Manager", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Response.json(health("UPDATING")))
    );
    await expect(new ManagedRuntimeHost(options).recover()).rejects.toThrow(
      "update is in progress"
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Response.json(health("DEGRADED_NEEDS_ATTENTION")))
    );
    await expect(new ManagedRuntimeHost(options).recover()).rejects.toThrow(
      "cannot safely recover"
    );
  });

  it("does not accept a replacement version as successful recovery", async () => {
    let recovered = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          recovered = true;
          return Response.json({ ok: true }, { status: 202 });
        }
        return Response.json(
          health(recovered ? "READY" : "RECOVERING", {
            version: recovered ? "different-version" : "test",
            managerInstanceId: "generation-1",
            recoverySupported: true,
          })
        );
      })
    );
    await expect(new ManagedRuntimeHost(options).recover()).rejects.toThrow(
      "Another Agent version"
    );
  });

  it("never sends shutdown to a listener that replaced its owned child", async () => {
    const fetcher = vi.fn(() =>
      Response.json(
        health("READY", {
          managerPid: 22,
          managerInstanceId: "replacement",
        })
      )
    );
    vi.stubGlobal("fetch", fetcher);
    const child = { pid: 11, exitCode: null, kill: vi.fn() };
    const host = new ManagedRuntimeHost(options);
    Object.assign(host, { manager: child });
    await expect(host.stop()).rejects.toThrow("has not confirmed shutdown");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(child.kill).toHaveBeenCalledOnce();
  });
});
