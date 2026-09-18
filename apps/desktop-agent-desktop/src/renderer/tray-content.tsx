import {
  FolderOpen20Regular,
  MoreHorizontal20Regular,
  SignOut20Regular,
} from "@fluentui/react-icons";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  ProjectWingFileTypeIcon,
  Skeleton,
} from "@project-wing/ui";
import { useState } from "react";

import type { DesktopAgentSnapshot } from "../shared/desktop-agent-api";
import { formatDesktopAgentStatus, useDesktopAgentI18n } from "./i18n";

type TrayActivityProps = {
  actionError: string | null;
  busy: boolean;
  snapshot: DesktopAgentSnapshot | null;
  onRelease: (sessionId: string) => void;
  onOpenRetainedFiles: () => void;
};

export function TrayActivity({
  actionError,
  busy,
  snapshot,
  onRelease,
  onOpenRetainedFiles,
}: TrayActivityProps) {
  const { copy } = useDesktopAgentI18n();
  const [historyError, setHistoryError] = useState<string | null>(null);
  return (
    <section className="tray-activity" aria-label={copy.activeFiles}>
      {actionError || historyError || snapshot?.error ? (
        <p className="tray-action-error" role="alert">
          {actionError ?? historyError ?? snapshot?.error}
        </p>
      ) : null}
      {snapshot?.recoveryRequired ? (
        <div className="space-y-2">
          <output className="tray-action-error block">
            {copy.fileRecoveryRequired}
          </output>
          <p className="text-muted-foreground text-xs">
            {copy.retainedFilesHelp}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onOpenRetainedFiles}
          >
            <FolderOpen20Regular />
            {copy.viewRetainedFiles}
          </Button>
        </div>
      ) : null}
      {snapshot?.stale ? (
        <output className="tray-action-error block">
          {copy.lastKnownFiles}
        </output>
      ) : null}
      <div className="tray-activity-content">
        <ActivityContent
          busy={busy || Boolean(snapshot?.stale)}
          snapshot={snapshot}
          onRelease={onRelease}
        />
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setHistoryError(null);
          void window.desktopAgent
            .openRecoveryHistory()
            .catch((error) =>
              setHistoryError(
                error instanceof Error ? error.message : copy.genericActionError
              )
            );
        }}
      >
        {copy.recoveryHistory}
      </Button>
    </section>
  );
}

type ActivityContentProps = Pick<
  TrayActivityProps,
  "busy" | "snapshot" | "onRelease"
>;

function ActivityContent({ busy, snapshot, onRelease }: ActivityContentProps) {
  const { copy } = useDesktopAgentI18n();
  if (!snapshot) {
    return <ActivitySkeleton />;
  }
  if (snapshot.sessions.length === 0) {
    if (snapshot.stale) {
      return <p className="tray-action-error">{copy.unavailableActivity}</p>;
    }
    return <EmptyActivity />;
  }
  return (
    <ul className="tray-session-list">
      {snapshot.sessions.map((session) => (
        <SessionRow
          busy={busy}
          key={session.sessionId}
          session={session}
          onRelease={onRelease}
        />
      ))}
    </ul>
  );
}

type SessionRowProps = {
  busy: boolean;
  session: DesktopAgentSnapshot["sessions"][number];
  onRelease: (sessionId: string) => void;
};

