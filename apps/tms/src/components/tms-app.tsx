"use client";

import {
  buildApplicationHomePath,
  buildLocalizedLoginPath,
} from "@project-wing/shared";
import {
  AuthBoundary,
  ProjectWingWorkItemOverlay,
  ProjectWingToaster,
  getAuthBoundaryCopy,
  useAuthSignOut,
  useProjectWingActionHistory,
  useProjectWingBrowserTitle,
  useCompactViewport,
  MobileActionSheet,
} from "@project-wing/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  ApprovalWorkspace,
  readApprovalFilters,
} from "@/components/approval-workspace";
import { LoginScreen } from "@/components/login-screen";
import { OverviewWorkspace } from "@/components/overview-workspace";
import { QueryWorkspace } from "@/components/query-workspace";
import { TasksWorkspace } from "@/components/tasks-workspace";
import { ThemeProvider } from "@/components/theme-provider";
import { TimesheetWorkspace } from "@/components/timesheet-workspace";
import { TmsHeader } from "@/components/tms-header";
import type { TmsWorkspace } from "@/components/tms-header";
import { tmsSettingsCopyByLocale } from "@/i18n/dictionaries";
import { getTmsApprovalProjects, me, signOut } from "@/lib/api";
import type { User } from "@/lib/api";
import { defaultTheme } from "@/lib/theme";

import mobileStyles from "./tms-mobile.module.css";

function canApproveTms(globalRole: string) {
  return ["PARTNER", "SENIOR_MANAGER", "MANAGER"].includes(globalRole);
}

function canOpenTmsOverview(globalRole: string) {
  return globalRole === "HR" || globalRole === "SUPER_ADMIN";
}

function navigateBrowserLocation(url: string) {
  window.location.replace(url);
}

export function getTmsBrowserPageTitle(
  workspace: "TIMESHEET" | "APPROVALS" | "QUERY" | "OVERVIEW",
  locale: "zh-CN" | "en-US"
) {
  const copy = tmsSettingsCopyByLocale[locale];
  if (workspace === "APPROVALS") {
    return copy.approvals;
  }
  if (workspace === "QUERY") {
    return copy.search;
  }
  if (workspace === "OVERVIEW") {
    return copy.overview;
  }
  return copy.timesheet;
}

export function TmsApp({
  loginOnly = false,
  locale = "zh-CN",
  navigate = navigateBrowserLocation,
  initialWorkspace = "TIMESHEET",
}: {
  loginOnly?: boolean;
  locale?: "zh-CN" | "en-US";
  navigate?: (url: string) => void;
  initialWorkspace?: TmsWorkspace;
}) {
  return (
    <ThemeProvider initialTheme={defaultTheme}>
      <TmsAppContent
        locale={locale}
        loginOnly={loginOnly}
        navigate={navigate}
        initialWorkspace={initialWorkspace}
      />
      <ProjectWingToaster />
    </ThemeProvider>
  );
}

