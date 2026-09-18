import {
  Badge,
  Button,
  ProjectWingFileTypeIcon,
  Spinner,
} from "@project-wing/ui";
import { ArrowLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { DesktopAgentSnapshot } from "../shared/desktop-agent-api";
import { formatDesktopAgentStatus, useDesktopAgentI18n } from "./i18n";
import { getSessionStatusBadgeVariant } from "./tray-content";
import { issueStates, workspaceCopy } from "./workspace-copy";

export function SessionPage({
  snapshot,
  issues,
  refresh,
  headerHost,
}: {
  snapshot: DesktopAgentSnapshot | null;
  issues: boolean;
  refresh: () => void;
  headerHost: HTMLElement | null;
}) {
  const { locale, copy: base } = useDesktopAgentI18n();
  const copy = workspaceCopy(locale);
  const [selectedId, select] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const wasDetail = useRef(false);
  const detailsId = useId();
  const sessions =
    snapshot?.sessions.filter(
      (session) =>
        issueStates.has(session.lifecycleState ?? session.status) === issues
    ) ?? [];
  const selected = sessions.find((session) => session.sessionId === selectedId);
  useEffect(() => {
    if (selected) heading.current?.focus();
    else if (wasDetail.current) list.current?.focus();
    wasDetail.current = Boolean(selected);
  }, [selected?.sessionId]);
  async function act(action: () => Promise<unknown>, sessionId?: string) {
    if (sessionId) setPendingSessionId(sessionId);
    else setBusy(true);
    setError(null);
    try {
      await action();
      refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : copy.failed);
    } finally {
      if (sessionId) setPendingSessionId(null);
      else setBusy(false);
    }
  }
  const disabled = busy || Boolean(snapshot?.stale) || !snapshot?.user;
  if (!snapshot)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  const recentFiles = snapshot.recentFiles ?? [];
  return (
    <div className="mx-auto w-full max-w-4xl">
      {issues && headerHost
        ? createPortal(
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void act(() => window.desktopAgent.openRecoveryHistory())
              }
            >
              {copy.history}
            </Button>,
            headerHost
          )
        : null}
      {snapshot.stale ? (
        <p role="status" className="text-muted-foreground mb-4 text-sm">
          {base.lastKnownFiles}
        </p>
      ) : null}
      {snapshot.recoveryRequired ? (
        <div className="mb-4 space-y-3">
          <p className="text-muted-foreground text-sm">
            {base.fileRecoveryRequired}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void act(() => window.desktopAgent.openRetainedFiles())
            }
          >
            {base.viewRetainedFiles}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive mb-4 text-sm">
          {copy.failed} {error}
        </p>
      ) : null}
      {issues && selected ? (
        <section
          className="mx-auto max-w-2xl py-2"
          aria-labelledby="resolution-heading"
        >
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              select(null);
              setError(null);
              setDetailsOpen(false);
            }}
          >
            <ArrowLeftIcon />
            {copy.back}
          </Button>
          <div className="mt-6 flex items-center gap-3">
            <ProjectWingFileTypeIcon
              fileName={selected.fileName}
              className="size-7 shrink-0"
            />
            <h2
              id="resolution-heading"
              ref={heading}
              tabIndex={-1}
              className="text-base font-medium break-words outline-none"
            >
              {selected.fileName}
            </h2>
          </div>
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            {selected.status === "LOCAL_FILE_MISSING"
              ? copy.missing
              : selected.status === "SERVER_FILE_REMOVED"
                ? copy.removed
                : ["LEASE_LOST", "LOCK_REVOKED"].includes(selected.status)
                  ? copy.lease
                  : base.closeBeforeSync}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || pendingSessionId === selected.sessionId}
              onClick={() =>
                void act(
                  () => window.desktopAgent.openProject(selected.sessionId),
                  selected.sessionId
                )
              }
            >
              {copy.openProject}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() =>
                void act(() => window.desktopAgent.openRetainedFiles())
              }
            >
              {copy.copies}
            </Button>
            {selected.status !== "LOCAL_FILE_MISSING" ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled || pendingSessionId === selected.sessionId}
                onClick={() =>
                  void act(
                    () =>
                      window.desktopAgent.revealSessionFile(selected.sessionId),
                    selected.sessionId
                  )
                }
              >
                {copy.locate}
              </Button>
            ) : null}
            {selected.canCheckIn ? (
              <Button
                size="sm"
                disabled={disabled || pendingSessionId === selected.sessionId}
                onClick={() =>
                  void act(
                    () => window.desktopAgent.release(selected.sessionId),
                    selected.sessionId
                  )
                }
              >
                {base.releaseFile}
              </Button>
            ) : [
                "LOCAL_FILE_MISSING",
                "LEASE_LOST",
                "LOCK_REVOKED",
                "SERVER_FILE_REMOVED",
              ].includes(selected.lifecycleState ?? selected.status) ? (
              <Button
                size="sm"
                disabled={disabled || pendingSessionId === selected.sessionId}
                onClick={() =>
                  void act(
                    () => window.desktopAgent.endTracking(selected.sessionId),
                    selected.sessionId
                  )
                }
              >
                {pendingSessionId === selected.sessionId
                  ? copy.processing
                  : copy.end}
              </Button>
            ) : null}
          </div>
          <div className="border-border/60 mt-8 border-t pt-4">
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={detailsOpen}
              aria-controls={detailsId}
              onClick={() => setDetailsOpen((value) => !value)}
            >
              {copy.details}
            </Button>
            {detailsOpen ? (
              <div
                id={detailsId}
                className="text-muted-foreground mt-2 space-y-2 text-xs break-words"
              >
                <p>{selected.lastError}</p>
                <p className="break-all">ID: {selected.sessionId}</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : sessions.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          {snapshot.stale
            ? base.unavailableActivity
            : issues
              ? copy.emptyIssues
              : copy.emptyCurrent}
        </p>
      ) : (
        <ul
          ref={list}
          tabIndex={-1}
          aria-label={issues ? copy.issues : copy.current}
          className="divide-border/60 divide-y outline-none"
        >
          {sessions.map((session) => (
            <li
              key={session.sessionId}
              className="flex min-h-10 items-center gap-3 py-1.5"
            >
              <ProjectWingFileTypeIcon
                fileName={session.fileName}
                className="size-6 shrink-0"
              />
              <p
                title={session.fileName}
                className="min-w-0 flex-1 truncate text-sm"
              >
                {session.fileName}
              </p>
              {issues || session.canCheckIn ? (
                <span className="text-muted-foreground shrink-0 text-xs">
                  {formatDesktopAgentStatus(session.status, base)}
                </span>
              ) : null}
              {!issues ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled || pendingSessionId === session.sessionId}
                  onClick={() =>
                    void act(
                      () =>
                        window.desktopAgent.revealSessionFile(
                          session.sessionId
                        ),
                      session.sessionId
                    )
                  }
                >
                  {copy.locate}
                </Button>
              ) : null}
              {issues ? (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`${copy.handle} · ${session.fileName}`}
                  onClick={() => {
                    select(session.sessionId);
                    setError(null);
                    setDetailsOpen(false);
                  }}
                >
                  {copy.handle}
                  <ChevronRightIcon />
                </Button>
              ) : session.canCheckIn ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled || pendingSessionId === session.sessionId}
                  onClick={() =>
                    void act(
                      () => window.desktopAgent.release(session.sessionId),
                      session.sessionId
                    )
                  }
                >
                  {pendingSessionId === session.sessionId
                    ? copy.processing
                    : base.releaseFile}
                </Button>
              ) : (
                <Badge
                  radius="full"
                  size="xs"
                  variant={getSessionStatusBadgeVariant(session.status)}
                >
                  {session.mode === "READ_ONLY"
                    ? base.readOnlyFile
                    : formatDesktopAgentStatus(session.status, base)}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      {!issues && recentFiles.length > 0 ? (
        <section className="border-border/60 mt-8 border-t pt-5">
          <h2 className="text-sm font-medium">{copy.recent}</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            {copy.recentHelp}
          </p>
          <ul className="divide-border/60 mt-3 divide-y">
            {recentFiles.map((file) => (
              <li
                key={`${file.projectId}:${file.attachmentId}`}
                className="flex min-h-10 items-center gap-3 py-1.5"
              >
                <ProjectWingFileTypeIcon
                  fileName={file.fileName}
                  className="size-6 shrink-0 opacity-75"
                />
                <button
                  type="button"
                  disabled={disabled}
                  className="hover:text-primary min-w-0 flex-1 truncate text-left text-sm disabled:opacity-50"
                  title={file.fileName}
                  onClick={() =>
                    void act(() =>
                      window.desktopAgent.openRecentProject(file.projectId)
                    )
                  }
                >
                  {file.fileName}
                </button>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {file.mode === "READ_ONLY" ? base.readOnlyFile : "Master"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
