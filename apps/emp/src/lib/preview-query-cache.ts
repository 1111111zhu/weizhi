import type { Query, QueryClient, QueryKey } from "@tanstack/react-query";

import type { AttachmentPreviewKind } from "./attachment-preview";
import { getDocumentAssetPreviewKind } from "./document-asset-preview";

export const PREVIEW_QUERY_STALE_TIME_MS = 30 * 60_000;
export const PREVIEW_QUERY_GC_TIME_MS = 15 * 60_000;
export const PREVIEW_QUERY_META = { previewCache: true } as const;

const DEFAULT_MAX_PREVIEW_QUERY_ENTRIES = 32;
const DEFAULT_MAX_PREVIEW_QUERY_BYTES = 96 * 1024 * 1024;
const MAX_SEEDED_UPLOAD_PREVIEW_BYTES = 48 * 1024 * 1024;

type AttachmentPreviewIdentity = {
  contentHash?: string | null;
  fileName: string;
  fileSize?: number | null;
  id: string;
  mimeType: string;
  originalName?: string | null;
  version: number;
};

type PreviewQueryCacheBudget = {
  maxBytes?: number;
  maxEntries?: number;
};

const lastAccessedAt = new WeakMap<Query, number>();

export function attachmentContentPreviewQueryKey(
  projectId: string,
  attachment: Pick<AttachmentPreviewIdentity, "contentHash" | "id" | "version">,
  previewKind: AttachmentPreviewKind
) {
  return [
    "extendAttachmentPreview",
    projectId,
    attachment.id,
    attachment.version,
    attachment.contentHash,
    previewKind,
  ] as const;
}

export function getAttachmentContentPreviewKind(
  attachment: Pick<
    AttachmentPreviewIdentity,
    "fileName" | "mimeType" | "originalName"
  >
): AttachmentPreviewKind | null {
  const fileName = (
    attachment.originalName || attachment.fileName
  ).toLowerCase();
  const mimeType = attachment.mimeType.toLowerCase();
  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
    return "pdf";
  }
  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed" ||
    fileName.endsWith(".zip")
  ) {
    return "archive";
  }
  if (
    /\.(docx|doc)$/.test(fileName) ||
    mimeType === "application/msword" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (
    /\.(pptx|ppt)$/.test(fileName) ||
    mimeType === "application/vnd.ms-powerpoint" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return "pptx";
  }
  return getDocumentAssetPreviewKind(fileName, mimeType);
}

export function seedUploadedAttachmentPreview(
  queryClient: QueryClient,
  projectId: string,
  attachment: AttachmentPreviewIdentity,
  file: File
) {
  const previewKind = getAttachmentContentPreviewKind(attachment);
  if (
    !projectId ||
    !attachment.id ||
    !Number.isInteger(attachment.version) ||
    attachment.version < 1 ||
    !previewKind ||
    file.size <= 0 ||
    file.size > MAX_SEEDED_UPLOAD_PREVIEW_BYTES ||
    (typeof attachment.fileSize === "number" &&
      attachment.fileSize !== file.size)
  ) {
    return false;
  }

  queryClient.setQueryData(
    attachmentContentPreviewQueryKey(projectId, attachment, previewKind),
    file,
    { updatedAt: Date.now() }
  );
  return true;
}

export function installPreviewQueryCacheBudget(
  queryClient: QueryClient,
  budget: PreviewQueryCacheBudget = {}
) {
  let scheduled = false;
  return queryClient.getQueryCache().subscribe((event) => {
    if (
      event?.query &&
      isPreviewQuery(event.query) &&
      (event.type === "observerAdded" || event.type === "updated")
    ) {
      lastAccessedAt.set(event.query, Date.now());
    }
    if (scheduled) {
      return;
    }
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      enforcePreviewQueryCacheBudget(queryClient, budget);
    });
  });
}

export function enforcePreviewQueryCacheBudget(
  queryClient: QueryClient,
  {
    maxBytes = DEFAULT_MAX_PREVIEW_QUERY_BYTES,
    maxEntries = DEFAULT_MAX_PREVIEW_QUERY_ENTRIES,
  }: PreviewQueryCacheBudget = {}
) {
  const queries = queryClient.getQueryCache().getAll().filter(isPreviewQuery);
  let totalBytes = queries.reduce(
    (total, query) => total + estimatePreviewDataBytes(query.state.data),
    0
  );
  let totalEntries = queries.length;

  const removable = queries
    .filter((query) => query.getObserversCount() === 0)
    .sort(
      (left, right) => readLastAccessedAt(left) - readLastAccessedAt(right)
    );

  for (const query of removable) {
    if (totalEntries <= maxEntries && totalBytes <= maxBytes) {
      break;
    }
    totalEntries -= 1;
    totalBytes -= estimatePreviewDataBytes(query.state.data);
    queryClient.getQueryCache().remove(query);
  }
}

function isPreviewQuery(query: Query) {
  return (
    query.meta?.previewCache === true || isKnownPreviewQueryKey(query.queryKey)
  );
}

function isKnownPreviewQueryKey(queryKey: QueryKey) {
  const [family] = queryKey;
  return typeof family === "string" && /preview/i.test(family);
}

function readLastAccessedAt(query: Query) {
  return lastAccessedAt.get(query) ?? query.state.dataUpdatedAt ?? 0;
}

export function estimatePreviewDataBytes(value: unknown) {
  const visited = new WeakSet<object>();
  let remainingNodes = 12_000;

  const visit = (entry: unknown): number => {
    if (entry === null || entry === undefined || remainingNodes <= 0) {
      return 0;
    }
    if (typeof Blob !== "undefined" && entry instanceof Blob) {
      return entry.size;
    }
    if (entry instanceof ArrayBuffer) {
      return entry.byteLength;
    }
    if (ArrayBuffer.isView(entry)) {
      return entry.byteLength;
    }
    if (typeof entry === "string") {
      return entry.length * 2;
    }
    if (typeof entry === "number" || typeof entry === "boolean") {
      return 8;
    }
    if (typeof entry !== "object") {
      return 0;
    }
    if (visited.has(entry)) {
      return 0;
    }
    visited.add(entry);
    remainingNodes -= 1;

    if (Array.isArray(entry)) {
      return entry.reduce((total, item) => total + visit(item), 0);
    }
    return Object.entries(entry).reduce(
      (total, [key, item]) => total + key.length * 2 + visit(item),
      0
    );
  };

  return visit(value);
}
