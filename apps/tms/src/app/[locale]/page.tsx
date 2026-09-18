import { buildApplicationHomePath } from "@project-wing/shared";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { isLocale, locales } from "@/i18n/settings";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

async function HomeRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.ReactNode> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    redirect("/zh-CN/timesheet");
  }
  redirect(buildApplicationHomePath("tms", locale));
  return null;
}

export default function TmsHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-6">
          <Skeleton className="h-10 w-48" />
        </div>
      }
    >
      <HomeRedirect params={params} />
    </Suspense>
  );
}
