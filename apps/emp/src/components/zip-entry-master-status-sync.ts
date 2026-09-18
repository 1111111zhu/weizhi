import type { DesktopAgentSession } from "@project-wing/shared";

import type { ZipMasterEntry, ZipMasterSessionResponse } from "../api/client";

export function hasMasterZipEntries(entries: ZipMasterEntry[]): boolean {
  return entries.some((entry) => {
    if (entry.type === "file") {
      return entry.status === "MASTER";
    }
    return hasMasterZipEntries(entry.children);
  });
}

export function getDesktopAgentProjectSessionSignature(
  sessions: DesktopAgentSession[],
  projectId: string
) {
  return sessions
    .filter((session) => session.projectId === projectId)
    .map((session) =>
      [
        session.attachmentId,
        session.sessionId,
        session.lockSessionId ?? "",
        session.mode,
        session.lifecycleState,
        session.contentState,
        session.status,
      ].join(":")
    )
    .sort()
    .join("|");
}

export function shouldRefreshZipMasterPanelForDesktopAgentChange(input: {
  session: ZipMasterSessionResponse;
  previousSignature: string | null;
  nextSignature: string;
}) {
  return (
    input.previousSignature !== null &&
    input.previousSignature !== input.nextSignature &&
    hasMasterZipEntries(input.session.entries)
  );
}
