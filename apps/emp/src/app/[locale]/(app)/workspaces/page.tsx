import { redirect } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { isLocale, localizedPath } from "../../../../i18n/settings";

async function WorkspacesRedirect(): Promise<React.ReactNode> {
  const locale = await rootLocale();
  redirect(localizedPath("/engagement", isLocale(locale) ? locale : "zh-CN"));
  return null;
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-6">
          <Skeleton className="h-10 w-48" />
        </div>
      }
    >
      <WorkspacesRedirect />
    </Suspense>
  );
}
