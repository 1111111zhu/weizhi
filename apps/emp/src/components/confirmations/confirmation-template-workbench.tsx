import {
  CONFIRMATION_TEMPLATE_FONT_SIZES,
  DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE,
  DEFAULT_CONFIRMATION_TEMPLATE_HIGHLIGHT_COLOR,
} from "@project-wing/shared";
import type {
  ConfirmationTemplateFontFamily,
  ConfirmationTemplateFontSize,
  ConfirmationTemplateLayoutText,
  ConfirmationTemplateTextStyle,
} from "@project-wing/shared";
import { ColorInput, DEFAULT_COLOR_INPUT_VALUE } from "@project-wing/ui";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Baseline,
  Bold,
  CalendarDays,
  CircleCheckBig,
  Check,
  ChevronDown,
  CircleDot,
  ClipboardPaste,
  Copy,
  Eye,
  Hand,
  Hash,
  Highlighter,
  Italic,
  MousePointer2,
  Maximize2,
  Paintbrush,
  Plus,
  Redo2,
  Ruler,
  Save,
  Scissors,
  Trash2,
  Type,
  TextQuote,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import { DocxViewerPreview } from "@/components/extend/docx-viewer";
import type { DocxParagraphAnchorResolver } from "@/components/extend/docx-viewer";
import { PDFViewer } from "@/components/extend/pdf-viewer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type {
  ConfirmationTemplateDesign,
  ConfirmationGeneralLayout,
  ConfirmationTemplateDesignField,
  ConfirmationTemplateDesignFieldBinding,
  ConfirmationTemplateDesignFieldSourceRange,
  ConfirmationTemplateLibraryFile,
} from "../../api/client";
import {
  CONFIRMATION_BASE_INFORMATION_BINDINGS,
  CONFIRMATION_INFORMATION_LIBRARY_BINDINGS,
} from "./confirmation-template-binding-options";
import {
  changeConfirmationTemplateFieldKind,
  EDITABLE_CONFIRMATION_FIELD_KINDS,
} from "./confirmation-template-field-kind";
import {
  getConfirmationTemplateFieldTextStyleCss,
  getConfirmationTemplateFlexAlignmentCss,
} from "./confirmation-template-field-style";

import inspectorStyles from "./confirmation-template-workbench.module.css";

type WorkbenchTool = ConfirmationTemplateDesignField["kind"];
type SaveStatus = "DRAFT" | "ENABLED";
type WorkbenchDesignStatus = SaveStatus | "DISABLED";
type FieldInteractionMode = "move" | "resize";
type ResizeAxis = "x" | "y";
type ResizeIntent = "both" | ResizeAxis;
type ResizeEdges = Readonly<{
  bottom: boolean;
  left: boolean;
  right: boolean;
  top: boolean;
}>;

type FieldInteraction = {
  pointerId?: number;
  fieldIds: string[];
  fieldId: string;
  mode: FieldInteractionMode;
  pointerOffset: { x: number; y: number };
  pageElement: HTMLElement;
  pageHeight: number;
  pageRect: Pick<DOMRect, "height" | "left" | "top" | "width">;
  pageWidth: number;
  resizeEdges: ResizeEdges;
  resizeIntent: ResizeIntent | null;
  hasActivated: boolean;
  startClientX: number;
  startClientY: number;
  startField: ConfirmationTemplateDesignField;
  startFields: ConfirmationTemplateDesignField[];
};

type PointerCoordinates = Pick<PointerEvent, "clientX" | "clientY"> & {
  pointerId?: number;
};

type FieldInteractionStartEvent = {
  button?: number;
  buttons?: number;
  clientX: number;
  clientY: number;
  currentTarget?: {
    releasePointerCapture?: (pointerId: number) => void;
    setPointerCapture?: (pointerId: number) => void;
  };
  pointerId?: number;
  preventDefault: () => void;
  stopPropagation: () => void;
};

type FieldDrawing = {
  pageElement: HTMLElement;
  pageHeight: number;
  pageNumber: number;
  pageRect: Pick<DOMRect, "height" | "left" | "top" | "width">;
  pageSurfaceElement: HTMLElement | null;
  pageWidth: number;
  pointerId: number;
  resolveParagraphAnchor: DocxParagraphAnchorResolver;
  startX: number;
  startY: number;
  tool: WorkbenchTool;
};

type FieldSelection = {
  pageElement: HTMLElement;
  pageHeight: number;
  pageNumber: number;
  pageRect: Pick<DOMRect, "height" | "left" | "top" | "width">;
  pageWidth: number;
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type NormalizedFieldRect = Pick<
  ConfirmationTemplateDesignField,
  "height" | "width" | "x" | "y"
>;

export type AlignmentGuide = {
  axis: "horizontal" | "vertical";
  position: number;
};

type AxisSnapCandidate = {
  distance: number;
  guidePositions: number[];
  value: number;
};

type FieldSnapMode = "move" | "resize";
type WorkbenchInteractionMode = "select" | "pan";
const TEMPLATE_FIELD_BINDINGS = CONFIRMATION_BASE_INFORMATION_BINDINGS;
const INFORMATION_LIBRARY_FIELD_BINDINGS =
  CONFIRMATION_INFORMATION_LIBRARY_BINDINGS;

const FORCE_DOWN_SELECT_COLLISION_AVOIDANCE = {
  align: "shift" as const,
  fallbackAxisSide: "none" as const,
  side: "flip" as const,
};
const RESIZE_HANDLE_SIZE = 0.018;
const RESIZE_HANDLE_INSIDE = 0.003;
const FIELD_MOVE_TARGET_INSET = RESIZE_HANDLE_INSIDE;
const FIELD_PASTE_OFFSET = 0.02;
const WORKBENCH_TEMPLATE_FONT_FAMILIES = [
  "Arial",
  "Noto Sans SC",
  "Noto Sans",
  "Liberation Sans",
  "Liberation Serif",
] as const satisfies readonly ConfirmationTemplateFontFamily[];

export type ConfirmationTemplateWorkbenchCopy = {
  back: string;
  discardChanges: string;
  draft: string;
  disabled: string;
  enabled: string;
  enable: string;
  fieldSettings: {
    mixed?: string;
    addOption: string;
    binding: string;
    bindingNone: string;
    bindings: Record<ConfirmationTemplateDesignFieldBinding, string>;
    informationLibraryBinding: string;
    deleteField: string;
    checkboxBehavior: string;
    checkboxBehaviorDescription: string;
    copyField: string;
    defaultChecked: string;
    defaultCheckedDescription: string;
    defaultFill: string;
    defaultFillBaseInformation: string;
    defaultFillCustom: string;
    defaultFillCustomValue: string;
    defaultFillCurrentDate: string;
    defaultFillDescription: string;
    defaultFillInformationLibrary: string;
    defaultFillNone: string;
    initialValue: string;
    initialValueCustom: string;
    initialValueCustomValue: string;
    initialValueCurrentDate: string;
    initialValueDescription: string;
    initialValueNone: string;
    pasteField: string;
    deleteOption: string;
    empty: string;
    backgroundColor: string;
    bold: string;
    formattingToolbar?: string;
    fontSizeDecrease?: string;
    fontSizeIncrease?: string;
    fontFamily: string;
    fontFamilyOptions: Record<string, string>;
    fontSize: string;
    fontSizeOptions: Record<string, string>;
    italic: string;
    kind: string;
    name: string;
    option: string;
    options: string;
    placeholder: string;
    preview: string;
    required: string;
    requiredDescription: string;
    staticTextContent: string;
    title: string;
    textColor: string;
    underline: string;
  };
  loading: string;
  loadError: string;
  preview: string;
  previewFill: string;
  readOnly: string;
  returnToEdit: string;
  saveDraft: string;
  saveError: string;
  saving: string;
  keepEditing: string;
  unsavedChangesDescription: string;
  unsavedChangesTitle: string;
  sidebarTabs: {
    actions: string;
    insert: string;
    field: string;
    style: string;
    canvas: string;
  };
  tools: {
    alignmentTitle: string;
    checkbox: string;
    clearSelection: string;
    clipboardTitle: string;
    cut: string;
    date: string;
    formatPainter: string;
    fontTitle: string;
    historyTitle: string;
    insertTitle: string;
    mask: string;
    multiline: string;
    number: string;
    operationsTitle: string;
    pageTitle: string;
    panMode?: string;
    fitWidth: string;
    radio: string;
    redo: string;
    selectMode?: string;
    select: string;
    showRuler: string;
    staticText: string;
    text: string;
    title: string;
    undo: string;
  };
  defaults: {
    checkboxName: string;
    dateName: string;
    maskName: string;
    multilineName: string;
    numberName: string;
    option: string;
    radioName: string;
    selectName: string;
    staticTextName: string;
    textName: string;
  };
  validation: {
    defaultValueType: string;
    nameRequired: string;
    optionRequired: string;
    optionUnique: string;
    placeholderRequired: string;
  };
};

export type ConfirmationTemplateWorkbenchProps = {
  customFields?: { id: string; name: string; value: string }[];
  generalLayout?: ConfirmationGeneralLayout;

  copy: ConfirmationTemplateWorkbenchCopy;
  loadFile: () => Promise<Blob>;
  onBack: () => void;
  onSave: (input: {
    designSchema: ConfirmationTemplateDesign;
    designStatus: SaveStatus;
  }) => Promise<void>;
  template: ConfirmationTemplateLibraryFile;
};

const FIELD_DIMENSIONS: Record<
  WorkbenchTool,
  { height: number; width: number }
> = {
  CHECKBOX: { height: 0.032, width: 0.18 },
  DATE: { height: 0.032, width: 0.18 },
  MASK: { height: 0.05, width: 0.24 },
  MULTILINE: { height: 0.08, width: 0.28 },
  NUMBER: { height: 0.032, width: 0.18 },
  RADIO: { height: 0.06, width: 0.28 },
  SELECT: { height: 0.032, width: 0.18 },
  STATIC_TEXT: { height: 0.04, width: 0.3 },
  TEXT: { height: 0.032, width: 0.18 },
};
const MIN_FIELD_HEIGHT = 0.012;
const MIN_FIELD_WIDTH = 0.04;
const DRAW_THRESHOLD = 0.004;
const FIELD_POINTER_ACTIVATION_THRESHOLD_PX = 4;
const FIELD_SNAP_THRESHOLD = 0.012;
const FIELD_SNAP_DISTANCE_PX = 5;
const RESIZE_AXIS_LOCK_RATIO = 2;
const EQUAL_GAP_SNAP_THRESHOLD = 0.012;
const EMPTY_DOCX_PARAGRAPH_ANCHOR_RESOLVER: DocxParagraphAnchorResolver = () =>
  Promise.resolve(null);

async function detectPreviewMimeType(blob: Blob) {
  if (blob.type) {
    return blob.type;
  }
  const fragment = blob.slice(0, 5);
  const header =
    typeof fragment.text === "function"
      ? await fragment.text().catch(() => "")
      : await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.addEventListener(
            "load",
            () => resolve(String(reader.result ?? "")),
            { once: true }
          );
          reader.addEventListener("error", () => resolve(""), { once: true });
          // Compatibility fallback for Blob implementations without text(), including embedded previews.
          // eslint-disable-next-line unicorn/prefer-blob-reading-methods
          reader.readAsText(fragment);
        });
  return header === "%PDF-" ? "application/pdf" : null;
}

function getFieldTextStyle(
  textStyle: ConfirmationTemplateTextStyle | undefined
): ConfirmationTemplateTextStyle {
  return { ...DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE, ...textStyle };
}

function getFontSize(value: string): ConfirmationTemplateFontSize {
  const parsed = Number(value) as ConfirmationTemplateFontSize;
  return CONFIRMATION_TEMPLATE_FONT_SIZES.includes(parsed)
    ? parsed
    : DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE.fontSize;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getAxisStart(field: NormalizedFieldRect, axis: "x" | "y") {
  return axis === "x" ? field.x : field.y;
}

function getAxisSize(field: NormalizedFieldRect, axis: "x" | "y") {
  return axis === "x" ? field.width : field.height;
}

function getResizeIntent(
  deltaX: number,
  deltaY: number,
  threshold = DRAW_THRESHOLD
): ResizeIntent | null {
  const absoluteDeltaX = Math.abs(deltaX);
  const absoluteDeltaY = Math.abs(deltaY);
  if (Math.max(absoluteDeltaX, absoluteDeltaY) < threshold) {
    return null;
  }
  if (absoluteDeltaX >= absoluteDeltaY * RESIZE_AXIS_LOCK_RATIO) {
    return "x";
  }
  if (absoluteDeltaY >= absoluteDeltaX * RESIZE_AXIS_LOCK_RATIO) {
    return "y";
  }
  return "both";
}

function getAxisSnapCandidates(
  field: NormalizedFieldRect,
  peers: readonly NormalizedFieldRect[],
  axis: "x" | "y",
  mode: FieldSnapMode
) {
  const start = getAxisStart(field, axis);
  const size = getAxisSize(field, axis);
  const minimum = axis === "x" ? MIN_FIELD_WIDTH : MIN_FIELD_HEIGHT;
  const candidates: AxisSnapCandidate[] = [];

  for (const peer of peers) {
    const peerStart = getAxisStart(peer, axis);
    const peerSize = getAxisSize(peer, axis);
    const peerAnchors = [
      peerStart,
      peerStart + peerSize / 2,
      peerStart + peerSize,
    ];

    if (mode === "move") {
      for (const offset of [0, size / 2, size]) {
        for (const peerAnchor of peerAnchors) {
          const value = peerAnchor - offset;
          if (value < 0 || value + size > 1) {
            continue;
          }
          candidates.push({
            distance: Math.abs(start - value),
            guidePositions: [peerAnchor],
            value,
          });
        }
      }
      continue;
    }

    const currentEnd = start + size;
    for (const peerAnchor of peerAnchors) {
      const nextSize = peerAnchor - start;
      if (nextSize < minimum || start + nextSize > 1) {
        continue;
      }
      candidates.push({
        distance: Math.abs(currentEnd - peerAnchor),
        guidePositions: [peerAnchor],
        value: nextSize,
      });
    }
  }

  return candidates;
}

function getEqualGapSnapCandidates(
  field: NormalizedFieldRect,
  peers: readonly NormalizedFieldRect[],
  axis: "x" | "y"
) {
  const start = getAxisStart(field, axis);
  const size = getAxisSize(field, axis);
  const candidates: AxisSnapCandidate[] = [];
  const crossAxis = axis === "x" ? "y" : "x";
  const crossStart = getAxisStart(field, crossAxis);
  const crossEnd = crossStart + getAxisSize(field, crossAxis);
  const nearbyPeers = peers.filter((peer) => {
    const peerStart = getAxisStart(peer, crossAxis);
    const peerEnd = peerStart + getAxisSize(peer, crossAxis);
    return (
      peerStart <= crossEnd + FIELD_SNAP_THRESHOLD &&
      peerEnd >= crossStart - FIELD_SNAP_THRESHOLD
    );
  });
  const orderedPeers = nearbyPeers.sort(
    (left, right) => getAxisStart(left, axis) - getAxisStart(right, axis)
  );
  const leftPeers = orderedPeers
    .filter(
      (peer) =>
        getAxisStart(peer, axis) + getAxisSize(peer, axis) <=
        start + FIELD_SNAP_THRESHOLD
    )
    .slice(-3);
  const rightPeers = orderedPeers
    .filter(
      (peer) => getAxisStart(peer, axis) >= start + size - FIELD_SNAP_THRESHOLD
    )
    .slice(0, 3);

  for (const leftPeer of leftPeers) {
    const leftEnd = getAxisStart(leftPeer, axis) + getAxisSize(leftPeer, axis);
    for (const rightPeer of rightPeers) {
      const rightStart = getAxisStart(rightPeer, axis);
      const gap = rightStart - leftEnd - size;
      if (gap < 0) {
        continue;
      }

      const value = leftEnd + gap / 2;
      if (
        Math.abs(start - value) > EQUAL_GAP_SNAP_THRESHOLD ||
        value + size > 1
      ) {
        continue;
      }
      candidates.push({
        distance: Math.abs(start - value),
        guidePositions: [value, value + size],
        value,
      });
    }
  }

  return candidates;
}

function pickAxisSnap(
  field: NormalizedFieldRect,
  peers: readonly NormalizedFieldRect[],
  axis: "x" | "y",
  mode: FieldSnapMode,
  threshold = FIELD_SNAP_THRESHOLD
) {
  const candidates = [
    ...getAxisSnapCandidates(field, peers, axis, mode),
    ...(mode === "move" ? getEqualGapSnapCandidates(field, peers, axis) : []),
  ].sort((left, right) => left.distance - right.distance);
  const [best] = candidates;
  return best && best.distance <= threshold ? best : null;
}

export function snapFieldGeometry(
  field: NormalizedFieldRect,
  peers: readonly NormalizedFieldRect[],
  mode: FieldSnapMode,
  resizeAxes: readonly ResizeAxis[] = ["x", "y"],
  thresholds?: { x: number; y: number }
) {
  const nextField = { ...field };
  const guides: AlignmentGuide[] = [];
  const xSnap =
    mode === "move" || resizeAxes.includes("x")
      ? pickAxisSnap(
          nextField,
          peers,
          "x",
          mode,
          thresholds?.x ?? FIELD_SNAP_THRESHOLD
        )
      : null;
  if (xSnap) {
    if (mode === "move") {
      nextField.x = xSnap.value;
    } else {
      nextField.width = xSnap.value;
    }
    guides.push(
      ...xSnap.guidePositions.map((position) => ({
        axis: "vertical" as const,
        position,
      }))
    );
  }

  const ySnap =
    mode === "move" || resizeAxes.includes("y")
      ? pickAxisSnap(
          nextField,
          peers,
          "y",
          mode,
          thresholds?.y ?? FIELD_SNAP_THRESHOLD
        )
      : null;
  if (ySnap) {
    if (mode === "move") {
      nextField.y = ySnap.value;
    } else {
      nextField.height = ySnap.value;
    }
    guides.push(
      ...ySnap.guidePositions.map((position) => ({
        axis: "horizontal" as const,
        position,
      }))
    );
  }

  return {
    ...nextField,
    guides: guides.filter(
      (guide, index) =>
        guides.findIndex(
          (candidate) =>
            candidate.axis === guide.axis &&
            Math.abs(candidate.position - guide.position) < 1e-6
        ) === index
    ),
  };
}

function pointerToPagePoint(
  clientX: number,
  clientY: number,
  pageRect: Pick<DOMRect, "height" | "left" | "top" | "width">,
  pageWidth: number,
  pageHeight: number
) {
  const measuredWidth = pageRect.width || pageWidth;
  const measuredHeight = pageRect.height || pageHeight;
  return {
    x: clamp((clientX - pageRect.left) / measuredWidth, 0, 1),
    y: clamp((clientY - pageRect.top) / measuredHeight, 0, 1),
  };
}

function normalizeDrawnRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): NormalizedFieldRect | null {
  const rawX = Math.min(startX, endX);
  const rawY = Math.min(startY, endY);
  const rawWidth = Math.abs(endX - startX);
  const rawHeight = Math.abs(endY - startY);
  if (rawWidth < DRAW_THRESHOLD && rawHeight < DRAW_THRESHOLD) {
    return null;
  }

  const width = Math.max(MIN_FIELD_WIDTH, rawWidth);
  const height = Math.max(MIN_FIELD_HEIGHT, rawHeight);
  return {
    height,
    width,
    x: clamp(rawX, 0, 1 - width),
    y: clamp(rawY, 0, 1 - height),
  };
}

