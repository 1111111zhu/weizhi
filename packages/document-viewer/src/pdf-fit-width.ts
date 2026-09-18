/** Clamp to supported zoom levels and ignore unmeasured/invalid viewports. */
export function pdfFitWidth(
  viewportWidth: number,
  pageWidth: number,
  gap: number
) {
  if (
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(pageWidth) ||
    pageWidth <= 0 ||
    viewportWidth <= gap * 2
  ) {
    return null;
  }
  return Math.max(0.1, Math.min(2, (viewportWidth - gap * 2) / pageWidth));
}
