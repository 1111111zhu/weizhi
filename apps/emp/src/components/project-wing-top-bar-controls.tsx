"use client";

import {
  GLOBAL_ROLE_METADATA,
  buildLocalizedLoginPath,
  resolveProjectWingIntranetUrl,
} from "@project-wing/shared";
import type { GlobalRole, WorkItem } from "@project-wing/shared";
import {
  DevelopmentAccountList,
  ExpandableActionBar,
  ProjectWingPersonalWorkItemSidebar,
  ProjectWingTopBarAccountPopover,
  ProjectWingTopBarActionCluster,
  ProjectWingTopBarAvatar,
  ProjectWingTopBarInboxIcon,
  ProjectWingWorkItemOverlay,
  SETTINGS_DIALOG_CONTENT_CLASS,
  SETTINGS_DIALOG_OVERLAY_CLASS,
  SettingsDialogShell,
  ThemePreferenceCards,
  getAuthCopy,
  projectWingToast as toast,
  useAuthSignOut,
  useCompactViewport,
  MobileActionSheet,
  Button as MobileButton,
} from "@project-wing/ui";
import type {
  DevelopmentAccount,
  ExpandableActionBarItem,
} from "@project-wing/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  CircleUserRound,
  ClipboardList,
  ExternalLink,
  Home,
  Inbox,
  LogOut,
  MonitorCog,
  MoreHorizontal,
  PlugZap,
  Recycle,
  Search,
  Settings,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldTitle } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { api } from "../api/client";
import type { InboxMessage } from "../api/client";
import { useI18n } from "../i18n/client";
import { getEmpMobileNavigationCopy } from "../i18n/mobile-navigation";
import { resolveInboxActionHref } from "../lib/inbox-action-url";
import type { ThemeFontSize } from "../lib/theme";
import { useSurfaceTransition } from "../lib/use-surface-transition";
import { cn } from "../lib/utils";
import { LogisticsUnreadDot } from "./confirmations/confirmation-logistics-unread";
import { DesktopAgentCacheSettings } from "./desktop-agent-cache-settings";
import {
  DesktopAgentSessionUpdateCheck,
  DesktopAgentSettings,
  resetDesktopAgentSessionUpdateCheck,
} from "./desktop-agent-settings";
import { LanguageSwitcher } from "./language-switcher";
import { SystemConnectionsSettings } from "./system-connections-settings";
import { useTheme } from "./theme-provider";
import { UserIntegrationsSettings } from "./user-integrations-settings";

const EMPTY_DEFAULT_ARRAY: never[] = [];

export function getIntranetPortalUrl() {
  return resolveProjectWingIntranetUrl({
    hostname:
      typeof window === "undefined" ? undefined : window.location.hostname,
    domainSuffix: process.env.NEXT_PUBLIC_PROJECTWING_DOMAIN_SUFFIX,
  });
}

export function EmpPortalAction({ className }: { className?: string }) {
  const { dictionary } = useI18n();
  const label = dictionary.common.returnToPortal ?? "Intranet";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      className={cn(
        "project-wing-top-bar-action-button h-8 shrink-0 gap-1.5 rounded-full px-2",
        className
      )}
      data-action-id="portal"
      data-testid="emp-portal-action"
      onClick={() => window.location.assign(getIntranetPortalUrl())}
    >
      <Home aria-hidden="true" />
      <span className="hidden min-[1024px]:inline">{label}</span>
    </Button>
  );
}

const DEVELOPMENT_ACCOUNT_PASSWORD = "DANGEROUS";
const DEFAULT_DEVELOPMENT_ACCOUNT_COPY = {
  developmentAccountWarning:
    "You are switching to a development account. Use this only for development and testing.",
  developmentAccountsEmpty: "No development accounts are available.",
  developmentAccountsLoading: "Loading development accounts…",
  signInFailed: "Sign-in failed. Please try again.",
};

function toDevelopmentAccounts(
  accounts: Awaited<ReturnType<typeof api.listDevelopmentAccounts>>
): DevelopmentAccount[] {
  return accounts.map(({ email, name, role }) => ({
    email,
    name,
    password: DEVELOPMENT_ACCOUNT_PASSWORD,
    role,
  }));
}

