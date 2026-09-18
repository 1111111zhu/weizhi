import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { DetachedAttachmentPreview } from "../../../components/detached-attachment-preview";

async function PreviewContent({
  searchParams,
}: {
  searchParams: Promise<{ nonce?: string; sourceOrigin?: string }>;
}) {
  const { nonce, sourceOrigin } = await searchParams;
  return (
    <DetachedAttachmentPreview
      nonce={nonce ?? ""}
      sourceOrigin={sourceOrigin}
    />
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ nonce?: string; sourceOrigin?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full flex-col gap-4 p-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-full w-full" />
        </div>
      }
    >
      <PreviewContent searchParams={searchParams} />
    </Suspense>
  );
}
