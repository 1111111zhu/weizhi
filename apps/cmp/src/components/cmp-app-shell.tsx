"use client";

import {
  ConstrainedExpandableActionBar,
  Button as MobileButton,
  CollectionState,
  MobileActionSheet,
  MobileListItem,
  useCompactViewport,
  DevelopmentAccountList,
  ProjectWingPersonalWorkItemSidebar,
  ProjectWingLoadingProgress,
  ProjectWingTopBar,
  ProjectWingTopBarAccountPopover,
  ProjectWingTopBarActionCluster,
  ProjectWingTopBarBrand,
  ProjectWingTopBarReturnAction,
  ProjectWingTopBarSearch,
  ProjectWingWorkItemOverlay,
  themeCookieNames,
  projectWingToast as toast,
  SETTINGS_DIALOG_CONTENT_CLASS,
  SETTINGS_DIALOG_OVERLAY_CLASS,
  useProjectWingActionHistory,
  useProjectWingBrowserTitle,
  useProjectWingTheme,
} from "@project-wing/ui";
import type { DevelopmentAccount } from "@project-wing/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BriefcaseBusiness,
  ChevronRight,
  CircleUserRound,
  ClipboardCheck,
  Home,
  LogOut,
  Mail,
  MailOpen,
  Search,
  Settings,
  ReceiptText,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cloneElement, useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactElement } from "react";

import { api } from "../api/client";
import type { CurrentUser, InboxMessage } from "../api/client";
import { useCmpI18n } from "../i18n/client";
import type { CmpDictionary, CmpLocale } from "../i18n/client";
import { getCmpMobileCopy } from "../i18n/mobile";
import { localizedPath as buildLocalizedPath } from "../i18n/settings";
import { getIntranetPortalUrl } from "../lib/portal";
import { CmpMobileHeader } from "./cmp-mobile-header";
import { CmpSettingsCenter } from "./cmp-settings-center";
import { Button } from "./ui/button";
import { ButtonGroup } from "./ui/button-group";
import { Dialog, DialogContent } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export type CmpShellSection =
  | "dashboard"
  | "clients"
  | "maps"
  | "acceptance"
  | "engagements"
  | "billing";

type NavItem = {
  id: CmpShellSection;
  href: string;
  icon: typeof Users;
};

type CmpHistoryEntry = {
  id: CmpShellSection;
  href: string;
};

const navItems: NavItem[] = [
  { id: "clients", href: "/client", icon: Users },
  {
    id: "engagements",
    href: "/engagement",
    icon: BriefcaseBusiness,
  },
  {
    id: "acceptance",
    href: "/acceptance",
    icon: ClipboardCheck,
  },
  { id: "billing", href: "/billing", icon: ReceiptText },
] as const;
const cmpSectionMetadata: Record<CmpShellSection, { href: string }> = {
  dashboard: { href: "/dashboard" },
  clients: { href: "/client" },
  maps: { href: "/maps" },
  acceptance: { href: "/acceptance" },
  engagements: { href: "/engagement" },
  billing: { href: "/billing" },
};

function getCmpHistoryEntry(section: CmpShellSection): CmpHistoryEntry {
  return { id: section, href: cmpSectionMetadata[section].href };
}

const DEVELOPMENT_ACCOUNT_PASSWORD = "DANGEROUS";
const NAVIGATION_FEEDBACK_DELAY = 120;
const NAVIGATION_FEEDBACK_TIMEOUT = 900;

