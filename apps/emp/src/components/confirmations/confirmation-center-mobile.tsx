"use client";

import type { ConfirmationStatus } from "@project-wing/shared";
import {
  Button,
  CollectionState,
  Input,
  MobileActionSheet,
  MobileListItem,
  MobilePageHeader,
  MobileScaffold,
  ViewSwitcher,
} from "@project-wing/ui";
import { ArrowUpDown, BriefcaseBusiness, FileText } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import type { ProjectConfirmation } from "@/api/client";
import type { ConfirmationWorkspaceSummary } from "@/api/confirmation-workspace";
import type { Dictionary } from "@/i18n/dictionaries";
import { getEmpMobileNavigationCopy } from "@/i18n/mobile-navigation";
import { useSurfaceTransition } from "@/lib/use-surface-transition";

import styles from "./confirmation-center-mobile.module.css";

export type ConfirmationCenterView =
  | "ALL"
  | "TEMPLATES"
  | "INFORMATION"
  | "RESPONSES";
export type ConfirmationMobileSelection = {
  projectId: string;
  projectName: string;
  kind: "status" | "all" | "own";
  status?: Exclude<ConfirmationStatus, "VOIDED">;
};
export type ConfirmationSort =
  | "REPORT_DATE_ASC"
  | "REPORT_DATE_DESC"
  | "PROJECT_NAME_ASC"
  | "AWAITING_RESPONSE_DESC";
const stages = [
  "DRAFT",
  "PREPARED",
  "AWAITING_RESPONSE",
  "RESPONSE_RECEIVED",
  "CLOSED",
] as const;
const stageKeys = [
  "draft",
  "prepared",
  "sent",
  "received",
  "completed",
] as const;

