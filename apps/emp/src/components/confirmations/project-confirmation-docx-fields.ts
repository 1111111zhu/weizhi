export type DocxTableCellAnchor = {
  cellIndex: number;
  kind: "table-cell";
  rowIndex: number;
  tableIndex: number;
};

export type DocxTableTextAnchor = {
  after?: string;
  before?: string;
  cellIndex: number;
  kind: "table-text";
  paragraphIndex: number;
  rowIndex: number;
  tableIndex: number;
  text?: RegExp | string;
};

export type DocxTextMarker = RegExp | string;

export type DocxTextAnchor = {
  kind: "text";
  marker: DocxTextMarker;
  occurrence?: number;
};

export type DocxParagraphAnchor = {
  kind: "paragraph";
  nodeIndex: number;
};

export type DocxFieldAnchor =
  | DocxParagraphAnchor
  | DocxTableCellAnchor
  | DocxTableTextAnchor
  | DocxTextAnchor;

export type DocxFieldGeometry = {
  height: number;
  left: number;
  top: number;
  width: number;
};

export function getDocxFieldSourceCoverGeometry(
  geometry: DocxFieldGeometry,
  padding = 2
): DocxFieldGeometry {
  return {
    height: geometry.height + padding * 2,
    left: geometry.left - padding,
    top: geometry.top - padding,
    width: geometry.width + padding * 2,
  };
}

type RectLike = Pick<DOMRect, "height" | "left" | "top" | "width">;

function getTableCellSelector(anchor: DocxTableCellAnchor) {
  return [
    '[data-docx-table-cell="true"]',
    `[data-docx-table-index="${anchor.tableIndex}"]`,
    `[data-docx-row-index="${anchor.rowIndex}"]`,
    `[data-docx-cell-index="${anchor.cellIndex}"]`,
  ].join("");
}

function getTableParagraphSelector(anchor: DocxTableTextAnchor) {
  return [
    '[data-docx-paragraph-kind="table-cell"]',
    `[data-docx-table-index="${anchor.tableIndex}"]`,
    `[data-docx-row-index="${anchor.rowIndex}"]`,
    `[data-docx-cell-index="${anchor.cellIndex}"]`,
    `[data-docx-paragraph-index="${anchor.paragraphIndex}"]`,
  ].join("");
}

function getTextNodes(element: HTMLElement) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();

  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }

  return nodes;
}

function getTextMatches(text: string, marker: DocxTextMarker) {
  if (typeof marker === "string") {
    if (!marker) {
      return [];
    }

    const matches: { end: number; start: number }[] = [];
    let start = text.indexOf(marker);

    while (start >= 0) {
      matches.push({ end: start + marker.length, start });
      start = text.indexOf(marker, start + marker.length);
    }

    return matches;
  }

  const flags = marker.flags.includes("g") ? marker.flags : `${marker.flags}g`;
  const regex = new RegExp(marker.source, flags);

  return [...text.matchAll(regex)].flatMap((match) => {
    const start = match.index ?? -1;
    return start >= 0 ? [{ end: start + match[0].length, start }] : [];
  });
}

function createTextRange(
  textNodes: Text[],
  start: number,
  end: number
): Range | null {
  if (start < 0 || end < start || textNodes.length === 0) {
    return null;
  }

  const range = document.createRange();
  let endNode: Text | null = null;
  let endOffset = 0;
  let offset = 0;
  let startNode: Text | null = null;
  let startOffset = 0;

  for (const node of textNodes) {
    const nextOffset = offset + node.data.length;

    if (!startNode && start >= offset && start <= nextOffset) {
      startNode = node;
      startOffset = start - offset;
    }
    if (end >= offset && end <= nextOffset) {
      endNode = node;
      endOffset = end - offset;
      break;
    }

    offset = nextOffset;
  }

  if (!startNode || !endNode) {
    return null;
  }

  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

function getTextRange(
  element: HTMLElement,
  anchor: DocxTableTextAnchor
): Range | null {
  const textNodes = getTextNodes(element);
  const text = textNodes.map((node) => node.data).join("");
  let matches: { end: number; start: number }[] = [];

  if (typeof anchor.text === "string") {
    matches = getTextMatches(text, anchor.text);
  } else if (anchor.text instanceof RegExp) {
    matches = getTextMatches(text, anchor.text);
  } else if (anchor.after || anchor.before) {
    const hasAfter = Boolean(anchor.after);
    const afterIndex = hasAfter ? text.indexOf(anchor.after ?? "") : 0;
    const start = hasAfter ? afterIndex + (anchor.after?.length ?? 0) : 0;
    const beforeIndex = anchor.before
      ? text.indexOf(anchor.before, start)
      : text.length;
    const fieldStart = hasAfter
      ? start
      : anchor.before
        ? getBeforeOnlyFieldStart(text, beforeIndex)
        : 0;
    matches =
      (hasAfter && afterIndex < 0) || beforeIndex < 0
        ? []
        : [{ end: beforeIndex, start: fieldStart }];
  }

  const [match] = matches;
  return match ? createTextRange(textNodes, match.start, match.end) : null;
}

function getBeforeOnlyFieldStart(text: string, beforeIndex: number) {
  if (beforeIndex < 0) {
    return 0;
  }
  const asciiLabelDelimiter = text.lastIndexOf(":", beforeIndex);
  const fullWidthLabelDelimiter = text.lastIndexOf("：", beforeIndex);
  return Math.max(asciiLabelDelimiter, fullWidthLabelDelimiter) + 1;
}

function getPositiveRect(rect: RectLike | undefined): RectLike | null {
  if (!rect) {
    return null;
  }
  if (
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return null;
  }

  return rect;
}

function getRangeRect(range: Range, fallback: HTMLElement): RectLike | null {
  const rects = [...range.getClientRects()].filter((rect) =>
    getPositiveRect(rect)
  );

  if (rects.length > 0) {
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));

    return { height: bottom - top, left, top, width: right - left };
  }

  return getPositiveRect(fallback.getBoundingClientRect());
}

