import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { DetachedDocumentPreview } from "../../../components/detached-document-preview";

async function PreviewContent({
  searchParams,
}: {
  searchParams: Promise<{ nonce?: string }>;
}) {
  const { nonce } = await searchParams;
  return <DetachedDocumentPreview nonce={nonce ?? ""} />;
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ nonce?: string }>;
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
      <PreviewContent searchParams={searchParams} />
    </Suspense>
  );
}
