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
  ProjectWingTopBarAvatar,
  ProjectWingTopBarBrand,
  ProjectWingTopBarSearch,
  useProjectWingTheme,
} from "@project-wing/ui";
import type { DevelopmentAccount, ThemeFontSize } from "@project-wing/ui";
import {
  ArrowLeft,
  CircleUserRound,
  LogOut,
  MoonStar,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { intranetDictionaries, intranetLanguages } from "@/i18n/dictionaries";
import type { IntranetDictionary } from "@/i18n/dictionaries";
import { localeCookieName } from "@/i18n/settings";
import type { IntranetLocale } from "@/i18n/settings";
import {
  intranetAuthAdapter,
  listIntranetDevelopmentAccounts,
} from "@/lib/auth-client";
import type { IntranetCurrentAccount } from "@/lib/current-user";
import { INTRANET_MOBILE_MAX_WIDTH } from "@/lib/mobile-navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const AUTH_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? API_BASE_URL;
const DEVELOPMENT_ACCOUNT_PASSWORD = "DANGEROUS";
const INTRANET_BRAND_LINES = ["Wing", "Zenith", "Intranet"] as const;
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function IntranetTopBar({
  account,
  copy,
  locale,
  onQueryChange,
  query,
  showSearch = true,
  mobileTitle,
  onMobileBack,
  searchLabel,
}: {
  account: IntranetCurrentAccount | null;
  copy: IntranetDictionary;
  locale: IntranetLocale;
  onQueryChange: (value: string) => void;
  query: string;
  showSearch?: boolean;
  mobileTitle?: string;
  onMobileBack?: () => void;
  searchLabel?: string;
}) {
  const router = useRouter();
  const { flavor, fontSize, setFlavor, setFontSize } = useProjectWingTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isMobile = useCompactViewport(INTRANET_MOBILE_MAX_WIDTH);
  const [developmentAccounts, setDevelopmentAccounts] = useState<
    DevelopmentAccount[]
  >([]);
  const [developmentAccountsLoading, setDevelopmentAccountsLoading] =
    useState(true);
  const settingsDictionary =
    locale === "zh-CN" ? intranetDictionaries.zhCN : intranetDictionaries.enUS;
  const settingsCopy = settingsDictionary.settings;
  const accountCopy = settingsDictionary.account;

  useEffect(() => {
    let active = true;
    void listIntranetDevelopmentAccounts()
      .then((accounts) => {
        if (active) {
          setDevelopmentAccounts(
            accounts.map((developmentAccount) => ({
              ...developmentAccount,
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

  const accountDisplayName =
    account?.name || account?.email || copy.brand.userInitials;
  const accountRank = account?.globalRole?.replaceAll("_", " ");
  const actionItems = [
    {
      id: "settings",
      label: settingsCopy.title,
      icon: <Settings aria-hidden="true" />,
      active: settingsOpen,
      wrap: (button: ReactElement) => {
        const content = (
          <IntranetPersonalSettings
            copy={settingsCopy}
            flavor={flavor}
            fontSize={fontSize}
            language={locale}
            onFlavorChange={setFlavor}
            onFontSizeChange={setFontSize}
            onLanguageChange={(nextLocale) => {
              // oxlint-disable-next-line unicorn/no-document-cookie -- Locale support matches the login flow and must work where Cookie Store is unavailable.
              document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
              router.replace(
                `${replacePathLocale(window.location.pathname, nextLocale)}${window.location.search}${window.location.hash}`
              );
              setSettingsOpen(false);
            }}
          />
        );
        return isMobile ? (
          <>
            <MobileHeaderButton
              variant="quiet"
              size="icon"
              aria-label={settingsCopy.title}
              onClick={() => setSettingsOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={settingsOpen}
            >
              <Settings />
            </MobileHeaderButton>
            <MobileActionSheet
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              title={settingsCopy.title}
              closeLabel={copy.knowledge.notice.close}
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
  const handleSignOut = async () => {
    try {
      await signOutFromIntranet();
    } finally {
      window.location.assign("/");
    }
  };
  const handleDevelopmentAccountSelect = async (
    selectedAccount: DevelopmentAccount
  ) => {
    await intranetAuthAdapter.impersonateDevelopmentAccount?.(
      selectedAccount.email
    );
    window.location.reload();
  };

  return (
    <ProjectWingTopBar
      centerPriority
      className="sticky top-0"
      leading={
        isMobile && mobileTitle ? (
          <div className="intranet-mobile-heading">
            {onMobileBack ? (
              <MobileHeaderButton
                variant="quiet"
                size="icon"
                aria-label={copy.mobile.back}
                onClick={onMobileBack}
              >
                <ArrowLeft />
              </MobileHeaderButton>
            ) : null}
            <h1 tabIndex={-1}>{mobileTitle}</h1>
          </div>
        ) : (
          <ProjectWingTopBarBrand
            className="intranet-top-bar-brand"
            lines={INTRANET_BRAND_LINES}
          />
        )
      }
      center={
        showSearch ? (
          <ProjectWingTopBarSearch
            ariaLabel={searchLabel ?? copy.search.label}
            icon={<Search aria-hidden="true" />}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        ) : undefined
      }
      actions={
        <ProjectWingTopBarActionCluster>
          <ConstrainedExpandableActionBar
            items={actionItems}
            label={settingsCopy.title}
            size="sm"
          />
          {account ? (
            <ProjectWingTopBarAccountPopover
              accountAvatarName={account.name || account.email}
              accountDisplayName={accountDisplayName}
              accountLabel={accountCopy.current}
              accountMenuLabel={accountCopy.menu}
              accountRank={accountRank}
              onSignOut={handleSignOut}
              signOutIcon={<LogOut data-icon="inline-start" />}
              signOutLabel={accountCopy.signOut}
              switchAccountIcon={
                developmentAccounts.length > 0 ? (
                  <CircleUserRound data-icon="inline-start" />
                ) : undefined
              }
              switchAccountLabel={
                developmentAccounts.length > 0
                  ? accountCopy.switchAccount
                  : undefined
              }
              switchAccountDisabled={false}
              switchAccountContent={
                developmentAccounts.length > 0 ? (
                  <DevelopmentAccountList
                    accounts={developmentAccounts}
                    emptyLabel={accountCopy.developmentAccountsEmpty}
                    loading={developmentAccountsLoading}
                    loadingLabel={accountCopy.developmentAccountsLoading}
                    onSelect={handleDevelopmentAccountSelect}
                  />
                ) : undefined
              }
              userEmail={account.email}
            />
          ) : (
            <ProjectWingTopBarAvatar
              label={copy.brand.userInitials}
              name={copy.brand.userInitials}
              size="sm"
            />
          )}
        </ProjectWingTopBarActionCluster>
      }
    />
  );
}

type IntranetSettingsCopy = IntranetDictionary["settings"];
type IntranetPersonalSettingsProps = {
  copy: IntranetSettingsCopy;
  flavor: "latte" | "mocha";
  fontSize: ThemeFontSize;
  language: IntranetLocale;
  onFlavorChange: (flavor: "latte" | "mocha") => void;
  onFontSizeChange: (fontSize: ThemeFontSize) => void;
  onLanguageChange: (language: IntranetLocale) => void;
};

function IntranetPersonalSettings({
  copy,
  flavor,
  fontSize,
  language,
  onFlavorChange,
  onFontSizeChange,
  onLanguageChange,
}: IntranetPersonalSettingsProps) {
  return (
    <PersonalSettingsGrid
      className="intranet-personal-settings"
      languageLabel={copy.language}
      languageControl={
        <SettingsTabs
          label={copy.language}
          value={language}
          options={getLanguageOptions(copy)}
          onValueChange={(value) => onLanguageChange(value as IntranetLocale)}
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

function getLanguageOptions(copy: IntranetSettingsCopy) {
  return intranetLanguages.map((value) => ({
    value,
    label: copy.languageShortOptions[value],
  }));
}

function getAppearanceOptions(copy: IntranetSettingsCopy) {
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

function getFontSizeOptions(copy: IntranetSettingsCopy) {
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
      aria-label={label}
      value={value}
      onValueChange={onValueChange}
      className="w-fit"
    >
      <TabsList className="h-7 p-0.5">
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className="px-1.5 text-xs! max-md:text-[length:var(--md-sys-type-label-large)]!"
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function replacePathLocale(
  pathname: string,
  nextLocale: IntranetLocale
) {
  const segments = pathname.split("/");
  if (intranetLanguages.includes(segments[1] as IntranetLocale)) {
    segments[1] = nextLocale;
  } else {
    segments.splice(1, 0, nextLocale);
  }
  return segments.join("/") || `/${nextLocale}`;
}

async function signOutFromIntranet() {
  const response = await fetch(
    `${AUTH_BASE_URL.replace(/\/+$/, "")}/auth/sign-out`,
    {
      credentials: "include",
      method: "POST",
    }
  );
  if (!response.ok) {
    throw new Error(`Authentication request failed (${response.status})`);
  }
}
