import { redirect } from "next/navigation";
import { Suspense } from "react";

import { TmsApp } from "@/components/tms-app";
import type { TmsWorkspace } from "@/components/tms-header";
import { Skeleton } from "@/components/ui/skeleton";
import { isLocale, locales } from "@/i18n/settings";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

async function TimesheetContent({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { locale } = await params;
  const { workspace } = await searchParams;
  if (!isLocale(locale)) {
    redirect("/zh-CN/timesheet");
  }
  return (
    <TmsApp
      locale={locale}
      initialWorkspace={parseInitialWorkspace(workspace)}
    />
  );
}

export default function TmsTimesheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ workspace?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <TimesheetContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function parseInitialWorkspace(value?: string): TmsWorkspace {
  if (value === "approvals") {
    return "APPROVALS";
  }
  if (value === "query") {
    return "QUERY";
  }
  if (value === "overview") {
    return "OVERVIEW";
  }
  return "TIMESHEET";
}
