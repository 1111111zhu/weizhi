export type DesktopAgentTheme = {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceHover: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentPressed: string;
  accentText: string;
  warning: string;
  danger: string;
  dangerSurface: string;
  success: string;
  shadow: string;
};

export const lightTheme: DesktopAgentTheme = {
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceMuted: "#f1f5f9",
  surfaceHover: "#e8eef5",
  border: "#dbe3ea",
  text: "#172033",
  textMuted: "#64748b",
  accent: "#15803d",
  accentPressed: "#166534",
  accentText: "#ffffff",
  warning: "#b45309",
  danger: "#b91c1c",
  dangerSurface: "#fef2f2",
  success: "#15803d",
  shadow: "#0f172a",
};

export const darkTheme: DesktopAgentTheme = {
  background: "#0f172a",
  surface: "#172033",
  surfaceMuted: "#202b3f",
  surfaceHover: "#29364d",
  border: "#334155",
  text: "#f8fafc",
  textMuted: "#9aa8bb",
  accent: "#4ade80",
  accentPressed: "#22c55e",
  accentText: "#052e16",
  warning: "#fbbf24",
  danger: "#f87171",
  dangerSurface: "#3f1d25",
  success: "#4ade80",
  shadow: "#020617",
};
