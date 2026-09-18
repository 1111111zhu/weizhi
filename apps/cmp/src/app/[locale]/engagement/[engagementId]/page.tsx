import { Suspense } from "react";

import { CmpRecordPreviewPage } from "@/components/cmp-record-preview-page";
import { Skeleton } from "@/components/ui/skeleton";

export const instant = false;

async function EngagementPreviewContent({
  params,
}: {
  params: Promise<{ engagementId: string }>;
}) {
  const { engagementId } = await params;
  return <CmpRecordPreviewPage kind="ENGAGEMENT" recordId={engagementId} />;
}

export default function EngagementPreviewRoute({
  params,
}: {
  params: Promise<{ engagementId: string }>;
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
      <EngagementPreviewContent params={params} />
    </Suspense>
  );
}
