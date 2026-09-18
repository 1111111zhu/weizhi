"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  defaultTheme,
  fontSizeValues,
  getThemeClassName,
  normalizeThemeAccent,
  normalizeThemeFlavor,
  normalizeThemeFontSize,
  themeCookieNames,
  themeRootClassNames,
} from "@/lib/theme";
import type { ThemeFlavor, ThemeFontSize, ThemeSettings } from "@/lib/theme";

type ThemeContextValue = ThemeSettings & {
  setFlavor: (flavor: ThemeFlavor) => void;
  setFontSize: (fontSize: ThemeFontSize) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const cookieMaxAge = 60 * 60 * 24 * 365;

function persistThemeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${cookieMaxAge}; SameSite=Lax`;
}

function readThemeCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function readBrowserTheme(current: ThemeSettings): ThemeSettings {
  return {
    flavor: normalizeThemeFlavor(
      readThemeCookie(themeCookieNames.flavor) ?? current.flavor
    ),
    accent: normalizeThemeAccent(
      readThemeCookie(themeCookieNames.accent) ?? current.accent
    ),
    fontSize: normalizeThemeFontSize(
      readThemeCookie(themeCookieNames.fontSize) ?? current.fontSize
    ),
  };
}

function isSameTheme(left: ThemeSettings, right: ThemeSettings) {
  return (
    left.flavor === right.flavor &&
    left.accent === right.accent &&
    left.fontSize === right.fontSize
  );
}

function applyTheme({ flavor, fontSize }: ThemeSettings) {
  document.documentElement.classList.remove(...themeRootClassNames);
  document.documentElement.classList.add(
    ...getThemeClassName({
      flavor,
      accent: defaultTheme.accent,
      fontSize,
    }).split(" ")
  );
  document.documentElement.style.fontSize = fontSizeValues[fontSize];
  persistThemeCookie(themeCookieNames.flavor, flavor);
  persistThemeCookie(themeCookieNames.accent, defaultTheme.accent);
  persistThemeCookie(themeCookieNames.fontSize, fontSize);
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme: ThemeSettings;
}) {
  const syncedBrowserCookies = useRef(false);
  const [theme, setTheme] = useState<ThemeSettings>({
    ...initialTheme,
    accent: defaultTheme.accent,
  });

  useEffect(() => {
    if (!syncedBrowserCookies.current) {
      syncedBrowserCookies.current = true;
      const browserTheme = readBrowserTheme(theme);
      if (!isSameTheme(theme, browserTheme)) {
        setTheme(browserTheme);
        return;
      }
    }
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

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
