import { Suspense } from "react";

import { CmpRecordPreviewPage } from "@/components/cmp-record-preview-page";
import { Skeleton } from "@/components/ui/skeleton";

async function ClientProfileContent({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <CmpRecordPreviewPage kind="CLIENT" recordId={clientId} />;
}

export default function ClientProfileRoute({
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
      <ClientProfileContent params={params} />
    </Suspense>
  );
}
