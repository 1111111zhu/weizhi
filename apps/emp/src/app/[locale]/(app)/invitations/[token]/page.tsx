import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { InvitationPage } from "../../../../../views/invitation";

async function InvitationContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InvitationPage token={token} />;
}

export default function Page({
  params,
}: {
  params: Promise<{ token: string }>;
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
      <InvitationContent params={params} />
    </Suspense>
  );
}
