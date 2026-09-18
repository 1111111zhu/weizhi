"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowLeft, ArrowRight, RefreshCcw, Search } from "lucide-react";
import * as React from "react";

import { ApiError, api, getAttachmentPreviewPdfUrl } from "@/api/client";
import type {
  Attachment,
  AttachmentRasterPdfManifest,
  SpreadsheetPreviewSearchResult,
} from "@/api/client";
import { getApiMode, isMockApiMode } from "@/api/mode";
import { PAGED_DOCUMENT_PREVIEW_CANVAS_CLASS_NAME } from "@/components/extend/document-preview-surface";
import { PDFViewer } from "@/components/extend/pdf-viewer";
import { PreviewLoadingState } from "@/components/extend/preview-loading-state";
import { PreviewPanelActions } from "@/components/extend/preview-panel-actions";
import { WorkbookFileActionsMenu } from "@/components/extend/spreadsheet-file-actions-menu";
import {
  SpreadsheetViewerSheetTabs,
  SpreadsheetViewerToolbar,
} from "@/components/extend/spreadsheet-viewer-shell";
import { Input } from "@/components/extend/ui/input";
import { Loader } from "@/components/extend/ui/loader";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/extend/ui/popover";
import { ProjectFileTypeIcon } from "@/components/project-file-type-icon";
import {
  RESIZE_GRIP_CLASS,
  RESIZE_RAIL_CLASS,
} from "@/components/resize-handle";
import { useNativePdfViewerPreference } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { showErrorToast } from "@/lib/error-toast";
import { openAuthorizedPreviewWindow } from "@/lib/open-preview-window";
import {
  PREVIEW_QUERY_GC_TIME_MS,
  PREVIEW_QUERY_META,
  PREVIEW_QUERY_STALE_TIME_MS,
} from "@/lib/preview-query-cache";
import { cn } from "@/lib/utils";

const SPREADSHEET_RESIZE_GRIP_CLASS =
  "bg-transparent group-hover:bg-muted-foreground/55 group-focus-visible:bg-primary group-active:bg-primary group-data-[resize-state=dragging]:bg-primary";

export const SPREADSHEET_PAGE_ROWS = 200;
export const SPREADSHEET_PAGE_COLUMNS = 30;
const SPREADSHEET_ROW_HEIGHT = 30;
const SPREADSHEET_MIN_ROW_HEIGHT = 22;
const SPREADSHEET_MAX_ROW_HEIGHT = 240;
const SPREADSHEET_ROW_HEADER_WIDTH = 48;
const SPREADSHEET_ROW_OVERSCAN = 12;
const SPREADSHEET_PREFETCH_ROW_THRESHOLD = 40;
const SPREADSHEET_MIN_COLUMN_WIDTH = 112;
const SPREADSHEET_MAX_AUTO_COLUMN_WIDTH = 320;
const SPREADSHEET_HARD_MAX_COLUMN_WIDTH = 720;
const SPREADSHEET_MANUAL_MAX_COLUMN_WIDTH = 1200;
const SPREADSHEET_CHARACTER_WIDTH = 7;
const SPREADSHEET_CELL_HORIZONTAL_PADDING = 28;
const SPREADSHEET_CELL_TEXT_HORIZONTAL_INSET = 16;
const SPREADSHEET_MAX_ZOOM = 200;
const SPREADSHEET_MIN_ZOOM = 50;
const SPREADSHEET_ZOOM_STEP = 10;
const SPREADSHEET_ZOOM_CLASS: Record<number, string> = {
  50: "[zoom:.5]",
  60: "[zoom:.6]",
  70: "[zoom:.7]",
  80: "[zoom:.8]",
  90: "[zoom:.9]",
  100: "[zoom:1]",
  110: "[zoom:1.1]",
  120: "[zoom:1.2]",
  130: "[zoom:1.3]",
  140: "[zoom:1.4]",
  150: "[zoom:1.5]",
  160: "[zoom:1.6]",
  170: "[zoom:1.7]",
  180: "[zoom:1.8]",
  190: "[zoom:1.9]",
  200: "[zoom:2]",
};
const SPREADSHEET_ZOOM_OPTIONS = Object.keys(SPREADSHEET_ZOOM_CLASS).map(
  Number
);

type CachedPreviewCopy = {
  loadingPreview: string;
  download: string;
  fitToWidth: string;
  zoomIn: string;
  zoomOut: string;
  expandLabel?: string;
  exitExpandedLabel?: string;
  presentationLabel?: string;
  openInNewWindow?: string;
  previewFailedTitle?: string;
  retryPreview?: string;
  retryPage?: string;
  rowsLabel?: string;
  columnsLabel?: string;
  previousPage?: string;
  nextPage?: string;
  moveLeft?: string;
  moveRight?: string;
};

type SpreadsheetSelectedCell = {
  columnIndex: number;
  rowNumber: number;
  value: string;
};

const SPREADSHEET_SEARCH_DEBOUNCE_MS = 300;

