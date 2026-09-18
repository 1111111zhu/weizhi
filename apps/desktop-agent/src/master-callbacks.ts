import type {
  DesktopAgentCheckInRequest,
  DesktopAgentReleaseRequest,
  DesktopAgentSession,
} from "@project-wing/shared/desktop";

export function buildMasterCheckInRequest(
  session: DesktopAgentSession,
  apiBaseUrl: string
): DesktopAgentCheckInRequest {
  return {
    sessionId: session.sessionId,
    checkInUrl:
      session.checkInUrl ??
      `${apiBaseUrl}/desktop/master-sessions/${encodeURIComponent(
        requireLockSessionId(session)
      )}/check-in`,
    releaseUrl: buildMasterReleaseUrl(session, apiBaseUrl),
  };
}

export function buildMasterReleaseRequest(
  session: DesktopAgentSession,
  apiBaseUrl: string
): DesktopAgentReleaseRequest {
  return {
    sessionId: session.sessionId,
    releaseUrl: buildMasterReleaseUrl(session, apiBaseUrl),
  };
}

export function buildMasterReleaseUrl(
  session: DesktopAgentSession,
  apiBaseUrl: string
) {
  return (
    session.releaseUrl ??
    `${apiBaseUrl}/desktop/master-sessions/${encodeURIComponent(
      requireLockSessionId(session)
    )}/release`
  );
}

function requireLockSessionId(session: DesktopAgentSession) {
  if (!session.lockSessionId) {
    throw new Error("Tracked Master session has no lock session id.");
  }
  return session.lockSessionId;
}
