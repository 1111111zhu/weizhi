import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  attachmentContentPreviewQueryKey,
  enforcePreviewQueryCacheBudget,
  estimatePreviewDataBytes,
  getAttachmentContentPreviewKind,
  PREVIEW_QUERY_META,
  seedUploadedAttachmentPreview,
} from "./preview-query-cache";

describe("preview query cache budget", () => {
  it("evicts the oldest inactive preview entries above the entry cap", async () => {
    const queryClient = new QueryClient();
    for (const index of [1, 2, 3]) {
      await queryClient.fetchQuery({
        queryKey: ["attachmentPreview", index],
        queryFn: () => Promise.resolve(new Blob([String(index)])),
        meta: PREVIEW_QUERY_META,
        staleTime: Number.POSITIVE_INFINITY,
      });
      await new Promise((resolve) => {
        setTimeout(resolve, 1);
      });
    }

    enforcePreviewQueryCacheBudget(queryClient, {
      maxBytes: Number.POSITIVE_INFINITY,
      maxEntries: 2,
    });

    expect(queryClient.getQueryData(["attachmentPreview", 1])).toBeUndefined();
    expect(queryClient.getQueryData(["attachmentPreview", 2])).toBeDefined();
    expect(queryClient.getQueryData(["attachmentPreview", 3])).toBeDefined();
  });

  it("counts binary and structured preview data toward the byte cap", () => {
    expect(
      estimatePreviewDataBytes({
        page: new Blob([new Uint8Array(16)]),
        rows: [["cash", "100"]],
      })
    ).toBeGreaterThanOrEqual(16);
  });

  it("seeds the exact versioned content query after a verified upload", () => {
    const queryClient = new QueryClient();
    const attachment = {
      id: "attachment-1",
      version: 3,
      contentHash: "hash-v3",
      fileName: "report.pdf",
      originalName: "Report.pdf",
      mimeType: "application/pdf",
      fileSize: 7,
    };
    const file = new File(["preview"], "Report.pdf", {
      type: "application/pdf",
    });

    expect(
      seedUploadedAttachmentPreview(queryClient, "project-1", attachment, file)
    ).toBeTruthy();
    expect(
      queryClient.getQueryData(
        attachmentContentPreviewQueryKey("project-1", attachment, "pdf")
      )
    ).toBe(file);
  });

  it("rejects mismatched and oversized upload data", () => {
    const queryClient = new QueryClient();
    const attachment = {
      id: "attachment-1",
      version: 1,
      contentHash: "hash-v1",
      fileName: "report.pdf",
      mimeType: "application/pdf",
      fileSize: 2,
    };

    expect(
      seedUploadedAttachmentPreview(
        queryClient,
        "project-1",
        attachment,
        new File(["wrong"], "report.pdf")
      )
    ).toBeFalsy();
    expect(
      seedUploadedAttachmentPreview(
        queryClient,
        "project-1",
        { ...attachment, fileSize: 49 * 1024 * 1024 },
        {
          name: "report.pdf",
          size: 49 * 1024 * 1024,
          type: "application/pdf",
        } as File
      )
    ).toBeFalsy();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("resolves only content-preview formats", () => {
    expect(
      getAttachmentContentPreviewKind({
        fileName: "deck.pptx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      })
    ).toBe("pptx");
    expect(
      getAttachmentContentPreviewKind({
        fileName: "ledger.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
    ).toBeNull();
  });
});
