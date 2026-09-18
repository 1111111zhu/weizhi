"use client";

import {
  Button,
  CollectionState,
  Input,
  MobileActionSheet,
  MobileListItem,
} from "@project-wing/ui";
import { BriefcaseBusiness, Folder, MoreHorizontal } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { DesktopFolder, DesktopProjectPlacement } from "@/api/client";
import { getEmpMobileNavigationCopy } from "@/i18n/mobile-navigation";

export function EmpMobileProjects({
  folders,
  placements,
  folderId,
  folderLabel,
  projectLabel,
  query,
  showSearch,
  onQueryChange,
  onFolder,
  projectHref,
  onProject,
  loading,
  error,
  onRetry,
  locale,
  projectActions,
}: {
  folders: DesktopFolder[];
  placements: DesktopProjectPlacement[];
  folderId: string | null;
  folderLabel: (folder: DesktopFolder) => string;
  projectLabel: (placement: DesktopProjectPlacement) => string;
  query: string;
  showSearch: boolean;
  onQueryChange: (query: string) => void;
  onFolder: (id: string) => void;
  projectHref: (id: string) => string;
  onProject: (id: string) => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  locale: string;
  projectActions?: (
    placement: DesktopProjectPlacement,
    close: () => void
  ) => ReactNode;
}) {
  const copy = getEmpMobileNavigationCopy(locale);
  const [actionProjectId, setActionProjectId] = useState<string | null>(null);
  const actionProject = placements.find(
    (item) => item.projectId === actionProjectId
  );
  const scrollRef = useRef<HTMLElement>(null);
  const scrollKey = `wing:emp:mobile-project-scroll:${folderId ?? "folders"}`;
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || loading) {
      return;
    }
    try {
      element.scrollTop = Number(sessionStorage.getItem(scrollKey)) || 0;
    } catch {
      /* Browsing still works when storage is unavailable. */
    }
    const remember = () => {
      try {
        sessionStorage.setItem(scrollKey, String(element.scrollTop));
      } catch {
        /* Optional UI preference. */
      }
    };
    element.addEventListener("scroll", remember, { passive: true });
    return () => element.removeEventListener("scroll", remember);
  }, [scrollKey, loading]);
  const normalized = query.trim().toLocaleLowerCase();
  const visibleFolders = folders.filter((folder) =>
    folderLabel(folder).toLocaleLowerCase().includes(normalized)
  );
  const visibleProjects = placements.filter(
    (placement) =>
      placement.folderId === folderId &&
      `${projectLabel(placement)} ${placement.project.projectCode}`
        .toLocaleLowerCase()
        .includes(normalized)
  );
  return (
    <section
      ref={scrollRef}
      aria-label={folderId ? copy.projects : copy.folders}
      className="min-h-0 flex-1 overflow-y-auto px-4"
      data-testid="emp-mobile-project-browser"
    >
      {showSearch ? (
        <div className="py-3">
          <Input
            type="search"
            aria-label={copy.search}
            placeholder={copy.searchHint}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
      ) : null}
      {loading || error ? (
        <CollectionState
          kind={error ? "error" : "loading"}
          locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
          onRetry={onRetry}
        />
      ) : folderId ? (
        <>
          {visibleProjects.map((placement) => (
            <MobileListItem
              key={placement.id}
              title={projectLabel(placement)}
              description={placement.project.projectCode}
              icon={<BriefcaseBusiness />}
              href={projectHref(placement.project.id)}
              action={
                projectActions ? (
                  <Button
                    variant="quiet"
                    size="icon"
                    aria-label={`${copy.more}: ${placement.project.name}`}
                    aria-haspopup="dialog"
                    onClick={() => setActionProjectId(placement.projectId)}
                  >
                    <MoreHorizontal />
                  </Button>
                ) : undefined
              }
              onNavigate={(event) => {
                if (
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey &&
                  event.button === 0
                ) {
                  event.preventDefault();
                  onProject(placement.project.id);
                }
              }}
            />
          ))}
          {visibleProjects.length ? null : (
            <CollectionState
              kind={normalized ? "filtered" : "empty"}
              locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
            />
          )}
        </>
      ) : (
        <>
          {visibleFolders.map((folder) => (
            <MobileListItem
              key={folder.id}
              title={folderLabel(folder)}
              description={`${placements.filter((placement) => placement.folderId === folder.id).length} ${copy.count}`}
              icon={<Folder />}
              href={`?folderId=${encodeURIComponent(folder.id)}`}
              onNavigate={(event) => {
                if (
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey &&
                  event.button === 0
                ) {
                  event.preventDefault();
                  onFolder(folder.id);
                }
              }}
            />
          ))}
          {visibleFolders.length ? null : (
            <CollectionState
              kind={normalized ? "filtered" : "empty"}
              locale={locale === "zh-CN" ? "zh-CN" : "en-US"}
            />
          )}
        </>
      )}
      <MobileActionSheet
        open={Boolean(actionProject)}
        onOpenChange={(open) => {
          if (!open) {
            setActionProjectId(null);
          }
        }}
        title={actionProject?.project.name ?? copy.more}
        closeLabel={copy.close}
      >
        {actionProject
          ? projectActions?.(actionProject, () => setActionProjectId(null))
          : null}
      </MobileActionSheet>
    </section>
  );
}
