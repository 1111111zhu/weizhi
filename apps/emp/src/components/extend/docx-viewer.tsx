"use client";

import {
  DocxEditorViewer,
  useDocxComments,
  useDocxEditor,
  useDocxPageLayout,
  useDocxTrackChanges,
  useDocxViewerThumbnails,
} from "@extend-ai/react-docx";
import type {
  DocModel,
  DocxDocumentTheme,
  DocxEditorController,
  DocxPageThumbnailItem,
  ParagraphNode,
  TableNode,
} from "@extend-ai/react-docx";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Comment01Icon,
  Download01Icon,
  FileDiffIcon,
  MinusSignCircleIcon,
  Moon02Icon,
  MoreHorizontalIcon,
  PlusSignCircleIcon,
  SidebarLeftIcon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Button as MobileButton,
  MobileActionSheet,
  useCompactViewport,
} from "@project-wing/ui";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, Hand, MousePointer2 } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";

import { PAGED_DOCUMENT_PREVIEW_CANVAS_CLASS_NAME } from "@/components/extend/document-preview-surface";
import {
  clearDocumentSearchHighlight,
  highlightDocumentSearchText,
} from "@/components/extend/document-text-highlight";
import { DocumentTextSearchPopover } from "@/components/extend/document-text-search-popover";
import {
  DocumentViewerThumbnailSidebar,
  getDocumentViewerContentWidth,
  useElementWidth,
  useInlineThumbnailSidebar,
} from "@/components/extend/document-viewer-sidebar";
import {
  createDocxCommentCardRenderer,
  createDocxTrackedChangeCardRenderer,
} from "@/components/extend/docx-annotation-card";
import { FileThumbnail } from "@/components/extend/file-thumbnail";
import { PreviewLoadingState } from "@/components/extend/preview-loading-state";
import {
  PREVIEW_ZOOM_TRIGGER_CLASS_NAME,
  PREVIEW_ZOOM_VALUE_CLASS_NAME,
} from "@/components/extend/preview-zoom-control";
import { Button } from "@/components/extend/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/extend/ui/dropdown-menu";
import { Input } from "@/components/extend/ui/input";
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
import { showErrorToast } from "@/lib/error-toast";
import { cn } from "@/lib/utils";

import mobileStyles from "./docx-mobile-toolbar.module.css";

const DEFAULT_ZOOM = 50;
const DOCX_LOADING_INDICATOR_DELAY_MS = 300;
const DOCX_MAX_FIT_ZOOM = 400;
const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOCX_MIN_FIT_ZOOM = 10;
const DOCX_THUMBNAIL_LIST_PADDING = 16;
const DOCX_THUMBNAIL_ROW_ESTIMATE = 172;
const DOCX_THUMBNAIL_SIDEBAR_WIDTH = 160;
const DOCX_THUMBNAIL_WIDTH = 92;
const ZOOM_OPTIONS = [10, 25, 50, 75, 100, 125, 150, 175, 200, 400] as const;
const DOCX_PADDING_WARNING_TEXT = "a style property during rerender";
const DOCX_THUMBNAIL_FOCUS_RING_CLASS =
  "group-focus-visible/docx-thumbnail-sidebar:ring-2 group-focus-visible/docx-thumbnail-sidebar:ring-ring group-focus-visible/docx-thumbnail-sidebar:ring-offset-1 group-focus-visible/docx-thumbnail-sidebar:ring-offset-background";
const DOCX_THUMBNAIL_PREFETCH_ROWS = 4;
const DOCX_VIRTUALIZATION_ZOOM_SETTLE_MS = 160;
const MemoizedDocxEditorViewer = React.memo(DocxEditorViewer);

type UploadedDocxFile = {
  file: File;
  identity: string;
  sourceUrl: string | undefined;
};

export type DocxParagraphAnchor = {
  paragraphId?: string;
  paragraphOrdinal: number;
  paragraphText: string;
  part: "word/document.xml";
  sourceXmlSha256: string;
};

export type DocxParagraphAnchorResolver = (
  element: Element | null
) => Promise<DocxParagraphAnchor | null>;

export type DocxPageOverlayRenderer = (input: {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  rotation: number;
  scale: number;
  pageElement: HTMLElement;
  pageSurfaceElement: HTMLElement | null;
  resolveParagraphAnchor: DocxParagraphAnchorResolver;
  selectionModeEnabled?: boolean;
}) => React.ReactNode;

type DocxActivePageStore = {
  getSnapshot: () => number;
  setActivePage: React.Dispatch<React.SetStateAction<number>>;
  subscribe: (listener: () => void) => () => void;
};

type DocxThumbnailRenderWindowState = {
  visiblePageIndexes: number[];
  prefetchPageIndexes: number[];
};

type DocxSearchResult = {
  end: number;
  nodeIndex: number;
  start: number;
};

function collectParagraphOrdinals(
  nodes: readonly (ParagraphNode | TableNode)[],
  ordinals: Map<ParagraphNode, number>,
  nextOrdinal: { value: number }
) {
  for (const node of nodes) {
    if (node.type === "paragraph") {
      ordinals.set(node, nextOrdinal.value);
      nextOrdinal.value += 1;
      continue;
    }

    for (const row of node.rows) {
      for (const cell of row.cells) {
        collectParagraphOrdinals(cell.nodes, ordinals, nextOrdinal);
      }
    }
  }
}

