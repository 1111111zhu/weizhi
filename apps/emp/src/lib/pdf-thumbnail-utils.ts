import type { PdfDocumentObject, PdfEngine } from "@embedpdf/models";

const PDFIUM_WASM_ASSET_PATH = new URL(
  "@embedpdf/pdfium/pdfium.wasm",
  import.meta.url
).toString();

function getPdfiumWasmUrl() {
  if (typeof window === "undefined") {
    return PDFIUM_WASM_ASSET_PATH;
  }

  return new URL(PDFIUM_WASM_ASSET_PATH, window.location.origin).toString();
}

let sharedEnginePromise: Promise<PdfEngine> | null = null;
const pdfDocumentCache = new Map<string, Promise<PdfDocumentObject>>();
const thumbnailUrlCache = new Map<string, Promise<string | null>>();

export function loadSharedPdfEngine() {
  sharedEnginePromise ??= import("@embedpdf/engines/pdfium-worker-engine").then(
    ({ createPdfiumEngine }) => createPdfiumEngine(getPdfiumWasmUrl(), {})
  );

  return sharedEnginePromise;
}

export async function loadPdfDocument(url: string) {
  await Promise.resolve();
  let documentPromise = pdfDocumentCache.get(url);

  if (!documentPromise) {
    documentPromise = loadSharedPdfEngine().then((engine) =>
      engine
        .openDocumentUrl(
          { id: url, url },
          { mode: url.startsWith("blob:") ? "full-fetch" : "auto" }
        )
        .toPromise()
    );
    pdfDocumentCache.set(url, documentPromise);
  }

  return documentPromise;
}

export async function getPdfPageCount(url: string) {
  const document = await loadPdfDocument(url);
  return document.pageCount;
}

export function renderPdfThumbnailUrl({
  dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
  pageIndex,
  url,
  width,
}: {
  dpr?: number;
  pageIndex: number;
  url: string;
  width: number;
}) {
  const cacheKey = `${url}#${pageIndex}@${width}x${dpr}`;
  let thumbnailPromise = thumbnailUrlCache.get(cacheKey);

  if (!thumbnailPromise) {
    thumbnailPromise = (async () => {
      const [engine, document] = await Promise.all([
        loadSharedPdfEngine(),
        loadPdfDocument(url),
      ]);
      const page = document.pages[pageIndex];

      if (!page) {
        return null;
      }

      const blob = await engine
        .renderThumbnail(document, page, {
          dpr,
          imageType: "image/png",
          scaleFactor: width / page.size.width,
          withAnnotations: true,
        })
        .toPromise();

      return URL.createObjectURL(blob);
    })();
    thumbnailUrlCache.set(cacheKey, thumbnailPromise);
  }

  return thumbnailPromise;
}
