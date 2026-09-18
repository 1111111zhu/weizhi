"use client";

import type { ConfirmationStatus } from "@project-wing/shared";
import {
  CollectionState,
  ViewSwitcher,
  DataGridColumnHeader,
  ProjectWingMasterDataGrid,
  ProjectWingTopBarBrand,
  ProjectWingTopBarReturnAction,
  useProjectWingActionHistory,
  useCompactViewport,
} from "@project-wing/ui";
import type { ProjectWingMasterDataGridProps } from "@project-wing/ui";
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  BookOpenCheck,
  ClipboardList,
  FileText,
  Landmark,
  Library,
  Search,
  Truck,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { AccessibleName } from "@/components/ui/accessible-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { api } from "../api/client";
import { fetchConfirmationWorkspaceSummary } from "../api/confirmation-workspace";
import type { ConfirmationWorkspaceSummary } from "../api/confirmation-workspace";
import { ConfirmationResponseWarehouse as ResponseWarehouseWorkspace } from "../components/confirmation-response-warehouse";
import { ConfirmationCenterMobile } from "../components/confirmations/confirmation-center-mobile";
import { ConfirmationInformationLibrary } from "../components/confirmations/confirmation-information-library";
import { LogisticsUnreadDot } from "../components/confirmations/confirmation-logistics-unread";
import { ConfirmationDetailPane } from "../components/confirmations/confirmation-status-overview";
import { EmpRouteTopBar } from "../components/emp-persistent-top-bar";
import { ConfirmationTemplateLibrary } from "../components/project-confirmations-panel";
import {
  EmpPortalAction,
  EmpTopBarControls,
  getIntranetPortalUrl,
} from "../components/project-wing-top-bar-controls";
import { SplitterRail } from "../components/splitter-rail";
import { useI18n } from "../i18n/client";
import { canAccessAdmin } from "../lib/access-control";
import { getEmpActionLabel } from "../lib/emp-action-history";
import type { EmpActionHistoryEntry } from "../lib/emp-action-history";
import { PROJECT_PAGE_SHELL_CLASS } from "../lib/project-layout";
import { useSurfaceTransition } from "../lib/use-surface-transition";

import surfaceMotion from "../components/confirmations/confirmation-surface-motion.module.css";
import styles from "./confirmations.module.css";

const PROGRESS_STATUSES: Exclude<ConfirmationStatus, "VOIDED">[] = [
  "DRAFT",
  "PREPARED",
  "AWAITING_RESPONSE",
  "RESPONSE_RECEIVED",
  "CLOSED",
];
const EMPTY_CONFIRMATION_SUMMARIES: ConfirmationWorkspaceSummary[] = [];

const PROGRESS_LABEL_KEYS = [
  "draft",
  "prepared",
  "sent",
  "received",
  "completed",
] as const;
const CONFIRMATION_NAV_DEFAULT_WIDTH = 256;
const CONFIRMATION_NAV_DRAG_COLLAPSE_THRESHOLD = 48;
const CONFIRMATION_NAV_DRAG_EXPAND_THRESHOLD = 48;
const CONFIRMATION_NAV_MAX_WIDTH = 320;
const CONFIRMATION_NAV_MIN_WIDTH = 184;
const CONFIRMATION_NAV_WIDTH_STEP = 8;
const CONFIRMATION_NAV_WIDTH_CLASSES: Record<number, string> = {
  184: styles.navigationWidth184,
  192: styles.navigationWidth192,
  200: styles.navigationWidth200,
  208: styles.navigationWidth208,
  216: styles.navigationWidth216,
  224: styles.navigationWidth224,
  232: styles.navigationWidth232,
  240: styles.navigationWidth240,
  248: styles.navigationWidth248,
  256: styles.navigationWidth256,
  264: styles.navigationWidth264,
  272: styles.navigationWidth272,
  280: styles.navigationWidth280,
  288: styles.navigationWidth288,
  296: styles.navigationWidth296,
  304: styles.navigationWidth304,
  312: styles.navigationWidth312,
  320: styles.navigationWidth320,
};

function snapConfirmationNavigationWidth(width: number) {
  const boundedWidth = Math.max(
    CONFIRMATION_NAV_MIN_WIDTH,
    Math.min(CONFIRMATION_NAV_MAX_WIDTH, width)
  );
  return (
    Math.round(
      (boundedWidth - CONFIRMATION_NAV_MIN_WIDTH) / CONFIRMATION_NAV_WIDTH_STEP
    ) *
      CONFIRMATION_NAV_WIDTH_STEP +
    CONFIRMATION_NAV_MIN_WIDTH
  );
}

