import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { CmpEngagementsClient } from "../../page-client";

async function EditEngagementContent({
  params,
  searchParams,
}: {
  params: Promise<{ engagementId: string }>;
  searchParams: Promise<{ validate?: string }>;
}) {
  const [{ engagementId }, query] = await Promise.all([params, searchParams]);
  return (
    <CmpEngagementsClient
      formMode="edit"
      engagementId={engagementId}
      validateOnOpen={query.validate === "1"}
    />
  );
}

export default function EditEngagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ engagementId: string }>;
  searchParams: Promise<{ validate?: string }>;
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
      <EditEngagementContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
