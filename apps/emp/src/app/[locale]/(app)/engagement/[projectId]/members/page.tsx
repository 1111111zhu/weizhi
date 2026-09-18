import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { MembersPage } from "../../../../../../views/members";

async function MembersContent({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <MembersPage projectId={projectId} />;
}

export default function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
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
      <MembersContent params={params} />
    </Suspense>
  );
}
