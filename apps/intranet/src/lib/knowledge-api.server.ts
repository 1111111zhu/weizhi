import "server-only";
import { cookies } from "next/headers";

import {
  knowledgeApiBaseUrl,
  normalizeKnowledgeDocument,
} from "@/lib/knowledge-api";
import type { KnowledgeDocumentResponse } from "@/lib/knowledge-api";
import type { KnowledgeItem } from "@/lib/knowledge-catalog";

export async function getKnowledgeDocuments(): Promise<KnowledgeItem[]> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const response = await fetch(`${knowledgeApiBaseUrl}/knowledge-documents`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });

    if (!response.ok) {
      return [];
    }

    const documents = (await response.json()) as KnowledgeDocumentResponse[];
    return documents.map(normalizeKnowledgeDocument);
  } catch {
    return [];
  }
}
