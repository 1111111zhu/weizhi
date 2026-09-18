import type { DesktopAgentTrayViewModel } from "@project-wing/desktop-agent/tray";

type TraySession = DesktopAgentTrayViewModel["sessions"][number];

export type DesktopAgentSessionAction =
  | "CHECK_IN"
  | "RECOVER_RELEASE"
  | "RELEASE";

export function readSessionAction(
  session: TraySession
): DesktopAgentSessionAction | null {
  if (session.lifecycleState === "LAUNCH_FAILED") {
    return "RECOVER_RELEASE";
  }
  if (session.status === "CHECKIN_FAILED") {
    return "CHECK_IN";
  }
  if (
    session.status === "RELEASE_FAILED" ||
    session.status === "CLEANUP_FAILED"
  ) {
    return "RELEASE";
  }
  return null;
}