function CachedSpreadsheetSearchPopover({
  attachment,
  onClear,
  onResult,
  projectId,
}: {
  attachment: Attachment;
  onClear: () => void;
  onResult: (result: SpreadsheetPreviewSearchResult) => void;
  projectId: string;
}) {
  const [draft, setDraft] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<
    SpreadsheetPreviewSearchResult[]
  >([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isSearching, setIsSearching] = React.useState(false);
  const requestIdRef = React.useRef(0);
  const activeResult = results[activeIndex] ?? null;
  const runSearch = React.useCallback(
    (rawQuery: string) => {
      const nextQuery = rawQuery.trim();
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setQuery(nextQuery);
      setActiveIndex(0);
      if (!nextQuery) {
        setResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      void api
        .searchAttachmentPreview(projectId, attachment.id, nextQuery)
        .then((response) => {
          if (requestIdRef.current === requestId) {
            setResults(response.results);
          }
        })
        .catch(() => {
          if (requestIdRef.current === requestId) {
            setResults([]);
          }
        })
        .finally(() => {
          if (requestIdRef.current === requestId) {
            setIsSearching(false);
          }
        });
    },
    [attachment.id, projectId]
  );

  React.useEffect(() => {
    if (!draft.trim()) {
      runSearch("");
      return;
    }
    const timeoutId = window.setTimeout(
      () => runSearch(draft),
      SPREADSHEET_SEARCH_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timeoutId);
  }, [draft, runSearch]);

  React.useEffect(() => {
    if (activeResult) {
      onResult(activeResult);
    }
  }, [activeResult, onResult]);

  React.useEffect(() => {
    requestIdRef.current += 1;
    setDraft("");
    setQuery("");
    setResults([]);
    setActiveIndex(0);
    setIsSearching(false);
  }, [attachment.id, attachment.version]);

  const hasPendingSearch = draft.trim() !== query;
  const navigate = (direction: 1 | -1) => {
    if (results.length === 0) {
      return;
    }
    setActiveIndex(
      (current) => (current + direction + results.length) % results.length
    );
  };
  const clearSearch = () => {
    requestIdRef.current += 1;
    setDraft("");
    setQuery("");
    setResults([]);
    setActiveIndex(0);
    setIsSearching(false);
    onClear();
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Search workbook"
          />
        }
      >
        <Search data-icon="inline-start" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        initialFocus={false}
        className="w-auto max-w-[calc(100vw-1rem)] border-border/70 shadow-md/5 [&_[data-slot=popover-viewport]]:px-2 [&_[data-slot=popover-viewport]]:py-2"
      >
        <div className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
          <Input
            aria-label="Search workbook"
            placeholder="Search workbook"
            size="sm"
            value={draft}
            className="w-36 min-w-0 border-border/70 bg-background shadow-none has-focus-visible:border-border has-focus-visible:ring-0"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }
              event.preventDefault();
              if (event.shiftKey) {
                navigate(-1);
              } else {
                navigate(1);
              }
            }}
          />
          <span className="min-w-8 text-center text-xs text-muted-foreground tabular-nums">
            {isSearching || hasPendingSearch
              ? "Searching"
              : results.length > 0
                ? `${activeIndex + 1} / ${results.length}`
                : query
                  ? "No results"
                  : "No search"}
          </span>
          <ButtonGroup label="Search result navigation">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Previous result"
              disabled={results.length === 0 || isSearching || hasPendingSearch}
              onClick={() => navigate(-1)}
            >
              <ArrowLeft data-icon="inline-start" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Next result"
              disabled={results.length === 0 || isSearching || hasPendingSearch}
              onClick={() => navigate(1)}
            >
              <ArrowRight data-icon="inline-start" />
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

export function CachedPdfViewerPreview({
  attachment,
  copy,
  projectId,
}: {
  attachment: Attachment;
  copy: CachedPreviewCopy;
  projectId: string;
}) {
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const [canExpand, setCanExpand] = React.useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = React.useState(false);
  const { useNativePdfViewer } = useNativePdfViewerPreference();
  const preview = useQuery({
    queryKey: [
      "attachmentPdfPreview",
      projectId,
      attachment.id,
      attachment.version,
      attachment.contentHash,
    ],
    queryFn: () =>
      api.previewAttachmentPdf(projectId, attachment.id, attachment.version),
    retry: retryPreviewQuery,
    retryDelay: previewRetryDelay,
    staleTime: PREVIEW_QUERY_STALE_TIME_MS,
    gcTime: PREVIEW_QUERY_GC_TIME_MS,
    meta: PREVIEW_QUERY_META,
  });
  const sourceUrl = useBlobUrl(preview.data);
  React.useEffect(() => {
    setCanExpand(
      Boolean(
        surfaceRef.current?.closest('[data-testid="file-preview-dropzone"]')
      )
    );
  }, [sourceUrl]);

  React.useEffect(() => {
    if (!isPreviewExpanded) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPreviewExpanded(false);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPreviewExpanded]);

  React.useEffect(() => {
    if (preview.error) {
      showErrorToast(
        preview.error,
        copy.previewFailedTitle ?? "Preview failed"
      );
    }
  }, [copy.previewFailedTitle, preview.error]);

  if (preview.isPending) {
    return <PreviewLoadingState label={copy.loadingPreview} />;
  }
  if (preview.isError || !sourceUrl) {
    return (
      <CachedPreviewError
        onRetry={() => preview.refetch()}
        retryLabel={copy.retryPreview ?? ""}
      />
    );
  }

  return (
    <div
      ref={surfaceRef}
      data-preview-expanded={isPreviewExpanded || undefined}
      className={cn(
        "extend-viewer-surface dark:extend-viewer-surface-dark h-full min-h-0 [container-type:inline-size]",
        isPreviewExpanded && "fixed inset-0 z-[80] bg-background"
      )}
    >
      <div className="h-full min-h-0 p-[clamp(4px,1.5cqw,18px)]">
        <div className="h-full min-h-0 overflow-hidden rounded-md border bg-background shadow-xs">
          <PDFViewer
            annotationProjectId={projectId}
            autoFitWidth
            className="h-full min-h-0"
            fileName={getPreviewPdfFileName(attachment)}
            nativeSrc={
              isMockApiMode(getApiMode())
                ? sourceUrl
                : getAttachmentPreviewPdfUrl(
                    projectId,
                    attachment.id,
                    getPreviewPdfDisplayName(attachment),
                    attachment.version
                  )
            }
            showUpload={false}
            src={sourceUrl}
            toolbarActions={
              <PreviewPanelActions
                expandLabel={copy.expandLabel ?? "Expand preview"}
                exitExpandedLabel={
                  copy.exitExpandedLabel ?? "Collapse to sidebar"
                }
                presentationLabel={
                  copy.presentationLabel ?? "Presentation mode"
                }
                isPreviewExpanded={isPreviewExpanded}
                onOpenInNewWindow={() =>
                  openCachedPdfPreviewInNewWindow(projectId, attachment, {
                    useNativePdfViewer,
                  })
                }
                onTogglePreviewExpanded={
                  canExpand
                    ? () => setIsPreviewExpanded((current) => !current)
                    : undefined
                }
                openInNewWindowLabel={
                  copy.openInNewWindow ?? "Open in new window"
                }
              />
            }
          />
        </div>
      </div>
    </div>
  );
}

