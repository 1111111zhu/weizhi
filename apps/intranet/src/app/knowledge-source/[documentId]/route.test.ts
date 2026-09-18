import { cookies } from "next/headers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

describe("knowledge preview source proxy", () => {
  afterEach(() => vi.restoreAllMocks());

  it("serves a versioned preview source with short private revalidation", async () => {
    vi.mocked(cookies).mockResolvedValue({
      toString: () => "session=knowledge-user",
    } as never);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("document bytes", {
        headers: {
          "content-type": "application/pdf",
          etag: 'W/"doc-v1"',
        },
      })
    );
    const response = await GET(new Request("http://localhost/source?v=1"), {
      params: Promise.resolve({ documentId: "document/1" }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/knowledge-documents/document%2F1/preview",
      {
        cache: "no-store",
        headers: { cookie: "session=knowledge-user" },
      }
    );
    expect(response.headers.get("cache-control")).toBe(
      "private, max-age=60, must-revalidate"
    );
    expect(response.headers.get("etag")).toBe('W/"doc-v1"');
  });
});
