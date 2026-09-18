"use client";

import {
  CMP_BUDGET_CURRENCIES,
  CMP_BUDGET_CURRENCY_LABELS,
} from "@project-wing/shared";
import type { CmpBudgetCurrency } from "@project-wing/shared";
import {
  PersonalSettingsGrid,
  Button as MobileButton,
  useCompactViewport,
  SettingsDialogShell,
  projectWingToast as toast,
} from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Coins,
  Landmark,
  LoaderCircle,
  MoonStar,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { api } from "../api/client";
import type { CurrentUser } from "../api/client";
import { useCmpI18n } from "../i18n/client";
import type { CmpDictionary, CmpLocale } from "../i18n/client";
import { BillingTemplateSettings } from "./cmp-billing/billing-template-settings";
import { Button } from "./ui/button";
import { ButtonGroup } from "./ui/button-group";
import { Input } from "./ui/input";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

type SettingsSection = "personal" | "exchange" | "templates" | "aml";

export function CmpSettingsCenter({
  flavor,
  fontSize,
  user,
  onFlavorChange,
  onFontSizeChange,
  onLocaleChange,
}: {
  flavor: "latte" | "mocha";
  fontSize: "sm" | "md" | "lg";
  user: CurrentUser;
  onFlavorChange: (flavor: "latte" | "mocha") => void;
  onFontSizeChange: (size: "sm" | "md" | "lg") => void;
  onLocaleChange: (locale: CmpLocale) => void;
}) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.shell;
  const canManageTemplates = ["PARTNER", "MANAGER", "SUPER_ADMIN"].includes(
    user.globalRole
  );
  const canManageAml = user.globalRole === "SUPER_ADMIN";
  const sections = useMemo(
    () => [
      {
        id: "personal" as const,
        icon: Settings2,
        label: copy.settingsSections.personal,
      },
      {
        id: "exchange" as const,
        icon: Coins,
        label: copy.settingsSections.exchange,
      },
      ...(canManageTemplates
        ? [
            {
              id: "templates" as const,
              icon: Landmark,
              label: copy.settingsSections.templates,
            },
          ]
        : []),
      ...(canManageAml
        ? [
            {
              id: "aml" as const,
              icon: ShieldCheck,
              label: copy.settingsSections.aml,
            },
          ]
        : []),
    ],
    [canManageAml, canManageTemplates, copy.settingsSections]
  );
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("personal");

  return (
    <SettingsDialogShell
      activeId={activeSection}
      breadcrumbRoot={copy.settings}
      items={sections}
      navigationLabel={copy.settingsNavigation}
      onActiveIdChange={setActiveSection}
    >
      {activeSection === "personal" ? (
        <CmpPersonalSettingsPage
          dictionary={dictionary}
          flavor={flavor}
          fontSize={fontSize}
          locale={locale}
          onFlavorChange={onFlavorChange}
          onFontSizeChange={onFontSizeChange}
          onLocaleChange={onLocaleChange}
        />
      ) : null}
      {activeSection === "exchange" ? (
        <CmpExchangeRateSettingsPage user={user} />
      ) : null}
      {activeSection === "templates" && canManageTemplates ? (
        <BillingTemplateSettings
          active
          embedded
          locale={locale}
          role={user.globalRole}
        />
      ) : null}
      {activeSection === "aml" && canManageAml ? <CmpAmlSettingsPage /> : null}
    </SettingsDialogShell>
  );
}

function CmpPersonalSettingsPage({
  dictionary,
  flavor,
  fontSize,
  locale,
  onFlavorChange,
  onFontSizeChange,
  onLocaleChange,
}: {
  dictionary: CmpDictionary;
  flavor: "latte" | "mocha";
  fontSize: "sm" | "md" | "lg";
  locale: CmpLocale;
  onFlavorChange: (flavor: "latte" | "mocha") => void;
  onFontSizeChange: (size: "sm" | "md" | "lg") => void;
  onLocaleChange: (locale: CmpLocale) => void;
}) {
  const copy = dictionary.shell;
  return (
    <section className="grid gap-4">
      <h3 className="text-base font-semibold text-foreground">
        {copy.settingsSections.personal}
      </h3>
      <PersonalSettingsGrid
        className="cmp-mobile-personal-settings mx-auto max-w-full"
        languageLabel={copy.language}
        languageControl={
          <CmpSettingsTabs
            label={copy.language}
            value={locale}
            options={(["zh-CN", "en-US"] as const).map((value) => ({
              value,
              label: copy.languageShortOptions[value],
            }))}
            onValueChange={(value) => onLocaleChange(value as CmpLocale)}
          />
        }
        appearanceLabel={copy.appearance}
        appearanceControl={
          <CmpSettingsTabs
            label={copy.appearance}
            value={flavor}
            options={[
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
            ]}
            onValueChange={(value) =>
              onFlavorChange(value === "mocha" ? "mocha" : "latte")
            }
          />
        }
        fontSizeLabel={copy.fontSize}
        fontSizeControl={
          <CmpSettingsTabs
            label={copy.fontSize}
            value={fontSize}
            options={(["sm", "md", "lg"] as const).map((value) => ({
              value,
              label:
                value === "sm"
                  ? copy.small
                  : value === "md"
                    ? copy.normal
                    : copy.large,
            }))}
            onValueChange={(value) =>
              onFontSizeChange(value as "sm" | "md" | "lg")
            }
          />
        }
      />
    </section>
  );
}

