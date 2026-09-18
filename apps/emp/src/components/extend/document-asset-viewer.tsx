"use client";

import * as React from "react";

import { IMAGE_PREVIEW_CANVAS_CLASS_NAME } from "@/components/extend/document-preview-surface";
import { DocumentTextSearchPopover } from "@/components/extend/document-text-search-popover";
import { PreviewFileActions } from "@/components/extend/preview-file-actions";
import { PreviewLoadingState } from "@/components/extend/preview-loading-state";
import {
  PreviewZoomControl,
  previewZoomContentClassName,
} from "@/components/extend/preview-zoom-control";
import type { PreviewZoom } from "@/components/extend/preview-zoom-control";
import { ProjectFileTypeIcon } from "@/components/project-file-type-icon";
import type { AttachmentPreviewCapabilities } from "@/lib/attachment-preview";
import type {
  DocumentAssetPreviewKind,
  DocumentEmailPreview,
} from "@/lib/document-asset-preview";
import { findTextPreviewSearchResults } from "@/lib/text-preview-search";
import type { TextPreviewSearchResult } from "@/lib/text-preview-search";
import { cn } from "@/lib/utils";

import { EmailAsset } from "./email-asset-viewer";
import { TextSearchContent } from "./text-search-content";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";

type DocumentAssetViewerProps = {
  capabilities: AttachmentPreviewCapabilities;
  className?: string;
  fileName: string;
  kind: DocumentAssetPreviewKind;
  source: Blob;
  sourceUrl: string;
  toolbarActions?: React.ReactNode;
};