export function CmpAppShell({
  activeSection = "dashboard",
  children,
  user,
  onSignOut,
  searchValue,
  onSearchChange,
  navigate,
  onExternalNavigate,
  canNavigate,
  hideSidebar: _hideSidebar = false,
}: {
  activeSection?: CmpShellSection;
  children: React.ReactNode;
  user: CurrentUser;
  onSignOut: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  navigate?: (url: string) => boolean | undefined;
  onExternalNavigate?: (url: string) => void;
  canNavigate?: () => boolean;
  hideSidebar?: boolean;
}) {
  const phone = useCompactViewport(767.98);
  const [isWorkItemsOpen, setIsWorkItemsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [pendingNavigationId, setPendingNavigationId] =
    useState<CmpShellSection | null>(null);
  const [isNavigationFeedbackVisible, setIsNavigationFeedbackVisible] =
    useState(false);
  const navigationFeedbackTimerRef = useRef<number | null>(null);
  const navigationFallbackTimerRef = useRef<number | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { flavor, fontSize, setFlavor, setFontSize } = useProjectWingTheme();
  const { dictionary, locale, localizedPath, setLocale } = useCmpI18n();
  const actionHistory = useProjectWingActionHistory<CmpHistoryEntry>({
    current: getCmpHistoryEntry(activeSection),
    storageKey: "project-wing:cmp:action-history",
  });
  useProjectWingBrowserTitle(
    activeSection === "dashboard"
      ? dictionary.nav.dashboard
      : dictionary.nav[activeSection]
  );
  const workItems = useQuery({
    queryKey: ["work-items", "CMP", user.id, locale],
    queryFn: () => api.workItems(locale),
    refetchInterval: isWorkItemsOpen ? 10_000 : false,
  });
  const [developmentAccounts, setDevelopmentAccounts] = useState<
    DevelopmentAccount[]
  >([]);
  const [developmentAccountsLoading, setDevelopmentAccountsLoading] =
    useState(true);
  const cmpWorkItems = (workItems.data?.items ?? []).filter(
    (item) => item.domain === "CMP"
  );
  const searchPlaceholder =
    phone && activeSection === "billing"
      ? getCmpMobileCopy(locale).billingSearch
      : activeSection === "acceptance"
        ? dictionary.workspace.searchRequestClientApprover
        : activeSection === "engagements"
          ? dictionary.workspace.searchClientApprovalRemarks
          : dictionary.workspace.searchClientDirectory;

  useEffect(() => {
    const hasSharedFlavor = document.cookie
      .split("; ")
      .some((item) => item.startsWith(`${themeCookieNames.flavor}=`));
    const hasSharedFontSize = document.cookie
      .split("; ")
      .some((item) => item.startsWith(`${themeCookieNames.fontSize}=`));
    if (!hasSharedFlavor) {
      setFlavor(
        window.localStorage.getItem("cmp-appearance") === "night"
          ? "mocha"
          : "latte"
      );
    }
    if (!hasSharedFontSize) {
      setFontSize(
        parsePreference(window.localStorage.getItem("cmp-font-size"), [
          "sm",
          "md",
          "lg",
        ] as const) ?? "md"
      );
    }
  }, [setFlavor, setFontSize]);

  useEffect(() => {
    let active = true;
    const { listDevelopmentAccounts } = api;
    if (!listDevelopmentAccounts) {
      setDevelopmentAccountsLoading(false);
      return () => {
        active = false;
      };
    }
    void listDevelopmentAccounts()
      .then((accounts) => {
        if (active) {
          setDevelopmentAccounts(
            accounts.map((account) => ({
              ...account,
              password: DEVELOPMENT_ACCOUNT_PASSWORD,
            }))
          );
        }
      })
      .catch(() => active && setDevelopmentAccounts([]))
      .finally(() => active && setDevelopmentAccountsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const handleDevelopmentAccountSelect = async (
    account: DevelopmentAccount
  ) => {
    if (canNavigate && !canNavigate()) {
      return;
    }
    try {
      await api.impersonateDevelopmentAccount(account.email);
      queryClient.clear();
      router.refresh();
    } catch {
      toast.error(dictionary.shell.signInFailed);
    }
  };

  const clearNavigationFeedbackRef = useRef<() => void>(() => {});
  const clearNavigationFeedback = useCallback(() => {
    if (navigationFeedbackTimerRef.current !== null) {
      window.clearTimeout(navigationFeedbackTimerRef.current);
      navigationFeedbackTimerRef.current = null;
    }
    if (navigationFallbackTimerRef.current !== null) {
      window.clearTimeout(navigationFallbackTimerRef.current);
      navigationFallbackTimerRef.current = null;
    }
    setPendingNavigationId(null);
    setIsNavigationFeedbackVisible(false);
  }, []);
  clearNavigationFeedbackRef.current = clearNavigationFeedback;

  useEffect(
    () => () => {
      if (navigationFeedbackTimerRef.current !== null) {
        window.clearTimeout(navigationFeedbackTimerRef.current);
      }
      if (navigationFallbackTimerRef.current !== null) {
        window.clearTimeout(navigationFallbackTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (pendingNavigationId === activeSection) {
      clearNavigationFeedbackRef.current();
    }
  }, [activeSection, pendingNavigationId]);

  const navigateTo = navigate ?? ((url: string) => router.push(url));

  function changeLocale(nextLocale: CmpLocale) {
    const url = buildLocalizedPath(window.location.pathname, nextLocale);
    if (navigate) {
      if (navigate(url) === false) {
        return;
      }
    } else {
      router.push(url);
    }
    setLocale(nextLocale);
  }

  function navigateToSection(item: CmpHistoryEntry) {
    if (item.id === activeSection) {
      return;
    }
    clearNavigationFeedback();
    setPendingNavigationId(item.id);
    navigationFeedbackTimerRef.current = window.setTimeout(() => {
      setIsNavigationFeedbackVisible(true);
      navigationFeedbackTimerRef.current = null;
    }, NAVIGATION_FEEDBACK_DELAY);

    try {
      const href = localizedPath(item.href);
      router.prefetch(href);
      void prefetchCmpSection(item.id, queryClient);
      navigationFallbackTimerRef.current = window.setTimeout(() => {
        clearNavigationFeedback();
      }, NAVIGATION_FEEDBACK_TIMEOUT);
      navigateTo(href);
    } catch {
      clearNavigationFeedback();
    }
  }

  function openSection(item: NavItem) {
    actionHistory.navigateTo(item, navigateToSection);
  }

  const { returnTarget } = actionHistory;

  function returnToPreviousPage() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    if (returnTarget) {
      actionHistory.returnToPrevious(navigateToSection);
      return;
    }

    if (activeSection === "dashboard") {
      const url = getIntranetPortalUrl();
      if (onExternalNavigate) {
        onExternalNavigate(url);
      } else {
        window.location.assign(url);
      }
      return;
    }

    navigateTo(localizedPath("/dashboard"));
  }

  return (
    <div
      className={`${["cmp-shell", flavor === "mocha" ? "is-night" : ""].filter(Boolean).join(" ")}`}
    >
      {phone ? (
        <>
          <CmpMobileHeader
            title={dictionary.nav[activeSection]}
            onReturn={returnToPreviousPage}
            search={searchValue}
            onSearch={onSearchChange}
            searchPlaceholder={searchPlaceholder}
            actions={[
              {
                id: "home",
                label: dictionary.shell.returnToPortal,
                icon: <Home />,
                onClick: () => {
                  const url = getIntranetPortalUrl();
                  if (onExternalNavigate) {
                    onExternalNavigate(url);
                  } else {
                    window.location.assign(url);
                  }
                },
              },
              ...(user.globalRole === "SUPER_ADMIN"
                ? [
                    {
                      id: "dashboard",
                      label: dictionary.nav.dashboard,
                      icon: <Home />,
                      active: activeSection === "dashboard",
                      onClick: () =>
                        navigateToSection(getCmpHistoryEntry("dashboard")),
                    },
                  ]
                : []),
              ...navItems
                .filter(
                  (item) =>
                    item.id !== "billing" ||
                    ["PARTNER", "MANAGER", "SUPER_ADMIN"].includes(
                      user.globalRole
                    )
                )
                .map((item) => ({
                  id: item.id,
                  label: dictionary.nav[item.id],
                  icon: <item.icon />,
                  active: item.id === activeSection,
                  onClick: () => openSection(item),
                })),
              {
                id: "work-items",
                label: locale === "zh-CN" ? "CMP 待办" : "CMP work items",
                icon: <ClipboardCheck />,
                badge: cmpWorkItems.length || undefined,
                onClick: () => {
                  setIsWorkItemsOpen(true);
                  workItems.refetch();
                },
              },
              {
                id: "settings",
                label: dictionary.shell.settings,
                icon: <Settings />,
                onClick: () => setIsSettingsOpen(true),
              },
            ]}
            account={
              <>
                <strong>{user.name || user.email}</strong>
                <p>{user.email}</p>
                <p>{user.globalRole.replaceAll("_", " ")}</p>
                <DevelopmentAccountList
                  accounts={developmentAccounts}
                  emptyLabel={dictionary.shell.developmentAccountsEmpty}
                  loading={developmentAccountsLoading}
                  loadingLabel={dictionary.shell.developmentAccountsLoading}
                  onSelect={handleDevelopmentAccountSelect}
                />
                <MobileButton variant="danger" onClick={onSignOut}>
                  {dictionary.shell.signOut}
                </MobileButton>
              </>
            }
          />
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogContent
              aria-label={dictionary.shell.settings}
              closeLabel={dictionary.shell.close}
              className={SETTINGS_DIALOG_CONTENT_CLASS}
              overlayClassName={SETTINGS_DIALOG_OVERLAY_CLASS}
            >
              <CmpSettingsCenter
                flavor={flavor}
                fontSize={fontSize}
                user={user}
                onLocaleChange={changeLocale}
                onFlavorChange={setFlavor}
                onFontSizeChange={setFontSize}
              />
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <ProjectWingTopBar
          centerPriority
          className="print:!hidden"
          leading={
            <>
              <ProjectWingTopBarBrand lines={dictionary.shell.brandLines} />
              <ProjectWingTopBarReturnAction
                className="cmp-top-bar-return-action"
                label={
                  returnTarget
                    ? `${locale === "zh-CN" ? "返回" : "Back to"} ${dictionary.nav[returnTarget.id]}`
                    : locale === "zh-CN"
                      ? "返回上一页"
                      : "Back to previous page"
                }
                onClick={returnToPreviousPage}
              />
            </>
          }
          center={
            onSearchChange ? (
              <ProjectWingTopBarSearch
                ariaLabel={searchPlaceholder}
                icon={<Search aria-hidden="true" />}
                value={searchValue ?? ""}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            ) : undefined
          }
          actions={
            <ProjectWingTopBarActionCluster>
              <ConstrainedExpandableActionBar
                size="sm"
                items={[
                  {
                    id: "home",
                    label: dictionary.shell.returnToPortal,
                    icon: <Home aria-hidden="true" />,
                    onClick: () => {
                      const url = getIntranetPortalUrl();
                      if (onExternalNavigate) {
                        onExternalNavigate(url);
                      } else {
                        window.location.assign(url);
                      }
                    },
                  },
                  ...navItems
                    .filter(
                      (item) =>
                        item.id !== "billing" ||
                        ["PARTNER", "MANAGER", "SUPER_ADMIN"].includes(
                          user.globalRole
                        )
                    )
                    .map((item) => {
                      const Icon = item.icon;
                      return {
                        id: item.id,
                        label: dictionary.nav[item.id],
                        icon: <Icon aria-hidden="true" />,
                        active: item.id === activeSection,
                        onClick: () => openSection(item),
                      };
                    }),
                  {
                    id: "work-items",
                    label: locale === "zh-CN" ? "CMP 待办" : "CMP work items",
                    icon: <ClipboardCheck aria-hidden="true" />,
                    badge: cmpWorkItems.length || undefined,
                    active: isWorkItemsOpen,
                    onClick: () => {
                      const nextOpen = !isWorkItemsOpen;
                      setIsWorkItemsOpen(nextOpen);
                      if (nextOpen) {
                        workItems.refetch();
                      }
                      setIsSettingsOpen(false);
                      setIsAccountOpen(false);
                    },
                  },
                  {
                    id: "settings",
                    label: dictionary.shell.settings,
                    icon: <Settings aria-hidden="true" />,
                    active: isSettingsOpen,
                    wrap: (button) => (
                      <Dialog
                        open={isSettingsOpen}
                        onOpenChange={(open) => {
                          setIsSettingsOpen(open);
                          if (open) {
                            setIsWorkItemsOpen(false);
                            setIsAccountOpen(false);
                          }
                        }}
                      >
                        {cloneElement(
                          button as ReactElement<ComponentProps<typeof Button>>,
                          {
                            onClick: (event) => {
                              (
                                button.props as ComponentProps<typeof Button>
                              ).onClick?.(event);
                              if (!event.isPropagationStopped()) {
                                setIsSettingsOpen(true);
                                setIsWorkItemsOpen(false);
                                setIsAccountOpen(false);
                              }
                            },
                          }
                        )}
                        <DialogContent
                          aria-label={dictionary.shell.settings}
                          closeLabel={dictionary.shell.close}
                          className={SETTINGS_DIALOG_CONTENT_CLASS}
                          overlayClassName={SETTINGS_DIALOG_OVERLAY_CLASS}
                        >
                          <CmpSettingsCenter
                            flavor={flavor}
                            fontSize={fontSize}
                            user={user}
                            onLocaleChange={changeLocale}
                            onFlavorChange={setFlavor}
                            onFontSizeChange={setFontSize}
                          />
                        </DialogContent>
                      </Dialog>
                    ),
                  },
                ]}
              />
              <ProjectWingTopBarAccountPopover
                accountAvatarName={user.name || user.email}
                accountDisplayName={user.name || user.email}
                accountLabel={dictionary.shell.account}
                accountMenuLabel={dictionary.shell.accountMenu}
                accountRank={user.globalRole.replaceAll("_", " ")}
                onOpenChange={(open) => {
                  setIsAccountOpen(open);
                  if (open) {
                    setIsSettingsOpen(false);
                    setIsWorkItemsOpen(false);
                  }
                }}
                onSignOut={onSignOut}
                open={isAccountOpen}
                panelTestId="cmp-account-card"
                signOutIcon={<LogOut aria-hidden="true" />}
                signOutLabel={dictionary.shell.signOut}
                switchAccountIcon={<CircleUserRound aria-hidden="true" />}
                switchAccountDisabled={developmentAccounts.length === 0}
                switchAccountContent={
                  developmentAccounts.length > 0 ? (
                    <DevelopmentAccountList
                      accounts={developmentAccounts}
                      emptyLabel={dictionary.shell.developmentAccountsEmpty}
                      loading={developmentAccountsLoading}
                      loadingLabel={dictionary.shell.developmentAccountsLoading}
                      onSelect={handleDevelopmentAccountSelect}
                    />
                  ) : undefined
                }
                switchAccountLabel={dictionary.shell.switchAccount}
                triggerTestId="cmp-account-button"
                userEmail={user.email}
              />
            </ProjectWingTopBarActionCluster>
          }
          overlays={
            isNavigationFeedbackVisible ? <ProjectWingLoadingProgress /> : null
          }
          data-testid="cmp-topbar"
        />
      )}

      <div className="cmp-shell-body" data-testid="cmp-shell-body">
        <main
          className="cmp-main"
          aria-busy={pendingNavigationId !== null || undefined}
        >
          {children}
        </main>
        {phone ? (
          <MobileActionSheet
            title={locale === "zh-CN" ? "CMP 待办" : "CMP work items"}
            closeLabel={dictionary.shell.close}
            open={isWorkItemsOpen}
            onOpenChange={setIsWorkItemsOpen}
          >
            {workItems.isLoading || workItems.isError ? (
              <CollectionState
                locale={locale}
                kind={workItems.isError ? "error" : "loading"}
                onRetry={() => {
                  workItems.refetch();
                }}
              />
            ) : cmpWorkItems.length ? (
              cmpWorkItems.map((item) => (
                <MobileListItem
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  href="#work-item"
                  onNavigate={(event) => {
                    event.preventDefault();
                    setIsWorkItemsOpen(false);
                    if (
                      item.actionTarget.resourceType === "CMP_EXCHANGE_RATE"
                    ) {
                      setIsSettingsOpen(true);
                      return;
                    }
                    openCmpWorkItem(item, localizedPath, navigateTo);
                  }}
                />
              ))
            ) : (
              <CollectionState locale={locale} kind="empty" />
            )}
          </MobileActionSheet>
        ) : isWorkItemsOpen ? (
          <ProjectWingWorkItemOverlay
            title={locale === "zh-CN" ? "CMP 待办" : "CMP work items"}
            onClose={() => setIsWorkItemsOpen(false)}
            resizeLabel={
              locale === "zh-CN"
                ? "调整 CMP 待办侧栏宽度"
                : "Resize CMP work item sidebar"
            }
            spacing={{ block: 12, inline: 12, workspaceInline: 0 }}
          >
            <ProjectWingPersonalWorkItemSidebar
              title={locale === "zh-CN" ? "CMP 待办" : "CMP work items"}
              sections={[
                {
                  id: "CMP",
                  label: locale === "zh-CN" ? "CMP 待办" : "CMP work items",
                  items: cmpWorkItems,
                },
              ]}
              locale={locale}
              hasError={workItems.isError}
              isLoading={workItems.isLoading}
              onRetry={() => {
                workItems.refetch();
              }}
              onClose={() => setIsWorkItemsOpen(false)}
              onOpen={(item) => {
                setIsWorkItemsOpen(false);
                if (item.actionTarget.resourceType === "CMP_EXCHANGE_RATE") {
                  setIsSettingsOpen(true);
                  return;
                }
                openCmpWorkItem(item, localizedPath, navigateTo);
              }}
            />
          </ProjectWingWorkItemOverlay>
        ) : null}
      </div>
    </div>
  );
}

function openCmpWorkItem(
  item: Awaited<ReturnType<typeof api.workItems>>["items"][number],
  localizedPath: (pathname: string) => string,
  navigate: (pathname: string) => void
) {
  const target = item.actionTarget;
  const path =
    target.resourceType === "CMP_ACCEPTANCE"
      ? `/acceptance?requestId=${target.resourceId ?? ""}`
      : target.resourceType === "CMP_ENGAGEMENT_ARCHIVE"
        ? `/engagement/${target.resourceId ?? ""}/archive`
        : target.resourceType === "CMP_BILLING"
          ? `/billing/${target.resourceId ?? ""}`
          : "/dashboard";
  navigate(localizedPath(path));
}

type CmpNotificationFilter = "all" | "todo";

const CMP_TODO_CONTENT_KEYS = new Set([
  "CMP_ACCEPTANCE_APPROVAL_REQUESTED",
  "CMP_ACCEPTANCE_DRAFT_ASSIGNED",
  "CMP_ACCEPTANCE_NEXT_APPROVER",
  "CMP_ACCEPTANCE_RETURNED",
]);

export function NotificationPanelContent({
  messages,
  isLoading,
  hasError,
  readStatePending,
  onClose,
  onOpenMessage,
  onToggleMessageRead,
  dictionary,
  locale,
}: {
  messages: InboxMessage[];
  isLoading: boolean;
  hasError: boolean;
  readStatePending: boolean;
  onClose: () => void;
  onOpenMessage: (message: InboxMessage) => void | Promise<void>;
  onToggleMessageRead: (message: InboxMessage) => void;
  dictionary: CmpDictionary["shell"];
  locale: CmpLocale;
}) {
  const [filter, setFilter] = useState<CmpNotificationFilter>("all");
  const todoMessages = messages.filter(isCmpTodoMessage);

  return (
    <Tabs
      value={filter}
      onValueChange={(value) => setFilter(value as CmpNotificationFilter)}
      className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-0"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3.5">
        <TabsList className="grid h-8 w-full max-w-60 grid-cols-2 rounded-lg bg-muted/60 p-0.5">
          <TabsTrigger
            value="all"
            aria-label={`${dictionary.allNotifications} ${messages.length}`}
            className="h-[calc(100%-1px)] min-w-0 gap-2 px-3"
          >
            <span>{dictionary.allNotifications}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {messages.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="todo"
            aria-label={`${dictionary.todoNotifications} ${todoMessages.length}`}
            className="h-[calc(100%-1px)] min-w-0 gap-2 px-3"
          >
            <span>{dictionary.todoNotifications}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {todoMessages.length}
            </span>
          </TabsTrigger>
        </TabsList>
        <CmpShellButton
          type="button"
          className="size-7 shrink-0 p-0"
          onClick={onClose}
          tooltip={`${dictionary.close} ${dictionary.notifications}`}
        >
          <X aria-hidden="true" />
        </CmpShellButton>
      </div>

      <TabsContent value="all" className="min-h-0 overflow-hidden">
        <CmpNotificationMessageList
          messages={messages}
          isLoading={isLoading}
          hasError={hasError}
          readStatePending={readStatePending}
          onOpenMessage={onOpenMessage}
          onToggleMessageRead={onToggleMessageRead}
          dictionary={dictionary}
          locale={locale}
        />
      </TabsContent>
      <TabsContent value="todo" className="min-h-0 overflow-hidden">
        <CmpNotificationMessageList
          messages={todoMessages}
          isLoading={isLoading}
          hasError={hasError}
          readStatePending={readStatePending}
          emptyTitle={dictionary.noTodos}
          emptyDescription={dictionary.emptyTodos}
          onOpenMessage={onOpenMessage}
          onToggleMessageRead={onToggleMessageRead}
          dictionary={dictionary}
          locale={locale}
        />
      </TabsContent>
    </Tabs>
  );
}

function CmpNotificationMessageList({
  messages,
  isLoading,
  hasError,
  readStatePending,
  emptyTitle,
  emptyDescription,
  onOpenMessage,
  onToggleMessageRead,
  dictionary,
  locale,
}: {
  messages: InboxMessage[];
  isLoading: boolean;
  hasError: boolean;
  readStatePending: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onOpenMessage: (message: InboxMessage) => void | Promise<void>;
  onToggleMessageRead: (message: InboxMessage) => void;
  dictionary: CmpDictionary["shell"];
  locale: CmpLocale;
}) {
  if (isLoading) {
    return <ProjectWingLoadingProgress />;
  }
  if (hasError) {
    return (
      <CmpNotificationEmptyState
        title={dictionary.unableToLoadNotifications}
        description={dictionary.retryNotifications}
      />
    );
  }
  if (messages.length === 0) {
    return (
      <CmpNotificationEmptyState
        title={emptyTitle ?? dictionary.noNotifications}
        description={emptyDescription ?? dictionary.emptyNotifications}
      />
    );
  }

  const timelineGroups = groupCmpMessagesByTimeline(messages, dictionary);
  return (
    <ScrollArea className="h-full min-h-0" scrollFade scrollbarGutter>
      <div className="grid gap-5 p-3.5">
        {timelineGroups.map(([label, groupedMessages]) => (
          <section key={label} className="grid gap-2.5">
            <div className="flex items-center gap-2 px-1">
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full bg-primary"
              />
              <h3 className="shrink-0 text-xs font-semibold text-muted-foreground">
                {label}
              </h3>
              <span
                aria-hidden="true"
                className="h-px min-w-4 flex-1 bg-border/70"
              />
            </div>
            <div className="relative grid gap-2.5 pl-3 before:absolute before:top-0 before:bottom-0 before:left-[3px] before:w-px before:bg-border/60">
              {groupedMessages.map((message) => (
                <CmpNotificationCard
                  key={message.id}
                  message={message}
                  readStatePending={readStatePending}
                  onOpenMessage={onOpenMessage}
                  onToggleMessageRead={onToggleMessageRead}
                  dictionary={dictionary}
                  locale={locale}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </ScrollArea>
  );
}

function CmpNotificationCard({
  message,
  readStatePending,
  onOpenMessage,
  onToggleMessageRead,
  dictionary,
  locale,
}: {
  message: InboxMessage;
  readStatePending: boolean;
  onOpenMessage: (message: InboxMessage) => void | Promise<void>;
  onToggleMessageRead: (message: InboxMessage) => void;
  dictionary: CmpDictionary["shell"];
  locale: CmpLocale;
}) {
  const ReadIcon = message.readAt ? MailOpen : Mail;
  const contextLabel = getCmpMessageContextLabel(message);

  return (
    <article className="group grid gap-3.5 rounded-xl bg-muted/70 px-4 py-3.5 transition-colors duration-[var(--motion-fast)] hover:bg-muted/90 dark:bg-muted/40 dark:hover:bg-muted/60">
      <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/15">
            <Bell className="size-3.5" />
          </span>
          <span className="truncate font-medium text-foreground/75">
            {dictionary.systemNotification}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <time dateTime={message.createdAt}>
            {formatNotificationTime(message.createdAt, locale)}
          </time>
          {message.readAt === null ? (
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-destructive"
            />
          ) : null}
        </span>
      </div>

      <CmpShellButton
        type="button"
        className="grid h-auto w-full min-w-0 shrink justify-stretch gap-0 rounded-lg p-0 text-left whitespace-normal hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        onClick={() => {
          onOpenMessage(message);
        }}
      >
        <span className="line-clamp-2 text-base leading-6 font-semibold text-foreground">
          {message.title}
        </span>
        <span className="mt-1.5 line-clamp-2 text-sm leading-5 break-words text-muted-foreground">
          {message.body}
        </span>
      </CmpShellButton>

      {contextLabel ? (
        <div className="flex min-w-0 items-center gap-2.5 rounded-lg bg-background/70 px-3 py-2.5 text-xs text-muted-foreground">
          <ClipboardCheck className="size-4 shrink-0" />
          <span className="truncate font-medium">{contextLabel}</span>
        </div>
      ) : null}

      <ButtonGroup
        aria-label={dictionary.cmpAlerts}
        className="w-full items-center gap-1 border-t border-border/60 pt-2.5"
      >
        <CmpShellButton
          type="button"
          className="min-w-0 flex-1 justify-between px-1 text-sm"
          onClick={() => {
            onOpenMessage(message);
          }}
        >
          <span className="truncate">
            {message.actionUrl?.includes("/acceptance")
              ? dictionary.openAcceptance
              : dictionary.open}
          </span>
          <ChevronRight data-icon="inline-end" />
        </CmpShellButton>
        <CmpShellButton
          type="button"
          className="size-7 shrink-0 p-0 opacity-50 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          disabled={readStatePending}
          tooltip={message.readAt ? dictionary.markUnread : dictionary.markRead}
          onClick={() => onToggleMessageRead(message)}
        >
          <ReadIcon aria-hidden="true" />
        </CmpShellButton>
      </ButtonGroup>
    </article>
  );
}

function CmpNotificationEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-3 rounded-xl bg-muted/70 px-4 py-4 dark:bg-muted/40">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/70 text-muted-foreground">
          <Bell className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function isCmpTodoMessage(message: InboxMessage) {
  return Boolean(
    message.contentKey && CMP_TODO_CONTENT_KEYS.has(message.contentKey)
  );
}

function groupCmpMessagesByTimeline(
  messages: InboxMessage[],
  dictionary: CmpDictionary["shell"]
) {
  const groups = new Map<string, InboxMessage[]>();
  for (const message of messages) {
    const label = getCmpMessageTimelineLabel(message.createdAt, dictionary);
    const group = groups.get(label);
    if (group) {
      group.push(message);
    } else {
      groups.set(label, [message]);
    }
  }
  return [...groups.entries()];
}

function getCmpMessageTimelineLabel(
  value: string,
  dictionary: CmpDictionary["shell"]
) {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86_400_000);

  if (date >= today) {
    return dictionary.today;
  }
  if (date >= yesterday) {
    return dictionary.yesterday;
  }
  if (date >= sevenDaysAgo) {
    return dictionary.lastSevenDays;
  }
  return dictionary.earlier;
}

function getCmpMessageContextLabel(message: InboxMessage) {
  const requestNo = message.contentParams?.requestNo;
  const subject = message.contentParams?.subject;
  const parts = [requestNo, subject].filter(
    (value): value is string => typeof value === "string" && Boolean(value)
  );
  return parts.length ? parts.join(" · ") : null;
}
function formatNotificationTime(value: string, locale: CmpLocale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function CmpShellButton(props: ComponentProps<typeof Button>) {
  return <Button variant="ghost" {...props} />;
}

async function prefetchCmpSection(
  section: CmpShellSection,
  queryClient: ReturnType<typeof useQueryClient>
) {
  const queries =
    section === "clients"
      ? [
          { queryKey: ["cmp-client-groups"], queryFn: api.cmpClientGroups },
          { queryKey: ["cmp-clients"], queryFn: () => api.cmpClients() },
          { queryKey: ["cmp-users"], queryFn: api.cmpUsers },
        ]
      : section === "acceptance"
        ? [
            { queryKey: ["cmp-users"], queryFn: api.cmpUsers },
            { queryKey: ["cmp-clients"], queryFn: () => api.cmpClients() },
            {
              queryKey: ["cmp-acceptance"],
              queryFn: () => api.cmpAcceptance(),
            },
            { queryKey: ["cmp-approvals"], queryFn: () => api.cmpApprovals() },
          ]
        : section === "engagements"
          ? [
              { queryKey: ["cmp-clients"], queryFn: () => api.cmpClients() },
              {
                queryKey: ["cmp-engagements"],
                queryFn: () => api.cmpEngagements(),
              },
              { queryKey: ["cmp-users"], queryFn: api.cmpUsers },
            ]
          : [{ queryKey: ["cmp-dashboard"], queryFn: api.cmpDashboard }];

  await Promise.all(
    queries.map((query) => queryClient.prefetchQuery(query as never))
  );
}

function parsePreference<T extends string>(
  value: string | null,
  options: readonly T[]
) {
  return options.includes(value as T) ? (value as T) : null;
}

export function NotificationDrawer({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <dialog open aria-label={title} className="cmp-notification-drawer">
      {children}
    </dialog>
  );
}
