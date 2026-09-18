"use client";

import { createContext, useContext, useMemo } from "react";

import type { Dictionary } from "./dictionaries";
import { localizedPath } from "./settings";
import type { Locale } from "./settings";

type I18nContextValue = {
  locale: Locale;
  dictionary: Dictionary;
  localizedPath: (pathname: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  dictionary,
  locale,
}: {
  children: React.ReactNode;
  dictionary: Dictionary;
  locale: Locale;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dictionary,
      localizedPath: (pathname) => localizedPath(pathname, locale),
    }),
    [dictionary, locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}
