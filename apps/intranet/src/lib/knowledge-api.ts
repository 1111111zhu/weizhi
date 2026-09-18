import type { KnowledgeItem } from "@/lib/knowledge-catalog";

export const knowledgeApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

type KnowledgeDocumentResponse = Omit<KnowledgeItem, "owner" | "updatedAt"> & {
  owner?: string;
  updatedAt: string;
  uploader?: { displayName?: string; userCode?: string };
};

export function normalizeKnowledgeDocument(
  document: KnowledgeDocumentResponse
): KnowledgeItem {
  const documentUrl = document.id
    ? `${knowledgeApiBaseUrl}/knowledge-documents/${document.id}`
    : undefined;

  return {
    ...document,
    owner:
      document.owner ??
      document.uploader?.userCode ??
      document.uploader?.displayName ??
      "—",
    updatedAt: document.updatedAt.slice(0, 10),
    previewUrl: resolveApiUrl(document.previewUrl),
    downloadUrl: resolveApiUrl(
      document.downloadAllowed === false
        ? undefined
        : (document.downloadUrl ??
            (documentUrl ? `${documentUrl}/download` : undefined))
    ),
  };
}

function resolveApiUrl(value: string | undefined) {
  if (!value) {
    return;
  }
  return new URL(value, `${knowledgeApiBaseUrl}/`).toString();
}

export async function uploadKnowledgeDocument(
  body: FormData
): Promise<KnowledgeItem> {
  const response = await fetch(`${knowledgeApiBaseUrl}/knowledge-documents`, {
    body,
    credentials: "include",
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Knowledge upload failed with status ${response.status}`);
  }

  const item = normalizeKnowledgeDocument(
    (await response.json()) as KnowledgeDocumentResponse
  );
  warmKnowledgePreviewCache(item);
  return item;
}

export function updateKnowledgeDocument(
  id: string,
  body: FormData
): Promise<KnowledgeItem> {
  return mutateKnowledgeDocument(id, { body, method: "PATCH" });
}

export function archiveKnowledgeDocument(id: string) {
  return mutateKnowledgeDocument(id, { method: "POST", suffix: "archive" });
}

export function restoreKnowledgeDocument(id: string) {
  return mutateKnowledgeDocument(id, { method: "POST", suffix: "restore" });
}

export async function deleteKnowledgeDocument(id: string) {
  const response = await fetch(
    `${knowledgeApiBaseUrl}/knowledge-documents/${encodeURIComponent(id)}`,
    { credentials: "include", method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(`Knowledge delete failed with status ${response.status}`);
  }
}

export async function getArchivedKnowledgeDocuments(): Promise<
  KnowledgeItem[]
> {
  const response = await fetch(
    `${knowledgeApiBaseUrl}/knowledge-documents/archived`,
    {
      cache: "no-store",
      credentials: "include",
    }
  );
  if (!response.ok) {
    throw new Error(
      `Knowledge archive fetch failed with status ${response.status}`
    );
  }
  return ((await response.json()) as KnowledgeDocumentResponse[]).map(
    normalizeKnowledgeDocument
  );
}

async function mutateKnowledgeDocument(
  id: string,
  options: { body?: FormData; method: "PATCH" | "POST"; suffix?: string }
) {
  const suffix = options.suffix ? `/${options.suffix}` : "";
  const response = await fetch(
    `${knowledgeApiBaseUrl}/knowledge-documents/${encodeURIComponent(id)}${suffix}`,
    { body: options.body, credentials: "include", method: options.method }
  );
  if (!response.ok) {
    throw new Error(`Knowledge update failed with status ${response.status}`);
  }
  const item = normalizeKnowledgeDocument(
    (await response.json()) as KnowledgeDocumentResponse
  );
  if (options.suffix !== "archive") {
    warmKnowledgePreviewCache(item);
  }
  return item;
}

export function warmKnowledgePreviewCache(item: KnowledgeItem) {
  const urls = new Set<string>();
  if (item.id && item.fileName && item.previewAllowed !== false) {
    const version = item.previewVersion ?? item.updatedAt;
    urls.add(
      `/knowledge-source/${encodeURIComponent(item.id)}?version=${encodeURIComponent(version)}`
    );
  }
  collectNoticePreviewSources(item.body, urls);
  for (const url of urls) {
    void fetch(url, {
      cache: "force-cache",
      credentials: "include",
    }).catch(() => {});
  }
}

function collectNoticePreviewSources(value: unknown, urls: Set<string>) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectNoticePreviewSources(item, urls);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.type === "knowledgeAttachment") {
    const attrs = record.attrs as Record<string, unknown> | undefined;
    if (typeof attrs?.previewSourceUrl === "string") {
      urls.add(attrs.previewSourceUrl);
    }
  }
  collectNoticePreviewSources(record.content, urls);
}

export type { KnowledgeDocumentResponse };
