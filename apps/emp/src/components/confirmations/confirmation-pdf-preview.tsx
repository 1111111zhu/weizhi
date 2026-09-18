"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, RotateCw, X } from "lucide-react";
import { useEffect, useMemo } from "react";

import { AccessibleName } from "@/components/ui/accessible-name";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { api } from "../../api/client";
import type { Dictionary } from "../../i18n/dictionaries";
import { showErrorToast } from "../../lib/error-toast";
import {
  PREVIEW_QUERY_GC_TIME_MS,
  PREVIEW_QUERY_META,
  PREVIEW_QUERY_STALE_TIME_MS,
} from "../../lib/preview-query-cache";

type Copy = Dictionary["confirmationCenter"]["dispatchQueue"];

export function ConfirmationPdfPreview({
  confirmationId,
  copy,
  fileLabel,
  onClose,
}: {
  confirmationId: string | null;
  copy: Copy;
  fileLabel?: string | null;
  onClose: () => void;
}) {
  const preview = useQuery({
    queryKey: ["confirmation-dispatch-preview", confirmationId],
    queryFn: () => api.previewConfirmationDispatchPdf(confirmationId ?? ""),
    enabled: Boolean(confirmationId),
    retry: false,
    staleTime: PREVIEW_QUERY_STALE_TIME_MS,
    gcTime: PREVIEW_QUERY_GC_TIME_MS,
    meta: PREVIEW_QUERY_META,
  });
  const pdfUrl = useObjectUrl(preview.data);

  useEffect(() => {
    if (preview.error) {
      showErrorToast(preview.error, copy.preview.loadError);
    }
  }, [copy.preview.loadError, preview.error]);

  return (
    <AccessibleName label={copy.preview.title}>
      <aside className="flex h-full min-h-0 flex-col bg-card">
        <div className="flex h-12 shrink-0 items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {copy.preview.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {fileLabel ?? copy.preview.noSelection}
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            tooltip={copy.preview.close}
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        <Separator />
        <div className="relative min-h-0 flex-1 bg-muted/60">
          {confirmationId ? (
            pdfUrl ? (
              <iframe
                className="h-full w-full border-0 bg-card"
                src={pdfUrl}
                aria-label={`${copy.preview.title}: ${fileLabel ?? confirmationId}`}
                title={fileLabel ?? confirmationId}
                sandbox=""
              />
            ) : preview.isError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    preview.refetch();
                  }}
                >
                  <RotateCw />
                  {copy.preview.retry}
                </Button>
              </div>
            ) : (
              <div
                aria-busy="true"
                aria-label={copy.preview.loading}
                className="flex h-full flex-col gap-3 p-6"
              >
                <Skeleton className="h-6 w-1/3 rounded-md" />
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-4 w-5/6 rounded-md" />
                <Skeleton className="w-full flex-1 rounded-md" />
              </div>
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
              <FileText className="size-8 opacity-50" />
              <p className="text-sm">{copy.preview.noSelection}</p>
            </div>
          )}
        </div>
      </aside>
    </AccessibleName>
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