function parseElementIndex(element: Element, attributeName: string) {
  const value = Number.parseInt(element.getAttribute(attributeName) ?? "", 10);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function resolveParagraphNode(
  model: Pick<DocModel, "nodes">,
  element: Element | null
) {
  const host = element?.closest<HTMLElement>("[data-docx-paragraph-kind]");
  if (!host) {
    return null;
  }

  const kind = host.dataset.docxParagraphKind;
  if (kind === "paragraph") {
    const nodeIndex = parseElementIndex(host, "data-docx-paragraph-node-index");
    if (nodeIndex === null) {
      return null;
    }

    const node = model.nodes[nodeIndex];
    return node?.type === "paragraph" ? node : null;
  }
  if (kind !== "table-cell") {
    return null;
  }

  const tableIndex = parseElementIndex(host, "data-docx-table-index");
  const rowIndex = parseElementIndex(host, "data-docx-row-index");
  const cellIndex = parseElementIndex(host, "data-docx-cell-index");
  const paragraphIndex = parseElementIndex(host, "data-docx-paragraph-index");
  if (
    tableIndex === null ||
    rowIndex === null ||
    cellIndex === null ||
    paragraphIndex === null
  ) {
    return null;
  }

  const table = model.nodes[tableIndex];
  if (table?.type !== "table") {
    return null;
  }

  const paragraphs = table.rows[rowIndex]?.cells[cellIndex]?.nodes.filter(
    (node): node is ParagraphNode => node.type === "paragraph"
  );
  return paragraphs?.[paragraphIndex] ?? null;
}

function decodeXmlText(value: string) {
  return value.replaceAll(
    /&(?:amp|apos|gt|lt|quot|#\d+|#x[\dA-Fa-f]+);/g,
    (entity) => {
      switch (entity) {
        case "&amp;": {
          return "&";
        }
        case "&apos;": {
          return "'";
        }
        case "&gt;": {
          return ">";
        }
        case "&lt;": {
          return "<";
        }
        case "&quot;": {
          return '"';
        }
        default: {
          const radix = entity.startsWith("&#x") ? 16 : 10;
          const digits = entity.slice(radix === 16 ? 3 : 2, -1);
          const codePoint = Number.parseInt(digits, radix);
          return Number.isSafeInteger(codePoint) && codePoint <= 0x10_ff_ff
            ? String.fromCodePoint(codePoint)
            : entity;
        }
      }
    }
  );
}

function getCanonicalWordParagraphText(sourceXml: string) {
  return Array.from(
    sourceXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g),
    (match) => decodeXmlText(match[1] ?? "")
  ).join("");
}

async function getSha256(value: string) {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export function createDocxParagraphAnchorResolver(
  model: Pick<DocModel, "nodes">
): DocxParagraphAnchorResolver {
  const ordinals = new Map<ParagraphNode, number>();
  collectParagraphOrdinals(model.nodes, ordinals, { value: 0 });
  const anchors = new WeakMap<
    ParagraphNode,
    Promise<DocxParagraphAnchor | null>
  >();

  return async (element) => {
    await Promise.resolve();
    const paragraph = resolveParagraphNode(model, element);
    if (!paragraph) {
      return null;
    }

    const cached = anchors.get(paragraph);
    if (cached) {
      return cached;
    }

    const anchor = (async () => {
      const paragraphOrdinal = ordinals.get(paragraph);
      const { sourceXml } = paragraph;
      if (paragraphOrdinal === undefined || !sourceXml) {
        return null;
      }

      const paragraphId = sourceXml.match(
        /\bw14:paraId\s*=\s*["']([\dA-Fa-f]{8})["']/
      )?.[1];
      return {
        ...(paragraphId ? { paragraphId } : {}),
        paragraphOrdinal,
        paragraphText: getCanonicalWordParagraphText(sourceXml),
        part: "word/document.xml" as const,
        sourceXmlSha256: await getSha256(sourceXml),
      };
    })();
    anchors.set(paragraph, anchor);
    return anchor;
  };
}

function getParagraphText(paragraph: ParagraphNode) {
  return paragraph.children
    .map((child) => (child.type === "text" ? child.text : ""))
    .join("");
}

function findDocxSearchResults(editor: DocxEditorController, rawQuery: string) {
  const query = rawQuery.trim().toLocaleLowerCase();

  if (!query) {
    return [];
  }

  return editor.model.nodes.flatMap<DocxSearchResult>((node, nodeIndex) => {
    if (node.type !== "paragraph") {
      return [];
    }

    const text = getParagraphText(node);
    const normalizedText = text.toLocaleLowerCase();
    const results: DocxSearchResult[] = [];
    let start = normalizedText.indexOf(query);

    while (start !== -1) {
      results.push({ end: start + query.length, nodeIndex, start });
      start = normalizedText.indexOf(query, start + query.length);
    }

    return results;
  });
}

function useSettledValue<TValue>(value: TValue, delayMs: number) {
  const [settledValue, setSettledValue] = React.useState(value);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => setSettledValue(value), delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return settledValue;
}

function createDocxActivePageStore(): DocxActivePageStore {
  let activePage = 1;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => activePage,
    setActivePage: (nextPage) => {
      const value =
        typeof nextPage === "function" ? nextPage(activePage) : nextPage;
      const normalizedValue = Math.max(1, Math.round(value || 1));

      if (normalizedValue === activePage) {
        return;
      }

      activePage = normalizedValue;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function useDocxActivePage(activePageStore: DocxActivePageStore) {
  return React.useSyncExternalStore(
    activePageStore.subscribe,
    activePageStore.getSnapshot,
    activePageStore.getSnapshot
  );
}

function areNumberArraysEqual(left: number[], right: number[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

async function loadDocxFile(
  url: string,
  displayFileName: string
): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch DOCX (${response.status})`);
  }

  const blob = await response.blob();
  return new File([blob], displayFileName, {
    type: blob.type || DOCX_MIME_TYPE,
  });
}

function formatDocumentName(fileName: string | undefined, url: string) {
  if (fileName?.trim()) {
    return fileName;
  }

  const pathname = url.split("?")[0] ?? "";
  const rawName = pathname.split("/").pop() ?? "document.docx";

  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

function ensureDocxExtension(fileName: string) {
  return fileName.toLowerCase().endsWith(".docx")
    ? fileName
    : `${fileName}.docx`;
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

async function downloadDocxFile({
  file,
  fileName,
  url,
}: {
  file?: File;
  fileName: string;
  url?: string;
}) {
  if (file) {
    downloadBlob(file, ensureDocxExtension(fileName));
    return;
  }

  if (!url) {
    return;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download DOCX (${response.status})`);
  }

  downloadBlob(await response.blob(), ensureDocxExtension(fileName));
}

function getNextZoomScale(currentZoomScale: number, direction: 1 | -1) {
  const currentIndex = ZOOM_OPTIONS.indexOf(
    currentZoomScale as (typeof ZOOM_OPTIONS)[number]
  );
  let fallbackIndex = -1;

  if (direction > 0) {
    fallbackIndex = ZOOM_OPTIONS.findIndex((value) => value > currentZoomScale);
  } else {
    for (let index = ZOOM_OPTIONS.length - 1; index >= 0; index -= 1) {
      if (ZOOM_OPTIONS[index] < currentZoomScale) {
        fallbackIndex = index;
        break;
      }
    }
  }

  const resolvedIndex = currentIndex === -1 ? fallbackIndex : currentIndex;
  if (resolvedIndex < 0) {
    return currentZoomScale;
  }

  const nextIndex = Math.min(
    Math.max(resolvedIndex + direction, 0),
    ZOOM_OPTIONS.length - 1
  );

  return ZOOM_OPTIONS[nextIndex] ?? currentZoomScale;
}

function normalizeDocxZoomScale(value: number | undefined): number {
  return typeof value === "number" &&
    ZOOM_OPTIONS.includes(value as (typeof ZOOM_OPTIONS)[number])
    ? value
    : DEFAULT_ZOOM;
}

function useDelayedLoadingIndicator(isLoading: boolean, delayMs: number) {
  const [showSpinner, setShowSpinner] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowSpinner(true);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
      setShowSpinner(false);
    };
  }, [delayMs, isLoading]);

  return isLoading && showSpinner;
}

function isDocxPaddingWarning(args: unknown[]) {
  return (
    typeof args[0] === "string" &&
    args[0].includes(DOCX_PADDING_WARNING_TEXT) &&
    args.some((arg) => String(arg).includes("padding"))
  );
}

function useSuppressDocxPaddingWarning(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    const originalConsoleError = console.error;

    console.error = (...args: unknown[]) => {
      if (isDocxPaddingWarning(args)) {
        return;
      }
      originalConsoleError(...args);
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, [enabled]);
}

function isInteractiveViewerTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'a[href], button, input, select, textarea, [contenteditable="true"], [role="button"], [role="link"]'
      )
    )
  );
}

export function shouldSyncDocxPageOverlayHosts(
  records: readonly Pick<MutationRecord, "target">[]
) {
  return records.some((record) => {
    const target =
      record.target instanceof Element
        ? record.target
        : record.target.parentElement;
    return !target?.closest('[data-docx-page-wrapper="true"]');
  });
}

export function getDocxPageOverlayHost(
  pageElement: HTMLElement,
  pageSurfaceElement: HTMLElement | null
) {
  return pageSurfaceElement ?? pageElement;
}

export function getDocxViewportPanScroll({
  currentClientX,
  currentClientY,
  startClientX,
  startClientY,
  startScrollLeft,
  startScrollTop,
}: {
  currentClientX: number;
  currentClientY: number;
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
  startScrollTop: number;
}) {
  return {
    left: Math.max(0, startScrollLeft + startClientX - currentClientX),
    top: Math.max(0, startScrollTop + startClientY - currentClientY),
  };
}