export function EmpTopBarControls({
  actions,
  actionItems = EMPTY_DEFAULT_ARRAY,
  trailing,
  settingsTitle,
  settingsDescription,
  settingsContent,
  actionsLabel,
  settingsDialogClassName = "h-[80dvh] max-h-[calc(100dvh-2rem)] !w-[min(64rem,94vw)] !max-w-[94vw] grid-rows-[auto_minmax(0,1fr)] overflow-hidden",
  closeSettingsOnContentClick = false,
  showSettingsContentHeading = true,
  showAppearanceSettings = true,
  showPortalHome = true,
  homeActive = false,
  showSettingsButton = true,
  settingsOpen,
  onSettingsOpenChange,
  className,
  avatarWrapperClassName = "shrink-0",
  inboxAction,
  responsiveProjectHome = false,
  compactSearchAction,
  responsiveProjectWorkspace = false,
  mobileSearchContent,
  mobileWorkspaceSearchLabel,
  mobileWorkspaceActionItems,
}: {
  actions?: ReactNode;
  actionItems?: ExpandableActionBarItem[];
  trailing?: ReactNode;
  settingsTitle?: string;
  settingsDescription?: string;
  settingsContent?: ReactNode;
  actionsLabel?: string;
  settingsDialogClassName?: string;
  closeSettingsOnContentClick?: boolean;
  showSettingsContentHeading?: boolean;
  showAppearanceSettings?: boolean;
  showPortalHome?: boolean;
  homeActive?: boolean;
  showSettingsButton?: boolean;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
  className?: string;
  avatarWrapperClassName?: string;
  inboxAction?: ReactNode;
  responsiveProjectHome?: boolean;
  compactSearchAction?: ExpandableActionBarItem;
  responsiveProjectWorkspace?: boolean;
  mobileSearchContent?: ReactNode;
  mobileWorkspaceSearchLabel?: string;
  mobileWorkspaceActionItems?: ExpandableActionBarItem[];
}) {
  const [uncontrolledSettingsOpen, setUncontrolledSettingsOpen] =
    useState(false);
  const [workItemsOpen, setWorkItemsOpen] = useState(false);
  const [tabletMoreOpen, setTabletMoreOpen] = useState(false);
  const [phoneMoreOpen, setPhoneMoreOpen] = useState(false);
  const [mobileWorkspaceMenuOpen, setMobileWorkspaceMenuOpen] = useState(false);
  const [mobileWorkspaceSearchOpen, setMobileWorkspaceSearchOpen] =
    useState(false);
  const isPhoneViewport = useCompactViewport(767.5);
  const isCompactViewport = useCompactViewport(1023);
  const isWorkspaceCompactViewport = useCompactViewport(1023.5);
  const isResponsiveWorkspaceCompact =
    responsiveProjectWorkspace &&
    isWorkspaceCompactViewport &&
    !isPhoneViewport;
  const isMobile = useCompactViewport(767);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const isSettingsOpen = settingsOpen ?? uncontrolledSettingsOpen;
  const setIsSettingsOpen = onSettingsOpenChange ?? setUncontrolledSettingsOpen;
  const queryClient = useQueryClient();
  const router = useRouter();
  const { dictionary, locale, localizedPath } = useI18n();
  const authCopy = getAuthCopy(locale);
  const mobileCopy = getEmpMobileNavigationCopy(locale);
  const developmentAccountCopy = {
    developmentAccountWarning:
      authCopy?.developmentAccountWarning ??
      DEFAULT_DEVELOPMENT_ACCOUNT_COPY.developmentAccountWarning,
    developmentAccountsEmpty:
      authCopy?.developmentAccountsEmpty ??
      DEFAULT_DEVELOPMENT_ACCOUNT_COPY.developmentAccountsEmpty,
    developmentAccountsLoading:
      authCopy?.developmentAccountsLoading ??
      DEFAULT_DEVELOPMENT_ACCOUNT_COPY.developmentAccountsLoading,
    signInFailed:
      authCopy?.signInFailed ?? DEFAULT_DEVELOPMENT_ACCOUNT_COPY.signInFailed,
  };
  const [developmentAccounts, setDevelopmentAccounts] = useState<
    DevelopmentAccount[]
  >([]);
  const [developmentAccountsLoading, setDevelopmentAccountsLoading] =
    useState(true);
  const resolvedActionsLabel =
    actionsLabel ?? dictionary.common?.actionsLabel ?? "Page shortcuts";
  const resolvedSettingsDescription =
    settingsDescription ??
    dictionary.common?.settingsDescription ??
    "Manage lower-frequency actions for this page.";
  const resolvedSettingsTitle =
    settingsTitle ?? dictionary.common?.settings ?? "Settings";
  const isSidebarSettingsDialog =
    Boolean(settingsContent) &&
    !showSettingsContentHeading &&
    !showAppearanceSettings;
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const signOut = useAuthSignOut({
    clearSession: () => {
      resetDesktopAgentSessionUpdateCheck();
      queryClient.clear();
    },
    navigate: router.replace,
    redirectTo: buildLocalizedLoginPath(locale),
    signOut: api.signOut,
  });

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
          setDevelopmentAccounts(toDevelopmentAccounts(accounts));
        }
      })
      .catch(() => {
        if (active) {
          setDevelopmentAccounts([]);
        }
      })
      .finally(() => {
        if (active) {
          setDevelopmentAccountsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);
  const empWorkItemsQuery = useQuery({
    queryKey: ["work-items", "EMP", me.data?.id, locale],
    queryFn: () => api.workItems({ view: "PERSONAL", scope: "EMP", locale }),
    enabled: Boolean(me.data) && inboxAction === undefined,
    refetchInterval: workItemsOpen ? 10_000 : false,
  });
  const opsWorkItemsQuery = useQuery({
    queryKey: ["work-items", "OPS", me.data?.id, locale],
    queryFn: () => api.workItems({ view: "OPS", scope: "OPS", locale }),
    enabled: me.data?.globalRole === "SUPER_ADMIN" && inboxAction === undefined,
    refetchInterval: workItemsOpen ? 10_000 : false,
  });
  const empWorkItems = empWorkItemsQuery.data?.items ?? [];
  const opsWorkItems = opsWorkItemsQuery.data?.items ?? [];
  const workItemSections = [
    {
      id: "EMP",
      label: dictionary.workItems.empTitle,
      items: empWorkItems,
      isLoading: empWorkItemsQuery.isLoading,
      hasError: empWorkItemsQuery.isError,
      onRetry: () => {
        empWorkItemsQuery.refetch();
      },
    },
    ...(me.data?.globalRole === "SUPER_ADMIN"
      ? [
          {
            id: "OPS",
            label: dictionary.workItems.opsTitle,
            items: opsWorkItems,
            isLoading: opsWorkItemsQuery.isLoading,
            hasError: opsWorkItemsQuery.isError,
            onRetry: () => {
              opsWorkItemsQuery.refetch();
            },
          },
        ]
      : []),
  ];
  const hasWorkItems = workItemSections.some(
    (section) => section.items.length > 0
  );
  const userEmail = me.data?.email ?? "";
  const hasDevelopmentAccounts = developmentAccounts.length > 0;
  const accountRank = formatAccountRank(
    me.data?.globalRole,
    dictionary.auditLogs?.roleLabels
  );
  const accountDisplayName = formatAccountDisplayName(
    me.data?.name ?? me.data?.email
  );
  const accountAvatarName = me.data?.name ?? accountDisplayName;
  const handleSignOut = () => signOut();
  const handleDevelopmentAccountSelect = async (
    account: DevelopmentAccount
  ) => {
    toast.warning(developmentAccountCopy.developmentAccountWarning);
    try {
      await api.impersonateDevelopmentAccount(account.email);
      queryClient.clear();
      router.refresh();
    } catch {
      toast.error(developmentAccountCopy.signInFailed);
    }
  };
  const resolvedTrailing =
    trailing ??
    (accountDisplayName ? (
      <ProjectWingTopBarAccountPopover
        accountAvatarName={accountAvatarName}
        accountDisplayName={accountDisplayName}
        accountRank={accountRank}
        onSignOut={handleSignOut}
        userEmail={userEmail}
        accountLabel={dictionary.nav.account ?? "Current account"}
        accountMenuLabel={dictionary.nav.accountMenu ?? "Account menu"}
        signOutIcon={<LogOut data-icon="inline-start" />}
        signOutLabel={dictionary.nav.signOut}
        switchAccountIcon={
          hasDevelopmentAccounts ? (
            <CircleUserRound data-icon="inline-start" />
          ) : undefined
        }
        switchAccountDisabled={false}
        switchAccountLabel={
          hasDevelopmentAccounts ? dictionary.nav.switchAccount : undefined
        }
        switchAccountContent={
          hasDevelopmentAccounts ? (
            <DevelopmentAccountList
              accounts={developmentAccounts}
              emptyLabel={developmentAccountCopy.developmentAccountsEmpty}
              loading={developmentAccountsLoading}
              loadingLabel={developmentAccountCopy.developmentAccountsLoading}
              onSelect={handleDevelopmentAccountSelect}
            />
          ) : undefined
        }
      />
    ) : null);
  const customSettingsItems = actionItems.filter(
    (item) => item.id === "settings"
  );
  const nonSettingsActionItems = actionItems.filter(
    (item) => item.id !== "settings"
  );
  const expandableItems: ExpandableActionBarItem[] = [
    ...(showPortalHome
      ? [
          {
            id: "home",
            active: homeActive,
            label: dictionary.desktop?.apps?.home ?? "Home",
            icon: <Home data-testid="emp-home-icon" />,
            onClick: () => router.push(localizedPath("/engagement")),
          },
        ]
      : []),
    ...nonSettingsActionItems.map((item) =>
      item.id === "confirmation-center"
        ? {
            ...item,
            icon: (
              <span className="relative inline-flex">
                {item.icon}
                <span className="absolute -top-1 -right-1 inline-flex">
                  <LogisticsUnreadDot />
                </span>
              </span>
            ),
          }
        : item
    ),
    ...(inboxAction === undefined || isResponsiveWorkspaceCompact
      ? [
          {
            id: "tasks",
            label: dictionary.workItems.empTitle,
            icon: (
              <span className="relative inline-flex">
                <ClipboardList aria-hidden="true" />
                {hasWorkItems ? (
                  <span className="absolute -top-1 -right-1 inline-flex">
                    <span
                      aria-hidden="true"
                      data-slot="project-wing-top-bar-inbox-unread-dot"
                      className="inline-block size-1.5 shrink-0 rounded-full bg-red-500"
                    />
                  </span>
                ) : null}
              </span>
            ),
            active: workItemsOpen,
            onClick: () => {
              const nextOpen = !workItemsOpen;
              setWorkItemsOpen(nextOpen);
              if (nextOpen) {
                empWorkItemsQuery.refetch();
                if (me.data?.globalRole === "SUPER_ADMIN") {
                  opsWorkItemsQuery.refetch();
                }
              }
              setIsSettingsOpen(false);
            },
          },
        ]
      : []),
    ...customSettingsItems,
    ...(showSettingsButton
      ? [
          {
            id: "settings",
            label: resolvedSettingsTitle,
            icon: <Settings />,
            active: isSettingsOpen,
            onClick: () => setIsSettingsOpen(true),
          },
        ]
      : []),
  ];
  const isResponsivePhone = responsiveProjectHome && isPhoneViewport;
  const isResponsiveTablet =
    responsiveProjectHome && isCompactViewport && !isPhoneViewport;
  const moreActionsLabel = dictionary.common.moreActions ?? "More actions";
  const handleCompactSearchClick = () => compactSearchAction?.onClick?.();
  const mobileWorkspaceItems = mobileWorkspaceActionItems
    ? [
        ...expandableItems.filter((item) => item.id === "home"),
        ...mobileWorkspaceActionItems,
        ...expandableItems.filter(
          (item) => item.id === "tasks" || item.id === "settings"
        ),
      ]
    : expandableItems;

  return (
    <>
      <DesktopAgentSessionUpdateCheck enabled={Boolean(me.data)} />
      {isMobile ? (
        <>
          {compactSearchAction ? (
            <MobileButton
              variant="quiet"
              size="icon"
              aria-label={getActionItemLabel(compactSearchAction)}
              onClick={handleCompactSearchClick}
            >
              {compactSearchAction.icon}
            </MobileButton>
          ) : null}
          <MobileButton
            variant="quiet"
            size="icon"
            aria-label={moreActionsLabel}
            onClick={() => setMobileActionsOpen(true)}
          >
            <MoreHorizontal />
          </MobileButton>
          <MobileActionSheet
            open={mobileActionsOpen}
            onOpenChange={setMobileActionsOpen}
            title={moreActionsLabel}
            closeLabel={mobileCopy.close}
          >
            <div className="grid gap-2">
              {[...expandableItems, ...(mobileWorkspaceActionItems ?? [])].map(
                (item) => {
                  const button = (
                    <MobileButton
                      variant="quiet"
                      fullWidth
                      className="justify-start"
                      disabled={item.disabled}
                      aria-pressed={item.active || undefined}
                      onClick={() => {
                        setMobileActionsOpen(false);
                        item.onClick?.();
                      }}
                    >
                      {item.icon}
                      {item.label}
                      {item.badge}
                    </MobileButton>
                  );
                  return (
                    <div key={item.id}>
                      {item.wrap ? item.wrap(button) : button}
                    </div>
                  );
                }
              )}
              {inboxAction}
              {actions}
              {resolvedTrailing}
            </div>
          </MobileActionSheet>
        </>
      ) : (
        <ProjectWingTopBarActionCluster
          className={cn("emp-navigation-motion", className)}
        >
          {isResponsiveWorkspaceCompact ? (
            <MobileWorkspaceFloatingMenu
              accountAvatarName={accountAvatarName}
              accountDisplayName={accountDisplayName}
              accountLabel={dictionary.nav.account ?? "Current account"}
              accountRank={accountRank}
              items={mobileWorkspaceItems}
              menuLabel={resolvedActionsLabel}
              mobileSearchContent={mobileSearchContent}
              searchLabel={mobileWorkspaceSearchLabel ?? "Search files"}
              onSignOut={handleSignOut}
              open={mobileWorkspaceMenuOpen}
              searchOpen={mobileWorkspaceSearchOpen}
              setOpen={(nextOpen) => {
                setMobileWorkspaceMenuOpen(nextOpen);
                if (!nextOpen) {
                  setMobileWorkspaceSearchOpen(false);
                }
              }}
              setSearchOpen={setMobileWorkspaceSearchOpen}
              signOutLabel={dictionary.nav.signOut}
              userEmail={userEmail}
            />
          ) : isResponsivePhone ? (
            <>
              {compactSearchAction ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={getActionItemLabel(compactSearchAction)}
                  className="project-wing-top-bar-action-button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={handleCompactSearchClick}
                >
                  {compactSearchAction.icon}
                </Button>
              ) : null}
              <Sheet open={phoneMoreOpen} onOpenChange={setPhoneMoreOpen}>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={moreActionsLabel}
                  aria-expanded={phoneMoreOpen}
                  className="size-8 rounded-full"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setPhoneMoreOpen(true)}
                >
                  <ChevronDown aria-hidden="true" />
                </Button>
                <SheetContent
                  side="bottom"
                  showCloseButton={false}
                  className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
                >
                  <div
                    aria-hidden="true"
                    className="mx-auto mt-2 h-1 w-10 rounded-full bg-border"
                  />
                  <SheetHeader className="pb-1">
                    <SheetTitle>{moreActionsLabel}</SheetTitle>
                    <SheetDescription className="sr-only">
                      {resolvedActionsLabel}
                    </SheetDescription>
                  </SheetHeader>
                  <ResponsiveActionMenuItems
                    items={expandableItems}
                    onSelect={() => setPhoneMoreOpen(false)}
                  />
                </SheetContent>
              </Sheet>
              {resolvedTrailing ? <div>{resolvedTrailing}</div> : null}
            </>
          ) : isResponsiveTablet ? (
            <>
              {expandableItems.length > 0 ? (
                <ExpandableActionBar
                  items={expandableItems}
                  label={resolvedActionsLabel}
                  expanded={false}
                  expandOnFocus={false}
                  expandOnHover={false}
                  size="sm"
                />
              ) : null}
              <Popover open={tabletMoreOpen} onOpenChange={setTabletMoreOpen}>
                <PopoverTrigger
                  onMouseDown={(event) => event.preventDefault()}
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={moreActionsLabel}
                      className="size-8 rounded-full"
                    />
                  }
                >
                  <ChevronDown aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={8} className="w-80 p-3">
                  <ResponsiveActionMenuItems
                    items={expandableItems}
                    onSelect={() => setTabletMoreOpen(false)}
                  />
                </PopoverContent>
              </Popover>
              {resolvedTrailing ? <div>{resolvedTrailing}</div> : null}
            </>
          ) : expandableItems.length > 0 ? (
            <ExpandableActionBar
              expanded
              selectOnAction
              activeId={
                workItemsOpen
                  ? "tasks"
                  : isSettingsOpen
                    ? "settings"
                    : undefined
              }
              expandOnHover={false}
              expandOnFocus={false}
              items={expandableItems}
              label={resolvedActionsLabel}
              size="sm"
            />
          ) : null}
          {!isResponsivePhone &&
          !isResponsiveWorkspaceCompact &&
          !isResponsiveTablet &&
          (inboxAction || actions) ? (
            <ButtonGroup label={resolvedActionsLabel}>
              {inboxAction}
              {actions}
            </ButtonGroup>
          ) : null}
          {!isResponsivePhone &&
          !isResponsiveWorkspaceCompact &&
          !isResponsiveTablet &&
          resolvedTrailing ? (
            <div className={avatarWrapperClassName}>{resolvedTrailing}</div>
          ) : null}
        </ProjectWingTopBarActionCluster>
      )}

      {showSettingsButton ? (
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent
            overlayClassName={
              isSidebarSettingsDialog
                ? SETTINGS_DIALOG_OVERLAY_CLASS
                : undefined
            }
            className={cn(
              isSidebarSettingsDialog
                ? SETTINGS_DIALOG_CONTENT_CLASS
                : settingsDialogClassName
            )}
          >
            {isSidebarSettingsDialog ? (
              <>
                <DialogTitle className="sr-only">
                  {resolvedSettingsTitle}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {resolvedSettingsDescription}
                </DialogDescription>
                {settingsContent}
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-foreground">
                    {resolvedSettingsTitle}
                  </DialogTitle>
                  {resolvedSettingsDescription ? (
                    <DialogDescription className="text-sm leading-6 text-muted-foreground">
                      {resolvedSettingsDescription}
                    </DialogDescription>
                  ) : null}
                </DialogHeader>
                <div className="grid h-full min-h-0 gap-5">
                  {settingsContent ? (
                    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
                      {showSettingsContentHeading ? (
                        <h3 className="text-sm font-medium text-foreground">
                          {dictionary.common?.currentPage ?? "Current page"}
                        </h3>
                      ) : null}
                      <div
                        role="presentation"
                        className="grid h-full min-h-0 gap-4"
                        onClick={
                          closeSettingsOnContentClick
                            ? () => setIsSettingsOpen(false)
                            : undefined
                        }
                      >
                        {settingsContent}
                      </div>
                    </section>
                  ) : null}
                  <GlobalSettingsPanel
                    show={showAppearanceSettings}
                    isSuperAdmin={me.data?.globalRole === "SUPER_ADMIN"}
                  />
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      ) : null}
      {inboxAction === undefined ? (
        <ProjectWingWorkItemOverlay
          open={workItemsOpen}
          title={dictionary.workItems.empTitle}
          onClose={() => setWorkItemsOpen(false)}
          resizeLabel={dictionary.workItems.resizeEmp}
        >
          <ProjectWingPersonalWorkItemSidebar
            title={dictionary.workItems.empTitle}
            sections={workItemSections}
            locale={locale}
            onClose={() => setWorkItemsOpen(false)}
            onOpen={(item) => {
              setWorkItemsOpen(false);
              if (
                item.domain === "OPS" &&
                ["USER_MAIL_CONNECTION", "SYSTEM_CONNECTION"].includes(
                  item.actionTarget.resourceType
                )
              ) {
                setIsSettingsOpen(true);
                return;
              }
              openEmpWorkItem(item, localizedPath, router.push);
            }}
          />
        </ProjectWingWorkItemOverlay>
      ) : null}
    </>
  );
}

