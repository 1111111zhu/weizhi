import { colors1 } from "./registry-colors-1";
import { colors2 } from "./registry-colors-2";
import { colors3 } from "./registry-colors-3";
import { colors4 } from "./registry-colors-4";
import { colors5 } from "./registry-colors-5";
import { colors6 } from "./registry-colors-6";
import { colors7 } from "./registry-colors-7";
import { colors8 } from "./registry-colors-8";

export const colors = {
  ...colors1,
  ...colors2,
  ...colors3,
  ...colors4,
  ...colors5,
  ...colors6,
  ...colors7,
  ...colors8,
} as const;

export const colorMapping = {
  dark: {
    accent: "{{base}}-800",
    "accent-foreground": "{{base}}-50",
    background: "{{base}}-950",
    border: "{{base}}-800",
    card: "{{base}}-950",
    "card-foreground": "{{base}}-50",
    "chart-1": "220 70% 50%",
    "chart-2": "160 60% 45%",
    "chart-3": "30 80% 55%",
    "chart-4": "280 65% 60%",
    "chart-5": "340 75% 55%",
    destructive: "red-900",
    "destructive-foreground": "{{base}}-50",
    foreground: "{{base}}-50",
    input: "{{base}}-800",
    muted: "{{base}}-800",
    "muted-foreground": "{{base}}-400",
    popover: "{{base}}-950",
    "popover-foreground": "{{base}}-50",
    primary: "{{base}}-50",
    "primary-foreground": "{{base}}-900",
    ring: "{{base}}-300",
    secondary: "{{base}}-800",
    "secondary-foreground": "{{base}}-50",
  },
  light: {
    accent: "{{base}}-100",
    "accent-foreground": "{{base}}-900",
    background: "white",
    border: "{{base}}-200",
    card: "white",
    "card-foreground": "{{base}}-950",
    "chart-1": "12 76% 61%",
    "chart-2": "173 58% 39%",
    "chart-3": "197 37% 24%",
    "chart-4": "43 74% 66%",
    "chart-5": "27 87% 67%",
    destructive: "red-500",
    "destructive-foreground": "{{base}}-50",
    foreground: "{{base}}-950",
    input: "{{base}}-200",
    muted: "{{base}}-100",
    "muted-foreground": "{{base}}-500",
    popover: "white",
    "popover-foreground": "{{base}}-950",
    primary: "{{base}}-900",
    "primary-foreground": "{{base}}-50",
    ring: "{{base}}-950",
    secondary: "{{base}}-100",
    "secondary-foreground": "{{base}}-900",
  },
} as const;
