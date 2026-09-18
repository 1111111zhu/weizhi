import type { DesktopAgentDeviceAuthStatusResponse } from "@project-wing/shared";

import type { DesktopAgentStatus } from "../api/desktop-agent";
import { compareVersions } from "./desktop-agent-session-update-check";

export type AgentServiceState =
  | "checking"
  | "unreachable"
  | "starting"
  | "recovering"
  | "updating"
  | "update-reconnecting"
  | "unavailable"
  | "ready";
export type AgentAccountState =
  | "unknown"
  | "connecting"
  | "disconnected"
  | "connected";
export type AgentVersionState = "unknown" | "required" | "optional" | "current";
export type AgentSettingsAction =
  | "wait"
  | "open"
  | "recover"
  | "check"
  | "connect"
  | "update";

export function resolveAgentSettingsState(input: {
  status?: DesktopAgentStatus;
  checking?: boolean;
  statusFailed?: boolean;
  auth?: DesktopAgentDeviceAuthStatusResponse | null;
  authChecking?: boolean;
  pairing?: boolean;
  minimumVersion: string;
  latestVersion?: string;
  waitingForUpdateRestart?: boolean;
}): {
  service: AgentServiceState;
  account: AgentAccountState;
  version: AgentVersionState;
  action: AgentSettingsAction;
} {
  const health = input.statusFailed ? null : input.status?.health;
  let service: AgentServiceState = "unreachable";
  if (input.checking) {
    service = "checking";
  } else if (!health && input.waitingForUpdateRestart) {
    service = "update-reconnecting";
  } else if (health?.app === "project-wing-desktop-agent") {
    service = "ready";
  } else if (health?.app === "project-wing-desktop-runtime") {
    if (health.agentState === "UPDATING") {
      service = "updating";
    } else if (["READY", "READY_WITH_ATTENTION"].includes(health.agentState)) {
      service = "ready";
    } else if (health.agentState === "RESTORING") {
      service = "recovering";
    } else if (health.agentState === "STARTING") {
      service = "starting";
    } else {
      service = "unavailable";
    }
  }

  let account: AgentAccountState = "unknown";
  if (service === "ready") {
    if (input.pairing || input.auth?.pairing) {
      account = "connecting";
    } else if (input.auth && !input.authChecking) {
      account = input.auth.authenticated ? "connected" : "disconnected";
    }
  }
  // isSupported also encodes runtime health in the legacy client contract.
  // Never use it as proof that the installed version is too old.
  let version: AgentVersionState = "unknown";
  if (health?.version) {
    if (compareVersions(health.version, input.minimumVersion) < 0) {
      version = "required";
    } else if (input.latestVersion) {
      version =
        compareVersions(health.version, input.latestVersion) < 0
          ? "optional"
          : "current";
    }
  }
  let action: AgentSettingsAction = "wait";
  if (service === "unreachable") {
    action = "open";
  } else if (service === "unavailable") {
    action = "recover";
  } else if (service === "ready") {
    if (version === "required") {
      action = "update";
    } else if (account === "connecting" || input.authChecking) {
      action = "wait";
    } else if (account === "unknown") {
      action = "check";
    } else if (account === "disconnected") {
      action = "connect";
    } else {
      action = "open";
    }
  }
  return { service, account, version, action };
}
