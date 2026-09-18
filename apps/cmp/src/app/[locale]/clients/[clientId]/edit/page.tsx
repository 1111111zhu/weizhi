import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { CmpClientsClient } from "../../page-client";

async function EditClientContent({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <CmpClientsClient formMode="edit" clientId={clientId} />;
}

export default function EditClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
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
      <EditClientContent params={params} />
    </Suspense>
  );
}