function AssetToolbar({
  assetActions,
  fileName,
  searchControl,
  toolbarActions,
  zoomControl,
}: {
  assetActions?: React.ReactNode;
  fileName: string;
  searchControl?: React.ReactNode;
  toolbarActions?: React.ReactNode;
  zoomControl?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-12 min-w-0 items-center gap-2 border-b bg-background px-3 py-2">
      <ProjectFileTypeIcon fileName={fileName} />
      <span className="min-w-0 truncate text-sm font-medium" title={fileName}>
        {fileName}
      </span>
      {searchControl ? (
        <>
          <Separator orientation="vertical" className="mx-1 h-4" />
          {searchControl}
        </>
      ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {zoomControl}
        {zoomControl && assetActions ? (
          <Separator orientation="vertical" className="mx-1 h-4" />
        ) : null}
        {assetActions}
        {assetActions && toolbarActions ? (
          <Separator orientation="vertical" className="mx-1 h-4" />
        ) : null}
        {toolbarActions}
      </div>
    </div>
  );
}

function ImageAsset({
  fileName,
  sourceUrl,
  zoomClassName,
}: {
  fileName: string;
  sourceUrl: string;
  zoomClassName: string;
}) {
  const [failed, setFailed] = React.useState(false);
  if (failed) {
    return (
      <div className="grid h-full place-items-center p-8 text-center text-sm text-muted-foreground">
        This image format cannot be rendered by the current browser.
      </div>
    );
  }
  return (
    <ScrollArea
      className={cn("min-h-0 flex-1", IMAGE_PREVIEW_CANVAS_CLASS_NAME)}
    >
      <div className="flex min-h-full items-center justify-center p-6">
        {/* Preview URLs are transient object URLs and cannot use Next image optimization. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sourceUrl}
          alt={fileName}
          className={cn(
            "max-h-full max-w-full object-contain shadow-sm",
            zoomClassName
          )}
          onError={() => setFailed(true)}
        />
      </div>
    </ScrollArea>
  );
}

function MediaAsset({
  fileName,
  source,
  sourceUrl,
}: {
  fileName: string;
  source: Blob;
  sourceUrl: string;
}) {
  const isAudio =
    source.type.startsWith("audio/") ||
    /\.(aac|flac|m4a|mp3|ogg|wav)$/i.test(fileName);
  return (
    <div className="grid min-h-0 flex-1 place-items-center bg-muted/20 p-6">
      {isAudio ? (
        <audio className="w-full max-w-xl" controls src={sourceUrl} />
      ) : (
        <video className="max-h-full max-w-full" controls src={sourceUrl} />
      )}
    </div>
  );
}

function TextAsset({
  activeResult,
  results,
  text,
  zoomClassName,
}: {
  activeResult: TextPreviewSearchResult | null;
  results: TextPreviewSearchResult[];
  text: string | null;
  zoomClassName: string;
}) {
  if (text === null) {
    return <PreviewLoadingState className="flex-1" />;
  }

  return (
    <ScrollArea className="min-h-0 flex-1 bg-muted/20">
      <pre
        className={cn(
          "whitespace-pre-wrap break-words p-5 font-mono text-xs leading-5 text-foreground",
          zoomClassName
        )}
      >
        <TextSearchContent
          activeResult={activeResult}
          results={results}
          text={text}
        />
      </pre>
    </ScrollArea>
  );
}

export function DocumentAssetViewer({
  capabilities,
  className,
  fileName,
  kind,
  source,
  sourceUrl,
  toolbarActions,
}: DocumentAssetViewerProps) {
  const [text, setText] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState<DocumentEmailPreview | null>(null);
  const [textSearchResults, setTextSearchResults] = React.useState<
    TextPreviewSearchResult[]
  >([]);
  const [activeTextSearchResult, setActiveTextSearchResult] =
    React.useState<TextPreviewSearchResult | null>(null);
  const [zoom, setZoom] = React.useState<PreviewZoom>(100);
  const zoomClassName = previewZoomContentClassName[zoom];

  React.useEffect(() => {
    React.startTransition(() => {
      setTextSearchResults([]);
      setActiveTextSearchResult(null);
      setEmail(null);
    });
  }, [kind, source]);

  React.useEffect(() => {
    if (kind !== "text") {
      React.startTransition(() => setText(null));
      return;
    }

    let active = true;
    React.startTransition(() => setText(null));
    void source.text().then((value) => {
      if (active) {
        setText(value);
      }
    });

    return () => {
      active = false;
    };
  }, [kind, source]);

  const searchableText =
    kind === "text"
      ? text
      : kind === "email" && email?.html === ""
        ? email.text
        : null;
  const copyText =
    kind === "text"
      ? text
      : kind === "email" && email
        ? email.text || email.html
        : null;
  const copyDisabled =
    kind === "text" ? text === null : kind === "email" ? email === null : false;
  const searchControl =
    capabilities.search && (kind === "text" || kind === "email") ? (
      <DocumentTextSearchPopover<TextPreviewSearchResult>
        key={`${kind}:${fileName}`}
        controlsDisabled={searchableText === null}
        onClear={() => {
          setTextSearchResults([]);
          setActiveTextSearchResult(null);
        }}
        onNavigate={(result) => {
          setActiveTextSearchResult(result);
        }}
        onSearch={(query) => {
          const results = searchableText
            ? findTextPreviewSearchResults(searchableText, query)
            : [];
          setTextSearchResults(results);
          setActiveTextSearchResult(results[0] ?? null);
          return results;
        }}
      />
    ) : null;
  return (
    <div
      className={cn("flex h-full min-h-0 flex-col bg-background", className)}
    >
      <AssetToolbar
        assetActions={
          <PreviewFileActions
            copyText={copyText}
            disabled={copyDisabled}
            fileName={fileName}
            source={source}
          />
        }
        fileName={fileName}
        searchControl={searchControl}
        toolbarActions={toolbarActions}
        zoomControl={
          capabilities.zoom ? (
            <PreviewZoomControl value={zoom} onValueChange={setZoom} />
          ) : null
        }
      />
      {kind === "email" ? (
        <EmailAsset
          activeResult={activeTextSearchResult}
          fileName={fileName}
          onEmailChange={setEmail}
          results={textSearchResults}
          source={source}
        />
      ) : null}
      {kind === "image" ? (
        <ImageAsset
          fileName={fileName}
          sourceUrl={sourceUrl}
          zoomClassName={zoomClassName}
        />
      ) : null}
      {kind === "media" ? (
        <MediaAsset fileName={fileName} source={source} sourceUrl={sourceUrl} />
      ) : null}
      {kind === "text" ? (
        <TextAsset
          activeResult={activeTextSearchResult}
          results={textSearchResults}
          text={text}
          zoomClassName={zoomClassName}
        />
      ) : null}
    </div>
  );
}
