"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  Tabs as ExtendTabs,
  TabsList as ExtendTabsList,
  TabsTrigger as ExtendTabsTrigger,
} from "@/components/extend/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { api } from "../api/client";
import { useI18n } from "../i18n/client";
import { localeCookieName, locales, localizedPath } from "../i18n/settings";
import type { Locale } from "../i18n/settings";

export function LanguageSwitcher({
  variant = "select",
  labelFormat = "short",
}: {
  variant?: "select" | "tabs" | "extend-tabs";
  labelFormat?: "short" | "full";
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { dictionary, locale } = useI18n();
  const [pending, startTransition] = useTransition();
  const languageOptions = locales.map((item) => ({
    label:
      item === "zh-CN" ? dictionary.language.zhCN : dictionary.language.enUS,
    value: item,
  }));
  const selectedLanguage =
    languageOptions.find((item) => item.value === locale)?.label ?? locale;

  function selectLocale(nextLocale: Locale) {
    const query = searchParams.toString();
    const nextPath = localizedPath(
      `${pathname}${query ? `?${query}` : ""}`,
      nextLocale
    );

    void api.updatePreferredLocale(nextLocale).catch(() => null);
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => {
      window.location.assign(nextPath);
    });
  }

  if (variant === "extend-tabs") {
    return (
      <ExtendTabs
        value={locale}
        onValueChange={(value) => selectLocale(value as Locale)}
        aria-label={dictionary.language.label}
        className="gap-0"
      >
        <ExtendTabsList>
          {locales.map((item) => (
            <ExtendTabsTrigger key={item} value={item} disabled={pending}>
              {item === "zh-CN"
                ? dictionary.language.zhCNShort
                : dictionary.language.enUSShort}
            </ExtendTabsTrigger>
          ))}
        </ExtendTabsList>
      </ExtendTabs>
    );
  }

  if (variant === "tabs") {
    return (
      <Tabs
        value={locale}
        onValueChange={(value) => selectLocale(value as Locale)}
        label={dictionary.language.label}
        className="w-fit"
      >
        <TabsList>
          {locales.map((item) => (
            <TabsTrigger key={item} value={item} disabled={pending}>
              {labelFormat === "full"
                ? languageOptions.find((option) => option.value === item)?.label
                : item === "zh-CN"
                  ? dictionary.language.zhCNShort
                  : dictionary.language.enUSShort}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    );
  }

  return (
    <label className="inline-flex h-10 items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only">{dictionary.language.label}</span>
      <Select
        items={languageOptions}
        value={locale}
        disabled={pending}
        onValueChange={(value) => selectLocale(value as Locale)}
      >
        <SelectTrigger
          size="sm"
          className="w-32"
          label={dictionary.language.label}
        >
          <SelectValue>{selectedLanguage}</SelectValue>
        </SelectTrigger>
        <SelectContent align="start">
          <SelectGroup>
            {languageOptions.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
  );
}
