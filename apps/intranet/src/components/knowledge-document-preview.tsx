"use client";

import {
  DocxViewerPreview,
  PDFViewer,
  PptxViewerPreview,
  XlsxViewerPreview,
} from "@project-wing/document-viewer";
import { projectWingToast } from "@project-wing/ui";
import { useEffect, useMemo, useState } from "react";

export function KnowledgeDocumentPreview({
  documentId,
  fileName,
  mimeType,
  sourceKind = "document",
  version,
  downloadAllowed = true,
}: {
  documentId: string;
  fileName: string;
  mimeType: string;
  sourceKind?: "attachment" | "document";
  version?: string;
  downloadAllowed?: boolean;
}) {
  const [objectUrl, setObjectUrl] = useState<string>();
  const [resolvedMimeType, setResolvedMimeType] = useState(mimeType);
  const [error, setError] = useState<string>();
  const [isDark, setIsDark] = useState(false);
  const sourceRequestUrl = useMemo(
    () =>
      `/${sourceKind === "attachment" ? "knowledge-attachment-source" : "knowledge-source"}/${encodeURIComponent(documentId)}${version ? `?version=${encodeURIComponent(version)}` : ""}`,
    [documentId, sourceKind, version]
  );
  const downloadUrl = useMemo(
    () =>
      `/${sourceKind === "attachment" ? "knowledge-attachment-download" : "knowledge-download"}/${encodeURIComponent(documentId)}`,
    [documentId, sourceKind]
  );

  useEffect(() => {
    const controller = new AbortController();
    let nextObjectUrl: string | undefined;

    void fetch(sourceRequestUrl, {
      cache: "force-cache",
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Preview request failed with ${response.status}`);
        }
        const blob = await response.blob();
        nextObjectUrl = URL.createObjectURL(blob);
        setResolvedMimeType(blob.type || mimeType);
        setObjectUrl(nextObjectUrl);
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        setError("Preview unavailable");
        projectWingToast.error("Preview unavailable", { duration: 5000 });
      });

    return () => {
      controller.abort();
      if (nextObjectUrl) {
        URL.revokeObjectURL(nextObjectUrl);
      }
    };
  }, [mimeType, sourceRequestUrl]);

  if (error) {
    return null;
  }

  if (!objectUrl) {
    return <PreviewMessage message="正在加载文件预览…" />;
  }

  const normalizedName = fileName.toLowerCase();
  const normalizedMimeType = resolvedMimeType.toLowerCase();
  const viewerClassName = "h-dvh min-h-0";

  if (
    normalizedName.endsWith(".doc") ||
    normalizedMimeType === "application/msword"
  ) {
    return (
      <PreviewMessage
        actionHref={downloadAllowed ? downloadUrl : undefined}
        actionLabel={downloadAllowed ? "下载文件" : undefined}
        message="旧版 Word .doc 暂不支持在线预览，请下载后打开。"
      />
    );
  }

  if (
    normalizedMimeType === "application/pdf" ||
    normalizedName.endsWith(".pdf")
  ) {
    return (
      <PDFViewer
        className={viewerClassName}
        fileName={fileName}
        showUpload={false}
        src={objectUrl}
      />
    );
  }

  if (
    normalizedMimeType.includes("wordprocessingml") ||
    normalizedName.endsWith(".docx")
  ) {
    return (
      <DocxViewerPreview
        className={viewerClassName}
        fileName={fileName}
        isDark={isDark}
        onIsDarkChange={setIsDark}
        showUpload={false}
        src={objectUrl}
      />
    );
  }

  if (
    normalizedMimeType.includes("spreadsheetml") ||
    normalizedMimeType === "application/vnd.ms-excel" ||
    /\.xlsx?$/.test(normalizedName)
  ) {
    return (
      <XlsxViewerPreview
        className={viewerClassName}
        fileName={fileName}
        isDark={isDark}
        onIsDarkChange={setIsDark}
        showUpload={false}
        src={objectUrl}
      />
    );
  }

  if (
    normalizedMimeType.includes("presentationml") ||
    normalizedMimeType === "application/vnd.ms-powerpoint" ||
    /\.pptx?$/.test(normalizedName)
  ) {
    return (
      <PptxViewerPreview
        className={viewerClassName}
        fileName={fileName}
        showUpload={false}
        src={objectUrl}
      />
    );
  }

  return (
    <PreviewMessage
      actionHref={downloadAllowed ? downloadUrl : undefined}
      actionLabel={downloadAllowed ? "下载文件" : undefined}
      message="该文件暂不支持在线预览。"
    />
  );
}

function PreviewMessage({
  message,
  actionHref,
  actionLabel,
}: {
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-8 text-foreground">
      <div className="grid justify-items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        {actionHref && actionLabel ? (
          <a
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            href={actionHref}
          >
            {actionLabel}
          </a>
        ) : null}
      </div>
    </main>
  );
}
