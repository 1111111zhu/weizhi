"use client";

import {
  CsvViewer,
  DocxViewerPreview,
  PDFViewer,
  PptxViewerPreview,
  XlsxViewerPreview,
} from "@project-wing/document-viewer";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useCmpI18n } from "@/i18n/client";
import { getPreviewChannelName } from "@/lib/open-preview-window";

type PreviewFile = { blob: Blob; fileName: string; mimeType: string };
type PreviewKind = "csv" | "docx" | "image" | "pdf" | "pptx" | "xlsx";

export function DetachedDocumentPreview({ nonce }: { nonce: string }) {
  const { locale } = useCmpI18n();
  const [file, setFile] = useState<PreviewFile | null>(null);
  const [isDark, setIsDark] = useState(false);
  const sourceUrl = useObjectUrl(file?.blob);
  const kind = resolvePreviewKind(file);
  const csvData = useCsvText(file?.blob, kind);

  useEffect(() => {
    const channel = new BroadcastChannel(getPreviewChannelName(nonce));
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!isPreviewFileMessage(event.data, nonce)) {
        return;
      }
      setFile(event.data);
      channel.postMessage({ nonce, type: "received" });
      channel.close();
    };
    channel.addEventListener("message", handleMessage);
    channel.postMessage({ nonce, type: "ready" });
    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
    };
  }, [nonce]);

  if (!file || !sourceUrl) {
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

  if (!kind) {
    return (
      <main className="grid h-dvh place-items-center bg-background px-6 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="text-base font-semibold">{file.fileName}</h1>
          <p className="text-sm text-muted-foreground">
            {locale === "zh-CN"
              ? "此文件格式暂不支持在线预览，请返回原页面下载。"
              : "This file type cannot be previewed. Return to the original page to download it."}
          </p>
        </div>
      </main>
    );
  }

  const className = "h-full min-h-0";
  let viewer;
  if (kind === "image") {
    viewer = (
      <div className="flex h-full min-h-0 items-center justify-center overflow-auto bg-muted/30 p-4">
        <img
          alt={file.fileName}
          className="max-h-full max-w-full rounded-md object-contain shadow-sm"
          src={sourceUrl}
        />
      </div>
    );
  } else if (kind === "pdf") {
    viewer = (
      <PDFViewer
        className={className}
        fileName={file.fileName}
        showUpload={false}
        src={sourceUrl}
      />
    );
  } else if (kind === "docx") {
    viewer = (
      <DocxViewerPreview
        className={className}
        fileName={file.fileName}
        isDark={isDark}
        onIsDarkChange={setIsDark}
        showUpload={false}
        src={sourceUrl}
      />
    );
  } else if (kind === "pptx") {
    viewer = (
      <PptxViewerPreview
        className={className}
        fileName={file.fileName}
        showUpload={false}
        src={sourceUrl}
      />
    );
  } else if (kind === "csv") {
    viewer = <CsvViewer className={className} data={csvData} />;
  } else {
    viewer = (
      <XlsxViewerPreview
        className={className}
        fileName={file.fileName}
        isDark={isDark}
        onIsDarkChange={setIsDark}
        showUpload={false}
        src={sourceUrl}
      />
    );
  }

  return (
    <main className="h-dvh min-h-0 w-full overflow-hidden bg-background">
      {viewer}
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

function useCsvText(blob: Blob | undefined, kind: PreviewKind | null) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!blob || kind !== "csv") {
      return setText("");
    }
    void blob.text().then(setText);
  }, [blob, kind]);
  return text;
}

export function resolvePreviewKind(file: PreviewFile | null): PreviewKind | null {
  const name = file?.fileName.toLowerCase() ?? "";
  const mimeType = file?.mimeType.toLowerCase() ?? "";
  if (
    mimeType.startsWith("image/") ||
    /\.(gif|jpe?g|png|svg|webp)$/.test(name)
  ) {
    return "image";
  }
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }
  if (mimeType.includes("wordprocessingml") || name.endsWith(".docx")) {
    return "docx";
  }
  if (mimeType.includes("presentationml") || name.endsWith(".pptx")) {
    return "pptx";
  }
  if (name.endsWith(".csv") || name.endsWith(".tsv")) {
    return "csv";
  }
  if (/\.(xls|xlsb|xlsm|xlsx)$/.test(name)) {
    return "xlsx";
  }
  return null;
}

function isPreviewFileMessage(
  value: unknown,
  nonce: string
): value is PreviewFile & { nonce: string; type: "file" } {
  return (
    typeof value === "object" &&
    value !== null &&
    "blob" in value &&
    value.blob instanceof Blob &&
    "fileName" in value &&
    typeof value.fileName === "string" &&
    "mimeType" in value &&
    typeof value.mimeType === "string" &&
    "nonce" in value &&
    value.nonce === nonce &&
    "type" in value &&
    value.type === "file"
  );
}
