"use client";

import { createPluginRegistration, refreshPages } from "@embedpdf/core";
import { EmbedPDF, useRegistry } from "@embedpdf/core/react";
import type {
  PdfAnnotationObject,
  PdfDocumentObject,
  PdfEngine,
  Rect,
  Rotation,
  PdfPageGeometry,
} from "@embedpdf/models";
import {
  AnnotationLayer,
  AnnotationPluginPackage,
  useAnnotation,
} from "@embedpdf/plugin-annotation/react";
import type {
  AnnotationSelectionMenuProps,
  TrackedAnnotation,
} from "@embedpdf/plugin-annotation/react";
import {
  DocumentManagerPluginPackage,
  useActiveDocument,
  useDocumentManagerCapability,
} from "@embedpdf/plugin-document-manager/react";
import {
  GlobalPointerProvider,
  InteractionManagerPluginPackage,
  PagePointerProvider,
} from "@embedpdf/plugin-interaction-manager/react";
import {
  RenderLayer,
  RenderPluginPackage,
} from "@embedpdf/plugin-render/react";
import { Rotate, RotatePluginPackage } from "@embedpdf/plugin-rotate/react";
import {
  ScrollPluginPackage,
  ScrollStrategy,
  useScroll,
  useScrollPlugin,
} from "@embedpdf/plugin-scroll/react";
import type {
  PageLayout,
  ScrollerLayout,
  VirtualItem,
} from "@embedpdf/plugin-scroll/react";
import {
  SearchLayer,
  SearchPluginPackage,
  useSearch,
} from "@embedpdf/plugin-search/react";
import {
  CopyToClipboard,
  SelectionPluginPackage,
  useSelectionCapability,
  useSelectionPlugin,
} from "@embedpdf/plugin-selection/react";
import {
  ThumbImg,
  ThumbnailPluginPackage,
  useThumbnailCapability,
  useThumbnailPlugin,
} from "@embedpdf/plugin-thumbnail/react";
import type { ThumbMeta } from "@embedpdf/plugin-thumbnail/react";
import {
  TilingLayer,
  TilingPluginPackage,
} from "@embedpdf/plugin-tiling/react";
import {
  ViewportElementContext,
  ViewportPluginPackage,
  useIsViewportGated,
  useViewportCapability,
  useViewportElement,
  useViewportRef,
} from "@embedpdf/plugin-viewport/react";
import { ZoomMode } from "@embedpdf/plugin-zoom";
import type { ZoomLevel } from "@embedpdf/plugin-zoom";
import { ZoomPluginPackage, useZoom } from "@embedpdf/plugin-zoom/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Comment01Icon,
  Download01Icon,
  MinusSignCircleIcon,
  MoreHorizontalIcon,
  PlusSignCircleIcon,
  PrinterIcon,
  RotateClockwiseIcon,
  Search01Icon,
  SidebarLeftIcon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as React from "react";
import { flushSync } from "react-dom";

import {
  PAGED_DOCUMENT_PREVIEW_CANVAS_CLASS_NAME,
  PREVIEW_PAGE_ELEVATION_CLASS_NAME,
} from "@/components/extend/document-preview-surface";
import {
  DocumentViewerThumbnailSidebar,
  useElementWidth,
  useInlineThumbnailSidebar,
} from "@/components/extend/document-viewer-sidebar";
import { PDFViewerResizePresentation } from "@/components/extend/pdf-resize-presentation";
import { PreviewCloseAction } from "./preview-close-action";
import { PreviewLoadingState } from "@/components/extend/preview-loading-state";
import {
  formatPreviewZoomPercentage,
  PREVIEW_ZOOM_TRIGGER_CLASS_NAME,
  PREVIEW_ZOOM_VALUE_CLASS_NAME,
} from "@/components/extend/preview-zoom-control";
import { Button } from "@/components/extend/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/extend/ui/dropdown-menu";
import { Input } from "@/components/extend/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/extend/ui/popover";
import { ScrollArea } from "@/components/extend/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/extend/ui/select";
import { Separator } from "@/components/extend/ui/separator";
import { Spinner } from "@/components/extend/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/extend/ui/tooltip";
import { ResponsiveProjectFileIdentity } from "@/components/project-file-type-icon";
import { useNativePdfViewerPreference } from "@/components/theme-provider";
import { ButtonGroup } from "@/components/ui/button-group";
import { useI18n } from "@/i18n/client";
import type { Dictionary } from "@/i18n/dictionaries";
import { showErrorToast } from "@/lib/error-toast";
import { loadSharedPdfEngine } from "@/lib/pdf-thumbnail-utils";
import { cn } from "@/lib/utils";

import { PdfNoteContent, PdfNoteProjectContext } from "./pdf-note-content";

export type PDFViewerPageOverlayProps = {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  rotation: number;
  textBlocks?: PDFViewerTextBlock[];
};

export type PDFViewerTextBlock = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type PDFViewerHandle = {
  scrollToPage: (pageNumber: number, options?: ScrollIntoViewOptions) => void;
  scrollToPageArea: (
    pageNumber: number,
    area: { top: number; left?: number; width?: number; height?: number },
    options?: ScrollToOptions
  ) => void;
  getViewportElement: () => HTMLDivElement | null;
};

export type PDFViewerScrollAreaViewportResolver = (
  container: HTMLDivElement
) => HTMLDivElement | null;

export type PDFViewerProps = {
  annotationProjectId?: string;
  autoFitWidth?: boolean;
  className?: string;
  defaultZoom?: number;
  interactionMode?: "select" | "pan";
  textSelectionEnabled?: boolean;
  viewportGap?: number;
  fileName?: string;
  resolveScrollAreaViewport?: PDFViewerScrollAreaViewportResolver;
  showDownload?: boolean;
  showPrint?: boolean;
  showToolbar?: boolean;
  showRotateControls?: boolean;
  showUpload?: boolean;
  src?: string;
  nativeSrc?: string;
  toolbarActions?: React.ReactNode;
  pageClassName?: (pageNumber: number) => string | undefined;
  renderPageOverlay?: (props: PDFViewerPageOverlayProps) => React.ReactNode;
  onActivePageChange?: (pageNumber: number) => void;
  onDocumentLoadSuccess?: (numPages: number) => void;
  onUpload?: (file: File) => void;
  onPdfUpload?: (file: File) => void;
  onPagePointerDown?: (
    event: React.PointerEvent<HTMLDivElement>,
    pageNumber: number
  ) => void;
  onPagePointerMove?: (
    event: React.PointerEvent<HTMLDivElement>,
    pageNumber: number
  ) => void;
  onPagePointerUp?: (
    event: React.PointerEvent<HTMLDivElement>,
    pageNumber: number
  ) => void;
  onPagePointerCancel?: (
    event: React.PointerEvent<HTMLDivElement>,
    pageNumber: number
  ) => void;
};

const DEFAULT_ZOOM = 1;
const ZOOM_OPTIONS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const PAGE_GAP = 24;
const THUMBNAIL_IMAGE_PADDING = 8;
const THUMBNAIL_PAGE_WIDTH = 92;
const THUMBNAIL_WIDTH = THUMBNAIL_PAGE_WIDTH + THUMBNAIL_IMAGE_PADDING * 2;
const DEFAULT_SCROLL_AREA_VIEWPORT_SELECTOR =
  '[data-slot="scroll-area-viewport"]';
const PAGE_BASE_RENDER_DPR = 1;
const PAGE_BASE_RENDER_MAX_SCALE = 1;
const PDF_ANNOTATION_PANEL_WIDTH_CLASS = "w-80";
const PDF_SEARCH_DEBOUNCE_MS = 300;
const TEXT_SELECTION_BACKGROUND = "rgba(59, 130, 246, 0.14)";
const THUMBNAIL_FOCUS_RING_CLASS =
  "group-focus-visible/pdf-thumbnail-sidebar:ring-2 group-focus-visible/pdf-thumbnail-sidebar:ring-ring group-focus-visible/pdf-thumbnail-sidebar:ring-offset-1 group-focus-visible/pdf-thumbnail-sidebar:ring-offset-background";
const THUMBNAIL_GAP = 12;
const THUMBNAIL_LABEL_HEIGHT = 24;
const THUMBNAIL_PANE_PADDING_Y = 16;
const THUMBNAIL_SIDEBAR_CLOSED_CLASS = "-ml-40";
const THUMBNAIL_SIDEBAR_WIDTH_CLASS = "w-40";

type PDFViewerCopy = Dictionary["pdfViewer"];

function isVisiblePDFAnnotation(annotation: PdfAnnotationObject) {
  const flags = annotation.flags ?? [];
  return !flags.includes("hidden") && !flags.includes("noView");
}

function formatPDFAnnotationDate(value: Date | undefined) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getPDFAnnotationTitle(
  annotation: PdfAnnotationObject,
  copy: PDFViewerCopy
) {
  return annotation.subject?.trim() || copy.untitledAnnotation;
}

function getPDFAnnotationContent(annotation: PdfAnnotationObject) {
  return annotation.contents?.trim() || "";
}

function resolveDefaultScrollAreaViewport(container: HTMLDivElement) {
  return container.querySelector<HTMLDivElement>(
    DEFAULT_SCROLL_AREA_VIEWPORT_SELECTOR
  );
}

const PDFViewerScrollAreaResolverContext =
  React.createContext<PDFViewerScrollAreaViewportResolver>(
    resolveDefaultScrollAreaViewport
  );

type PageRotationDeltas = Map<number, Rotation>;
type ThumbnailSelectionMode = "replace" | "toggle" | "range";

function getPageIndexRange(from: number, to: number): Set<number> {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const range = new Set<number>();

  for (let pageIndex = start; pageIndex <= end; pageIndex += 1) {
    range.add(pageIndex);
  }

  return range;
}

