"use client";

import { useQuery } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { Component, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAttachmentPreviewCapabilities } from "@/lib/attachment-preview";
import { getDocumentAssetPreviewKind } from "@/lib/document-asset-preview";
import { showErrorToast } from "@/lib/error-toast";
import {
  PREVIEW_QUERY_GC_TIME_MS,
  PREVIEW_QUERY_META,
  PREVIEW_QUERY_STALE_TIME_MS,
} from "@/lib/preview-query-cache";
import { cn } from "@/lib/utils";

import { CsvViewer } from "./extend/csv-viewer";
import { DocumentAssetViewer } from "./extend/document-asset-viewer";
import { DocxViewerPreview } from "./extend/docx-viewer";
import { PDFViewer } from "./extend/pdf-viewer";
import { PptxViewerPreview } from "./extend/pptx-viewer";
import { usePreviewDarkMode } from "./extend/use-preview-dark-mode";
import { XlsxViewerPreview } from "./extend/xlsx-viewer";

export type FilePreviewKind =
  | "csv"
  | "docx"
  | "image"
  | "pdf"
  | "pptx"
  | "xlsx";

export type BlobFilePreviewCopy = {
  loading: string;
  failedTitle: string;
  retry: string;
  unsupported: string;
};

export type BlobFilePreviewPageOverlayRenderer = (input: {
  pageHeight: number;
  pageNumber: number;
  pageWidth: number;
  rotation: number;
  scale: number;
}) => ReactNode;

const defaultCopy: BlobFilePreviewCopy = {
  loading: "Loading preview...",
  failedTitle: "Preview could not be loaded",
  retry: "Retry",
  unsupported: "This file type cannot be previewed.",
};

export function getFilePreviewKind(
  fileName: string,
  mimeType = ""
): FilePreviewKind | null {
  const normalizedName = fileName.toLowerCase();
  const normalizedMimeType = mimeType.toLowerCase();

  if (
    normalizedName.endsWith(".pdf") ||
    normalizedMimeType === "application/pdf"
  ) {
    return "pdf";
  }
  if (
    /\.(docx|doc)$/.test(normalizedName) ||
    normalizedMimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    normalizedMimeType === "application/msword"
  ) {
    return "docx";
  }
  if (
    /\.(pptx|ppt)$/.test(normalizedName) ||
    normalizedMimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    normalizedMimeType === "application/vnd.ms-powerpoint"
  ) {
    return "pptx";
  }
  if (
    /\.(csv|tsv)$/.test(normalizedName) ||
    normalizedMimeType === "text/csv" ||
    normalizedMimeType === "text/tab-separated-values"
  ) {
    return "csv";
  }
  if (/\.(xlsx|xls|xlsm|xlsb)$/.test(normalizedName)) {
    return "xlsx";
  }
  if (
    getDocumentAssetPreviewKind(normalizedName, normalizedMimeType) === "image"
  ) {
    return "image";
  }
  return null;
}

