"use client";

import {
  FluentProvider,
  SSRProvider,
  webDarkTheme,
  webLightTheme,
} from "@fluentui/react-components";
import {
  defaultTheme,
  useProjectWingTheme,
  useCompactViewport,
} from "@project-wing/ui";
import type { ThemeFlavor } from "@project-wing/ui";
import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";

const intranetBrandTheme = {
  colorBrandBackground: "var(--primary)",
  colorBrandBackground2: "var(--accent)",
  colorBrandBackgroundHover: "color-mix(in oklch, var(--primary), black 8%)",
  colorBrandBackgroundPressed: "color-mix(in oklch, var(--primary), black 15%)",
  colorBrandBackgroundSelected: "var(--primary)",
  colorBrandForeground1: "var(--primary)",
  colorBrandForeground2: "var(--accent-foreground)",
  colorBrandForegroundLink: "var(--primary)",
  colorCompoundBrandBackground: "var(--primary)",
  colorCompoundBrandBackgroundHover:
    "color-mix(in oklch, var(--primary), black 8%)",
  colorCompoundBrandBackgroundPressed:
    "color-mix(in oklch, var(--primary), black 15%)",
  colorCompoundBrandForeground1: "var(--primary)",
  colorCompoundBrandStroke: "var(--primary)",
  colorBrandStroke1: "var(--primary)",
  colorBrandStroke2: "var(--accent-foreground)",
};

const intranetThemes = {
  latte: { ...webLightTheme, ...intranetBrandTheme },
  mocha: { ...webDarkTheme, ...intranetBrandTheme },
} satisfies Record<ThemeFlavor, typeof webLightTheme>;

const mobileTheme = {
  colorNeutralBackground1: "var(--md-sys-color-surface-container-lowest)",
  colorNeutralBackground2: "var(--md-sys-color-surface-container-low)",
  colorNeutralBackground3: "var(--md-sys-color-surface-container)",
  colorNeutralForeground1: "var(--md-sys-color-on-surface)",
  colorNeutralForeground2: "var(--md-sys-color-on-surface-variant)",
  colorNeutralStroke1: "var(--md-sys-color-outline)",
  colorNeutralStroke2: "var(--md-sys-color-outline-variant)",
  borderRadiusMedium: "var(--md-sys-shape-medium)",
  borderRadiusLarge: "var(--md-sys-shape-large)",
  fontFamilyBase: "var(--md-sys-typeface)",
} satisfies Partial<typeof webLightTheme>;
const mobileThemes = {
  latte: { ...intranetThemes.latte, ...mobileTheme },
  mocha: { ...intranetThemes.mocha, ...mobileTheme },
};
export function getIntranetFluentTheme(flavor: ThemeFlavor, mobile = false) {
  return mobile ? mobileThemes[flavor] : intranetThemes[flavor];
}

const subscribeToHydration = () => () => {};
const getHydratedSnapshot = () => true;
const getServerSnapshot = () => false;

export function IntranetFluentProvider({ children }: { children: ReactNode }) {
  const mobile = useCompactViewport(767);
  const { flavor } = useProjectWingTheme();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerSnapshot
  );
  const activeFlavor = hydrated ? flavor : defaultTheme.flavor;

  return (
    <SSRProvider>
      <FluentProvider
        data-intranet-fluent-theme={activeFlavor}
        theme={getIntranetFluentTheme(activeFlavor, mobile)}
      >
        {children}
      </FluentProvider>
    </SSRProvider>
  );
}
