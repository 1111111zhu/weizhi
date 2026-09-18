/** Zero-based page indexes with bounded navigation, even for large datasets. */
export function getPaginationPages(
  page: number,
  pageCount: number
): (number | "start-gap" | "end-gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index);
  }
  const current = Math.max(0, Math.min(page, pageCount - 1));
  const start = Math.max(1, Math.min(current - 1, pageCount - 5));
  const end = Math.min(pageCount - 2, Math.max(current + 1, 4));
  const pages: (number | "start-gap" | "end-gap")[] = [0];
  if (start > 1) {
    pages.push("start-gap");
  }
  for (let index = start; index <= end; index += 1) {
    pages.push(index);
  }
  if (end < pageCount - 2) {
    pages.push("end-gap");
  }
  pages.push(pageCount - 1);
  return pages;
}