export function getDocxDocumentCanvasWidth({
  minimumWidth,
  pageWidth,
  zoomScale,
}: {
  minimumWidth: number;
  pageWidth: number;
  zoomScale: number;
}) {
  return Math.max(minimumWidth, pageWidth * (zoomScale / 100));
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

function ViewerLoadingSurface({
  showSpinner = true,
}: {
  showSpinner?: boolean;
}) {
  return showSpinner ? (
    <PreviewLoadingState className="min-h-52 bg-transparent" />
  ) : null;
}

function DocxFileActionsMenu({
  controlsDisabled,
  downloadDisabled,
  isPreparingDownload,
  isDark,
  onDownload,
  onShowCommentsChange,
  onShowTrackedChangesChange,
  onIsDarkChange,
  onUploadClick,
  showComments,
  showDownloadButton,
  showNightRenderToggle,
  showTrackedChanges,
  showUploadButton,
}: {
  controlsDisabled: boolean;
  downloadDisabled: boolean;
  isPreparingDownload: boolean;
  isDark: boolean;
  onDownload: () => void;
  onShowCommentsChange: (checked: boolean) => void;
  onShowTrackedChangesChange: (checked: boolean) => void;
  onIsDarkChange: (checked: boolean) => void;
  onUploadClick: () => void;
  showComments: boolean;
  showDownloadButton: boolean;
  showNightRenderToggle: boolean;
  showTrackedChanges: boolean;
  showUploadButton: boolean;
}) {
  const showFileActions = showDownloadButton || showUploadButton;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Open DOCX actions"
          />
        }
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {showNightRenderToggle ? (
          <>
            <DropdownMenuCheckboxItem
              checked={isDark}
              disabled={controlsDisabled}
              variant="switch"
              onCheckedChange={(checked) => onIsDarkChange(checked === true)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <HugeiconsIcon icon={Moon02Icon} className="size-4" />
                Dark mode
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuCheckboxItem
          checked={showComments}
          disabled={controlsDisabled}
          variant="switch"
          onCheckedChange={(checked) => onShowCommentsChange(checked === true)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <HugeiconsIcon icon={Comment01Icon} className="size-4" />
            Comments
          </span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={showTrackedChanges}
          disabled={controlsDisabled}
          variant="switch"
          onCheckedChange={(checked) =>
            onShowTrackedChangesChange(checked === true)
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            <HugeiconsIcon icon={FileDiffIcon} className="size-4" />
            Edits
          </span>
        </DropdownMenuCheckboxItem>
        {showFileActions ? <DropdownMenuSeparator /> : null}
        {showDownloadButton ? (
          <DropdownMenuItem disabled={downloadDisabled} onClick={onDownload}>
            {isPreparingDownload ? (
              <Spinner className="size-4" />
            ) : (
              <HugeiconsIcon icon={Download01Icon} className="size-4" />
            )}
            Download
          </DropdownMenuItem>
        ) : null}
        {showUploadButton ? (
          <DropdownMenuItem onClick={onUploadClick}>
            <HugeiconsIcon icon={Upload01Icon} className="size-4" />
            Upload
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DocxPageNumberControl({
  activePageStore,
  controlsDisabled,
  onPageChange,
  pageCount,
}: {
  activePageStore: DocxActivePageStore;
  controlsDisabled: boolean;
  onPageChange: (pageNumber: number) => void;
  pageCount: number;
}) {
  const activePage = useDocxActivePage(activePageStore);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const displayPage = pageCount ? activePage : 1;
  const [isEditing, setIsEditing] = React.useState(false);
  const [draftPage, setDraftPage] = React.useState(() => String(displayPage));

  React.useEffect(() => {
    if (!isEditing) {
      setDraftPage(String(displayPage));
    }
  }, [displayPage, isEditing]);

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

      onPageChange(Math.min(Math.max(parsedPage, 1), Math.max(pageCount, 1)));
    },
    [onPageChange, pageCount]
  );

  return (
    <div className="grid grid-cols-[auto_repeat(3,1.25rem)] items-center text-sm whitespace-nowrap text-primary">
      <span className="mr-1">Page</span>
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
          disabled={controlsDisabled || !pageCount}
          onClick={() => {
            setDraftPage(String(displayPage));
            setIsEditing(true);
          }}
        >
          {displayPage}
        </Button>
      )}
      <span className="flex size-5 items-center justify-center">of</span>
      <span className="flex size-5 items-center justify-center tabular-nums">
        {pageCount || "-"}
      </span>
    </div>
  );
}

export function DocxToolbar({
  activePageStore,
  controlsDisabled,
  fileName,
  isDark,
  isPreparingDownload,
  onDownload,
  onIsDarkChange,
  onFitWidth,
  onPageChange,
  onShowCommentsChange,
  onShowTrackedChangesChange,
  onTogglePan,
  onToggleSelection,
  onToggleSidebar,
  onUploadClick,
  pageCount,
  panModeEnabled,
  selectionModeEnabled,
  searchControl,
  setZoomScale,
  showComments,
  showDownloadButton = true,
  showNightRenderToggle,
  showPanControl = false,
  showSelectionControl = false,
  showTrackedChanges,
  showUploadButton = true,
  toolbarActions,
  zoomScale,
  mobileZoomMode,
}: {
  activePageStore: DocxActivePageStore;
  controlsDisabled: boolean;
  fileName: string;
  isDark: boolean;
  isPreparingDownload: boolean;
  onDownload: () => void;
  onIsDarkChange: (checked: boolean) => void;
  onFitWidth?: () => void;
  onPageChange: (pageNumber: number) => void;
  onShowCommentsChange: (checked: boolean) => void;
  onShowTrackedChangesChange: (checked: boolean) => void;
  onTogglePan: () => void;
  onToggleSelection: () => void;
  onToggleSidebar: () => void;
  onUploadClick: () => void;
  pageCount: number;
  searchControl?: React.ReactNode;
  setZoomScale: React.Dispatch<React.SetStateAction<number>>;
  showComments: boolean;
  showDownloadButton?: boolean;
  showNightRenderToggle: boolean;
  showPanControl?: boolean;
  showSelectionControl?: boolean;
  showTrackedChanges: boolean;
  panModeEnabled: boolean;
  selectionModeEnabled: boolean;
  showUploadButton?: boolean;
  toolbarActions?: React.ReactNode;
  zoomScale: number;
  mobileZoomMode?: "width" | "manual";
}) {
  const isMobile = useCompactViewport(767);
  const activePage = useDocxActivePage(activePageStore);
  const [mobilePanel, setMobilePanel] = React.useState<
    "page" | "actions" | null
  >(null);
  const [pageDraft, setPageDraft] = React.useState("");
  const pageInputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (!isMobile) {
      setMobilePanel(null);
    }
  }, [isMobile]);
  const canGoPrevious = !controlsDisabled && activePage > 1;
  const canGoNext =
    !controlsDisabled && pageCount > 0 && activePage < pageCount;
  const canZoomIn = zoomScale < ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1];
  const canZoomOut = zoomScale > ZOOM_OPTIONS[0];

  if (isMobile) {
    const displayPage = pageCount ? activePage : 1;
    const parsedPage = Number(pageDraft.trim());
    const validPage = Boolean(pageDraft.trim()) && Number.isInteger(parsedPage);
    const changeZoom = (value: number) => {
      setZoomScale(value);
    };
    const toggleActions = [
      ...(showNightRenderToggle
        ? [
            {
              label: "Dark mode",
              icon: <HugeiconsIcon icon={Moon02Icon} />,
              checked: isDark,
              handleClick: () => onIsDarkChange(!isDark),
            },
          ]
        : []),
      {
        label: "Comments",
        icon: <HugeiconsIcon icon={Comment01Icon} />,
        checked: showComments,
        handleClick: () => onShowCommentsChange(!showComments),
      },
      {
        label: "Edits",
        icon: <HugeiconsIcon icon={FileDiffIcon} />,
        checked: showTrackedChanges,
        handleClick: () => onShowTrackedChangesChange(!showTrackedChanges),
      },
      ...(showPanControl
        ? [
            {
              label: "Pan document",
              icon: <Hand />,
              checked: panModeEnabled,
              handleClick: onTogglePan,
            },
          ]
        : []),
      ...(showSelectionControl
        ? [
            {
              label: "Select fields",
              icon: <MousePointer2 />,
              checked: selectionModeEnabled,
              handleClick: onToggleSelection,
            },
          ]
        : []),
    ];

    return (
      <>
        <div className={mobileStyles.toolbar} data-docx-mobile-toolbar>
          <MobileButton
            variant="quiet"
            className={mobileStyles.iconButton}
            aria-label="Toggle thumbnails"
            disabled={controlsDisabled}
            onClick={onToggleSidebar}
          >
            <HugeiconsIcon icon={SidebarLeftIcon} aria-hidden />
          </MobileButton>
          <div className={mobileStyles.pageNavigation}>
            <MobileButton
              variant="quiet"
              className={mobileStyles.iconButton}
              aria-label="Previous page"
              disabled={!canGoPrevious}
              onClick={() => onPageChange(activePage - 1)}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden />
            </MobileButton>
            <MobileButton
              variant="quiet"
              className={mobileStyles.pageButton}
              aria-label={`Current page ${displayPage}. Edit page number`}
              aria-haspopup="dialog"
              aria-expanded={mobilePanel === "page"}
              disabled={controlsDisabled || !pageCount}
              onClick={() => {
                setPageDraft(String(displayPage));
                setMobilePanel("page");
              }}
            >
              {displayPage}
              <span className={mobileStyles.pageTotal}>
                {" "}
                / {pageCount || "–"}
              </span>
            </MobileButton>
            <MobileButton
              variant="quiet"
              className={mobileStyles.iconButton}
              aria-label="Next page"
              disabled={!canGoNext}
              onClick={() => onPageChange(activePage + 1)}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} aria-hidden />
            </MobileButton>
          </div>
          {searchControl}
          <MobileButton
            variant="quiet"
            className={mobileStyles.iconButton}
            aria-label="Open DOCX actions"
            aria-haspopup="dialog"
            aria-expanded={mobilePanel === "actions"}
            onClick={() => setMobilePanel("actions")}
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} aria-hidden />
          </MobileButton>
        </div>
        <MobileActionSheet
          open={mobilePanel === "page"}
          onOpenChange={(open) => setMobilePanel(open ? "page" : null)}
          title="Go to page"
          onOpenChangeComplete={(open) => {
            if (open) {
              pageInputRef.current?.focus();
              pageInputRef.current?.select();
            }
          }}
        >
          <form
            className={mobileStyles.pageForm}
            onSubmit={(event) => {
              event.preventDefault();
              if (!validPage || controlsDisabled) {
                return;
              }
              onPageChange(
                Math.min(Math.max(parsedPage, 1), Math.max(pageCount, 1))
              );
              setMobilePanel(null);
            }}
          >
            <Input
              ref={pageInputRef}
              aria-label="Page number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pageDraft}
              disabled={controlsDisabled}
              onChange={(event) => setPageDraft(event.target.value)}
            />
            <span className={mobileStyles.pageTotal}>/ {pageCount}</span>
            <MobileButton
              type="submit"
              disabled={!validPage || controlsDisabled}
            >
              Go
            </MobileButton>
          </form>
        </MobileActionSheet>
        <MobileActionSheet
          open={mobilePanel === "actions"}
          onOpenChange={(open) => setMobilePanel(open ? "actions" : null)}
          title="Document tools"
        >
          <div className={mobileStyles.tools}>
            <div className={mobileStyles.zoomStepper}>
              <span>Zoom</span>
              <MobileButton
                variant="quiet"
                className={mobileStyles.iconButton}
                aria-label="Zoom out"
                disabled={controlsDisabled || !canZoomOut}
                onClick={() =>
                  setZoomScale((current) => getNextZoomScale(current, -1))
                }
              >
                <HugeiconsIcon icon={MinusSignCircleIcon} aria-hidden />
              </MobileButton>
              <output aria-label="Zoom level">{Math.round(zoomScale)}%</output>
              <MobileButton
                variant="quiet"
                className={mobileStyles.iconButton}
                aria-label="Zoom in"
                disabled={controlsDisabled || !canZoomIn}
                onClick={() =>
                  setZoomScale((current) => getNextZoomScale(current, 1))
                }
              >
                <HugeiconsIcon icon={PlusSignCircleIcon} aria-hidden />
              </MobileButton>
            </div>
            <div className={mobileStyles.zoomPresets} aria-label="Zoom presets">
              {ZOOM_OPTIONS.map((value) => (
                <MobileButton
                  key={value}
                  variant="quiet"
                  aria-pressed={
                    mobileZoomMode !== "width" &&
                    Math.round(zoomScale) === value
                  }
                  disabled={controlsDisabled}
                  onClick={() => changeZoom(value)}
                >
                  {value}%
                </MobileButton>
              ))}
            </div>
            {onFitWidth ? (
              <div className={mobileStyles.fitModes}>
                <MobileButton
                  variant="quiet"
                  aria-pressed={mobileZoomMode === "width"}
                  disabled={controlsDisabled}
                  onClick={onFitWidth}
                >
                  Fit width
                </MobileButton>
                <MobileButton
                  variant="quiet"
                  disabled={controlsDisabled}
                  aria-pressed={
                    mobileZoomMode === "manual" && Math.round(zoomScale) === 100
                  }
                  onClick={() => changeZoom(100)}
                >
                  Actual size
                </MobileButton>
              </div>
            ) : null}
            <div className={mobileStyles.optionList}>
              {toggleActions.map((action) => (
                <MobileButton
                  key={action.label}
                  variant="quiet"
                  className={mobileStyles.option}
                  aria-pressed={action.checked}
                  disabled={controlsDisabled}
                  onClick={action.handleClick}
                >
                  <span className={mobileStyles.optionContent}>
                    {action.icon}
                    <span>{action.label}</span>
                    <Check
                      aria-hidden
                      className={
                        action.checked ? undefined : mobileStyles.unchecked
                      }
                    />
                  </span>
                </MobileButton>
              ))}
              {showDownloadButton ? (
                <MobileButton
                  variant="quiet"
                  className={mobileStyles.option}
                  disabled={controlsDisabled || isPreparingDownload}
                  loading={isPreparingDownload}
                  iconStart={<HugeiconsIcon icon={Download01Icon} />}
                  onClick={onDownload}
                >
                  Download
                </MobileButton>
              ) : null}
              {showUploadButton ? (
                <MobileButton
                  variant="quiet"
                  className={mobileStyles.option}
                  iconStart={<HugeiconsIcon icon={Upload01Icon} />}
                  onClick={() => {
                    setMobilePanel(null);
                    onUploadClick();
                  }}
                >
                  Upload
                </MobileButton>
              ) : null}
            </div>
            {toolbarActions ? (
              <div
                className={mobileStyles.extraActions}
                aria-label="Preview actions"
              >
                {toolbarActions}
              </div>
            ) : null}
          </div>
        </MobileActionSheet>
      </>
    );
  }

  return (
    <div
      data-file-identity-toolbar
      className="flex min-h-12 flex-nowrap items-center justify-between gap-0 border-b bg-background px-3 py-2"
    >
      <TooltipProvider>
        <div
          data-file-identity-leading
          className="flex min-w-0 flex-nowrap items-center gap-0"
        >
          <ToolbarTooltip label="Toggle thumbnails">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Toggle thumbnails"
              disabled={controlsDisabled}
              onClick={onToggleSidebar}
            >
              <HugeiconsIcon icon={SidebarLeftIcon} className="size-4" />
            </Button>
          </ToolbarTooltip>
          <Separator orientation="vertical" className="mx-3 h-5 self-center" />
          <ResponsiveProjectFileIdentity fileName={fileName} />
          <Separator orientation="vertical" className="mx-3 h-5 self-center" />
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
          <DocxPageNumberControl
            activePageStore={activePageStore}
            controlsDisabled={controlsDisabled}
            onPageChange={onPageChange}
            pageCount={pageCount}
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
        <div
          data-file-identity-trailing
          className="ml-auto flex min-w-0 flex-nowrap items-center justify-end gap-0"
        >
          <Separator
            orientation="vertical"
            className="mx-0.5 h-5 self-center"
          />
          <div className="flex flex-none items-center gap-1">
            <ToolbarTooltip label="Zoom out">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={controlsDisabled || !canZoomOut}
                aria-label="Zoom out"
                onClick={() =>
                  setZoomScale((currentZoomScale) =>
                    getNextZoomScale(currentZoomScale, -1)
                  )
                }
              >
                <HugeiconsIcon icon={MinusSignCircleIcon} className="size-4" />
              </Button>
            </ToolbarTooltip>
            <Select
              value={zoomScale.toString()}
              onValueChange={(value) => setZoomScale(Number(value))}
              disabled={controlsDisabled}
              modal={false}
            >
              <SelectTrigger
                size="sm"
                className={PREVIEW_ZOOM_TRIGGER_CLASS_NAME}
                aria-label="Zoom level"
              >
                <SelectValue className={PREVIEW_ZOOM_VALUE_CLASS_NAME}>
                  {Math.round(zoomScale)}%
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false}>
                {ZOOM_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value.toString()}>
                    {value}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ToolbarTooltip label="Zoom in">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={controlsDisabled || !canZoomIn}
                aria-label="Zoom in"
                onClick={() =>
                  setZoomScale((currentZoomScale) =>
                    getNextZoomScale(currentZoomScale, 1)
                  )
                }
              >
                <HugeiconsIcon icon={PlusSignCircleIcon} className="size-4" />
              </Button>
            </ToolbarTooltip>
          </div>
          {showPanControl ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-1 h-4 self-center"
              />
              <ToolbarTooltip label="Pan document">
                <Button
                  type="button"
                  variant={panModeEnabled ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label="Pan document"
                  aria-pressed={panModeEnabled}
                  disabled={controlsDisabled}
                  onClick={onTogglePan}
                >
                  <Hand className="size-4" />
                </Button>
              </ToolbarTooltip>
            </>
          ) : null}
          {showSelectionControl ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-1 h-4 self-center"
              />
              <ToolbarTooltip label="Select fields">
                <Button
                  type="button"
                  variant={selectionModeEnabled ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label="Select fields"
                  aria-pressed={selectionModeEnabled}
                  disabled={controlsDisabled}
                  onClick={onToggleSelection}
                >
                  <MousePointer2 className="size-4" />
                </Button>
              </ToolbarTooltip>
            </>
          ) : null}
          {searchControl ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-1 h-4 self-center"
              />
              {searchControl}
            </>
          ) : null}
          <Separator orientation="vertical" className="mx-1 h-4 self-center" />
          <DocxFileActionsMenu
            controlsDisabled={controlsDisabled}
            downloadDisabled={controlsDisabled || isPreparingDownload}
            isPreparingDownload={isPreparingDownload}
            isDark={isDark}
            onDownload={onDownload}
            onIsDarkChange={onIsDarkChange}
            onShowCommentsChange={onShowCommentsChange}
            onShowTrackedChangesChange={onShowTrackedChangesChange}
            onUploadClick={onUploadClick}
            showComments={showComments}
            showDownloadButton={showDownloadButton}
            showNightRenderToggle={showNightRenderToggle}
            showTrackedChanges={showTrackedChanges}
            showUploadButton={showUploadButton}
          />
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

