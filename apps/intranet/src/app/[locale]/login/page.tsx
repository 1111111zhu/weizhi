import {
  buildApplicationHomePath,
  buildLocalizedLoginPath,
} from "@project-wing/shared";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { isLocale, locales } from "@/i18n/settings";
import { getCurrentAccount } from "@/lib/current-user";

import { IntranetLoginPage } from "../../login/page-client";

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
  if (await getCurrentAccount()) {
    redirect(buildApplicationHomePath("intranet", locale));
  }
  return <IntranetLoginPage locale={locale} />;
}

export default function LoginPage({
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
