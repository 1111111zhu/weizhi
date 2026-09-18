import { afterEach, describe, expect, it, vi } from "vitest";

import type { DesktopAgentStatus } from "../api/desktop-agent";
import {
  isDesktopAgentServiceReady,
  DesktopAgentRecoveryError,
  waitForDesktopAgentRecovery,
} from "./desktop-agent-recovery";

function status(agentState: string): DesktopAgentStatus {
  return {
    isInstalled: true,
    isSupported: true,
    supportsSelfUpdate: true,
    health: {
      ok: true,
      app: "project-wing-desktop-runtime",
      version: "0.3.0",
      agentState,
      attentionCount: agentState === "READY_WITH_ATTENTION" ? 1 : 0,
    },
  } as DesktopAgentStatus;
}

describe("browser recovery confirmation", () => {
  afterEach(() => vi.useRealTimers());

  it("preserves the supported legacy health contract without accepting unsupported versions", () => {
    const legacy: DesktopAgentStatus = {
      isInstalled: true,
      isSupported: true,
      supportsSelfUpdate: true,
      health: { ok: true, app: "project-wing-desktop-agent", version: "0.2.0" },
    };
    expect(isDesktopAgentServiceReady(legacy)).toBeTruthy();
    expect(
      isDesktopAgentServiceReady({ ...legacy, isSupported: false })
    ).toBeFalsy();
  });

  it.each([
    "STARTING",
    "RECOVERING",
    "UPDATING",
    "DEGRADED_NEEDS_ATTENTION",
    "UNKNOWN",
  ])("does not report %s as ready", (state) => {
    expect(isDesktopAgentServiceReady(status(state))).toBeFalsy();
  });

  it("accepts readiness only after recovery completes", async () => {
    vi.useFakeTimers();
    const read = vi
      .fn()
      .mockResolvedValueOnce(status("RECOVERING"))
      .mockResolvedValue(status("READY_WITH_ATTENTION"));
    const result = waitForDesktopAgentRecovery(
      new AbortController().signal,
      read
    );
    await vi.advanceTimersByTimeAsync(750);
    await expect(result).resolves.toBe("attention");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("bounds failure and never equates activation with success", async () => {
    vi.useFakeTimers();
    const result = waitForDesktopAgentRecovery(
      new AbortController().signal,
      vi.fn().mockResolvedValue(status("DEGRADED_NEEDS_ATTENTION")),
      1000
    );
    await Promise.all([
      expect(result).rejects.toThrow("NOT_CONFIRMED"),
      vi.advanceTimersByTimeAsync(1500),
    ]);
  });

  it("ignores a late ready response after the view was closed", async () => {
    const controller = new AbortController();
    const read = () => {
      controller.abort();
      return Promise.resolve(status("READY"));
    };
    await expect(
      waitForDesktopAgentRecovery(controller.signal, read)
    ).rejects.toThrow("aborted");
  });

  it.each([
    ["UPDATING", "updating"],
    ["DEGRADED_NEEDS_ATTENTION", "not_ready"],
  ])(
    "gives an actionable reason for %s instead of a blanket reinstall recommendation",
    async (state, reason) => {
      vi.useFakeTimers();
      const result = waitForDesktopAgentRecovery(
        new AbortController().signal,
        vi.fn().mockResolvedValue(status(state)),
        500
      );
      await Promise.all([
        expect(result).rejects.toMatchObject({ reason }),
        vi.advanceTimersByTimeAsync(750),
      ]);
    }
  );

  it("distinguishes successful connection from pending data recovery", async () => {
    const ready = status("READY");
    await expect(
      waitForDesktopAgentRecovery(new AbortController().signal, () =>
        Promise.resolve(ready)
      )
    ).resolves.toBe("ready");
    if (ready.health?.app === "project-wing-desktop-runtime") {
      ready.health.quarantineCount = 1;
    }
    await expect(
      waitForDesktopAgentRecovery(new AbortController().signal, () =>
        Promise.resolve(ready)
      )
    ).resolves.toBe("attention");
    expect(new DesktopAgentRecoveryError("unreachable").reason).toBe(
      "unreachable"
    );
  });

  it("does not label a service-only update warning as lost or pending files", async () => {
    const current = status("READY_WITH_ATTENTION");
    if (current.health?.app === "project-wing-desktop-runtime") {
      current.health.attentionCount = 0;
    }
    await expect(
      waitForDesktopAgentRecovery(new AbortController().signal, () =>
        Promise.resolve(current)
      )
    ).resolves.toBe("service_attention");
  });
});