function DocxSidebarThumbnail({
  canvasRef,
  displayFileName,
  hasError,
  isActive,
  isLoading,
  pageNumber,
  pixelHeightPx,
  pixelWidthPx,
  previewAspectRatio,
}: {
  canvasRef: React.RefCallback<HTMLCanvasElement>;
  displayFileName: string;
  hasError: boolean;
  isActive: boolean;
  isLoading: boolean;
  pageNumber: number;
  pixelHeightPx: number;
  pixelWidthPx: number;
  previewAspectRatio: number;
}) {
  return (
    <FileThumbnail
      file={{
        name: `${displayFileName} page ${pageNumber}`,
        type: DOCX_MIME_TYPE,
      }}
      previewAspectRatio={previewAspectRatio}
      previewClassName="rounded-md bg-white"
      previewContent={
        <canvas
          ref={canvasRef}
          width={pixelWidthPx}
          height={pixelHeightPx}
          className="!size-full bg-white object-cover object-top"
        />
      }
      isLoading={isLoading}
      hasError={hasError}
      className={cn(
        "w-[92px] rounded-md border-0 shadow-xs ring-0 transition-shadow duration-150",
        isActive && "shadow-sm"
      )}
    />
  );
}

function DocxThumbnailSidebarList({
  activePage,
  displayFileName,
  isLoadingDocument,
  onSelectPage,
  onThumbnailRenderWindowChange,
  pageCount,
  sidebarOpen,
  thumbnails,
}: {
  activePage: number;
  displayFileName: string;
  isLoadingDocument: boolean;
  onSelectPage: (pageNumber: number) => void;
  onThumbnailRenderWindowChange: (
    renderWindow: DocxThumbnailRenderWindowState
  ) => void;
  pageCount: number;
  sidebarOpen: boolean;
  thumbnails: DocxPageThumbnailItem[];
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const thumbnailListboxId = React.useId();
  const visibleThumbnails = React.useMemo(
    () => thumbnails.slice(0, pageCount || 0),
    [pageCount, thumbnails]
  );
  const activeDescendantId =
    activePage > 0 && visibleThumbnails.length > 0
      ? `${thumbnailListboxId}-page-${activePage}`
      : undefined;
  const virtualizer = useVirtualizer({
    count: visibleThumbnails.length,
    estimateSize: () => DOCX_THUMBNAIL_ROW_ESTIMATE,
    getItemKey: (index) => visibleThumbnails[index]?.pageIndex ?? index,
    getScrollElement: () => viewportRef.current,
    overscan: 3,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const renderWindowSignature = virtualItems
    .map((virtualRow) => virtualRow.index)
    .join(",");

  React.useEffect(() => {
    if (!sidebarOpen || isLoadingDocument || visibleThumbnails.length === 0) {
      onThumbnailRenderWindowChange({
        prefetchPageIndexes: [],
        visiblePageIndexes: [],
      });
      return;
    }

    const visiblePageIndexes = virtualItems
      .map((virtualRow) => visibleThumbnails[virtualRow.index]?.pageIndex)
      .filter((pageIndex): pageIndex is number => pageIndex !== undefined);
    const firstVirtualIndex = virtualItems[0]?.index ?? 0;
    const lastVirtualIndex =
      virtualItems[virtualItems.length - 1]?.index ?? firstVirtualIndex;
    const firstPrefetchIndex = Math.max(
      0,
      firstVirtualIndex - DOCX_THUMBNAIL_PREFETCH_ROWS
    );
    const lastPrefetchIndex = Math.min(
      visibleThumbnails.length - 1,
      lastVirtualIndex + DOCX_THUMBNAIL_PREFETCH_ROWS
    );
    const visiblePageIndexSet = new Set(visiblePageIndexes);
    const prefetchPageIndexes: number[] = [];

    for (
      let index = firstPrefetchIndex;
      index <= lastPrefetchIndex;
      index += 1
    ) {
      const pageIndex = visibleThumbnails[index]?.pageIndex;

      if (pageIndex !== undefined && !visiblePageIndexSet.has(pageIndex)) {
        prefetchPageIndexes.push(pageIndex);
      }
    }

    onThumbnailRenderWindowChange({
      prefetchPageIndexes,
      visiblePageIndexes,
    });
  }, [
    isLoadingDocument,
    onThumbnailRenderWindowChange,
    renderWindowSignature,
    sidebarOpen,
    visibleThumbnails,
    virtualItems,
  ]);

  React.useEffect(() => {
    if (!sidebarOpen || activePage < 1 || visibleThumbnails.length === 0) {
      return;
    }

    virtualizer.scrollToIndex(
      Math.min(activePage - 1, visibleThumbnails.length - 1),
      {
        align: "auto",
      }
    );
  }, [activePage, sidebarOpen, virtualizer, visibleThumbnails.length]);

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
      }

      if (nextPage === null) {
        return;
      }

      event.preventDefault();
      onSelectPage(nextPage);
    },
    [activePage, onSelectPage, pageCount]
  );

  return (
    <ScrollArea
      className="h-full"
      scrollFade
      viewportClassName="group/docx-thumbnail-sidebar focus-visible:ring-0 focus-visible:ring-offset-0"
      viewportProps={{
        "aria-activedescendant": activeDescendantId,
        "aria-busy": isLoadingDocument || undefined,
        "aria-label": "DOCX pages",
        onKeyDown: handleKeyDown,
        onMouseDown: (event) => {
          event.currentTarget.focus({ preventScroll: true });
        },
        role: "listbox",
        tabIndex: 0,
      }}
      viewportRef={viewportRef}
    >
      {isLoadingDocument ? null : visibleThumbnails.length > 0 ? (
        <div
          className="relative"
          style={{
            height:
              virtualizer.getTotalSize() + DOCX_THUMBNAIL_LIST_PADDING * 2,
          }}
        >
          {virtualItems.map((virtualRow) => {
            const thumbnail = visibleThumbnails[virtualRow.index];
            if (!thumbnail) {
              return null;
            }

            return (
              <div
                key={virtualRow.key}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className={cn(
                  "absolute top-0 right-3 left-3 pb-3 [contain:layout]",
                  thumbnail.pageNumber === activePage && "z-10"
                )}
                style={{
                  transform: `translateY(${virtualRow.start + DOCX_THUMBNAIL_LIST_PADDING}px)`,
                }}
              >
                <div
                  tabIndex={0}
                  id={`${thumbnailListboxId}-page-${thumbnail.pageNumber}`}
                  role="option"
                  aria-current={
                    thumbnail.pageNumber === activePage ? "page" : undefined
                  }
                  aria-label={`Page ${thumbnail.pageNumber}`}
                  aria-posinset={thumbnail.pageNumber}
                  aria-selected={thumbnail.pageNumber === activePage}
                  aria-setsize={pageCount}
                  data-docx-viewer-thumbnail-option={thumbnail.pageNumber}
                  className={cn(
                    "flex h-auto w-full cursor-default flex-col items-center gap-2 rounded-md p-2 text-xs transition-[background-color,box-shadow,color] duration-150 motion-reduce:transition-none outline-none select-none hover:bg-workbench-row-hover",
                    thumbnail.pageNumber === activePage &&
                      "bg-workbench-active text-workbench-active-foreground ring-2 ring-inset ring-[var(--pw-color-primary)] hover:bg-workbench-active",
                    thumbnail.pageNumber !== activePage &&
                      "text-[var(--pw-color-muted-foreground)]",
                    thumbnail.pageNumber === activePage &&
                      DOCX_THUMBNAIL_FOCUS_RING_CLASS
                  )}
                  onClick={() => onSelectPage(thumbnail.pageNumber)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectPage(thumbnail.pageNumber);
                    }
                  }}
                >
                  <DocxSidebarThumbnail
                    canvasRef={thumbnail.canvasRef}
                    displayFileName={displayFileName}
                    hasError={thumbnail.status === "error"}
                    isActive={thumbnail.pageNumber === activePage}
                    isLoading={
                      thumbnail.status !== "ready" &&
                      thumbnail.status !== "error"
                    }
                    pageNumber={thumbnail.pageNumber}
                    pixelHeightPx={thumbnail.pixelHeightPx}
                    pixelWidthPx={thumbnail.pixelWidthPx}
                    previewAspectRatio={thumbnail.aspectRatio}
                  />
                  {thumbnail.pageNumber}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </ScrollArea>
  );
}

function DocxThumbnailSidebarContent({
  activePageStore,
  displayFileName,
  editor,
  isLoadingDocument,
  onSelectPage,
  pageCount,
  reportedPageCount,
  sidebarOpen,
}: {
  activePageStore: DocxActivePageStore;
  displayFileName: string;
  editor: DocxEditorController;
  isLoadingDocument: boolean;
  onSelectPage: (pageNumber: number) => void;
  pageCount: number;
  reportedPageCount: number;
  sidebarOpen: boolean;
}) {
  const [thumbnailRenderWindow, setThumbnailRenderWindow] =
    React.useState<DocxThumbnailRenderWindowState>({
      prefetchPageIndexes: [],
      visiblePageIndexes: [],
    });
  const thumbnailEditor = React.useMemo<DocxEditorController>(
    () => ({
      ...editor,
      totalPages: Math.max(editor.totalPages, reportedPageCount),
    }),
    [editor, reportedPageCount]
  );
  const thumbnailOptions = React.useMemo(
    () => ({
      // Detached thumbnail rendering handles offscreen pages; keep the raster
      // Queue dormant while the sidebar is closed.
      disabled: !sidebarOpen,
      pixelRatio: 2,
      renderWindow: thumbnailRenderWindow,
      resolution: {
        maxHeight: DOCX_THUMBNAIL_WIDTH * 1.35,
        maxWidth: DOCX_THUMBNAIL_WIDTH,
      },
    }),
    [sidebarOpen, thumbnailRenderWindow]
  );
  const { thumbnails } = useDocxViewerThumbnails(
    thumbnailEditor,
    thumbnailOptions
  );
  const activePage = useDocxActivePage(activePageStore);
  const handleThumbnailRenderWindowChange = React.useCallback(
    (nextRenderWindow: DocxThumbnailRenderWindowState) => {
      setThumbnailRenderWindow((currentRenderWindow) => {
        if (
          areNumberArraysEqual(
            currentRenderWindow.visiblePageIndexes,
            nextRenderWindow.visiblePageIndexes
          ) &&
          areNumberArraysEqual(
            currentRenderWindow.prefetchPageIndexes,
            nextRenderWindow.prefetchPageIndexes
          )
        ) {
          return currentRenderWindow;
        }

        return nextRenderWindow;
      });
    },
    []
  );

  if (!sidebarOpen) {
    return null;
  }

  return (
    <DocxThumbnailSidebarList
      activePage={activePage}
      displayFileName={displayFileName}
      isLoadingDocument={isLoadingDocument}
      onSelectPage={onSelectPage}
      onThumbnailRenderWindowChange={handleThumbnailRenderWindowChange}
      pageCount={pageCount}
      sidebarOpen={sidebarOpen}
      thumbnails={thumbnails}
    />
  );
}

export function DocxViewerPreview({
  autoFitWidth = true,
  className,
  defaultZoom = DEFAULT_ZOOM,
  fileName,
  isDark,
  onIsDarkChange,
  renderPageOverlay,
  showDownload = true,
  showPanControl = false,
  showSelectionControl = false,
  panModeInitiallyEnabled = false,
  selectionModeInitiallyEnabled = true,
  showToolbar = true,
  showUpload = true,
  src,
  toolbarActions,
  onZoomScaleChange,
  zoomScale,
}: {
  autoFitWidth?: boolean;
  className?: string;
  defaultZoom?: number;
  fileName?: string;
  isDark: boolean;
  onIsDarkChange: (isDark: boolean) => void;
  renderPageOverlay?: DocxPageOverlayRenderer;
  showDownload?: boolean;
  showPanControl?: boolean;
  showSelectionControl?: boolean;
  panModeInitiallyEnabled?: boolean;
  selectionModeInitiallyEnabled?: boolean;
  showToolbar?: boolean;
  showUpload?: boolean;
  src?: string;
  toolbarActions?: React.ReactNode;
  onZoomScaleChange?: (zoomScale: number) => void;
  zoomScale?: number;
}) {
  return (
    <DocxViewerContent
      autoFitWidth={autoFitWidth}
      className={className}
      defaultZoom={defaultZoom}
      effectiveIsDark={isDark}
      fileName={fileName}
      renderPageOverlay={renderPageOverlay}
      setNightRenderEnabled={onIsDarkChange}
      shouldRenderNightMode
      showDownload={showDownload}
      showPanControl={showPanControl}
      showSelectionControl={showSelectionControl}
      panModeInitiallyEnabled={panModeInitiallyEnabled}
      selectionModeInitiallyEnabled={selectionModeInitiallyEnabled}
      showToolbar={showToolbar}
      showUpload={showUpload}
      toolbarActions={toolbarActions}
      controlledZoomScale={zoomScale}
      onZoomScaleChange={onZoomScaleChange}
      url={src}
    />
  );
}

function DocxViewerContent({
  autoFitWidth,
  className,
  controlledZoomScale,
  defaultZoom,
  effectiveIsDark,
  fileName,
  renderPageOverlay,
  setNightRenderEnabled,
  shouldRenderNightMode: _unused_shouldRenderNightMode,
  showDownload,
  showPanControl = false,
  showSelectionControl = false,
  panModeInitiallyEnabled = false,
  selectionModeInitiallyEnabled = true,
  showToolbar = true,
  showUpload,
  toolbarActions,
  onZoomScaleChange,
  url,
}: {
  autoFitWidth: boolean;
  className?: string;
  controlledZoomScale?: number;
  defaultZoom?: number;
  effectiveIsDark: boolean;
  fileName?: string;
  renderPageOverlay?: DocxPageOverlayRenderer;
  setNightRenderEnabled: (checked: boolean) => void;
  shouldRenderNightMode: boolean;
  showDownload: boolean;
  showPanControl?: boolean;
  showSelectionControl?: boolean;
  panModeInitiallyEnabled?: boolean;
  selectionModeInitiallyEnabled?: boolean;
  showToolbar?: boolean;
  showUpload: boolean;
  toolbarActions?: React.ReactNode;
  onZoomScaleChange?: (zoomScale: number) => void;
  url?: string;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [viewportElement, setViewportElement] =
    React.useState<HTMLDivElement | null>(null);
  const [viewerShellRef, viewerShellWidth] = useElementWidth<HTMLDivElement>();
  const [uploadedDocxFile, setUploadedDocxFile] =
    React.useState<UploadedDocxFile | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const activePageStore = React.useMemo(() => createDocxActivePageStore(), []);
  const resolvedDefaultZoomScale = normalizeDocxZoomScale(defaultZoom);
  const activeUploadedDocxFile =
    uploadedDocxFile?.sourceUrl === url ? uploadedDocxFile : null;
  const documentKey = activeUploadedDocxFile?.identity ?? url ?? "";
  const isMobile = useCompactViewport(767);
  const [manualZoomDocumentKey, setManualZoomDocumentKey] = React.useState<
    string | null
  >(null);
  const effectiveAutoFitWidth =
    autoFitWidth && !(isMobile && manualZoomDocumentKey === documentKey);
  React.useEffect(() => {
    if (
      manualZoomDocumentKey !== null &&
      (!isMobile || manualZoomDocumentKey !== documentKey)
    ) {
      setManualZoomDocumentKey(null);
    }
  }, [documentKey, isMobile, manualZoomDocumentKey]);
  const { setActivePage } = activePageStore;
  const sidebarInline = useInlineThumbnailSidebar(viewerShellWidth);
  const viewerBackgroundColor =
    "color-mix(in oklab, var(--muted) 70%, transparent)";
  const displayFileName = React.useMemo(
    () =>
      activeUploadedDocxFile?.file.name ??
      (url ? formatDocumentName(fileName, url) : (fileName ?? "document.docx")),
    [activeUploadedDocxFile?.file.name, fileName, url]
  );
  // The surrounding viewer follows the app theme; document colors are evidence.
  const initialDocumentTheme: DocxDocumentTheme = "light";
  const editorOptions = React.useMemo(
    () => ({
      initialDocumentTheme,
      initialFileName: displayFileName,
    }),
    [displayFileName, initialDocumentTheme]
  );
  const editor = useDocxEditor(editorOptions);
  const resolveParagraphAnchor = React.useMemo(
    () => createDocxParagraphAnchorResolver(editor.model),
    [editor.model]
  );
  const { layout: pageLayout } = useDocxPageLayout(editor);
  const { importDocxFile, setDocumentTheme, status } = editor;
  const { showComments, setShowComments } = useDocxComments(editor);
  const { showTrackedChanges, setShowTrackedChanges } =
    useDocxTrackChanges(editor);
  const [reportedPageCount, setReportedPageCount] = React.useState(0);
  const [zoomScaleState, setZoomScaleState] = React.useState({
    documentKey: "",
    value: resolvedDefaultZoomScale,
  });
  const zoomScaleStateRef = React.useRef(zoomScaleState);
  const zoomScaleRef = React.useRef(resolvedDefaultZoomScale);
  const internalZoomScale =
    zoomScaleState.documentKey === documentKey
      ? zoomScaleState.value
      : resolvedDefaultZoomScale;
  const zoomScale = controlledZoomScale ?? internalZoomScale;
  React.useEffect(() => {
    zoomScaleStateRef.current = zoomScaleState;
    zoomScaleRef.current = zoomScale;
  }, [zoomScale, zoomScaleState]);
  const setZoomScale = React.useCallback<
    React.Dispatch<React.SetStateAction<number>>
  >(
    (nextZoomScale) => {
      const currentZoomScale = zoomScaleRef.current;
      const value =
        typeof nextZoomScale === "function"
          ? nextZoomScale(currentZoomScale)
          : nextZoomScale;
      const currentState = zoomScaleStateRef.current;
      if (
        currentState.documentKey === documentKey &&
        currentState.value === value &&
        currentZoomScale === value
      ) {
        return;
      }

      const nextState = { documentKey, value };
      zoomScaleStateRef.current = nextState;
      zoomScaleRef.current = value;
      setZoomScaleState(nextState);
      onZoomScaleChange?.(value);
    },
    [documentKey, onZoomScaleChange]
  );
  const [loadError, setLoadError] = React.useState<string>();
  const [isLoadingDocument, setIsLoadingDocument] = React.useState(true);
  const [isPreparingDownload, setIsPreparingDownload] = React.useState(false);
  const shouldShowDocumentSpinner = useDelayedLoadingIndicator(
    isLoadingDocument,
    DOCX_LOADING_INDICATOR_DELAY_MS
  );
  const loadingState = React.useMemo(
    () => <ViewerLoadingSurface showSpinner={shouldShowDocumentSpinner} />,
    [shouldShowDocumentSpinner]
  );
  const documentTheme = effectiveIsDark ? "dark" : "light";
  const renderTrackedChangeCard = React.useMemo(
    () => createDocxTrackedChangeCardRenderer(documentTheme),
    [documentTheme]
  );
  const renderCommentCard = React.useMemo(
    () => createDocxCommentCardRenderer(documentTheme),
    [documentTheme]
  );
  const hasDocument = Boolean(url || activeUploadedDocxFile);
  const hasPageOverlay = Boolean(renderPageOverlay);
  const pageCount =
    hasDocument && !isLoadingDocument && !loadError
      ? Math.max(1, reportedPageCount || editor.totalPages)
      : 0;
  const [pageOverlayHosts, setPageOverlayHosts] = React.useState<HTMLElement[]>(
    []
  );
  const viewportPanRef = React.useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);
  const [isPanningViewport, setIsPanningViewport] = React.useState(false);
  const [panModeEnabled, setPanModeEnabled] = React.useState(
    panModeInitiallyEnabled
  );
  const [selectionModeEnabled, setSelectionModeEnabled] = React.useState(
    selectionModeInitiallyEnabled
  );
  const thumbnailSidebarVisible = Boolean(
    sidebarOpen && (pageCount || isLoadingDocument)
  );
  const fitContentWidth = getDocumentViewerContentWidth({
    shellWidth: viewerShellWidth,
    sidebarInline,
    sidebarVisible: thumbnailSidebarVisible,
    sidebarWidth: DOCX_THUMBNAIL_SIDEBAR_WIDTH,
  });
  const settledFitContentWidth = useSettledValue(
    fitContentWidth,
    DOCX_VIRTUALIZATION_ZOOM_SETTLE_MS
  );
  const visualZoomScale =
    effectiveAutoFitWidth &&
    !isLoadingDocument &&
    !loadError &&
    fitContentWidth > 0 &&
    pageLayout.pageWidthPx > 0
      ? Math.min(
          DOCX_MAX_FIT_ZOOM,
          Math.max(
            DOCX_MIN_FIT_ZOOM,
            (fitContentWidth / pageLayout.pageWidthPx) * 100
          )
        )
      : zoomScale;
  const documentLayoutWidth =
    effectiveAutoFitWidth && settledFitContentWidth > 0
      ? settledFitContentWidth
      : undefined;
  const documentCanvasWidth =
    pageLayout.pageWidthPx > 0
      ? getDocxDocumentCanvasWidth({
          minimumWidth: documentLayoutWidth ?? 0,
          pageWidth: pageLayout.pageWidthPx,
          zoomScale: visualZoomScale,
        })
      : documentLayoutWidth;
  const controlsDisabled =
    !hasDocument || isLoadingDocument || Boolean(loadError);
  const handlePageCountChange = React.useCallback((nextPageCount: number) => {
    setReportedPageCount(Math.max(1, Math.round(nextPageCount || 1)));
  }, []);
  const setViewportRef = React.useCallback((element: HTMLDivElement | null) => {
    viewportRef.current = element;
    setViewportElement(element);
  }, []);
  const handleViewportPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const viewport = event.currentTarget;
      if (
        event.button !== 0 ||
        !panModeEnabled ||
        isInteractiveViewerTarget(event.target) ||
        (viewport.scrollWidth <= viewport.clientWidth + 1 &&
          viewport.scrollHeight <= viewport.clientHeight + 1)
      ) {
        return;
      }

      event.preventDefault();
      viewport.setPointerCapture?.(event.pointerId);
      viewportPanRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startScrollLeft: viewport.scrollLeft,
        startScrollTop: viewport.scrollTop,
      };
      setIsPanningViewport(true);
    },
    [panModeEnabled]
  );
  const handleViewportPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const interaction = viewportPanRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const nextScroll = getDocxViewportPanScroll({
        currentClientX: event.clientX,
        currentClientY: event.clientY,
        startClientX: interaction.startClientX,
        startClientY: interaction.startClientY,
        startScrollLeft: interaction.startScrollLeft,
        startScrollTop: interaction.startScrollTop,
      });
      event.currentTarget.scrollLeft = nextScroll.left;
      event.currentTarget.scrollTop = nextScroll.top;
    },
    []
  );
  const handleViewportPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const interaction = viewportPanRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) {
        return;
      }

      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      viewportPanRef.current = null;
      setIsPanningViewport(false);
    },
    []
  );
  React.useEffect(() => {
    if (!hasPageOverlay || !pageCount || !viewportElement) {
      setPageOverlayHosts((currentHosts) =>
        currentHosts.length === 0 ? currentHosts : []
      );
      return;
    }

    let active = true;
    let frameId: number | null = null;
    const syncPageOverlayHosts = () => {
      if (!active) {
        return;
      }
      const hosts = [
        ...viewportElement.querySelectorAll<HTMLElement>(
          '[data-docx-page-wrapper="true"][data-index]'
        ),
      ].sort(
        (left, right) =>
          Number(left.dataset.index) - Number(right.dataset.index)
      );
      setPageOverlayHosts((currentHosts) =>
        currentHosts.length === hosts.length &&
        currentHosts.every((host, index) => host === hosts[index])
          ? currentHosts
          : hosts
      );
    };
    const scheduleSync = () => {
      if (!active || frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        syncPageOverlayHosts();
      });
    };

    syncPageOverlayHosts();
    scheduleSync();
    const observer = new MutationObserver((records) => {
      if (shouldSyncDocxPageOverlayHosts(records)) {
        scheduleSync();
      }
    });
    observer.observe(viewportElement, { childList: true, subtree: true });

    return () => {
      active = false;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      observer.disconnect();
    };
  }, [hasPageOverlay, pageCount, viewportElement]);
  const pageVirtualization = React.useMemo(
    () => ({
      enabled: true,
      overscan: 1,
      scrollElement: viewportElement,
      zoomScale: zoomScale / 100,
    }),
    [viewportElement, zoomScale]
  );
  const handleDownload = React.useCallback(async () => {
    if (isPreparingDownload) {
      return;
    }
    if (!activeUploadedDocxFile && !url) {
      return;
    }

    setIsPreparingDownload(true);

    try {
      await downloadDocxFile({
        file: activeUploadedDocxFile?.file,
        fileName: displayFileName,
        url,
      });
    } catch (error) {
      showErrorToast(error, "Could not download the document");
      console.error(error);
    } finally {
      setIsPreparingDownload(false);
    }
  }, [activeUploadedDocxFile, displayFileName, isPreparingDownload, url]);
  useSuppressDocxPaddingWarning(!isLoadingDocument && !loadError);

  React.useEffect(() => {
    if (
      !effectiveAutoFitWidth ||
      isLoadingDocument ||
      loadError ||
      settledFitContentWidth <= 0 ||
      pageLayout.pageWidthPx <= 0
    ) {
      return;
    }

    const nextZoomScale = Math.min(
      DOCX_MAX_FIT_ZOOM,
      Math.max(
        DOCX_MIN_FIT_ZOOM,
        (settledFitContentWidth / pageLayout.pageWidthPx) * 100
      )
    );

    setZoomScale((currentZoomScale) =>
      Math.abs(currentZoomScale - nextZoomScale) < 0.25
        ? currentZoomScale
        : nextZoomScale
    );
  }, [
    effectiveAutoFitWidth,
    isLoadingDocument,
    loadError,
    pageLayout.pageWidthPx,
    setZoomScale,
    settledFitContentWidth,
  ]);

  React.useEffect(() => {
    setActivePage(1);
    viewportRef.current?.scrollTo({ top: 0, left: 0 });
  }, [documentKey, setActivePage]);

  React.useEffect(() => {
    setDocumentTheme("light");
  }, [setDocumentTheme]);

  React.useEffect(() => {
    if (
      status.startsWith("Failed to load file") ||
      status === "Only .docx files are supported"
    ) {
      const frame = window.requestAnimationFrame(() => {
        setLoadError(status);
        setIsLoadingDocument(false);
      });

      return () => window.cancelAnimationFrame(frame);
    }
  }, [status]);

  // Imports mutate the shared editor instance; concurrent calls (effect
  // Re-runs, StrictMode double-invoke) race inside the parser and surface as
  // Bogus "Invalid DOCX ZIP" errors, so every import is chained through here.
  const importQueueRef = React.useRef<Promise<void>>(Promise.resolve());

  React.useEffect(() => {
    let isCurrent = true;

    async function load() {
      // Superseded while queued — let the newest import run instead.
      if (!isCurrent) {
        return;
      }
      if (!activeUploadedDocxFile && !url) {
        setIsLoadingDocument(false);
        setLoadError(undefined);
        setReportedPageCount(0);
        return;
      }

      setIsLoadingDocument(true);
      setLoadError(undefined);
      setReportedPageCount(0);

      try {
        const docxFile =
          activeUploadedDocxFile?.file ??
          (url ? await loadDocxFile(url, displayFileName) : null);
        if (!docxFile) {
          return;
        }
        await importDocxFile(docxFile);

        if (isCurrent) {
          setIsLoadingDocument(false);
          setActivePage(1);
          viewportRef.current?.scrollTo({ top: 0, left: 0 });
        }
      } catch (error) {
        if (isCurrent) {
          showErrorToast(error, "Could not load the document");
          setLoadError("Could not load the document.");
          setIsLoadingDocument(false);
        }
      }
    }

    importQueueRef.current = importQueueRef.current.then(load);

    return () => {
      isCurrent = false;
    };
  }, [
    activeUploadedDocxFile,
    displayFileName,
    importDocxFile,
    setActivePage,
    url,
  ]);

  const updateActivePageFromViewport = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !pageCount) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const viewportCenter = viewportRect.top + viewportRect.height / 2;
    let closestPage = 1;
    let closestDistance = Number.POSITIVE_INFINITY;

    viewport
      .querySelectorAll<HTMLElement>(
        '[data-docx-page-wrapper="true"][data-index]'
      )
      .forEach((page) => {
        const pageIndex = Number(page.dataset.index);
        if (!Number.isFinite(pageIndex)) {
          return;
        }

        const pageRect = page.getBoundingClientRect();
        const pageCenter = pageRect.top + pageRect.height / 2;
        const distance = Math.abs(pageCenter - viewportCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = pageIndex + 1;
        }
      });

    activePageStore.setActivePage((currentPage) =>
      currentPage === closestPage ? currentPage : closestPage
    );
  }, [activePageStore, pageCount]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !pageCount) {
      return;
    }

    let frameId = 0;
    const handleScroll = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateActivePageFromViewport);
    };

    frameId = window.requestAnimationFrame(updateActivePageFromViewport);
    viewport.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      viewport.removeEventListener("scroll", handleScroll);
    };
  }, [pageCount, updateActivePageFromViewport]);

  const scrollToPage = React.useCallback(
    (pageNumber: number) => {
      const viewport = viewportRef.current;
      const targetPageIndex = pageNumber - 1;
      const page = viewport?.querySelector<HTMLElement>(
        `[data-docx-page-wrapper="true"][data-index="${targetPageIndex}"]`
      );

      setActivePage(pageNumber);

      if (!viewport) {
        return;
      }

      if (!page) {
        const pageStridePx =
          (pageLayout.pageHeightPx + pageLayout.viewportDefaults.pageGapPx) *
          (zoomScale / 100);

        viewport.scrollTo({
          top: Math.max(0, targetPageIndex * pageStridePx - 24),
          behavior: "auto",
        });
        return;
      }

      viewport.scrollTo({
        top:
          page.getBoundingClientRect().top -
          viewport.getBoundingClientRect().top +
          viewport.scrollTop -
          24,
        behavior: "auto",
      });
    },
    [
      pageLayout.pageHeightPx,
      pageLayout.viewportDefaults.pageGapPx,
      setActivePage,
      zoomScale,
    ]
  );
  const searchDocument = React.useCallback(
    (query: string) => findDocxSearchResults(editor, query),
    [editor]
  );
  const activateDocumentSearchResult = React.useCallback(
    (result: DocxSearchResult) => {
      const estimatedPage = Math.min(
        pageCount,
        Math.max(
          1,
          Math.ceil(
            ((result.nodeIndex + 1) / editor.model.nodes.length) * pageCount
          )
        )
      );
      scrollToPage(estimatedPage);
      window.requestAnimationFrame(() => {
        const target = viewportRef.current?.querySelector<HTMLElement>(
          `[data-docx-paragraph-node-index="${result.nodeIndex}"]`
        );

        target?.scrollIntoView({ block: "center" });
        if (target) {
          highlightDocumentSearchText(target, result.start, result.end);
        }
      });
    },
    [editor, pageCount, scrollToPage]
  );

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    await Promise.resolve();
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setZoomScale(resolvedDefaultZoomScale);
    setActivePage(1);
    setReportedPageCount(0);
    setUploadedDocxFile({
      file,
      identity: `${file.name}-${file.size}-${file.lastModified}`,
      sourceUrl: url,
    });
  }

  return (
    <div
      className={cn(
        "flex h-[640px] min-h-0 flex-col overflow-hidden bg-background",
        className
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleUpload}
      />
      {showToolbar ? (
        <DocxToolbar
          key={documentKey}
          activePageStore={activePageStore}
          controlsDisabled={controlsDisabled}
          fileName={displayFileName}
          isDark={effectiveIsDark}
          isPreparingDownload={isPreparingDownload}
          onDownload={handleDownload}
          onIsDarkChange={setNightRenderEnabled}
          onFitWidth={
            autoFitWidth ? () => setManualZoomDocumentKey(null) : undefined
          }
          onPageChange={scrollToPage}
          onShowCommentsChange={setShowComments}
          onShowTrackedChangesChange={setShowTrackedChanges}
          onTogglePan={() => {
            setPanModeEnabled((enabled) => !enabled);
            setSelectionModeEnabled(false);
          }}
          onToggleSelection={() => {
            setSelectionModeEnabled((enabled) => !enabled);
            setPanModeEnabled(false);
          }}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          onUploadClick={() => fileInputRef.current?.click()}
          searchControl={
            <DocumentTextSearchPopover
              controlsDisabled={controlsDisabled}
              mobilePresentation={isMobile ? "sheet" : "popover"}
              onClear={clearDocumentSearchHighlight}
              onNavigate={activateDocumentSearchResult}
              onSearch={searchDocument}
            />
          }
          pageCount={pageCount}
          panModeEnabled={panModeEnabled}
          selectionModeEnabled={selectionModeEnabled}
          setZoomScale={
            isMobile
              ? (value) => {
                  setManualZoomDocumentKey(documentKey);
                  setZoomScale(value);
                }
              : setZoomScale
          }
          showComments={showComments}
          showDownloadButton={showDownload}
          showNightRenderToggle={false}
          showPanControl={showPanControl}
          showSelectionControl={showSelectionControl}
          showTrackedChanges={showTrackedChanges}
          showUploadButton={showUpload}
          toolbarActions={toolbarActions}
          zoomScale={visualZoomScale}
          mobileZoomMode={effectiveAutoFitWidth ? "width" : "manual"}
        />
      ) : null}
      <div
        ref={viewerShellRef}
        className={cn(
          "relative flex min-h-0 flex-1 overflow-hidden [container-type:inline-size]",
          PAGED_DOCUMENT_PREVIEW_CANVAS_CLASS_NAME
        )}
      >
        <DocumentViewerThumbnailSidebar
          inline={sidebarInline}
          open={thumbnailSidebarVisible}
        >
          <DocxThumbnailSidebarContent
            activePageStore={activePageStore}
            displayFileName={displayFileName}
            editor={editor}
            isLoadingDocument={isLoadingDocument}
            onSelectPage={scrollToPage}
            pageCount={pageCount}
            reportedPageCount={reportedPageCount}
            sidebarOpen={thumbnailSidebarVisible}
          />
        </DocumentViewerThumbnailSidebar>
        <ScrollArea
          className={cn(
            "min-h-0 flex-1 [&_[data-docx-page-surface=true]]:ring-1 [&_[data-docx-page-surface=true]]:ring-border/60 [&_[data-docx-page-surface=true]]:shadow-sm",
            PAGED_DOCUMENT_PREVIEW_CANVAS_CLASS_NAME
          )}
          style={{ backgroundColor: viewerBackgroundColor }}
          viewportClassName="px-[clamp(8px,3cqw,32px)] py-[clamp(12px,3cqw,24px)]"
          viewportProps={{
            "aria-label": "DOCX document",
            className: cn(
              panModeEnabled && "cursor-grab select-none",
              isPanningViewport && "cursor-grabbing"
            ),
            onMouseDown: (event) => {
              if (isInteractiveViewerTarget(event.target)) {
                return;
              }
              event.currentTarget.focus({ preventScroll: true });
            },
            onPointerCancel: handleViewportPointerUp,
            onPointerDown: handleViewportPointerDown,
            onPointerMove: handleViewportPointerMove,
            onPointerUp: handleViewportPointerUp,
            tabIndex: 0,
          }}
          viewportRef={setViewportRef}
        >
          {!url && !activeUploadedDocxFile ? (
            <div className="grid h-full min-h-96 place-items-center p-6 text-center">
              <div className="max-w-md rounded-lg border bg-background p-4 text-sm shadow-xs">
                <div className="font-medium">
                  Upload a Word document to preview
                </div>
                <div className="mt-1 text-muted-foreground">
                  Pass a DOCX URL with the <code>src</code> prop or upload a
                  file.
                </div>
                <div className="mt-1 text-muted-foreground">
                  Legacy <code>.doc</code> support is limited and experimental;
                  convert to DOCX for best fidelity.
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <HugeiconsIcon icon={Upload01Icon} className="size-4" />
                  Upload Word document
                </Button>
              </div>
            </div>
          ) : loadError ? (
            <div className="grid h-full min-h-96 place-items-center p-6 text-center" />
          ) : isLoadingDocument ? (
            loadingState
          ) : (
            <div
              className="flex min-h-full min-w-full justify-center"
              style={{ minWidth: documentCanvasWidth }}
            >
              <div
                className="shrink-0 [contain:layout_style]"
                style={{ width: documentLayoutWidth }}
              >
                <div
                  className="origin-top will-change-transform"
                  style={{
                    transform: `scale(${visualZoomScale / zoomScale})`,
                    zoom: zoomScale / 100,
                  }}
                >
                  <MemoizedDocxEditorViewer
                    editor={editor}
                    mode="read-only"
                    showTrackedChanges={showTrackedChanges}
                    renderTrackedChangeCard={renderTrackedChangeCard}
                    showComments={showComments}
                    renderCommentCard={renderCommentCard}
                    loadingState={loadingState}
                    pageBackgroundColor="#ffffff"
                    pageGapBackgroundColor={viewerBackgroundColor}
                    pageVirtualization={pageVirtualization}
                    deferInitialPaginationPaint={false}
                    onPageCountChange={handlePageCountChange}
                  />
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
      {renderPageOverlay
        ? pageOverlayHosts.map((pageElement) => {
            const pageIndex = Number(pageElement.dataset.index);
            const pageSurfaceElement = pageElement.querySelector<HTMLElement>(
              '[data-docx-page-surface="true"]'
            );

            return createPortal(
              renderPageOverlay({
                pageElement,
                pageHeight: pageLayout.pageHeightPx,
                pageNumber: pageIndex + 1,
                pageSurfaceElement,
                pageWidth: pageLayout.pageWidthPx,
                resolveParagraphAnchor,
                selectionModeEnabled,
                rotation: 0,
                scale: visualZoomScale / 100,
              }),
              getDocxPageOverlayHost(pageElement, pageSurfaceElement),
              `docx-page-overlay-${pageIndex}`
            );
          })
        : null}
    </div>
  );
}
