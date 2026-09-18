export const themeFlavors = ["latte", "mocha"] as const;

export type ThemeFlavor = (typeof themeFlavors)[number];

export const themeAccents = ["lime"] as const;

export type ThemeAccent = (typeof themeAccents)[number];

export const themeFontSizes = ["sm", "md", "lg"] as const;

export type ThemeFontSize = (typeof themeFontSizes)[number];

export type ThemeSettings = {
  flavor: ThemeFlavor;
  accent: ThemeAccent;
  fontSize: ThemeFontSize;
};

export const defaultTheme: ThemeSettings = {
  flavor: "latte",
  accent: "lime",
  fontSize: "md",
};

export const themeCookieNames = {
  flavor: "project-wing-theme-flavor",
  accent: "project-wing-theme-accent",
  fontSize: "project-wing-font-size",
} as const;

export const themeRootClassNames = [
  "dark",
  "accent-lime",
  ...themeFontSizes.map((item) => `font-size-${item}`),
] as const;

export const fontSizeValues: Record<ThemeFontSize, string> = {
  sm: "14px",
  md: "16px",
  lg: "18px",
};

export const fontSizeLabels: Record<ThemeFontSize, string> = {
  sm: "Small",
  md: "Medium",
  lg: "Large",
};

export function normalizeThemeFlavor(value?: string | null): ThemeFlavor {
  return themeFlavors.includes(value as ThemeFlavor)
    ? (value as ThemeFlavor)
    : defaultTheme.flavor;
}

export function normalizeThemeAccent(_value?: string | null): ThemeAccent {
  return defaultTheme.accent;
}

export function normalizeThemeFontSize(value?: string | null): ThemeFontSize {
  return themeFontSizes.includes(value as ThemeFontSize)
    ? (value as ThemeFontSize)
    : defaultTheme.fontSize;
}

export function getThemeClassName({ flavor, fontSize }: ThemeSettings) {
  return [
    flavor === "mocha" ? "dark" : null,
    `accent-${defaultTheme.accent}`,
    `font-size-${fontSize}`,
  ]
    .filter((item): item is string => Boolean(item))
    .join(" ");
}
