import { getDesktopAgentStatus } from "../api/desktop-agent";
import type { DesktopAgentStatus } from "../api/desktop-agent";

export function isDesktopAgentServiceReady(status?: DesktopAgentStatus) {
  return Boolean(
    status?.isInstalled &&
    status.isSupported &&
    (status.health?.app === "project-wing-desktop-agent" ||
      (status.health?.app === "project-wing-desktop-runtime" &&
        (status.health.agentState === "READY" ||
          status.health.agentState === "READY_WITH_ATTENTION")))
  );
}

export function desktopAgentNeedsFileAttention(status?: DesktopAgentStatus) {
  const health = status?.health;
  return (
    health?.app === "project-wing-desktop-runtime" &&
    ((health.attentionCount ?? 0) > 0 ||
      (health.quarantineCount ?? 0) > 0 ||
      (health.restoreState !== undefined && health.restoreState !== "READY"))
  );
}

export class DesktopAgentRecoveryError extends Error {
  constructor(
    public readonly reason:
      | "unreachable"
      | "updating"
      | "not_ready"
      | "update_required"
  ) {
    super("DESKTOP_AGENT_RECOVERY_NOT_CONFIRMED");
    this.name = "DesktopAgentRecoveryError";
  }
}

export function launchDesktopAgentRecovery(
  command: "recover" | "open" = "recover"
) {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.src = `projectwing-agent://${command}`;
  document.body.append(frame);
  window.setTimeout(() => frame.remove(), 1000);
}

// Launch only from a user gesture. The browser requests OS activation; it never
// calls the privileged native recovery endpoint or treats activation as success.
export async function waitForDesktopAgentRecovery(
  signal: AbortSignal,
  readStatus = getDesktopAgentStatus,
  timeoutMs = 25_000
) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus: DesktopAgentStatus | undefined;
  while (!signal.aborted && Date.now() < deadline) {
    const status = (await readStatus().catch(() => null)) ?? undefined;
    lastStatus = status;
    signal.throwIfAborted();
    if (isDesktopAgentServiceReady(status)) {
      if (desktopAgentNeedsFileAttention(status)) {
        return "attention" as const;
      }
      return status?.health?.app === "project-wing-desktop-runtime" &&
        status.health.agentState === "READY_WITH_ATTENTION"
        ? ("service_attention" as const)
        : ("ready" as const);
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 750);
    });
  }
  signal.throwIfAborted();
  const health = lastStatus?.health;
  if (!health) {
    throw new DesktopAgentRecoveryError("unreachable");
  }
  if (
    health.app === "project-wing-desktop-runtime" &&
    health.agentState === "UPDATING"
  ) {
    throw new DesktopAgentRecoveryError("updating");
  }
  const running =
    health.app === "project-wing-desktop-agent" ||
    health.agentState === "READY" ||
    health.agentState === "READY_WITH_ATTENTION";
  throw new DesktopAgentRecoveryError(
    running && !lastStatus?.isSupported ? "update_required" : "not_ready"
  );
}
