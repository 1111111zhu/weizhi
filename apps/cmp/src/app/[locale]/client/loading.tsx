import { locale as rootLocale } from "next/root-params";

import { getCmpLoadingCopy } from "@/i18n/loading";
import { defaultLocale, isLocale } from "@/i18n/settings";

export default async function ClientRouteLoading() {
  const locale = await rootLocale();
  const copy = getCmpLoadingCopy(isLocale(locale) ? locale : defaultLocale);
  return (
    <main
      aria-busy="true"
      aria-label={copy.clientWorkspace}
      className="space-y-4 p-6"
    >
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-12 w-full animate-pulse rounded bg-muted" />
      <div className="h-64 w-full animate-pulse rounded bg-muted" />
    </main>
  );
}
