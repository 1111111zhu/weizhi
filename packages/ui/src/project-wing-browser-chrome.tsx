"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

export type ProjectWingBrowserApp = "CMP" | "EMP" | "TMS" | "Intranet" | "IB";

export type ProjectWingBrowserEnvironment = {
  apiBaseUrl?: string;
  apiMode?: string;
  localBackend?: boolean;
};

type BrowserLocale = "en-US" | "zh-CN";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const MOCK_MODES = new Set(["mock"]);
const browserTitleOverrideContext = createContext<Dispatch<
  SetStateAction<string | null>
> | null>(null);

function localize(en: string, zh: string, locale: BrowserLocale) {
  return locale === "en-US" ? en : zh;
}

function isPath(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function getLocale(pathname: string): BrowserLocale {
  return pathname.startsWith("/en-US") ? "en-US" : "zh-CN";
}

function stripLocale(pathname: string) {
  const path = pathname.replace(/^\/(?:en-US|zh-CN)(?=\/|$)/, "");
  return path || "/";
}

function getCmpPageTitle(pathname: string, locale: BrowserLocale) {
  const path = stripLocale(pathname);
  if (isPath(path, "/login")) {
    return localize("Sign in", "登录", locale);
  }
  if (isPath(path, "/dashboard")) {
    return localize("Dashboard", "仪表盘", locale);
  }
  if (isPath(path, "/clients/new") || isPath(path, "/client/new")) {
    return localize("New client", "新建客户", locale);
  }
  if (
    (isPath(path, "/clients") || isPath(path, "/client")) &&
    path.endsWith("/edit")
  ) {
    return localize("Edit client", "编辑客户", locale);
  }
  if (
    (isPath(path, "/clients") || isPath(path, "/client")) &&
    path.endsWith("/versions")
  ) {
    return localize("Client history", "客户历史", locale);
  }
  if (path.startsWith("/clients/") || path.startsWith("/client/")) {
    return localize("Client details", "客户详情", locale);
  }
  if (isPath(path, "/clients") || isPath(path, "/client")) {
    return localize("Clients", "客户", locale);
  }
  if (isPath(path, "/maps")) {
    return localize("Related Parties", "相关主体", locale);
  }
  if (isPath(path, "/acceptance")) {
    return localize("Acceptance", "审批", locale);
  }
  if (isPath(path, "/approvals")) {
    return localize("Approvals", "审批", locale);
  }
  if (isPath(path, "/engagements/new") || isPath(path, "/engagement/new")) {
    return localize("New engagement", "新建业务", locale);
  }
  if (
    (isPath(path, "/engagements") || isPath(path, "/engagement")) &&
    path.endsWith("/edit")
  ) {
    return localize("Edit engagement", "编辑业务", locale);
  }
  if (isPath(path, "/engagements") || isPath(path, "/engagement")) {
    return localize("Engagements", "业务", locale);
  }
  if (isPath(path, "/preview")) {
    return localize("Preview", "预览", locale);
  }
  return localize("Dashboard", "仪表盘", locale);
}

function getEmpPageTitle(pathname: string, locale: BrowserLocale) {
  const path = stripLocale(pathname);
  if (isPath(path, "/login")) {
    return localize("Sign in", "登录", locale);
  }
  if (isPath(path, "/engagement/new")) {
    return localize("New project", "新建项目", locale);
  }
  if (path.startsWith("/workspaces/") && path.endsWith("/engagement/new")) {
    return localize("New project", "新建项目", locale);
  }
  if (isPath(path, "/engagement") && path.endsWith("/members")) {
    return localize("Project members", "项目成员", locale);
  }
  if (path.startsWith("/engagement/")) {
    return localize("Workbench", "工作台", locale);
  }
  if (isPath(path, "/engagement")) {
    return localize("Project dashboard", "项目面板", locale);
  }
  if (path.startsWith("/workspaces/") && path.endsWith("/members")) {
    return localize("Project members", "项目成员", locale);
  }
  if (path.startsWith("/workspaces/") && path.includes("/engagement/")) {
    return localize("Workbench", "工作台", locale);
  }
  if (isPath(path, "/workspaces")) {
    return localize("Workspaces", "工作区", locale);
  }
  if (isPath(path, "/inbox")) {
    return localize("Inbox", "收件箱", locale);
  }
  if (isPath(path, "/confirmations")) {
    return localize("Confirmation Center", "函证中心", locale);
  }
  if (isPath(path, "/declaration")) {
    return localize("Independence declaration", "独立性声明", locale);
  }
  if (isPath(path, "/admin/users")) {
    return localize("User management", "用户管理", locale);
  }
  if (isPath(path, "/admin/roles")) {
    return localize("Role permissions", "角色权限", locale);
  }
  if (isPath(path, "/preview")) {
    return localize("Preview", "预览", locale);
  }
  return localize("Project dashboard", "项目面板", locale);
}

function getPageTitle(
  app: ProjectWingBrowserApp,
  pathname: string,
  locale: BrowserLocale
) {
  if (app === "CMP") {
    return getCmpPageTitle(pathname, locale);
  }
  if (app === "EMP") {
    return getEmpPageTitle(pathname, locale);
  }
  const path = stripLocale(pathname);
  if (app === "TMS") {
    return isPath(path, "/login")
      ? localize("Sign in", "登录", locale)
      : localize("Timesheet", "时间表", locale);
  }
  if (app === "Intranet") {
    if (isPath(path, "/login")) {
      return localize("Sign in", "登录", locale);
    }
    if (
      isPath(path, "/knowledge-preview") ||
      isPath(path, "/knowledge-attachment-preview")
    ) {
      return localize("Preview material", "预览资料", locale);
    }
    return localize("Knowledge", "知识中心", locale);
  }
  return localize("Requests", "资料请求", locale);
}

export function getProjectWingBrowserEnvironmentPrefix({
  app: _app,
  environment,
  hostname,
}: {
  app: ProjectWingBrowserApp;
  environment: ProjectWingBrowserEnvironment;
  hostname: string;
}) {
  const apiMode = environment.apiMode?.toLowerCase();
  const isLocal = LOCAL_HOSTNAMES.has(hostname);

  if (apiMode && MOCK_MODES.has(apiMode)) {
    return "[Mock]";
  }
  if (isLocal && environment.localBackend !== false) {
    return "[Local]";
  }
  return "";
}

export function getProjectWingBrowserTitle({
  app,
  environment,
  hostname,
  pageTitle,
  pathname,
}: {
  app: ProjectWingBrowserApp;
  environment: ProjectWingBrowserEnvironment;
  hostname: string;
  pageTitle?: string | null;
  pathname: string;
}) {
  const locale = getLocale(pathname);
  const environmentPrefix = getProjectWingBrowserEnvironmentPrefix({
    app,
    environment,
    hostname,
  });
  const currentPage = pageTitle?.trim() || getPageTitle(app, pathname, locale);
  return [environmentPrefix, `${app} · ${currentPage}`]
    .filter(Boolean)
    .join(" ");
}

export function ProjectWingBrowserChrome({
  app,
  children,
  environment,
  pathname,
}: {
  app: ProjectWingBrowserApp;
  children: ReactNode;
  environment: ProjectWingBrowserEnvironment;
  pathname: string | null;
}) {
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const currentPathname = pathname || "/";

  useEffect(() => {
    const title = getProjectWingBrowserTitle({
      app,
      environment,
      hostname: window.location.hostname,
      pageTitle,
      pathname: currentPathname,
    });
    const syncTitle = () => {
      if (document.title !== title) {
        document.title = title;
      }
    };
    syncTitle();
    const observer = new MutationObserver(syncTitle);
    observer.observe(document.head, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    const frame = window.requestAnimationFrame(() => {
      syncTitle();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [app, currentPathname, environment, pageTitle]);

  return (
    <browserTitleOverrideContext.Provider value={setPageTitle}>
      {children}
    </browserTitleOverrideContext.Provider>
  );
}

export function useProjectWingBrowserTitle(title: string | null) {
  const setPageTitle = useContext(browserTitleOverrideContext);

  useEffect(() => {
    if (!setPageTitle) {
      return;
    }
    setPageTitle(title);
    return () => setPageTitle(null);
  }, [setPageTitle, title]);
}
