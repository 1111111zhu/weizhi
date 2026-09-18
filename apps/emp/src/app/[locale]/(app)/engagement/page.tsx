import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { ProjectsPage } from "../../../../views/projects";

// This project list is a fully interactive client-data surface and is not
// eligible for Next's instant-navigation validation.
export const instant = false;

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          className="flex h-full w-full flex-col gap-3 p-4"
          data-testid="engagement-list-route-fallback"
        >
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-full min-h-96 w-full flex-1" />
        </div>
      }
    >
      <ProjectsPage />
    </Suspense>
  );
}
