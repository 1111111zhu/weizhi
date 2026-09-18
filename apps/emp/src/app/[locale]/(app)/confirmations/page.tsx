import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { ConfirmationsPage } from "../../../../views/confirmations";

// This screen is a fully interactive client-data workspace. It intentionally
// opts out of Next's instant-shell warning until its data is server-cached.
export const instant = false;

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          className="flex h-full w-full flex-col gap-3 p-4"
          data-testid="confirmations-route-fallback"
        >
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-full min-h-96 w-full flex-1" />
        </div>
      }
    >
      <ConfirmationsPage />
    </Suspense>
  );
}