function arePageIndexSetsEqual(left: Set<number>, right: Set<number>) {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

function normalizeRotation(rotation: number): Rotation {
  return (((rotation % 4) + 4) % 4) as Rotation;
}

function useSharedPdfEngine() {
  const [engine, setEngine] = React.useState<PdfEngine | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    loadSharedPdfEngine()
      .then((loadedEngine) => {
        if (!cancelled) {
          setEngine(loadedEngine);
        }
      })
      .catch((loadError: Error) => {
        if (!cancelled) {
          setError(loadError);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { engine, error };
}

function rotationToDegrees(rotation: Rotation) {
  return (rotation as number) * 90;
}

function normalizeDegrees(rotation: number) {
  return ((rotation % 360) + 360) % 360;
}

function ensurePdfExtension(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`;
}

function getPdfDownloadFileName(fileName: string | undefined, src: string) {
  if (fileName?.trim()) {
    return ensurePdfExtension(fileName.trim());
  }

  const pathname = src.split(/[?#]/)[0] ?? "";
  const rawName = pathname.split("/").pop() || "document.pdf";

  try {
    return ensurePdfExtension(decodeURIComponent(rawName));
  } catch {
    return ensurePdfExtension(rawName);
  }
}

function getRotatedPdfDownloadFileName(fileName: string) {
  return fileName.replace(/\.pdf$/i, "-rotated.pdf");
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function printPdfBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");

  frame.setAttribute("aria-hidden", "true");
  frame.className = "fixed size-0 border-0 opacity-0";
  frame.addEventListener(
    "load",
    () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();

      window.setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 1000);
    },
    { once: true }
  );
  frame.src = url;
  document.body.append(frame);
}

async function downloadPdfWithPageRotations({
  fileName,
  pageRotationDeltas,
  src,
}: {
  fileName: string;
  pageRotationDeltas: PageRotationDeltas;
  src: string;
}) {
  const response = await fetch(src);

  if (!response.ok) {
    throw new Error(`Failed to download PDF (${response.status})`);
  }

  if (pageRotationDeltas.size === 0) {
    downloadBlob(await response.blob(), fileName);
    return;
  }

  const [{ PDFDocument, degrees }, pdfBytes] = await Promise.all([
    import("pdf-lib"),
    response.arrayBuffer(),
  ]);
  const pdfDocument = await PDFDocument.load(pdfBytes);

  pdfDocument.getPages().forEach((page, pageIndex) => {
    const rotationDelta = pageRotationDeltas.get(pageIndex);

    if (!rotationDelta) {
      return;
    }

    page.setRotation(
      degrees(
        normalizeDegrees(
          page.getRotation().angle + rotationToDegrees(rotationDelta)
        )
      )
    );
  });

  const nextPdfBytes = await pdfDocument.save();
  const nextPdfBuffer = new ArrayBuffer(nextPdfBytes.byteLength);
  new Uint8Array(nextPdfBuffer).set(nextPdfBytes);

  downloadBlob(
    new Blob([nextPdfBuffer], { type: "application/pdf" }),
    getRotatedPdfDownloadFileName(fileName)
  );
}

function getThumbnailMetaForPage({
  page,
  pageIndex,
  rotation,
  width,
  imagePadding,
  labelHeight,
  top,
}: {
  page: PdfDocumentObject["pages"][number];
  pageIndex: number;
  rotation: Rotation;
  width: number;
  imagePadding: number;
  labelHeight: number;
  top: number;
}): ThumbMeta {
  const innerWidth = Math.max(1, width - imagePadding * 2);
  const pageWidth = rotation % 2 === 1 ? page.size.height : page.size.width;
  const pageHeight = rotation % 2 === 1 ? page.size.width : page.size.height;
  const imageHeight = Math.round(innerWidth * (pageHeight / pageWidth));
  const wrapperHeight = imagePadding + imageHeight + imagePadding + labelHeight;

  return {
    pageIndex,
    width: innerWidth,
    height: imageHeight,
    wrapperHeight,
    top,
    labelHeight,
    padding: imagePadding,
  };
}

function buildThumbnailLayout({
  basePageRotations,
  pageRotationDeltas,
  pdfDocument,
  width,
  gap,
  imagePadding,
  labelHeight,
  paddingY,
}: {
  basePageRotations: Rotation[];
  pageRotationDeltas: PageRotationDeltas;
  pdfDocument: PdfDocumentObject | null;
  width: number;
  gap: number;
  imagePadding: number;
  labelHeight: number;
  paddingY: number;
}) {
  if (!pdfDocument) {
    return null;
  }

  let top = paddingY;
  const items = pdfDocument.pages.map((page, pageIndex) => {
    const basePageRotation =
      basePageRotations[pageIndex] ?? normalizeRotation(page.rotation);
    const pageRotation = normalizeRotation(
      basePageRotation + (pageRotationDeltas.get(pageIndex) ?? 0)
    );
    const meta = getThumbnailMetaForPage({
      page,
      pageIndex,
      rotation: pageRotation,
      width,
      imagePadding,
      labelHeight,
      top,
    });

    top += meta.wrapperHeight + gap;
    return meta;
  });

  return {
    items,
    totalHeight: items.length > 0 ? top - gap + paddingY : paddingY * 2,
  };
}

function getVisibleThumbnailItems({
  buffer,
  clientHeight,
  items,
  scrollTop,
}: {
  buffer: number;
  clientHeight: number;
  items: ThumbMeta[];
  scrollTop: number;
}) {
  if (items.length === 0) {
    return [];
  }
  if (clientHeight <= 0) {
    return items.slice(0, Math.min(items.length, buffer * 2));
  }

  const viewportBottom = scrollTop + clientHeight;
  let start = items.findIndex(
    (item) => item.top + item.wrapperHeight >= scrollTop
  );

  if (start === -1) {
    start = items.length - 1;
  }

  let end = start;
  while (end < items.length && items[end].top <= viewportBottom) {
    end += 1;
  }

  return items.slice(
    Math.max(0, start - buffer),
    Math.min(items.length, end + buffer)
  );
}

function PDFViewerLoadingSkeleton() {
  return <PreviewLoadingState className="absolute inset-0 z-20" />;
}

// Rendered while the engine or document is not ready: same frame and controls
// As the full viewer, with document-dependent controls disabled.
function PDFViewerFallbackShell({
  className,
  defaultZoom,
  fileName,
  showDownload,
  showPrint,
  showRotateControls,
  showToolbar,
  showUpload,
  state,
  toolbarActions,
  onUploadFile,
}: {
  className?: string;
  defaultZoom: number;
  fileName?: string;
  showDownload: boolean;
  showPrint: boolean;
  showRotateControls: boolean;
  showToolbar: boolean;
  showUpload: boolean;
  state: "loading" | "error" | "empty";
  toolbarActions?: React.ReactNode;
  onUploadFile?: (file: File) => void;
}) {
  const { dictionary } = useI18n();

  return (
    <div
      data-slot="pdf-viewer"
      className={cn(
        "flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden bg-background",
        className
      )}
    >
      {showToolbar ? (
        <PDFViewerToolbar
          copy={dictionary.pdfViewer}
          activePage={1}
          controlsDisabled
          currentZoomLevel={defaultZoom}
          zoomLevel={defaultZoom}
          fileName={fileName}
          numPages={0}
          searchControl={
            <ToolbarTooltip label="Search text">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Search text"
                disabled
              >
                <HugeiconsIcon icon={Search01Icon} className="size-4" />
              </Button>
            </ToolbarTooltip>
          }
          showDownload={showDownload}
          showPrint={showPrint}
          showRotateControls={showRotateControls}
          showUpload={showUpload}
          toolbarActions={toolbarActions}
          onPageChange={() => {}}
          onPrint={() => {}}
          onRotate={() => {}}
          onToggleSidebar={() => {}}
          onUploadFile={onUploadFile}
          onZoomChange={() => {}}
        />
      ) : null}
      <div
        className={cn(
          "relative flex min-h-0 flex-1 overflow-hidden",
          PAGED_DOCUMENT_PREVIEW_CANVAS_CLASS_NAME
        )}
      >
        {state === "loading" ? <PDFViewerLoadingSkeleton /> : null}
        {state === "error" ? <div className="absolute inset-0 z-20" /> : null}
        {state === "empty" ? (
          <div className="absolute inset-0 z-20 grid place-items-center bg-background p-6 text-center text-sm text-muted-foreground">
            <div className="max-w-sm space-y-3">
              <div className="font-medium text-foreground">
                Upload a PDF to preview
              </div>
              <div>
                Pass a PDF URL with the <code>src</code> prop or use the upload
                control.
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ToolbarTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function PDFViewerFileActionsMenu({
  additionalControls,
  copy,
  downloadDisabled,
  isPreparingDownload = false,
  onDownload,
  onRotate,
  onPrint,
  onUploadFile,
  printDisabled = false,
  isPreparingPrint = false,
  rotateDisabled = false,
  showDownload = false,
  showPrint = false,
  showRotateControls = false,
  showUpload = false,
}: {
  additionalControls?: React.ReactNode;
  copy: PDFViewerCopy;
  downloadDisabled?: boolean;
  isPreparingDownload?: boolean;
  onDownload?: () => void;
  onRotate?: (direction: 1 | -1) => void;
  onPrint?: () => void;
  onUploadFile?: (file: File) => void;
  printDisabled?: boolean;
  isPreparingPrint?: boolean;
  rotateDisabled?: boolean;
  showDownload?: boolean;
  showPrint?: boolean;
  showRotateControls?: boolean;
  showUpload?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  if (
    !additionalControls &&
    !showDownload &&
    !showPrint &&
    !showRotateControls &&
    !showUpload
  ) {
    return null;
  }

  return (
    <>
      {showUpload && onUploadFile ? (
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const nextFile = event.target.files?.[0];

            if (nextFile) {
              onUploadFile(nextFile);
              event.currentTarget.value = "";
            }
          }}
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Open PDF actions"
            />
          }
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {additionalControls ? (
            <>
              <div className="flex flex-wrap items-center gap-1 p-1">
                {additionalControls}
              </div>
              {showDownload || showPrint || showRotateControls || showUpload ? (
                <DropdownMenuSeparator />
              ) : null}
            </>
          ) : null}
          {showDownload ? (
            <DropdownMenuItem disabled={downloadDisabled} onClick={onDownload}>
              {isPreparingDownload ? (
                <Spinner className="size-4" />
              ) : (
                <HugeiconsIcon icon={Download01Icon} className="size-4" />
              )}
              Download
            </DropdownMenuItem>
          ) : null}
          {showPrint && onPrint ? (
            <DropdownMenuItem disabled={printDisabled} onClick={onPrint}>
              {isPreparingPrint ? (
                <Spinner className="size-4" />
              ) : (
                <HugeiconsIcon icon={PrinterIcon} className="size-4" />
              )}
              {copy.print}
            </DropdownMenuItem>
          ) : null}
          {showUpload && onUploadFile ? (
            <DropdownMenuItem onClick={() => inputRef.current?.click()}>
              <HugeiconsIcon icon={Upload01Icon} className="size-4" />
              Upload
            </DropdownMenuItem>
          ) : null}
          {showRotateControls && onRotate ? (
            <>
              {showDownload || showPrint || (showUpload && onUploadFile) ? (
                <DropdownMenuSeparator />
              ) : null}
              <DropdownMenuItem
                disabled={rotateDisabled}
                onClick={() => onRotate(-1)}
              >
                <HugeiconsIcon icon={RotateClockwiseIcon} className="size-4" />
                Rotate counterclockwise
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={rotateDisabled}
                onClick={() => onRotate(1)}
              >
                <HugeiconsIcon
                  icon={RotateClockwiseIcon}
                  className="size-4 -scale-x-100"
                />
                Rotate clockwise
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function PDFViewerPageNumberControl({
  compact = false,
  activePage,
  controlsDisabled,
  numPages,
  onPageChange,
}: {
  compact?: boolean;
  activePage: number;
  controlsDisabled: boolean;
  numPages: number;
  onPageChange: (pageNumber: number) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const displayPage = numPages ? activePage : 1;
  const [isEditing, setIsEditing] = React.useState(false);
  const [draftPage, setDraftPage] = React.useState(() => String(displayPage));

  React.useEffect(() => {
    if (!isEditing) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const applyPageDraft = React.useCallback(
    (value: string) => {
      const trimmedValue = value.trim();

      if (!trimmedValue) {
        return;
      }

      const parsedPage = Number(trimmedValue);

      if (!Number.isInteger(parsedPage)) {
        return;
      }

      onPageChange(Math.min(Math.max(parsedPage, 1), Math.max(numPages, 1)));
    },
    [numPages, onPageChange]
  );

  return (
    <div
      className={cn(
        "grid items-center text-sm whitespace-nowrap text-primary",
        compact
          ? "grid-cols-[repeat(3,1.25rem)]"
          : "grid-cols-[auto_repeat(3,1.25rem)]"
      )}
    >
      {compact ? null : <span className="mr-1">Page</span>}
      {isEditing ? (
        <Input
          ref={inputRef}
          aria-label="Page number"
          inputMode="numeric"
          pattern="[0-9]*"
          size="sm"
          value={draftPage}
          className="w-7 min-w-7 rounded-md [&_[data-slot=input]]:text-center"
          onBlur={() => setIsEditing(false)}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            const nextValue = event.target.value;

            setDraftPage(nextValue);
            applyPageDraft(nextValue);
          }}
          onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Enter" || event.key === "Escape") {
              event.currentTarget.blur();
            }
          }}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="size-5 p-0 font-normal tabular-nums"
          aria-label={`Current page ${displayPage}. Edit page number`}
          disabled={controlsDisabled || !numPages}
          onClick={() => {
            setDraftPage(String(displayPage));
            setIsEditing(true);
          }}
        >
          {displayPage}
        </Button>
      )}
      <span className="flex size-5 items-center justify-center">
        {compact ? "/" : "of"}
      </span>
      <span className="flex size-5 items-center justify-center tabular-nums">
        {numPages || "–"}
      </span>
    </div>
  );
}

function PDFViewerSearchControl({
  documentId,
  controlsDisabled,
}: {
  documentId: string;
  controlsDisabled: boolean;
}) {
  const { state, provides } = useSearch(documentId);
  const { provides: scroll } = useScroll(documentId);
  const [searchDraft, setSearchDraft] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const providesRef = React.useRef(provides);
  const scrollRef = React.useRef(scroll);
  const searchRequestIdRef = React.useRef(0);
  const hasPendingSearch = searchDraft.trim() !== searchQuery;
  const hasActiveQuery = Boolean(searchQuery.trim());
  const resultLabel =
    isSearching || hasPendingSearch
      ? "Searching"
      : hasActiveQuery
        ? state.total
          ? `${state.activeResultIndex + 1} / ${state.total}`
          : "No results"
        : "No search";
  const scrollToResult = React.useCallback(
    (index: number) => {
      const result = state.results[index];

      if (!result || !scroll) {
        return;
      }

      const [firstRect] = result.rects;

      scroll.scrollToPage({
        pageNumber: result.pageIndex + 1,
        ...(firstRect
          ? {
              pageCoordinates: {
                x: firstRect.origin.x,
                y: firstRect.origin.y,
              },
              alignY: 30,
            }
          : {}),
        behavior: "auto",
      });
    },
    [scroll, state.results]
  );

  React.useEffect(() => {
    providesRef.current = provides;
    scrollRef.current = scroll;
  }, [provides, scroll]);

  const runSearch = React.useCallback((rawQuery: string) => {
    const query = rawQuery.trim();
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    setSearchQuery(query);

    const searchProvider = providesRef.current;
    const scrollProvider = scrollRef.current;

    if (!searchProvider) {
      setIsSearching(false);
      return;
    }

    if (!query) {
      searchProvider.stopSearch();
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchProvider.startSearch();
    searchProvider.searchAllPages(query).wait(
      (result) => {
        if (searchRequestIdRef.current !== requestId) {
          return;
        }

        const [firstResult] = result.results;

        if (firstResult && scrollProvider) {
          searchProvider.goToResult(0);
          const [firstRect] = firstResult.rects;

          scrollProvider.scrollToPage({
            pageNumber: firstResult.pageIndex + 1,
            ...(firstRect
              ? {
                  pageCoordinates: {
                    x: firstRect.origin.x,
                    y: firstRect.origin.y,
                  },
                  alignY: 30,
                }
              : {}),
            behavior: "auto",
          });
        }
        setIsSearching(false);
      },
      () => {
        if (searchRequestIdRef.current !== requestId) {
          return;
        }
        setIsSearching(false);
      }
    );
  }, []);

  React.useEffect(() => {
    if (!searchDraft.trim()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      runSearch(searchDraft);
    }, PDF_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [runSearch, searchDraft]);

  const handleSearchDraftChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextDraft = event.target.value;

      setSearchDraft(nextDraft);

      if (nextDraft.trim()) {
        setIsSearching(true);
        return;
      }

      searchRequestIdRef.current += 1;
      setSearchQuery("");
      setIsSearching(false);
      provides?.stopSearch();
    },
    [provides]
  );
  const clearSearch = React.useCallback(() => {
    searchRequestIdRef.current += 1;
    setSearchDraft("");
    setSearchQuery("");
    setIsSearching(false);
    provides?.stopSearch();
  }, [provides]);
  const navigate = React.useCallback(
    (direction: 1 | -1) => {
      if (!provides || state.total === 0) {
        return;
      }

      const index =
        direction === 1 ? provides.nextResult() : provides.previousResult();

      scrollToResult(index);
    },
    [provides, scrollToResult, state.total]
  );

  return (
    <Popover>
      <ToolbarTooltip label="Search text">
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Search text"
              disabled={controlsDisabled}
            />
          }
        >
          <HugeiconsIcon icon={Search01Icon} className="size-4" />
        </PopoverTrigger>
      </ToolbarTooltip>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        initialFocus={false}
        className="w-auto max-w-[calc(100vw-1rem)] border-border/70 shadow-md/5 [&_[data-slot=popover-viewport]]:px-2 [&_[data-slot=popover-viewport]]:py-2"
      >
        <div className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
          <Input
            aria-label="Search text"
            placeholder="Search text"
            size="sm"
            value={searchDraft}
            className="w-36 min-w-0 border-border/70 bg-background shadow-none has-focus-visible:border-border has-focus-visible:ring-0"
            onChange={handleSearchDraftChange}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              if (isSearching || hasPendingSearch) {
                if (searchDraft.trim()) {
                  runSearch(searchDraft);
                }
                return;
              }

              if (event.shiftKey && state.total) {
                navigate(-1);
              } else if (state.total) {
                navigate(1);
              } else if (searchDraft.trim()) {
                runSearch(searchDraft);
              }
            }}
          />
          <span className="min-w-8 text-center text-xs text-muted-foreground tabular-nums">
            {!isSearching && !hasPendingSearch && state.total
              ? `${state.activeResultIndex + 1} / ${state.total}`
              : resultLabel}
          </span>
          <ButtonGroup label="Search result navigation">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Previous result"
              disabled={isSearching || hasPendingSearch || state.total === 0}
              onClick={() => navigate(-1)}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Next result"
              disabled={isSearching || hasPendingSearch || state.total === 0}
              onClick={() => navigate(1)}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
            </Button>
          </ButtonGroup>
          <Button type="button" variant="ghost" size="xs" onClick={clearSearch}>
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PDFViewerAnnotationMenu({
  documentId,
  selected,
  context,
  menuWrapperProps,
}: AnnotationSelectionMenuProps & { documentId: string }) {
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const { provides } = useAnnotation(documentId);
  const { dictionary } = useI18n();
  const copy = dictionary.pdfViewer;
  const annotation = context.annotation.object;

  if (!selected || !isVisiblePDFAnnotation(annotation)) {
    return null;
  }

  const content = getPDFAnnotationContent(annotation);
  const author =
    annotation.author?.trim() === getPDFAnnotationTitle(annotation, copy)
      ? undefined
      : annotation.author?.trim();
  const date = formatPDFAnnotationDate(
    annotation.modified ?? annotation.created
  );

  return (
    <Popover
      open
      onOpenChange={(open, details) => {
        // PDF selection owns pointer dismissal; the opening pointer must not
        // immediately dismiss the portalled popup as an outside press.
        if (!open && details.reason === "escape-key") {
          provides?.deselectAnnotation();
        }
      }}
    >
      <div
        {...menuWrapperProps}
        ref={anchorRef}
        className="pointer-events-none"
      />
      <PopoverContent
        anchor={anchorRef}
        side="left"
        align="start"
        sideOffset={12}
        className="pointer-events-auto w-[min(26rem,calc(100vw-2rem))] [&>[data-slot=popover-viewport]]:p-0"
        data-pdf-annotation-popup
        role="dialog"
        aria-label={getPDFAnnotationTitle(annotation, copy)}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm leading-5 font-semibold">
              {getPDFAnnotationTitle(annotation, copy)}
            </p>
            {author || date ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {author}
                {date ? `${author ? " · " : ""}${date}` : ""}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="-mt-1 -mr-1 shrink-0"
            aria-label={copy.closeAnnotations}
            onClick={() => provides?.deselectAnnotation()}
          >
            <span aria-hidden="true" className="text-base leading-none">
              ×
            </span>
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto px-4 py-3 text-sm leading-6 break-words">
          <PdfNoteContent
            custom={annotation.custom}
            text={content || getPDFAnnotationTitle(annotation, copy)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PDFViewerAnnotationPanel({
  annotations,
  onClose,
  onSelect,
}: {
  annotations: TrackedAnnotation[];
  onClose: () => void;
  onSelect: (annotation: PdfAnnotationObject) => void;
}) {
  const { dictionary } = useI18n();
  const copy = dictionary.pdfViewer;

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 shrink-0 flex-col border-l border-border/70 bg-background",
        PDF_ANNOTATION_PANEL_WIDTH_CLASS
      )}
      aria-label={copy.annotations}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/70 px-4">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Comment01Icon} className="size-4" />
          <span className="text-sm font-semibold">{copy.annotations}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
            {annotations.length}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={copy.closeAnnotations}
          onClick={onClose}
        >
          <span aria-hidden="true" className="text-base leading-none">
            ×
          </span>
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {annotations.length > 0 ? (
          <div className="space-y-2 p-3">
            {annotations.map(({ object: annotation }) => {
              const content = getPDFAnnotationContent(annotation);
              const author = annotation.author?.trim() || copy.unknownAuthor;
              const date = formatPDFAnnotationDate(
                annotation.modified ?? annotation.created
              );
              return (
                <button
                  key={`${annotation.pageIndex}:${annotation.id}`}
                  type="button"
                  className="w-full rounded-lg border border-border/60 bg-background px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  onClick={() => onSelect(annotation)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm leading-5 font-medium">
                      {getPDFAnnotationTitle(annotation, copy)}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {copy.pagePrefix} {annotation.pageIndex + 1}
                      {copy.pageSuffix}
                    </span>
                  </div>
                  {content ? (
                    <p className="mt-1 line-clamp-3 text-xs leading-5 break-words whitespace-pre-wrap text-muted-foreground">
                      {content}
                    </p>
                  ) : null}
                  <p className="mt-2 truncate text-[11px] text-muted-foreground/80">
                    {author}
                    {date ? ` · ${date}` : ""}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {copy.emptyAnnotations}
          </p>
        )}
      </ScrollArea>
    </aside>
  );
}

function PDFViewerToolbar({
  copy,
  activePage,
  controlsDisabled,
  currentZoomLevel,
  zoomLevel,
  downloadDisabled = controlsDisabled,
  isPreparingDownload = false,
  isPreparingPrint = false,
  fileName,
  numPages,
  searchControl,
  annotationControl,
  showDownload,
  showPrint,
  showRotateControls,
  showUpload,
  sidebarOpen = false,
  toolbarActions,
  onDownload,
  onPrint,
  onPageChange,
  onRotate,
  onToggleSidebar,
  onUploadFile,
  onZoomChange,
}: {
  copy: PDFViewerCopy;
  activePage: number;
  controlsDisabled: boolean;
  currentZoomLevel: number;
  zoomLevel: ZoomLevel;
  downloadDisabled?: boolean;
  isPreparingDownload?: boolean;
  isPreparingPrint?: boolean;
  fileName?: string;
  numPages: number;
  searchControl: React.ReactNode;
  annotationControl?: React.ReactNode;
  showDownload: boolean;
  showPrint: boolean;
  showRotateControls: boolean;
  showUpload: boolean;
  sidebarOpen?: boolean;
  toolbarActions?: React.ReactNode;
  onDownload?: () => void;
  onPrint?: () => void;
  onPageChange: (pageNumber: number) => void;
  onRotate: (direction: 1 | -1) => void;
  onToggleSidebar: () => void;
  onUploadFile?: (file: File) => void;
  onZoomChange: (zoomLevel: ZoomLevel) => void;
}) {
  const canGoPrevious = !controlsDisabled && activePage > 1;
  const canGoNext = !controlsDisabled && numPages > 0 && activePage < numPages;
  const [toolbarRef, toolbarWidth] = useElementWidth<HTMLDivElement>();
  const compact = toolbarWidth > 0 && toolbarWidth < 700;
  const minimal = toolbarWidth > 0 && toolbarWidth < 440;

  return (
    <div
      ref={toolbarRef}
      data-file-identity-toolbar
      data-pdf-toolbar
      style={{ flexWrap: "nowrap" }}
      className="flex min-h-12 flex-nowrap items-center justify-between gap-0 border-b border-border/60 bg-background px-3 py-2"
    >
      <div
        data-file-identity-leading
        className="flex min-w-0 flex-nowrap items-center gap-0"
      >
        <TooltipProvider>
          <ToolbarTooltip label="Toggle thumbnails">
            <Button
              type="button"
              variant={sidebarOpen ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label="Toggle thumbnails"
              aria-pressed={sidebarOpen}
              disabled={controlsDisabled}
              onClick={onToggleSidebar}
            >
              <HugeiconsIcon icon={SidebarLeftIcon} className="size-4" />
            </Button>
          </ToolbarTooltip>
        </TooltipProvider>
        {compact ? null : (
          <>
            <Separator
              orientation="vertical"
              className="mx-3 h-5 self-center"
            />
            <ResponsiveProjectFileIdentity
              fileName={fileName ?? "document.pdf"}
            />
          </>
        )}
        <Separator
          orientation="vertical"
          className={compact ? "mx-1 h-5 self-center" : "mx-3 h-5 self-center"}
        />
        <ToolbarTooltip label="Previous page">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Previous page"
            disabled={!canGoPrevious}
            onClick={() => onPageChange(activePage - 1)}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
          </Button>
        </ToolbarTooltip>
        <PDFViewerPageNumberControl
          compact={compact}
          activePage={activePage}
          controlsDisabled={controlsDisabled}
          numPages={numPages}
          onPageChange={onPageChange}
        />
        <ToolbarTooltip label="Next page">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Next page"
            disabled={!canGoNext}
            onClick={() => onPageChange(activePage + 1)}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
          </Button>
        </ToolbarTooltip>
      </div>
      <TooltipProvider>
        <div
          data-file-identity-trailing
          style={{ flexWrap: "nowrap" }}
          className="flex min-w-0 flex-nowrap items-center justify-end gap-0"
        >
          <Separator
            orientation="vertical"
            className="mx-0.5 h-5 self-center"
          />
          <div className="flex flex-none items-center gap-1">
            {minimal ? null : (
              <ToolbarTooltip label="Zoom out">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Zoom out"
                  disabled={
                    controlsDisabled || currentZoomLevel <= ZOOM_OPTIONS[0]
                  }
                  onClick={() => {
                    const nextZoom = [...ZOOM_OPTIONS]
                      .toReversed()
                      .find((option) => option < currentZoomLevel);

                    onZoomChange(nextZoom ?? ZOOM_OPTIONS[0]);
                  }}
                >
                  <HugeiconsIcon
                    icon={MinusSignCircleIcon}
                    className="size-4"
                  />
                </Button>
              </ToolbarTooltip>
            )}
            <Select
              value={String(zoomLevel)}
              onValueChange={(value) => {
                if (value === ZoomMode.FitPage || value === ZoomMode.FitWidth) {
                  onZoomChange(value);
                  return;
                }

                onZoomChange(Number(value));
              }}
              disabled={controlsDisabled}
              modal={false}
            >
              <SelectTrigger
                size="sm"
                className={PREVIEW_ZOOM_TRIGGER_CLASS_NAME}
                aria-label="Zoom level"
              >
                <SelectValue
                  className={PREVIEW_ZOOM_VALUE_CLASS_NAME}
                  placeholder="Zoom"
                >
                  {zoomLevel === ZoomMode.FitPage
                    ? copy.fitPage
                    : zoomLevel === ZoomMode.FitWidth
                      ? copy.fitWidth
                      : formatPreviewZoomPercentage(currentZoomLevel)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value={ZoomMode.FitPage}>{copy.fitPage}</SelectItem>
                <SelectItem value={ZoomMode.FitWidth}>
                  {copy.fitWidth}
                </SelectItem>
                <SelectItem value="1">{copy.actualSize} (100%)</SelectItem>
                {ZOOM_OPTIONS.map((option) =>
                  option === 1 ? null : (
                    <SelectItem key={option} value={String(option)}>
                      {Math.round(option * 100)}%
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            {minimal ? null : (
              <ToolbarTooltip label="Zoom in">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Zoom in"
                  disabled={
                    controlsDisabled ||
                    currentZoomLevel >= ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1]
                  }
                  onClick={() => {
                    const nextZoom = ZOOM_OPTIONS.find(
                      (option) => option > currentZoomLevel
                    );

                    onZoomChange(
                      nextZoom ?? ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1]
                    );
                  }}
                >
                  <HugeiconsIcon icon={PlusSignCircleIcon} className="size-4" />
                </Button>
              </ToolbarTooltip>
            )}
          </div>
          {compact ? null : (
            <Separator
              orientation="vertical"
              className="mx-1 h-4 self-center"
            />
          )}
          {compact ? null : searchControl}
          {compact ? null : annotationControl}
          {compact ||
          showDownload ||
          showPrint ||
          showRotateControls ||
          showUpload ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-1 h-4 self-center"
              />
              <PDFViewerFileActionsMenu
                additionalControls={
                  compact ? (
                    <>
                      {searchControl}
                      {annotationControl}
                      {toolbarActions}
                    </>
                  ) : undefined
                }
                copy={copy}
                downloadDisabled={downloadDisabled}
                isPreparingDownload={isPreparingDownload}
                isPreparingPrint={isPreparingPrint}
                onDownload={onDownload}
                onPrint={onPrint}
                onRotate={onRotate}
                onUploadFile={onUploadFile}
                printDisabled={controlsDisabled || isPreparingPrint}
                rotateDisabled={controlsDisabled}
                showDownload={showDownload}
                showPrint={showPrint}
                showRotateControls={showRotateControls}
                showUpload={showUpload}
              />
            </>
          ) : null}
          {!compact && toolbarActions ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-1 h-4 self-center"
              />
              {toolbarActions}
            </>
          ) : null}
          <PreviewCloseAction />
        </div>
      </TooltipProvider>
    </div>
  );
}

function setPdfViewerRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) {
    return;
  }

  if (typeof ref === "function") {
    ref(value);
  } else {
    ref.current = value;
  }
}

function PDFViewerScrollArea({
  children,
  className,
  viewportClassName,
  viewportProps,
  viewportRef,
  scrollbarAlwaysVisible = false,
  scrollbarGutter = false,
}: {
  children: React.ReactNode;
  className?: string;
  viewportClassName?: string;
  viewportProps?: React.HTMLAttributes<HTMLDivElement>;
  viewportRef?: React.Ref<HTMLDivElement>;
  scrollbarAlwaysVisible?: boolean;
  scrollbarGutter?: boolean;
}) {
  const resolveScrollAreaViewport = React.useContext(
    PDFViewerScrollAreaResolverContext
  );
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const setViewportRef = React.useCallback(
    (viewport: HTMLDivElement | null) => {
      setPdfViewerRef(viewportRef, viewport);
    },
    [viewportRef]
  );

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const viewport = resolveScrollAreaViewport(container);

    if (!viewport) {
      console.error(
        `PDFViewer could not resolve the scroll viewport. Add ${DEFAULT_SCROLL_AREA_VIEWPORT_SELECTOR} to your ScrollArea viewport or pass resolveScrollAreaViewport.`
      );
      return;
    }

    setViewportRef(viewport);

    return () => setViewportRef(null);
  }, [resolveScrollAreaViewport, setViewportRef]);

  return (
    <div
      ref={containerRef}
      data-slot="pdf-viewer-scroll-area"
      className={cn("size-full min-h-0", className)}
    >
      <ScrollArea
        className="size-full min-h-0"
        scrollbarAlwaysVisible={scrollbarAlwaysVisible}
        scrollbarGutter={scrollbarGutter}
        viewportClassName={viewportClassName}
        viewportProps={viewportProps}
        viewportRef={setViewportRef}
      >
        {children}
      </ScrollArea>
    </div>
  );
}

function PDFViewerThumbnails({
  basePageRotations,
  documentId,
  activePage,
  pageCount,
  pageRotationDeltas,
  pdfDocument,
  selectedPageIndexes,
  onSelectPage,
}: {
  basePageRotations: Rotation[];
  documentId: string;
  activePage: number;
  pageCount: number;
  pageRotationDeltas: PageRotationDeltas;
  pdfDocument: PdfDocumentObject | null;
  selectedPageIndexes: Set<number>;
  onSelectPage: (pageNumber: number, mode: ThumbnailSelectionMode) => void;
}) {
  const thumbnailListboxId = React.useId();
  const activeDescendantId =
    activePage > 0 ? `${thumbnailListboxId}-page-${activePage}` : undefined;
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (pageCount < 1) {
        return;
      }

      const currentPage = activePage > 0 ? activePage : 1;
      let nextPage: number | null = null;

      if (event.key === "ArrowDown") {
        nextPage = Math.min(pageCount, currentPage + 1);
      } else if (event.key === "ArrowUp") {
        nextPage = Math.max(1, currentPage - 1);
      } else if (event.key === "Home") {
        nextPage = 1;
      } else if (event.key === "End") {
        nextPage = pageCount;
      } else if (event.key === " ") {
        event.preventDefault();
        onSelectPage(currentPage, "toggle");
        return;
      }

      if (nextPage === null) {
        return;
      }

      event.preventDefault();
      onSelectPage(nextPage, event.shiftKey ? "range" : "replace");
    },
    [activePage, onSelectPage, pageCount]
  );

  return (
    <PDFViewerThumbnailScrollArea
      activeDescendantId={activeDescendantId}
      basePageRotations={basePageRotations}
      documentId={documentId}
      onKeyDown={handleKeyDown}
      pageRotationDeltas={pageRotationDeltas}
      pdfDocument={pdfDocument}
    >
      {(meta: ThumbMeta) => {
        const pageNumber = meta.pageIndex + 1;
        const isActive = pageNumber === activePage;
        const isSelected = selectedPageIndexes.has(meta.pageIndex);
        const imagePadding = meta.padding ?? 0;
        const pageRotationDelta = pageRotationDeltas.get(meta.pageIndex) ?? 0;
        const thumbnailImageStyle: React.CSSProperties =
          pageRotationDelta % 2 === 1
            ? {
                height: meta.width,
                transform: `rotate(${rotationToDegrees(pageRotationDelta)}deg)`,
                width: meta.height,
              }
            : {
                height: meta.height,
                transform:
                  pageRotationDelta === 0
                    ? undefined
                    : `rotate(${rotationToDegrees(pageRotationDelta)}deg)`,
                width: meta.width,
              };

        return (
          <div
            key={meta.pageIndex}
            data-pdf-viewer-thumbnail={pageNumber}
            className={cn(
              "absolute right-0 left-0 flex justify-center",
              isActive && "z-10"
            )}
            style={{ top: meta.top, height: meta.wrapperHeight }}
          >
            <div
              tabIndex={0}
              id={`${thumbnailListboxId}-page-${pageNumber}`}
              role="option"
              data-pdf-viewer-thumbnail-option={pageNumber}
              aria-current={isActive ? "page" : undefined}
              aria-label={`Page ${pageNumber}`}
              aria-posinset={pageNumber}
              aria-selected={isSelected}
              aria-setsize={pageCount}
              data-selected={isSelected ? "" : undefined}
              className={cn(
                "flex h-full w-full cursor-default flex-col items-center justify-between rounded-md px-2 py-0 text-xs transition-[background-color,box-shadow,color] duration-150 motion-reduce:transition-none outline-none select-none hover:bg-workbench-row-hover",
                isActive || isSelected
                  ? "bg-workbench-active text-workbench-active-foreground ring-2 ring-inset ring-[var(--pw-color-primary)] hover:bg-workbench-active"
                  : "text-[var(--pw-color-muted-foreground)]",
                isActive && THUMBNAIL_FOCUS_RING_CLASS
              )}
              onClick={(event) => {
                const mode = event.shiftKey
                  ? "range"
                  : event.metaKey || event.ctrlKey
                    ? "toggle"
                    : "replace";

                onSelectPage(pageNumber, mode);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectPage(pageNumber, "replace");
                }
              }}
            >
              <span
                className="mt-0 flex items-center justify-center overflow-hidden rounded-md bg-transparent"
                style={{
                  width: meta.width + imagePadding * 2,
                  height: meta.height + imagePadding * 2,
                  padding: imagePadding,
                }}
              >
                <ThumbImg
                  documentId={documentId}
                  meta={meta}
                  className="block rounded-sm object-contain"
                  style={thumbnailImageStyle}
                />
              </span>
              <span
                className="flex items-center justify-center tabular-nums"
                style={{ height: meta.labelHeight }}
              >
                <span className="flex min-w-5 items-center justify-center px-1.5 text-center leading-5">
                  {pageNumber}
                </span>
              </span>
            </div>
          </div>
        );
      }}
    </PDFViewerThumbnailScrollArea>
  );
}

function PDFViewerThumbnailScrollArea({
  activeDescendantId,
  basePageRotations,
  children,
  documentId,
  onKeyDown,
  pageRotationDeltas,
  pdfDocument,
}: {
  activeDescendantId?: string;
  basePageRotations: Rotation[];
  children: (meta: ThumbMeta) => React.ReactNode;
  documentId: string;
  onKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
  pageRotationDeltas: PageRotationDeltas;
  pdfDocument: PdfDocumentObject | null;
}) {
  const { plugin: thumbnailPlugin } = useThumbnailPlugin();
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [viewportMetrics, setViewportMetrics] = React.useState({
    clientHeight: 0,
    scrollTop: 0,
  });
  const thumbnailScope = React.useMemo(
    () => thumbnailPlugin?.provides().forDocument(documentId) ?? null,
    [documentId, thumbnailPlugin]
  );
  const windowState = React.useSyncExternalStore(
    React.useCallback(
      (onStoreChange) => {
        if (!thumbnailScope) {
          return () => {};
        }

        return thumbnailScope.onWindow(() => onStoreChange());
      },
      [thumbnailScope]
    ),
    React.useCallback(
      () => thumbnailScope?.getWindow() ?? null,
      [thumbnailScope]
    ),
    () => null
  );
  const hasWindowState = Boolean(windowState);
  const paddingY = thumbnailPlugin?.cfg.paddingY ?? 0;
  const thumbnailLayout = React.useMemo(
    () =>
      buildThumbnailLayout({
        basePageRotations,
        pageRotationDeltas,
        pdfDocument,
        width: thumbnailPlugin?.cfg.width ?? THUMBNAIL_WIDTH,
        gap: thumbnailPlugin?.cfg.gap ?? THUMBNAIL_GAP,
        imagePadding: thumbnailPlugin?.cfg.imagePadding ?? 0,
        labelHeight: thumbnailPlugin?.cfg.labelHeight ?? THUMBNAIL_LABEL_HEIGHT,
        paddingY,
      }),
    [
      basePageRotations,
      pageRotationDeltas,
      pdfDocument,
      paddingY,
      thumbnailPlugin,
    ]
  );
  const effectiveWindowState = React.useMemo(() => {
    if (!thumbnailLayout) {
      return windowState;
    }

    const items = getVisibleThumbnailItems({
      buffer: thumbnailPlugin?.cfg.buffer ?? 3,
      clientHeight: viewportMetrics.clientHeight,
      items: thumbnailLayout.items,
      scrollTop: viewportMetrics.scrollTop,
    });

    return {
      start: items[0]?.pageIndex ?? -1,
      end: items.at(-1)?.pageIndex ?? -1,
      items,
      totalHeight: thumbnailLayout.totalHeight,
    };
  }, [thumbnailLayout, thumbnailPlugin, viewportMetrics, windowState]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !thumbnailScope) {
      return;
    }

    const updateWindow = () => {
      setViewportMetrics({
        clientHeight: viewport.clientHeight,
        scrollTop: viewport.scrollTop,
      });
      thumbnailScope.updateWindow(viewport.scrollTop, viewport.clientHeight);
    };

    viewport.addEventListener("scroll", updateWindow);
    const frame = window.requestAnimationFrame(updateWindow);

    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener("scroll", updateWindow);
    };
  }, [thumbnailScope]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !thumbnailScope) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      setViewportMetrics({
        clientHeight: viewport.clientHeight,
        scrollTop: viewport.scrollTop,
      });
      thumbnailScope.updateWindow(viewport.scrollTop, viewport.clientHeight);
    });

    resizeObserver.observe(viewport);

    return () => resizeObserver.disconnect();
  }, [thumbnailScope]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !thumbnailScope) {
      return;
    }

    thumbnailScope.updateWindow(viewport.scrollTop, viewport.clientHeight);
  }, [thumbnailLayout, thumbnailScope, windowState]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !thumbnailScope || !hasWindowState) {
      return;
    }

    return thumbnailScope.onScrollTo(({ top, behavior }) => {
      viewport.scrollTo({ top, behavior });
    });
  }, [hasWindowState, thumbnailScope]);

  return (
    <PDFViewerScrollArea
      className="h-full w-full"
      viewportClassName="group/pdf-thumbnail-sidebar px-4 focus-visible:ring-0 focus-visible:ring-offset-0"
      viewportProps={{
        "aria-activedescendant": activeDescendantId,
        "aria-label": "PDF pages",
        "aria-multiselectable": true,
        onKeyDown,
        onMouseDown: (event) => {
          event.currentTarget.focus({ preventScroll: true });
        },
        role: "listbox",
        style: {
          paddingBottom: paddingY,
          paddingTop: paddingY,
        },
        tabIndex: 0,
      }}
      viewportRef={viewportRef}
    >
      <div
        className="relative"
        style={{ height: effectiveWindowState?.totalHeight ?? 0 }}
      >
        {effectiveWindowState?.items.map((meta) => children(meta))}
      </div>
    </PDFViewerScrollArea>
  );
}

function PDFViewerScrollAreaViewport({
  children,
  className,
  documentId,
  viewportProps,
}: {
  children: React.ReactNode;
  className?: string;
  documentId: string;
  viewportProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const viewportRef = useViewportRef(documentId);
  const { provides: viewport } = useViewportCapability();
  const isGated = useIsViewportGated(documentId);
  const viewportGap = viewport?.getViewportGap() ?? 0;

  return (
    <ViewportElementContext.Provider value={viewportRef}>
      <PDFViewerScrollArea
        className={className}
        scrollbarAlwaysVisible
        scrollbarGutter
        viewportClassName="relative select-none selection:bg-transparent selection:text-inherit"
        viewportProps={{
          ...viewportProps,
          style: {
            ...viewportProps?.style,
            padding: viewportGap,
          },
        }}
        viewportRef={viewportRef}
      >
        {isGated ? null : children}
      </PDFViewerScrollArea>
    </ViewportElementContext.Provider>
  );
}

// Captures the scrollable viewport element so the imperative handle can expose
// It.
function PDFViewerViewportBridge({
  viewportElementRef,
}: {
  viewportElementRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const elementRef = useViewportElement();

  React.useEffect(() => {
    viewportElementRef.current = elementRef?.current ?? null;
  });

  return null;
}

function PDFViewerTextSelectionLayer({
  documentId,
  pageIndex,
  scale,
}: {
  documentId: string;
  pageIndex: number;
  scale: number;
}) {
  const { plugin: selectionPlugin } = useSelectionPlugin();
  const [rects, setRects] = React.useState<Rect[]>([]);

  React.useEffect(() => {
    if (!selectionPlugin) {
      return;
    }

    return selectionPlugin.registerSelectionOnPage({
      documentId,
      pageIndex,
      onRectsChange: ({ rects: nextRects }) => {
        setRects(nextRects);
      },
    });
  }, [documentId, pageIndex, selectionPlugin]);

  if (rects.length === 0) {
    return null;
  }

  return (
    <>
      {rects.map((rect, index) => (
        <div
          key={`${index}-${rect.origin.x}-${rect.origin.y}`}
          className="pointer-events-none absolute"
          style={{
            background: TEXT_SELECTION_BACKGROUND,
            height: rect.size.height * scale,
            left: rect.origin.x * scale,
            top: rect.origin.y * scale,
            width: rect.size.width * scale,
          }}
        />
      ))}
    </>
  );
}

function PDFViewerSelectionReleaseGuard({
  documentId,
}: {
  documentId: string;
}) {
  const { plugin: selectionPlugin } = useSelectionPlugin();
  const { provides: selection } = useSelectionCapability();
  const lastSelectionModeIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!selection) {
      return;
    }

    return selection.forDocument(documentId).onBeginSelection(({ modeId }) => {
      lastSelectionModeIdRef.current = modeId;
    });
  }, [documentId, selection]);

  React.useEffect(() => {
    if (!selection) {
      return;
    }

    let cleanupFrame = 0;
    const finalizeIfStillSelecting = () => {
      window.cancelAnimationFrame(cleanupFrame);
      cleanupFrame = window.requestAnimationFrame(() => {
        const selectionState = selection.getState(documentId);

        if (!selectionState.selecting) {
          return;
        }

        if (selectionState.selection && selectionPlugin) {
          const pluginWithEndSelection = selectionPlugin as unknown as {
            endSelection?: (documentId: string, modeId: string) => void;
          };

          pluginWithEndSelection.endSelection?.(
            documentId,
            lastSelectionModeIdRef.current ?? "pointerMode"
          );
          return;
        }

        if (!selectionState.selection) {
          selection.clear(documentId);
        }
      });
    };

    window.addEventListener("pointerup", finalizeIfStillSelecting);
    window.addEventListener("pointercancel", finalizeIfStillSelecting);
    window.addEventListener("blur", finalizeIfStillSelecting);

    return () => {
      window.cancelAnimationFrame(cleanupFrame);
      window.removeEventListener("pointerup", finalizeIfStillSelecting);
      window.removeEventListener("pointercancel", finalizeIfStillSelecting);
      window.removeEventListener("blur", finalizeIfStillSelecting);
    };
  }, [documentId, selection, selectionPlugin]);

  return null;
}

function isEditableCopyTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest("input, textarea, [contenteditable='true']"));
}

function PDFViewerSelectionCopyShortcut({
  documentId,
}: {
  documentId: string;
}) {
  const { provides: selection } = useSelectionCapability();

  React.useEffect(() => {
    if (!selection) {
      return;
    }

    const copySelectedPdfText = (event: Event) => {
      if (isEditableCopyTarget(event.target)) {
        return;
      }
      if (!selection.getState(documentId).selection) {
        return;
      }

      event.preventDefault();
      selection.copyToClipboard(documentId);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "c") {
        return;
      }
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }

      copySelectedPdfText(event);
    };

    document.addEventListener("copy", copySelectedPdfText);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("copy", copySelectedPdfText);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [documentId, selection]);

  return null;
}

function isQuarterTurn(rotation: Rotation) {
  return rotation % 2 === 1;
}

function getRotatedDimensions({
  height,
  rotation,
  width,
}: {
  height: number;
  rotation: Rotation;
  width: number;
}) {
  return isQuarterTurn(rotation)
    ? { height: width, width: height }
    : { height, width };
}

function getRotatedPageDimensions(page: PageLayout, rotation: Rotation) {
  return getRotatedDimensions({
    height: page.height,
    rotation,
    width: page.width,
  });
}

function applyPageRotationDeltasToScrollerLayout({
  basePageRotations,
  layout,
  pageRotationDeltas,
}: {
  basePageRotations: Rotation[];
  layout: ScrollerLayout;
  pageRotationDeltas: PageRotationDeltas;
}): ScrollerLayout {
  if (pageRotationDeltas.size === 0) {
    return layout;
  }

  let maxHeight = 0;
  let maxWidth = 0;
  let offset = 0;
  const { pageGap } = layout;
  let startSpacingAdjustment = 0;
  const items: VirtualItem[] = layout.items.map((item, itemIndex) => {
    let itemHeight = 0;
    let itemWidth = 0;
    let pageOffset = 0;
    const pageLayouts = item.pageLayouts.map((page) => {
      const basePageRotation =
        basePageRotations[page.pageIndex] ?? normalizeRotation(0);
      const pageRotation = normalizeRotation(
        basePageRotation + (pageRotationDeltas.get(page.pageIndex) ?? 0)
      );
      const rotatedSize = getRotatedPageDimensions(page, pageRotation);
      const oldScrollAxisSize =
        layout.strategy === ScrollStrategy.Horizontal
          ? page.rotatedWidth
          : page.rotatedHeight;
      const newScrollAxisSize =
        layout.strategy === ScrollStrategy.Horizontal
          ? rotatedSize.width
          : rotatedSize.height;

      if (
        layout.startSpacing === 0 &&
        itemIndex === 0 &&
        pageOffset === 0 &&
        newScrollAxisSize < oldScrollAxisSize
      ) {
        startSpacingAdjustment = Math.max(
          startSpacingAdjustment,
          (oldScrollAxisSize - newScrollAxisSize) / 2
        );
      }

      const nextPageLayout = {
        ...page,
        rotatedHeight: rotatedSize.height,
        rotatedWidth: rotatedSize.width,
        x: layout.strategy === ScrollStrategy.Horizontal ? 0 : pageOffset,
        y: layout.strategy === ScrollStrategy.Horizontal ? pageOffset : 0,
      };

      pageOffset +=
        (layout.strategy === ScrollStrategy.Horizontal
          ? rotatedSize.height
          : rotatedSize.width) + pageGap;
      itemWidth =
        layout.strategy === ScrollStrategy.Horizontal
          ? Math.max(itemWidth, rotatedSize.width)
          : itemWidth + rotatedSize.width;
      itemHeight =
        layout.strategy === ScrollStrategy.Horizontal
          ? itemHeight + rotatedSize.height
          : Math.max(itemHeight, rotatedSize.height);

      return nextPageLayout;
    });

    if (pageLayouts.length > 1) {
      if (layout.strategy === ScrollStrategy.Horizontal) {
        itemHeight -= pageGap;
      } else {
        itemWidth -= pageGap;
      }
    }

    const nextItem = {
      ...item,
      height: itemHeight,
      offset,
      pageLayouts,
      width: itemWidth,
      x: layout.strategy === ScrollStrategy.Horizontal ? offset : item.x,
      y: layout.strategy === ScrollStrategy.Horizontal ? item.y : offset,
    };

    if (layout.strategy === ScrollStrategy.Horizontal) {
      offset += itemWidth + pageGap;
      maxHeight = Math.max(maxHeight, itemHeight);
    } else {
      offset += itemHeight + pageGap;
      maxWidth = Math.max(maxWidth, itemWidth);
    }

    return nextItem;
  });

  if (items.length > 0) {
    offset -= pageGap;
  }

  return {
    ...layout,
    endSpacing: layout.endSpacing,
    items,
    startSpacing: layout.startSpacing + startSpacingAdjustment,
    totalHeight:
      layout.strategy === ScrollStrategy.Horizontal
        ? maxHeight
        : layout.startSpacing +
          startSpacingAdjustment +
          offset +
          layout.endSpacing,
    totalWidth:
      layout.strategy === ScrollStrategy.Horizontal
        ? layout.startSpacing +
          startSpacingAdjustment +
          offset +
          layout.endSpacing
        : maxWidth,
  };
}

function PDFViewerScroller({
  documentId,
  pageRotationDeltas,
  basePageRotations,
  presentationRef,
  renderPage,
  onLayoutReady,
}: {
  documentId: string;
  pageRotationDeltas: PageRotationDeltas;
  basePageRotations: Rotation[];
  presentationRef: React.RefObject<HTMLDivElement | null>;
  renderPage: (props: PageLayout) => React.ReactNode;
  onLayoutReady?: (ready: boolean) => void;
}) {
  const { plugin: scrollPlugin } = useScrollPlugin();
  const [layoutData, setLayoutData] = React.useState<{
    docId: string | null;
    layout: ScrollerLayout | null;
  }>({ docId: null, layout: null });

  React.useEffect(() => {
    if (!scrollPlugin || !documentId) {
      return;
    }
    let frame = 0;

    const setCurrentLayout = () => {
      try {
        const layout = scrollPlugin.getScrollerLayout(documentId);
        setLayoutData({
          docId: documentId,
          layout,
        });
        if (
          isPdfViewerPageLayoutReady(documentId, { docId: documentId, layout })
        ) {
          onLayoutReady?.(true);
          return;
        }
      } catch {
        setLayoutData({ docId: documentId, layout: null });
      }
      frame = window.requestAnimationFrame(setCurrentLayout);
    };
    const unsubscribe = scrollPlugin.onScrollerData(documentId, (layout) => {
      setLayoutData({ docId: documentId, layout });
      if (
        isPdfViewerPageLayoutReady(documentId, { docId: documentId, layout })
      ) {
        onLayoutReady?.(true);
      }
    });

    frame = window.requestAnimationFrame(setCurrentLayout);

    return () => {
      window.cancelAnimationFrame(frame);
      unsubscribe();
      setLayoutData({ docId: null, layout: null });
      onLayoutReady?.(false);
      scrollPlugin.clearLayoutReady(documentId);
    };
  }, [documentId, onLayoutReady, scrollPlugin]);

  const scrollerLayout = React.useMemo(() => {
    if (layoutData.docId !== documentId || !layoutData.layout) {
      return null;
    }

    return applyPageRotationDeltasToScrollerLayout({
      basePageRotations,
      layout: layoutData.layout,
      pageRotationDeltas,
    });
  }, [basePageRotations, documentId, layoutData, pageRotationDeltas]);

  React.useLayoutEffect(() => {
    if (!scrollPlugin || !documentId || !scrollerLayout) {
      return;
    }
    scrollPlugin.setLayoutReady(documentId);
  }, [documentId, scrollPlugin, scrollerLayout]);

  if (!scrollerLayout) {
    return null;
  }

  return (
    <div
      ref={presentationRef}
      data-slot="pdf-viewer-resize-presentation"
      style={{
        width: `${scrollerLayout.totalWidth}px`,
        height: `${scrollerLayout.totalHeight}px`,
        position: "relative",
        boxSizing: "border-box",
        margin: "0 auto",
        ...(scrollerLayout.strategy === ScrollStrategy.Horizontal && {
          display: "flex",
          flexDirection: "row",
        }),
      }}
    >
      <div
        style={
          scrollerLayout.strategy === ScrollStrategy.Horizontal
            ? {
                width: scrollerLayout.startSpacing,
                height: "100%",
                flexShrink: 0,
              }
            : {
                height: scrollerLayout.startSpacing,
                width: "100%",
              }
        }
      />
      <div
        style={{
          gap: scrollerLayout.pageGap,
          display: "flex",
          alignItems: "center",
          position: "relative",
          boxSizing: "border-box",
          ...(scrollerLayout.strategy === ScrollStrategy.Horizontal
            ? {
                flexDirection: "row",
                minHeight: "100%",
              }
            : {
                flexDirection: "column",
                minWidth: "fit-content",
              }),
        }}
      >
        {scrollerLayout.items.map((item) => (
          <div
            key={item.pageNumbers[0]}
            style={{
              display: "flex",
              justifyContent: "center",
              gap: scrollerLayout.pageGap,
            }}
          >
            {item.pageLayouts.map((layout) => (
              <div
                key={layout.pageNumber}
                style={{
                  width: `${layout.rotatedWidth}px`,
                  height: `${layout.rotatedHeight}px`,
                  position: "relative",
                  zIndex: layout.elevated ? 1 : undefined,
                }}
              >
                {renderPage(layout)}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div
        style={
          scrollerLayout.strategy === ScrollStrategy.Horizontal
            ? {
                width: scrollerLayout.endSpacing,
                height: "100%",
                flexShrink: 0,
              }
            : {
                height: scrollerLayout.endSpacing,
                width: "100%",
              }
        }
      />
    </div>
  );
}

export function pdfGeometryToTextBlocks(
  geometry: PdfPageGeometry,
  pageWidth: number,
  pageHeight: number
): PDFViewerTextBlock[] {
  if (pageWidth <= 0 || pageHeight <= 0) {
    return [];
  }

  return geometry.runs.flatMap((run) => {
    // A PDF text object may span multiple lines. Keep every row available
    // for field alignment instead of only its overall top/center/bottom.
    const lines: (typeof run.rect)[] = [];
    const glyphs = run.glyphs
      .filter(
        (glyph) => !(glyph.flags & 2) && glyph.width > 0 && glyph.height > 0
      )
      .sort((left, right) => left.y - right.y || left.x - right.x);
    for (const glyph of glyphs) {
      const line = lines.at(-1);
      const overlap = line
        ? Math.min(line.y + line.height, glyph.y + glyph.height) -
          Math.max(line.y, glyph.y)
        : 0;
      if (line && overlap >= Math.min(line.height, glyph.height) / 2) {
        const right = Math.max(line.x + line.width, glyph.x + glyph.width);
        const bottom = Math.max(line.y + line.height, glyph.y + glyph.height);
        line.x = Math.min(line.x, glyph.x);
        line.y = Math.min(line.y, glyph.y);
        line.width = right - line.x;
        line.height = bottom - line.y;
      } else {
        lines.push({
          x: glyph.x,
          y: glyph.y,
          width: glyph.width,
          height: glyph.height,
        });
      }
    }
    return lines.map(({ height, width, x, y }) => ({
      height: height / pageHeight,
      width: width / pageWidth,
      x: x / pageWidth,
      y: y / pageHeight,
    }));
  });
}

function PDFViewerTextGeometryReporter({
  documentId,
  onTextBlocks,
  pageIndex,
  pageHeight,
  pageWidth,
}: {
  documentId: string;
  onTextBlocks: (pageIndex: number, blocks: PDFViewerTextBlock[]) => void;
  pageIndex: number;
  pageHeight: number;
  pageWidth: number;
}) {
  const { provides: selection } = useSelectionCapability();

  React.useEffect(() => {
    let frame = 0;
    let active = true;
    const poll = () => {
      if (!active || !selection) {
        return;
      }
      const geometry = selection.getState(documentId).geometry[pageIndex];
      if (geometry) {
        onTextBlocks(
          pageIndex,
          pdfGeometryToTextBlocks(geometry, pageWidth, pageHeight)
        );
        return;
      }
      frame = window.requestAnimationFrame(poll);
    };
    poll();
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
    };
  }, [documentId, onTextBlocks, pageHeight, pageIndex, pageWidth, selection]);

  return null;
}

export function isPdfViewerPageLayoutReady(
  documentId: string,
  layoutData: {
    docId: string | null;
    layout: { items: { pageLayouts: unknown[] }[] } | null;
  }
) {
  return (
    layoutData.docId === documentId &&
    Boolean(
      layoutData.layout?.items.some((item) => item.pageLayouts.length > 0)
    )
  );
}

export function shouldApplyPdfViewerZoomPreference(
  previous: {
    autoFitWidth: boolean;
    defaultZoom: number;
    documentId: string;
  } | null,
  next: {
    autoFitWidth: boolean;
    defaultZoom: number;
    documentId: string;
  }
) {
  return (
    !previous ||
    previous.documentId !== next.documentId ||
    previous.autoFitWidth !== next.autoFitWidth ||
    previous.defaultZoom !== next.defaultZoom
  );
}

export function shouldStartPdfViewerPan(input: {
  button: number;
  interactionMode: "select" | "pan";
  targetTagName: string;
}) {
  return (
    input.interactionMode === "pan" &&
    input.button === 0 &&
    !["BUTTON", "INPUT", "TEXTAREA"].includes(input.targetTagName)
  );
}

type PDFViewerInnerProps = {
  autoFitWidth: boolean;
  engine: PdfEngine;
  viewerRef: React.ForwardedRef<PDFViewerHandle>;
  pdfFile: string;
  documentId: string;
  document: PdfDocumentObject | null;
  defaultZoom: number;
  interactionMode?: "select" | "pan";
  textSelectionEnabled: boolean;
  className?: string;
  fileName?: string;
  showDownload: boolean;
  showPrint: boolean;
  showToolbar: boolean;
  showRotateControls: boolean;
  showUpload: boolean;
  toolbarActions?: React.ReactNode;
  pageClassName?: (pageNumber: number) => string | undefined;
  renderPageOverlay?: (props: PDFViewerPageOverlayProps) => React.ReactNode;
  onActivePageChange?: (pageNumber: number) => void;
  onPdfUpload?: (file: File) => void;
  onPagePointerDown?: PDFViewerProps["onPagePointerDown"];
  onPagePointerMove?: PDFViewerProps["onPagePointerMove"];
  onPagePointerUp?: PDFViewerProps["onPagePointerUp"];
  onPagePointerCancel?: PDFViewerProps["onPagePointerCancel"];
  onUploadFile: (file: File) => void;
};

export function usePdfViewerInitialZoom({
  autoFitWidth,
  defaultZoom,
  documentId,
  loaded,
}: {
  autoFitWidth: boolean;
  defaultZoom: number;
  documentId: string;
  loaded: boolean;
}) {
  const { provides: zoom } = useZoom(documentId);
  const { provides: viewport } = useViewportCapability();
  // The zoom plugin only releases its viewport gate for mode-based zoom
  // Levels (automatic/fit); with a numeric default the gate would never
  // Lift, so apply the initial zoom explicitly once the document loads.
  const appliedZoomPreferenceRef = React.useRef<{
    autoFitWidth: boolean;
    defaultZoom: number;
    documentId: string;
  } | null>(null);
  React.useEffect(() => {
    if (!loaded || !zoom || !viewport) {
      return;
    }
    const nextZoomPreference = { autoFitWidth, defaultZoom, documentId };

    const applyInitialZoom = () => {
      if (
        !shouldApplyPdfViewerZoomPreference(
          appliedZoomPreferenceRef.current,
          nextZoomPreference
        )
      ) {
        return;
      }

      const metrics = viewport.forDocument(documentId).getMetrics();
      // ResizeObserver reports these after mount; an earlier request is ignored.
      if (metrics.clientWidth <= 0 || metrics.clientHeight <= 0) {
        return;
      }
      const fitWidthCenter =
        autoFitWidth && metrics?.clientWidth
          ? { vx: metrics.clientWidth / 2, vy: 0 }
          : undefined;

      zoom.requestZoom(
        autoFitWidth ? ZoomMode.FitWidth : defaultZoom,
        fitWidthCenter
      );
      appliedZoomPreferenceRef.current = nextZoomPreference;
    };
    const unsubscribe = viewport.onViewportResize((event) => {
      if (event.documentId === documentId) {
        applyInitialZoom();
      }
    });
    applyInitialZoom();
    return unsubscribe;
  }, [autoFitWidth, defaultZoom, documentId, loaded, viewport, zoom]);
}

function PDFViewerInner({
  autoFitWidth,
  engine,
  viewerRef,
  pdfFile,
  documentId,
  document: pdfDocument,
  defaultZoom,
  interactionMode = "select",
  textSelectionEnabled,
  className,
  fileName,
  showDownload,
  showPrint,
  showToolbar,
  showRotateControls,
  showUpload,
  toolbarActions,
  pageClassName,
  renderPageOverlay,
  onActivePageChange,
  onPdfUpload,
  onPagePointerDown,
  onPagePointerMove,
  onPagePointerUp,
  onPagePointerCancel,
  onUploadFile,
}: PDFViewerInnerProps) {
  const { registry } = useRegistry();
  const { state: scrollState, provides: scroll } = useScroll(documentId);
  const { state: zoomState, provides: zoom } = useZoom(documentId);
  const { state: annotationState, provides: annotationApi } =
    useAnnotation(documentId);
  const { provides: thumbnails } = useThumbnailCapability();
  const { plugin: thumbnailPlugin } = useThumbnailPlugin();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [annotationPanelOpen, setAnnotationPanelOpen] = React.useState(false);
  const [isPreparingDownload, setIsPreparingDownload] = React.useState(false);
  const [isPreparingPrint, setIsPreparingPrint] = React.useState(false);
  const [pageLayoutReady, setPageLayoutReady] = React.useState(false);
  const [pageTextBlocks, setPageTextBlocks] = React.useState<
    Map<number, PDFViewerTextBlock[]>
  >(() => new Map());
  const [pageRotationDeltas, setPageRotationDeltas] =
    React.useState<PageRotationDeltas>(() => new Map());
  const [selectedPageIndexes, setSelectedPageIndexes] = React.useState<
    Set<number>
  >(() => new Set());
  const basePageRotations = React.useMemo(
    () =>
      pdfDocument?.pages.map((page) => normalizeRotation(page.rotation)) ?? [],
    [pdfDocument]
  );
  const [viewerShellRef, viewerShellWidth] = useElementWidth<HTMLDivElement>();
  const sidebarInline = useInlineThumbnailSidebar(viewerShellWidth);
  const viewerRootRef = React.useRef<HTMLDivElement | null>(null);
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null);
  const viewportPanRef = React.useRef<{
    pointerId: number;
    viewport: HTMLDivElement;
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);
  const resizePresentationRef = React.useRef<HTMLDivElement | null>(null);
  const pageRotationDeltasRef = React.useRef(pageRotationDeltas);
  const selectedPageIndexesRef = React.useRef(selectedPageIndexes);
  const selectionAnchorPageIndexRef = React.useRef<number | null>(null);
  const suppressActivePageSelectionSyncRef = React.useRef<number | null>(null);
  const initializedSelectionDocumentRef = React.useRef<string | null>(null);
  const activePage = scrollState.currentPage;
  const numPages = pdfDocument?.pageCount ?? 0;
  const isLoading = !pdfDocument;
  const controlsDisabled = !numPages;
  const downloadDisabled = controlsDisabled || isPreparingDownload;
  const thumbnailSidebarVisible = sidebarOpen && !isLoading;
  const [retainClosingThumbnails, setRetainClosingThumbnails] = React.useState(false);
  React.useEffect(() => {
    if (thumbnailSidebarVisible) {
      setRetainClosingThumbnails(true);
      return;
    }
    // Keep the pages visible for the sidebar's 200ms exit transition.
    const timeout = window.setTimeout(() => setRetainClosingThumbnails(false), 200);
    return () => window.clearTimeout(timeout);
  }, [thumbnailSidebarVisible]);
  const { currentZoomLevel, zoomLevel } = zoomState;
  const alignedThumbnailSidebarDocumentRef = React.useRef<string | null>(null);
  const { dictionary } = useI18n();
  const pdfViewerCopy = dictionary.pdfViewer;
  const annotations = React.useMemo(
    () =>
      Object.values(annotationState.byUid)
        .filter(
          (annotation) =>
            annotation.commitState !== "deleted" &&
            isVisiblePDFAnnotation(annotation.object) &&
            Boolean(
              annotation.object.contents?.trim() ||
              annotation.object.subject?.trim() ||
              annotation.object.author?.trim()
            )
        )
        .sort(
          (left, right) =>
            left.object.pageIndex - right.object.pageIndex ||
            left.object.rect.origin.y - right.object.rect.origin.y
        ),
    [annotationState.byUid]
  );

  React.useEffect(() => {
    if (!annotationApi) {
      return;
    }

    Object.values(annotationState.byUid).forEach(({ object: annotation }) => {
      const flags = annotation.flags ?? [];
      if (
        flags.includes("readOnly") ||
        (flags.includes("locked") && flags.includes("lockedContents"))
      ) {
        return;
      }

      annotationApi.syncAnnotationObject(annotation.id, {
        flags: [
          ...new Set([...flags, "locked", "lockedContents"]),
        ] as typeof flags,
      });
    });
  }, [annotationApi, annotationState.byUid]);

  React.useEffect(() => {
    setAnnotationPanelOpen(false);
  }, [documentId]);

  React.useEffect(() => {
    if (annotations.length === 0) {
      setAnnotationPanelOpen(false);
    }
  }, [annotations.length]);

  React.useEffect(() => {
    pageRotationDeltasRef.current = pageRotationDeltas;
  }, [pageRotationDeltas]);

  React.useEffect(() => {
    selectedPageIndexesRef.current = selectedPageIndexes;
  }, [selectedPageIndexes]);

  React.useEffect(() => {
    if (activePage > 0) {
      onActivePageChange?.(activePage);
    }
  }, [activePage, onActivePageChange]);

  React.useEffect(() => {
    if (activePage < 1 || numPages < 1) {
      return;
    }

    const activePageIndex = activePage - 1;
    const suppressedPageIndex = suppressActivePageSelectionSyncRef.current;

    suppressActivePageSelectionSyncRef.current = null;

    if (suppressedPageIndex === activePageIndex) {
      return;
    }

    const nextSelection = new Set([activePageIndex]);

    selectionAnchorPageIndexRef.current = activePageIndex;
    selectedPageIndexesRef.current = nextSelection;
    setSelectedPageIndexes((previousSelection) =>
      arePageIndexSetsEqual(previousSelection, nextSelection)
        ? previousSelection
        : nextSelection
    );
  }, [activePage, numPages]);

  React.useEffect(() => {
    if (
      numPages < 1 ||
      initializedSelectionDocumentRef.current === documentId
    ) {
      return;
    }

    const initialPageIndex = Math.max(0, (activePage > 0 ? activePage : 1) - 1);
    const initialSelection = new Set([initialPageIndex]);

    initializedSelectionDocumentRef.current = documentId;
    selectionAnchorPageIndexRef.current = initialPageIndex;
    selectedPageIndexesRef.current = initialSelection;
    setSelectedPageIndexes(initialSelection);
  }, [activePage, documentId, numPages]);

  React.useEffect(() => {
    if (!thumbnailSidebarVisible) {
      alignedThumbnailSidebarDocumentRef.current = null;
      return;
    }

    if (
      activePage < 1 ||
      !thumbnails ||
      alignedThumbnailSidebarDocumentRef.current === documentId
    ) {
      return;
    }

    alignedThumbnailSidebarDocumentRef.current = documentId;
    const frame = window.requestAnimationFrame(() => {
      thumbnails.forDocument(documentId).scrollToThumb(activePage - 1);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activePage, documentId, thumbnailSidebarVisible, thumbnails]);

  usePdfViewerInitialZoom({
    autoFitWidth,
    defaultZoom,
    documentId,
    loaded: Boolean(pdfDocument),
  });

  const scrollToPage = React.useCallback(
    (pageNumber: number, options?: ScrollIntoViewOptions) => {
      scroll?.scrollToPage({
        pageNumber,
        behavior: options?.behavior === "smooth" ? "smooth" : "auto",
      });
    },
    [scroll]
  );
  const selectThumbnailPage = React.useCallback(
    (pageNumber: number, mode: ThumbnailSelectionMode) => {
      const pageIndex = pageNumber - 1;

      if (pageIndex < 0 || pageIndex >= numPages) {
        return;
      }

      suppressActivePageSelectionSyncRef.current = pageIndex;

      setSelectedPageIndexes((previousSelection) => {
        let nextSelection: Set<number>;

        if (mode === "range") {
          const anchorPageIndex =
            selectionAnchorPageIndexRef.current ??
            (activePage > 0 ? activePage - 1 : pageIndex);

          nextSelection = getPageIndexRange(anchorPageIndex, pageIndex);
        } else if (mode === "toggle") {
          nextSelection = new Set(previousSelection);

          if (nextSelection.has(pageIndex)) {
            nextSelection.delete(pageIndex);
          } else {
            nextSelection.add(pageIndex);
          }

          selectionAnchorPageIndexRef.current = pageIndex;
        } else {
          nextSelection = new Set([pageIndex]);
          selectionAnchorPageIndexRef.current = pageIndex;
        }

        selectedPageIndexesRef.current = nextSelection;
        return nextSelection;
      });

      scrollToPage(pageNumber);
    },
    [activePage, numPages, scrollToPage]
  );

  React.useImperativeHandle(
    viewerRef,
    () => ({
      scrollToPage,
      scrollToPageArea: (pageNumber, area, options) => {
        const pageSize = pdfDocument?.pages[pageNumber - 1]?.size;

        scroll?.scrollToPage({
          pageNumber,
          ...(pageSize
            ? {
                pageCoordinates: {
                  x: ((area.left ?? 0) / 100) * pageSize.width,
                  y: (area.top / 100) * pageSize.height,
                },
                alignY: 25,
              }
            : {}),
          behavior: options?.behavior === "smooth" ? "smooth" : "auto",
        });
      },
      getViewportElement: () => viewportElementRef.current,
    }),
    [pdfDocument, scroll, scrollToPage]
  );

  const handleDownload = React.useCallback(async () => {
    if (!pdfFile || isPreparingDownload) {
      return;
    }

    setIsPreparingDownload(true);

    try {
      await downloadPdfWithPageRotations({
        fileName: getPdfDownloadFileName(fileName, pdfFile),
        pageRotationDeltas,
        src: pdfFile,
      });
    } catch (error) {
      showErrorToast(error, "Could not download the PDF");
      console.error(error);
    } finally {
      setIsPreparingDownload(false);
    }
  }, [fileName, isPreparingDownload, pageRotationDeltas, pdfFile]);
  const handlePrint = React.useCallback(() => {
    if (!pdfDocument || isPreparingPrint) {
      return;
    }

    setIsPreparingPrint(true);
    engine.preparePrintDocument(pdfDocument, { includeAnnotations: true }).wait(
      (bytes) => {
        try {
          printPdfBlob(new Blob([bytes], { type: "application/pdf" }));
        } catch (error) {
          showErrorToast(error, "Could not print the PDF");
          console.error(error);
        } finally {
          setIsPreparingPrint(false);
        }
      },
      (error) => {
        const message =
          typeof error === "object" && error && "reason" in error
            ? String(
                (error as { reason?: { message?: string } }).reason?.message ??
                  "Could not print the PDF"
              )
            : "Could not print the PDF";
        showErrorToast(new Error(message), "Could not print the PDF");
        setIsPreparingPrint(false);
      }
    );
  }, [engine, isPreparingPrint, pdfDocument]);
  const requestZoom = React.useCallback(
    (level: ZoomLevel) => {
      zoom?.requestZoom(level);
    },
    [zoom]
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { target } = event;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "p") {
        event.preventDefault();
        handlePrint();
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (controlsDisabled) {
        return;
      }

      if (event.key === "PageUp" || event.key === "ArrowUp") {
        event.preventDefault();
        if (activePage > 1) {
          scrollToPage(activePage - 1);
        }
        return;
      }

      if (event.key === "PageDown" || event.key === "ArrowDown") {
        event.preventDefault();
        if (activePage < numPages) {
          scrollToPage(activePage + 1);
        }
        return;
      }

      if (event.key === "+" || (event.key === "=" && event.shiftKey)) {
        event.preventDefault();
        const nextZoom = ZOOM_OPTIONS.find(
          (option) => option > currentZoomLevel
        );
        requestZoom(nextZoom ?? ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1]);
        return;
      }

      if (event.key === "-") {
        event.preventDefault();
        const nextZoom = [...ZOOM_OPTIONS]
          .toReversed()
          .find((option) => option < currentZoomLevel);
        requestZoom(nextZoom ?? ZOOM_OPTIONS[0]);
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        requestZoom(ZoomMode.FitWidth);
        return;
      }

      if (event.key === "1") {
        event.preventDefault();
        requestZoom(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activePage,
    controlsDisabled,
    currentZoomLevel,
    handlePrint,
    numPages,
    requestZoom,
    scrollToPage,
  ]);

  const rotateSelectedPages = React.useCallback(
    (direction: -1 | 1) => {
      if (!pdfDocument || !registry || activePage < 1) {
        return;
      }

      const documentState = registry.getStore().getState().core.documents[
        documentId
      ];
      const currentDocument = documentState?.document ?? pdfDocument;
      const selectedTargetPageIndexes = [
        ...selectedPageIndexesRef.current,
      ].filter((pageIndex) => currentDocument.pages[pageIndex]);
      const fallbackPageIndex = activePage - 1;
      const targetPageIndexes = (
        selectedTargetPageIndexes.length > 0
          ? selectedTargetPageIndexes
          : [fallbackPageIndex]
      )
        .filter((pageIndex) => currentDocument.pages[pageIndex])
        .sort((a, b) => a - b);

      if (targetPageIndexes.length === 0) {
        return;
      }

      const previousDeltas = pageRotationDeltasRef.current;
      const nextDeltas = new Map(previousDeltas);
      const referencePageIndex =
        activePage > 0 && currentDocument.pages[activePage - 1]
          ? activePage - 1
          : targetPageIndexes[0];
      let scrollDelta = 0;

      for (const pageIndex of targetPageIndexes) {
        const currentPage = currentDocument.pages[pageIndex];
        if (!currentPage) {
          continue;
        }

        const previousDelta = previousDeltas.get(pageIndex) ?? 0;
        const nextDelta = normalizeRotation(previousDelta + direction);
        const basePageRotation =
          basePageRotations[pageIndex] ??
          normalizeRotation(currentPage.rotation);
        const previousPageRotation = normalizeRotation(
          basePageRotation + previousDelta
        );
        const nextPageRotation = normalizeRotation(
          basePageRotation + nextDelta
        );
        const previousRotatedSize = getRotatedDimensions({
          height: currentPage.size.height * currentZoomLevel,
          rotation: previousPageRotation,
          width: currentPage.size.width * currentZoomLevel,
        });
        const nextRotatedSize = getRotatedDimensions({
          height: currentPage.size.height * currentZoomLevel,
          rotation: nextPageRotation,
          width: currentPage.size.width * currentZoomLevel,
        });
        const heightDelta = nextRotatedSize.height - previousRotatedSize.height;

        if (pageIndex < referencePageIndex) {
          scrollDelta += heightDelta;
        } else if (pageIndex === referencePageIndex) {
          scrollDelta += heightDelta / 2;
        }

        if (nextDelta) {
          nextDeltas.set(pageIndex, nextDelta);
        } else {
          nextDeltas.delete(pageIndex);
        }
      }

      const store = registry.getStore();
      const currentViewport = viewportElementRef.current;

      pageRotationDeltasRef.current = nextDeltas;
      flushSync(() => {
        setPageRotationDeltas(nextDeltas);
        store.dispatchToCore(refreshPages(documentId, targetPageIndexes));
      });

      if (currentViewport && scrollDelta !== 0) {
        currentViewport.scrollTop += scrollDelta;
      }
      (
        thumbnailPlugin as {
          calculateWindowState?: (documentId: string) => void;
        } | null
      )?.calculateWindowState?.(documentId);
    },
    [
      activePage,
      basePageRotations,
      currentZoomLevel,
      documentId,
      pdfDocument,
      registry,
      thumbnailPlugin,
    ]
  );
  const handleUpload = React.useCallback(
    (file: File) => {
      onUploadFile(file);
      onPdfUpload?.(file);
    },
    [onPdfUpload, onUploadFile]
  );

  const handlePageLayoutReady = React.useCallback((ready: boolean) => {
    setPageLayoutReady(ready);
  }, []);

  const handlePageTextBlocks = React.useCallback(
    (pageIndex: number, blocks: PDFViewerTextBlock[]) => {
      setPageTextBlocks(
        (current) => new Map([...current, [pageIndex, blocks]])
      );
    },
    []
  );

  const handleViewportPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (
        !shouldStartPdfViewerPan({
          button: event.button,
          interactionMode,
          targetTagName:
            event.target instanceof Element ? event.target.tagName : "",
        })
      ) {
        return;
      }
      const panViewport = viewportElementRef.current ?? event.currentTarget;
      event.preventDefault();
      event.stopPropagation();
      panViewport.setPointerCapture?.(event.pointerId);
      viewportPanRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startScrollLeft: panViewport.scrollLeft,
        startScrollTop: panViewport.scrollTop,
        viewport: panViewport,
      };
    },
    [interactionMode]
  );
  const handleViewportPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pan = viewportPanRef.current;
      if (!pan || pan.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      pan.viewport.scrollLeft =
        pan.startScrollLeft - (event.clientX - pan.startClientX);
      pan.viewport.scrollTop =
        pan.startScrollTop - (event.clientY - pan.startClientY);
    },
    []
  );
  const handleViewportPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (viewportPanRef.current?.pointerId !== event.pointerId) {
        return;
      }
      const { viewport: panViewport } = viewportPanRef.current;
      viewportPanRef.current = null;
      panViewport.releasePointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    },
    []
  );

  const renderPage = React.useCallback(
    (page: PageLayout) => {
      const { pageNumber } = page;
      const basePageRotation =
        basePageRotations[page.pageIndex] ??
        pdfDocument?.pages[page.pageIndex]?.rotation ??
        normalizeRotation(0);
      const pageRotation = normalizeRotation(
        basePageRotation + (pageRotationDeltas.get(page.pageIndex) ?? 0)
      );

      return (
        <Rotate
          documentId={documentId}
          pageIndex={page.pageIndex}
          rotation={pageRotation}
        >
          <PagePointerProvider
            documentId={documentId}
            pageIndex={page.pageIndex}
            rotation={pageRotation}
            key={`${page.pageIndex}-${pageRotation}`}
            data-pdf-viewer-page={pageNumber}
            className={cn(
              "relative bg-white select-none selection:bg-transparent selection:text-inherit",
              PREVIEW_PAGE_ELEVATION_CLASS_NAME,
              pageClassName?.(pageNumber)
            )}
            style={{ backgroundColor: "transparent" }}
            onPointerDown={(event: React.PointerEvent<HTMLDivElement>) =>
              onPagePointerDown?.(event, pageNumber)
            }
            onPointerMove={(event: React.PointerEvent<HTMLDivElement>) =>
              onPagePointerMove?.(event, pageNumber)
            }
            onPointerUp={(event: React.PointerEvent<HTMLDivElement>) =>
              onPagePointerUp?.(event, pageNumber)
            }
            onPointerCancel={(event: React.PointerEvent<HTMLDivElement>) =>
              onPagePointerCancel?.(event, pageNumber)
            }
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-white"
            />
            <RenderLayer
              documentId={documentId}
              pageIndex={page.pageIndex}
              scale={Math.min(currentZoomLevel, PAGE_BASE_RENDER_MAX_SCALE)}
              dpr={PAGE_BASE_RENDER_DPR}
              className="pointer-events-none absolute inset-0 h-full w-full object-fill opacity-100 blur-[0.35px] transition-none"
            />
            <TilingLayer
              documentId={documentId}
              pageIndex={page.pageIndex}
              key={`tiles-${page.pageIndex}-${pageRotation}`}
              className="pointer-events-none opacity-100 transition-none [&_img]:opacity-100 [&_img]:transition-none"
            />
            <SearchLayer
              documentId={documentId}
              pageIndex={page.pageIndex}
              className="pointer-events-none"
              highlightColor="rgba(253, 224, 71, 0.45)"
              activeHighlightColor="rgba(249, 115, 22, 0.55)"
            />
            {textSelectionEnabled ? (
              <PDFViewerTextSelectionLayer
                documentId={documentId}
                pageIndex={page.pageIndex}
                scale={currentZoomLevel}
              />
            ) : null}
            <PDFViewerTextGeometryReporter
              documentId={documentId}
              onTextBlocks={handlePageTextBlocks}
              pageIndex={page.pageIndex}
              pageHeight={page.height}
              pageWidth={page.width}
            />
            <AnnotationLayer
              documentId={documentId}
              pageIndex={page.pageIndex}
              scale={currentZoomLevel}
              rotation={pageRotation}
              className="absolute inset-0"
              selectionOutline={{
                color: "rgb(37 99 235)",
                offset: 2,
                width: 1,
              }}
              selectionMenu={(props) => (
                <PDFViewerAnnotationMenu {...props} documentId={documentId} />
              )}
            />
            {renderPageOverlay?.({
              pageNumber,
              pageWidth: page.width,
              pageHeight: page.height,
              scale: currentZoomLevel,
              rotation: rotationToDegrees(pageRotation),
              textBlocks: pageTextBlocks.get(page.pageIndex),
            })}
          </PagePointerProvider>
        </Rotate>
      );
    },
    [
      basePageRotations,
      currentZoomLevel,
      onPagePointerCancel,
      onPagePointerDown,
      onPagePointerMove,
      onPagePointerUp,
      pageClassName,
      pageRotationDeltas,
      pageTextBlocks,
      renderPageOverlay,
      documentId,
      pdfDocument,
      handlePageTextBlocks,
      textSelectionEnabled,
    ]
  );

  return (
    <div
      data-slot="pdf-viewer"
      ref={viewerRootRef}
      className={cn(
        "flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden bg-background",
        className
      )}
    >
      {showToolbar ? (
        <PDFViewerToolbar
          copy={pdfViewerCopy}
          activePage={activePage}
          controlsDisabled={controlsDisabled}
          currentZoomLevel={currentZoomLevel}
          zoomLevel={zoomLevel}
          downloadDisabled={downloadDisabled}
          fileName={fileName}
          isPreparingDownload={isPreparingDownload}
          isPreparingPrint={isPreparingPrint}
          numPages={numPages}
          searchControl={
            <PDFViewerSearchControl
              key={documentId}
              documentId={documentId}
              controlsDisabled={controlsDisabled}
            />
          }
          annotationControl={
            annotations.length > 0 ? (
              <ToolbarTooltip label={pdfViewerCopy.annotations}>
                <Button
                  type="button"
                  variant={annotationPanelOpen ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-1.5 px-2"
                  aria-label={pdfViewerCopy.annotations}
                  aria-pressed={annotationPanelOpen}
                  onClick={() => setAnnotationPanelOpen((open) => !open)}
                >
                  <HugeiconsIcon icon={Comment01Icon} className="size-4" />
                  <span className="text-xs tabular-nums">
                    {annotations.length}
                  </span>
                </Button>
              </ToolbarTooltip>
            ) : null
          }
          showDownload={showDownload}
          showPrint={showPrint}
          showRotateControls={showRotateControls}
          showUpload={showUpload}
          sidebarOpen={thumbnailSidebarVisible}
          toolbarActions={toolbarActions}
          onDownload={handleDownload}
          onPrint={handlePrint}
          onPageChange={scrollToPage}
          onRotate={rotateSelectedPages}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          onUploadFile={handleUpload}
          onZoomChange={requestZoom}
        />
      ) : null}
      <div
        ref={viewerShellRef}
        className={cn(
          "relative flex min-h-0 flex-1 overflow-hidden",
          PAGED_DOCUMENT_PREVIEW_CANVAS_CLASS_NAME
        )}
      >
        {isLoading || !pageLayoutReady ? <PDFViewerLoadingSkeleton /> : null}
        <div className="flex h-full max-h-full min-h-0 w-full flex-1 overflow-hidden">
          <DocumentViewerThumbnailSidebar
            closedInlineClassName={THUMBNAIL_SIDEBAR_CLOSED_CLASS}
            inline={sidebarInline}
            open={thumbnailSidebarVisible}
            widthClassName={THUMBNAIL_SIDEBAR_WIDTH_CLASS}
          >
            {!isLoading && (thumbnailSidebarVisible || retainClosingThumbnails) ? (
              <PDFViewerThumbnails
                basePageRotations={basePageRotations}
                documentId={documentId}
                activePage={activePage}
                pageCount={numPages}
                pageRotationDeltas={pageRotationDeltas}
                pdfDocument={pdfDocument}
                selectedPageIndexes={selectedPageIndexes}
                onSelectPage={selectThumbnailPage}
              />
            ) : null}
          </DocumentViewerThumbnailSidebar>
          <PDFViewerScrollAreaViewport
            documentId={documentId}
            className={cn(
              "relative h-full max-h-full min-h-0 min-w-0 flex-1",
              interactionMode === "pan" && "cursor-grab select-none"
            )}
            viewportProps={{
              onPointerCancel: handleViewportPointerUp,
              onPointerDownCapture: handleViewportPointerDown,
              onPointerMove: handleViewportPointerMove,
              onPointerUp: handleViewportPointerUp,
            }}
          >
            <PDFViewerViewportBridge viewportElementRef={viewportElementRef} />
            <PDFViewerResizePresentation
              documentId={documentId}
              maxZoom={ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1]}
              minZoom={ZOOM_OPTIONS[0]}
              presentationRef={resizePresentationRef}
            />
            <PDFViewerSelectionCopyShortcut documentId={documentId} />
            <PDFViewerSelectionReleaseGuard documentId={documentId} />
            <GlobalPointerProvider documentId={documentId}>
              <PDFViewerScroller
                basePageRotations={basePageRotations}
                documentId={documentId}
                pageRotationDeltas={pageRotationDeltas}
                presentationRef={resizePresentationRef}
                renderPage={renderPage}
                onLayoutReady={handlePageLayoutReady}
              />
            </GlobalPointerProvider>
            <CopyToClipboard />
          </PDFViewerScrollAreaViewport>
          {annotationPanelOpen ? (
            <PDFViewerAnnotationPanel
              annotations={annotations}
              onClose={() => setAnnotationPanelOpen(false)}
              onSelect={(annotation) => {
                scrollToPage(annotation.pageIndex + 1, { behavior: "smooth" });
                annotationApi?.selectAnnotation(
                  annotation.pageIndex,
                  annotation.id
                );
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PDFViewerDocumentLoader({
  pdfFile,
  onDocumentLoadSuccess,
  ...innerProps
}: {
  pdfFile: string;
  onDocumentLoadSuccess?: (numPages: number) => void;
} & Omit<PDFViewerInnerProps, "pdfFile" | "documentId" | "document">) {
  const { provides: documentManager } = useDocumentManagerCapability();
  const { activeDocumentId, activeDocument } = useActiveDocument();
  const [loadError, setLoadError] = React.useState(false);
  const openedFileRef = React.useRef<string | null>(null);
  const onDocumentLoadSuccessRef = React.useRef(onDocumentLoadSuccess);

  React.useEffect(() => {
    onDocumentLoadSuccessRef.current = onDocumentLoadSuccess;
  });

  React.useEffect(() => {
    if (!documentManager || !pdfFile) {
      return;
    }
    if (openedFileRef.current === pdfFile) {
      return;
    }

    openedFileRef.current = pdfFile;
    setLoadError(false);

    const previousDocumentIds = documentManager
      .getOpenDocuments()
      .map((openDocument) => openDocument.id);
    const handleOpenError = () => {
      if (openedFileRef.current === pdfFile) {
        setLoadError(true);
      }
    };

    documentManager
      .openDocumentUrl({
        url: pdfFile,
        mode: pdfFile.startsWith("blob:") ? "full-fetch" : "auto",
      })
      .wait((response) => {
        response.task.wait((openedDocument) => {
          onDocumentLoadSuccessRef.current?.(openedDocument.pageCount);
          previousDocumentIds.forEach((documentIdToClose) => {
            documentManager.closeDocument(documentIdToClose).wait(
              () => {},
              () => {}
            );
          });
        }, handleOpenError);
      }, handleOpenError);
  }, [documentManager, pdfFile]);

  const document =
    activeDocument?.status === "loaded" ? activeDocument.document : null;
  const documentFailed = loadError || activeDocument?.status === "error";

  if (!activeDocumentId || documentFailed || !pdfFile) {
    return (
      <PDFViewerFallbackShell
        className={innerProps.className}
        defaultZoom={innerProps.defaultZoom}
        fileName={innerProps.fileName}
        showDownload={innerProps.showDownload}
        showPrint={innerProps.showPrint}
        showRotateControls={innerProps.showRotateControls}
        showToolbar={innerProps.showToolbar}
        showUpload={innerProps.showUpload}
        state={pdfFile ? (documentFailed ? "error" : "loading") : "empty"}
        toolbarActions={innerProps.toolbarActions}
        onUploadFile={(file) => {
          innerProps.onUploadFile(file);
          innerProps.onPdfUpload?.(file);
        }}
      />
    );
  }

  return (
    <PDFViewerInner
      key={activeDocumentId}
      {...innerProps}
      pdfFile={pdfFile}
      documentId={activeDocumentId}
      document={document}
    />
  );
}

function NativePdfViewerToolbar({
  fileName,
  toolbarActions,
}: Pick<PDFViewerProps, "fileName" | "toolbarActions">) {
  return (
    <div
      data-file-identity-toolbar
      className="flex min-h-12 flex-nowrap items-center justify-between gap-0 border-b border-border/60 bg-background px-3 py-2"
    >
      <div
        data-file-identity-leading
        className="flex min-w-0 flex-nowrap items-center gap-0"
      >
        <ResponsiveProjectFileIdentity fileName={fileName ?? "document.pdf"} />
      </div>
      <TooltipProvider>
        <div
          data-file-identity-trailing
          className="flex min-w-0 flex-nowrap items-center justify-end gap-0"
        >
          {toolbarActions ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-1 h-4 self-center"
              />
              {toolbarActions}
            </>
          ) : null}
        </div>
      </TooltipProvider>
    </div>
  );
}

const NativePdfViewer = React.forwardRef<PDFViewerHandle, PDFViewerProps>(
  ({ className, fileName, showToolbar = true, src, toolbarActions }, ref) => {
    React.useImperativeHandle(
      ref,
      () => ({
        scrollToPage: () => {},
        scrollToPageArea: () => {},
        getViewportElement: () => null,
      }),
      []
    );

    if (!src) {
      return null;
    }

    return (
      <div
        data-slot="pdf-viewer"
        className={cn(
          "flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden bg-background",
          className
        )}
      >
        {showToolbar ? (
          <NativePdfViewerToolbar
            fileName={fileName}
            toolbarActions={toolbarActions}
          />
        ) : null}
        <div
          className={cn(
            "relative flex min-h-0 flex-1 overflow-hidden",
            PAGED_DOCUMENT_PREVIEW_CANVAS_CLASS_NAME
          )}
          data-testid="native-pdf-viewer"
        >
          <iframe
            title={fileName ?? "PDF preview"}
            src={src}
            className="h-full w-full border-0"
            allowFullScreen
            sandbox=""
          />
        </div>
      </div>
    );
  }
);
NativePdfViewer.displayName = "NativePdfViewer";
const PdfiumPDFViewer = React.forwardRef<PDFViewerHandle, PDFViewerProps>(
  (
    {
      autoFitWidth = true,
      className,
      defaultZoom = DEFAULT_ZOOM,
      interactionMode = "select",
      textSelectionEnabled = true,
      viewportGap = PAGE_GAP,
      fileName,
      resolveScrollAreaViewport,
      showDownload = true,
      showPrint = true,
      showRotateControls = true,
      showToolbar = true,
      showUpload = true,
      src,
      toolbarActions,
      pageClassName,
      renderPageOverlay,
      onActivePageChange,
      onDocumentLoadSuccess,
      onUpload,
      onPdfUpload,
      onPagePointerDown,
      onPagePointerMove,
      onPagePointerUp,
      onPagePointerCancel,
    },
    ref
  ) => {
    const { engine, error: engineError } = useSharedPdfEngine();
    React.useEffect(() => {
      if (engineError) {
        showErrorToast(engineError, "PDF preview unavailable");
      }
    }, [engineError]);
    const [uploadedPdfFile, setUploadedPdfFile] = React.useState<{
      src: string | undefined;
      url: string | null;
    }>(() => ({ src, url: null }));
    const uploadedPdfUrl =
      uploadedPdfFile.src === src ? uploadedPdfFile.url : null;
    const pdfFile = uploadedPdfUrl ?? src ?? "";

    React.useEffect(
      () => () => {
        if (uploadedPdfUrl) {
          URL.revokeObjectURL(uploadedPdfUrl);
        }
      },
      [uploadedPdfUrl]
    );

    const handleUploadFile = React.useCallback(
      (nextFile: File) => {
        if (onUpload) {
          onUpload(nextFile);
          return;
        }

        const nextUrl = URL.createObjectURL(nextFile);

        setUploadedPdfFile({ src, url: nextUrl });
      },
      [onUpload, src]
    );
    // Plugin registrations are created once per viewer instance.
    const [plugins, setPlugins] = React.useState(() => [
      createPluginRegistration(DocumentManagerPluginPackage),
      createPluginRegistration(ViewportPluginPackage, {
        viewportGap,
      }),
      createPluginRegistration(ScrollPluginPackage, {
        defaultPageGap: PAGE_GAP,
        defaultBufferSize: 2,
      }),
      createPluginRegistration(RenderPluginPackage, {
        // AnnotationPlugin owns the interactive annotation layer. Rendering
        // Annotations into the page bitmap as well would display them twice.
        withAnnotations: false,
      }),
      createPluginRegistration(TilingPluginPackage, {
        tileSize: 768,
        overlapPx: 2.5,
        extraRings: 0,
      }),
      createPluginRegistration(InteractionManagerPluginPackage),
      createPluginRegistration(SelectionPluginPackage, {
        marquee: { enabled: false },
      }),
      createPluginRegistration(AnnotationPluginPackage, {
        autoCommit: false,
        selectAfterCreate: false,
      }),
      createPluginRegistration(SearchPluginPackage, {
        showAllResults: true,
      }),
      createPluginRegistration(ThumbnailPluginPackage, {
        width: THUMBNAIL_WIDTH,
        gap: THUMBNAIL_GAP,
        imagePadding: THUMBNAIL_IMAGE_PADDING,
        labelHeight: THUMBNAIL_LABEL_HEIGHT,
        paddingY: THUMBNAIL_PANE_PADDING_Y,
        buffer: 3,
        autoScroll: true,
        scrollBehavior: "auto",
      }),
      createPluginRegistration(ZoomPluginPackage, {
        defaultZoomLevel: defaultZoom,
        minZoom: ZOOM_OPTIONS[0],
        maxZoom: ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1],
      }),
      createPluginRegistration(RotatePluginPackage),
    ]);
    void setPlugins;

    if (engineError) {
      return (
        <PDFViewerFallbackShell
          className={className}
          defaultZoom={defaultZoom}
          fileName={fileName}
          showDownload={showDownload}
          showPrint={showPrint}
          showRotateControls={showRotateControls}
          showToolbar={showToolbar}
          showUpload={showUpload}
          state="error"
          toolbarActions={toolbarActions}
          onUploadFile={handleUploadFile}
        />
      );
    }

    if (!engine) {
      return (
        <PDFViewerFallbackShell
          className={className}
          defaultZoom={defaultZoom}
          fileName={fileName}
          showDownload={showDownload}
          showPrint={showPrint}
          showRotateControls={showRotateControls}
          showToolbar={showToolbar}
          showUpload={showUpload}
          state="loading"
          toolbarActions={toolbarActions}
          onUploadFile={handleUploadFile}
        />
      );
    }

    return (
      <PDFViewerScrollAreaResolverContext.Provider
        value={resolveScrollAreaViewport ?? resolveDefaultScrollAreaViewport}
      >
        <EmbedPDF engine={engine} plugins={plugins}>
          <PDFViewerDocumentLoader
            autoFitWidth={autoFitWidth}
            engine={engine}
            interactionMode={interactionMode}
            textSelectionEnabled={textSelectionEnabled}
            viewerRef={ref}
            pdfFile={pdfFile}
            defaultZoom={defaultZoom}
            className={className}
            fileName={fileName}
            showDownload={showDownload}
            showPrint={showPrint}
            showToolbar={showToolbar}
            showRotateControls={showRotateControls}
            showUpload={showUpload}
            toolbarActions={toolbarActions}
            pageClassName={pageClassName}
            renderPageOverlay={renderPageOverlay}
            onActivePageChange={onActivePageChange}
            onDocumentLoadSuccess={onDocumentLoadSuccess}
            onPdfUpload={onPdfUpload}
            onPagePointerDown={onPagePointerDown}
            onPagePointerMove={onPagePointerMove}
            onPagePointerUp={onPagePointerUp}
            onPagePointerCancel={onPagePointerCancel}
            onUploadFile={handleUploadFile}
          />
        </EmbedPDF>
      </PDFViewerScrollAreaResolverContext.Provider>
    );
  }
);
PdfiumPDFViewer.displayName = "PdfiumPDFViewer";

export const PDFViewer = React.forwardRef<PDFViewerHandle, PDFViewerProps>(
  (props, ref) => {
    const { useNativePdfViewer } = useNativePdfViewerPreference();
    const nativeSrc = props.nativeSrc ?? props.src;

    if (useNativePdfViewer && nativeSrc) {
      return <NativePdfViewer {...props} ref={ref} src={nativeSrc} />;
    }

    return (
      <PdfNoteProjectContext.Provider value={props.annotationProjectId}>
        <PdfiumPDFViewer {...props} ref={ref} />
      </PdfNoteProjectContext.Provider>
    );
  }
);
PDFViewer.displayName = "PDFViewer";
