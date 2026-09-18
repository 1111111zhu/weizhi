"use client";

import {
  ConstrainedTopBarIdentity,
  ProjectWingTopBarBrand,
  ProjectWingTopBarReturnAction,
  TopBarIdentitySide,
  useCompactViewport,
} from "@project-wing/ui";
import type { ExpandableActionBarItem } from "@project-wing/ui";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Project } from "../api/client";
import { useI18n } from "../i18n/client";
import { formatDisplayName } from "../lib/project-layout";
import { EmpHomeSearchShell } from "./emp-home-search-shell";
import { EmpRouteTopBar } from "./emp-persistent-top-bar";
import {
  EmpPortalAction,
  EmpTopBarControls,
} from "./project-wing-top-bar-controls";

const EMPTY_DEFAULT_ARRAY: never[] = [];

const UNASSIGNED_CLIENT_VALUE = "__unassigned__";

function getClientDisplayName(client: Project["cmpClient"] | null | undefined) {
  return (
    client?.nameZh?.trim() ||
    client?.nameEn?.trim() ||
    client?.clientCode?.trim() ||
    ""
  );
}

export function ProjectPageHeader({
  project,
  backHref,
  backLabel: backLabelOverride,
  settingsActions,
  extraActions,
  controlActions,
  controlActionItems,
  inboxAction,
  centerSlot,
  responsiveProjectWorkspace = false,
  mobileSearchContent,
  mobileControlActionItems,
  settingsOpen,
  onSettingsOpenChange,
  projectSwitcherProjects = EMPTY_DEFAULT_ARRAY,
  projectSwitcherProjectHref,
  className,
  mobileTitle,
  onMobileBack,
  onOtherAction,
}: {
  project?: Project;
  onOtherAction?: () => void;
  folderName?: string;
  backHref?: string;
  backLabel?: string;
  /** @deprecated Project tabs were removed; kept only for older callers/tests. */
  activeTab?: string;
  /** @deprecated Project tabs were removed; kept only for older callers/tests. */
  onTabChange?: (tab: string) => void;
  settingsActions?: ReactNode;
  extraActions?: ReactNode;
  controlActions?: ReactNode;
  controlActionItems?: ExpandableActionBarItem[];
  inboxAction?: ReactNode;
  centerSlot?: ReactNode;
  /** Enables the compact phone-and-tablet project workspace header. */
  responsiveProjectWorkspace?: boolean;
  /** Search is rendered from the compact avatar menu instead of the top bar. */
  mobileSearchContent?: ReactNode;
  /** Extra compact shortcuts that are intentionally absent on desktop. */
  mobileControlActionItems?: ExpandableActionBarItem[];
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
  projectSwitcherProjects?: Project[];
  projectSwitcherProjectHref?: (projectId: string) => string;
  className?: string;
  mobileTitle?: string;
  onMobileBack?: () => void;
}) {
  const isMobile = useCompactViewport(767);
  const router = useRouter();
  const searchShellRef = useRef<HTMLDivElement>(null);
  const searchExitRef = useRef<Animation | null>(null);
  useEffect(
    () => () => {
      searchExitRef.current?.cancel();
      searchExitRef.current = null;
    },
    []
  );
  const afterSearchExit = (navigate: () => void) => {
    if (searchExitRef.current) {
      return;
    }
    const search = searchShellRef.current;
    if (
      !search ||
      !search.getClientRects().length ||
      typeof search.animate !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      navigate();
      return;
    }
    const animation = search.animate(
      [
        { clipPath: "inset(0 0% round 999px)", opacity: 1 },
        { clipPath: "inset(0 50% round 999px)", opacity: 0 },
      ],
      { duration: 180, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" }
    );
    searchExitRef.current = animation;
    void animation.finished.then(
      () => {
        search.style.opacity = "0";
        search.style.clipPath = "inset(0 50% round 999px)";
        search.style.visibility = "hidden";
        animation.cancel();
        searchExitRef.current = null;
        navigate();
      },
      () => {}
    );
  };
  const withSearchExit = (items: ExpandableActionBarItem[] | undefined) =>
    items?.map((item) =>
      item.id === "confirmations" || item.id === "confirmation-center"
        ? { ...item, onClick: () => afterSearchExit(() => item.onClick?.()) }
        : item
    );
  const { dictionary, localizedPath } = useI18n();
  const projectCopy = dictionary.projects;
  const primaryName = formatDisplayName(
    project?.name ??
      projectCopy.fallbackProjectName ??
      projectCopy.fallbackProject ??
      "Project"
  );
  const mobileHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!isMobile) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const heading = mobileHeadingRef.current;
      // Never steal focus from an open modal while switching views.
      if (
        heading &&
        heading.textContent === (mobileTitle ?? primaryName) &&
        !heading.closest('[inert], [aria-hidden="true"]')
      ) {
        heading.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isMobile, mobileTitle, primaryName]);
  const cmpClient = project?.cmpClient ?? null;
  const clientDisplayName = getClientDisplayName(cmpClient);
  const clientName =
    clientDisplayName || (projectCopy.unassignedClient ?? "Unassigned client");
  const currentClientId = cmpClient?.id ?? UNASSIGNED_CLIENT_VALUE;
  const [selectedClientId, setSelectedClientId] = useState(currentClientId);
  const projectCode = project?.projectCode ?? "";
  const resolvedBackHref = localizedPath(backHref ?? "/engagement");
  const isArchivedProject = project?.status === "ARCHIVED";
  const isPendingFinalCheckProject = project?.status === "PENDING_FINAL_CHECK";
  const backLabel =
    backLabelOverride ?? dictionary.workspaces?.back ?? "Back to Workspace";
  const switcherProjects = useMemo(() => {
    const projectsById = new Map<string, Project>();
    if (project) {
      projectsById.set(project.id, project);
    }
    for (const selectableProject of projectSwitcherProjects) {
      projectsById.set(selectableProject.id, selectableProject);
    }
    return [...projectsById.values()];
  }, [project, projectSwitcherProjects]);
  const clientOptions = useMemo(() => {
    const clientsById = new Map<string, { id: string; label: string }>();
    let hasUnassignedProjects = false;
    for (const selectableProject of switcherProjects) {
      const client = selectableProject.cmpClient;
      if (!client) {
        hasUnassignedProjects = true;
        continue;
      }
      clientsById.set(client.id, {
        id: client.id,
        label: getClientDisplayName(client) || client.id,
      });
    }
    const clients = [...clientsById.values()].sort((left, right) =>
      left.label.localeCompare(right.label)
    );
    if (hasUnassignedProjects) {
      clients.push({
        id: UNASSIGNED_CLIENT_VALUE,
        label: projectCopy.unassignedClient ?? "Unassigned client",
      });
    }
    return clients;
  }, [projectCopy.unassignedClient, switcherProjects]);
  const selectedClientName =
    clientOptions.find((client) => client.id === selectedClientId)?.label ??
    clientName;
  const selectedClientProjects = useMemo(
    () =>
      switcherProjects
        .filter(
          (selectableProject) =>
            (selectableProject.cmpClient?.id ?? UNASSIGNED_CLIENT_VALUE) ===
            selectedClientId
        )
        .sort((left, right) =>
          formatDisplayName(left.name).localeCompare(
            formatDisplayName(right.name)
          )
        ),
    [selectedClientId, switcherProjects]
  );
  const currentProjectMatchesSelectedClient =
    currentClientId === selectedClientId;

  useEffect(() => {
    setSelectedClientId(currentClientId);
  }, [currentClientId]);

  const navigateToProject = (nextProjectId: string) => {
    router.push(
      localizedPath(
        projectSwitcherProjectHref?.(nextProjectId) ??
          `/engagement/${nextProjectId}`
      )
    );
  };
  const navigateBack = () => {
    if (backHref?.split(/[?#]/)[0] === "/confirmations") {
      afterSearchExit(() => router.push(resolvedBackHref));
    } else {
      router.push(resolvedBackHref);
    }
  };

  return (
    <EmpRouteTopBar
      onClickCapture={(event) => {
        const button = (event.target as HTMLElement).closest("button");
        if (button && button.dataset.actionId !== "project-work-items") {
          onOtherAction?.();
        }
      }}
      ready={Boolean(project)}
      centerPriority={Boolean(centerSlot)}
      independentHover
      className={[
        responsiveProjectWorkspace && "emp-compact-project-workspace-header",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      leading={
        isMobile ? (
          <div className="flex min-w-0 items-center gap-2">
            <ProjectWingTopBarReturnAction
              label={backLabel}
              onClick={onMobileBack ?? navigateBack}
            />
            <EmpPortalAction />
            <h1
              ref={mobileHeadingRef}
              tabIndex={-1}
              className="min-w-0 truncate text-lg font-semibold outline-none"
            >
              {mobileTitle ?? primaryName}
            </h1>
          </div>
        ) : (
          <div
            className="project-wing-top-bar-context"
            data-testid="project-header-global-navigation"
          >
            <ProjectWingTopBarBrand
              className={
                responsiveProjectWorkspace ? "max-[1023.5px]:hidden" : undefined
              }
            />
            {resolvedBackHref ? (
              <ProjectWingTopBarReturnAction
                label={backLabel}
                onClick={navigateBack}
              />
            ) : null}
            <EmpPortalAction />
            {responsiveProjectWorkspace ? (
              <span
                className="min-w-0 truncate text-sm font-semibold text-foreground min-[1024px]:hidden"
                data-testid="project-header-mobile-project-label"
                title={primaryName}
              >
                {primaryName}
              </span>
            ) : null}
            <div
              className={
                responsiveProjectWorkspace
                  ? "max-[1023.5px]:hidden"
                  : "contents"
              }
            >
              <ConstrainedTopBarIdentity>
                <Breadcrumb
                  label={
                    projectCopy.identityBreadcrumbLabel ?? "Project breadcrumb"
                  }
                  className="project-wing-top-bar-breadcrumb"
                  data-testid="project-header-breadcrumb"
                >
                  <BreadcrumbList className="h-full min-w-0 flex-nowrap gap-0">
                    <TopBarIdentitySide
                      className="h-full max-w-[12rem] min-w-0 shrink-0"
                      data-identity-segment
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="group/project-switcher"
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-full w-full min-w-0 justify-start gap-1 rounded-full px-2.5 text-sm font-medium text-muted-foreground"
                              data-testid="project-header-client-segment"
                              aria-label={
                                projectCopy.selectClient ?? "Select client"
                              }
                            />
                          }
                        >
                          <span className="truncate" data-identity-label>
                            {selectedClientName}
                          </span>
                          <ChevronDown
                            data-icon="inline-end"
                            className="transition-transform duration-[var(--motion-fast)] ease-[var(--motion-ease)] group-aria-expanded/project-switcher:rotate-180 motion-reduce:transition-none"
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64">
                          <DropdownMenuRadioGroup
                            value={selectedClientId}
                            onValueChange={setSelectedClientId}
                          >
                            {clientOptions.map((client) => (
                              <DropdownMenuRadioItem
                                key={client.id}
                                value={client.id}
                              >
                                <span className="truncate">{client.label}</span>
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TopBarIdentitySide>
                    <BreadcrumbItem
                      className="project-header-identity-middle h-full max-w-full min-w-0 shrink"
                      data-identity-segment
                    >
                      <BreadcrumbPage
                        data-testid="project-header-project-segment"
                        role="tab"
                        aria-selected="true"
                        aria-disabled={undefined}
                        className="flex h-full max-w-full min-w-0 shrink items-center overflow-hidden rounded-full bg-background px-2.5 text-sm font-semibold whitespace-nowrap shadow-sm"
                      >
                        <span
                          className="truncate"
                          data-identity-label
                          data-testid="project-header-project-label"
                        >
                          {currentProjectMatchesSelectedClient
                            ? primaryName
                            : (projectCopy.selectProject ?? "Select project")}
                        </span>
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                    <TopBarIdentitySide
                      className="h-full max-w-[12rem] min-w-0 shrink-0"
                      data-identity-segment
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="group/project-switcher"
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-full w-full min-w-0 justify-start gap-1 rounded-full px-2.5 text-sm font-medium text-muted-foreground"
                              data-testid="project-header-code-segment"
                              aria-label={
                                projectCopy.selectProject ?? "Select project"
                              }
                            />
                          }
                        >
                          <span className="truncate" data-identity-label>
                            {currentProjectMatchesSelectedClient && projectCode
                              ? projectCode
                              : (projectCopy.selectProject ?? "Select project")}
                          </span>
                          <ChevronDown
                            data-icon="inline-end"
                            className="transition-transform duration-[var(--motion-fast)] ease-[var(--motion-ease)] group-aria-expanded/project-switcher:rotate-180 motion-reduce:transition-none"
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="max-h-80 w-80"
                        >
                          <DropdownMenuRadioGroup
                            value={
                              currentProjectMatchesSelectedClient
                                ? (project?.id ?? "")
                                : ""
                            }
                            onValueChange={navigateToProject}
                          >
                            <DropdownMenuLabel>
                              {selectedClientName}
                            </DropdownMenuLabel>
                            {selectedClientProjects.map((selectableProject) => (
                              <DropdownMenuRadioItem
                                key={selectableProject.id}
                                value={selectableProject.id}
                                className="items-start"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate">
                                    {formatDisplayName(selectableProject.name)}
                                  </span>
                                  <span className="block text-xs text-muted-foreground">
                                    {selectableProject.projectCode}
                                  </span>
                                </span>
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TopBarIdentitySide>
                  </BreadcrumbList>
                </Breadcrumb>
              </ConstrainedTopBarIdentity>
            </div>
            {isArchivedProject ? (
              <Badge
                variant="outline"
                className={
                  responsiveProjectWorkspace
                    ? "hidden shrink-0 border-amber-300 bg-amber-50 text-amber-700 min-[1024px]:inline-flex"
                    : "shrink-0 border-amber-300 bg-amber-50 text-amber-700"
                }
              >
                {projectCopy.archivedStatus ?? "Archived"}
              </Badge>
            ) : null}
            {isPendingFinalCheckProject ? (
              <Badge
                variant="outline"
                className={
                  responsiveProjectWorkspace
                    ? "hidden shrink-0 border-sky-300 bg-sky-50 text-sky-700 min-[1024px]:inline-flex"
                    : "shrink-0 border-sky-300 bg-sky-50 text-sky-700"
                }
              >
                {projectCopy.pendingFinalCheckStatus ?? "Pending final check"}
              </Badge>
            ) : null}
            {project?.cmpEngagement?.status === "ARCHIVED" ? (
              <Badge
                variant="outline"
                className={
                  responsiveProjectWorkspace
                    ? "hidden shrink-0 border-violet-300 bg-violet-50 text-violet-700 min-[1024px]:inline-flex"
                    : "shrink-0 border-violet-300 bg-violet-50 text-violet-700"
                }
                data-testid="cmp-engagement-archived-badge"
              >
                {projectCopy.cmpArchivedStatus}
              </Badge>
            ) : null}
          </div>
        )
      }
      center={
        centerSlot ? (
          <EmpHomeSearchShell
            ref={searchShellRef}
            className={`project-wing-top-bar-center-slot${
              responsiveProjectWorkspace ? " max-[1023.5px]:hidden" : ""
            }`}
            data-testid="project-header-center-slot"
          >
            {centerSlot}
          </EmpHomeSearchShell>
        ) : undefined
      }
      actions={
        <>
          {extraActions}
          <EmpTopBarControls
            key="emp-navigation"
            settingsTitle={
              settingsActions
                ? (dictionary.common?.settings ?? "Settings")
                : (projectCopy.settingsTitle ?? "Project settings")
            }
            settingsDescription={
              settingsActions
                ? ""
                : (projectCopy.settingsDescription ??
                  "Manage the current project and selected workbench node.")
            }
            settingsContent={settingsActions}
            actions={controlActions}
            actionItems={withSearchExit(controlActionItems)}
            mobileWorkspaceActionItems={withSearchExit(
              mobileControlActionItems
            )}
            actionsLabel={projectCopy.actionsLabel ?? "Project shortcuts"}
            inboxAction={inboxAction}
            settingsOpen={settingsOpen}
            onSettingsOpenChange={onSettingsOpenChange}
            showSettingsContentHeading={!settingsActions}
            settingsDialogClassName="max-w-sm"
            showAppearanceSettings={!settingsActions}
            responsiveProjectWorkspace={responsiveProjectWorkspace}
            mobileSearchContent={mobileSearchContent}
            mobileWorkspaceSearchLabel={
              projectCopy.dataGridColumnMenu?.search ?? "Search files"
            }
          />
        </>
      }
    />
  );
}
