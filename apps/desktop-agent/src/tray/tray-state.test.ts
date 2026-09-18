import type { DesktopAgentSession } from "@project-wing/shared";
import { describe, expect, it } from "vitest";

import type { DesktopAgentRuntimeSnapshot } from "./runtime-client.js";
import { buildDesktopAgentTrayViewModel } from "./tray-state.js";

const health = {
  ok: true,
  app: "project-wing-desktop-runtime",
  version: "0.2.0",
  managerVersion: "0.2.0",
  agentVersion: "0.2.0",
  agentState: "READY",
  updateState: "IDLE",
  restoreState: "READY",
  attentionCount: 0,
} as const;

describe("desktop agent tray state", () => {
  it("shows pair required for a healthy unauthenticated runtime", () => {
    expect(
      buildDesktopAgentTrayViewModel(
        makeSnapshot({
          auth: { ok: true, authenticated: false, pairing: false },
        })
      ).state
    ).toBe("PAIR_REQUIRED");
  });

  it("keeps a healthy runtime available after an update failure", () => {
    const updating = buildDesktopAgentTrayViewModel(
      makeSnapshot({ update: { ok: true, status: "INSTALLING" } })
    );
    const failed = buildDesktopAgentTrayViewModel(
      makeSnapshot({
        update: {
          ok: true,
          status: "FAILED",
          errorCode: "UNKNOWN_ERROR",
        },
      })
    );

    expect(updating.state).toBe("UPDATING");
    expect(failed.state).toBe("ATTENTION");
  });

  it("summarizes sessions that require attention", () => {
    const viewModel = buildDesktopAgentTrayViewModel(
      makeSnapshot({ sessions: [makeSession("CONFLICT_RISK")] })
    );

    expect(viewModel.state).toBe("ATTENTION");
    expect(viewModel.attentionCount).toBe(1);
    expect(viewModel.sessions).toStrictEqual([
      {
        sessionId: "session-1",
        projectId: "project-1",
        attachmentId: "attachment-1",
        fileName: "audit.xlsx",
        mode: "MASTER",
        status: "CONFLICT_RISK",
        lifecycleState: "CONFLICT_RISK",
        contentState: "DIRTY",
        lastError: null,
        openedAt: "2026-07-15T08:00:00.000Z",
        requiresAttention: true,
      },
    ]);
  });

  it("surfaces launch failures even when compatibility status is unchanged", () => {
    const session = {
      ...makeSession("OPEN_UNCHANGED"),
      lifecycleState: "LAUNCH_FAILED" as const,
      contentState: "UNCHANGED" as const,
    };
    const viewModel = buildDesktopAgentTrayViewModel(
      makeSnapshot({ sessions: [session] })
    );

    expect(viewModel.state).toBe("ATTENTION");
    expect(viewModel.sessions[0]).toMatchObject({ requiresAttention: true });
  });

  it("reports ready only when runtime, auth, update, and sessions are healthy", () => {
    const viewModel = buildDesktopAgentTrayViewModel(makeSnapshot());

    expect(viewModel.state).toBe("READY");
    expect(viewModel.version).toBe("0.2.0");
    expect(viewModel.requiredVersion).toBeNull();
    expect(viewModel.attentionCount).toBe(0);
  });

  it("sorts active files first and hides matching recent history", () => {
    const older = makeSession("OPEN_UNCHANGED");
    const newer = {
      ...makeSession("OPEN_UNCHANGED"),
      sessionId: "session-2",
      projectId: "project-2",
      attachmentId: "attachment-2",
      fileName: "newer.xlsx",
      openedAt: "2026-08-03T09:00:00.000Z",
    };
    const viewModel = buildDesktopAgentTrayViewModel(
      makeSnapshot({
        sessions: [older, newer],
        recentSessions: [
          {
            projectId: "project-1",
            attachmentId: "attachment-1",
            fileName: "audit.xlsx",
            mode: "MASTER",
            openedAt: "2026-07-15T08:00:00.000Z",
            closedAt: "2026-07-15T09:00:00.000Z",
          },
          {
            projectId: "project-3",
            attachmentId: "attachment-3",
            fileName: "recent.xlsx",
            mode: "READ_ONLY",
            openedAt: "2026-08-02T08:00:00.000Z",
            closedAt: "2026-08-02T09:00:00.000Z",
          },
        ],
      })
    );

    expect(viewModel.sessions.map((session) => session.fileName)).toStrictEqual(
      ["newer.xlsx", "audit.xlsx"]
    );
    expect(
      viewModel.recentSessions.map((session) => session.fileName)
    ).toStrictEqual(["recent.xlsx"]);
  });
});

function makeSnapshot(
  patch: Partial<DesktopAgentRuntimeSnapshot> = {}
): DesktopAgentRuntimeSnapshot {
  return {
    health,
    auth: { ok: true, authenticated: true, pairing: false },
    sessions: [],
    recentSessions: [],
    update: { ok: true, status: "READY" },
    errors: [],
    ...patch,
  };
}

function makeSession(
  status: DesktopAgentSession["status"]
): DesktopAgentSession {
  return {
    sessionId: "session-1",
    generation: 1,
    mode: "MASTER",
    projectId: "project-1",
    attachmentId: "attachment-1",
    fileName: "audit.xlsx",
    localPath: "C:\\ProjectWing\\audit.xlsx",
    originalHash: "hash-1",
    lastKnownHash: "hash-1",
    status,
    lifecycleState: "CONFLICT_RISK",
    contentState: "DIRTY",
    openedAt: "2026-07-15T08:00:00.000Z",
    launchStartedAt: "2026-07-15T08:00:00.000Z",
    lastSeenAt: "2026-07-15T08:00:00.000Z",
  };
}