export function BlobFilePreviewPane({
  ariaLabel,
  className,
  copy = defaultCopy,
  fileName,
  loadFile,
  mimeType,
  onUploadFile,
  queryKey,
  renderPageOverlay,
  toolbarActions,
}: {
  ariaLabel: string;
  className?: string;
  copy?: Partial<BlobFilePreviewCopy>;
  fileName: string;
  loadFile: () => Promise<Blob>;
  mimeType?: string;
  onUploadFile?: (file: File) => void;
  queryKey: QueryKey;
  renderPageOverlay?: BlobFilePreviewPageOverlayRenderer;
  toolbarActions?: ReactNode;
}) {
  const resolvedCopy = { ...defaultCopy, ...copy };
  const previewKind = getFilePreviewKind(fileName, mimeType);
  const preview = useQuery({
    queryKey,
    queryFn: loadFile,
    enabled: Boolean(previewKind),
    retry: false,
    staleTime: PREVIEW_QUERY_STALE_TIME_MS,
    gcTime: PREVIEW_QUERY_GC_TIME_MS,
    meta: PREVIEW_QUERY_META,
  });
  const sourceUrl = useBlobObjectUrl(preview.data);
  const csvData = useCsvPreviewData(preview.data, previewKind === "csv");
  const viewerReady = Boolean(previewKind && !preview.isError && sourceUrl);

  useEffect(() => {
    if (preview.error) {
      showErrorToast(preview.error, resolvedCopy.failedTitle);
    }
  }, [preview.error, resolvedCopy.failedTitle]);

  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        "relative h-full min-h-0 min-w-0 overflow-hidden bg-workbench-sidebar",
        className
      )}
    >
      {previewKind ? (
        preview.isError ? (
          <PreviewLoadErrorState
            retryLabel={resolvedCopy.retry}
            onRetry={() => {
              preview.refetch();
            }}
          />
        ) : preview.isLoading || !preview.data || !sourceUrl ? (
          <PreviewLoadingState label={resolvedCopy.loading} />
        ) : (
          <PreviewRuntimeErrorBoundary
            key={`${fileName}:${sourceUrl}`}
            fallback={(error, reset) => (
              <>
                <PreviewLoadErrorState
                  retryLabel={resolvedCopy.retry}
                  onRetry={() => {
                    reset();
                    preview.refetch();
                  }}
                />
                {toolbarActions ? (
                  <div className="absolute top-3 right-3 z-20 flex items-center gap-1">
                    {toolbarActions}
                  </div>
                ) : null}
              </>
            )}
            onError={(error) => showErrorToast(error, resolvedCopy.failedTitle)}
          >
            <FileViewer
              csvData={csvData}
              fileName={fileName}
              onUploadFile={onUploadFile}
              previewKind={previewKind}
              renderPageOverlay={renderPageOverlay}
              sourceBlob={preview.data}
              sourceUrl={sourceUrl}
              toolbarActions={toolbarActions}
            />
          </PreviewRuntimeErrorBoundary>
        )
      ) : (
        <PreviewMessage>{resolvedCopy.unsupported}</PreviewMessage>
      )}
      {!viewerReady && toolbarActions ? (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1">
          {toolbarActions}
        </div>
      ) : null}
    </section>
  );
}

class PreviewRuntimeErrorBoundary extends Component<
  {
    children: ReactNode;
    fallback: (error: Error, reset: () => void) => ReactNode;
    onError?: (error: Error) => void;
  },
  { error: Error | null }
> {
  constructor(props: {
    children: ReactNode;
    fallback: (error: Error, reset: () => void) => ReactNode;
    onError?: (error: Error) => void;
  }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error("The file viewer stopped unexpectedly"),
    };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}

