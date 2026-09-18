import { describe, expect, it } from "vitest";

import type { DesktopAgentStatus } from "../api/desktop-agent";
import { resolveAgentSettingsState } from "./desktop-agent-settings-state";

type ManagedHealth = Extract<
  NonNullable<DesktopAgentStatus["health"]>,
  { app: "project-wing-desktop-runtime" }
>;
function status(
  agentState: ManagedHealth["agentState"] = "READY",
  version = "0.3.10"
): DesktopAgentStatus {
  return {
    isInstalled: true,
    isSupported: false,
    supportsSelfUpdate: false,
    health: {
      ok: true,
      app: "project-wing-desktop-runtime",
      version,
      managerVersion: "0.2.1",
      agentState,
      updateState: "IDLE",
      restoreState: "READY",
      attentionCount: 0,
    },
  };
}
const connected = { ok: true, authenticated: true, pairing: false } as const;
const base = {
  minimumVersion: "0.2.0",
  latestVersion: "0.3.10",
  auth: connected,
};

describe(resolveAgentSettingsState, () => {
  it.each([
    ["STARTING", "starting", "wait"],
    ["RESTORING", "recovering", "wait"],
    ["UPDATING", "updating", "wait"],
    ["DEGRADED_NEEDS_ATTENTION", "unavailable", "recover"],
    ["READY", "ready", "open"],
    ["READY_WITH_ATTENTION", "ready", "open"],
  ] as const)(
    "maps confirmed %s without using the combined isSupported flag",
    (raw, service, action) => {
      expect(
        resolveAgentSettingsState({ ...base, status: status(raw) })
      ).toMatchObject({ service, action });
    }
  );

  it("does not infer installation or authentication from no response", () => {
    expect(resolveAgentSettingsState({ ...base })).toStrictEqual({
      service: "unreachable",
      account: "unknown",
      version: "unknown",
      action: "open",
    });
  });

  it("does not retain a green status after a failed probe", () => {
    expect(
      resolveAgentSettingsState({
        ...base,
        status: status(),
        statusFailed: true,
      })
    ).toMatchObject({ service: "unreachable", account: "unknown" });
  });

  it("keeps a known update restart distinct from an unknown installation", () => {
    expect(
      resolveAgentSettingsState({ ...base, waitingForUpdateRestart: true })
    ).toMatchObject({ service: "update-reconnecting", action: "wait" });
  });

  it("does not call a failing service outdated just because an update is available", () => {
    expect(
      resolveAgentSettingsState({
        ...base,
        status: status("DEGRADED_NEEDS_ATTENTION", "0.3.9"),
      })
    ).toMatchObject({
      service: "unavailable",
      version: "optional",
      action: "recover",
    });
  });

  it("requires an old version update independently of latest-manifest availability", () => {
    expect(
      resolveAgentSettingsState({
        ...base,
        status: status("READY", "0.1.0"),
        latestVersion: undefined,
      })
    ).toMatchObject({
      service: "ready",
      version: "required",
      action: "update",
    });
  });

  it("a supported optional update does not replace the normal open action", () => {
    expect(
      resolveAgentSettingsState({ ...base, status: status("READY", "0.3.9") })
    ).toMatchObject({ version: "optional", action: "open" });
  });

  it.each([
    [null, false, "unknown", "check"],
    [
      { ok: true, authenticated: false, pairing: false },
      false,
      "disconnected",
      "connect",
    ],
    [
      { ok: true, authenticated: false, pairing: true },
      false,
      "connecting",
      "wait",
    ],
    [null, true, "unknown", "wait"],
  ] as const)(
    "keeps account evidence separate (%s, checking=%s)",
    (auth, authChecking, account, action) => {
      expect(
        resolveAgentSettingsState({
          ...base,
          status: status(),
          auth,
          authChecking,
        })
      ).toMatchObject({ service: "ready", account, action });
    }
  );

  it("an old failed update does not turn a ready worker into an error", () => {
    const current = status();
    const health = current.health as ManagedHealth;
    health.updateState = "FAILED";
    expect(
      resolveAgentSettingsState({ ...base, status: current })
    ).toMatchObject({ service: "ready", action: "open" });
  });
});
