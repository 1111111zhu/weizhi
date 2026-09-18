const DOCUMENT_SEARCH_HIGHLIGHT_NAME = "project-document-search";
const DOCUMENT_SEARCH_HIGHLIGHT_STYLE_ID =
  "project-document-search-highlight-style";

type CssHighlights = {
  delete: (name: string) => void;
  set: (name: string, highlight: unknown) => void;
};

function getCssHighlights() {
  return (CSS as typeof CSS & { highlights?: CssHighlights }).highlights;
}

function ensureDocumentSearchHighlightStyle() {
  if (document.querySelector(`#${DOCUMENT_SEARCH_HIGHLIGHT_STYLE_ID}`)) {
    return;
  }

  const style = document.createElement("style");
  style.id = DOCUMENT_SEARCH_HIGHLIGHT_STYLE_ID;
  style.textContent = `::highlight(${DOCUMENT_SEARCH_HIGHLIGHT_NAME}) {
    background-color: var(--warning);
    color: var(--warning-foreground);
    text-decoration: underline 2px currentColor;
  }`;
  document.head.append(style);
}

export function clearDocumentSearchHighlight() {
  getCssHighlights()?.delete(DOCUMENT_SEARCH_HIGHLIGHT_NAME);
}

export function highlightDocumentSearchText(
  element: HTMLElement,
  start: number,
  end: number
) {
  clearDocumentSearchHighlight();

  const HighlightConstructor = (
    window as Window & { Highlight?: new (range: Range) => unknown }
  ).Highlight;
  const highlights = getCssHighlights();

  if (!HighlightConstructor || !highlights || end <= start) {
    return;
  }
  ensureDocumentSearchHighlightStyle();

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let cursor = 0;
  let endNode: Text | null = null;
  let endOffset = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let node = walker.nextNode();

  while (node instanceof Text) {
    const nextCursor = cursor + node.data.length;

    if (!startNode && start >= cursor && start <= nextCursor) {
      startNode = node;
      startOffset = start - cursor;
    }
    if (end >= cursor && end <= nextCursor) {
      endNode = node;
      endOffset = end - cursor;
      break;
    }

    cursor = nextCursor;
    node = walker.nextNode();
  }

  if (!startNode || !endNode) {
    return;
  }

  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  highlights.set(
    DOCUMENT_SEARCH_HIGHLIGHT_NAME,
    new HighlightConstructor(range)
  );
}