export function CachedDocumentPreview({
  attachment,
  copy,
  projectId,
}: {
  attachment: Attachment;
  copy: CachedPreviewCopy;
  projectId: string;
}) {
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const manifest = useQuery({
    queryKey: [
      "attachmentRasterPdfPreview",
      projectId,
      attachment.id,
      attachment.version,
      attachment.contentHash,
    ],
    queryFn: () =>
      api.previewAttachmentRasterPdfManifest(
        projectId,
        attachment.id,
        attachment.version
      ),
    retry: retryPreviewQuery,
    retryDelay: previewRetryDelay,
    staleTime: PREVIEW_QUERY_STALE_TIME_MS,
    gcTime: PREVIEW_QUERY_GC_TIME_MS,
    meta: PREVIEW_QUERY_META,
  });
  const pageCount = manifest.data?.pageCount ?? 0;
  const pageVirtualizer = useVirtualizer({
    count: pageCount,
    estimateSize: () => 960,
    getItemKey: (index) =>
      `${attachment.id}:${attachment.version}:${index + 1}`,
    getScrollElement: () => scrollerRef.current,
    overscan: 2,
  });

  React.useEffect(() => {
    if (manifest.error) {
      showErrorToast(
        manifest.error,
        copy.previewFailedTitle ?? "Preview failed"
      );
    }
  }, [copy.previewFailedTitle, manifest.error]);

  if (manifest.isPending) {
    return <PreviewLoadingState label={copy.loadingPreview} />;
  }
  if (manifest.isError || !manifest.data) {
    return (
      <CachedPreviewError
        onRetry={() => manifest.refetch()}
        retryLabel={copy.retryPreview ?? "Retry"}
      />
    );
  }

  return (
    <div
      ref={scrollerRef}
      className={cn(
        "h-full min-h-0 overflow-auto px-[clamp(12px,4vw,64px)] py-5",
        PAGED_DOCUMENT_PREVIEW_CANVAS_CLASS_NAME
      )}
    >
      <div
        ref={(element) =>
          applySpreadsheetElementSize(element, {
            height: pageVirtualizer.getTotalSize(),
          })
        }
        className="relative mx-auto w-full"
      >
        {pageVirtualizer.getVirtualItems().map((virtualPage) => (
          <div
            key={virtualPage.key}
            ref={(element) => {
              pageVirtualizer.measureElement(element);
              applySpreadsheetElementSize(element, {
                translateY: virtualPage.start,
              });
            }}
            data-index={virtualPage.index}
            className="absolute top-0 left-0 w-full pb-5"
          >
            <CachedDocumentPage
              attachment={attachment}
              copy={copy}
              manifest={manifest.data}
              pageNumber={virtualPage.index + 1}
              projectId={projectId}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function CachedDocumentPage({
  attachment,
  copy,
  manifest,
  pageNumber,
  projectId,
}: {
  attachment: Attachment;
  copy: CachedPreviewCopy;
  manifest: AttachmentRasterPdfManifest;
  pageNumber: number;
  projectId: string;
}) {
  const page = useQuery({
    queryKey: [
      "attachmentRasterPdfPreviewPage",
      projectId,
      attachment.id,
      attachment.version,
      attachment.contentHash,
      manifest.dpi,
      pageNumber,
    ],
    queryFn: () =>
      api.previewAttachmentRasterPdfPage(
        projectId,
        attachment.id,
        pageNumber,
        manifest.dpi,
        attachment.version
      ),
    retry: retryPreviewQuery,
    retryDelay: previewRetryDelay,
    staleTime: PREVIEW_QUERY_STALE_TIME_MS,
    gcTime: PREVIEW_QUERY_GC_TIME_MS,
    meta: PREVIEW_QUERY_META,
  });
  const objectUrl = useBlobUrl(page.data);

  return (
    <div
      data-testid="cached-document-page"
      className={
        manifest.pageWidth > manifest.pageHeight
          ? "relative aspect-[1.414/1] w-full overflow-hidden bg-white shadow-[0_1px_3px_rgb(15_23_42/0.12),0_16px_36px_rgb(15_23_42/0.08)]"
          : "relative aspect-[1/1.414] w-full overflow-hidden bg-white shadow-[0_1px_3px_rgb(15_23_42/0.12),0_16px_36px_rgb(15_23_42/0.08)]"
      }
    >
      {objectUrl ? (
        // The image width follows the resizable preview pane. No document
        // Rerender or network request is needed when the pane is dragged.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`Page ${pageNumber}`}
          className="block h-auto w-full"
          draggable={false}
          src={objectUrl}
        />
      ) : page.isError ? (
        <div className="grid h-full place-items-center p-4 text-center text-sm text-destructive">
          <Button variant="outline" size="sm" onClick={() => page.refetch()}>
            <RefreshCcw data-icon="inline-start" />
            {formatPreviewCopy(
              copy.retryPage ?? "Retry page {page}",
              "page",
              pageNumber
            )}
          </Button>
        </div>
      ) : (
        <div className="grid h-full place-items-center bg-muted/20">
          <Loader size={28} label={copy.loadingPreview} />
        </div>
      )}
    </div>
  );
}

export function CachedSpreadsheetPreview({
  attachment,
  copy,
  projectId,
  toolbarActions,
}: {
  attachment: Attachment;
  copy: CachedPreviewCopy;
  projectId: string;
  toolbarActions?: React.ReactNode;
}) {
  const [sheetIndex, setSheetIndex] = React.useState(0);
  const [columnOffset, setColumnOffset] = React.useState(0);
  const [targetRow, setTargetRow] = React.useState<number>();
  const [zoom, setZoom] = React.useState(100);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [selectedCell, setSelectedCell] =
    React.useState<SpreadsheetSelectedCell | null>(null);
  const [columnWidthOverrides, setColumnWidthOverrides] = React.useState<
    Record<string, number>
  >({});
  const [rowHeightOverrides, setRowHeightOverrides] = React.useState<
    Record<string, number>
  >({});
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const resizeSessionRef = React.useRef<(() => void) | null>(null);
  const preview = useInfiniteQuery({
    queryKey: [
      "attachmentSpreadsheetPreview",
      projectId,
      attachment.id,
      attachment.version,
      attachment.contentHash,
      sheetIndex,
      columnOffset,
      targetRow,
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.previewAttachment(projectId, attachment.id, {
        sheetIndex,
        offset: Number(pageParam),
        limit: SPREADSHEET_PAGE_ROWS,
        columnOffset,
        columnLimit: SPREADSHEET_PAGE_COLUMNS,
        targetRow,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.offset + lastPage.rows.length : undefined,
    placeholderData: (previousData) => previousData,
    retry: retryPreviewQuery,
    retryDelay: previewRetryDelay,
    staleTime: PREVIEW_QUERY_STALE_TIME_MS,
    gcTime: PREVIEW_QUERY_GC_TIME_MS,
    meta: PREVIEW_QUERY_META,
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = preview;
  React.useEffect(() => {
    if (preview.error) {
      showErrorToast(
        preview.error,
        copy.previewFailedTitle ?? "Preview failed"
      );
    }
  }, [copy.previewFailedTitle, preview.error]);
  const pages = preview.data?.pages;
  const data = pages?.[0];
  const rows = React.useMemo(
    () => pages?.flatMap((page) => page.rows) ?? [],
    [pages]
  );
  const visibleColumnCount = data
    ? Math.min(
        data.columnLimit,
        Math.max(0, data.totalColumns - data.columnOffset)
      )
    : 0;
  const defaultColumnWidths = React.useMemo(
    () => getSpreadsheetColumnWidths(rows, visibleColumnCount, columnOffset),
    [columnOffset, rows, visibleColumnCount]
  );
  const columnWidths = React.useMemo(
    () =>
      defaultColumnWidths.map(
        (width, index) =>
          columnWidthOverrides[
            spreadsheetDimensionKey(sheetIndex, columnOffset + index)
          ] ?? width
      ),
    [columnOffset, columnWidthOverrides, defaultColumnWidths, sheetIndex]
  );
  const tableMinWidth =
    SPREADSHEET_ROW_HEADER_WIDTH +
    columnWidths.reduce((total, width) => total + width, 0);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: (index) =>
      rowHeightOverrides[
        spreadsheetDimensionKey(sheetIndex, rows[index]?.rowNumber ?? -1)
      ] ?? SPREADSHEET_ROW_HEIGHT,
    getItemKey: (index) =>
      spreadsheetDimensionKey(sheetIndex, rows[index]?.rowNumber ?? index),
    overscan: SPREADSHEET_ROW_OVERSCAN,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const fallbackRows = React.useMemo(() => {
    let start = 0;
    return rows.slice(0, Math.min(rows.length, 20)).map((row, index) => {
      const size =
        rowHeightOverrides[
          spreadsheetDimensionKey(sheetIndex, row.rowNumber)
        ] ?? SPREADSHEET_ROW_HEIGHT;
      const virtualRow = {
        key: spreadsheetDimensionKey(sheetIndex, row.rowNumber),
        index,
        start,
        size,
      };
      start += size;
      return virtualRow;
    });
  }, [rowHeightOverrides, rows, sheetIndex]);
  const renderedRows = virtualRows.length > 0 ? virtualRows : fallbackRows;
  const renderedRowsHeight =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize()
      : fallbackRows.reduce((total, row) => total + row.size, 0);
  React.useEffect(() => {
    setSheetIndex(0);
    setColumnOffset(0);
    setTargetRow(undefined);
    setZoom(100);
    setSelectedCell(null);
    setColumnWidthOverrides({});
    setRowHeightOverrides({});
  }, [attachment.id, attachment.version]);

  React.useEffect(
    () => () => {
      resizeSessionRef.current?.();
    },
    []
  );

  const handleSearchResult = React.useCallback(
    (result: SpreadsheetPreviewSearchResult) => {
      setSheetIndex(result.sheetIndex);
      setColumnOffset(
        Math.floor(result.columnIndex / SPREADSHEET_PAGE_COLUMNS) *
          SPREADSHEET_PAGE_COLUMNS
      );
      setTargetRow(result.rowNumber);
      setSelectedCell({
        columnIndex: result.columnIndex,
        rowNumber: result.rowNumber,
        value: result.value,
      });
      scrollerRef.current?.scrollTo({ left: 0, top: 0 });
    },
    []
  );

  React.useEffect(() => {
    const lastVisibleRow = virtualRows.at(-1);
    if (
      !lastVisibleRow ||
      lastVisibleRow.index <
        Math.max(0, rows.length - SPREADSHEET_PREFETCH_ROW_THRESHOLD) ||
      !hasNextPage ||
      isFetchingNextPage
    ) {
      return;
    }
    void fetchNextPage();
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    rows.length,
    virtualRows,
  ]);

  const handleSpreadsheetScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const scroller = event.currentTarget;
      const remainingScroll =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      if (
        remainingScroll > SPREADSHEET_ROW_HEIGHT * 20 ||
        !hasNextPage ||
        isFetchingNextPage
      ) {
        return;
      }
      void fetchNextPage();
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );
  const handleCellCopy = React.useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (!selectedCell) {
        return;
      }

      event.preventDefault();
      event.clipboardData.setData("text/plain", selectedCell.value);
    },
    [selectedCell]
  );
  const resizeColumn = React.useCallback(
    (relativeColumnIndex: number, width: number) => {
      const absoluteColumnIndex = columnOffset + relativeColumnIndex;
      setColumnWidthOverrides((current) => ({
        ...current,
        [spreadsheetDimensionKey(sheetIndex, absoluteColumnIndex)]:
          clampSpreadsheetColumnWidth(
            width,
            SPREADSHEET_MANUAL_MAX_COLUMN_WIDTH
          ),
      }));
    },
    [columnOffset, sheetIndex]
  );
  const handleColumnResizeStart = React.useCallback(
    (
      relativeColumnIndex: number,
      event: React.PointerEvent<HTMLDivElement>
    ) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      resizeSessionRef.current?.();
      const handle = event.currentTarget;
      handle.setPointerCapture?.(event.pointerId);
      const startX = event.clientX;
      const startWidth =
        columnWidths[relativeColumnIndex] ?? SPREADSHEET_MIN_COLUMN_WIDTH;
      const zoomScale = zoom / 100;
      let active = true;

      const handleMove = (moveEvent: PointerEvent) => {
        resizeColumn(
          relativeColumnIndex,
          startWidth + (moveEvent.clientX - startX) / zoomScale
        );
      };
      const finish = (cancelled: boolean) => {
        if (!active) {
          return;
        }
        active = false;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleCancel);
        window.removeEventListener("blur", handleCancel);
        if (handle.hasPointerCapture?.(event.pointerId)) {
          handle.releasePointerCapture?.(event.pointerId);
        }
        if (cancelled) {
          resizeColumn(relativeColumnIndex, startWidth);
        }
        if (resizeSessionRef.current === handleCancel) {
          resizeSessionRef.current = null;
        }
      };
      const handleCancel = () => finish(true);
      const handleUp = () => finish(false);

      resizeSessionRef.current = handleCancel;

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleCancel);
      window.addEventListener("blur", handleCancel);
    },
    [columnWidths, resizeColumn, zoom]
  );
  const handleColumnResizeKeyDown = React.useCallback(
    (
      relativeColumnIndex: number,
      event: React.KeyboardEvent<HTMLDivElement>
    ) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      event.preventDefault();
      const currentWidth =
        columnWidths[relativeColumnIndex] ?? SPREADSHEET_MIN_COLUMN_WIDTH;
      const step = event.shiftKey ? 40 : 10;
      resizeColumn(
        relativeColumnIndex,
        currentWidth + (event.key === "ArrowRight" ? step : -step)
      );
    },
    [columnWidths, resizeColumn]
  );
  const resizeRow = React.useCallback(
    (rowIndex: number, rowNumber: number, height: number) => {
      const nextHeight = clampSpreadsheetRowHeight(height);
      setRowHeightOverrides((current) => ({
        ...current,
        [spreadsheetDimensionKey(sheetIndex, rowNumber)]: nextHeight,
      }));
      rowVirtualizer.resizeItem(rowIndex, nextHeight);
    },
    [rowVirtualizer, sheetIndex]
  );
  const handleRowResizeStart = React.useCallback(
    (
      rowIndex: number,
      rowNumber: number,
      currentHeight: number,
      event: React.PointerEvent<HTMLDivElement>
    ) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      resizeSessionRef.current?.();
      const handle = event.currentTarget;
      handle.setPointerCapture?.(event.pointerId);
      const startY = event.clientY;
      const zoomScale = zoom / 100;
      let active = true;

      const handleMove = (moveEvent: PointerEvent) => {
        resizeRow(
          rowIndex,
          rowNumber,
          currentHeight + (moveEvent.clientY - startY) / zoomScale
        );
      };
      const finish = (cancelled: boolean) => {
        if (!active) {
          return;
        }
        active = false;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleCancel);
        window.removeEventListener("blur", handleCancel);
        if (handle.hasPointerCapture?.(event.pointerId)) {
          handle.releasePointerCapture?.(event.pointerId);
        }
        if (cancelled) {
          resizeRow(rowIndex, rowNumber, currentHeight);
        }
        if (resizeSessionRef.current === handleCancel) {
          resizeSessionRef.current = null;
        }
      };
      const handleCancel = () => finish(true);
      const handleUp = () => finish(false);

      resizeSessionRef.current = handleCancel;

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleCancel);
      window.addEventListener("blur", handleCancel);
    },
    [resizeRow, zoom]
  );
  const handleRowResizeKeyDown = React.useCallback(
    (
      rowIndex: number,
      rowNumber: number,
      currentHeight: number,
      event: React.KeyboardEvent<HTMLDivElement>
    ) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
        return;
      }
      event.preventDefault();
      const step = event.shiftKey ? 20 : 5;
      resizeRow(
        rowIndex,
        rowNumber,
        currentHeight + (event.key === "ArrowDown" ? step : -step)
      );
    },
    [resizeRow]
  );

  if (preview.isPending) {
    return <PreviewLoadingState label={copy.loadingPreview} />;
  }
  if (preview.isError || !data) {
    return (
      <CachedPreviewError
        onRetry={() => preview.refetch()}
        retryLabel={copy.retryPreview ?? "Retry"}
      />
    );
  }

  const changeZoom = (delta: number) => {
    setZoom((current) =>
      Math.min(
        SPREADSHEET_MAX_ZOOM,
        Math.max(SPREADSHEET_MIN_ZOOM, current + delta)
      )
    );
  };
  const downloadOriginal = async () => {
    if (isDownloading) {
      return;
    }
    setIsDownloading(true);
    try {
      const blob = await api.downloadAttachmentReadOnly(
        projectId,
        attachment.id
      );
      downloadPreviewBlob(blob, getAttachmentFileName(attachment));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-background"
      onCopy={handleCellCopy}
    >
      <SpreadsheetViewerToolbar
        actionMenu={(additionalControls) => (
          <WorkbookFileActionsMenu
            additionalControls={additionalControls}
            actionsLabel={copy.download}
            downloadDisabled={isDownloading}
            downloadLabel={copy.download}
            nextColumnsDisabled={!data.hasMoreColumns}
            nextColumnsLabel={copy.moveRight ?? "Next columns"}
            onDownload={() => downloadOriginal()}
            onNextColumns={
              data.totalColumns > SPREADSHEET_PAGE_COLUMNS
                ? () => {
                    setColumnOffset(
                      data.columnOffset + SPREADSHEET_PAGE_COLUMNS
                    );
                    scrollerRef.current?.scrollTo({ left: 0, top: 0 });
                  }
                : undefined
            }
            onPreviousColumns={
              data.totalColumns > SPREADSHEET_PAGE_COLUMNS
                ? () => {
                    setColumnOffset(
                      Math.max(0, data.columnOffset - SPREADSHEET_PAGE_COLUMNS)
                    );
                    scrollerRef.current?.scrollTo({ left: 0, top: 0 });
                  }
                : undefined
            }
            previousColumnsDisabled={data.columnOffset <= 0}
            previousColumnsLabel={copy.moveLeft ?? "Previous columns"}
            showDownloadButton
            showUploadButton={false}
          />
        )}
        canZoomIn={zoom < SPREADSHEET_MAX_ZOOM}
        canZoomOut={zoom > SPREADSHEET_MIN_ZOOM}
        currentZoom={zoom}
        leadingContent={
          <div className="flex min-w-0 items-center gap-2">
            <ProjectFileTypeIcon
              fileName={getAttachmentFileName(attachment)}
              className="size-5"
              iconClassName="size-5"
            />
            <span className="min-w-0 truncate text-sm font-medium">
              {getAttachmentFileName(attachment)}
            </span>
          </div>
        }
        onZoomChange={setZoom}
        onZoomIn={() => changeZoom(SPREADSHEET_ZOOM_STEP)}
        onZoomOut={() => changeZoom(-SPREADSHEET_ZOOM_STEP)}
        searchControl={
          <CachedSpreadsheetSearchPopover
            attachment={attachment}
            onClear={() => setSelectedCell(null)}
            onResult={handleSearchResult}
            projectId={projectId}
          />
        }
        toolbarActions={toolbarActions}
        zoomInLabel={copy.zoomIn}
        zoomOptions={SPREADSHEET_ZOOM_OPTIONS}
        zoomOutLabel={copy.zoomOut}
      />
      <div
        ref={scrollerRef}
        data-testid="spreadsheet-preview-scroller"
        onScroll={handleSpreadsheetScroll}
        className="min-h-0 max-w-full [scrollbar-gutter:stable] overflow-auto bg-muted/20"
      >
        <table
          ref={(element) =>
            applySpreadsheetElementSize(element, {
              minWidth: tableMinWidth,
            })
          }
          className={`grid w-max min-w-full border-collapse text-xs ${SPREADSHEET_ZOOM_CLASS[zoom]}`}
        >
          <thead className="sticky top-0 z-20 grid bg-muted text-foreground">
            <tr className="flex">
              <th
                ref={(element) =>
                  applySpreadsheetElementSize(element, {
                    width: SPREADSHEET_ROW_HEADER_WIDTH,
                  })
                }
                aria-label={copy.rowsLabel ?? "Rows"}
                className="sticky left-0 z-30 flex-none border-r border-b bg-muted px-2 py-1.5 text-center font-medium text-muted-foreground"
              />
              {Array.from({ length: visibleColumnCount }, (_, index) => {
                const absoluteIndex = data.columnOffset + index;
                const isSelectedColumn =
                  selectedCell?.columnIndex === absoluteIndex;
                return (
                  <th
                    key={absoluteIndex}
                    ref={(element) =>
                      applySpreadsheetElementSize(element, {
                        width: columnWidths[index],
                      })
                    }
                    aria-label={spreadsheetColumnLabel(absoluteIndex)}
                    className={cn(
                      "relative flex-none border-b border-r py-1.5 pl-2 pr-4 text-center font-semibold text-muted-foreground",
                      isSelectedColumn && "bg-primary/10 text-primary"
                    )}
                  >
                    <span className="block truncate">
                      {spreadsheetColumnLabel(absoluteIndex)}
                    </span>
                    <div
                      role="separator"
                      aria-label={`Resize ${spreadsheetColumnLabel(absoluteIndex)} column`}
                      aria-orientation="vertical"
                      aria-valuemin={SPREADSHEET_MIN_COLUMN_WIDTH}
                      aria-valuemax={SPREADSHEET_MANUAL_MAX_COLUMN_WIDTH}
                      aria-valuenow={Math.round(columnWidths[index] ?? 0)}
                      tabIndex={0}
                      className={cn(
                        RESIZE_RAIL_CLASS,
                        "absolute inset-y-0 right-0 z-20 flex w-3 cursor-pointer touch-none select-none outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-col-resize"
                      )}
                      onPointerDown={(event) =>
                        handleColumnResizeStart(index, event)
                      }
                      onPointerCancel={() => resizeSessionRef.current?.()}
                      onKeyDown={(event) =>
                        handleColumnResizeKeyDown(index, event)
                      }
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          RESIZE_GRIP_CLASS,
                          SPREADSHEET_RESIZE_GRIP_CLASS,
                          "h-4 w-px"
                        )}
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody
            ref={(element) =>
              applySpreadsheetElementSize(element, {
                height: renderedRowsHeight,
              })
            }
            data-testid="spreadsheet-preview-virtual-body"
            className="relative grid"
          >
            {renderedRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) {
                return null;
              }
              const isSelectedRow = selectedCell?.rowNumber === row.rowNumber;
              return (
                <tr
                  key={virtualRow.key}
                  ref={(element) =>
                    applySpreadsheetElementSize(element, {
                      height: virtualRow.size,
                      translateY: virtualRow.start,
                    })
                  }
                  data-testid="spreadsheet-preview-row"
                  className="absolute flex w-full border-b bg-background hover:bg-muted/40"
                >
                  <th
                    ref={(element) =>
                      applySpreadsheetElementSize(element, {
                        width: SPREADSHEET_ROW_HEADER_WIDTH,
                      })
                    }
                    className={cn(
                      "sticky left-0 z-10 flex-none border-r bg-muted/90 px-2 py-1.5 text-center font-medium text-muted-foreground tabular-nums",
                      isSelectedRow && "bg-primary/10 text-primary"
                    )}
                  >
                    <span>{row.rowNumber}</span>
                    <div
                      role="separator"
                      aria-label={`Resize row ${row.rowNumber}`}
                      aria-orientation="horizontal"
                      aria-valuemin={SPREADSHEET_MIN_ROW_HEIGHT}
                      aria-valuemax={SPREADSHEET_MAX_ROW_HEIGHT}
                      aria-valuenow={Math.round(virtualRow.size)}
                      tabIndex={0}
                      className={cn(
                        RESIZE_RAIL_CLASS,
                        "absolute inset-x-0 bottom-0 z-20 flex h-3 cursor-pointer touch-none select-none outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[orientation=horizontal]:active:cursor-row-resize"
                      )}
                      onPointerDown={(event) =>
                        handleRowResizeStart(
                          virtualRow.index,
                          row.rowNumber,
                          virtualRow.size,
                          event
                        )
                      }
                      onPointerCancel={() => resizeSessionRef.current?.()}
                      onKeyDown={(event) =>
                        handleRowResizeKeyDown(
                          virtualRow.index,
                          row.rowNumber,
                          virtualRow.size,
                          event
                        )
                      }
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          RESIZE_GRIP_CLASS,
                          SPREADSHEET_RESIZE_GRIP_CLASS,
                          "h-px w-4"
                        )}
                      />
                    </div>
                  </th>
                  {Array.from({ length: visibleColumnCount }, (_, index) => {
                    const cell = row.cells[index] ?? "";
                    const absoluteIndex = data.columnOffset + index;
                    const isSelected =
                      selectedCell?.rowNumber === row.rowNumber &&
                      selectedCell.columnIndex === absoluteIndex;
                    const textWidth = cell
                      ? getSpreadsheetCellTextWidth(
                          row.cells,
                          index,
                          columnWidths,
                          visibleColumnCount
                        )
                      : 0;
                    return (
                      <td
                        key={`${row.rowNumber}-${absoluteIndex}`}
                        ref={(element) =>
                          applySpreadsheetElementSize(element, {
                            width: columnWidths[index],
                          })
                        }
                        data-testid={`spreadsheet-cell-${row.rowNumber}-${absoluteIndex}`}
                        aria-label={cell || undefined}
                        aria-selected={isSelected}
                        tabIndex={0}
                        className={cn(
                          "relative flex-none cursor-cell overflow-visible border-r px-2 py-1.5 text-foreground outline-none",
                          cell && "z-[1]",
                          isSelectedRow && "bg-primary/[0.035]",
                          selectedCell?.columnIndex === absoluteIndex &&
                            "bg-primary/[0.045]",
                          isSelected &&
                            "z-[3] bg-background shadow-[inset_0_0_0_2px_var(--primary)]"
                        )}
                        onClick={() =>
                          setSelectedCell({
                            columnIndex: absoluteIndex,
                            rowNumber: row.rowNumber,
                            value: cell,
                          })
                        }
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") {
                            return;
                          }
                          event.preventDefault();
                          setSelectedCell({
                            columnIndex: absoluteIndex,
                            rowNumber: row.rowNumber,
                            value: cell,
                          });
                        }}
                      >
                        {cell ? (
                          <span
                            ref={(element) =>
                              applySpreadsheetElementSize(element, {
                                maxHeight: Math.max(0, virtualRow.size - 12),
                                width: textWidth,
                              })
                            }
                            data-testid={`spreadsheet-cell-text-${row.rowNumber}-${absoluteIndex}`}
                            className="pointer-events-none absolute top-1.5 left-2 block overflow-hidden leading-[18px] whitespace-pre"
                          >
                            {cell}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {preview.isFetchingNextPage ? (
          <div className="sticky bottom-0 flex justify-center border-t bg-background/95 px-3 py-2 backdrop-blur">
            <Loader size={24} label={copy.loadingPreview} />
          </div>
        ) : null}
      </div>
      <SpreadsheetViewerSheetTabs
        activeSheetIndex={data.sheetIndex}
        onActiveSheetIndexChange={(index) => {
          setSheetIndex(index);
          setColumnOffset(0);
          setTargetRow(undefined);
          setSelectedCell(null);
          scrollerRef.current?.scrollTo({ left: 0, top: 0 });
        }}
        sheetNames={data.sheetNames}
      />
    </div>
  );
}

function CachedPreviewError({
  onRetry,
  retryLabel,
}: {
  onRetry: () => void;
  retryLabel: string;
}) {
  return (
    <div
      role="alert"
      className="grid h-full min-h-0 place-items-center bg-destructive/5 p-6 text-center"
    >
      <div className="grid max-w-sm justify-items-center gap-3">
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCcw data-icon="inline-start" />
          {retryLabel}
        </Button>
      </div>
    </div>
  );
}

function useBlobUrl(blob: Blob | undefined) {
  const [url, setUrl] = React.useState<string>();

  React.useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const nextUrl = URL.createObjectURL(blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [blob]);

  return url;
}

function spreadsheetColumnLabel(index: number) {
  let label = "";
  let value = Math.max(0, index) + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCodePoint(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function getSpreadsheetColumnWidths(
  rows: { cells: string[] }[],
  columnCount: number,
  columnOffset = 0
) {
  return Array.from({ length: columnCount }, (_, columnIndex) => {
    const measuredWidths = [
      measureSpreadsheetTextWidth(
        spreadsheetColumnLabel(columnOffset + columnIndex)
      ),
      ...rows.map((row) =>
        measureSpreadsheetTextWidth(row.cells[columnIndex] ?? "")
      ),
    ];
    const maxWidth = Math.max(...measuredWidths);

    if (maxWidth <= SPREADSHEET_MAX_AUTO_COLUMN_WIDTH) {
      return clampSpreadsheetColumnWidth(
        maxWidth,
        SPREADSHEET_MAX_AUTO_COLUMN_WIDTH
      );
    }

    return clampSpreadsheetColumnWidth(
      Math.max(
        SPREADSHEET_MAX_AUTO_COLUMN_WIDTH,
        getSpreadsheetWidthPercentile(measuredWidths, 0.9)
      ),
      SPREADSHEET_HARD_MAX_COLUMN_WIDTH
    );
  });
}

function getSpreadsheetCellTextWidth(
  rowCells: string[],
  columnIndex: number,
  columnWidths: number[],
  columnCount: number
) {
  let endColumnIndex = columnIndex + 1;
  while (
    endColumnIndex < columnCount &&
    !hasSpreadsheetCellContent(rowCells[endColumnIndex] ?? "")
  ) {
    endColumnIndex += 1;
  }

  const availableWidth = columnWidths
    .slice(columnIndex, endColumnIndex)
    .reduce((total, width) => total + width, 0);
  return Math.max(0, availableWidth - SPREADSHEET_CELL_TEXT_HORIZONTAL_INSET);
}

function hasSpreadsheetCellContent(value: string) {
  return value.length > 0;
}

function measureSpreadsheetTextWidth(value: string) {
  const longestLineLength = value
    .split(/\r?\n/u)
    .reduce((longest, line) => Math.max(longest, line.length), 0);
  return (
    longestLineLength * SPREADSHEET_CHARACTER_WIDTH +
    SPREADSHEET_CELL_HORIZONTAL_PADDING
  );
}

function getSpreadsheetWidthPercentile(values: number[], percentile: number) {
  const sortedValues = [...values].sort((left, right) => left - right);
  const index = Math.floor((sortedValues.length - 1) * percentile);
  return sortedValues[index] ?? 0;
}

function clampSpreadsheetColumnWidth(width: number, maxWidth: number) {
  return Math.min(
    maxWidth,
    Math.max(SPREADSHEET_MIN_COLUMN_WIDTH, Math.round(width))
  );
}

function clampSpreadsheetRowHeight(height: number) {
  return Math.min(
    SPREADSHEET_MAX_ROW_HEIGHT,
    Math.max(SPREADSHEET_MIN_ROW_HEIGHT, Math.round(height))
  );
}

function spreadsheetDimensionKey(sheetIndex: number, index: number) {
  return `${sheetIndex}:${index}`;
}

function applySpreadsheetElementSize(
  element: HTMLElement | null,
  size: {
    height?: number;
    maxHeight?: number;
    minWidth?: number;
    translateY?: number;
    width?: number;
  }
) {
  if (!element) {
    return;
  }
  if (size.height !== undefined) {
    element.style.height = `${size.height}px`;
  }
  if (size.maxHeight !== undefined) {
    element.style.maxHeight = `${size.maxHeight}px`;
  }
  if (size.minWidth !== undefined) {
    element.style.minWidth = `${size.minWidth}px`;
  }
  if (size.translateY !== undefined) {
    element.style.transform = `translateY(${size.translateY}px)`;
  }
  if (size.width !== undefined) {
    element.style.width = `${size.width}px`;
  }
}

function formatPreviewCopy(
  template: string,
  token: string,
  value: string | number
) {
  return template.replace(`{${token}}`, String(value));
}

function getAttachmentFileName(attachment: Attachment) {
  return attachment.originalName ?? attachment.fileName;
}

function getPreviewPdfFileName(attachment: Attachment) {
  return `${getPreviewPdfDisplayName(attachment)}.pdf`;
}

function getPreviewPdfDisplayName(attachment: Attachment) {
  return getAttachmentFileName(attachment).replace(/\.[^.]+$/u, "");
}

function openCachedPdfPreviewInNewWindow(
  projectId: string,
  attachment: Attachment,
  options?: { useNativePdfViewer?: boolean }
) {
  if (!isMockApiMode(getApiMode()) && options?.useNativePdfViewer) {
    window.open(
      getAttachmentPreviewPdfUrl(
        projectId,
        attachment.id,
        getPreviewPdfDisplayName(attachment),
        attachment.version
      ),
      "_blank",
      "noopener"
    );
    return;
  }

  const fileName = getPreviewPdfFileName(attachment);
  if (typeof BroadcastChannel === "undefined") {
    void api
      .previewAttachmentPdf(projectId, attachment.id, attachment.version)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      });
    return;
  }
  void openAuthorizedPreviewWindow({
    projectId,
    fileName,
    mimeType: "application/pdf",
    loadBlob: () =>
      api.previewAttachmentPdf(projectId, attachment.id, attachment.version),
  });
}

function downloadPreviewBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function retryPreviewQuery(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.code === "PREVIEW_PROCESSING") {
    return failureCount < 40;
  }
  return failureCount < 2;
}

function previewRetryDelay(attemptIndex: number, error: unknown) {
  if (error instanceof ApiError && error.code === "PREVIEW_PROCESSING") {
    return 1500;
  }
  return Math.min(1000 * 2 ** attemptIndex, 5000);
}
