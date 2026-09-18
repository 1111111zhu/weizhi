"use client";

import {
  ConstrainedExpandableActionBar,
  DevelopmentAccountList,
  MorphPopover,
  MorphPopoverContent,
  MorphPopoverTrigger,
  MobileActionSheet,
  Button as MobileHeaderButton,
  useCompactViewport,
  PersonalSettingsGrid,
  ProjectWingTopBar,
  ProjectWingTopBarAccountPopover,
  ProjectWingTopBarActionCluster,
  ProjectWingTopBarBrand,
  ProjectWingTopBarReturnAction,
  ProjectWingTopBarStatusIcon,
  projectWingToast as toast,
} from "@project-wing/ui";
import type {
  DevelopmentAccount,
  ExpandableActionBarItem,
} from "@project-wing/ui";
import {
  CalendarDays,
  CircleUserRound,
  ClipboardCheck,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  MoonStar,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { cloneElement, useEffect, useState } from "react";
import type { ReactElement } from "react";

import { useTheme } from "@/components/theme-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  tmsRoleLabelsByLocale,
  tmsSettingsCopyByLocale,
} from "@/i18n/dictionaries";
import type { TmsSettingsCopy } from "@/i18n/dictionaries";
import type { TmsLocale } from "@/i18n/settings";
import {
  impersonateDevelopmentAccount,
  listDevelopmentAccounts,
} from "@/lib/api";
import type { User } from "@/lib/api";
import { getIntranetPortalUrl } from "@/lib/portal";
import type { ThemeFontSize } from "@/lib/theme";

import { TmsMobileHeader } from "./tms-mobile-header";

import mobileStyles from "./tms-mobile.module.css";

type TmsLanguage = "zh-CN" | "en-US";
export type TmsWorkspace = "TIMESHEET" | "APPROVALS" | "QUERY" | "OVERVIEW";

const TMS_BRAND_LINES = ["Timesheet", "Management", "System"] as const;
const DEVELOPMENT_ACCOUNT_PASSWORD = "DANGEROUS";

