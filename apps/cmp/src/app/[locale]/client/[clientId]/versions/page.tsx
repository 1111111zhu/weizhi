import { Suspense } from "react";

import { CmpClientVersionHistoryPage } from "@/components/cmp-client-version-history-page";
import { Skeleton } from "@/components/ui/skeleton";

export const instant = false;

async function ClientVersionsContent({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <CmpClientVersionHistoryPage clientId={clientId} />;
}

export default function CmpClientVersionsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
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
      <ClientVersionsContent params={params} />
    </Suspense>
  );
}
