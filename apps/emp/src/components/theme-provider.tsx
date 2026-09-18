"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  defaultTheme,
  fontSizeClassNames,
  fontSizeValues,
  themeCookieNames,
} from "../lib/theme";
import type { ThemeFontSize, ThemeSettings } from "../lib/theme";

type FontSizeContextValue = {
  fontSize: ThemeFontSize;
  setFontSize: (fontSize: ThemeFontSize) => void;
  useNativePdfViewer: boolean;
  setUseNativePdfViewer: (enabled: boolean) => void;
};

type ThemeContextValue = FontSizeContextValue & {
  mounted: boolean;
  resolvedTheme?: "dark" | "light";
  setTheme: (theme: string) => void;
  theme: "dark" | "light" | "system";
};

const FontSizeContext = createContext<FontSizeContextValue | null>(null);
const ThemeContext = createContext<ThemeContextValue | null>(null);
const cookieMaxAge = 60 * 60 * 24 * 365;
const colorThemes = ["light", "dark", "system"] as const;
type ColorTheme = (typeof colorThemes)[number];

function isColorTheme(theme: string | null): theme is ColorTheme {
  return colorThemes.includes(theme as ColorTheme);
}

function resolveColorTheme(theme: ColorTheme): "dark" | "light" {
  if (theme !== "system") {
    return theme;
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function persistFontSize(fontSize: ThemeFontSize) {
  document.cookie = `${themeCookieNames.fontSize}=${fontSize}; path=/; max-age=${cookieMaxAge}; SameSite=Lax`;
}

function persistNativePdfViewer(enabled: boolean) {
  document.cookie = `${themeCookieNames.useNativePdfViewer}=${enabled}; path=/; max-age=${cookieMaxAge}; SameSite=Lax`;
}

function readNativePdfViewerPreference() {
  const prefix = `${themeCookieNames.useNativePdfViewer}=`;
  return (
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length) === "true"
  );
}

function applyFontSize(fontSize: ThemeFontSize) {
  document.documentElement.classList.remove(...fontSizeClassNames);
  document.documentElement.classList.add(`font-size-${fontSize}`);
  document.documentElement.style.fontSize = fontSizeValues[fontSize];
  persistFontSize(fontSize);
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme?: Partial<ThemeSettings>;
}) {
  const resolvedInitialTheme = { ...defaultTheme, ...initialTheme };
  const [fontSize, setFontSize] = useState(resolvedInitialTheme.fontSize);
  const [useNativePdfViewer, setUseNativePdfViewer] = useState(
    resolvedInitialTheme.useNativePdfViewer
  );
  const [theme, setThemeState] = useState<ColorTheme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">();

  useEffect(() => {
    applyFontSize(fontSize);
  }, [fontSize]);

  useEffect(() => {
    setUseNativePdfViewer(readNativePdfViewerPreference());
  }, []);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme");
    if (isColorTheme(storedTheme)) {
      setThemeState(storedTheme);
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const nextResolvedTheme = resolveColorTheme(theme);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(nextResolvedTheme);
      document.documentElement.style.colorScheme = nextResolvedTheme;
      setResolvedTheme(nextResolvedTheme);
    };

    applyTheme();
    if (theme !== "system" || !media) {
      return;
    }
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: string) => {
    if (!isColorTheme(nextTheme)) {
      return;
    }
    setThemeState(nextTheme);
    window.localStorage.setItem("theme", nextTheme);
  }, []);

  const updateNativePdfViewer = useCallback((enabled: boolean) => {
    setUseNativePdfViewer(enabled);
    persistNativePdfViewer(enabled);
  }, []);
  const value = useMemo(
    () => ({
      fontSize,
      setFontSize,
      useNativePdfViewer,
      setUseNativePdfViewer: updateNativePdfViewer,
    }),
    [fontSize, updateNativePdfViewer, useNativePdfViewer]
  );

  return (
    <FontSizeContext.Provider value={value}>
      <ThemeState
        resolvedTheme={resolvedTheme}
        setTheme={setTheme}
        theme={theme}
      >
        {children}
      </ThemeState>
    </FontSizeContext.Provider>
  );
}

function ThemeState({
  children,
  resolvedTheme,
  setTheme,
  theme,
}: {
  children: React.ReactNode;
  resolvedTheme?: "dark" | "light";
  setTheme: (theme: string) => void;
  theme: ColorTheme;
}) {
  const [mounted, setMounted] = useState(false);
  const fontSize = useContext(FontSizeContext);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!fontSize) {
    throw new Error("ThemeState must be used within FontSizeContext");
  }

  const themeContextValue = useMemo(
    () => ({
      ...fontSize,
      mounted,
      resolvedTheme,
      setTheme,
      theme,
    }),
    [fontSize, mounted, resolvedTheme, setTheme, theme]
  );

  return (
    <ThemeContext.Provider value={themeContextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export function useNativePdfViewerPreference() {
  const context = useContext(ThemeContext);
  return {
    useNativePdfViewer: context?.useNativePdfViewer ?? false,
  };
}
