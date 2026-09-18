import { buildLocalizedLoginPath } from "@project-wing/shared";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { TmsApp } from "@/components/tms-app";
import { Skeleton } from "@/components/ui/skeleton";
import { isLocale, locales } from "@/i18n/settings";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

async function LoginContent({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    redirect(buildLocalizedLoginPath("zh-CN"));
  }
  return <TmsApp locale={locale} loginOnly />;
}

export default function TmsLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6">
          <Skeleton className="h-96 w-full max-w-md" />
        </div>
      }
    >
      <LoginContent params={params} />
    </Suspense>
  );
}