function getTemplateFieldBinding(
  value: unknown
): ConfirmationTemplateDesignFieldBinding | undefined {
  return (typeof value === "string" &&
    (
      [
        ...TEMPLATE_FIELD_BINDINGS,
        ...INFORMATION_LIBRARY_FIELD_BINDINGS,
      ] as readonly string[]
    ).includes(value)) ||
    (typeof value === "string" && /^custom:[a-zA-Z0-9-]{1,80}$/.test(value))
    ? (value as ConfirmationTemplateDesignFieldBinding)
    : undefined;
}

function getLegacyFieldBinding(
  value: unknown,
  source: "BASE_INFORMATION" | "INFORMATION_LIBRARY"
): ConfirmationTemplateDesignFieldBinding | undefined {
  const bindings =
    source === "BASE_INFORMATION"
      ? TEMPLATE_FIELD_BINDINGS
      : INFORMATION_LIBRARY_FIELD_BINDINGS;
  return typeof value === "string" &&
    ((bindings as readonly string[]).includes(value) ||
      (source === "BASE_INFORMATION" &&
        /^custom:[a-zA-Z0-9-]{1,80}$/.test(value)))
    ? (value as ConfirmationTemplateDesignFieldBinding)
    : undefined;
}

function getSourceRanges(
  value: unknown
): ConfirmationTemplateDesignFieldSourceRange[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((range) => {
    if (!range || typeof range !== "object") {
      return [];
    }
    const {
      end,
      paragraphId,
      paragraphOrdinal,
      paragraphXmlSha256,
      part,
      sourceText,
      start,
    } = range as Record<string, unknown>;
    const expectedKeys =
      paragraphId === undefined
        ? [
            "part",
            "paragraphOrdinal",
            "paragraphXmlSha256",
            "sourceText",
            "start",
            "end",
          ]
        : [
            "part",
            "paragraphOrdinal",
            "paragraphId",
            "paragraphXmlSha256",
            "sourceText",
            "start",
            "end",
          ];
    if (
      Object.keys(range).length !== expectedKeys.length ||
      !expectedKeys.every((key) => Object.hasOwn(range, key)) ||
      part !== "word/document.xml" ||
      typeof paragraphOrdinal !== "number" ||
      !Number.isSafeInteger(paragraphOrdinal) ||
      paragraphOrdinal < 0 ||
      (paragraphId !== undefined &&
        (typeof paragraphId !== "string" || !paragraphId.trim())) ||
      typeof paragraphXmlSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(paragraphXmlSha256) ||
      typeof sourceText !== "string" ||
      typeof start !== "number" ||
      typeof end !== "number" ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end <= start ||
      !sourceText ||
      end - start !== sourceText.length
    ) {
      return [];
    }
    return [
      {
        end,
        ...(typeof paragraphId === "string" ? { paragraphId } : {}),
        paragraphOrdinal,
        paragraphXmlSha256,
        part: "word/document.xml" as const,
        sourceText,
        start,
      },
    ];
  });
}

type ClientRect = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

type SourceRangeResolution = {
  hasUnresolvedSourceText: boolean;
  sourceRanges: ConfirmationTemplateDesignFieldSourceRange[];
};

function intersects(rect: ClientRect, selection: ClientRect) {
  return (
    rect.left < selection.right &&
    rect.right > selection.left &&
    rect.top < selection.bottom &&
    rect.bottom > selection.top
  );
}

function hasSelectedTextOutsideParagraphs(
  document: Document,
  pageSurfaceElement: HTMLElement,
  paragraphs: HTMLElement[],
  selection: ClientRect
) {
  const walker = document.createTreeWalker(
    pageSurfaceElement,
    NodeFilter.SHOW_TEXT
  );
  let node = walker.nextNode();

  while (node) {
    const textNode = node as Text;
    const isNumberingLabel = Boolean(
      textNode.parentElement?.closest('[data-docx-numbering-label="true"]')
    );
    for (let index = 0; index < textNode.data.length; index += 1) {
      const range = document.createRange();
      range.setStart(textNode, index);
      range.setEnd(textNode, index + 1);
      const rect = range.getBoundingClientRect();
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        intersects(rect, selection) &&
        (isNumberingLabel ||
          !paragraphs.some((paragraph) => paragraph.contains(textNode)))
      ) {
        return true;
      }
    }
    node = walker.nextNode();
  }

  return false;
}

function getSourceRangesAtSelection(
  pageSurfaceElement: HTMLElement | null,
  resolveParagraphAnchor: DocxParagraphAnchorResolver,
  selection: ClientRect
): SourceRangeResolution | Promise<SourceRangeResolution> {
  if (!pageSurfaceElement) {
    return { hasUnresolvedSourceText: true, sourceRanges: [] };
  }

  const document = pageSurfaceElement.ownerDocument;
  const paragraphs = [
    ...pageSurfaceElement.querySelectorAll<HTMLElement>(
      '[data-docx-paragraph-kind="paragraph"], [data-docx-paragraph-kind="table-cell"]'
    ),
  ].filter((paragraph) =>
    intersects(paragraph.getBoundingClientRect(), selection)
  );
  if (
    hasSelectedTextOutsideParagraphs(
      document,
      pageSurfaceElement,
      paragraphs,
      selection
    )
  ) {
    return { hasUnresolvedSourceText: true, sourceRanges: [] };
  }
  if (paragraphs.length === 0) {
    return { hasUnresolvedSourceText: false, sourceRanges: [] };
  }

  return getSourceRangesForParagraphs(
    document,
    paragraphs,
    resolveParagraphAnchor,
    selection
  );
}

async function getSourceRangesForParagraphs(
  document: Document,
  paragraphs: HTMLElement[],
  resolveParagraphAnchor: DocxParagraphAnchorResolver,
  selection: ClientRect
): Promise<SourceRangeResolution> {
  const ranges: ConfirmationTemplateDesignFieldSourceRange[] = [];
  for (const paragraph of paragraphs) {
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    const selectedOffsets: number[] = [];
    let offset = 0;
    let paragraphText = "";
    let node = walker.nextNode();

    while (node) {
      const textNode = node as Text;
      if (
        textNode.parentElement?.closest('[data-docx-numbering-label="true"]')
      ) {
        node = walker.nextNode();
        continue;
      }
      for (let index = 0; index < textNode.data.length; index += 1) {
        const range = document.createRange();
        range.setStart(textNode, index);
        range.setEnd(textNode, index + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && intersects(rect, selection)) {
          selectedOffsets.push(offset + index);
        }
      }
      offset += textNode.data.length;
      paragraphText += textNode.data;
      node = walker.nextNode();
    }

    if (selectedOffsets.length === 0) {
      continue;
    }

    let anchor: Awaited<ReturnType<DocxParagraphAnchorResolver>>;
    try {
      anchor = await resolveParagraphAnchor(paragraph);
    } catch {
      return { hasUnresolvedSourceText: true, sourceRanges: [] };
    }
    if (!anchor || paragraphText !== anchor.paragraphText) {
      return { hasUnresolvedSourceText: true, sourceRanges: [] };
    }
    let [start] = selectedOffsets;
    let previous = start;
    for (const current of selectedOffsets.slice(1)) {
      if (current === previous + 1) {
        previous = current;
        continue;
      }
      ranges.push({
        end: previous + 1,
        ...(anchor.paragraphId ? { paragraphId: anchor.paragraphId } : {}),
        paragraphOrdinal: anchor.paragraphOrdinal,
        paragraphXmlSha256: anchor.sourceXmlSha256,
        part: "word/document.xml",
        sourceText: paragraphText.slice(start, previous + 1),
        start,
      });
      start = current;
      previous = current;
    }
    ranges.push({
      end: previous + 1,
      ...(anchor.paragraphId ? { paragraphId: anchor.paragraphId } : {}),
      paragraphOrdinal: anchor.paragraphOrdinal,
      paragraphXmlSha256: anchor.sourceXmlSha256,
      part: "word/document.xml",
      sourceText: paragraphText.slice(start, previous + 1),
      start,
    });
  }

  return { hasUnresolvedSourceText: false, sourceRanges: ranges };
}

type MeasuredTextCharacter = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type TextBlockMeasurementCache = {
  blocks: ConfirmationTemplateLayoutText[];
  measuredHeight: number;
  measuredWidth: number;
  pageElement: HTMLElement;
  pageSurfaceElement: HTMLElement;
};

function collectPageTextBlocks(
  pageElement: HTMLElement,
  pageSurfaceElement: HTMLElement,
  pageNumber: number,
  pageHeight: number,
  pageWidth: number
): ConfirmationTemplateLayoutText[] {
  const pageRect = pageElement.getBoundingClientRect();
  const measuredWidth = pageRect.width || pageWidth;
  const measuredHeight = pageRect.height || pageHeight;
  if (measuredWidth <= 0 || measuredHeight <= 0) {
    return [];
  }

  const characters: MeasuredTextCharacter[] = [];
  const walker = pageSurfaceElement.ownerDocument.createTreeWalker(
    pageSurfaceElement,
    NodeFilter.SHOW_TEXT
  );
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    if (textNode.parentElement?.closest('[data-template-field-layer="true"]')) {
      node = walker.nextNode();
      continue;
    }
    for (let index = 0; index < textNode.data.length; index += 1) {
      const range = pageSurfaceElement.ownerDocument.createRange();
      range.setStart(textNode, index);
      range.setEnd(textNode, index + 1);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        characters.push({
          height: rect.height,
          left: rect.left,
          top: rect.top,
          width: rect.width,
        });
      }
    }
    node = walker.nextNode();
  }

  const lines: MeasuredTextCharacter[][] = [];
  for (const character of characters.sort(
    (left, right) => left.top - right.top || left.left - right.left
  )) {
    const line = lines.at(-1);
    const lineHeight = line?.[0]?.height ?? character.height;
    if (line && Math.abs(character.top - line[0].top) <= lineHeight * 0.55) {
      line.push(character);
    } else {
      lines.push([character]);
    }
  }

  return lines.flatMap((line) => {
    const blocks: MeasuredTextCharacter[][] = [];
    for (const character of line) {
      const block = blocks.at(-1);
      const previous = block?.at(-1);
      const gap = previous
        ? character.left - (previous.left + previous.width)
        : 0;
      const gapThreshold = Math.max(
        4,
        Math.min(
          measuredWidth * 0.015,
          (previous?.height ?? character.height) * 1.2
        )
      );
      if (block && gap <= gapThreshold) {
        block.push(character);
      } else {
        blocks.push([character]);
      }
    }

    return blocks.map((block) => {
      const left = Math.min(...block.map((character) => character.left));
      const right = Math.max(
        ...block.map((character) => character.left + character.width)
      );
      const top = Math.min(...block.map((character) => character.top));
      const bottom = Math.max(
        ...block.map((character) => character.top + character.height)
      );
      return {
        height: (bottom - top) / measuredHeight,
        page: pageNumber,
        width: (right - left) / measuredWidth,
        x: clamp((left - pageRect.left) / measuredWidth, 0, 1),
        y: clamp((top - pageRect.top) / measuredHeight, 0, 1),
      };
    });
  });
}

function clearNativeTextSelection() {
  window.getSelection()?.removeAllRanges();
}

function cloneFields(
  designSchema: ConfirmationTemplateDesign | null | undefined
): ConfirmationTemplateDesignField[] {
  if (!Array.isArray(designSchema?.fields)) {
    return [];
  }

  return designSchema.fields.flatMap((field) => {
    if (!field || typeof field !== "object") {
      return [];
    }

    const name = typeof field.name === "string" ? field.name : "";
    const placeholder =
      typeof field.placeholder === "string" ? field.placeholder : name;

    const supportsAssociation =
      field.kind === "TEXT" || field.kind === "MULTILINE";
    const baseInformationBinding =
      getLegacyFieldBinding(field.baseInformationBinding, "BASE_INFORMATION") ??
      getTemplateFieldBinding(field.binding) ??
      (field.defaultValueSource?.source === "BASE_INFORMATION"
        ? getLegacyFieldBinding(
            field.defaultValueSource.binding,
            "BASE_INFORMATION"
          )
        : undefined);
    const informationLibraryBinding =
      getLegacyFieldBinding(
        field.informationLibraryBinding,
        "INFORMATION_LIBRARY"
      ) ??
      (field.defaultValueSource?.source === "INFORMATION_LIBRARY"
        ? getLegacyFieldBinding(
            field.defaultValueSource.binding,
            "INFORMATION_LIBRARY"
          )
        : undefined);
    const clonedField = {
      ...field,
      name,
      options: Array.isArray(field.options)
        ? field.options.filter(
            (option): option is string => typeof option === "string"
          )
        : [],
      placeholder,
      ...(field.kind === "MASK"
        ? {}
        : { textStyle: getFieldTextStyle(field.textStyle) }),
      ...(supportsAssociation && baseInformationBinding
        ? { baseInformationBinding }
        : {}),
      ...(supportsAssociation && informationLibraryBinding
        ? { informationLibraryBinding }
        : {}),
      ...(getSourceRanges(field.sourceRanges).length > 0
        ? { sourceRanges: getSourceRanges(field.sourceRanges) }
        : {}),
    };
    if (!baseInformationBinding) {
      delete clonedField.baseInformationBinding;
    }
    if (!informationLibraryBinding) {
      delete clonedField.informationLibraryBinding;
    }
    if (
      supportsAssociation &&
      ((field.defaultValueSource?.source === "BASE_INFORMATION" &&
        baseInformationBinding) ||
        (field.defaultValueSource?.source === "INFORMATION_LIBRARY" &&
          informationLibraryBinding))
    ) {
      delete clonedField.defaultValueSource;
    }
    return [clonedField];
  });
}

function getToolLabel(
  tool: WorkbenchTool,
  copy: ConfirmationTemplateWorkbenchCopy
) {
  if (tool === "TEXT") {
    return copy.tools.text;
  }
  if (tool === "MULTILINE") {
    return copy.tools.multiline;
  }
  if (tool === "NUMBER") {
    return copy.tools.number;
  }
  if (tool === "DATE") {
    return copy.tools.date;
  }
  if (tool === "CHECKBOX") {
    return copy.tools.checkbox;
  }
  if (tool === "SELECT") {
    return copy.tools.select;
  }
  if (tool === "RADIO") {
    return copy.tools.radio;
  }
  if (tool === "STATIC_TEXT") {
    return copy.tools.staticText;
  }
  return copy.tools.mask;
}

function sanitizeDesign(
  fields: ConfirmationTemplateDesignField[]
): ConfirmationTemplateDesign {
  return {
    fields: fields.map((field) => {
      const supportsAssociation =
        field.kind === "TEXT" || field.kind === "MULTILINE";
      const baseInformationBinding = supportsAssociation
        ? (getLegacyFieldBinding(
            field.baseInformationBinding,
            "BASE_INFORMATION"
          ) ?? getTemplateFieldBinding(field.binding))
        : undefined;
      const informationLibraryBinding = supportsAssociation
        ? getLegacyFieldBinding(
            field.informationLibraryBinding,
            "INFORMATION_LIBRARY"
          )
        : undefined;
      const sanitizedField = {
        ...field,
        name: field.name.trim(),
        options: field.options.map((option) => option.trim()),
        placeholder: field.placeholder.trim(),
        ...(field.kind === "MASK"
          ? {}
          : { textStyle: getFieldTextStyle(field.textStyle) }),
        ...(baseInformationBinding ? { baseInformationBinding } : {}),
        ...(informationLibraryBinding ? { informationLibraryBinding } : {}),
        ...(getSourceRanges(field.sourceRanges).length > 0
          ? { sourceRanges: getSourceRanges(field.sourceRanges) }
          : {}),
      };
      if (!baseInformationBinding) {
        delete sanitizedField.baseInformationBinding;
      }
      if (!informationLibraryBinding) {
        delete sanitizedField.informationLibraryBinding;
      }
      if (sanitizedField.defaultValueSource === undefined) {
        delete sanitizedField.defaultValueSource;
      }
      return sanitizedField;
    }),
    version: 1,
  };
}

function validateDesign(
  design: ConfirmationTemplateDesign,
  copy: ConfirmationTemplateWorkbenchCopy
) {
  for (const field of design.fields) {
    if (field.kind !== "MASK" && !field.name) {
      return copy.validation.nameRequired;
    }
    if (field.kind !== "MASK" && !field.placeholder.trim()) {
      return copy.validation.placeholderRequired;
    }
    if (
      (field.kind === "SELECT" || field.kind === "RADIO") &&
      (field.options.length === 0 || field.options.some((option) => !option))
    ) {
      return copy.validation.optionRequired;
    }
    if (
      (field.kind === "SELECT" || field.kind === "RADIO") &&
      new Set(field.options).size !== field.options.length
    ) {
      return copy.validation.optionUnique;
    }
    if (field.defaultValueSource?.source === "CUSTOM") {
      const value = field.defaultValueSource.value.trim();
      const invalidNumber =
        field.kind === "NUMBER" &&
        value !== "" &&
        !/^-?(?:\d+|\d*\.\d+)$/u.test(value);
      const invalidDate =
        field.kind === "DATE" &&
        value !== "" &&
        (!/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
          Number.isNaN(Date.parse(value)));
      const invalidChoice =
        field.kind === "RADIO" &&
        value !== "" &&
        !field.options.includes(value);
      if (invalidNumber || invalidDate || invalidChoice) {
        return copy.validation.defaultValueType;
      }
    }
  }

  return null;
}

