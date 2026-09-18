import {
  Button,
  IconButton,
  ProjectWingFileTypeIcon,
  Spinner,
} from "@project-wing/ui";
import { Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { DesktopCacheFiles } from "../shared/desktop-agent-api";
import { useDesktopAgentI18n } from "./i18n";
import { formatCacheBytes, workspaceCopy } from "./workspace-copy";

export function CachePage({ headerHost }: { headerHost: HTMLElement | null }) {
  const { locale, copy: base } = useDesktopAgentI18n();
  const copy = workspaceCopy(locale);
  const [listing, setListing] = useState<DesktopCacheFiles | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const operationPending = useRef(false);
  async function run(action: () => Promise<DesktopCacheFiles>) {
    requestVersion.current++;
    operationPending.current = true;
    setBusy(true);
    setError(null);
    try {
      setListing(await action());
    } catch (error) {
      setError(error instanceof Error ? error.message : copy.unavailable);
    } finally {
      operationPending.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    void run(() => window.desktopAgent.getCacheFiles());
    const timer = window.setInterval(() => {
      if (operationPending.current || document.visibilityState === "hidden")
        return;
      const version = ++requestVersion.current;
      void window.desktopAgent
        .getCacheFiles()
        .then((value) => {
          if (
            active &&
            version === requestVersion.current &&
            !operationPending.current
          )
            setListing(value);
        })
        .catch(() => {
          /* Keep the last list on transient errors; automatic rotation is silent. */
        });
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);
  return (
    <div className="mx-auto w-full max-w-3xl">
      {headerHost
        ? createPortal(
            <>
              <p className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                {listing
                  ? `${formatCacheBytes(listing.usedBytes)} · ${listing.files.length} ${copy.files}`
                  : "—"}
              </p>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void run(() => window.desktopAgent.getCacheFiles())
                }
              >
                {busy ? <Spinner /> : base.refresh}
              </Button>
            </>,
            headerHost
          )
        : null}
      {error ? (
        <p role="alert" className="text-destructive mb-4 text-sm">
          {error}
        </p>
      ) : null}
      {listing?.files.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          {copy.emptyCache}
        </p>
      ) : null}
      <ul className="divide-border/60 divide-y">
        {listing?.files.map((file) => (
          <li key={file.id} className="flex min-h-10 items-center gap-3 py-1.5">
            <ProjectWingFileTypeIcon
              fileName={file.fileName}
              className="size-6 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm" title={file.fileName}>
                {file.fileName}
              </p>
              {!file.canDelete ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  {file.protectedReason === "IN_USE"
                    ? copy.inUse
                    : file.protectedReason === "RECOVERY_REQUIRED"
                      ? copy.recovery
                      : copy.retained}
                </p>
              ) : null}
            </div>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {formatCacheBytes(file.size)}
            </span>
            <IconButton
              icon={<Trash2Icon />}
              size="icon-sm"
              variant="quiet"
              label={`${copy.remove} · ${file.fileName}`}
              disabled={busy || !file.canDelete}
              onClick={() =>
                void run(() => window.desktopAgent.deleteCacheFile(file.id))
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
