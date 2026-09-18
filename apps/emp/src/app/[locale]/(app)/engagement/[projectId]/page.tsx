import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { WorkspacePage } from "../../../../../views/workspace";

export function generateStaticParams() {
  return [{ projectId: "project-orchid-2026" }];
}
// This project workspace is a fully interactive client-data surface and may
// wait for its project payload before rendering.
export const instant = false;

async function WorkspaceContent({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <WorkspacePage projectId={projectId} />;
}

export default function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div
          className="flex h-full w-full flex-col gap-3 p-4"
          data-testid="engagement-route-fallback"
        >
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-full min-h-96 w-full flex-1" />
        </div>
      }
    >
      <WorkspaceContent params={params} />
    </Suspense>
  );
}
