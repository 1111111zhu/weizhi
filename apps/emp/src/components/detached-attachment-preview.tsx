"use client";

import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getAttachmentPreviewCapabilities } from "@/lib/attachment-preview";
import { getDocumentAssetPreviewKind } from "@/lib/document-asset-preview";

import { getPreviewChannelName } from "../lib/open-preview-window";
import { CsvViewer } from "./extend/csv-viewer";
import { DocumentAssetViewer } from "./extend/document-asset-viewer";
import { DocxViewerPreview } from "./extend/docx-viewer";
import { PDFViewer } from "./extend/pdf-viewer";
import { PptxViewerPreview } from "./extend/pptx-viewer";
import { usePreviewDarkMode } from "./extend/use-preview-dark-mode";
import { XlsxViewerPreview } from "./extend/xlsx-viewer";

type PreviewFile = { blob: Blob; fileName: string; mimeType: string; projectId?: string };
type PreviewKind = "csv" | "docx" | "image" | "pdf" | "pptx" | "xlsx";

export function DetachedAttachmentPreview({
  nonce,
  sourceOrigin,
}: {
  nonce: string;
  sourceOrigin?: string;
}) {
  const [file, setFile] = useState<PreviewFile | null>(null);
  const [isDark, setIsDark] = usePreviewDarkMode();
  const sourceUrl = useObjectUrl(file?.blob);
  const csvData = useCsvText(file?.blob, resolvePreviewKind(file));

  useEffect(() => {
    const channel = new BroadcastChannel(getPreviewChannelName(nonce));
    const onChannelMessage = (event: MessageEvent<unknown>) => {
      if (!isPreviewFileMessage(event.data, nonce)) {
        return;
      }
      setFile(event.data);
      channel.postMessage({ nonce, type: "received" });
      channel.close();
    };
    channel.addEventListener("message", onChannelMessage);
    channel.postMessage({ nonce, type: "ready" });
    const { opener } = window;
    const openerOrigin = opener
      ? resolveTrustedOpenerOrigin(sourceOrigin)
      : null;
    const onWindowMessage = (event: MessageEvent<unknown>) => {
      if (
        !opener ||
        !openerOrigin ||
        event.source !== opener ||
        event.origin !== openerOrigin ||
        !isPreviewFileMessage(event.data, nonce)
      ) {
        return;
      }
      setFile(event.data);
      opener.postMessage({ nonce, type: "received" }, openerOrigin);
    };
    window.addEventListener("message", onWindowMessage);
    if (opener && openerOrigin) {
      opener.postMessage({ nonce, type: "ready" }, openerOrigin);
    }
    return () => {
      channel.removeEventListener("message", onChannelMessage);
      channel.close();
      window.removeEventListener("message", onWindowMessage);
    };
  }, [nonce, sourceOrigin]);

  if (!file || !sourceUrl) {
    return <PreviewLoading />;
  }

  const kind = resolvePreviewKind(file);
  const viewer = (() => {
    if (kind === "image") {
      return (
        <DocumentAssetViewer
          capabilities={getAttachmentPreviewCapabilities("image")}
          className="h-full min-h-0"
          fileName={file.fileName}
          kind="image"
          source={file.blob}
          sourceUrl={sourceUrl}
        />
      );
    }
    if (kind === "pdf") {
      return (
        <PDFViewer
          annotationProjectId={file.projectId}
          className="h-full min-h-0"
          fileName={file.fileName}
          src={sourceUrl}
        />
      );
    }
    if (kind === "docx") {
      return (
        <DocxViewerPreview
          className="h-full min-h-0"
          fileName={file.fileName}
          isDark={isDark}
          onIsDarkChange={setIsDark}
          showUpload={false}
          src={sourceUrl}
        />
      );
    }
    if (kind === "pptx") {
      return (
        <PptxViewerPreview
          className="h-full min-h-0"
          fileName={file.fileName}
          showUpload={false}
          src={sourceUrl}
        />
      );
    }
    if (kind === "csv") {
      return <CsvViewer className="h-full min-h-0" data={csvData} />;
    }
    return (
      <XlsxViewerPreview
        className="h-full min-h-0"
        fileName={file.fileName}
        isDark={isDark}
        onIsDarkChange={setIsDark}
        showUpload={false}
        src={sourceUrl}
      />
    );
  })();

  return (
    <main className="h-dvh min-h-0 w-full overflow-hidden bg-background">
      {viewer}
    </main>
  );
}

export function resolveTrustedOpenerOrigin(sourceOrigin: string | undefined) {
  try {
    if (!sourceOrigin) {
      return null;
    }
    const referrer = new URL(sourceOrigin);
    const current = new URL(window.location.href);
    const isLocalPair =
      (current.hostname === "localhost" || current.hostname === "127.0.0.1") &&
      referrer.hostname === current.hostname &&
      referrer.port === "3002";
    const isCmpSibling =
      referrer.protocol === current.protocol &&
      referrer.hostname === current.hostname.replace(/^emp\./, "cmp.");
    return isLocalPair || isCmpSibling ? referrer.origin : null;
  } catch {
    return null;
  }
}

function PreviewLoading() {
  return (
    <main
      aria-busy="true"
      className="flex h-dvh w-full flex-col gap-4 bg-background p-8"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-5 w-48 rounded-md" />
      </div>
      <Skeleton className="h-4 w-3/4 rounded-md" />
      <Skeleton className="h-4 w-1/2 rounded-md" />
      <Skeleton className="w-full flex-1 rounded-md" />
    </main>
  );
}

function useObjectUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      return setUrl(undefined);
    }
    const nextUrl = URL.createObjectURL(blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [blob]);
  return url;
}

function useCsvText(blob: Blob | undefined, kind: PreviewKind) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!blob || kind !== "csv") {
      return setText("");
    }
    void blob.text().then(setText);
  }, [blob, kind]);
  return text;
}

function resolvePreviewKind(file: PreviewFile | null): PreviewKind {
  const name = file?.fileName.toLowerCase() ?? "";
  const mimeType = file?.mimeType.toLowerCase() ?? "";
  if (getDocumentAssetPreviewKind(name, mimeType) === "image") {
    return "image";
  }
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }
  if (name.endsWith(".docx")) {
    return "docx";
  }
  if (name.endsWith(".pptx")) {
    return "pptx";
  }
  if (name.endsWith(".csv")) {
    return "csv";
  }
  return "xlsx";
}

function isPreviewFileMessage(
  value: unknown,
  nonce: string
): value is PreviewFile {
  return (
    typeof value === "object" &&
    value !== null &&
    "blob" in value &&
    "fileName" in value &&
    "mimeType" in value &&
    "nonce" in value &&
    "type" in value &&
    value.nonce === nonce &&
    value.type === "file" &&
    value.blob instanceof Blob &&
    typeof value.fileName === "string" &&
    typeof value.mimeType === "string" &&
    (!("projectId" in value) || (typeof value.projectId === "string" && value.projectId.length > 0 && value.projectId.length <= 160))
  );
}
