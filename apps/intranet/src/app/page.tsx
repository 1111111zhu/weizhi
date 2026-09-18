import { buildApplicationHomePath } from "@project-wing/shared";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { defaultLocale } from "@/i18n/settings";

function HomeRedirect(): React.ReactNode {
  redirect(buildApplicationHomePath("intranet", defaultLocale));
  return null;
}

export default function IntranetHomePage() {
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
