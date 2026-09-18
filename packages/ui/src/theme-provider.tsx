"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  defaultTheme,
  fontSizeValues,
  getThemeClassName,
  normalizeThemeAccent,
  normalizeThemeFlavor,
  normalizeThemeFontSize,
  themeCookieNames,
  themeRootClassNames,
} from "./theme";
import type { ThemeFlavor, ThemeFontSize, ThemeSettings } from "./theme";

type ThemeContextValue = ThemeSettings & {
  setFlavor: (flavor: ThemeFlavor) => void;
  setFontSize: (fontSize: ThemeFontSize) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const cookieMaxAge = 60 * 60 * 24 * 365;

function persistThemeCookie(name: string, value: string) {
  const isProductionDomain = window.location.hostname.endsWith(".superfx.cn");
  document.cookie = `${name}=${value}; path=/; max-age=${cookieMaxAge}; SameSite=Lax${
    isProductionDomain ? "; Domain=.superfx.cn" : ""
  }`;
}

function readThemeCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function applyTheme(theme: ThemeSettings) {
  document.documentElement.classList.remove(...themeRootClassNames);
  document.documentElement.classList.add(
    ...getThemeClassName(theme).split(" ")
  );
  document.documentElement.style.fontSize = fontSizeValues[theme.fontSize];
  persistThemeCookie(themeCookieNames.flavor, theme.flavor);
  persistThemeCookie(themeCookieNames.accent, theme.accent);
  persistThemeCookie(themeCookieNames.fontSize, theme.fontSize);
}

export function ProjectWingThemeProvider({
  children,
  initialTheme = defaultTheme,
}: {
  children: ReactNode;
  initialTheme?: ThemeSettings;
}) {
  const [theme, setTheme] = useState<ThemeSettings>(() => ({
    flavor: normalizeThemeFlavor(
      typeof document === "undefined"
        ? initialTheme.flavor
        : (readThemeCookie(themeCookieNames.flavor) ?? initialTheme.flavor)
    ),
    accent: normalizeThemeAccent(
      typeof document === "undefined"
        ? initialTheme.accent
        : (readThemeCookie(themeCookieNames.accent) ?? initialTheme.accent)
    ),
    fontSize: normalizeThemeFontSize(
      typeof document === "undefined"
        ? initialTheme.fontSize
        : (readThemeCookie(themeCookieNames.fontSize) ?? initialTheme.fontSize)
    ),
  }));

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...theme,
      setFlavor: (flavor) => setTheme((current) => ({ ...current, flavor })),
      setFontSize: (fontSize) =>
        setTheme((current) => ({ ...current, fontSize })),
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useProjectWingTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error(
      "useProjectWingTheme must be used within ProjectWingThemeProvider"
    );
  }
  return context;
}