function TmsAppContent({
  loginOnly,
  locale,
  navigate,
  initialWorkspace,
}: {
  loginOnly: boolean;
  locale: "zh-CN" | "en-US";
  navigate: (url: string) => void;
  initialWorkspace: TmsWorkspace;
}) {
  const [user, setUser] = useState<User | null | undefined>();
  const [sessionError, setSessionError] = useState<Error | null>(null);
  const [workspace, setWorkspace] = useState<TmsWorkspace>(initialWorkspace);
  const [approvalPending, setApprovalPending] = useState(false);
  const [workItemsOpen, setWorkItemsOpen] = useState(false);
  const phone = useCompactViewport(767.98);
  const effectiveWorkspace = resolveTmsWorkspace(workspace, user?.globalRole);
  const actionHistory = useProjectWingActionHistory<{ id: TmsWorkspace }>({
    current: { id: effectiveWorkspace },
  });
  const restoredUserRef = useRef(false);
  useProjectWingBrowserTitle(
    user ? getTmsBrowserPageTitle(effectiveWorkspace, locale) : null
  );
  const loadSession = useCallback(async () => {
    setSessionError(null);
    setUser(undefined);
    try {
      setUser(await me());
    } catch (error) {
      setSessionError(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }, []);

  function handleAuthenticated(authenticatedUser: User) {
    setUser(authenticatedUser);
    if (loginOnly) {
      navigate(buildApplicationHomePath("tms", locale));
    }
  }

  const endSession = useAuthSignOut({
    clearSession: () => {
      setUser(null);
      setWorkspace("TIMESHEET");
      setApprovalPending(false);
    },
    navigate,
    redirectTo: buildLocalizedLoginPath(locale),
    signOut,
  });

  useEffect(() => {
    if (loginOnly || restoredUserRef.current) {
      return;
    }
    restoredUserRef.current = true;
    void loadSession();
  }, [loadSession, loginOnly]);

  useEffect(() => {
    if (!user || !canApproveTms(user.globalRole)) {
      setApprovalPending(false);
      return;
    }
    let active = true;
    const { year, month } = readApprovalFilters(user.id);
    void getTmsApprovalProjects(year, month)
      .then((response) => {
        if (active) {
          setApprovalPending(
            response.projects.some((project) => project.pendingCount > 0)
          );
        }
      })
      .catch(() => {
        if (active) {
          setApprovalPending(false);
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  if (loginOnly) {
    return (
      <LoginScreen locale={locale} onAuthenticated={handleAuthenticated} />
    );
  }

  if (!user || sessionError) {
    return (
      <AuthBoundary
        copy={getAuthBoundaryCopy(locale)}
        hasSession={Boolean(user)}
        isError={Boolean(sessionError)}
        isLoading={user === undefined && !sessionError}
        onRetry={() => void loadSession()}
        onUnauthenticated={() => navigate(buildLocalizedLoginPath(locale))}
      >
        {null}
      </AuthBoundary>
    );
  }

  const canOpenApprovals = canApproveTms(user.globalRole);
  const canOpenOverview = canOpenTmsOverview(user.globalRole);
  const navigateToWorkspace = (nextWorkspace: TmsWorkspace) => {
    actionHistory.navigateTo({ id: nextWorkspace }, (entry) => {
      setWorkspace(entry.id);
    });
  };
  const returnTarget = actionHistory.returnTarget?.id;
  const returnToPreviousWorkspace = () => {
    actionHistory.returnToPrevious((entry) => {
      setWorkspace(entry.id);
    });
  };
  const openApprovals = canOpenApprovals
    ? () => navigateToWorkspace("APPROVALS")
    : undefined;
  const openTimesheet = () => navigateToWorkspace("TIMESHEET");
  const openQuery = canApproveTms(user.globalRole)
    ? () => navigateToWorkspace("QUERY")
    : undefined;
  const openOverview = canOpenOverview
    ? () => navigateToWorkspace("OVERVIEW")
    : undefined;

  let workspaceContent: ReactNode;
  if (effectiveWorkspace === "OVERVIEW" && canOpenOverview) {
    workspaceContent = (
      <OverviewWorkspace
        locale={locale}
        user={user}
        onBack={returnToPreviousWorkspace}
        onSignOut={() => void endSession()}
        renderHeader={false}
      />
    );
  } else if (effectiveWorkspace === "APPROVALS" && canOpenApprovals) {
    workspaceContent = (
      <ApprovalWorkspace
        approvalPending={approvalPending}
        onApprovalPendingChange={setApprovalPending}
        locale={locale}
        user={user}
        onBack={returnToPreviousWorkspace}
        onOpenQuery={openQuery}
        onSignOut={() => void endSession()}
        renderHeader={false}
      />
    );
  } else if (effectiveWorkspace === "QUERY" && canOpenApprovals) {
    workspaceContent = (
      <QueryWorkspace
        approvalPending={approvalPending}
        locale={locale}
        user={user}
        onBack={returnToPreviousWorkspace}
        onOpenApprovals={openApprovals}
        onSignOut={() => void endSession()}
        renderHeader={false}
      />
    );
  } else {
    workspaceContent = (
      <TimesheetWorkspace
        approvalPending={approvalPending}
        locale={locale}
        user={user}
        onOpenApprovals={openApprovals}
        onOpenQuery={openQuery}
        onSignOut={() => void endSession()}
        renderHeader={false}
      />
    );
  }

  return (
    <>
      <TmsHeader
        approvalActive={effectiveWorkspace === "APPROVALS"}
        approvalPending={approvalPending}
        locale={locale}
        overviewActive={effectiveWorkspace === "OVERVIEW"}
        queryActive={effectiveWorkspace === "QUERY"}
        workItemsOpen={workItemsOpen}
        returnTarget={returnTarget}
        timesheetActive={effectiveWorkspace === "TIMESHEET"}
        user={user}
        onOpenApprovals={openApprovals}
        onOpenOverview={openOverview}
        onOpenQuery={openQuery}
        onToggleWorkItems={() => setWorkItemsOpen((open) => !open)}
        onOpenTimesheet={openTimesheet}
        onReturn={returnToPreviousWorkspace}
        onSignOut={() => void endSession()}
      />
      {workspaceContent}
      {workItemsOpen && phone ? (
        <MobileActionSheet
          open={workItemsOpen}
          onOpenChange={setWorkItemsOpen}
          title={locale === "zh-CN" ? "TMS 待办" : "TMS work items"}
          closeLabel={locale === "zh-CN" ? "关闭" : "Close"}
        >
          <div className={mobileStyles.fields}>
            <TasksWorkspace
              mobile
              locale={locale}
              onClose={() => setWorkItemsOpen(false)}
            />
          </div>
        </MobileActionSheet>
      ) : workItemsOpen ? (
        <ProjectWingWorkItemOverlay
          title={locale === "zh-CN" ? "TMS 待办" : "TMS work items"}
          onClose={() => setWorkItemsOpen(false)}
          resizeLabel={
            locale === "zh-CN"
              ? "调整 TMS 待办侧栏宽度"
              : "Resize TMS work item sidebar"
          }
          spacing={{ block: 8, inline: 16 }}
        >
          <TasksWorkspace
            locale={locale}
            onClose={() => setWorkItemsOpen(false)}
          />
        </ProjectWingWorkItemOverlay>
      ) : null}
    </>
  );
}

function resolveTmsWorkspace(
  workspace: TmsWorkspace,
  globalRole?: string
): TmsWorkspace {
  if (!globalRole) {
    return workspace;
  }
  if (
    (workspace === "APPROVALS" || workspace === "QUERY") &&
    !canApproveTms(globalRole)
  ) {
    return "TIMESHEET";
  }
  if (workspace === "OVERVIEW" && !canOpenTmsOverview(globalRole)) {
    return "TIMESHEET";
  }
  return workspace;
}
