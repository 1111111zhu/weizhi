import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { WorkspacePage } from "../../../../../../../views/workspace";

async function WorkspaceContent({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const { workspaceId, projectId } = await params;
  return <WorkspacePage workspaceId={workspaceId} projectId={projectId} />;
}

export default function Page({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full flex-col gap-3 p-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-full min-h-96 w-full flex-1" />
        </div>
      }
    >
      <WorkspaceContent params={params} />
    </Suspense>
  );
}