export function TmsHeader({
  approvalActive = false,
  approvalPending = false,
  overviewActive = false,
  queryActive = false,
  workItemsOpen = false,
  returnTarget,
  timesheetActive = false,
  onOpenApprovals,
  onOpenOverview,
  onOpenQuery,
  onToggleWorkItems,
  onOpenTimesheet,
  onReturn,
  onSignOut,
  user,
  locale = "zh-CN",
}: {
  approvalActive?: boolean;
  approvalPending?: boolean;
  overviewActive?: boolean;
  queryActive?: boolean;
  workItemsOpen?: boolean;
  returnTarget?: TmsWorkspace;
  timesheetActive?: boolean;
  onOpenApprovals?: () => void;
  onOpenOverview?: () => void;
  onOpenQuery?: () => void;
  onToggleWorkItems?: () => void;
  onOpenTimesheet?: () => void;
  onReturn?: () => void;
  onSignOut: () => void;
  user: User;
  locale?: TmsLocale;
}) {
  const { flavor, fontSize, setFlavor, setFontSize } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isMobile = useCompactViewport(767.98);
  const settingsLanguage = locale;
  const [developmentAccounts, setDevelopmentAccounts] = useState<
    DevelopmentAccount[]
  >([]);
  const [developmentAccountsLoading, setDevelopmentAccountsLoading] =
    useState(true);
  const settingsCopy = tmsSettingsCopyByLocale[settingsLanguage];
  const accountDisplayName = formatAccountDisplayName(user.name || user.email);
  const accountRank = formatAccountRank(user.globalRole, locale);
  const approvalEnabled = Boolean(onOpenApprovals);
  const returnAction = getReturnAction(
    returnTarget,
    settingsCopy,
    settingsLanguage
  );
  const headerActions: ExpandableActionBarItem[] = [
    {
      id: "portal-home",
      label: settingsCopy.returnToPortal,
      icon: <Home />,
      onClick: () => window.location.assign(getIntranetPortalUrl()),
    },
    ...(onOpenTimesheet || timesheetActive
      ? [
          {
            id: "timesheet",
            label: settingsCopy.timesheet,
            icon: <CalendarDays />,
            active: timesheetActive,
            disabled: !onOpenTimesheet && !timesheetActive,
            onClick: onOpenTimesheet,
            wrap: (button: ReactElement) =>
              cloneElement(button as ReactElement<Record<string, unknown>>, {
                "aria-current": timesheetActive ? "page" : undefined,
                "aria-pressed": timesheetActive,
              }),
          },
        ]
      : []),
    ...(onOpenApprovals || approvalActive
      ? [
          {
            id: "approvals",
            label: settingsCopy.approvals,
            icon: (
              <ProjectWingTopBarStatusIcon
                hasStatus={approvalPending && !approvalActive}
              >
                <ClipboardCheck data-testid="approval-icon" />
              </ProjectWingTopBarStatusIcon>
            ),
            active: approvalActive,
            disabled: !approvalEnabled && !approvalActive,
            onClick: onOpenApprovals,
            wrap: (button: ReactElement) =>
              cloneElement(button as ReactElement<Record<string, unknown>>, {
                "aria-current": approvalActive ? "page" : undefined,
                "aria-pressed": approvalActive,
              }),
          },
        ]
      : []),
    ...(onOpenQuery || queryActive
      ? [
          {
            id: "query",
            label: settingsCopy.search,
            icon: <Search data-testid="timesheet-query-icon" />,
            active: queryActive,
            onClick: onOpenQuery,
            wrap: (button: ReactElement) =>
              cloneElement(button as ReactElement<Record<string, unknown>>, {
                "aria-current": queryActive ? "page" : undefined,
                "aria-pressed": queryActive,
              }),
          },
        ]
      : []),
    ...(onToggleWorkItems
      ? [
          {
            id: "work-items",
            label: locale === "zh-CN" ? "TMS 待办" : "TMS Work Items",
            icon: <ClipboardList />,
            active: workItemsOpen,
            onClick: onToggleWorkItems,
            wrap: (button: ReactElement) =>
              cloneElement(button as ReactElement<Record<string, unknown>>, {
                "aria-pressed": workItemsOpen,
              }),
          },
        ]
      : []),
    ...(onOpenOverview || overviewActive
      ? [
          {
            id: "overview",
            label: settingsCopy.overview,
            icon: <LayoutDashboard />,
            active: overviewActive,
            disabled: !onOpenOverview && !overviewActive,
            onClick: onOpenOverview,
            wrap: (button: ReactElement) =>
              cloneElement(button as ReactElement<Record<string, unknown>>, {
                "aria-current": overviewActive ? "page" : undefined,
                "aria-pressed": overviewActive,
              }),
          },
        ]
      : []),
    {
      id: "settings",
      label: settingsCopy.settings,
      icon: <Settings />,
      active: settingsOpen,
      wrap: (button: ReactElement) => {
        const content = (
          <TmsPersonalSettings
            copy={settingsCopy}
            flavor={flavor}
            fontSize={fontSize}
            language={settingsLanguage}
            onFlavorChange={setFlavor}
            onFontSizeChange={setFontSize}
            onLanguageChange={(nextLocale) => {
              window.location.assign(`/${nextLocale}`);
            }}
          />
        );
        return isMobile ? (
          <>
            <MobileHeaderButton
              variant="quiet"
              size="icon"
              aria-label={settingsCopy.settings}
              onClick={() => setSettingsOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={settingsOpen}
            >
              <Settings />
            </MobileHeaderButton>
            <MobileActionSheet
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              title={settingsCopy.settings}
              closeLabel={settingsCopy.close}
            >
              {content}
            </MobileActionSheet>
          </>
        ) : (
          <MorphPopover open={settingsOpen} onOpenChange={setSettingsOpen}>
            <MorphPopoverTrigger>{button}</MorphPopoverTrigger>
            <MorphPopoverContent className="w-fit max-w-[calc(100vw-2rem)] p-4">
              {content}
            </MorphPopoverContent>
          </MorphPopover>
        );
      },
    },
  ];

  useEffect(() => {
    let active = true;
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
    try {
      await impersonateDevelopmentAccount(account.email);
      window.location.reload();
    } catch {
      toast.error(settingsCopy.signInFailed);
    }
  };
  const returnToPreviousPage = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign(getIntranetPortalUrl());
  };

  if (isMobile) {
    return (
      <TmsMobileHeader
        title={
          approvalActive
            ? settingsCopy.approvals
            : queryActive
              ? settingsCopy.search
              : overviewActive
                ? settingsCopy.overview
                : settingsCopy.timesheet
        }
        actions={headerActions}
        locale={locale}
        copy={settingsCopy}
        userName={accountDisplayName}
        userEmail={user.email}
        rank={accountRank}
        onSignOut={onSignOut}
        onReturn={returnTarget ? onReturn : undefined}
        returnLabel={returnAction?.label}
        settings={
          <TmsPersonalSettings
            mobile
            copy={settingsCopy}
            flavor={flavor}
            fontSize={fontSize}
            language={settingsLanguage}
            onFlavorChange={setFlavor}
            onFontSizeChange={setFontSize}
            onLanguageChange={(nextLocale) =>
              window.location.assign(`/${nextLocale}`)
            }
          />
        }
        accounts={
          developmentAccounts.length ? (
            <DevelopmentAccountList
              accounts={developmentAccounts}
              emptyLabel={settingsCopy.developmentAccountsEmpty}
              loading={developmentAccountsLoading}
              loadingLabel={settingsCopy.developmentAccountsLoading}
              onSelect={handleDevelopmentAccountSelect}
            />
          ) : null
        }
      />
    );
  }
  return (
    <ProjectWingTopBar
      className="sticky top-0"
      leading={
        <>
          <ProjectWingTopBarBrand lines={TMS_BRAND_LINES} />
          {returnAction && onReturn ? (
            <ProjectWingTopBarReturnAction
              label={returnAction.label}
              onClick={onReturn}
            />
          ) : (
            <ProjectWingTopBarReturnAction
              label={
                settingsLanguage === "zh-CN"
                  ? "返回上一页"
                  : "Back to previous page"
              }
              onClick={returnToPreviousPage}
            />
          )}
        </>
      }
      actions={
        <ProjectWingTopBarActionCluster>
          <ConstrainedExpandableActionBar
            items={headerActions}
            size="sm"
            classNames={{
              item: "!overflow-visible",
            }}
          />
          <ProjectWingTopBarAccountPopover
            accountAvatarName={user.name || accountDisplayName}
            accountDisplayName={accountDisplayName}
            accountLabel={settingsCopy.account}
            accountMenuLabel={settingsCopy.accountMenu}
            accountRank={accountRank}
            onSignOut={onSignOut}
            signOutIcon={<LogOut />}
            signOutLabel={settingsCopy.signOut}
            switchAccountIcon={
              developmentAccounts.length > 0 ? <CircleUserRound /> : undefined
            }
            switchAccountLabel={
              developmentAccounts.length > 0
                ? settingsCopy.switchAccount
                : undefined
            }
            switchAccountDisabled={false}
            switchAccountContent={
              developmentAccounts.length > 0 ? (
                <DevelopmentAccountList
                  accounts={developmentAccounts}
                  emptyLabel={settingsCopy.developmentAccountsEmpty}
                  loading={developmentAccountsLoading}
                  loadingLabel={settingsCopy.developmentAccountsLoading}
                  onSelect={handleDevelopmentAccountSelect}
                />
              ) : undefined
            }
            userEmail={user.email}
            panelTestId="tms-account-card"
          />
        </ProjectWingTopBarActionCluster>
      }
    />
  );
}

function getReturnAction(
  target: TmsWorkspace | undefined,
  copy: TmsSettingsCopy,
  language: TmsLanguage
) {
  if (!target) {
    return null;
  }
  const destinationLabel =
    target === "TIMESHEET"
      ? copy.timesheet
      : target === "APPROVALS"
        ? copy.approvals
        : target === "QUERY"
          ? copy.search
          : copy.overview;
  return {
    label: `${language === "zh-CN" ? "返回" : "Back to"} ${destinationLabel}`,
  };
}

type TmsPersonalSettingsProps = {
  mobile?: boolean;
  copy: TmsSettingsCopy;
  flavor: "latte" | "mocha";
  fontSize: ThemeFontSize;
  language: TmsLanguage;
  onFlavorChange: (flavor: "latte" | "mocha") => void;
  onFontSizeChange: (fontSize: ThemeFontSize) => void;
  onLanguageChange: (language: TmsLanguage) => void;
};

function TmsPersonalSettings({
  mobile = false,
  copy,
  flavor,
  fontSize,
  language,
  onFlavorChange,
  onFontSizeChange,
  onLanguageChange,
}: TmsPersonalSettingsProps) {
  if (mobile) {
    const groups = [
      {
        label: copy.language,
        value: language,
        options: getLanguageOptions(copy),
        onChange: (value: string) => onLanguageChange(value as TmsLanguage),
      },
      {
        label: copy.appearance,
        value: flavor,
        options: getAppearanceOptions(copy),
        onChange: (value: string) => onFlavorChange(value as "latte" | "mocha"),
      },
      {
        label: copy.fontSize,
        value: fontSize,
        options: getFontSizeOptions(copy),
        onChange: (value: string) => onFontSizeChange(value as ThemeFontSize),
      },
    ];
    return (
      <div className={mobileStyles.fields}>
        {groups.map((group) => (
          <div key={group.label} className={mobileStyles.fields}>
            <span className={mobileStyles.muted}>{group.label}</span>
            <fieldset
              aria-label={group.label}
              className={mobileStyles.settingsOptions}
            >
              {group.options.map((option) => (
                <MobileHeaderButton
                  key={option.value}
                  variant={
                    group.value === option.value ? "secondary" : "outline"
                  }
                  aria-pressed={group.value === option.value}
                  onClick={() => group.onChange(option.value)}
                >
                  {option.label}
                </MobileHeaderButton>
              ))}
            </fieldset>
          </div>
        ))}
      </div>
    );
  }
  return (
    <PersonalSettingsGrid
      languageLabel={copy.language}
      languageControl={
        <SettingsTabs
          label={copy.language}
          value={language}
          options={getLanguageOptions(copy)}
          onValueChange={(value) => onLanguageChange(value as TmsLanguage)}
        />
      }
      appearanceLabel={copy.appearance}
      appearanceControl={
        <SettingsTabs
          label={copy.appearance}
          value={flavor}
          options={getAppearanceOptions(copy)}
          onValueChange={(value) => onFlavorChange(value as "latte" | "mocha")}
        />
      }
      fontSizeLabel={copy.fontSize}
      fontSizeControl={
        <SettingsTabs
          label={copy.fontSize}
          value={fontSize}
          options={getFontSizeOptions(copy)}
          onValueChange={(value) => onFontSizeChange(value as ThemeFontSize)}
        />
      }
    />
  );
}

function getLanguageOptions(copy: TmsSettingsCopy) {
  return (["zh-CN", "en-US"] as const).map((value) => ({
    value,
    label: copy.languageShortOptions[value],
  }));
}

function getAppearanceOptions(copy: TmsSettingsCopy) {
  return [
    {
      value: "latte",
      label: (
        <>
          <Sun data-icon="inline-start" />
          {copy.day}
        </>
      ),
    },
    {
      value: "mocha",
      label: (
        <>
          <MoonStar data-icon="inline-start" />
          {copy.night}
        </>
      ),
    },
  ];
}

function getFontSizeOptions(copy: TmsSettingsCopy) {
  return (["sm", "md", "lg"] as ThemeFontSize[]).map((value) => ({
    value,
    label: copy.fontSizeOptions[value],
  }));
}

function SettingsTabs({
  label,
  onValueChange,
  options,
  value,
}: {
  label: string;
  onValueChange: (value: string) => void;
  options: { label: React.ReactNode; value: string }[];
  value: string;
}) {
  return (
    <Tabs
      label={label}
      value={value}
      onValueChange={onValueChange}
      className="w-fit"
    >
      <TabsList className="h-7 p-0.5">
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className="px-1.5 text-xs!"
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function formatAccountRank(globalRole?: string, locale: TmsLocale = "en-US") {
  if (!globalRole) {
    return "";
  }
  return tmsRoleLabelsByLocale[locale][globalRole] ?? globalRole;
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
