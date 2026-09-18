export const PAGED_DOCUMENT_PREVIEW_CANVAS_CLASS_NAME = "bg-muted/70";
export const PRESENTATION_PREVIEW_CANVAS_CLASS_NAME =
  "[background:var(--preview-surface)]";
export const IMAGE_PREVIEW_CANVAS_CLASS_NAME =
  PAGED_DOCUMENT_PREVIEW_CANVAS_CLASS_NAME;
export const PREVIEW_PAGE_ELEVATION_CLASS_NAME =
  "ring-1 ring-border/60 shadow-sm dark:ring-border/80 dark:shadow-black/40";

export function getDocumentPreviewCanvasClassName(
  kind: "image" | "paged-document" | "presentation"
) {
  return kind === "presentation"
    ? PRESENTATION_PREVIEW_CANVAS_CLASS_NAME
    : PAGED_DOCUMENT_PREVIEW_CANVAS_CLASS_NAME;
}
