import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";

import { ProjectWingBrowserChrome } from "@/components/project-wing-browser-chrome";

import { I18nProvider } from "../../i18n/client";
import { getDictionary } from "../../i18n/dictionaries";
import { isLocale, locales } from "../../i18n/settings";
import { defaultTheme, normalizeThemeFontSize } from "../../lib/theme";
import { Providers } from "../providers";

import "@puckeditor/core/puck.css";
import "../../styles.css";

export const metadata: Metadata = {
  title: { default: "EMP", template: "%s" },
  description: "Project Wing audit workbench",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await rootLocale();
  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);
  const initialTheme = defaultTheme;

  return (
    <html
      lang={locale}
      className={`font-size-${normalizeThemeFontSize(initialTheme.fontSize)}`}
      suppressHydrationWarning
    >
      <body>
        <ProjectWingBrowserChrome>
          <I18nProvider locale={locale} dictionary={dictionary}>
            <Providers initialTheme={initialTheme}>{children}</Providers>
          </I18nProvider>
        </ProjectWingBrowserChrome>
      </body>
    </html>
  );
}
