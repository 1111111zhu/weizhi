"use client";

import { useQuery } from "@tanstack/react-query";
import { FileImage, FileText, RotateCw } from "lucide-react";
import { useEffect, useMemo } from "react";

import { PDFViewer } from "@/components/extend/pdf-viewer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { showErrorToast } from "@/lib/error-toast";
import {
  PREVIEW_QUERY_GC_TIME_MS,
  PREVIEW_QUERY_META,
  PREVIEW_QUERY_STALE_TIME_MS,
} from "@/lib/preview-query-cache";

import { api } from "../../api/client";
import type { ProjectConfirmationResponseArtifact } from "../../api/client";

export function ConfirmationResponsePreview({
  artifact,
  projectId,
  confirmationId,
  responseId,
  copy,
}: {
  artifact: ProjectConfirmationResponseArtifact;
  projectId: string;
  confirmationId: string;
  responseId: string;
  copy: {
    loadError: string;
    loading: string;
    retry: string;
  };
}) {
  const preview = useQuery({
    queryKey: [
      "confirmation-response-artifact-preview",
      projectId,
      confirmationId,
      responseId,
      artifact.id,
    ],
    queryFn: () =>
      api.projectConfirmationResponseArtifact(
        projectId,
        confirmationId,
        responseId,
        artifact.id
      ),
    retry: false,
    staleTime: PREVIEW_QUERY_STALE_TIME_MS,
    gcTime: PREVIEW_QUERY_GC_TIME_MS,
    meta: PREVIEW_QUERY_META,
  });
  const previewUrl = useObjectUrl(preview.data);

  useEffect(() => {
    if (preview.error) {
      showErrorToast(preview.error, copy.loadError);
    }
  }, [copy.loadError, preview.error]);

  if (preview.isError) {
    return (
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="grid h-full min-h-0 place-items-center bg-muted/30 p-6 text-center">
          <div>
            <FileText className="mx-auto size-8 text-muted-foreground" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                preview.refetch();
              }}
            >
              <RotateCw />
              {copy.retry}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!previewUrl) {
    return (
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-6">
        <div
          aria-busy="true"
          aria-label={copy.loading}
          className="flex h-full flex-col gap-3"
        >
          <Skeleton className="h-6 w-1/4 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="w-full flex-1 rounded-md" />
        </div>
      </div>
    );
  }

  if (artifact.mimeType.startsWith("image/")) {
    return (
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="grid h-full min-h-0 place-items-center overflow-auto bg-muted/30 p-4">
          <img
            src={previewUrl}
            alt={artifact.fileName}
            className="max-h-full max-w-full rounded-sm bg-card object-contain shadow-sm"
          />
        </div>
      </div>
    );
  }

  if (artifact.mimeType === "application/pdf") {
    return (
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <PDFViewer
          key={artifact.id}
          autoFitWidth
          className="h-full min-h-0 w-full"
          src={previewUrl}
          fileName={artifact.fileName}
          showDownload={false}
          showRotateControls={false}
          showToolbar
          showUpload={false}
          viewportGap={0}
          pageClassName={() => "bg-white"}
        />
      </div>
    );
  }

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
      <div className="grid h-full min-h-0 place-items-center bg-muted/30 p-6 text-center text-muted-foreground">
        <div>
          <FileImage className="mx-auto size-8" />
          <p className="mt-3 text-sm">{copy.loadError}</p>
        </div>
      </div>
    </div>
  );
}

function useObjectUrl(blob: Blob | undefined) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => {
    if (url) {
      return () => URL.revokeObjectURL(url);
    }
  }, [url]);

  return url;
}
