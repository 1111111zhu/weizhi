import { defaultTheme, getThemeClassName } from "@project-wing/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import type { ReactNode } from "react";

import { CmpAuthAdapter } from "@/components/cmp-auth-adapter";
import { ProjectWingBrowserChrome } from "@/components/project-wing-browser-chrome";
import { TooltipProvider } from "@/components/ui/tooltip";

import { isLocale, locales } from "../../i18n/settings";
import { Providers } from "../providers";

import "../styles.css";

export const metadata: Metadata = {
  title: { default: "CMP", template: "%s" },
};

// CMP resolves locale and authenticated user context asynchronously at the
// layout boundary, which cannot participate in Next's development-only instant
// navigation validation. Opt out once for the CMP application subtree.
export const instant = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await rootLocale();
  if (!isLocale(locale)) {
    notFound();
  }

  const className = getThemeClassName(defaultTheme);
  return (
    <html lang={locale} className={className} suppressHydrationWarning>
      <body>
        <ProjectWingBrowserChrome>
          <TooltipProvider>
            <Providers initialLocale={locale}>
              <Suspense fallback={null}>
                <CmpAuthAdapter>{children}</CmpAuthAdapter>
              </Suspense>
            </Providers>
          </TooltipProvider>
        </ProjectWingBrowserChrome>
      </body>
    </html>
  );
}
