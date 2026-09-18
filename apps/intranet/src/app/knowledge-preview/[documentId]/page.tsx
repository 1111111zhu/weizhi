import { Suspense } from "react";

import { KnowledgeDocumentPreview } from "@/components/knowledge-document-preview";
import { Skeleton } from "@/components/ui/skeleton";

async function KnowledgePreviewContent({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{
    fileName?: string;
    mimeType?: string;
    version?: string;
    downloadAllowed?: string;
  }>;
}) {
  const [{ documentId }, query] = await Promise.all([params, searchParams]);
  return (
    <KnowledgeDocumentPreview
      documentId={documentId}
      downloadAllowed={query.downloadAllowed !== "false"}
      fileName={query.fileName ?? "document"}
      mimeType={query.mimeType ?? "application/octet-stream"}
      version={query.version}
    />
  );
}

export default function KnowledgePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
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
      <KnowledgePreviewContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