function getPageSurfaceElement(pageElement: HTMLElement) {
  return pageElement.matches('[data-docx-page-surface="true"]')
    ? pageElement
    : (pageElement.querySelector<HTMLElement>(
        '[data-docx-page-surface="true"]'
      ) ?? pageElement);
}

/** Returns every rendered marker occurrence relative to the current page surface. */
export function findTextAnchorRect(
  pageElement: HTMLElement | null,
  marker: DocxTextMarker
): DocxFieldGeometry[] {
  if (!pageElement) {
    return [];
  }

  const pageSurface = getPageSurfaceElement(pageElement);
  const pageSurfaceRect = getPositiveRect(pageSurface.getBoundingClientRect());
  if (!pageSurfaceRect) {
    return [];
  }

  const textNodes = getTextNodes(pageSurface);
  const text = textNodes.map((node) => node.data).join("");

  return getTextMatches(text, marker).flatMap((match) => {
    const range = createTextRange(textNodes, match.start, match.end);
    const rangeRect = range
      ? getPositiveRect(range.getBoundingClientRect())
      : null;

    return rangeRect
      ? [
          {
            height: rangeRect.height,
            left: rangeRect.left - pageSurfaceRect.left,
            top: rangeRect.top - pageSurfaceRect.top,
            width: rangeRect.width,
          },
        ]
      : [];
  });
}

function getAnchorRect(
  pageElement: HTMLElement,
  anchor: DocxFieldAnchor
): RectLike | null {
  if (anchor.kind === "paragraph") {
    const paragraph = pageElement.querySelector<HTMLElement>(
      `[data-docx-paragraph-kind="paragraph"][data-docx-paragraph-node-index="${anchor.nodeIndex}"]`
    );
    return getPositiveRect(paragraph?.getBoundingClientRect());
  }

  if (anchor.kind === "table-cell") {
    const cell = pageElement.querySelector<HTMLElement>(
      getTableCellSelector(anchor)
    );
    return getPositiveRect(cell?.getBoundingClientRect());
  }

  if (anchor.kind === "text") {
    const pageSurface = getPageSurfaceElement(pageElement);
    const pageSurfaceRect = getPositiveRect(
      pageSurface.getBoundingClientRect()
    );
    const match = findTextAnchorRect(pageElement, anchor.marker)[
      Math.max(0, Math.round(anchor.occurrence ?? 0))
    ];

    return pageSurfaceRect && match
      ? {
          height: match.height,
          left: pageSurfaceRect.left + match.left,
          top: pageSurfaceRect.top + match.top,
          width: match.width,
        }
      : null;
  }

  const paragraph = pageElement.querySelector<HTMLElement>(
    getTableParagraphSelector(anchor)
  );
  if (!paragraph) {
    return null;
  }

  const range = getTextRange(paragraph, anchor);
  return range
    ? getRangeRect(range, paragraph)
    : getPositiveRect(paragraph.getBoundingClientRect());
}

export function resolveDocxFieldGeometry(
  pageElement: HTMLElement | null,
  anchor: DocxFieldAnchor,
  scale: number
): DocxFieldGeometry | null {
  if (!pageElement) {
    return null;
  }

  const pageRect = getPositiveRect(pageElement.getBoundingClientRect());
  const anchorRect = getAnchorRect(pageElement, anchor);
  const visualScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

  if (!pageRect || !anchorRect) {
    return null;
  }

  return {
    height: anchorRect.height / visualScale,
    left: (anchorRect.left - pageRect.left) / visualScale,
    top: (anchorRect.top - pageRect.top) / visualScale,
    width: anchorRect.width / visualScale,
  };
}
