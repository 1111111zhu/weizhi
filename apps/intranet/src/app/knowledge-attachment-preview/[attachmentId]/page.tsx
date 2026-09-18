import { Suspense } from "react";

import { KnowledgeDocumentPreview } from "@/components/knowledge-document-preview";
import { Skeleton } from "@/components/ui/skeleton";

async function AttachmentPreviewContent({
  params,
  searchParams,
}: {
  params: Promise<{ attachmentId: string }>;
  searchParams: Promise<{
    fileName?: string;
    mimeType?: string;
    version?: string;
    downloadAllowed?: string;
  }>;
}) {
  const [{ attachmentId }, query] = await Promise.all([params, searchParams]);
  return (
    <KnowledgeDocumentPreview
      documentId={attachmentId}
      downloadAllowed={query.downloadAllowed !== "false"}
      fileName={query.fileName ?? "attachment"}
      mimeType={query.mimeType ?? "application/octet-stream"}
      sourceKind="attachment"
      version={query.version}
    />
  );
}

export default function KnowledgeAttachmentPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ attachmentId: string }>;
  searchParams: Promise<{
    fileName?: string;
    mimeType?: string;
    version?: string;
    downloadAllowed?: string;
  }>;
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
      <AttachmentPreviewContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
