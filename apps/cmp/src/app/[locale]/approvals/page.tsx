import { notFound, redirect } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { isLocale, localizedPath } from "../../../i18n/settings";

async function ApprovalsRedirect(): Promise<React.ReactNode> {
  const locale = await rootLocale();
  if (!isLocale(locale)) {
    notFound();
  }
  redirect(localizedPath("/acceptance?tab=approvals", locale));
  return null;
}

export default function ApprovalsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-6">
          <Skeleton className="h-10 w-48" />
        </div>
      }
    >
      <ApprovalsRedirect />
    </Suspense>
  );
}