const EMPTY_CUSTOM_FIELDS: NonNullable<
  ConfirmationTemplateWorkbenchProps["customFields"]
> = [];
const DEFAULT_RESIZE_EDGES: ResizeEdges = {
  bottom: false,
  left: false,
  right: false,
  top: false,
};

export function ConfirmationTemplateWorkbench({
  customFields = EMPTY_CUSTOM_FIELDS,
  generalLayout,
  copy,
  loadFile,
  onBack,
  onSave,
  template,
}: ConfirmationTemplateWorkbenchProps) {
  const [activeTool, setActiveTool] = useState<WorkbenchTool | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>(
    {}
  );
  const [interactionMode, setInteractionMode] =
    useState<WorkbenchInteractionMode>("select");
  const [isFieldDragging, setIsFieldDragging] = useState(false);
  const [designStatus, setDesignStatus] = useState<WorkbenchDesignStatus>(
    (template.designStatus as WorkbenchDesignStatus) ??
      (template.isBuiltIn ? "ENABLED" : "DRAFT")
  );
  const [fields, setFields] = useState<ConfirmationTemplateDesignField[]>(() =>
    cloneFields(template.designSchema)
  );
  const undoStackRef = useRef<ConfirmationTemplateDesignField[][]>([]);
  const redoStackRef = useRef<ConfirmationTemplateDesignField[][]>([]);
  const historyCurrentRef = useRef(fields);
  const historyApplyingRef = useRef(false);
  const [historyAvailability, setHistoryAvailability] = useState({
    canUndo: false,
    canRedo: false,
  });
  const [formatPainter, setFormatPainter] = useState<{
    sourceFieldId: string;
    textStyle: ConfirmationTemplateTextStyle;
  } | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [autoFitWidth, setAutoFitWidth] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [savingStatus, setSavingStatus] = useState<SaveStatus | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [backConfirmationOpen, setBackConfirmationOpen] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [ribbonFontSizeOpen, setRibbonFontSizeOpen] = useState(false);
  const [ribbonFontFamilyOpen, setRibbonFontFamilyOpen] = useState(false);
  const [clipboardField, setClipboardField] =
    useState<ConfirmationTemplateDesignField | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceMimeType, setSourceMimeType] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [drawingRect, setDrawingRect] = useState<
    (NormalizedFieldRect & { pageNumber: number }) | null
  >(null);
  const [alignmentGuides, setAlignmentGuides] = useState<{
    guides: AlignmentGuide[];
    pageNumber: number;
  } | null>(null);
  const [selectionRect, setSelectionRect] = useState<
    (NormalizedFieldRect & { pageNumber: number }) | null
  >(null);
  const fieldDrawingRef = useRef<FieldDrawing | null>(null);
  const fieldSelectionRef = useRef<FieldSelection | null>(null);
  const fieldInteractionRef = useRef<FieldInteraction | null>(null);
  const workbenchRef = useRef<HTMLDivElement>(null);
  const pageElementsRef = useRef(
    new Map<number, { element: HTMLElement; width: number; height: number }>()
  );
  const lastDragPointerRef = useRef<PointerCoordinates | null>(null);
  const fieldsRef = useRef(fields);
  const alignmentGuidesRef = useRef(alignmentGuides);
  const drawingRectRef = useRef(drawingRect);
  const latestPointerRef = useRef<PointerCoordinates | null>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const textBlocksRef = useRef(
    new Map<number, ConfirmationTemplateLayoutText[]>()
  );
  const textBlockMeasurementCacheRef = useRef(
    new Map<number, TextBlockMeasurementCache>()
  );
  const nextFieldId = useRef(fields.length + 1);
  const didDragFieldRef = useRef(false);
  const isPdfTemplate =
    template.mimeType === "application/pdf" ||
    template.fileName.toLowerCase().endsWith(".pdf") ||
    sourceMimeType === "application/pdf";
  const editingDisabled = isLoading || loadError || savingStatus !== null;
  const editingDisabledRef = useRef(editingDisabled);
  const loadFileRef = useRef(loadFile);

  // Window pointer listeners must not retain the loading-state closure after
  // The workbench becomes interactive. Keep the current editability in a ref
  // So an already-registered listener always observes the committed UI state.
  useEffect(() => {
    editingDisabledRef.current = editingDisabled;
    fieldsRef.current = fields;
    alignmentGuidesRef.current = alignmentGuides;
    drawingRectRef.current = drawingRect;
  }, [alignmentGuides, drawingRect, editingDisabled, fields]);

  useEffect(() => {
    if (historyApplyingRef.current) {
      historyApplyingRef.current = false;
      historyCurrentRef.current = fields;
      return;
    }
    if (isFieldDragging || historyCurrentRef.current === fields) {
      return;
    }
    undoStackRef.current.push(historyCurrentRef.current);
    if (undoStackRef.current.length > 50) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    historyCurrentRef.current = fields;
    setHistoryAvailability({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    });
  }, [fields, isFieldDragging]);

  useEffect(() => {
    loadFileRef.current = loadFile;
  }, [loadFile]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      fieldDrawingRef.current = null;
      latestPointerRef.current = null;
      drawingRectRef.current = null;
      setDrawingRect(null);
      setAlignmentGuides(null);
      setActiveTool(null);
      didDragFieldRef.current = false;
      setEditingFieldId(null);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    const preventNativeTextSelection = (event: Event) => {
      if (!fieldInteractionRef.current) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      clearNativeTextSelection();
    };

    document.addEventListener("selectstart", preventNativeTextSelection, true);
    return () =>
      document.removeEventListener(
        "selectstart",
        preventNativeTextSelection,
        true
      );
  }, []);

  const readTemplateDesign = useEffectEvent(() => template.designSchema);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const nextFields = cloneFields(readTemplateDesign());

    fieldsRef.current = nextFields;
    historyCurrentRef.current = nextFields;
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryAvailability({ canUndo: false, canRedo: false });
    nextFieldId.current = nextFields.length + 1;
    setFields(nextFields);
    setSelectedFieldId((current) =>
      nextFields.some((field) => field.id === current) ? current : null
    );
    setSelectedFieldIds((current) =>
      current.filter((fieldId) =>
        nextFields.some((field) => field.id === fieldId)
      )
    );
    setEditingFieldId(null);
    setIsDirty(false);
    setSaveError(null);

    setIsLoading(true);
    setLoadError(false);
    setSourceUrl(null);
    setSourceMimeType(null);
    textBlocksRef.current.clear();
    textBlockMeasurementCacheRef.current.clear();

    void loadFileRef
      .current()
      .then(async (blob) => {
        const mimeType = await detectPreviewMimeType(blob);
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setSourceUrl(objectUrl);
        setSourceMimeType(mimeType);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setLoadError(true);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [template.id, template.updatedAt]);

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedFieldId) ?? null,
    [fields, selectedFieldId]
  );
  const selectedBinding =
    selectedField?.baseInformationBinding ?? selectedField?.binding;
  const selectedBindingLabel = selectedBinding
    ? copy.fieldSettings.bindings[selectedBinding]
    : undefined;
  const selectedTextFields = useMemo(
    () =>
      fields.filter(
        (field) =>
          field.kind !== "MASK" &&
          (selectedFieldIds.length > 0
            ? selectedFieldIds.includes(field.id)
            : field.id === selectedFieldId)
      ),
    [fields, selectedFieldId, selectedFieldIds]
  );
  const selectedDefaultValueSource = selectedField?.defaultValueSource;
  const cloneField = useCallback(
    (field: ConfirmationTemplateDesignField) => ({
      ...field,
      options: [...field.options],
      ...(field.textStyle ? { textStyle: { ...field.textStyle } } : {}),
      ...(field.sourceRanges
        ? { sourceRanges: field.sourceRanges.map((range) => ({ ...range })) }
        : {}),
    }),
    []
  );

  const handleCopyField = useCallback(() => {
    if (editingDisabled || !selectedField) {
      return;
    }
    setClipboardField(cloneField(selectedField));
  }, [cloneField, editingDisabled, selectedField]);

  const handlePasteField = useCallback(() => {
    if (editingDisabled || !clipboardField) {
      return;
    }

    let id = `field-${nextFieldId.current}`;
    while (fieldsRef.current.some((field) => field.id === id)) {
      nextFieldId.current += 1;
      id = `field-${nextFieldId.current}`;
    }
    nextFieldId.current += 1;
    const field = cloneField(clipboardField);
    const pastedField: ConfirmationTemplateDesignField = {
      ...field,
      id,
      x: clamp(field.x + FIELD_PASTE_OFFSET, 0, 1 - field.width),
      y: clamp(field.y + FIELD_PASTE_OFFSET, 0, 1 - field.height),
    };
    const nextFields = [...fieldsRef.current, pastedField];
    fieldsRef.current = nextFields;
    setFields(nextFields);
    setIsDirty(true);
    setSelectedFieldId(id);
    setSelectedFieldIds([id]);
    setEditingFieldId(null);
    setActiveTool(null);
    setAlignmentGuides(null);
  }, [clipboardField, cloneField, editingDisabled]);

  useEffect(() => {
    const handleClipboardShortcuts = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        typeof target.closest === "function" &&
        target.closest("input, textarea, [contenteditable='true']")
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "c") {
        if (!selectedFieldId || editingDisabledRef.current) {
          return;
        }
        event.preventDefault();
        handleCopyField();
      } else if (key === "v") {
        if (!clipboardField || editingDisabledRef.current) {
          return;
        }
        event.preventDefault();
        handlePasteField();
      }
    };
    window.addEventListener("keydown", handleClipboardShortcuts);
    return () =>
      window.removeEventListener("keydown", handleClipboardShortcuts);
  }, [clipboardField, handleCopyField, handlePasteField, selectedFieldId]);
  const updateField = useCallback(
    (fieldId: string, patch: Partial<ConfirmationTemplateDesignField>) => {
      if (editingDisabled) {
        return;
      }
      setIsDirty(true);
      setFields((currentFields) => {
        const nextFields = currentFields.map((field) =>
          field.id === fieldId ? { ...field, ...patch } : field
        );
        fieldsRef.current = nextFields;
        return nextFields;
      });
    },
    [editingDisabled]
  );
  const changeFieldKind = (
    fieldId: string,
    kind: (typeof EDITABLE_CONFIRMATION_FIELD_KINDS)[number]
  ) => {
    if (
      editingDisabled ||
      fieldsRef.current.find((field) => field.id === fieldId)?.kind === kind
    ) {
      return;
    }
    setFields((currentFields) => {
      const nextFields = currentFields.map((field) =>
        field.id === fieldId
          ? changeConfirmationTemplateFieldKind(
              field,
              kind,
              copy.defaults.option
            )
          : field
      );
      fieldsRef.current = nextFields;
      return nextFields;
    });
    setPreviewValues((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([id]) => id !== fieldId)
      )
    );
    setEditingFieldId(null);
    setSaveError(null);
    setIsDirty(true);
  };
  const updateSelectedTextFields = useCallback(
    (
      textStylePatch: Partial<ConfirmationTemplateTextStyle>,
      textAlign?: ConfirmationTemplateDesignField["textAlign"]
    ) => {
      if (editingDisabled || selectedTextFields.length === 0) {
        return;
      }
      const selectedIds = new Set(selectedTextFields.map((field) => field.id));
      setIsDirty(true);
      setFields((currentFields) => {
        const nextFields = currentFields.map((field) =>
          selectedIds.has(field.id)
            ? {
                ...field,
                ...(textAlign === undefined ? {} : { textAlign }),
                textStyle: {
                  ...getFieldTextStyle(field.textStyle),
                  ...textStylePatch,
                },
              }
            : field
        );
        fieldsRef.current = nextFields;
        return nextFields;
      });
    },
    [editingDisabled, selectedTextFields]
  );
  const deleteFieldById = useCallback(
    (fieldId: string) => {
      if (editingDisabled) {
        return;
      }
      setIsDirty(true);
      setFields((currentFields) => {
        const nextFields = currentFields.filter(
          (field) => field.id !== fieldId
        );
        fieldsRef.current = nextFields;
        return nextFields;
      });
      setSelectedFieldId(null);
      setSelectedFieldIds([]);
      setEditingFieldId(null);
    },
    [editingDisabled]
  );
  const refreshPageTextBlocks = useCallback(
    (
      pageNumber: number,
      pageElement: HTMLElement,
      pageSurfaceElement: HTMLElement | null,
      pageHeight: number,
      pageWidth: number
    ) => {
      if (isPdfTemplate) {
        return;
      }
      const resolvedPageSurfaceElement =
        pageSurfaceElement ??
        pageElement.querySelector<HTMLElement>(
          '[data-docx-page-surface="true"]'
        );
      if (!resolvedPageSurfaceElement) {
        textBlocksRef.current.delete(pageNumber);
        textBlockMeasurementCacheRef.current.delete(pageNumber);
        return;
      }

      const pageRect = pageElement.getBoundingClientRect();
      const measuredWidth = pageRect.width || pageWidth;
      const measuredHeight = pageRect.height || pageHeight;
      const cached = textBlockMeasurementCacheRef.current.get(pageNumber);
      const blocks =
        cached &&
        cached.blocks.length > 0 &&
        cached.pageElement === pageElement &&
        cached.pageSurfaceElement === resolvedPageSurfaceElement &&
        cached.measuredWidth === measuredWidth &&
        cached.measuredHeight === measuredHeight
          ? cached.blocks
          : collectPageTextBlocks(
              pageElement,
              resolvedPageSurfaceElement,
              pageNumber,
              pageHeight,
              pageWidth
            );

      if (blocks.length > 0) {
        textBlockMeasurementCacheRef.current.set(pageNumber, {
          blocks,
          measuredHeight,
          measuredWidth,
          pageElement,
          pageSurfaceElement: resolvedPageSurfaceElement,
        });
      } else {
        // An empty result is a readiness state, not a reusable measurement.
        textBlockMeasurementCacheRef.current.delete(pageNumber);
      }
      textBlocksRef.current.set(pageNumber, blocks);
    },
    [isPdfTemplate]
  );
  const updateFieldFromPointer = useCallback(
    (event: PointerCoordinates) => {
      const interaction = fieldInteractionRef.current;
      if (!interaction || editingDisabledRef.current) {
        return;
      }

      let pageNumber =
        interaction.mode === "move"
          ? (fieldsRef.current.find((field) => field.id === interaction.fieldId)
              ?.page ?? interaction.startField.page)
          : interaction.startField.page;
      let page = pageElementsRef.current.get(pageNumber) ?? {
        element: interaction.pageElement,
        width: interaction.pageWidth,
        height: interaction.pageHeight,
      };
      if (interaction.mode === "move" && interaction.fieldIds.length === 1) {
        for (const [number, candidate] of pageElementsRef.current) {
          const rect = candidate.element.getBoundingClientRect();
          if (
            rect.width > 0 &&
            rect.height > 0 &&
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
            pageNumber = number;
            page = candidate;
            break;
          }
        }
      }
      const liveRect = page.element.getBoundingClientRect();
      const pageRect =
        liveRect.width > 0 && liveRect.height > 0
          ? liveRect
          : interaction.pageRect;
      const measuredWidth = pageRect.width || page.width;
      const measuredHeight = pageRect.height || page.height;
      if (measuredWidth <= 0 || measuredHeight <= 0) {
        return;
      }

      const clientDeltaX =
        event.clientX -
        interaction.startClientX +
        interaction.pageRect.left -
        pageRect.left;
      const clientDeltaY =
        event.clientY -
        interaction.startClientY +
        interaction.pageRect.top -
        pageRect.top;
      const isBelowActivationThreshold =
        !interaction.hasActivated &&
        Math.hypot(clientDeltaX, clientDeltaY) <
          FIELD_POINTER_ACTIVATION_THRESHOLD_PX;
      if (isBelowActivationThreshold) {
        alignmentGuidesRef.current = null;
        setAlignmentGuides(null);
        return;
      }
      if (!isBelowActivationThreshold && !interaction.hasActivated) {
        interaction.hasActivated = true;
        if (interaction.pointerId !== undefined) {
          try {
            workbenchRef.current?.setPointerCapture?.(interaction.pointerId);
          } catch {
            // Window listeners continue dragging when pointer capture is unavailable.
          }
        }
      }
      if (!isBelowActivationThreshold) {
        refreshPageTextBlocks(
          pageNumber,
          page.element,
          null,
          page.height,
          page.width
        );
      }
      const deltaX = clientDeltaX / measuredWidth;
      const deltaY = clientDeltaY / measuredHeight;
      const currentFields = fieldsRef.current;
      const { startField } = interaction;
      const resizeIntent =
        interaction.mode === "resize"
          ? (interaction.resizeIntent ??
            getResizeIntent(
              clientDeltaX,
              clientDeltaY,
              FIELD_POINTER_ACTIVATION_THRESHOLD_PX
            ))
          : null;
      if (
        interaction.mode === "resize" &&
        interaction.resizeIntent === null &&
        resizeIntent
      ) {
        interaction.resizeIntent = resizeIntent;
      }
      if (!isBelowActivationThreshold) {
        didDragFieldRef.current = true;
      }
      if (interaction.mode === "move" && interaction.fieldIds.length > 1) {
        const nextFields = currentFields.map((field) => {
          const start = interaction.startFields.find(
            (candidate) => candidate.id === field.id
          );
          return start
            ? {
                ...field,
                x: clamp(start.x + deltaX, 0, 1 - start.width),
                y: clamp(start.y + deltaY, 0, 1 - start.height),
              }
            : field;
        });
        fieldsRef.current = nextFields;
        setFields(nextFields);
        setIsDirty(true);
        setAlignmentGuides(null);
        return;
      }
      let rawGeometry: NormalizedFieldRect;
      if (interaction.mode === "resize") {
        const startRight = startField.x + startField.width;
        const startBottom = startField.y + startField.height;
        const x = interaction.resizeEdges.left
          ? clamp(startField.x + deltaX, 0, startRight - MIN_FIELD_WIDTH)
          : startField.x;
        const y = interaction.resizeEdges.top
          ? clamp(startField.y + deltaY, 0, startBottom - MIN_FIELD_HEIGHT)
          : startField.y;
        const right = interaction.resizeEdges.right
          ? clamp(startRight + deltaX, startField.x + MIN_FIELD_WIDTH, 1)
          : startRight;
        const bottom = interaction.resizeEdges.bottom
          ? clamp(startBottom + deltaY, startField.y + MIN_FIELD_HEIGHT, 1)
          : startBottom;
        rawGeometry = {
          height: bottom - y,
          width: right - x,
          x,
          y,
        };
      } else {
        const width = Math.min(
          1,
          (startField.width * interaction.pageWidth) / page.width
        );
        const height = Math.min(
          1,
          (startField.height * interaction.pageHeight) / page.height
        );
        rawGeometry = {
          height,
          width,
          x: clamp(
            (event.clientX - pageRect.left) / measuredWidth -
              (interaction.pointerOffset.x * interaction.pageWidth) /
                page.width,
            0,
            1 - width
          ),
          y: clamp(
            (event.clientY - pageRect.top) / measuredHeight -
              (interaction.pointerOffset.y * interaction.pageHeight) /
                page.height,
            0,
            1 - height
          ),
        };
      }
      const resizeAxes: ResizeAxis[] = [];
      if (interaction.resizeEdges.right) {
        resizeAxes.push("x");
      }
      if (interaction.resizeEdges.bottom) {
        resizeAxes.push("y");
      }
      const snapPeers = [
        ...currentFields.filter(
          (field) =>
            field.id !== interaction.fieldId && field.page === pageNumber
        ),
        ...(textBlocksRef.current.get(pageNumber) ?? []),
      ];
      const snappedGeometry = snapFieldGeometry(
        rawGeometry,
        snapPeers,
        interaction.mode,
        resizeAxes,
        {
          x: FIELD_SNAP_DISTANCE_PX / measuredWidth,
          y: FIELD_SNAP_DISTANCE_PX / measuredHeight,
        }
      );
      const { guides, ...nextGeometry } = snappedGeometry;
      const nextFields = currentFields.map((field) =>
        field.id === interaction.fieldId
          ? {
              ...field,
              ...nextGeometry,
              page: pageNumber,
              sourceRanges:
                pageNumber === startField.page
                  ? startField.sourceRanges
                  : undefined,
            }
          : field
      );

      setIsDirty(true);
      fieldsRef.current = nextFields;
      setFields(nextFields);
      const nextAlignmentGuides =
        guides.length > 0 ? { guides, pageNumber } : null;
      alignmentGuidesRef.current = nextAlignmentGuides;
      setAlignmentGuides(nextAlignmentGuides);
      setEditingFieldId(null);
    },
    [refreshPageTextBlocks]
  );
  const updateDrawingFromPointer = useCallback((event: PointerCoordinates) => {
    const drawing = fieldDrawingRef.current;
    if (
      !drawing ||
      editingDisabledRef.current ||
      event.pointerId !== drawing.pointerId
    ) {
      return;
    }

    const point = pointerToPagePoint(
      event.clientX,
      event.clientY,
      drawing.pageRect,
      drawing.pageWidth,
      drawing.pageHeight
    );
    const rect = normalizeDrawnRect(
      drawing.startX,
      drawing.startY,
      point.x,
      point.y
    );
    if (!rect) {
      drawingRectRef.current = null;
      setDrawingRect(null);
      setAlignmentGuides(null);
      return;
    }

    const snapPeers = [
      ...fieldsRef.current.filter((field) => field.page === drawing.pageNumber),
      ...(textBlocksRef.current.get(drawing.pageNumber) ?? []),
    ];
    const { guides, ...snappedRect } = snapFieldGeometry(
      rect,
      snapPeers,
      "move"
    );
    const nextDrawingRect = {
      ...snappedRect,
      pageNumber: drawing.pageNumber,
    };
    drawingRectRef.current = nextDrawingRect;
    setDrawingRect(nextDrawingRect);
    setAlignmentGuides(
      guides.length > 0 ? { guides, pageNumber: drawing.pageNumber } : null
    );
  }, []);

  useEffect(() => {
    const updateSelectionFromPointer = (event: PointerCoordinates) => {
      const selection = fieldSelectionRef.current;
      if (
        !selection ||
        editingDisabledRef.current ||
        event.pointerId !== selection.pointerId
      ) {
        return;
      }
      const point = pointerToPagePoint(
        event.clientX,
        event.clientY,
        selection.pageRect,
        selection.pageWidth,
        selection.pageHeight
      );
      selection.currentX = point.x;
      selection.currentY = point.y;
      const rect = normalizeDrawnRect(
        selection.startX,
        selection.startY,
        point.x,
        point.y
      );
      if (rect) {
        didDragFieldRef.current = true;
      }
      setSelectionRect(
        rect ? { ...rect, pageNumber: selection.pageNumber } : null
      );
    };
    const applyPointerMove = (event: PointerCoordinates) => {
      if (fieldInteractionRef.current) {
        clearNativeTextSelection();
      }
      updateFieldFromPointer(event);
      updateDrawingFromPointer(event);
      updateSelectionFromPointer(event);
    };
    const handlePointerMove = (event: PointerCoordinates) => {
      if (
        !fieldInteractionRef.current &&
        !fieldDrawingRef.current &&
        !fieldSelectionRef.current
      ) {
        return;
      }

      lastDragPointerRef.current = event;
      latestPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        pointerId: event.pointerId,
      };
      if (pointerFrameRef.current !== null) {
        return;
      }

      const currentPointer = latestPointerRef.current;
      latestPointerRef.current = null;
      if (currentPointer) {
        applyPointerMove(currentPointer);
      }

      pointerFrameRef.current = window.requestAnimationFrame(() => {
        pointerFrameRef.current = null;
        const pendingPointer = latestPointerRef.current;
        latestPointerRef.current = null;
        if (pendingPointer) {
          applyPointerMove(pendingPointer);
        }
      });
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (!fieldInteractionRef.current) {
        return;
      }
      handlePointerMove({ clientX: event.clientX, clientY: event.clientY });
    };
    const handleScroll = () => {
      if (fieldInteractionRef.current && lastDragPointerRef.current) {
        handlePointerMove(lastDragPointerRef.current);
      }
    };
    const stopInteraction = () => {
      if (pointerFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerFrameRef.current);
        pointerFrameRef.current = null;
      }
      const pendingPointer = latestPointerRef.current;
      latestPointerRef.current = null;
      if (pendingPointer) {
        applyPointerMove(pendingPointer);
      }
      fieldInteractionRef.current = null;
      setIsFieldDragging(false);
      const selection = fieldSelectionRef.current;
      if (selection) {
        const rect = normalizeDrawnRect(
          selection.startX,
          selection.startY,
          selection.currentX,
          selection.currentY
        );
        const ids = rect
          ? fieldsRef.current
              .filter(
                (field) =>
                  field.page === selection.pageNumber &&
                  field.x >= rect.x &&
                  field.y >= rect.y &&
                  field.x + field.width <= rect.x + rect.width &&
                  field.y + field.height <= rect.y + rect.height
              )
              .map((field) => field.id)
          : [];
        setSelectedFieldIds(ids);
        setSelectedFieldId(ids[0] ?? null);
        setEditingFieldId(null);
        fieldSelectionRef.current = null;
        setSelectionRect(null);
      }
      setAlignmentGuides(null);
    };
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopInteraction);
    window.addEventListener("pointercancel", stopInteraction);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopInteraction);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopInteraction);
      window.removeEventListener("pointercancel", stopInteraction);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopInteraction);
      fieldInteractionRef.current = null;
      setIsFieldDragging(false);
      fieldSelectionRef.current = null;
      latestPointerRef.current = null;
      if (pointerFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerFrameRef.current);
        pointerFrameRef.current = null;
      }
    };
  }, [updateDrawingFromPointer, updateFieldFromPointer]);

  const beginFieldInteraction = useCallback(
    (
      event: FieldInteractionStartEvent,
      field: ConfirmationTemplateDesignField,
      pageElement: HTMLElement,
      pageHeight: number,
      pageWidth: number,
      mode: "move" | "resize" = "move",
      resizeEdges: ResizeEdges = DEFAULT_RESIZE_EDGES
    ) => {
      if (
        editingDisabled ||
        activeTool ||
        interactionMode !== "select" ||
        (event.buttons === undefined
          ? event.button !== undefined &&
            event.button !== 0 &&
            event.button !== 1
          : event.buttons !== 0 && event.buttons !== 1)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      clearNativeTextSelection();
      setAlignmentGuides(null);
      const pageRect = pageElement.getBoundingClientRect();
      lastDragPointerRef.current = event;
      fieldInteractionRef.current = {
        pointerId: event.pointerId,
        pointerOffset: {
          x:
            (event.clientX - pageRect.left) / (pageRect.width || pageWidth) -
            field.x,
          y:
            (event.clientY - pageRect.top) / (pageRect.height || pageHeight) -
            field.y,
        },
        fieldIds:
          mode === "move" && selectedFieldIds.includes(field.id)
            ? selectedFieldIds
            : [field.id],
        fieldId: field.id,
        mode,
        pageElement,
        pageHeight,
        pageRect: {
          height: pageRect.height || pageHeight,
          left: pageRect.left,
          top: pageRect.top,
          width: pageRect.width || pageWidth,
        },
        pageWidth,
        resizeEdges,
        resizeIntent: mode === "resize" ? null : "both",
        hasActivated: false,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startField: field,
        startFields: fieldsRef.current.filter((candidate) =>
          (mode === "move" && selectedFieldIds.includes(field.id)
            ? selectedFieldIds
            : [field.id]
          ).includes(candidate.id)
        ),
      };
      setIsFieldDragging(true);
      didDragFieldRef.current = false;
      setSelectedFieldId(field.id);
      setSelectedFieldIds(
        mode === "move" && selectedFieldIds.includes(field.id)
          ? selectedFieldIds
          : [field.id]
      );
      setActiveTool(null);
    },
    [activeTool, editingDisabled, interactionMode, selectedFieldIds]
  );
  const beginFieldDrawing = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      pageElement: HTMLElement,
      pageHeight: number,
      pageNumber: number,
      pageSurfaceElement: HTMLElement | null,
      pageWidth: number,
      resolveParagraphAnchor: DocxParagraphAnchorResolver
    ) => {
      if (editingDisabled || !activeTool) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const pageRect = pageElement.getBoundingClientRect();
      const point = pointerToPagePoint(
        event.clientX,
        event.clientY,
        {
          height: pageRect.height || pageHeight,
          left: pageRect.left,
          top: pageRect.top,
          width: pageRect.width || pageWidth,
        },
        pageWidth,
        pageHeight
      );
      fieldDrawingRef.current = {
        pageElement,
        pageHeight,
        pageNumber,
        pageRect: {
          height: pageRect.height || pageHeight,
          left: pageRect.left,
          top: pageRect.top,
          width: pageRect.width || pageWidth,
        },
        pageSurfaceElement,
        pageWidth,
        pointerId: event.pointerId,
        resolveParagraphAnchor,
        startX: point.x,
        startY: point.y,
        tool: activeTool,
      };
      drawingRectRef.current = null;
      setDrawingRect(null);
      setSelectedFieldId(null);
      setSelectedFieldIds([]);
      didDragFieldRef.current = false;
      setEditingFieldId(null);
    },
    [activeTool, editingDisabled]
  );

  const beginFieldSelection = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      pageElement: HTMLElement,
      pageHeight: number,
      pageNumber: number,
      pageWidth: number
    ) => {
      if (
        editingDisabled ||
        activeTool ||
        event.target !== event.currentTarget
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const pageRect = pageElement.getBoundingClientRect();
      const point = pointerToPagePoint(
        event.clientX,
        event.clientY,
        {
          height: pageRect.height || pageHeight,
          left: pageRect.left,
          top: pageRect.top,
          width: pageRect.width || pageWidth,
        },
        pageWidth,
        pageHeight
      );
      fieldSelectionRef.current = {
        currentX: point.x,
        currentY: point.y,
        pageElement,
        pageHeight,
        pageNumber,
        pageRect: {
          height: pageRect.height || pageHeight,
          left: pageRect.left,
          top: pageRect.top,
          width: pageRect.width || pageWidth,
        },
        pageWidth,
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
      };
      setSelectionRect(null);
      setSelectedFieldId(null);
      setSelectedFieldIds([]);
      setEditingFieldId(null);
    },
    [activeTool, editingDisabled]
  );
  const createFieldFromRect = useCallback(
    async (
      tool: WorkbenchTool,
      rect: NormalizedFieldRect,
      pageElement: HTMLElement,
      pageHeight: number,
      pageNumber: number,
      pageSurfaceElement: HTMLElement | null,
      pageWidth: number,
      resolveParagraphAnchor: DocxParagraphAnchorResolver
    ) => {
      if (editingDisabled) {
        return;
      }

      const snappedPlacement = snapFieldGeometry(
        rect,
        [
          ...fieldsRef.current.filter((field) => field.page === pageNumber),
          ...(textBlocksRef.current.get(pageNumber) ?? []),
        ],
        "move"
      );
      const placement = {
        height: snappedPlacement.height,
        width: snappedPlacement.width,
        x: snappedPlacement.x,
        y: snappedPlacement.y,
      };
      const pageRect = pageElement.getBoundingClientRect();
      const measuredWidth = pageRect.width || pageWidth;
      const measuredHeight = pageRect.height || pageHeight;
      const selection = {
        bottom:
          pageRect.top + (placement.y + placement.height) * measuredHeight,
        left: pageRect.left + placement.x * measuredWidth,
        right: pageRect.left + (placement.x + placement.width) * measuredWidth,
        top: pageRect.top + placement.y * measuredHeight,
      };
      const sourceRangeResult = getSourceRangesAtSelection(
        pageSurfaceElement,
        resolveParagraphAnchor,
        selection
      );
      const { sourceRanges } =
        sourceRangeResult instanceof Promise
          ? await sourceRangeResult
          : sourceRangeResult;
      let id = `field-${nextFieldId.current}`;
      while (fieldsRef.current.some((field) => field.id === id)) {
        nextFieldId.current += 1;
        id = `field-${nextFieldId.current}`;
      }
      nextFieldId.current += 1;
      const nameByTool: Record<WorkbenchTool, string> = {
        TEXT: copy.defaults.textName,
        MULTILINE: copy.defaults.multilineName,
        NUMBER: copy.defaults.numberName,
        DATE: copy.defaults.dateName,
        CHECKBOX: copy.defaults.checkboxName,
        SELECT: copy.defaults.selectName,
        RADIO: copy.defaults.radioName,
        STATIC_TEXT: copy.defaults.staticTextName,
        MASK: copy.defaults.maskName,
      };
      const name = nameByTool[tool];
      const field: ConfirmationTemplateDesignField = {
        ...placement,
        id,
        kind: tool,
        name,
        options:
          tool === "SELECT" || tool === "RADIO" ? [copy.defaults.option] : [],
        page: pageNumber,
        placeholder: name,
        ...(tool === "CHECKBOX"
          ? { defaultChecked: false, required: false }
          : {}),
        ...(tool === "MASK"
          ? {}
          : {
              textStyle: {
                ...DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE,
                fontFamily: "Noto Sans SC",
              },
            }),
        ...(sourceRanges.length > 0 ? { sourceRanges } : {}),
      };

      setSaveError(null);
      setIsDirty(true);
      setFields((currentFields) => {
        const nextFields = [...currentFields, field];
        fieldsRef.current = nextFields;
        return nextFields;
      });
      setSelectedFieldId(id);
      setSelectedFieldIds([id]);
      setEditingFieldId(id);
      setActiveTool(null);
    },
    [copy.defaults, editingDisabled]
  );
  const handlePageClick = useCallback(
    (
      event: Pick<ReactMouseEvent<HTMLDivElement>, "clientX" | "clientY">,
      pageElement: HTMLElement,
      pageHeight: number,
      pageNumber: number,
      pageSurfaceElement: HTMLElement | null,
      pageWidth: number,
      resolveParagraphAnchor: DocxParagraphAnchorResolver
    ) => {
      if (editingDisabled || !activeTool) {
        return;
      }

      const pageRect = pageElement.getBoundingClientRect();
      const point = pointerToPagePoint(
        event.clientX,
        event.clientY,
        {
          height: pageRect.height || pageHeight,
          left: pageRect.left,
          top: pageRect.top,
          width: pageRect.width || pageWidth,
        },
        pageWidth,
        pageHeight
      );
      const dimensions = FIELD_DIMENSIONS[activeTool];
      void createFieldFromRect(
        activeTool,
        {
          height: dimensions.height,
          width: dimensions.width,
          x: clamp(point.x, 0, 1 - dimensions.width),
          y: clamp(point.y, 0, 1 - dimensions.height),
        },
        pageElement,
        pageHeight,
        pageNumber,
        pageSurfaceElement,
        pageWidth,
        resolveParagraphAnchor
      );
    },
    [activeTool, createFieldFromRect, editingDisabled]
  );

  useEffect(() => {
    const cancelDrawing = () => {
      fieldDrawingRef.current = null;
      drawingRectRef.current = null;
      setDrawingRect(null);
    };
    const finishDrawing = (event: PointerEvent) => {
      const drawing = fieldDrawingRef.current;
      if (!drawing || event.pointerId !== drawing.pointerId) {
        return;
      }

      const point = pointerToPagePoint(
        event.clientX,
        event.clientY,
        drawing.pageRect,
        drawing.pageWidth,
        drawing.pageHeight
      );
      const rect = normalizeDrawnRect(
        drawing.startX,
        drawing.startY,
        point.x,
        point.y
      );
      fieldDrawingRef.current = null;
      drawingRectRef.current = null;
      setDrawingRect(null);
      if (!rect) {
        return;
      }
      // Browsers dispatch a click after the pointer sequence. Consume that
      // click so it cannot immediately clear the field selected below.
      didDragFieldRef.current = true;

      void createFieldFromRect(
        drawing.tool,
        rect,
        drawing.pageElement,
        drawing.pageHeight,
        drawing.pageNumber,
        drawing.pageSurfaceElement,
        drawing.pageWidth,
        drawing.resolveParagraphAnchor
      );
    };

    window.addEventListener("pointerup", finishDrawing);
    window.addEventListener("pointercancel", cancelDrawing);
    return () => {
      window.removeEventListener("pointerup", finishDrawing);
      window.removeEventListener("pointercancel", cancelDrawing);
      fieldDrawingRef.current = null;
    };
  }, [createFieldFromRect]);

  const renderPageOverlay = useCallback(
    ({
      pageElement,
      pageHeight,
      pageNumber,
      pageSurfaceElement,
      pageWidth,
      scale,
      textBlocks: pdfTextBlocks = [],
      resolveParagraphAnchor,
      selectionModeEnabled = true,
    }: {
      pageElement?: HTMLElement;
      pageHeight: number;
      pageNumber: number;
      pageSurfaceElement?: HTMLElement | null;
      pageWidth: number;
      resolveParagraphAnchor?: DocxParagraphAnchorResolver;
      selectionModeEnabled?: boolean;
      textBlocks?: Pick<NormalizedFieldRect, "height" | "width" | "x" | "y">[];
      rotation: number;
      scale: number;
    }) => {
      const pageFields = fields.filter((field) => field.page === pageNumber);
      const hasActivePointerInteraction =
        fieldInteractionRef.current !== null ||
        fieldDrawingRef.current !== null;
      const pageGuides =
        hasActivePointerInteraction &&
        alignmentGuides?.pageNumber === pageNumber
          ? alignmentGuides.guides
          : [];
      const pageDrawingRect =
        drawingRect?.pageNumber === pageNumber ? drawingRect : null;
      const pageSelectionRect =
        selectionRect?.pageNumber === pageNumber ? selectionRect : null;
      if (pdfTextBlocks.length) {
        textBlocksRef.current.set(
          pageNumber,
          pdfTextBlocks.map((block) => ({ ...block, page: pageNumber }))
        );
      } else if (pageElement) {
        refreshPageTextBlocks(
          pageNumber,
          pageElement,
          pageSurfaceElement ?? null,
          pageHeight,
          pageWidth
        );
      } else {
        textBlocksRef.current.delete(pageNumber);
        textBlockMeasurementCacheRef.current.delete(pageNumber);
      }

      if (previewMode) {
        return (
          <div
            className="pointer-events-none absolute inset-0 z-20"
            data-testid="template-workbench-fill-preview"
          >
            {pageFields.map((field) => {
              const value = previewValues[field.id] ?? "";
              const geometry = {
                height: `${field.height * 100}%`,
                left: `${field.x * 100}%`,
                position: "absolute" as const,
                top: `${field.y * 100}%`,
                width: `${field.width * 100}%`,
              };
              if (field.kind === "MASK") {
                return (
                  <div
                    className="absolute z-30 bg-white"
                    data-testid={`template-preview-mask-${field.id}`}
                    key={field.id}
                    style={geometry}
                  />
                );
              }
              const textStyle = {
                ...getConfirmationTemplateFieldTextStyleCss(
                  field.textStyle,
                  pageHeight,
                  isPdfTemplate ? scale : undefined,
                  pageWidth,
                  field.height,
                  field.width,
                  value || field.placeholder,
                  field.kind === "MULTILINE"
                ),
                ...getConfirmationTemplateFlexAlignmentCss(field.textAlign),
              };
              if (field.kind === "STATIC_TEXT") {
                return (
                  <div
                    className="absolute flex items-center overflow-hidden px-1 leading-tight whitespace-pre-wrap"
                    data-testid={`template-preview-static-${field.id}`}
                    key={field.id}
                    style={{ ...geometry, ...textStyle }}
                  >
                    {field.placeholder}
                  </div>
                );
              }
              const setValue = (nextValue: string) =>
                setPreviewValues((current) => ({
                  ...current,
                  [field.id]: nextValue,
                }));
              return (
                <div
                  // Inputs are inline-level controls by default. A normal text
                  // line box can push them below short, scaled template fields.
                  className="pointer-events-auto absolute flex items-center rounded-none border-2 border-dashed border-primary/90 bg-transparent shadow-[0_0_0_1px_rgba(255,255,255,0.75)]"
                  data-testid={`template-preview-field-${field.id}`}
                  key={field.id}
                  style={geometry}
                >
                  {field.kind === "MULTILINE" ? (
                    <Textarea
                      aria-label={field.name}
                      className="h-full min-h-0 w-full resize-none rounded-none border-0 bg-transparent px-1 py-0.5 leading-tight shadow-none focus-visible:ring-0"
                      onChange={(event) => setValue(event.target.value)}
                      placeholder={field.placeholder}
                      style={textStyle}
                      value={value}
                    />
                  ) : field.kind === "RADIO" ? (
                    <div className="relative h-full w-full overflow-visible">
                      <div
                        aria-label={field.name}
                        className="flex h-full w-full items-center overflow-hidden rounded-none border-0 bg-transparent py-0 pr-5 pl-1 leading-none shadow-none"
                        data-testid={`template-preview-radio-display-${field.id}`}
                        style={textStyle}
                      >
                        <span className="truncate">
                          {value || field.placeholder}
                        </span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              aria-label={`${field.name} options`}
                              className={cn(
                                "absolute top-0 right-0 z-20 min-h-0 w-5 rounded-none border-0 bg-transparent p-0 shadow-none hover:bg-transparent",
                                inspectorStyles.fillHeight
                              )}
                              size="icon-xs"

                              type="button"
                              variant="ghost"
                            >
                              <ChevronDown />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="min-w-44">
                          <DropdownMenuRadioGroup
                            onValueChange={setValue}
                            value={value}
                          >
                            {field.options.map((option) => (
                              <DropdownMenuRadioItem
                                key={option}
                                value={option}
                              >
                                {option}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : field.kind === "SELECT" ? (
                    <Select
                      onValueChange={(next) => setValue(next ?? "")}
                      value={value}
                    >
                      <SelectTrigger
                        aria-label={field.name}
                        className="h-full w-full rounded-none border-0 bg-transparent py-0 shadow-none focus-visible:ring-0"
                        style={{ ...textStyle, height: "100%" }}
                      >
                        <SelectValue placeholder={field.placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.kind === "CHECKBOX" ? (
                    <div
                      className="flex h-full w-full items-center gap-2 rounded-none border-0 bg-transparent px-1"
                      style={textStyle}
                    >
                      <Checkbox
                        checked={value === "true"}
                        label={field.name}
                        onCheckedChange={(checked) =>
                          setValue(checked === true ? "true" : "false")
                        }
                      />
                      <span>{field.placeholder}</span>
                    </div>
                  ) : (
                    <Input
                      aria-label={field.name}
                      className="h-full w-full rounded-none border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0"
                      onChange={(event) => setValue(event.target.value)}
                      placeholder={field.placeholder}
                      style={{ ...textStyle, lineHeight: "normal" }}
                      type={
                        field.kind === "NUMBER"
                          ? "number"
                          : field.kind === "DATE"
                            ? "date"
                            : "text"
                      }
                      value={value}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      }

      return (
        <div
          className={cn(
            // Keep the canvas hit-testable when no creation tool is armed. This
            // makes a blank click exit edit mode while still allowing the
            // viewer's pan handler to receive blank-area pointer events.
            "absolute inset-0 z-20 touch-none select-none",
            activeTool && "pointer-events-auto cursor-crosshair",
            !activeTool &&
              interactionMode === "select" &&
              (selectionModeEnabled
                ? "pointer-events-auto"
                : "pointer-events-none")
          )}
          aria-label={activeTool ? getToolLabel(activeTool, copy) : undefined}
          ref={(element) => {
            if (element) {
              pageElementsRef.current.set(pageNumber, {
                element: pageElement ?? element,
                width: pageWidth,
                height: pageHeight,
              });
            } else {
              pageElementsRef.current.delete(pageNumber);
            }
          }}
          data-page-number={pageNumber}
          data-testid="template-workbench-page-overlay"
          onPointerDown={(event) => {
            const activePageElement = pageElement ?? event.currentTarget;
            if (!activeTool && event.target === event.currentTarget) {
              beginFieldSelection(
                event,
                activePageElement,
                pageHeight,
                pageNumber,
                pageWidth
              );
              return;
            }
            beginFieldDrawing(
              event,
              activePageElement,
              pageHeight,
              pageNumber,
              pageSurfaceElement ?? null,
              pageWidth,
              resolveParagraphAnchor ?? EMPTY_DOCX_PARAGRAPH_ANCHOR_RESOLVER
            );
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) {
              return;
            }
            if (activeTool) {
              return;
            }
            if (didDragFieldRef.current) {
              didDragFieldRef.current = false;
              return;
            }
            fieldDrawingRef.current = null;
            fieldSelectionRef.current = null;
            setDrawingRect(null);
            setSelectionRect(null);
            setAlignmentGuides(null);
            setSelectedFieldId(null);
            setSelectedFieldIds([]);
            didDragFieldRef.current = false;
            setEditingFieldId(null);
          }}
          onKeyDown={(event) => {
            if (!activeTool || (event.key !== "Enter" && event.key !== " ")) {
              return;
            }
            event.preventDefault();
            const activePageElement = pageElement ?? event.currentTarget;
            const pageRect = activePageElement.getBoundingClientRect();
            void handlePageClick(
              {
                clientX: pageRect.left + pageRect.width / 2,
                clientY: pageRect.top + pageRect.height / 2,
              },
              activePageElement,
              pageHeight,
              pageNumber,
              pageSurfaceElement ?? null,
              pageWidth,
              resolveParagraphAnchor ?? EMPTY_DOCX_PARAGRAPH_ANCHOR_RESOLVER
            );
          }}
          role="button"
          tabIndex={activeTool ? 0 : undefined}
        >
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            data-template-field-layer="true"
            data-testid="template-workbench-field-layer"
            preserveAspectRatio="none"
            viewBox="0 0 1 1"
          >
            {pageSelectionRect ? (
              <rect
                className="pointer-events-none fill-primary/10 stroke-primary"
                data-testid="template-field-selection-rectangle"
                height={pageSelectionRect.height}
                strokeDasharray="0.008 0.006"
                strokeWidth={0.002}
                width={pageSelectionRect.width}
                x={pageSelectionRect.x}
                y={pageSelectionRect.y}
              />
            ) : null}
            {pageGuides.map((guide, index) => {
              const sameAxisIndex = pageGuides
                .slice(0, index)
                .filter((candidate) => candidate.axis === guide.axis).length;
              const testId =
                guide.axis === "vertical"
                  ? sameAxisIndex === 0
                    ? "template-field-alignment-guide-vertical"
                    : `template-field-alignment-guide-vertical-${sameAxisIndex}`
                  : sameAxisIndex === 0
                    ? "template-field-alignment-guide-horizontal"
                    : `template-field-alignment-guide-horizontal-${sameAxisIndex}`;

              return guide.axis === "vertical" ? (
                <line
                  className="pointer-events-none stroke-primary/90"
                  data-testid={testId}
                  key={`vertical-guide-${guide.position}-${index}`}
                  strokeDasharray="0.008 0.006"
                  strokeWidth={0.0015}
                  x1={guide.position}
                  x2={guide.position}
                  y1={0}
                  y2={1}
                />
              ) : (
                <line
                  className="pointer-events-none stroke-primary/90"
                  data-testid={testId}
                  key={`horizontal-guide-${guide.position}-${index}`}
                  strokeDasharray="0.008 0.006"
                  strokeWidth={0.0015}
                  x1={0}
                  x2={1}
                  y1={guide.position}
                  y2={guide.position}
                />
              );
            })}
            {pageFields.map((field) => {
              const isSelected =
                selectedFieldIds.includes(field.id) ||
                field.id === selectedFieldId;

              const label = field.name || getToolLabel(field.kind, copy);
              return (
                <g
                  aria-label={label}
                  aria-pressed={isSelected}
                  className={cn(
                    "pointer-events-auto touch-none outline-none",
                    isSelected ? "cursor-move" : "cursor-pointer"
                  )}
                  data-testid={`template-field-${field.id}`}
                  data-field-mode={
                    editingFieldId === field.id ? "editing" : "move"
                  }
                  key={field.id}
                  onPointerDownCapture={clearNativeTextSelection}
                  onClick={(event) => {
                    if (interactionMode !== "select") {
                      return;
                    }
                    event.stopPropagation();
                    setAlignmentGuides(null);
                    if (didDragFieldRef.current) {
                      didDragFieldRef.current = false;
                      setSelectedFieldId(field.id);
                      setSelectedFieldIds([field.id]);
                      setEditingFieldId(null);
                      setActiveTool(null);
                      return;
                    }
                    setSelectedFieldId(field.id);
                    setSelectedFieldIds([field.id]);
                    setEditingFieldId(field.id);
                    setActiveTool(null);
                  }}
                  onPointerDown={(event) =>
                    (() => {
                      const fieldPageElement =
                        pageElement ??
                        event.currentTarget.closest<HTMLElement>(
                          '[data-testid="template-workbench-page-overlay"]'
                        );
                      if (!fieldPageElement) {
                        return;
                      }
                      beginFieldInteraction(
                        event,
                        field,
                        fieldPageElement,
                        pageHeight,
                        pageWidth,
                        "move"
                      );
                    })()
                  }
                  onKeyDown={(event) => {
                    if (interactionMode !== "select") {
                      return;
                    }
                    if (event.key !== "Enter" && event.key !== " ") {
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    didDragFieldRef.current = false;
                    setSelectedFieldId(field.id);
                    setSelectedFieldIds([field.id]);
                    setEditingFieldId(field.id);
                    setActiveTool(null);
                  }}
                  role="button"
                  pointerEvents="all"
                  tabIndex={0}
                >
                  <title>{label}</title>
                  <rect
                    className={cn(
                      "fill-transparent stroke-transparent",
                      field.kind === "MASK" && "fill-white stroke-destructive"
                    )}
                    data-testid={`template-field-geometry-${field.id}`}
                    height={field.height}
                    onPointerDown={(event) => {
                      const fieldPageElement =
                        pageElement ??
                        event.currentTarget.closest<HTMLElement>(
                          '[data-testid="template-workbench-page-overlay"]'
                        );
                      if (!fieldPageElement) {
                        return;
                      }
                      beginFieldInteraction(
                        event,
                        field,
                        fieldPageElement,
                        pageHeight,
                        pageWidth
                      );
                    }}
                    onMouseDown={(event) => {
                      const fieldPageElement =
                        pageElement ??
                        event.currentTarget.closest<HTMLElement>(
                          '[data-testid="template-workbench-page-overlay"]'
                        );
                      if (!fieldPageElement) {
                        return;
                      }
                      beginFieldInteraction(
                        event as unknown as FieldInteractionStartEvent,
                        field,
                        fieldPageElement,
                        pageHeight,
                        pageWidth
                      );
                    }}
                    pointerEvents="all"
                    rx={0.004}
                    strokeWidth={0.002}
                    width={field.width}
                    x={field.x}
                    y={field.y}
                  />
                  {isSelected ? (
                    <>
                      {(
                        [
                          {
                            cursor: "cursor-nwse-resize",
                            edges: {
                              bottom: false,
                              left: true,
                              right: false,
                              top: true,
                            },
                            handle: "top-left",
                            height: RESIZE_HANDLE_SIZE,
                            width: RESIZE_HANDLE_SIZE,
                            x:
                              field.x -
                              RESIZE_HANDLE_SIZE +
                              RESIZE_HANDLE_INSIDE,
                            y:
                              field.y -
                              RESIZE_HANDLE_SIZE +
                              RESIZE_HANDLE_INSIDE,
                          },
                          {
                            cursor: "cursor-ns-resize",
                            edges: {
                              bottom: false,
                              left: false,
                              right: false,
                              top: true,
                            },
                            handle: "top",
                            height: RESIZE_HANDLE_SIZE,
                            width: field.width,
                            x: field.x,
                            y:
                              field.y -
                              RESIZE_HANDLE_SIZE +
                              RESIZE_HANDLE_INSIDE,
                          },
                          {
                            cursor: "cursor-nesw-resize",
                            edges: {
                              bottom: false,
                              left: false,
                              right: true,
                              top: true,
                            },
                            handle: "top-right",
                            height: RESIZE_HANDLE_SIZE,
                            width: RESIZE_HANDLE_SIZE,
                            x:
                              field.x +
                              field.width -
                              RESIZE_HANDLE_SIZE +
                              RESIZE_HANDLE_INSIDE,
                            y:
                              field.y -
                              RESIZE_HANDLE_SIZE +
                              RESIZE_HANDLE_INSIDE,
                          },
                          {
                            cursor: "cursor-ew-resize",
                            edges: {
                              bottom: false,
                              left: true,
                              right: false,
                              top: false,
                            },
                            handle: "left",
                            height: field.height,
                            width: RESIZE_HANDLE_SIZE,
                            x:
                              field.x -
                              RESIZE_HANDLE_SIZE +
                              RESIZE_HANDLE_INSIDE,
                            y: field.y,
                          },
                          {
                            cursor: "cursor-ew-resize",
                            edges: {
                              bottom: false,
                              left: false,
                              right: true,
                              top: false,
                            },
                            handle: "right",
                            height: field.height,
                            width: RESIZE_HANDLE_SIZE,
                            x:
                              field.x +
                              field.width -
                              RESIZE_HANDLE_SIZE +
                              RESIZE_HANDLE_INSIDE,
                            y: field.y,
                          },
                          {
                            cursor: "cursor-nesw-resize",
                            edges: {
                              bottom: true,
                              left: true,
                              right: false,
                              top: false,
                            },
                            handle: "bottom-left",
                            height: RESIZE_HANDLE_SIZE,
                            width: RESIZE_HANDLE_SIZE,
                            x:
                              field.x -
                              RESIZE_HANDLE_SIZE +
                              RESIZE_HANDLE_INSIDE,
                            y:
                              field.y +
                              field.height -
                              RESIZE_HANDLE_SIZE +
                              RESIZE_HANDLE_INSIDE,
                          },
                          {
                            cursor: "cursor-ns-resize",
                            edges: {
                              bottom: true,
                              left: false,
                              right: false,
                              top: false,
                            },
                            handle: "bottom",
                            height: RESIZE_HANDLE_SIZE,
                            width: field.width,
                            x: field.x,
                            y:
                              field.y +
                              field.height -
                              RESIZE_HANDLE_SIZE +
                              RESIZE_HANDLE_INSIDE,
                          },
                          {
                            cursor: "cursor-nwse-resize",
                            edges: {
                              bottom: true,
                              left: false,
                              right: true,
                              top: false,
                            },
                            handle: "corner",
                            height: RESIZE_HANDLE_SIZE,
                            width: RESIZE_HANDLE_SIZE,
                            x:
                              field.x +
                              field.width -
                              RESIZE_HANDLE_SIZE +
                              RESIZE_HANDLE_INSIDE,
                            y:
                              field.y +
                              field.height -
                              RESIZE_HANDLE_SIZE +
                              RESIZE_HANDLE_INSIDE,
                          },
                        ] as const
                      ).map(
                        ({ cursor, edges, handle, height, width, x, y }) => (
                          <rect
                            className={cn(
                              "pointer-events-auto fill-transparent stroke-transparent",
                              cursor
                            )}
                            data-testid={`template-field-resize-handle-${handle}`}
                            fill="transparent"
                            height={height}
                            key={handle}
                            onPointerDown={(event) => {
                              const fieldPageElement =
                                pageElement ??
                                event.currentTarget.closest<HTMLElement>(
                                  '[data-testid="template-workbench-page-overlay"]'
                                );
                              if (!fieldPageElement) {
                                return;
                              }
                              beginFieldInteraction(
                                event,
                                field,
                                fieldPageElement,
                                pageHeight,
                                pageWidth,
                                "resize",
                                edges
                              );
                            }}
                            onMouseDown={(event) => {
                              const fieldPageElement =
                                pageElement ??
                                event.currentTarget.closest<HTMLElement>(
                                  '[data-testid="template-workbench-page-overlay"]'
                                );
                              if (!fieldPageElement) {
                                return;
                              }
                              beginFieldInteraction(
                                event as unknown as FieldInteractionStartEvent,
                                field,
                                fieldPageElement,
                                pageHeight,
                                pageWidth,
                                "resize",
                                edges
                              );
                            }}
                            pointerEvents="all"
                            rx={0.002}
                            stroke="transparent"
                            strokeWidth={0}
                            width={width}
                            x={x}
                            y={y}
                          />
                        )
                      )}
                      <rect
                        className="pointer-events-auto cursor-move fill-transparent stroke-transparent"
                        data-testid="template-field-move-target"
                        fill="transparent"
                        height={Math.max(
                          field.height - FIELD_MOVE_TARGET_INSET * 2,
                          0.001
                        )}
                        onMouseDown={(event) => {
                          const fieldPageElement =
                            pageElement ??
                            event.currentTarget.closest<HTMLElement>(
                              '[data-testid="template-workbench-page-overlay"]'
                            );
                          if (!fieldPageElement) {
                            return;
                          }
                          beginFieldInteraction(
                            event as unknown as FieldInteractionStartEvent,
                            field,
                            fieldPageElement,
                            pageHeight,
                            pageWidth
                          );
                        }}
                        onPointerDown={(event) => {
                          const fieldPageElement =
                            pageElement ??
                            event.currentTarget.closest<HTMLElement>(
                              '[data-testid="template-workbench-page-overlay"]'
                            );
                          if (!fieldPageElement) {
                            return;
                          }
                          beginFieldInteraction(
                            event,
                            field,
                            fieldPageElement,
                            pageHeight,
                            pageWidth
                          );
                        }}
                        pointerEvents="all"
                        stroke="transparent"
                        strokeWidth={0}
                        width={Math.max(
                          field.width - FIELD_MOVE_TARGET_INSET * 2,
                          0.001
                        )}
                        x={field.x + FIELD_MOVE_TARGET_INSET}
                        y={field.y + FIELD_MOVE_TARGET_INSET}
                      />
                    </>
                  ) : null}
                </g>
              );
            })}
          </svg>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            data-template-prompt-layer="true"
          >
            {pageDrawingRect ? (
              <div
                className="absolute border-[3px] border-primary bg-transparent shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_30%,transparent)]"
                data-testid="template-field-drawing-preview"
                style={{
                  height: `${pageDrawingRect.height * 100}%`,
                  left: `${pageDrawingRect.x * 100}%`,
                  top: `${pageDrawingRect.y * 100}%`,
                  width: `${pageDrawingRect.width * 100}%`,
                }}
              >
                {[
                  ["top-left", "-top-1.5 -left-1.5"],
                  ["top", "-top-1.5 left-1/2 -translate-x-1/2"],
                  ["top-right", "-top-1.5 -right-1.5"],
                  ["left", "top-1/2 -left-1.5 -translate-y-1/2"],
                  ["right", "top-1/2 -right-1.5 -translate-y-1/2"],
                  ["bottom-left", "-bottom-1.5 -left-1.5"],
                  ["bottom", "-bottom-1.5 left-1/2 -translate-x-1/2"],
                  ["bottom-right", "-right-1.5 -bottom-1.5"],
                ].map(([name, position]) => (
                  <span
                    aria-hidden="true"
                    className={cn("absolute size-3.5", position)}
                    data-testid={`template-field-drawing-handle-${name}`}
                    key={name}
                  >
                    <span
                      className={cn(
                        "absolute rounded-full border border-primary bg-white",
                        inspectorStyles.resizeHandleDot
                      )}
                    />
                  </span>
                ))}
              </div>
            ) : null}
            {pageFields.map((field) => {
              const isSelected =
                selectedFieldIds.includes(field.id) ||
                field.id === selectedFieldId;
              if (isSelected) {
                return null;
              }
              return (
                <div
                  className={cn(
                    "absolute border-2 border-dashed bg-transparent shadow-[0_0_0_1px_rgba(255,255,255,0.75)]",
                    field.kind === "MASK"
                      ? "border-destructive/70"
                      : "border-primary/90"
                  )}
                  data-testid={`template-field-idle-box-${field.id}`}
                  key={field.id}
                  style={{
                    height: `${field.height * 100}%`,
                    left: `${field.x * 100}%`,
                    top: `${field.y * 100}%`,
                    width: `${field.width * 100}%`,
                  }}
                />
              );
            })}
            {pageFields.map((field) => {
              const prompt = field.placeholder.trim();
              if (!prompt || field.kind === "MASK") {
                return null;
              }
              return (
                <div
                  className={cn(
                    "absolute flex items-center overflow-hidden px-[0.9%] text-black",
                    field.kind === "STATIC_TEXT"
                      ? "leading-tight whitespace-pre-wrap"
                      : "whitespace-nowrap",
                    field.kind === "RADIO" && "pr-5"
                  )}
                  data-testid={`template-field-prompt-${field.id}`}
                  key={field.id}
                  style={{
                    height: `${field.height * 100}%`,
                    left: `${field.x * 100}%`,
                    top: `${field.y * 100}%`,
                    width: `${field.width * 100}%`,
                    ...getConfirmationTemplateFieldTextStyleCss(
                      field.textStyle,
                      pageHeight,
                      isPdfTemplate ? scale : undefined,
                      pageWidth,
                      field.height,
                      field.width,
                      prompt,
                      field.kind === "MULTILINE"
                    ),
                    ...getConfirmationTemplateFlexAlignmentCss(field.textAlign),
                  }}
                >
                  {prompt}
                  {field.kind === "RADIO" ? (
                    <ChevronDown
                      aria-hidden="true"
                      className="absolute top-1/2 right-1 size-3 -translate-y-1/2"
                    />
                  ) : null}
                </div>
              );
            })}
            {pageFields.map((field) => {
              const isSelected =
                selectedFieldIds.includes(field.id) ||
                field.id === selectedFieldId;
              if (!isSelected) {
                return null;
              }
              const handles = [
                {
                  className: "-top-1.5 -left-1.5 cursor-nwse-resize",
                  edges: { bottom: false, left: true, right: false, top: true },
                  name: "top-left",
                },
                {
                  className:
                    "-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize",
                  edges: {
                    bottom: false,
                    left: false,
                    right: false,
                    top: true,
                  },
                  name: "top",
                },
                {
                  className: "-top-1.5 -right-1.5 cursor-nesw-resize",
                  edges: { bottom: false, left: false, right: true, top: true },
                  name: "top-right",
                },
                {
                  className:
                    "top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize",
                  edges: {
                    bottom: false,
                    left: true,
                    right: false,
                    top: false,
                  },
                  name: "left",
                },
                {
                  className:
                    "top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize",
                  edges: {
                    bottom: false,
                    left: false,
                    right: true,
                    top: false,
                  },
                  name: "right",
                },
                {
                  className: "-bottom-1.5 -left-1.5 cursor-nesw-resize",
                  edges: { bottom: true, left: true, right: false, top: false },
                  name: "bottom-left",
                },
                {
                  className:
                    "-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize",
                  edges: {
                    bottom: true,
                    left: false,
                    right: false,
                    top: false,
                  },
                  name: "bottom",
                },
                {
                  className: "-right-1.5 -bottom-1.5 cursor-nwse-resize",
                  edges: { bottom: true, left: false, right: true, top: false },
                  name: "bottom-right",
                },
              ] as const;
              return (
                <div
                  className={cn(
                    "pointer-events-none absolute z-30 border-[3px] border-primary bg-transparent",
                    isFieldDragging &&
                      "shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_30%,transparent)]"
                  )}
                  data-testid={`template-field-selection-box-${field.id}`}
                  key={field.id}
                  style={{
                    height: `${field.height * 100}%`,
                    left: `${field.x * 100}%`,
                    top: `${field.y * 100}%`,
                    width: `${field.width * 100}%`,
                  }}
                >
                  {handles.map(({ className, edges, name }) => (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-auto absolute size-3.5",
                        className
                      )}
                      data-testid={`template-field-visible-handle-${name}`}
                      key={name}
                      onPointerDown={(event) => {
                        const fieldPageElement =
                          pageElement ??
                          event.currentTarget.closest<HTMLElement>(
                            '[data-testid="template-workbench-page-overlay"]'
                          );
                        if (!fieldPageElement) {
                          return;
                        }
                        beginFieldInteraction(
                          event,
                          field,
                          fieldPageElement,
                          pageHeight,
                          pageWidth,
                          "resize",
                          edges
                        );
                      }}
                    >
                      <span
                        className={cn(
                          "pointer-events-none absolute rounded-full border border-primary bg-white",
                          inspectorStyles.resizeHandleDot
                        )}
                      />
                    </span>
                  ))}
                  <Button
                    aria-label={copy.fieldSettings.deleteField}
                    className={cn(
                      "pointer-events-auto absolute top-1/2 -translate-y-1/2 rounded-sm border border-primary/50 bg-white text-primary hover:bg-white hover:text-destructive",
                      inspectorStyles.fieldDeleteAction
                    )}

                    onClick={(event) => {
                      event.stopPropagation();
                      deleteFieldById(field.id);
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    size="icon-xs"
                    type="button"
                  >
                    <X />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      );
    },
    [
      activeTool,
      beginFieldInteraction,
      refreshPageTextBlocks,
      beginFieldDrawing,
      beginFieldSelection,
      copy,
      deleteFieldById,
      drawingRect,
      alignmentGuides,
      editingFieldId,
      fields,
      handlePageClick,
      interactionMode,
      isFieldDragging,
      isPdfTemplate,
      previewMode,
      previewValues,
      selectedFieldId,
      selectedFieldIds,
      selectionRect,
    ]
  );
  const handleDeleteField = useCallback(() => {
    if (editingDisabled || !selectedFieldId) {
      return;
    }
    deleteFieldById(selectedFieldId);
  }, [deleteFieldById, editingDisabled, selectedFieldId]);
  useEffect(() => {
    const handleDeleteShortcut = (event: KeyboardEvent) => {
      const isDeleteKey =
        event.key === "Delete" ||
        event.key === "Backspace" ||
        event.code === "Delete" ||
        event.code === "Backspace";
      if (!isDeleteKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        typeof target.closest === "function" &&
        target.closest("input, textarea, [contenteditable='true']")
      ) {
        return;
      }
      if (!selectedFieldId || editingDisabledRef.current) {
        return;
      }
      event.preventDefault();
      handleDeleteField();
    };

    window.addEventListener("keydown", handleDeleteShortcut);
    return () => window.removeEventListener("keydown", handleDeleteShortcut);
  }, [handleDeleteField, selectedFieldId]);

  const handleAddOption = useCallback(() => {
    if (
      editingDisabled ||
      !selectedField ||
      (selectedField.kind !== "SELECT" && selectedField.kind !== "RADIO")
    ) {
      return;
    }
    const optionValues = new Set(
      selectedField.options.map((option) => option.trim())
    );
    let nextOption = copy.defaults.option;
    let optionNumber = 2;
    while (optionValues.has(nextOption)) {
      nextOption = `${copy.defaults.option} ${optionNumber}`;
      optionNumber += 1;
    }
    updateField(selectedField.id, {
      options: [...selectedField.options, nextOption],
    });
  }, [copy.defaults.option, editingDisabled, selectedField, updateField]);
  const handleSave = useCallback(
    async (nextStatus: SaveStatus) => {
      if (editingDisabled) {
        return;
      }

      const designSchema = sanitizeDesign(fields);
      const validationError = validateDesign(designSchema, copy);
      if (validationError) {
        setSaveError(validationError);
        return;
      }

      setSaveError(null);
      setSavingStatus(nextStatus);
      try {
        await onSave({ designSchema, designStatus: nextStatus });
        setFields(fields);
        setDesignStatus(nextStatus);
        setIsDirty(false);
      } catch {
        setSaveError(copy.saveError);
      } finally {
        setSavingStatus(null);
      }
    },
    [copy, editingDisabled, fields, onSave]
  );
  const handleBack = useCallback(() => {
    if (savingStatus !== null) {
      return;
    }
    if (isDirty) {
      setBackConfirmationOpen(true);
      return;
    }
    onBack();
  }, [isDirty, onBack, savingStatus]);
  const handleDiscardChanges = useCallback(() => {
    if (savingStatus !== null) {
      return;
    }
    setBackConfirmationOpen(false);
    setIsDirty(false);
    onBack();
  }, [onBack, savingStatus]);
  const restoreHistorySnapshot = useCallback(
    (snapshot: ConfirmationTemplateDesignField[]) => {
      historyApplyingRef.current = true;
      historyCurrentRef.current = snapshot;
      fieldsRef.current = snapshot;
      setFields(snapshot);
      setSelectedFieldId(null);
      setSelectedFieldIds([]);
      setEditingFieldId(null);
      setAlignmentGuides(null);
      setIsDirty(true);
      setHistoryAvailability({
        canUndo: undoStackRef.current.length > 0,
        canRedo: redoStackRef.current.length > 0,
      });
    },
    []
  );
  const handleUndo = useCallback(() => {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) {
      return;
    }
    redoStackRef.current.push(fieldsRef.current);
    restoreHistorySnapshot(snapshot);
  }, [restoreHistorySnapshot]);
  const handleRedo = useCallback(() => {
    const snapshot = redoStackRef.current.pop();
    if (!snapshot) {
      return;
    }
    undoStackRef.current.push(fieldsRef.current);
    restoreHistorySnapshot(snapshot);
  }, [restoreHistorySnapshot]);
  const handleCutField = useCallback(() => {
    if (!selectedField) {
      return;
    }
    handleCopyField();
    deleteFieldById(selectedField.id);
  }, [deleteFieldById, handleCopyField, selectedField]);
  const selectedTextStyle =
    selectedField && selectedField.kind !== "MASK"
      ? getFieldTextStyle(selectedField.textStyle)
      : null;
  const selectionTextStyle = selectedTextFields[0]
    ? getFieldTextStyle(selectedTextFields[0].textStyle)
    : null;
  const mixedStyleLabel = copy.fieldSettings.mixed ?? "Mixed";
  const isMixedTextStyle = (key: keyof ConfirmationTemplateTextStyle) =>
    selectedTextFields.some(
      (field) =>
        getFieldTextStyle(field.textStyle)[key] !== selectionTextStyle?.[key]
    );
  const selectionTextAlign =
    selectedTextFields.length > 0 &&
    selectedTextFields.every(
      (field) =>
        (field.textAlign ?? "left") ===
        (selectedTextFields[0].textAlign ?? "left")
    )
      ? (selectedTextFields[0].textAlign ?? "left")
      : null;
  const { canUndo, canRedo } = historyAvailability;

  useEffect(() => {
    if (
      !formatPainter ||
      !selectedField ||
      selectedField.kind === "MASK" ||
      selectedField.id === formatPainter.sourceFieldId
    ) {
      return;
    }
    updateField(selectedField.id, {
      textStyle: { ...formatPainter.textStyle },
    });
    setFormatPainter(null);
  }, [formatPainter, selectedField, updateField]);

  return (
    <div
      aria-busy={savingStatus !== null}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground"
      ref={workbenchRef}
      data-testid="template-workbench"
    >
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3">
        <Button
          aria-label={copy.back}
          disabled={savingStatus !== null}
          onClick={handleBack}
          type="button"
          variant="ghost"
        >
          <ArrowLeft />
          {copy.back}
        </Button>
        <Separator orientation="vertical" className="hidden h-8 sm:block" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{template.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {template.fileName}
          </div>
        </div>
        <Badge
          className={cn(
            designStatus === "ENABLED" &&
              "border-success/40 bg-success/10 text-success"
          )}
          variant={designStatus === "ENABLED" ? "outline" : "secondary"}
        >
          {designStatus === "ENABLED" ? <CircleCheckBig /> : null}
          {designStatus === "DISABLED"
            ? copy.disabled
            : designStatus === "ENABLED"
              ? copy.enabled
              : copy.draft}
        </Badge>
        <ButtonGroup>
          <Button
            aria-pressed={previewMode}
            disabled={editingDisabled}
            onClick={() => {
              setPreviewValues({});
              setPreviewMode((current) => !current);
              setSelectedFieldId(null);
              setSelectedFieldIds([]);
              setEditingFieldId(null);
              setActiveTool(null);
            }}
            type="button"
            variant="outline"
          >
            <Eye />
            {previewMode ? copy.returnToEdit : copy.previewFill}
          </Button>
          <Button
            disabled={editingDisabled}
            onClick={() => handleSave("DRAFT")}
            type="button"
            variant="outline"
          >
            <Save />
            {savingStatus === "DRAFT" ? copy.saving : copy.saveDraft}
          </Button>
          <Button
            disabled={editingDisabled}
            onClick={() => handleSave("ENABLED")}
            type="button"
          >
            <Check />
            {savingStatus === "ENABLED" ? copy.saving : copy.enable}
          </Button>
        </ButtonGroup>
      </header>

      <div className="min-h-0 flex-1">
        <div
          className="flex h-full min-h-0 overflow-hidden"
          data-testid="template-workbench-content-layout"
        >
          <div className="min-w-0 flex-1 bg-muted/10">
            <section className="flex h-full min-h-0 flex-col">
              <div className="relative min-h-0 flex-1 p-2">
                {showRulers ? (
                  <>
                    <div
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none absolute top-2 right-2 left-8 z-40 h-4 border-b border-border/70 bg-background/90",
                        inspectorStyles.horizontalRuler
                      )}
                      data-testid="template-workbench-horizontal-ruler"
                    />
                    <div
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none absolute top-6 bottom-2 left-2 z-40 w-4 border-r border-border/70 bg-background/90",
                        inspectorStyles.verticalRuler
                      )}
                      data-testid="template-workbench-vertical-ruler"
                    />
                  </>
                ) : null}
                {isLoading ? (
                  <div
                    className="space-y-4 p-4"
                    aria-busy="true"
                    aria-label={copy.loading}
                  >
                    <Skeleton className="h-8 w-1/3 rounded-md" />
                    <Skeleton className="h-24 w-full rounded-md" />
                    <Skeleton className="h-48 w-full rounded-md" />
                  </div>
                ) : loadError || !sourceUrl ? (
                  <div
                    className="flex h-full items-center justify-center text-sm text-destructive"
                    role="alert"
                  >
                    {copy.loadError}
                  </div>
                ) : isPdfTemplate ? (
                  <PDFViewer
                    autoFitWidth={autoFitWidth}
                    className="h-full min-h-0 rounded-lg border border-border/60 bg-background"
                    defaultZoom={1}
                    fileName={template.fileName.replace(/\.[^.]+$/u, ".pdf")}
                    renderPageOverlay={renderPageOverlay}
                    showDownload={false}
                    showRotateControls
                    showToolbar
                    showUpload={false}
                    src={sourceUrl}
                    interactionMode={interactionMode}
                    textSelectionEnabled={!isFieldDragging}
                  />
                ) : (
                  <DocxViewerPreview
                    autoFitWidth={autoFitWidth}
                    className="h-full min-h-0 rounded-lg border border-border/60 bg-background"
                    defaultZoom={100}
                    fileName={template.fileName}
                    isDark={isDark}
                    onIsDarkChange={setIsDark}
                    onZoomScaleChange={setPreviewZoom}
                    panModeInitiallyEnabled={false}
                    renderPageOverlay={renderPageOverlay}
                    showDownload={false}
                    showPanControl
                    showSelectionControl
                    showToolbar
                    showUpload={false}
                    src={sourceUrl}
                    zoomScale={previewZoom}
                  />
                )}
              </div>
            </section>
          </div>

          {previewMode ? null : (
            <aside
              aria-label={copy.fieldSettings.title}
              className={cn(
                "confirmation-template-sidebar h-full min-w-0 shrink-0 border-l border-border/60 bg-workbench-sidebar",
                inspectorStyles.inspector
              )}

              data-testid="template-workbench-inspector"
            >
              <div
                className={cn("sidebar-canvas", inspectorStyles.canvasSection)}

                role="group"
                aria-label={copy.tools.pageTitle}
              >
                <h3
                  className={cn(
                    "text-muted-foreground",
                    inspectorStyles.canvasHeading
                  )}
                >
                  {copy.sidebarTabs.canvas}
                  <span
                    className={inspectorStyles.headingDivider}
                    aria-hidden="true"
                  />
                </h3>
                <ButtonGroup
                  className="mt-1 w-full justify-center"
                  aria-label={copy.preview}
                >
                  <Button
                    aria-label={copy.tools.selectMode ?? copy.tools.select}
                    aria-pressed={interactionMode === "select"}
                    disabled={editingDisabled}
                    onClick={() => setInteractionMode("select")}
                    className="sidebar-command"
                    size="icon-sm"
                    type="button"
                    variant={
                      interactionMode === "select" ? "secondary" : "ghost"
                    }
                  >
                    <MousePointer2 className="size-4" />
                  </Button>
                  <Button
                    aria-label={copy.tools.panMode ?? copy.tools.select}
                    aria-pressed={interactionMode === "pan"}
                    disabled={editingDisabled}
                    onClick={() => {
                      setInteractionMode("pan");
                      setActiveTool(null);
                      setEditingFieldId(null);
                    }}
                    className="sidebar-command"
                    size="icon-sm"
                    type="button"
                    variant={interactionMode === "pan" ? "secondary" : "ghost"}
                  >
                    <Hand className="size-4" />
                  </Button>
                </ButtonGroup>
                <ButtonGroup className="mt-0.5 flex-col items-center gap-0">
                  <Button
                    aria-pressed={autoFitWidth}
                    className="sidebar-command"
                    onClick={() => setAutoFitWidth((current) => !current)}
                    size="sm"
                    type="button"
                    variant={autoFitWidth ? "secondary" : "ghost"}
                  >
                    <Maximize2 className="size-4" />
                    {copy.tools.fitWidth}
                  </Button>
                  <Button
                    aria-pressed={showRulers}
                    className="sidebar-command"
                    onClick={() => setShowRulers((current) => !current)}
                    size="sm"
                    type="button"
                    variant={showRulers ? "secondary" : "ghost"}
                  >
                    <Ruler className="size-4" />
                    {copy.tools.showRuler}
                  </Button>
                </ButtonGroup>
                <ButtonGroup className="mt-0.5 flex-col items-center gap-0">
                  <Button
                    className="sidebar-command"
                    disabled={!selectedField}
                    onClick={() => {
                      setSelectedFieldId(null);
                      setSelectedFieldIds([]);
                      setEditingFieldId(null);
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <X className="size-4" />
                    {copy.tools.clearSelection}
                  </Button>
                </ButtonGroup>
              </div>
              <h3
                className={cn(
                  "text-muted-foreground",
                  inspectorStyles.sectionHeading
                )}
              >
                {copy.sidebarTabs.actions}
                <span
                  className={inspectorStyles.headingDivider}
                  aria-hidden="true"
                />
              </h3>
              <div
                className="sidebar-actions"
                role="toolbar"
                aria-label={copy.tools.title}
              >
                <Button
                  aria-label={copy.tools.undo}
                  className="sidebar-command"
                  disabled={editingDisabled || !canUndo}
                  onClick={handleUndo}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Undo2 className="size-4" />
                </Button>
                <Button
                  aria-label={copy.tools.redo}
                  className="sidebar-command"
                  disabled={editingDisabled || !canRedo}
                  onClick={handleRedo}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Redo2 className="size-4" />
                </Button>

                <Button
                  aria-label={copy.fieldSettings.pasteField}
                  className="sidebar-command"
                  disabled={editingDisabled || !clipboardField}
                  onClick={handlePasteField}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <ClipboardPaste className="size-4" />
                  <span>{copy.fieldSettings.pasteField}</span>
                </Button>

                <Button
                  aria-label={copy.tools.cut}
                  className="sidebar-command"
                  disabled={editingDisabled || !selectedField}
                  onClick={handleCutField}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  <Scissors className="size-3.5" />
                  <span>{copy.tools.cut}</span>
                </Button>
                <Button
                  aria-label={copy.fieldSettings.copyField}
                  className="sidebar-command"
                  disabled={editingDisabled || !selectedField}
                  onClick={handleCopyField}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  <Copy className="size-3.5" />
                  <span>{copy.fieldSettings.copyField}</span>
                </Button>
                <Button
                  aria-label={copy.tools.formatPainter}
                  aria-pressed={formatPainter !== null}
                  className="sidebar-command"
                  disabled={
                    editingDisabled || !selectedField || !selectedTextStyle
                  }
                  onClick={() => {
                    if (!(selectedField && selectedTextStyle)) {
                      return;
                    }
                    setFormatPainter({
                      sourceFieldId: selectedField.id,
                      textStyle: { ...selectedTextStyle },
                    });
                  }}
                  size="xs"
                  type="button"
                  variant={formatPainter ? "secondary" : "ghost"}
                >
                  <Paintbrush className="size-3.5" />
                  <span>{copy.tools.formatPainter}</span>
                </Button>
              </div>
              <h3
                className={cn(
                  "text-muted-foreground",
                  inspectorStyles.sectionHeading
                )}
              >
                {copy.sidebarTabs.insert}
                <span
                  className={inspectorStyles.headingDivider}
                  aria-hidden="true"
                />
              </h3>
              <div
                id="template-sidebar-insert"
                role="group"
                aria-label={copy.sidebarTabs.insert}
                className="sidebar-panel sidebar-insert"
                data-testid="template-workbench-insert-group"
              >
                <ButtonGroup className="flex w-full flex-nowrap justify-center gap-1">
                  {(
                    [
                      ["TEXT", Type, copy.tools.text],
                      ["MULTILINE", AlignLeft, copy.tools.multiline],
                      ["STATIC_TEXT", TextQuote, copy.tools.staticText],
                      ["RADIO", CircleDot, copy.tools.radio],
                      ["NUMBER", Hash, copy.tools.number],
                      ["DATE", CalendarDays, copy.tools.date],
                    ] as const
                  ).map(([tool, Icon, label]) => (
                    <Button
                      aria-pressed={activeTool === tool}
                      className="sidebar-command"
                      disabled={editingDisabled}
                      key={tool}
                      onClick={() => {
                        setInteractionMode("select");
                        setSelectedFieldId(null);
                        setSelectedFieldIds([]);
                        setEditingFieldId(null);
                        setActiveTool((currentTool) =>
                          currentTool === tool ? null : tool
                        );
                      }}
                      size="sm"
                      type="button"
                      variant={activeTool === tool ? "secondary" : "ghost"}
                    >
                      <Icon className="size-4" />
                      <span>{label}</span>
                    </Button>
                  ))}
                </ButtonGroup>
              </div>
              <h3
                className={cn(
                  "text-muted-foreground",
                  inspectorStyles.sectionHeading
                )}
              >
                {copy.sidebarTabs.style}
                <span
                  className={inspectorStyles.headingDivider}
                  aria-hidden="true"
                />
              </h3>
              <div
                id="template-sidebar-style"
                role="group"
                aria-label={copy.sidebarTabs.style}
                className="sidebar-panel sidebar-style"
              >
                <div className="mt-0.5 grid justify-items-center gap-0">
                  <div className="flex items-center gap-1">
                    <Select
                      disabled={editingDisabled || !selectionTextStyle}
                      open={ribbonFontFamilyOpen}
                      onOpenChange={setRibbonFontFamilyOpen}
                      value={
                        isMixedTextStyle("fontFamily")
                          ? null
                          : (selectionTextStyle?.fontFamily ?? "Noto Sans SC")
                      }
                      onValueChange={(value) => {
                        if (!selectionTextStyle) {
                          return;
                        }
                        const fontFamily =
                          WORKBENCH_TEMPLATE_FONT_FAMILIES.find(
                            (candidate) => candidate === value
                          );
                        if (!fontFamily) {
                          return;
                        }
                        updateSelectedTextFields({ fontFamily });
                        setRibbonFontFamilyOpen(false);
                      }}
                    >
                      <SelectTrigger
                        aria-label={copy.fieldSettings.fontFamily}
                        className="ribbon-input h-6 w-28 py-0"
                        id="template-workbench-ribbon-font-family"
                      >
                        <SelectValue placeholder={mixedStyleLabel} />
                      </SelectTrigger>
                      <SelectContent
                        align="start"
                        alignItemWithTrigger={false}
                        collisionAvoidance={
                          FORCE_DOWN_SELECT_COLLISION_AVOIDANCE
                        }
                        side="bottom"
                        sideOffset={4}
                      >
                        {WORKBENCH_TEMPLATE_FONT_FAMILIES.map((fontFamily) => (
                          <SelectItem key={fontFamily} value={fontFamily}>
                            {copy.fieldSettings.fontFamilyOptions[fontFamily] ??
                              fontFamily}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      disabled={editingDisabled || !selectionTextStyle}
                      open={ribbonFontSizeOpen}
                      onOpenChange={setRibbonFontSizeOpen}
                      value={
                        isMixedTextStyle("fontSize")
                          ? null
                          : String(
                              selectionTextStyle?.fontSize ??
                                DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE.fontSize
                            )
                      }
                      onValueChange={(value) => {
                        if (!selectionTextStyle) {
                          return;
                        }
                        updateSelectedTextFields({
                          fontSize: getFontSize(value ?? ""),
                        });
                        setRibbonFontSizeOpen(false);
                      }}
                    >
                      <SelectTrigger
                        aria-label={copy.fieldSettings.fontSize}
                        className="ribbon-input h-6 w-16 py-0"
                        id="template-workbench-ribbon-font-size"
                      >
                        <SelectValue placeholder={mixedStyleLabel} />
                      </SelectTrigger>
                      <SelectContent
                        align="start"
                        alignItemWithTrigger={false}
                        collisionAvoidance={
                          FORCE_DOWN_SELECT_COLLISION_AVOIDANCE
                        }
                        side="bottom"
                        sideOffset={4}
                      >
                        {CONFIRMATION_TEMPLATE_FONT_SIZES.map((fontSize) => (
                          <SelectItem key={fontSize} value={String(fontSize)}>
                            {copy.fieldSettings.fontSizeOptions[
                              String(fontSize)
                            ] ?? `${fontSize} pt`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <ButtonGroup className="h-5 gap-0.5">
                    {(
                      [
                        ["bold", Bold, copy.fieldSettings.bold],
                        ["italic", Italic, copy.fieldSettings.italic],
                        ["underline", Underline, copy.fieldSettings.underline],
                      ] as const
                    ).map(([styleKey, Icon, label]) => (
                      <Button
                        aria-label={label}
                        aria-pressed={
                          isMixedTextStyle(styleKey)
                            ? "mixed"
                            : (selectionTextStyle?.[styleKey] ?? false)
                        }
                        title={
                          isMixedTextStyle(styleKey)
                            ? `${label}: ${mixedStyleLabel}`
                            : label
                        }
                        disabled={editingDisabled || !selectionTextStyle}
                        className="sidebar-format-command"
                        key={styleKey}
                        onClick={() => {
                          if (!selectionTextStyle) {
                            return;
                          }
                          updateSelectedTextFields({
                            [styleKey]:
                              isMixedTextStyle(styleKey) ||
                              !selectionTextStyle[styleKey],
                          });
                        }}
                        size="icon-xs"
                        type="button"
                        variant={
                          !isMixedTextStyle(styleKey) &&
                          selectionTextStyle?.[styleKey]
                            ? "secondary"
                            : "ghost"
                        }
                      >
                        <Icon aria-hidden="true" className="size-4" />
                      </Button>
                    ))}
                    <label
                      htmlFor="template-workbench-text-color"
                      className="sidebar-format-command relative flex cursor-pointer items-center justify-center rounded-md hover:bg-muted has-disabled:pointer-events-none has-disabled:opacity-50"
                      title={
                        isMixedTextStyle("textColor")
                          ? `${copy.fieldSettings.textColor}: ${mixedStyleLabel}`
                          : copy.fieldSettings.textColor
                      }
                    >
                      <Baseline
                        aria-hidden="true"
                        className="size-4"
                        style={{
                          color:
                            selectionTextStyle?.textColor ??
                            DEFAULT_COLOR_INPUT_VALUE,
                        }}
                      />
                      <span
                        aria-hidden="true"
                        className="absolute right-1 bottom-0.5 left-1 h-0.5 rounded-full"
                        style={{
                          backgroundColor:
                            selectionTextStyle?.textColor ??
                            DEFAULT_COLOR_INPUT_VALUE,
                        }}
                      />
                      <ColorInput
                        id="template-workbench-text-color"
                        aria-label={copy.fieldSettings.textColor}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        disabled={editingDisabled || !selectionTextStyle}
                        onValueChange={(value) => {
                          if (!selectionTextStyle) {
                            return;
                          }
                          updateSelectedTextFields({
                            textColor: value.toUpperCase(),
                          });
                        }}
                        value={
                          selectionTextStyle?.textColor ??
                          DEFAULT_COLOR_INPUT_VALUE
                        }
                      />
                    </label>
                    <label
                      htmlFor="template-workbench-highlight-color"
                      className="sidebar-format-command relative flex cursor-pointer items-center justify-center rounded-md hover:bg-muted has-disabled:pointer-events-none has-disabled:opacity-50"
                      title={
                        isMixedTextStyle("backgroundColor")
                          ? `${copy.fieldSettings.backgroundColor}: ${mixedStyleLabel}`
                          : copy.fieldSettings.backgroundColor
                      }
                    >
                      <Highlighter aria-hidden="true" className="size-4" />
                      <span
                        aria-hidden="true"
                        className="absolute right-1 bottom-0.5 left-1 h-0.5 rounded-full border border-border/50"
                        style={{
                          backgroundColor:
                            selectionTextStyle?.backgroundColor ===
                            "transparent"
                              ? DEFAULT_CONFIRMATION_TEMPLATE_HIGHLIGHT_COLOR
                              : (selectionTextStyle?.backgroundColor ??
                                DEFAULT_CONFIRMATION_TEMPLATE_HIGHLIGHT_COLOR),
                        }}
                      />
                      <ColorInput
                        aria-label={copy.fieldSettings.backgroundColor}
                        id="template-workbench-highlight-color"
                        onDoubleClick={() => {
                          if (selectionTextStyle) {
                            updateSelectedTextFields({
                              backgroundColor: "transparent",
                            });
                          }
                        }}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        disabled={editingDisabled || !selectionTextStyle}
                        onValueChange={(value) => {
                          if (!selectionTextStyle) {
                            return;
                          }
                          updateSelectedTextFields({
                            backgroundColor: value.toUpperCase(),
                          });
                        }}
                        value={
                          selectionTextStyle?.backgroundColor === "transparent"
                            ? DEFAULT_CONFIRMATION_TEMPLATE_HIGHLIGHT_COLOR
                            : (selectionTextStyle?.backgroundColor ??
                              DEFAULT_CONFIRMATION_TEMPLATE_HIGHLIGHT_COLOR)
                        }
                      />
                    </label>
                  </ButtonGroup>
                </div>

                <ButtonGroup className="mt-1 w-full justify-center gap-0.5">
                  {(
                    [
                      ["left", AlignLeft],
                      ["center", AlignCenter],
                      ["right", AlignRight],
                    ] as const
                  ).map(([alignment, Icon]) => (
                    <Button
                      aria-label={`${copy.tools.alignmentTitle}: ${alignment}`}
                      aria-pressed={selectionTextAlign === alignment}
                      disabled={editingDisabled || !selectionTextStyle}
                      className="sidebar-command"
                      key={alignment}
                      onClick={() => {
                        if (!selectionTextStyle) {
                          return;
                        }
                        updateSelectedTextFields({}, alignment);
                      }}
                      size="icon-sm"
                      type="button"
                      variant={
                        selectionTextAlign === alignment ? "secondary" : "ghost"
                      }
                    >
                      <Icon className="size-4" />
                    </Button>
                  ))}
                </ButtonGroup>
              </div>
              <h3
                className={cn(
                  "text-muted-foreground",
                  inspectorStyles.sectionHeading
                )}
              >
                {copy.sidebarTabs.field}
                <span
                  className={inspectorStyles.headingDivider}
                  aria-hidden="true"
                />
              </h3>
              <div
                id="template-sidebar-field"
                role="group"
                aria-label={copy.sidebarTabs.field}
                className="sidebar-panel sidebar-field"
              >
                {selectedField ? (
                  <div
                    className="space-y-4"
                    data-testid="template-field-settings"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">
                        {getToolLabel(selectedField.kind, copy)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {selectedField.page}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="template-workbench-field-kind">
                        {copy.fieldSettings.kind}
                      </Label>
                      <Select
                        disabled={editingDisabled}
                        value={selectedField.kind}
                        onValueChange={(value) => {
                          const kind = EDITABLE_CONFIRMATION_FIELD_KINDS.find(
                            (candidate) => candidate === value
                          );
                          if (kind) {
                            changeFieldKind(selectedField.id, kind);
                          }
                        }}
                      >
                        <SelectTrigger
                          className="w-full"
                          id="template-workbench-field-kind"
                          aria-label={copy.fieldSettings.kind}
                        >
                          <SelectValue>
                            {getToolLabel(selectedField.kind, copy)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          {EDITABLE_CONFIRMATION_FIELD_KINDS.map((kind) => (
                            <SelectItem key={kind} value={kind}>
                              {getToolLabel(kind, copy)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="template-workbench-field-placeholder">
                        {selectedField.kind === "STATIC_TEXT"
                          ? copy.fieldSettings.staticTextContent
                          : copy.fieldSettings.placeholder}
                      </Label>
                      {selectedField.kind === "STATIC_TEXT" ? (
                        <Textarea
                          disabled={editingDisabled}
                          id="template-workbench-field-placeholder"
                          onChange={(event) =>
                            updateField(selectedField.id, {
                              placeholder: event.target.value,
                            })
                          }
                          value={selectedField.placeholder}
                        />
                      ) : (
                        <Input
                          disabled={editingDisabled}
                          id="template-workbench-field-placeholder"
                          onChange={(event) =>
                            updateField(selectedField.id, {
                              placeholder: event.target.value,
                            })
                          }
                          value={selectedField.placeholder}
                        />
                      )}
                    </div>

                    {selectedField.kind === "CHECKBOX" ? (
                      <Popover>
                        <PopoverTrigger
                          render={
                            <Button
                              className="w-full justify-between"
                              variant="outline"
                              disabled={editingDisabled}
                            >
                              {copy.fieldSettings.checkboxBehavior}
                              <ChevronDown />
                            </Button>
                          }
                        />
                        <PopoverContent
                          className={inspectorStyles.sidebarPopup}
                          side="left"
                          align="start"

                          aria-label={copy.fieldSettings.checkboxBehavior}
                        >
                          <div
                            className="space-y-3 rounded-lg border border-border bg-muted/20 p-3"
                            data-testid="template-workbench-checkbox-settings"
                          >
                            <div className="space-y-1">
                              <p className="text-sm font-medium">
                                {copy.fieldSettings.checkboxBehavior}
                              </p>
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                {copy.fieldSettings.checkboxBehaviorDescription}
                              </p>
                            </div>
                            {selectedField.options.length === 0 ? (
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 space-y-0.5">
                                  <Label htmlFor="template-workbench-checkbox-default">
                                    {copy.fieldSettings.defaultChecked}
                                  </Label>
                                  <p className="text-xs leading-relaxed text-muted-foreground">
                                    {
                                      copy.fieldSettings
                                        .defaultCheckedDescription
                                    }
                                  </p>
                                </div>
                                <Switch
                                  aria-label={copy.fieldSettings.defaultChecked}
                                  checked={
                                    selectedField.defaultChecked ?? false
                                  }
                                  disabled={editingDisabled}
                                  id="template-workbench-checkbox-default"
                                  onCheckedChange={(checked) =>
                                    updateField(selectedField.id, {
                                      defaultChecked: checked,
                                    })
                                  }
                                />
                              </div>
                            ) : null}
                            <Separator />
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 space-y-0.5">
                                <Label htmlFor="template-workbench-checkbox-required">
                                  {copy.fieldSettings.required}
                                </Label>
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  {copy.fieldSettings.requiredDescription}
                                </p>
                              </div>
                              <Switch
                                aria-label={copy.fieldSettings.required}
                                checked={selectedField.required ?? false}
                                disabled={editingDisabled}
                                id="template-workbench-checkbox-required"
                                onCheckedChange={(checked) =>
                                  updateField(selectedField.id, {
                                    required: checked,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1.5 rounded-md border border-border/70 bg-background p-2.5">
                              <span className="text-xs font-medium text-muted-foreground">
                                {copy.fieldSettings.preview}
                              </span>
                              <div className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={
                                    selectedField.defaultChecked ?? false
                                  }
                                  disabled
                                  label={copy.fieldSettings.preview}
                                />
                                <span className="min-w-0 truncate">
                                  {selectedField.placeholder}
                                </span>
                              </div>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : null}

                    {selectedField.kind === "TEXT" ||
                    selectedField.kind === "MULTILINE" ? (
                      <div
                        className="space-y-1.5"
                        data-testid="template-workbench-information-association"
                      >
                        <Label>{copy.fieldSettings.defaultFill}</Label>
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="template-workbench-base-information-trigger">
                              {copy.fieldSettings.defaultFillBaseInformation}
                            </Label>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    className="w-full justify-between font-normal"
                                    data-testid="template-workbench-base-information-trigger"
                                    disabled={editingDisabled}
                                    id="template-workbench-base-information-trigger"
                                    type="button"
                                    variant="outline"
                                  >
                                    <span className="min-w-0 truncate">
                                      {(selectedField.baseInformationBinding ??
                                      selectedField.binding)
                                        ? `${copy.fieldSettings.defaultFillBaseInformation} / ${generalLayout?.sections.flatMap((section) => section.fields).find((field) => (field.binding ?? `custom:${field.id}`) === (selectedField.baseInformationBinding ?? selectedField.binding))?.name ?? customFields.find((field) => `custom:${field.id}` === (selectedField.baseInformationBinding ?? selectedField.binding))?.name ?? selectedBindingLabel ?? selectedField.baseInformationBinding ?? selectedField.binding}`
                                        : copy.fieldSettings.defaultFillNone}
                                    </span>
                                    <ChevronDown />
                                  </Button>
                                }
                              />
                              <DropdownMenuContent
                                align="start"
                                className="min-w-56"
                              >
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateField(selectedField.id, {
                                      baseInformationBinding: undefined,
                                      binding: undefined,
                                    })
                                  }
                                >
                                  {(selectedField.baseInformationBinding ??
                                  selectedField.binding) ? null : (
                                    <Check />
                                  )}
                                  {copy.fieldSettings.defaultFillNone}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {(generalLayout
                                  ? generalLayout.sections.flatMap((section) =>
                                      section.fields.map(
                                        (field) =>
                                          (field.binding ??
                                            `custom:${field.id}`) as ConfirmationTemplateDesignFieldBinding
                                      )
                                    )
                                  : [
                                      ...TEMPLATE_FIELD_BINDINGS,
                                      ...customFields.map(
                                        (field) => `custom:${field.id}` as const
                                      ),
                                    ]
                                ).map((binding) => (
                                  <DropdownMenuItem
                                    key={binding}
                                    onClick={() =>
                                      updateField(selectedField.id, {
                                        baseInformationBinding: binding,
                                        binding: undefined,
                                      })
                                    }
                                  >
                                    {(selectedField.baseInformationBinding ??
                                      selectedField.binding) === binding ? (
                                      <Check />
                                    ) : null}
                                    {generalLayout?.sections
                                      .flatMap((section) => section.fields)
                                      .find(
                                        (field) =>
                                          (field.binding ??
                                            `custom:${field.id}`) === binding
                                      )?.name ??
                                      customFields.find(
                                        (field) =>
                                          `custom:${field.id}` === binding
                                      )?.name ??
                                      copy.fieldSettings.bindings[binding]}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="template-workbench-information-library-trigger">
                              {copy.fieldSettings.defaultFillInformationLibrary}
                            </Label>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    className="w-full justify-between font-normal"
                                    data-testid="template-workbench-information-library-trigger"
                                    disabled={editingDisabled}
                                    id="template-workbench-information-library-trigger"
                                    type="button"
                                    variant="outline"
                                  >
                                    <span className="min-w-0 truncate">
                                      {selectedField.informationLibraryBinding
                                        ? `${copy.fieldSettings.defaultFillInformationLibrary} / ${copy.fieldSettings.bindings[selectedField.informationLibraryBinding]}`
                                        : copy.fieldSettings.defaultFillNone}
                                    </span>
                                    <ChevronDown />
                                  </Button>
                                }
                              />
                              <DropdownMenuContent
                                align="start"
                                className="min-w-56"
                              >
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateField(selectedField.id, {
                                      informationLibraryBinding: undefined,
                                    })
                                  }
                                >
                                  {selectedField.informationLibraryBinding ? null : (
                                    <Check />
                                  )}
                                  {copy.fieldSettings.defaultFillNone}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {INFORMATION_LIBRARY_FIELD_BINDINGS.map(
                                  (binding) => (
                                    <DropdownMenuItem
                                      key={binding}
                                      onClick={() =>
                                        updateField(selectedField.id, {
                                          informationLibraryBinding: binding,
                                        })
                                      }
                                    >
                                      {selectedField.informationLibraryBinding ===
                                      binding ? (
                                        <Check />
                                      ) : null}
                                      {copy.fieldSettings.bindings[binding]}
                                    </DropdownMenuItem>
                                  )
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {copy.fieldSettings.defaultFillDescription}
                        </p>
                      </div>
                    ) : null}

                    {selectedField.kind === "TEXT" ||
                    selectedField.kind === "MULTILINE" ||
                    selectedField.kind === "NUMBER" ||
                    selectedField.kind === "DATE" ||
                    selectedField.kind === "RADIO" ? (
                      <div className="space-y-1.5">
                        <Label>{copy.fieldSettings.initialValue}</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                className="w-full justify-between font-normal"
                                data-testid="template-workbench-default-fill-trigger"
                                disabled={editingDisabled}
                                type="button"
                                variant="outline"
                              >
                                <span className="min-w-0 truncate">
                                  {selectedDefaultValueSource?.source ===
                                  "CUSTOM"
                                    ? copy.fieldSettings.initialValueCustom
                                    : selectedDefaultValueSource?.source ===
                                        "SYSTEM"
                                      ? copy.fieldSettings
                                          .initialValueCurrentDate
                                      : copy.fieldSettings.initialValueNone}
                                </span>
                                <ChevronDown />
                              </Button>
                            }
                          />
                          <DropdownMenuContent
                            align="start"
                            className="min-w-56"
                          >
                            <DropdownMenuItem
                              onClick={() =>
                                updateField(selectedField.id, {
                                  defaultValueSource: undefined,
                                })
                              }
                            >
                              {selectedDefaultValueSource ? null : <Check />}
                              {copy.fieldSettings.initialValueNone}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                updateField(selectedField.id, {
                                  defaultValueSource: {
                                    source: "CUSTOM",
                                    value: "",
                                  },
                                })
                              }
                            >
                              {selectedDefaultValueSource?.source ===
                              "CUSTOM" ? (
                                <Check />
                              ) : null}
                              {copy.fieldSettings.initialValueCustom}
                            </DropdownMenuItem>
                            {selectedField.kind === "DATE" ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateField(selectedField.id, {
                                    defaultValueSource: {
                                      source: "SYSTEM",
                                      value: "CURRENT_DATE",
                                    },
                                  })
                                }
                              >
                                {selectedDefaultValueSource?.source ===
                                "SYSTEM" ? (
                                  <Check />
                                ) : null}
                                {copy.fieldSettings.initialValueCurrentDate}
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {selectedDefaultValueSource?.source === "CUSTOM" ? (
                          <div className="space-y-1.5">
                            <Label htmlFor="template-workbench-custom-default-value">
                              {copy.fieldSettings.initialValueCustomValue}
                            </Label>
                            {selectedField.kind === "MULTILINE" ? (
                              <Textarea
                                disabled={editingDisabled}
                                id="template-workbench-custom-default-value"
                                onChange={(event) =>
                                  updateField(selectedField.id, {
                                    defaultValueSource: {
                                      source: "CUSTOM",
                                      value: event.target.value,
                                    },
                                  })
                                }
                                value={selectedDefaultValueSource.value}
                              />
                            ) : selectedField.kind === "RADIO" ? (
                              <Select
                                onValueChange={(value) =>
                                  updateField(selectedField.id, {
                                    defaultValueSource: {
                                      source: "CUSTOM",
                                      value: value ?? "",
                                    },
                                  })
                                }
                                value={selectedDefaultValueSource.value}
                              >
                                <SelectTrigger id="template-workbench-custom-default-value">
                                  <SelectValue
                                    placeholder={
                                      copy.fieldSettings.initialValueCustomValue
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectedField.options.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                disabled={editingDisabled}
                                id="template-workbench-custom-default-value"
                                onChange={(event) =>
                                  updateField(selectedField.id, {
                                    defaultValueSource: {
                                      source: "CUSTOM",
                                      value: event.target.value,
                                    },
                                  })
                                }
                                type={
                                  selectedField.kind === "NUMBER"
                                    ? "number"
                                    : selectedField.kind === "DATE"
                                      ? "date"
                                      : "text"
                                }
                                value={selectedDefaultValueSource.value}
                              />
                            )}
                          </div>
                        ) : null}
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {copy.fieldSettings.initialValueDescription}
                        </p>
                      </div>
                    ) : null}

                    {selectedField.kind === "SELECT" ||
                    selectedField.kind === "RADIO" ? (
                      <Popover>
                        <PopoverTrigger
                          render={
                            <Button
                              className="w-full justify-between"
                              variant="outline"
                              disabled={editingDisabled}
                            >
                              {copy.fieldSettings.options}
                              <ChevronDown />
                            </Button>
                          }
                        />
                        <PopoverContent
                          className={inspectorStyles.sidebarPopup}
                          side="left"
                          align="start"

                          aria-label={copy.fieldSettings.options}
                        >
                          <div className="space-y-2">
                            <Label>{copy.fieldSettings.options}</Label>
                            <div className="space-y-2">
                              {selectedField.options.map((option, index) => (
                                <div
                                  className="flex items-center gap-2"
                                  key={`${selectedField.id}-option-${index}`}
                                >
                                  <Input
                                    aria-label={`${copy.fieldSettings.option} ${index + 1}`}
                                    disabled={editingDisabled}
                                    onChange={(event) => {
                                      const options = [
                                        ...selectedField.options,
                                      ];
                                      options[index] = event.target.value;
                                      updateField(selectedField.id, {
                                        options,
                                      });
                                    }}
                                    value={option}
                                  />
                                  <Button
                                    aria-label={`${copy.fieldSettings.deleteOption} ${index + 1}`}
                                    disabled={editingDisabled}
                                    onClick={() => {
                                      updateField(selectedField.id, {
                                        options: selectedField.options.filter(
                                          (_, optionIndex) =>
                                            optionIndex !== index
                                        ),
                                      });
                                    }}
                                    size="icon"
                                    type="button"
                                    variant="ghost"
                                  >
                                    <X />
                                  </Button>
                                </div>
                              ))}
                            </div>
                            <ButtonGroup>
                              <Button
                                disabled={editingDisabled}
                                onClick={handleAddOption}
                                type="button"
                                variant="outline"
                              >
                                <Plus />
                                {copy.fieldSettings.addOption}
                              </Button>
                            </ButtonGroup>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : null}

                    <Separator />
                    <Button
                      className="w-full"
                      disabled={editingDisabled}
                      onClick={handleDeleteField}
                      type="button"
                      variant="destructive"
                    >
                      <Trash2 />
                      {copy.fieldSettings.deleteField}
                    </Button>
                  </div>
                ) : (
                  <div
                    className="flex min-h-32 items-center justify-center rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground"
                    data-testid="template-workbench-empty-settings"
                  >
                    {copy.fieldSettings.empty}
                  </div>
                )}
                {saveError ? (
                  <p className="mt-4 text-sm text-destructive" role="alert">
                    {saveError}
                  </p>
                ) : null}
              </div>
            </aside>
          )}
        </div>
      </div>
      <AlertDialog
        open={backConfirmationOpen}
        onOpenChange={(open) => {
          if (savingStatus === null) {
            setBackConfirmationOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.unsavedChangesTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy.unsavedChangesDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.keepEditing}</AlertDialogCancel>
            <AlertDialogAction
              disabled={savingStatus !== null}
              onClick={handleDiscardChanges}
              variant="destructive"
            >
              {copy.discardChanges}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
