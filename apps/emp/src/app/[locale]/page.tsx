import { buildApplicationHomePath } from "@project-wing/shared";
import { redirect } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { isLocale } from "../../i18n/settings";

async function HomeRedirect(): Promise<React.ReactNode> {
  const locale = await rootLocale();
  redirect(
    buildApplicationHomePath("emp", isLocale(locale) ? locale : "zh-CN")
  );
  return null;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-6">
          <Skeleton className="h-10 w-48" />
        </div>
      }
    >
      <HomeRedirect />
    </Suspense>
  );
}
