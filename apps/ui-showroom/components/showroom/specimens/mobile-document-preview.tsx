"use client";

import type { PDFViewerControls } from "@project-wing/document-viewer";
import { Button, CollectionState, MobileActionSheet } from "@project-wing/ui";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import type { MobileFile } from "./mobile-workspace-model";

const PDFViewer = dynamic(
  () =>
    import("@project-wing/document-viewer").then((module) => module.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <CollectionState kind="loading" locale="zh-CN" title="正在打开文件" />
    ),
  }
);

function PreviewToolbar({ controls }: { controls: PDFViewerControls }) {
  const [zoomOpen, setZoomOpen] = useState(false);
  return (
    <>
      <div
        role="toolbar"
        aria-label="PDF 阅读工具"
        className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-2 py-1"
      >
        <Button
          variant="quiet"
          className="pw-mobile-icon-action"
          aria-label="上一页"
          disabled={controls.disabled || controls.pageNumber <= 1}
          onClick={() => controls.goToPage(controls.pageNumber - 1)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <output className="text-sm tabular-nums" aria-label="页码">
          {controls.pageNumber || 1} / {controls.pageCount}
        </output>
        <Button
          variant="quiet"
          className="pw-mobile-icon-action"
          aria-label="下一页"
          disabled={
            controls.disabled || controls.pageNumber >= controls.pageCount
          }
          onClick={() => controls.goToPage(controls.pageNumber + 1)}
        >
          <ChevronRight aria-hidden />
        </Button>
        <div className="flex-1" />
        <Button
          variant="quiet"
          disabled={controls.disabled}
          aria-label="调整缩放"
          aria-haspopup="dialog"
          onClick={() => setZoomOpen(true)}
        >
          {Math.round(controls.zoom * 100)}% <ChevronDown aria-hidden />
        </Button>
      </div>
      <MobileActionSheet
        open={zoomOpen}
        onOpenChange={setZoomOpen}
        title="缩放"
        closeLabel="关闭缩放"
      >
        <div className="flex items-center justify-between">
          <Button
            variant="quiet"
            className="pw-mobile-icon-action"
            aria-label="缩小"
            disabled={controls.zoom <= 0.1}
            onClick={() => controls.setZoom(controls.zoom - 0.25)}
          >
            <Minus aria-hidden />
          </Button>
          <output aria-label="缩放比例">
            {Math.round(controls.zoom * 100)}%
          </output>
          <Button
            variant="quiet"
            className="pw-mobile-icon-action"
            aria-label="放大"
            disabled={controls.zoom >= 2}
            onClick={() => controls.setZoom(controls.zoom + 0.25)}
          >
            <Plus aria-hidden />
          </Button>
        </div>
        <Button
          variant="outline"
          fullWidth
          onClick={() => {
            controls.fitWidth();
            setZoomOpen(false);
          }}
        >
          适合宽度
        </Button>
      </MobileActionSheet>
    </>
  );
}

export function MobileDocumentPreview({
  projectId,
  file,
  sourceUrl,
}: {
  projectId: string;
  file: MobileFile;
  sourceUrl?: string;
}) {
  const identity = `${projectId}:${file.id}`;
  const [attempt, setAttempt] = useState(0);
  const [source, setSource] = useState<{
    identity: string;
    attempt: number;
    url?: string;
    error?: boolean;
  } | null>(null);
  useEffect(() => {
    if (sourceUrl) {
      return;
    }
    let cancelled = false;
    let url: string | undefined;
    import("./mobile-preview-pdf")
      .then(({ buildMobilePreviewPdf }) =>
        buildMobilePreviewPdf(projectId, file.id)
      )
      .then((bytes) => {
        if (cancelled) {
          return;
        }
        url = URL.createObjectURL(
          new Blob([new Uint8Array(bytes)], { type: "application/pdf" })
        );
        setSource({ identity, attempt, url });
      })
      .catch(() => {
        if (!cancelled) {
          setSource({ identity, attempt, error: true });
        }
      });
    return () => {
      cancelled = true;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [identity, projectId, file.id, attempt, sourceUrl]);
  const current = sourceUrl
    ? { url: sourceUrl, error: false }
    : source?.identity === identity && source.attempt === attempt
      ? source
      : null;
  if (current?.error) {
    return (
      <CollectionState
        kind="error"
        locale="zh-CN"
        title="无法打开文件"
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }
  return (
    <div
      data-slot="pdf-viewer"
      className="h-full min-h-0"
      aria-label={`${file.name}预览`}
    >
      {current?.url ? (
        <PDFViewer
          key={current.url}
          src={current.url}
          fileName={file.name}
          autoFitWidth
          showToolbar={false}
          showDownload={false}
          showUpload={false}
          renderToolbar={(controls) => <PreviewToolbar controls={controls} />}
        />
      ) : (
        <CollectionState kind="loading" locale="zh-CN" title="正在打开文件" />
      )}
    </div>
  );
}