function FileViewer({
  csvData,
  fileName,
  onUploadFile,
  previewKind,
  renderPageOverlay,
  sourceBlob,
  sourceUrl,
  toolbarActions,
}: {
  csvData: string;
  fileName: string;
  onUploadFile?: (file: File) => void;
  previewKind: FilePreviewKind;
  renderPageOverlay?: BlobFilePreviewPageOverlayRenderer;
  sourceBlob: Blob;
  sourceUrl: string;
  toolbarActions?: ReactNode;
}) {
  const [isDark, setIsDark] = usePreviewDarkMode();
  const className = "h-full min-h-0";

  if (previewKind === "image") {
    return (
      <ViewerSurface isDark={isDark}>
        <DocumentAssetViewer
          capabilities={getAttachmentPreviewCapabilities("image")}
          className={className}
          fileName={fileName}
          kind="image"
          source={sourceBlob}
          sourceUrl={sourceUrl}
          toolbarActions={toolbarActions}
        />
      </ViewerSurface>
    );
  }

  if (previewKind === "pdf") {
    return (
      <ViewerSurface isDark={isDark}>
        <PDFViewer
          className={className}
          fileName={fileName}
          renderPageOverlay={renderPageOverlay}
          showUpload={Boolean(onUploadFile)}
          src={sourceUrl}
          toolbarActions={toolbarActions}
          onUpload={onUploadFile}
        />
      </ViewerSurface>
    );
  }
  if (previewKind === "docx") {
    return (
      <ViewerSurface isDark={isDark}>
        <DocxViewerPreview
          className={className}
          fileName={fileName}
          isDark={isDark}
          onIsDarkChange={setIsDark}
          renderPageOverlay={renderPageOverlay}
          showUpload={false}
          src={sourceUrl}
          toolbarActions={toolbarActions}
        />
      </ViewerSurface>
    );
  }
  if (previewKind === "pptx") {
    return (
      <ViewerSurface isDark={isDark}>
        <PptxViewerPreview
          className={className}
          fileName={fileName}
          showUpload={false}
          src={sourceUrl}
          toolbarActions={toolbarActions}
        />
      </ViewerSurface>
    );
  }
  if (previewKind === "csv") {
    return (
      <ViewerSurface isDark={isDark}>
        <CsvViewer
          className={className}
          data={csvData}
          toolbarActions={toolbarActions}
        />
      </ViewerSurface>
    );
  }
  return (
    <ViewerSurface isDark={isDark}>
      <XlsxViewerPreview
        className={className}
        fileName={fileName}
        isDark={isDark}
        onIsDarkChange={setIsDark}
        showUpload={false}
        src={sourceUrl}
        toolbarActions={toolbarActions}
      />
    </ViewerSurface>
  );
}

function ViewerSurface({
  children,
  isDark,
}: {
  children: ReactNode;
  isDark: boolean;
}) {
  return (
    <div
      className={cn(
        "extend-viewer-surface dark:extend-viewer-surface-dark h-full min-h-0 [container-type:inline-size]",
        isDark && "extend-viewer-surface-dark"
      )}
    >
      <div className="h-full min-h-0 p-[clamp(4px,1.5cqw,18px)]">
        <div className="h-full min-h-0 overflow-hidden rounded-md border bg-background shadow-xs">
          {children}
        </div>
      </div>
    </div>
  );
}

function PreviewLoadingState({ label }: { label: string }) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className="flex h-full min-h-0 flex-col gap-4 bg-muted/20 p-6"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-5 w-48 rounded-md" />
      </div>
      <Skeleton className="h-4 w-full rounded-md" />
      <Skeleton className="h-4 w-5/6 rounded-md" />
      <Skeleton className="h-4 w-4/6 rounded-md" />
      <div className="flex-1 rounded-md border border-border/50 bg-background/50 p-4">
        <Skeleton className="h-full w-full rounded-md" />
      </div>
    </div>
  );
}

function PreviewLoadErrorState({
  onRetry,
  retryLabel,
}: {
  onRetry: () => void;
  retryLabel: string;
}) {
  return (
    <div
      role="alert"
      className="grid h-full min-h-0 place-items-center bg-destructive/5 px-4 text-center text-sm text-destructive"
    >
      <div className="grid max-w-sm justify-items-center gap-3">
        <Button type="button" variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    </div>
  );
}

function PreviewMessage({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-full min-h-0 place-items-center px-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function useBlobObjectUrl(blob: Blob | undefined) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setSourceUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(blob);
    setSourceUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [blob]);

  return sourceUrl;
}

function useCsvPreviewData(blob: Blob | undefined, enabled: boolean) {
  const [csvData, setCsvData] = useState("");

  useEffect(() => {
    let active = true;
    if (!blob || !enabled) {
      setCsvData("");
      return;
    }
    void readBlobText(blob).then((data) => {
      if (active) {
        setCsvData(data);
      }
    });
    return () => {
      active = false;
    };
  }, [blob, enabled]);

  return csvData;
}

function readBlobText(blob: Blob) {
  return blob.text();
}
