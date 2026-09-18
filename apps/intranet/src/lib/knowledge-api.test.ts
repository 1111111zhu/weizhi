import { afterEach, describe, expect, it, vi } from "vitest";

import {
  normalizeKnowledgeDocument,
  uploadKnowledgeDocument,
} from "@/lib/knowledge-api";

describe("knowledge API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves API-relative preview and download links", () => {
    const item = normalizeKnowledgeDocument({
      id: "doc-1",
      referenceCode: "ADM-001",
      title: "Archive policy",
      department: "admin",
      type: "policy",
      owner: "Admin User",
      updatedAt: "2026-08-02T10:00:00.000Z",
      previewUrl: "/knowledge-documents/doc-1/preview",
      downloadUrl: "/knowledge-documents/doc-1/download",
    });

    expect(item.previewUrl).toBe(
      "http://localhost:3000/knowledge-documents/doc-1/preview"
    );
    expect(item.downloadUrl).toBe(
      "http://localhost:3000/knowledge-documents/doc-1/download"
    );
    expect(item.updatedAt).toBe("2026-08-02");
  });

  it("does not invent a preview link for Office documents", () => {
    const item = normalizeKnowledgeDocument({
      id: "doc-office-1",
      referenceCode: "FIN-001",
      title: "Finance workbook",
      department: "finance",
      type: "template",
      owner: "Partner User",
      updatedAt: "2026-08-02T10:00:00.000Z",
      downloadUrl: "/knowledge-documents/doc-office-1/download",
    });

    expect(item.previewUrl).toBeUndefined();
    expect(item.downloadUrl).toBe(
      "http://localhost:3000/knowledge-documents/doc-office-1/download"
    );
  });

  it("uploads with the authenticated browser session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          id: "doc-1",
          referenceCode: "ADM-001",
          title: "Archive policy",
          department: "admin",
          type: "policy",
          owner: "Admin User",
          updatedAt: "2026-08-02T10:00:00.000Z",
          previewUrl: "/knowledge-documents/doc-1/preview",
          downloadUrl: "/knowledge-documents/doc-1/download",
        },
        { status: 201 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const body = new FormData();

    await uploadKnowledgeDocument(body);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/knowledge-documents",
      expect.objectContaining({
        body,
        credentials: "include",
        method: "POST",
      })
    );
  });
});