export function ConfirmationCenterMobile({
  dictionary,
  locale,
  view,
  onViewChange,
  selection,
  onSelectionChange,
  summaries,
  rows,
  query,
  onQueryChange,
  sort,
  onSortChange,
  loading,
  error,
  onRetry,
  detailsLoading,
  detailsError,
  onRetryDetails,
  onOpen,
  onLeave,
  headerActions,
  library,
}: {
  dictionary: Dictionary;
  locale: string;
  view: ConfirmationCenterView;
  onViewChange: (view: ConfirmationCenterView) => void;
  selection: ConfirmationMobileSelection | null;
  onSelectionChange: (selection: ConfirmationMobileSelection | null) => void;
  summaries: ConfirmationWorkspaceSummary[];
  rows: ProjectConfirmation[];
  query: string;
  onQueryChange: (query: string) => void;
  sort: ConfirmationSort;
  onSortChange: (sort: ConfirmationSort) => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  detailsLoading: boolean;
  detailsError: boolean;
  onRetryDetails: () => void;
  onOpen: (confirmation: ProjectConfirmation) => void;
  onLeave: () => void;
  headerActions: ReactNode;
  library: ReactNode;
}) {
  const copy = dictionary.confirmationCenter.intranet;
  const mobileCopy = getEmpMobileNavigationCopy(locale);
  const mobileSurfaceRef = useSurfaceTransition<HTMLDivElement>(
    `center-mobile:${view}:${selection?.projectId ?? ""}:${selection?.kind ?? ""}:${selection?.status ?? ""}`,
    { initial: true, variant: "content" }
  );
  const [sortOpen, setSortOpen] = useState(false);
  const [count, setCount] = useState(30);
  const contentRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);
  const previousLocation = useRef("");
  const headingRef = useRef<HTMLDivElement>(null);
  const titles = {
    ALL: copy.allConfirmations,
    TEMPLATES: copy.templateLibrary,
    INFORMATION: copy.informationLibrary.title,
    RESPONSES: copy.responseWarehouse,
  };
  const statusLabel = (status: (typeof stages)[number]) =>
    dictionary.confirmations.overview.stages[stageKeys[stages.indexOf(status)]];

  const restoreLocation = useEffectEvent(() => {
    const params = new URLSearchParams(
      window.location.hash.replace(/^#confirmations\??/, "")
    );
    const nextView = params.get("view") as ConfirmationCenterView;
    onViewChange(Object.hasOwn(titles, nextView) ? nextView : "ALL");
    onQueryChange(params.get("q") ?? "");
    const projectId = params.get("project");
    const projectName = params.get("name");
    const status = params.get("status") as (typeof stages)[number];
    onSelectionChange(
      projectId
        ? {
            projectId,
            projectName: projectName || projectId,
            kind:
              params.get("scope") === "own"
                ? "own"
                : stages.includes(status)
                  ? "status"
                  : "all",
            ...(stages.includes(status) ? { status } : {}),
          }
        : null
    );
  });
  useEffect(() => {
    const restore = () => restoreLocation();
    if (window.location.hash.startsWith("#confirmations")) {
      restore();
    }
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  function navigate(
    nextView: ConfirmationCenterView,
    nextSelection: ConfirmationMobileSelection | null,
    replace = false
  ) {
    if (!selection) {
      savedScroll.current = contentRef.current?.scrollTop ?? 0;
    }
    const params = new URLSearchParams({ view: nextView });
    if (query) {
      params.set("q", query);
    }
    if (nextSelection) {
      params.set("project", nextSelection.projectId);
      params.set("name", nextSelection.projectName);
      params.set("scope", nextSelection.kind);
      if (nextSelection.status) {
        params.set("status", nextSelection.status);
      }
    }
    const sameProject = Boolean(
      selection && nextSelection?.projectId === selection.projectId
    );
    const replaceEntry = replace || sameProject;
    const depth = Number(window.history.state?.confirmationMobileDepth) || 0;
    const state = {
      ...window.history.state,
      confirmationMobileDepth: depth + (replaceEntry ? 0 : 1),
    };
    const url = `${window.location.pathname}${window.location.search}#confirmations?${params}`;
    if (replaceEntry) {
      window.history.replaceState(state, "", url);
    } else {
      window.history.pushState(state, "", url);
    }
    onViewChange(nextView);
    onSelectionChange(nextSelection);
  }
  function back() {
    if (selection || view !== "ALL") {
      if (Number(window.history.state?.confirmationMobileDepth) > 0) {
        window.history.back();
      } else {
        navigate("ALL", null, true);
      }
    } else {
      onLeave();
    }
  }
  const locationKey = `${view}:${selection?.projectId ?? ""}`;
  useLayoutEffect(() => {
    if (previousLocation.current === locationKey) {
      return;
    }
    previousLocation.current = locationKey;
    if (contentRef.current) {
      contentRef.current.scrollTop = selection ? 0 : savedScroll.current;
    }
    headingRef.current?.querySelector("h1")?.setAttribute("tabindex", "-1");
    headingRef.current?.querySelector("h1")?.focus({ preventScroll: true });
  }, [locationKey, selection]);

  const busy = selection ? detailsLoading : loading;
  const failed = selection ? detailsError : error;
  return (
    <div
      className={styles.root}
      data-testid="confirmation-center-mobile"
      ref={(node) => {
        headingRef.current = node;
        mobileSurfaceRef.current = node;
      }}
    >
      <MobileScaffold
        label={copy.title}
        contentRef={contentRef}
        header={
          <MobilePageHeader
            title={
              selection?.projectName ??
              (view === "ALL" ? copy.title : titles[view])
            }
            context={selection ? copy.title : undefined}
            back={{
              label: mobileCopy.back,
              href: "#confirmations?view=ALL",
              onBack: back,
            }}
            action={headerActions}
          />
        }
      >
        {view === "ALL" ? (
          <div className={styles.content}>
            <div className={styles.toolbar}>
              {selection ? (
                <ViewSwitcher
                  mobilePresentation="sheet"
                  label={copy.confirmationProgress}
                  value={
                    selection.kind === "status"
                      ? (selection.status ?? "all")
                      : selection.kind
                  }
                  onValueChange={(value) =>
                    navigate("ALL", {
                      ...selection,
                      kind:
                        value === "own"
                          ? "own"
                          : value === "all"
                            ? "all"
                            : "status",
                      status: stages.includes(value as (typeof stages)[number])
                        ? (value as (typeof stages)[number])
                        : undefined,
                    })
                  }
                  options={[
                    { value: "all", label: copy.allConfirmations },
                    { value: "own", label: copy.myCreated },
                    ...stages.map((status) => ({
                      value: status,
                      label: statusLabel(status),
                    })),
                  ]}
                />
              ) : (
                <ViewSwitcher
                  mobilePresentation="sheet"
                  label={copy.navigationLabel}
                  value={view}
                  onValueChange={(value) =>
                    navigate(value as ConfirmationCenterView, null)
                  }
                  options={Object.entries(titles).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              )}
              {selection ? null : (
                <Button
                  variant="quiet"
                  size="icon"
                  aria-label={copy.sortBy}
                  onClick={() => setSortOpen(true)}
                >
                  <ArrowUpDown />
                </Button>
              )}
            </div>
            {selection ? null : (
              <Input
                type="search"
                aria-label={copy.searchPlaceholder}
                placeholder={copy.searchPlaceholder}
                value={query}
                onChange={(event) => {
                  onQueryChange(event.target.value);
                  setCount(30);
                }}
              />
            )}
            {busy || failed ? (
              <CollectionState
                kind={failed ? "error" : "loading"}
                locale={mobileCopy.locale}
                onRetry={selection ? onRetryDetails : onRetry}
              />
            ) : selection ? (
              rows.length ? (
                <div className={styles.list}>
                  {rows.map((row) => (
                    <MobileListItem
                      key={row.id}
                      title={row.counterpartyName}
                      description={row.confirmationCode ?? undefined}
                      icon={<FileText />}
                      href={`/${locale}/engagement/${row.projectId}?workspace=confirmations&confirmationId=${encodeURIComponent(row.id)}&returnTo=${encodeURIComponent(`/confirmations${typeof window === "undefined" ? "" : window.location.hash}`)}`}
                      onNavigate={(event) => {
                        if (
                          event.ctrlKey ||
                          event.metaKey ||
                          event.shiftKey ||
                          event.altKey
                        ) {
                          return;
                        }
                        event.preventDefault();
                        onOpen(row);
                      }}
                      meta={
                        <span className={styles.meta}>
                          <span className={styles.status}>
                            {stages.includes(
                              row.status as (typeof stages)[number]
                            )
                              ? statusLabel(
                                  row.status as (typeof stages)[number]
                                )
                              : row.status}
                          </span>
                          <span>{row.updatedAt?.slice(0, 10)}</span>
                          <span>
                            {row.responsibleUser?.name ??
                              dictionary.confirmations.register.ownerPending}
                          </span>
                        </span>
                      }
                    />
                  ))}
                </div>
              ) : (
                <CollectionState kind="empty" locale={mobileCopy.locale} />
              )
            ) : summaries.length ? (
              <div className={styles.list}>
                {summaries.slice(0, count).map((project) => (
                  <article className={styles.project} key={project.projectId}>
                    <MobileListItem
                      title={project.projectName}
                      description={project.projectCode}
                      icon={<BriefcaseBusiness />}
                      href={`#confirmations?project=${encodeURIComponent(project.projectId)}`}
                      onNavigate={(event) => {
                        event.preventDefault();
                        navigate("ALL", {
                          projectId: project.projectId,
                          projectName: project.projectName,
                          kind: "all",
                        });
                      }}
                      meta={
                        <span>
                          {copy.reportDate} ·{" "}
                          {project.reportDate?.slice(0, 10) ||
                            copy.noReportDate}
                        </span>
                      }
                    />
                    <div
                      className={styles.progress}
                      aria-label={`${project.projectName} · ${copy.confirmationProgress}`}
                    >
                      {stages.map((status) => (
                        <Button
                          key={status}
                          variant="quiet"
                          size="sm"
                          aria-label={`${project.projectName} · ${statusLabel(status)} ${project.statusCounts[status]}`}
                          onClick={() =>
                            navigate("ALL", {
                              projectId: project.projectId,
                              projectName: project.projectName,
                              kind: "status",
                              status,
                            })
                          }
                        >
                          <span>{statusLabel(status)}</span>
                          <strong>{project.statusCounts[status]}</strong>
                        </Button>
                      ))}
                    </div>
                  </article>
                ))}
                {count < summaries.length ? (
                  <Button
                    variant="quiet"
                    fullWidth
                    onClick={() => setCount((value) => value + 30)}
                  >
                    {locale === "zh-CN" ? "显示更多项目" : "Show more projects"}
                  </Button>
                ) : null}
              </div>
            ) : (
              <CollectionState
                kind={query ? "filtered" : "empty"}
                title={query ? copy.noSearchResults : copy.emptyTitle}
                locale={mobileCopy.locale}
              />
            )}
          </div>
        ) : (
          <div className={styles.library}>{library}</div>
        )}
      </MobileScaffold>
      <MobileActionSheet
        open={sortOpen}
        onOpenChange={setSortOpen}
        title={copy.sortBy}
        closeLabel={mobileCopy.close}
      >
        <div className={styles.sortOptions}>
          {(
            [
              ["REPORT_DATE_ASC", copy.sortOptions.reportDateAscending],
              ["REPORT_DATE_DESC", copy.sortOptions.reportDateDescending],
              ["AWAITING_RESPONSE_DESC", copy.sortOptions.awaitingResponse],
              ["PROJECT_NAME_ASC", copy.sortOptions.projectName],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={sort === value ? "secondary" : "quiet"}
              aria-pressed={sort === value}
              onClick={() => {
                onSortChange(value);
                setSortOpen(false);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </MobileActionSheet>
    </div>
  );
}