function CmpExchangeRateSettingsPage({ user }: { user: CurrentUser }) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.shell;
  const [currencyOrder, setCurrencyOrder] = useState<CmpBudgetCurrency[]>(() =>
    normalizeCurrencyOrder(user.cmpCurrencyOrder)
  );
  const [fallbackRate, setFallbackRate] = useState("");
  const queryClient = useQueryClient();
  const rates = useQuery({
    queryKey: ["cmp-settings-exchange-rates"],
    queryFn: api.cmpSettingsExchangeRates,
  });
  const refresh = useMutation({
    mutationFn: api.refreshCmpSettingsExchangeRates,
    onSuccess: async (data) => {
      queryClient.setQueryData(["cmp-settings-exchange-rates"], data);
      await queryClient.invalidateQueries({
        queryKey: ["cmp-budget-exchange-rates"],
      });
      toast.success(copy.exchangeRatesUpdated);
    },
    onError: () => toast.error(copy.exchangeRatesUpdateFailed),
  });
  const saveCurrencyOrder = useMutation({
    mutationFn: api.updateCmpCurrencyOrder,
    onSuccess: (updatedUser) => {
      setCurrencyOrder(normalizeCurrencyOrder(updatedUser.cmpCurrencyOrder));
      toast.success(copy.exchangeRatesOrderSaved);
    },
    onError: () => toast.error(copy.exchangeRatesOrderSaveFailed),
  });
  const saveFallback = useMutation({
    mutationFn: api.updateCmpSettingsExchangeRateFallback,
    onSuccess: async (data) => {
      queryClient.setQueryData(["cmp-settings-exchange-rates"], data);
      await queryClient.invalidateQueries({
        queryKey: ["cmp-budget-exchange-rates"],
      });
      setFallbackRate("");
      toast.success(copy.exchangeRatesFallbackSaved);
    },
    onError: () => toast.error(copy.exchangeRatesFallbackSaveFailed),
  });

  const [currencyOrderSource, setCurrencyOrderSource] = useState(
    user.cmpCurrencyOrder
  );
  if (currencyOrderSource !== user.cmpCurrencyOrder) {
    setCurrencyOrderSource(user.cmpCurrencyOrder);
    setCurrencyOrder(normalizeCurrencyOrder(user.cmpCurrencyOrder));
  }
  const { data } = rates;
  const orderedRates = data
    ? [...data.rates].sort(
        (left, right) =>
          currencyOrder.indexOf(left.currency) -
          currencyOrder.indexOf(right.currency)
      )
    : [];
  const moveCurrency = (currency: CmpBudgetCurrency, direction: -1 | 1) => {
    setCurrencyOrder((current) => {
      const index = current.indexOf(currency);
      const nextIndex = index + direction;
      if (index === -1 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      saveCurrencyOrder.mutate(next);
      return next;
    });
  };

  return (
    <section className="grid gap-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          {copy.exchangeRatesTitle}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {copy.exchangeRatesDescription}
        </p>
      </div>
      {rates.isLoading ? <Loading copy={copy.exchangeRatesLoading} /> : null}
      {rates.isError || !data ? (
        <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-4 text-center text-sm text-destructive">
          {copy.exchangeRatesLoadFailed}
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[42rem] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">
                    {copy.exchangeRatesCurrency}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {copy.exchangeRatesHkdPerUnit}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {copy.exchangeRatesUnitPerHkd}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {copy.exchangeRatesSource}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {copy.exchangeRatesOrder}
                  </th>
                </tr>
              </thead>
              <tbody>
                {orderedRates.map((rate) => (
                  <tr key={rate.currency} className="border-t border-border/70">
                    <td className="px-3 py-2.5 font-medium">
                      <span className="block">{rate.currency}</span>
                      <span className="text-xs text-muted-foreground">
                        {locale === "zh-CN"
                          ? CMP_BUDGET_CURRENCY_LABELS[rate.currency].zh
                          : CMP_BUDGET_CURRENCY_LABELS[rate.currency].en}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatExchangeRate(rate.hkdPerUnit)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatInverseExchangeRate(rate.hkdPerUnit)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {rate.source === "FALLBACK"
                        ? copy.exchangeRatesFallback
                        : rate.source === "LEGACY"
                          ? copy.exchangeRatesHistorical
                          : "HKMA"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <ButtonGroup aria-label={copy.exchangeRatesAdjustOrder}>
                        <Button
                          aria-label={`${rate.currency} ${locale === "zh-CN" ? "上移" : "move up"}`}
                          disabled={
                            saveCurrencyOrder.isPending ||
                            currencyOrder.indexOf(rate.currency) === 0
                          }
                          onClick={() => moveCurrency(rate.currency, -1)}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <ChevronUp className="size-3.5" />
                        </Button>
                        <Button
                          aria-label={`${rate.currency} ${locale === "zh-CN" ? "下移" : "move down"}`}
                          disabled={
                            saveCurrencyOrder.isPending ||
                            currencyOrder.indexOf(rate.currency) ===
                              currencyOrder.length - 1
                          }
                          onClick={() => moveCurrency(rate.currency, 1)}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <ChevronDown className="size-3.5" />
                        </Button>
                      </ButtonGroup>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-1 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
            <span>
              {copy.exchangeRatesSource}:{" "}
              {data.batch.provider === "HKMA_DAILY"
                ? copy.exchangeRatesHkma
                : copy.exchangeRatesLegacy}
            </span>
            <span>
              {copy.exchangeRatesDataDate}:{" "}
              {formatSettingsDate(data.batch.sourceDate, locale)}
            </span>
            <span>
              {copy.exchangeRatesFetchedAt}:{" "}
              {formatSettingsDateTime(data.batch.fetchedAt, locale)}
            </span>
            {data.batch.refreshedBy ? (
              <span>
                {copy.exchangeRatesUpdatedBy}: {data.batch.refreshedBy.name}
              </span>
            ) : null}
            {data.batch.stale ? (
              <span className="font-medium text-amber-700 dark:text-amber-300">
                {copy.exchangeRatesStale}
              </span>
            ) : null}
          </div>
          {data.canMaintainFallback ? (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border px-3 py-3">
              <label className="grid gap-1 text-xs font-medium">
                {copy.exchangeRatesFallbackInput}
                <Input
                  className="h-8 w-64"
                  inputMode="decimal"
                  min="0.00000001"
                  step="0.00000001"
                  type="number"
                  value={fallbackRate}
                  onChange={(event) => setFallbackRate(event.target.value)}
                />
              </label>
              <Button
                disabled={
                  saveFallback.isPending ||
                  !/^\d+(?:\.\d{1,8})?$/.test(fallbackRate) ||
                  Number(fallbackRate) <= 0
                }
                onClick={() =>
                  saveFallback.mutate({
                    currency: "VND",
                    hkdPerUnit: fallbackRate,
                  })
                }
                size="sm"
                type="button"
                variant="outline"
              >
                {copy.exchangeRatesUpdateFallback}
              </Button>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            {data.canRefresh ? (
              <Button
                type="button"
                disabled={refresh.isPending}
                onClick={() => refresh.mutate()}
              >
                <RefreshCw
                  className={
                    refresh.isPending ? "size-4 animate-spin" : "size-4"
                  }
                />
                {copy.exchangeRatesRefresh}
              </Button>
            ) : (
              <span className="self-center text-xs text-muted-foreground">
                {copy.exchangeRatesViewOnly}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function CmpAmlSettingsPage() {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.shell;
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const status = useQuery({
    queryKey: ["cmp-settings-aml"],
    queryFn: api.cmpAmlConfiguration,
  });
  const save = useMutation({
    mutationFn: api.updateCmpAmlConfiguration,
    onSuccess: (result) => {
      queryClient.setQueryData(["cmp-settings-aml"], result);
      setApiKey("");
      toast.success(copy.amlSettingsSaved);
    },
    onError: () => toast.error(copy.amlSettingsSaveFailed),
  });
  const disable = useMutation({
    mutationFn: api.disableCmpAmlConfiguration,
    onSuccess: (result) => {
      queryClient.setQueryData(["cmp-settings-aml"], result);
      setApiKey("");
      toast.success(copy.amlSettingsDisabled);
    },
    onError: () => toast.error(copy.amlSettingsDisableFailed),
  });
  const configured = status.data?.configured === true;
  const statusLabel =
    status.data?.source === "ENVIRONMENT"
      ? copy.amlSettingsEnvironment
      : configured
        ? copy.amlSettingsConfigured
        : copy.amlSettingsNotConfigured;

  return (
    <section className="grid gap-4" data-testid="cmp-aml-settings">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          {copy.amlSettingsTitle}
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {copy.amlSettingsDescription}
        </p>
      </div>
      {status.isLoading ? (
        <Loading copy={copy.amlSettingsNotConfigured} />
      ) : null}
      {status.isError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {copy.amlSettingsSaveFailed}
        </p>
      ) : null}
      {status.data ? (
        <div className="grid gap-3 rounded-xl border border-border/70 bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-foreground">
              {copy.amlSettingsTitle}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {statusLabel}
            </span>
          </div>
          {status.data.updatedAt ? (
            <dl className="grid gap-1 text-xs text-muted-foreground">
              <div>
                <dt className="inline">{copy.amlSettingsUpdatedAt}: </dt>
                <dd className="inline">
                  {formatSettingsDateTime(status.data.updatedAt, locale)}
                </dd>
              </div>
              {status.data.updatedBy ? (
                <div>
                  <dt className="inline">{copy.amlSettingsUpdatedBy}: </dt>
                  <dd className="inline">{status.data.updatedBy.name}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <label className="grid gap-1.5 text-sm font-medium">
            <span>{copy.amlSettingsApiKey}</span>
            <Input
              autoComplete="new-password"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={save.isPending || !apiKey.trim()}
              onClick={() => {
                const submittedApiKey = apiKey.trim();
                setApiKey("");
                save.mutate(submittedApiKey);
              }}
              type="button"
            >
              {configured ? copy.amlSettingsReplace : copy.amlSettingsSave}
            </Button>
            {status.data.enabled ? (
              <Button
                disabled={disable.isPending}
                onClick={() => disable.mutate()}
                type="button"
                variant="outline"
              >
                {copy.amlSettingsDisable}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Loading({ copy }: { copy: string }) {
  return (
    <div className="flex min-h-36 items-center justify-center text-sm text-muted-foreground">
      <LoaderCircle className="mr-2 size-4 animate-spin" />
      {copy}
    </div>
  );
}

function CmpSettingsTabs({
  label,
  onValueChange,
  options,
  value,
}: {
  label: string;
  onValueChange: (value: string) => void;
  options: { label: ReactNode; value: string }[];
  value: string;
}) {
  const phone = useCompactViewport(767.98);
  if (phone) {
    return (
      <fieldset className="cmp-settings-options" aria-label={label}>
        {options.map((option) => (
          <MobileButton
            key={option.value}
            variant={option.value === value ? "secondary" : "outline"}
            aria-pressed={option.value === value}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </MobileButton>
        ))}
      </fieldset>
    );
  }
  return (
    <Tabs aria-label={label} value={value} onValueChange={onValueChange}>
      <TabsList className="inline-flex h-7 w-fit grid-cols-none p-0.5">
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className="h-[calc(100%-1px)] gap-1.5 px-1.5 text-xs! has-data-[icon=inline-start]:pl-1 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function normalizeCurrencyOrder(value?: readonly string[]) {
  const valid = new Set(CMP_BUDGET_CURRENCIES);
  const preferred = (value ?? []).filter(
    (currency): currency is CmpBudgetCurrency =>
      valid.has(currency as CmpBudgetCurrency)
  );
  return [
    ...preferred,
    ...CMP_BUDGET_CURRENCIES.filter(
      (currency) => !preferred.includes(currency)
    ),
  ];
}

function formatExchangeRate(value: string) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  }).format(Number(value));
}

function formatInverseExchangeRate(value: string) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0
    ? new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 8,
      }).format(1 / rate)
    : "—";
}

function formatSettingsDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00.000Z`)
  );
}

function formatSettingsDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
