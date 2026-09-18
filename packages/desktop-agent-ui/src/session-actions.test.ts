import type { DesktopAgentTrayViewModel } from "@project-wing/desktop-agent/tray";
import { describe, expect, it } from "vitest";

import { readSessionAction } from "./session-actions";

type TraySession = DesktopAgentTrayViewModel["sessions"][number];

describe("desktop agent session actions", () => {
  it.each([
    ["CHECKIN_FAILED", "CHECKIN_FAILED", "CHECK_IN"],
    ["RELEASE_FAILED", "RELEASE_FAILED", "RELEASE"],
    ["CLEANUP_FAILED", "CLEANUP_FAILED", "RELEASE"],
    ["OPEN_UNCHANGED", "LAUNCH_FAILED", "RECOVER_RELEASE"],
    ["OPEN_UNCHANGED", "OPEN", null],
  ] as const)("maps %s/%s to %s", (status, lifecycleState, expected) => {
    expect(readSessionAction(makeSession({ status, lifecycleState }))).toBe(
      expected
    );
  });
});

function makeSession(patch: Partial<TraySession>): TraySession {
  return {
    sessionId: "session-1",
    projectId: "project-1",
    attachmentId: "attachment-1",
    fileName: "audit.xlsx",
    mode: "MASTER",
    status: "OPEN_UNCHANGED",
    lifecycleState: "OPEN",
    contentState: "UNCHANGED",
    lastError: null,
    openedAt: "2026-08-03T08:00:00.000Z",
    requiresAttention: false,
    ...patch,
  };
}
