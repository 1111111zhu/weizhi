import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ProjectTemplateFileDetailPage } from "@/views/template-detail";

async function TemplateFileDetailContent({
  params,
}: {
  params: Promise<{ fileId: string; templateId: string }>;
}) {
  const { fileId, templateId } = await params;
  return (
    <ProjectTemplateFileDetailPage fileId={fileId} templateId={templateId} />
  );
}

export default function Page({
  params,
}: {
  params: Promise<{ fileId: string; templateId: string }>;
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
      <TemplateFileDetailContent params={params} />
    </Suspense>
  );
}