function getConfirmationNavigationWidthClass(width: number) {
  return CONFIRMATION_NAV_WIDTH_CLASSES[snapConfirmationNavigationWidth(width)];
}

type SortOption =
  | "REPORT_DATE_ASC"
  | "REPORT_DATE_DESC"
  | "PROJECT_NAME_ASC"
  | "AWAITING_RESPONSE_DESC";

type ConfirmationCenterView = "ALL" | "TEMPLATES" | "INFORMATION" | "RESPONSES";

type ConfirmationDetailSelection = {
  projectId: string;
  projectName: string;
  kind: "status" | "all" | "own";
  status?: Exclude<ConfirmationStatus, "VOIDED">;
};

export function ConfirmationsPage() {
  const { dictionary, localizedPath, locale } = useI18n();
  const mobile = useCompactViewport(767.98);
  const router = useRouter();
  const actionHistory = useProjectWingActionHistory<EmpActionHistoryEntry>({
    current: {
      id: "confirmation-center",
      href: localizedPath("/confirmations"),
    },
    storageKey: "project-wing:emp:action-history",
  });
  const copy = dictionary.confirmationCenter.intranet;
  const workspace = useQuery({
    queryKey: ["confirmation-workspace-summary"],
    queryFn: fetchConfirmationWorkspaceSummary,
  });
  const [projectQuery, setProjectQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("REPORT_DATE_ASC");
  const [activeView, setActiveView] = useState<ConfirmationCenterView>("ALL");
  const [detailSelection, setDetailSelection] =
    useState<ConfirmationDetailSelection | null>(null);
  const confirmationCenterSurfaceRef = useSurfaceTransition<HTMLElement>(
    `center:${activeView}:${workspace.isLoading ? "loading" : "ready"}:${detailSelection?.projectId ?? ""}:${detailSelection?.kind ?? ""}:${detailSelection?.status ?? ""}`,
    {
      initial: true,
      variant: "content",
    }
  );
  const [confirmationNavigationWidth, setConfirmationNavigationWidth] =
    useState(CONFIRMATION_NAV_DEFAULT_WIDTH);
  const [
    isConfirmationNavigationCollapsed,
    setIsConfirmationNavigationCollapsed,
  ] = useState(false);
  const confirmationNavigationResizeSessionRef = useRef<{
    previousWidth: number;
    startWidth: number;
    wasCollapsed: boolean;
    currentWidth: number;
    restoreWidth: number;
  } | null>(null);
  const [confirmationNavigationDragWidth, setConfirmationNavigationDragWidth] =
    useState<number | null>(null);
  const [
    confirmationNavigationDragPreviewExpanded,
    setConfirmationNavigationDragPreviewExpanded,
  ] = useState(false);
  const currentUser = useQuery({
    queryKey: ["account", "me"],
    queryFn: api.me,
  });
  const responseWarehouse = useQuery({
    queryKey: ["confirmation-response-library"],
    queryFn: api.confirmationResponseLibrary,
  });
  const confirmationDetails = useQuery({
    queryKey: ["confirmations", "office"],
    queryFn: api.confirmations,
    enabled: Boolean(detailSelection),
  });
  const summaries = workspace.data ?? EMPTY_CONFIRMATION_SUMMARIES;
  const visibleSummaries = useMemo(() => {
    const normalizedQuery = projectQuery.trim().toLocaleLowerCase(locale);
    const filtered = normalizedQuery
      ? summaries.filter((summary) =>
          [summary.projectName, summary.projectCode].some((value) =>
            value.toLocaleLowerCase(locale).includes(normalizedQuery)
          )
        )
      : summaries;

    return [...filtered].sort((left, right) => {
      if (sort === "PROJECT_NAME_ASC") {
        return left.projectName.localeCompare(right.projectName, locale);
      }
      if (sort === "AWAITING_RESPONSE_DESC") {
        return (
          right.awaitingResponseCount - left.awaitingResponseCount ||
          compareReportDates(left.reportDate, right.reportDate)
        );
      }
      return compareReportDates(
        left.reportDate,
        right.reportDate,
        sort === "REPORT_DATE_DESC" ? "desc" : "asc"
      );
    });
  }, [locale, projectQuery, sort, summaries]);
  const confirmationGridColumns = useMemo<
    ProjectWingMasterDataGridProps<ConfirmationWorkspaceSummary>["columns"]
  >(
    () => [
      {
        id: "project",
        accessorFn: (summary) => summary.projectName,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={copy.project} />
        ),
        cell: ({ row }) => {
          const summary = row.original;
          const href = localizedPath(
            `/engagement/${summary.projectId}?workspace=confirmations&returnTo=${encodeURIComponent("/confirmations")}`
          );
          return (
            <AccessibleName
              label={`${copy.openProject}: ${summary.projectName}`}
            >
              <Link
                href={href}
                className="group grid gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid min-w-0 gap-1">
                  <span className="min-w-0 font-semibold break-words whitespace-normal group-hover:text-primary">
                    {summary.projectName}
                    <span className="ml-2 inline-flex align-middle">
                      <LogisticsUnreadDot projectId={summary.projectId} />
                    </span>
                  </span>
                  <span className="font-mono text-xs break-all text-muted-foreground">
                    {summary.projectCode}
                  </span>
                </span>
              </Link>
            </AccessibleName>
          );
        },
        meta: {
          autoSize: true,
          headerTitle: copy.project,
          cellClassName: "overflow-visible whitespace-normal text-clip",
        },
        minSize: 220,
        size: 300,
      },
      {
        id: "reportTimeline",
        accessorFn: (summary) => summary.reportDate ?? "",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={copy.reportDate} />
        ),
        cell: ({ row }) => (
          <ReportTimeline
            reportDate={row.original.reportDate}
            copy={copy}
            locale={locale}
          />
        ),
        meta: {
          autoSize: true,
          headerTitle: copy.reportDate,
          cellClassName: "overflow-visible whitespace-normal text-clip",
        },
        minSize: 180,
        size: 220,
      },
      {
        id: "confirmationProgress",
        accessorFn: (summary) => summary.awaitingResponseCount,
        header: () => (
          <ConfirmationProgressLabels copy={dictionary.confirmations} />
        ),
        cell: ({ row }) => (
          <ConfirmationProgress
            counts={row.original.statusCounts}
            copy={dictionary.confirmations}
            label={copy.confirmationProgress}
            onStatusSelect={(status) =>
              setDetailSelection({
                projectId: row.original.projectId,
                projectName: row.original.projectName,
                kind: "status",
                status,
              })
            }
          />
        ),
        enableSorting: false,
        meta: {
          autoSize: true,
          headerTitle: PROGRESS_STATUSES.map((status) =>
            getProgressStageLabel(dictionary.confirmations, status)
          ).join(" "),
          cellClassName: "overflow-visible whitespace-normal text-clip",
        },
        minSize: 320,
        size: 420,
      },
      {
        id: "allConfirmations",
        accessorFn: (summary) =>
          summary.totalConfirmationCount - (summary.statusCounts.VOIDED ?? 0),
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={copy.allConfirmations} />
        ),
        cell: ({ row, getValue }) => (
          <Button
            type="button"
            variant="ghost"
            className="h-8 min-w-8 px-2 font-semibold tabular-nums"
            aria-label={`${copy.allConfirmations}: ${row.original.projectName}`}
            onClick={() =>
              setDetailSelection({
                projectId: row.original.projectId,
                projectName: row.original.projectName,
                kind: "all",
              })
            }
          >
            {String(getValue() ?? 0)}
          </Button>
        ),
        meta: { autoSize: true, headerTitle: copy.allConfirmations },
        minSize: 108,
        size: 108,
      },
      {
        id: "myCreated",
        accessorFn: (summary) => summary.ownConfirmationCount,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={copy.myCreated} />
        ),
        cell: ({ row, getValue }) => (
          <Button
            type="button"
            variant="ghost"
            className="h-8 min-w-8 px-2 font-semibold tabular-nums"
            aria-label={`${copy.myCreated}: ${row.original.projectName}`}
            onClick={() =>
              setDetailSelection({
                projectId: row.original.projectId,
                projectName: row.original.projectName,
                kind: "own",
              })
            }
          >
            {String(getValue() ?? 0)}
          </Button>
        ),
        meta: { autoSize: true, headerTitle: copy.myCreated },
        minSize: 96,
        size: 96,
      },
    ],
    [copy, dictionary.confirmations, locale, localizedPath]
  );
  const detailRows = useMemo(
    () =>
      (confirmationDetails.data ?? []).filter((confirmation) => {
        if (
          !detailSelection ||
          confirmation.projectId !== detailSelection.projectId ||
          confirmation.status === "VOIDED"
        ) {
          return false;
        }
        if (detailSelection.kind === "status") {
          return confirmation.status === detailSelection.status;
        }
        if (detailSelection.kind === "own") {
          return confirmation.createdBy === currentUser.data?.id;
        }
        return true;
      }),
    [confirmationDetails.data, currentUser.data?.id, detailSelection]
  );
  const detailTitle = detailSelection
    ? copy.detailTitle
        .replace("{project}", detailSelection.projectName)
        .replace(
          "{selection}",
          getDetailSelectionLabel(
            detailSelection,
            copy,
            dictionary.confirmations
          )
        )
    : "";
  const canAccessSystemAdmin = canAccessAdmin(currentUser.data);
  const desktopCopy = dictionary.desktop;
  const topBarActionItems = [
    {
      id: "confirmation-center",
      label:
        dictionary.confirmationCenter?.intranet?.shortcut ??
        dictionary.confirmations?.shortcutLabel ??
        "Confirmation",
      icon: <Truck />,
      active: true,
      onClick: () => router.push(localizedPath("/confirmations")),
    },
    ...(canAccessSystemAdmin
      ? [
          {
            id: "project-templates",
            label: desktopCopy.apps.templates,
            icon: <BookOpenCheck />,
            onClick: () =>
              router.push(localizedPath("/engagement?templateLibrary=1")),
          },
          {
            id: "smart-forms",
            label: desktopCopy.apps.smartForms,
            icon: <ClipboardList />,
            onClick: () =>
              router.push(localizedPath("/engagement?smartForms=1")),
          },
          {
            id: "user-management",
            label: dictionary.common.userManagement ?? "User management",
            icon: <UserCog />,
            onClick: () => router.push(localizedPath("/admin/users")),
          },
        ]
      : []),
  ];

  function handleConfirmationNavigationResizeStart(
    event: React.PointerEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    event.stopPropagation();
    const wasCollapsed = isConfirmationNavigationCollapsed;
    const startWidth = wasCollapsed ? 0 : confirmationNavigationWidth;
    confirmationNavigationResizeSessionRef.current = {
      previousWidth: confirmationNavigationWidth,
      startWidth,
      wasCollapsed,
      currentWidth: startWidth,
      restoreWidth: wasCollapsed ? 0 : confirmationNavigationWidth,
    };
    setConfirmationNavigationDragWidth(startWidth);
    setConfirmationNavigationDragPreviewExpanded(false);
  }

  function handleConfirmationNavigationResize(deltaX: number) {
    const session = confirmationNavigationResizeSessionRef.current;
    if (!session) {
      return;
    }

    const nextWidth = Math.max(
      0,
      Math.min(CONFIRMATION_NAV_MAX_WIDTH, session.startWidth + deltaX)
    );
    session.currentWidth = nextWidth;
    if (nextWidth >= CONFIRMATION_NAV_MIN_WIDTH) {
      session.restoreWidth = snapConfirmationNavigationWidth(nextWidth);
    }
    setConfirmationNavigationDragWidth(nextWidth);
    setConfirmationNavigationDragPreviewExpanded(
      session.wasCollapsed &&
        nextWidth >= CONFIRMATION_NAV_DRAG_EXPAND_THRESHOLD
    );
  }

  function handleConfirmationNavigationResizeCancel() {
    const session = confirmationNavigationResizeSessionRef.current;
    if (!session) {
      return;
    }

    setConfirmationNavigationWidth(session.previousWidth);
    setIsConfirmationNavigationCollapsed(session.wasCollapsed);
    setConfirmationNavigationDragWidth(null);
    setConfirmationNavigationDragPreviewExpanded(false);
    confirmationNavigationResizeSessionRef.current = null;
  }

  function handleConfirmationNavigationResizeEnd() {
    const session = confirmationNavigationResizeSessionRef.current;
    if (!session) {
      return;
    }

    const shouldCollapse = session.wasCollapsed
      ? session.currentWidth < CONFIRMATION_NAV_DRAG_EXPAND_THRESHOLD
      : session.currentWidth < CONFIRMATION_NAV_DRAG_COLLAPSE_THRESHOLD;
    const nextWidth = shouldCollapse
      ? session.restoreWidth
      : snapConfirmationNavigationWidth(session.currentWidth);

    if (shouldCollapse && session.restoreWidth >= CONFIRMATION_NAV_MIN_WIDTH) {
      setConfirmationNavigationWidth(session.restoreWidth);
    } else if (!shouldCollapse) {
      setConfirmationNavigationWidth(nextWidth);
    }
    setIsConfirmationNavigationCollapsed(shouldCollapse);
    setConfirmationNavigationDragWidth(null);
    setConfirmationNavigationDragPreviewExpanded(false);
    confirmationNavigationResizeSessionRef.current = null;
  }

  function toggleConfirmationNavigation() {
    confirmationNavigationResizeSessionRef.current = null;
    setConfirmationNavigationDragWidth(null);
    setConfirmationNavigationDragPreviewExpanded(false);
    setIsConfirmationNavigationCollapsed((collapsed) => !collapsed);
  }

  const confirmationNavigationExpanded =
    !isConfirmationNavigationCollapsed ||
    confirmationNavigationDragPreviewExpanded;
  const visibleConfirmationNavigationWidth =
    confirmationNavigationDragWidth ??
    (isConfirmationNavigationCollapsed ? 0 : confirmationNavigationWidth);
  const confirmationGridSearch = (
    <InputGroup className="max-w-md min-w-64 flex-1">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={copy.searchPlaceholder}
        placeholder={copy.searchPlaceholder}
        value={projectQuery}
        onChange={(event) => setProjectQuery(event.target.value)}
      />
    </InputGroup>
  );

  const confirmationGridActions = (
    <div className="flex min-w-0 items-center gap-2">
      <Select
        value={sort}
        onValueChange={(value) => setSort(value as SortOption)}
      >
        <SelectTrigger aria-label={copy.sortBy} className="min-w-48">
          <SelectValue>{getSortLabel(copy, sort)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="REPORT_DATE_ASC">
            {copy.sortOptions.reportDateAscending}
          </SelectItem>
          <SelectItem value="REPORT_DATE_DESC">
            {copy.sortOptions.reportDateDescending}
          </SelectItem>
          <SelectItem value="AWAITING_RESPONSE_DESC">
            {copy.sortOptions.awaitingResponse}
          </SelectItem>
          <SelectItem value="PROJECT_NAME_ASC">
            {copy.sortOptions.projectName}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  if (mobile) {
    return (
      <ConfirmationCenterMobile
        dictionary={dictionary}
        locale={locale}
        view={activeView}
        onViewChange={setActiveView}
        selection={detailSelection}
        onSelectionChange={setDetailSelection}
        summaries={visibleSummaries}
        rows={detailRows}
        query={projectQuery}
        onQueryChange={setProjectQuery}
        sort={sort}
        onSortChange={setSort}
        loading={workspace.isLoading}
        error={workspace.isError}
        onRetry={() => {
          void workspace.refetch();
        }}
        detailsLoading={confirmationDetails.isLoading}
        detailsError={confirmationDetails.isError}
        onRetryDetails={() => {
          void confirmationDetails.refetch();
        }}
        onOpen={(confirmation) =>
          router.push(
            localizedPath(
              `/engagement/${confirmation.projectId}?workspace=confirmations&confirmationId=${encodeURIComponent(confirmation.id)}&returnTo=${encodeURIComponent(`/confirmations${window.location.hash}`)}`
            )
          )
        }
        onLeave={() => {
          if (actionHistory.returnTarget) {
            actionHistory.returnToPrevious((entry) => router.push(entry.href));
          } else {
            window.location.assign(getIntranetPortalUrl());
          }
        }}
        headerActions={<EmpTopBarControls actionItems={topBarActionItems} />}
        library={
          activeView === "TEMPLATES" ? (
            <ConfirmationTemplateLibrary
              copy={dictionary.confirmations}
              commonCopy={dictionary.common}
              currentUser={currentUser.data}
              locale={locale}
            />
          ) : activeView === "INFORMATION" ? (
            <ConfirmationInformationLibrary
              accessCopy={copy.informationLibrary.access}
              canManage={currentUser.data?.globalRole === "SUPER_ADMIN"}
              copy={copy.informationLibrary}
              locale={locale}
            />
          ) : activeView === "RESPONSES" ? (
            <ResponseWarehouseWorkspace
              cancelLabel={dictionary.common.cancel}
              copy={copy.responseWarehouseWorkspace}
              currentUserId={currentUser.data?.id}
              currentUserGlobalRole={currentUser.data?.globalRole}
              locale={locale}
            />
          ) : null
        }
      />
    );
  }

  return (
    <div className={PROJECT_PAGE_SHELL_CLASS}>
      <EmpRouteTopBar
        centerOnMobile
        leading={
          <div className="project-wing-top-bar-context">
            <ProjectWingTopBarBrand />
            {actionHistory.returnTarget ? (
              <ProjectWingTopBarReturnAction
                label={`${dictionary.common.backTo ?? "Back to"} ${getEmpActionLabel(actionHistory.returnTarget.id, dictionary)}`}
                onClick={() =>
                  actionHistory.returnToPrevious((entry) =>
                    router.push(entry.href)
                  )
                }
              />
            ) : (
              <ProjectWingTopBarReturnAction
                label={`${dictionary.common.backTo ?? "Back to"} Intranet`}
                onClick={() => window.location.assign(getIntranetPortalUrl())}
              />
            )}
            <EmpPortalAction />
          </div>
        }
        actions={
          <EmpTopBarControls
            key="emp-navigation"
            actionItems={topBarActionItems}
          />
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-muted/20 p-3 lg:flex-row lg:gap-0">
        <div className="shrink-0 lg:hidden">
          <ViewSwitcher
            label={copy.navigationLabel}
            value={activeView}
            onValueChange={(value) => {
              setActiveView(value as ConfirmationCenterView);
              setDetailSelection(null);
            }}
            options={[
              {
                value: "ALL",
                label: copy.allConfirmations,
                icon: <FileText />,
                count: summaries.reduce(
                  (total, summary) => total + summary.totalConfirmationCount,
                  0
                ),
              },
              {
                value: "TEMPLATES",
                label: copy.templateLibrary,
                icon: <Library />,
              },
              {
                value: "INFORMATION",
                label: copy.informationLibrary.title,
                icon: <Landmark />,
              },
              {
                value: "RESPONSES",
                label: copy.responseWarehouse,
                icon: <Archive />,
                count: responseWarehouse.data?.length ?? 0,
              },
            ]}
          />
        </div>
        <aside
          aria-hidden={!confirmationNavigationExpanded}
          data-navigation-width={
            confirmationNavigationExpanded
              ? snapConfirmationNavigationWidth(
                  visibleConfirmationNavigationWidth
                )
              : 0
          }
          className={cn(
            "hidden h-full min-w-0 shrink-0 overflow-hidden rounded-xl border border-border bg-card px-3 py-4 shadow-sm lg:block",
            styles.navigationPanel,
            confirmationNavigationDragWidth !== null && "transition-none",
            confirmationNavigationExpanded
              ? getConfirmationNavigationWidthClass(
                  visibleConfirmationNavigationWidth
                )
              : "w-0 pointer-events-none border-transparent bg-transparent p-0 opacity-0"
          )}
          inert={confirmationNavigationExpanded ? undefined : true}
        >
          <nav className="grid gap-1" aria-label={copy.navigationLabel}>
            <ButtonGroup
              orientation="vertical"
              className="w-full gap-1"
              label={copy.navigationLabel}
            >
              <Button
                type="button"
                variant="ghost"
                data-active={activeView === "ALL"}
                className={cn(
                  surfaceMotion.navItem,
                  "h-10 justify-start px-3",
                  activeView === "ALL" &&
                    "bg-success-subtle text-success-text hover:bg-success/15"
                )}
                onClick={() => {
                  setActiveView("ALL");
                  setDetailSelection(null);
                }}
              >
                <FileText />
                <span className="flex-1 text-left">
                  {copy.allConfirmations}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {summaries.reduce(
                    (total, summary) => total + summary.totalConfirmationCount,
                    0
                  )}
                </span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                data-active={activeView === "TEMPLATES"}
                className={cn(
                  surfaceMotion.navItem,
                  "h-10 justify-start px-3",
                  activeView === "TEMPLATES" &&
                    "bg-success-subtle text-success-text hover:bg-success/15"
                )}
                onClick={() => {
                  setActiveView("TEMPLATES");
                  setDetailSelection(null);
                }}
              >
                <Library />
                <span className="flex-1 text-left">{copy.templateLibrary}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                data-active={activeView === "INFORMATION"}
                className={cn(
                  surfaceMotion.navItem,
                  "h-10 justify-start px-3",
                  activeView === "INFORMATION" &&
                    "bg-success-subtle text-success-text hover:bg-success/15"
                )}
                onClick={() => {
                  setActiveView("INFORMATION");
                  setDetailSelection(null);
                }}
              >
                <Landmark />
                <span className="flex-1 text-left">
                  {copy.informationLibrary.title}
                </span>
              </Button>
              <Button
                type="button"
                aria-label={copy.responseWarehouse}
                variant="ghost"
                data-active={activeView === "RESPONSES"}
                className={cn(
                  surfaceMotion.navItem,
                  "h-10 justify-start px-3",
                  activeView === "RESPONSES" &&
                    "bg-success-subtle text-success-text hover:bg-success/15"
                )}
                onClick={() => {
                  setActiveView("RESPONSES");
                  setDetailSelection(null);
                }}
              >
                <Archive />
                <span className="flex-1 text-left">
                  {copy.responseWarehouse}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {responseWarehouse.data?.length ?? 0}
                </span>
              </Button>
            </ButtonGroup>
          </nav>
        </aside>

        <div className="hidden shrink-0 lg:flex">
          <SplitterRail
            expanded={
              !isConfirmationNavigationCollapsed ||
              confirmationNavigationDragPreviewExpanded
            }
            hitAreaTestId="confirmation-navigation-splitter-hit-area"
            label={copy.navigationLabel}
            max={CONFIRMATION_NAV_MAX_WIDTH}
            min={CONFIRMATION_NAV_MIN_WIDTH}
            onDrag={handleConfirmationNavigationResize}
            onDragCancel={handleConfirmationNavigationResizeCancel}
            onDragEnd={handleConfirmationNavigationResizeEnd}
            onPointerDown={handleConfirmationNavigationResizeStart}
            onToggle={toggleConfirmationNavigation}
            value={Math.round(visibleConfirmationNavigationWidth)}
          />
        </div>

        <main
          ref={confirmationCenterSurfaceRef}
          className={cn(
            "min-h-0 min-w-0 flex-1 rounded-xl border border-border bg-card shadow-sm",
            activeView === "INFORMATION" ? "overflow-hidden" : "overflow-y-auto"
          )}
        >
          {activeView === "ALL" ? (
            <section className="flex h-full min-h-0 min-w-0 overflow-hidden bg-card">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <ProjectWingMasterDataGrid
                  locale={locale}
                  actions={confirmationGridActions}
                  columns={confirmationGridColumns}
                  data={visibleSummaries}
                  showRecordCount={!workspace.isLoading && !workspace.isError}
                  content={
                    workspace.isLoading ? (
                      <CollectionState kind="loading" locale={locale} />
                    ) : workspace.isError ? (
                      <CollectionState
                        kind="error"
                        locale={locale}
                        title={copy.loadError}
                        onRetry={() => {
                          void workspace.refetch();
                        }}
                      />
                    ) : undefined
                  }
                  emptyMessage={
                    summaries.length > 0
                      ? `${copy.noSearchResults} ${copy.noSearchResultsDescription}`
                      : `${copy.emptyTitle} ${copy.emptyDescription}`
                  }
                  getRowId={(summary) => summary.projectId}
                  overflowLabel={dictionary.common.moreActions}
                  paginationPageSize={
                    workspace.isLoading || workspace.isError ? undefined : 30
                  }
                  paginationPageSizeLabel={copy.rowsPerPage}
                  paginationPageSizeOptionSuffix={copy.rowsPerPageSuffix}
                  paginationPageSizeOptions={[30, 40, 50]}
                  paginationResetKey={`${projectQuery}:${sort}`}
                  persistentActions={confirmationGridSearch}
                  tableLabel={copy.title}
                  testId="confirmation-center-project-data-grid"
                  title={copy.project}
                />
              </div>
              {detailSelection ? (
                <ConfirmationDetailPane
                  key={`${detailSelection.projectId}:${detailTitle}`}
                  title={detailTitle}
                  confirmations={detailRows}
                  copy={dictionary.confirmations}
                  locale={locale}
                  minWidth={520}
                  defaultWidth={720}
                  maxWidth={960}
                  mainMinWidth={560}
                  isLoading={confirmationDetails.isLoading}
                  onClose={() => setDetailSelection(null)}
                  onOpen={(confirmation) =>
                    router.push(
                      localizedPath(
                        `/engagement/${confirmation.projectId}?workspace=confirmations&confirmationId=${encodeURIComponent(confirmation.id)}&returnTo=${encodeURIComponent("/confirmations")}`
                      )
                    )
                  }
                />
              ) : null}
            </section>
          ) : activeView === "TEMPLATES" ? (
            <ConfirmationTemplateLibrary
              copy={dictionary.confirmations}
              commonCopy={dictionary.common}
              currentUser={currentUser.data}
              locale={locale}
            />
          ) : activeView === "INFORMATION" ? (
            <ConfirmationInformationLibrary
              accessCopy={copy.informationLibrary.access}
              canManage={currentUser.data?.globalRole === "SUPER_ADMIN"}
              copy={copy.informationLibrary}
              locale={locale}
            />
          ) : activeView === "RESPONSES" ? (
            <ResponseWarehouseWorkspace
              cancelLabel={dictionary.common.cancel}
              copy={copy.responseWarehouseWorkspace}
              currentUserId={currentUser.data?.id}
              currentUserGlobalRole={currentUser.data?.globalRole}
              locale={locale}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}

function ReportTimeline({
  reportDate,
  copy,
  locale,
}: {
  reportDate: string | null | undefined;
  copy: ReturnType<
    typeof useI18n
  >["dictionary"]["confirmationCenter"]["intranet"];
  locale: string;
}) {
  const daysUntilReport = getDaysUntil(reportDate);
  if (daysUntilReport === null) {
    return (
      <span className="text-sm text-muted-foreground">{copy.noReportDate}</span>
    );
  }

  const timeLabel =
    daysUntilReport > 0
      ? copy.daysUntilReport.replace("{days}", String(daysUntilReport))
      : daysUntilReport === 0
        ? copy.reportDay
        : copy.daysOverdue.replace("{days}", String(Math.abs(daysUntilReport)));
  const timeTone =
    daysUntilReport < 0
      ? "border-destructive/25 bg-destructive/10 text-destructive"
      : daysUntilReport <= 14
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-transparent bg-muted text-muted-foreground";
  const formattedReportDate = formatDate(reportDate, locale);

  return (
    <div
      className="grid min-w-36 gap-1 py-1"
      aria-label={`${copy.reportDate}: ${formattedReportDate}. ${timeLabel}`}
    >
      <span className="text-sm font-medium text-foreground">
        {formattedReportDate}
      </span>
      <Badge variant="outline" className={cn("w-fit font-normal", timeTone)}>
        {timeLabel}
      </Badge>
    </div>
  );
}

function ConfirmationProgress({
  counts,
  copy,
  label,
  onStatusSelect,
}: {
  counts: Record<ConfirmationStatus, number>;
  copy: ReturnType<typeof useI18n>["dictionary"]["confirmations"];
  label: string;
  onStatusSelect: (status: Exclude<ConfirmationStatus, "VOIDED">) => void;
}) {
  return (
    <div
      className="grid min-w-48 grid-cols-5 gap-0.5 overflow-hidden"
      aria-label={label}
    >
      {PROGRESS_STATUSES.map((status) => {
        const count = counts[status] ?? 0;
        return (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            key={status}
            aria-label={`${getProgressStageLabel(copy, status)} ${count}`}
            className={`h-8 min-w-0 rounded-md px-2 text-xs font-medium tabular-nums ${
              count > 0
                ? "bg-primary/10 text-primary underline-offset-4 hover:bg-primary/20 hover:underline"
                : "text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => onStatusSelect(status)}
          >
            {count}
          </Button>
        );
      })}
    </div>
  );
}

function ConfirmationProgressLabels({
  copy,
}: {
  copy: ReturnType<typeof useI18n>["dictionary"]["confirmations"];
}) {
  return (
    <div
      className={cn(
        styles.progressLabels,
        "grid min-w-48 grid-cols-5 gap-0.5 font-normal text-muted-foreground"
      )}
    >
      {PROGRESS_STATUSES.map((status) => (
        <span key={status} className="text-center whitespace-nowrap">
          {getProgressStageLabel(copy, status)}
        </span>
      ))}
    </div>
  );
}

function getProgressStageLabel(
  copy: ReturnType<typeof useI18n>["dictionary"]["confirmations"],
  status: Exclude<ConfirmationStatus, "VOIDED">
) {
  const index = PROGRESS_STATUSES.indexOf(status);
  const labelKey = PROGRESS_LABEL_KEYS[index];
  return labelKey ? copy.overview.stages[labelKey] : copy.statusLabels[status];
}

function getDetailSelectionLabel(
  selection: ConfirmationDetailSelection,
  copy: ReturnType<
    typeof useI18n
  >["dictionary"]["confirmationCenter"]["intranet"],
  confirmationCopy: ReturnType<typeof useI18n>["dictionary"]["confirmations"]
) {
  if (selection.kind === "all") {
    return copy.allConfirmations;
  }
  if (selection.kind === "own") {
    return copy.myCreated;
  }
  return selection.status
    ? getProgressStageLabel(confirmationCopy, selection.status)
    : copy.allConfirmations;
}

function compareReportDates(
  left: string | null | undefined,
  right: string | null | undefined,
  direction: "asc" | "desc" = "asc"
) {
  const leftTime = getReportDateTime(left);
  const rightTime = getReportDateTime(right);
  const leftMissing = !Number.isFinite(leftTime);
  const rightMissing = !Number.isFinite(rightTime);
  if (leftMissing || rightMissing) {
    if (leftMissing && rightMissing) {
      return 0;
    }
    return leftMissing ? 1 : -1;
  }
  return direction === "desc" ? rightTime - leftTime : leftTime - rightTime;
}

function getSortLabel(
  copy: ReturnType<
    typeof useI18n
  >["dictionary"]["confirmationCenter"]["intranet"],
  sort: SortOption
) {
  const labels: Record<SortOption, string> = {
    REPORT_DATE_ASC: copy.sortOptions.reportDateAscending,
    REPORT_DATE_DESC: copy.sortOptions.reportDateDescending,
    AWAITING_RESPONSE_DESC: copy.sortOptions.awaitingResponse,
    PROJECT_NAME_ASC: copy.sortOptions.projectName,
  };
  return labels[sort];
}

function getReportDateTime(value: string | null | undefined) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function getDaysUntil(value: string | null | undefined) {
  const reportDateTime = getReportDateTime(value);
  if (!Number.isFinite(reportDateTime)) {
    return null;
  }
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const reportDate = new Date(reportDateTime);
  const startOfReportDate = new Date(
    reportDate.getFullYear(),
    reportDate.getMonth(),
    reportDate.getDate()
  );
  return Math.round(
    (startOfReportDate.getTime() - startOfToday.getTime()) / 86_400_000
  );
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