function getActionItemLabel(item: ExpandableActionBarItem) {
  return typeof item.label === "string" ? item.label : item.id;
}

function ResponsiveActionMenuItems({
  items,
  onSelect,
}: {
  items: ExpandableActionBarItem[];
  onSelect: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 px-3 pb-3" role="menu">
      {items.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant="ghost"
          role="menuitem"
          disabled={item.disabled}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "h-10 min-w-0 justify-start gap-2.5 px-3",
            item.active && "bg-primary/8 text-foreground"
          )}
          onClick={() => {
            item.onClick?.();
            onSelect();
          }}
        >
          <span className="inline-flex size-4 shrink-0 items-center justify-center">
            {item.icon}
          </span>
          <span className="truncate">{getActionItemLabel(item)}</span>
        </Button>
      ))}
    </div>
  );
}

function MobileWorkspaceFloatingMenu({
  accountAvatarName,
  accountDisplayName,
  accountLabel,
  accountRank,
  items,
  menuLabel,
  mobileSearchContent,
  searchLabel,
  onSignOut,
  open,
  searchOpen,
  setOpen,
  setSearchOpen,
  signOutLabel,
  userEmail,
}: {
  accountAvatarName: string;
  accountDisplayName: string;
  accountLabel: string;
  accountRank?: string;
  items: ExpandableActionBarItem[];
  menuLabel: string;
  mobileSearchContent?: ReactNode;
  searchLabel: string;
  onSignOut: () => void;
  open: boolean;
  searchOpen: boolean;
  setOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  signOutLabel: string;
  userEmail: string;
}) {
  const closeMenu = () => setOpen(false);
  const { locale } = useI18n();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={menuLabel}
            aria-expanded={open}
            className="fixed top-[calc(env(safe-area-inset-top)+0.25rem)] right-3 z-[60] size-9 rounded-full p-0 shadow-md ring-1 ring-border/70"
            data-testid="mobile-workspace-avatar-menu-trigger"
          />
        }
      >
        <ProjectWingTopBarAvatar
          label={accountLabel}
          name={accountAvatarName}
          size="sm"
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="z-[60] max-h-[calc(100dvh-4rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl p-2 shadow-xl"
        data-testid="mobile-workspace-avatar-menu"
      >
        {searchOpen ? (
          <div className="grid gap-2 p-1">
            <div className="flex items-center justify-between gap-2 px-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 px-2"
                onClick={() => setSearchOpen(false)}
              >
                <ChevronDown className="size-4 rotate-90" aria-hidden="true" />
                {menuLabel}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={getEmpMobileNavigationCopy(locale).close}
                onClick={closeMenu}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            {mobileSearchContent ?? (
              <p className="px-2 pb-2 text-sm text-muted-foreground">
                {searchLabel}
              </p>
            )}
          </div>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              className="mb-1 h-11 w-full justify-start gap-3 rounded-xl px-3 text-sm font-medium"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-4" aria-hidden="true" />
              {searchLabel}
            </Button>
            <ResponsiveActionMenuItems items={items} onSelect={closeMenu} />
            <div className="mx-2 mb-1 border-t border-border/70 pt-3">
              <div className="flex items-center gap-2 px-1">
                <ProjectWingTopBarAvatar
                  label={accountLabel}
                  name={accountAvatarName}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {accountDisplayName}
                  </p>
                  {accountRank ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {accountRank}
                    </p>
                  ) : null}
                  {userEmail ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={signOutLabel}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={onSignOut}
                >
                  <LogOut aria-hidden="true" />
                </Button>
              </div>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function openEmpWorkItem(
  item: WorkItem,
  localizedPath: (pathname: string) => string,
  navigate: (pathname: string) => void
) {
  const target = item.actionTarget;
  if (target.resourceType === "SYSTEM_DECLARATION") {
    navigate(localizedPath("/declaration"));
    return;
  }
  if (target.resourceType === "PROJECT_INVITATION") {
    const { path } = target.params;
    navigate(
      typeof path === "string" && path
        ? localizedPath(path)
        : localizedPath("/engagement")
    );
    return;
  }
  if (target.resourceType === "CMP_ENGAGEMENT") {
    navigate(
      localizedPath(
        `/engagement/new?cmpEngagementId=${target.resourceId ?? ""}`
      )
    );
    return;
  }
  const projectId =
    (typeof target.params.projectId === "string"
      ? target.params.projectId
      : null) ?? item.project?.id;
  if (projectId) {
    navigate(
      `${localizedPath(`/engagement/${projectId}`)}?workItem=${encodeURIComponent(item.id)}`
    );
    return;
  }
  navigate(localizedPath("/engagement"));
}

export function GlobalSettingsPanel({
  show = true,
  isSuperAdmin = false,
  recycleBinContent,
  onOpenRecycleBin,
}: {
  show?: boolean;
  isSuperAdmin?: boolean;
  recycleBinContent?: ReactNode;
  onOpenRecycleBin?: () => void;
}) {
  const { dictionary } = useI18n();
  const { fontSize, mounted, resolvedTheme, setFontSize, setTheme, theme } =
    useTheme();
  const settingsCopy = dictionary.workbench.settingsPanel;
  const [activeSection, setActiveSection] = useState<
    | "recycleBin"
    | "personal"
    | "integrations"
    | "desktopAgent"
    | "systemConnections"
  >("personal");
  const settingsSurfaceRef = useSurfaceTransition<HTMLDivElement>(
    `${show}:${activeSection}`
  );

  if (!show) {
    return null;
  }

  const sections = [
    ...(recycleBinContent
      ? [
          {
            id: "recycleBin" as const,
            label: dictionary.desktop.projectRecycleBin,
            icon: Recycle,
          },
        ]
      : []),
    {
      id: "personal" as const,
      label: settingsCopy.sections.personal.label,
      icon: Settings2,
    },
    {
      id: "desktopAgent" as const,
      label: settingsCopy.sections.desktopAgent?.label ?? "Desktop Agent",
      icon: MonitorCog,
    },
    {
      id: "integrations" as const,
      label: settingsCopy.sections.integrations.label,
      icon: PlugZap,
    },
    ...(isSuperAdmin
      ? [
          {
            id: "systemConnections" as const,
            label: settingsCopy.sections.systemConnections.label,
            icon: ShieldCheck,
          },
        ]
      : []),
  ];

  return (
    <div
      ref={settingsSurfaceRef}
      className="h-full"
      data-testid="global-settings-panel"
    >
      <SettingsDialogShell
        activeId={activeSection}
        mobileNavigation="pages"
        mobileBackLabel={dictionary.common.settings}
        breadcrumbRoot={dictionary.common.settings}
        items={sections}
        navigationLabel={settingsCopy.menu.navAriaLabel}
        onActiveIdChange={(section) => {
          setActiveSection(section);
          if (section === "recycleBin") {
            onOpenRecycleBin?.();
          }
        }}
      >
        {activeSection === "recycleBin" ? recycleBinContent : null}
        {activeSection === "personal" ? (
          <div className="mx-auto w-full max-w-2xl py-6 sm:py-10">
            <FieldGroup className="gap-0">
              <Field className="pb-8">
                <FieldTitle>{settingsCopy.personal.darkMode}</FieldTitle>
                <ThemePreferenceCards
                  value={
                    mounted && theme === "system"
                      ? "system"
                      : mounted && resolvedTheme === "dark"
                        ? "dark"
                        : "light"
                  }
                  onValueChange={(value) => setTheme(value)}
                  label={settingsCopy.personal.darkMode}
                  labels={{
                    system: settingsCopy.personal.system,
                    light: settingsCopy.personal.day,
                    dark: settingsCopy.personal.night,
                  }}
                />
              </Field>
              <Field
                orientation="horizontal"
                className="flex-wrap items-center justify-between gap-4 border-t border-border/60 py-5"
              >
                <FieldTitle>{dictionary.language.label}</FieldTitle>
                <LanguageSwitcher variant="tabs" labelFormat="full" />
              </Field>
              <Field
                orientation="horizontal"
                className="flex-wrap items-center justify-between gap-4 border-t border-border/60 py-5"
              >
                <FieldTitle>{settingsCopy.personal.fontSize}</FieldTitle>
                <Tabs
                  value={fontSize}
                  onValueChange={(value) => setFontSize(value as ThemeFontSize)}
                  label={settingsCopy.personal.fontSize}
                  className="w-fit shrink-0"
                >
                  <TabsList>
                    {(["sm", "md", "lg"] as ThemeFontSize[]).map((item) => (
                      <TabsTrigger key={item} value={item}>
                        {settingsCopy.fontSizeOptions[item]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </Field>
              <DesktopAgentCacheSettings />
            </FieldGroup>
          </div>
        ) : activeSection === "integrations" ? (
          <UserIntegrationsSettings />
        ) : activeSection === "desktopAgent" ? (
          <DesktopAgentSettings />
        ) : activeSection === "systemConnections" ? (
          <SystemConnectionsSettings />
        ) : null}
      </SettingsDialogShell>
    </div>
  );
}

function formatAccountRank(
  globalRole?: GlobalRole,
  roleLabels?: Partial<Record<GlobalRole, string>>
) {
  if (!globalRole) {
    return "";
  }
  return (
    roleLabels?.[globalRole] ??
    GLOBAL_ROLE_METADATA[globalRole]?.label ??
    globalRole
  );
}

function formatAccountDisplayName(value?: string | null) {
  const fallback = "Project Wing";
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }
  const atIndex = trimmed.indexOf("@");
  const localPart = atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed;
  return localPart.trim() || fallback;
}

export function InboxInvitationPopover({
  dictionary,
  hasUnreadMessages,
  localizedPath,
  messages,
  trigger,
}: {
  dictionary: {
    triggerLabel: string;
    pendingTitle: string;
    pendingDescription: string;
    emptyDescription: string;
    openInvitation: string;
    openMessage: string;
    viewAll: string;
  };
  hasUnreadMessages: boolean;
  localizedPath: (pathname: string) => string;
  messages: InboxMessage[];
  trigger?: ReactElement;
}) {
  const pendingInvitations = messages.filter(
    (message) =>
      message.actionUrl && message.projectInvitation?.status === "PENDING"
  );
  const previewMessages = (
    pendingInvitations.length > 0
      ? pendingInvitations
      : messages.filter((message) => !message.readAt)
  ).slice(0, 3);

  return (
    <Popover>
      <PopoverTrigger
        render={
          trigger ?? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              tooltip={dictionary.triggerLabel ?? "Inbox"}
              showTooltip={false}
              className="project-wing-top-bar-action-button"
            >
              <ProjectWingTopBarInboxIcon hasUnread={hasUnreadMessages}>
                <Inbox aria-hidden="true" />
              </ProjectWingTopBarInboxIcon>
            </Button>
          )
        }
      />
      <PopoverContent align="end" sideOffset={8} className="w-80">
        <PopoverHeader>
          <PopoverTitle className="text-foreground">
            {dictionary.pendingTitle}
          </PopoverTitle>
          <PopoverDescription className="text-muted-foreground">
            {previewMessages.length > 0
              ? dictionary.pendingDescription
              : dictionary.emptyDescription}
          </PopoverDescription>
        </PopoverHeader>
        {previewMessages.length > 0 ? (
          <div className="grid gap-2">
            {previewMessages.map((message) => {
              const project =
                message.project ?? message.projectInvitation?.project;
              const isInvitation =
                message.projectInvitation?.status === "PENDING";
              return (
                <div
                  key={message.id}
                  className="grid gap-2 rounded-md border border-border bg-background p-3"
                >
                  <div className="grid gap-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {message.title}
                    </p>
                    {project ? (
                      <p className="truncate text-xs font-medium text-foreground/75">
                        {project.projectCode} / {project.name}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    className="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium !text-white shadow-sm shadow-foreground/5 transition-[background-color,box-shadow,filter] hover:bg-primary/90 hover:!text-white hover:shadow-foreground/10 [&_*]:!text-white"
                    href={resolveInboxActionHref(
                      message.actionUrl ?? "/inbox",
                      localizedPath
                    )}
                  >
                    <ExternalLink data-icon="inline-start" />
                    {isInvitation
                      ? dictionary.openInvitation
                      : dictionary.openMessage}
                  </Link>
                </div>
              );
            })}
          </div>
        ) : null}
        <Separator />
        <Link
          className="inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          href={localizedPath("/inbox")}
        >
          {dictionary.viewAll}
        </Link>
      </PopoverContent>
    </Popover>
  );
}
