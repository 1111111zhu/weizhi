"use client";

import { ProjectWingThemeProvider } from "@project-wing/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { CmpToastProvider } from "../components/cmp-toast";
import { CmpI18nProvider } from "../i18n/client";
import type { CmpLocale } from "../i18n/settings";
import { createCmpQueryClient } from "./query-client";

export function Providers({
  children,
  initialLocale = "en-US",
}: {
  children: React.ReactNode;
  initialLocale?: CmpLocale;
}) {
  const [queryClient, setQueryClient] = useState(() => createCmpQueryClient());
  void setQueryClient;

  return (
    <QueryClientProvider client={queryClient}>
      <ProjectWingThemeProvider>
        <CmpI18nProvider initialLocale={initialLocale}>
          <CmpToastProvider>{children}</CmpToastProvider>
        </CmpI18nProvider>
      </ProjectWingThemeProvider>
    </QueryClientProvider>
  );
}
