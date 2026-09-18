import {
  ProjectWingThemeProvider,
  ProjectWingToaster,
  defaultTheme,
  getThemeClassName,
} from "@project-wing/ui";
import type { Metadata } from "next";

import "./styles.css";
import type { ReactNode } from "react";

import { IntranetFluentProvider } from "@/components/intranet-fluent-provider";
import { ProjectWingBrowserChrome } from "@/components/project-wing-browser-chrome";
import { intranetDictionaries } from "@/i18n/dictionaries";

export const metadata: Metadata = {
  title: { default: "Intranet", template: "%s" },
  description: intranetDictionaries.zhCN.metadata.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const locale = "zh-CN";
  const initialTheme = defaultTheme;
  const themeClassName = getThemeClassName(initialTheme);

  return (
    <html lang={locale} className={themeClassName} suppressHydrationWarning>
      <body>
        <ProjectWingBrowserChrome>
          <ProjectWingThemeProvider initialTheme={initialTheme}>
            <IntranetFluentProvider>
              {children}
              <ProjectWingToaster />
            </IntranetFluentProvider>
          </ProjectWingThemeProvider>
        </ProjectWingBrowserChrome>
      </body>
    </html>
  );
}
