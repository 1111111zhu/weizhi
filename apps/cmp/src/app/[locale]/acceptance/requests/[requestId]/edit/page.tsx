import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { CmpAcceptanceClient } from "../../../page-client";

export const instant = false;

async function EditAcceptanceContent({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ returnTo?: string; validate?: string }>;
}) {
  const [{ requestId }, query] = await Promise.all([params, searchParams]);
  return (
    <CmpAcceptanceClient
      editRequestId={requestId}
      returnTo={query.returnTo}
      validateOnOpen={query.validate === "1"}
    />
  );
}

export default function EditAcceptanceEngagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ returnTo?: string; validate?: string }>;
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
      <EditAcceptanceContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
