import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { CmpClientsClient } from "../clients/page-client";

// This route delegates to a client workspace that resolves auth and data after
// navigation, so it cannot participate in Next's development-only validation.
export const instant = false;

export default function CmpClientPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex h-full w-full flex-col gap-3 p-4"
          data-testid="cmp-client-route-fallback"
        >
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-full min-h-96 w-full flex-1" />
        </div>
      }
    >
      <CmpClientsClient />
    </Suspense>
  );
}