function SessionRow({ busy, session, onRelease }: SessionRowProps) {
  const { copy } = useDesktopAgentI18n();
  const [resolving, setResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const recoverable = [
    "LOCAL_FILE_MISSING",
    "LEASE_LOST",
    "LOCK_REVOKED",
    "SERVER_FILE_REMOVED",
  ].includes(session.lifecycleState ?? session.status);
  const act = async (operation: () => Promise<unknown>) => {
    setResolving(true);
    setResolutionError(null);
    try {
      await operation();
    } catch (error) {
      setResolutionError(
        error instanceof Error ? error.message : copy.genericActionError
      );
    } finally {
      setResolving(false);
    }
  };
  const fileOpen =
    ["OPEN", "LAUNCHING", "OPEN_NOT_OBSERVED"].includes(
      session.lifecycleState ?? session.status
    ) ||
    (!session.lifecycleState && session.status === "OPEN_UNCHANGED");
  return (
    <li className="tray-session">
      <ProjectWingFileTypeIcon
        className="tray-file-icon"
        fileName={session.fileName}
      />
      <div
        className={
          recoverable
            ? "tray-session-details tray-session-recovery"
            : "tray-session-details"
        }
      >
        <div className="tray-session-copy">
          <strong title={session.fileName}>{session.fileName}</strong>
          {session.mode === "READ_ONLY" ? (
            <p className="text-muted-foreground text-xs">{copy.readOnlyFile}</p>
          ) : null}
          {recoverable ? (
            <p className="text-muted-foreground text-xs">
              {session.status === "LOCAL_FILE_MISSING"
                ? copy.missingHelp
                : copy.leaseHelp}
            </p>
          ) : null}
          {session.lastError && !recoverable ? (
            <p className="tray-action-error">{session.lastError}</p>
          ) : null}
          {fileOpen ? (
            <p className="text-muted-foreground text-xs">
              {copy.closeBeforeSync}
            </p>
          ) : null}
          {recoverable ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy || resolving}
                onClick={() =>
                  void act(() =>
                    window.desktopAgent.openProject(session.sessionId)
                  )
                }
              >
                {copy.openProject}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || resolving}
                onClick={() =>
                  void act(() => window.desktopAgent.openRetainedFiles())
                }
              >
                {copy.viewRetainedFiles}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || resolving}
                onClick={() =>
                  void act(() =>
                    window.desktopAgent.endTracking(session.sessionId)
                  )
                }
              >
                {resolving ? copy.processing : copy.endTracking}
              </Button>
            </div>
          ) : null}
          {resolutionError ? (
            <p role="alert" className="tray-action-error">
              {copy.resolutionFailed} {resolutionError}
            </p>
          ) : null}
          {recoverable ? (
            <details className="text-muted-foreground text-xs">
              <summary>{copy.details}</summary>
              <p>{session.lastError}</p>
              <p>ID: {session.sessionId}</p>
            </details>
          ) : null}
        </div>
        <div className="tray-session-actions">
          <Badge
            radius="full"
            size="xs"
            variant={getSessionStatusBadgeVariant(session.status)}
          >
            {formatDesktopAgentStatus(session.status, copy)}
          </Badge>
          {!recoverable && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <IconButton
                    disabled={busy || fileOpen || session.canCheckIn !== true}
                    icon={<MoreHorizontal20Regular />}
                    label={copy.actionsFor(session.fileName)}
                    showTooltip={false}
                    size="icon-sm"
                    variant="quiet"
                  />
                }
              />
              <DropdownMenuContent align="end" side="bottom">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    disabled={session.canCheckIn !== true}
                    onClick={() => onRelease(session.sessionId)}
                  >
                    <SignOut20Regular />
                    {copy.releaseFile}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </li>
  );
}

export function getSessionStatusBadgeVariant(status: string) {
  if (["OPEN", "OPEN_UNCHANGED"].includes(status)) {
    return "success-light" as const;
  }
  if (
    [
      "CHECKING_IN",
      "CLEANUP_PENDING",
      "LAUNCHING",
      "OPEN_NOT_OBSERVED",
      "RELEASE_PENDING",
      "RELEASING",
    ].includes(status)
  ) {
    return "info-light" as const;
  }
  if (
    ["CLOSE_DETECTED", "CONFLICT_RISK", "DIRTY_PENDING_CHECKIN"].includes(
      status
    )
  ) {
    return "warning-light" as const;
  }
  if (
    [
      "CHECKIN_FAILED",
      "CLEANUP_FAILED",
      "LEASE_LOST",
      "LOCAL_FILE_MISSING",
      "LOCK_REVOKED",
      "SERVER_FILE_REMOVED",
      "RELEASE_FAILED",
    ].includes(status)
  ) {
    return "destructive-light" as const;
  }
  return "secondary" as const;
}

function ActivitySkeleton() {
  const { copy } = useDesktopAgentI18n();
  return (
    <div className="tray-skeleton" aria-label={copy.loadingActivity}>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

function EmptyActivity() {
  const { copy } = useDesktopAgentI18n();
  return (
    <div className="tray-empty">
      <FolderOpen20Regular aria-hidden="true" />
      <span>{copy.noActiveFiles}</span>
    </div>
  );
}
