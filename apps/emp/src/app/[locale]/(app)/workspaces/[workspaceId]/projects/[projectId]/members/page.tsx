import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { MembersPage } from "../../../../../../../../views/members";

async function WorkspaceMembersContent({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const { workspaceId, projectId } = await params;
  return <MembersPage workspaceId={workspaceId} projectId={projectId} />;
}

export default function Page({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
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
      <WorkspaceMembersContent params={params} />
    </Suspense>
  );
}
