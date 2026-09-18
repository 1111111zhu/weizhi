export const themeFontSizes = ["sm", "md", "lg"] as const;

export type ThemeFontSize = (typeof themeFontSizes)[number];

export type ThemeSettings = {
  fontSize: ThemeFontSize;
  useNativePdfViewer: boolean;
};

export const defaultTheme: ThemeSettings = {
  fontSize: "md",
  useNativePdfViewer: false,
};

export const themeCookieNames = {
  fontSize: "project-wing-font-size",
  useNativePdfViewer: "project-wing-native-pdf-viewer",
} as const;

export const fontSizeClassNames = themeFontSizes.map(
  (item) => `font-size-${item}`
);

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

export function normalizeThemeFontSize(value?: string | null): ThemeFontSize {
  return themeFontSizes.includes(value as ThemeFontSize)
    ? (value as ThemeFontSize)
    : defaultTheme.fontSize;
}
