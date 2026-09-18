import { cookies } from "next/headers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

describe("knowledge download proxy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards the session and preserves attachment headers", async () => {
    vi.mocked(cookies).mockResolvedValue({
      toString: () => "session=knowledge-user",
    } as never);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("document bytes", {
        headers: {
          "content-disposition": 'attachment; filename="guide.pdf"',
          "content-type": "application/pdf",
        },
      })
    );
    const response = await GET(new Request("http://localhost/download"), {
      params: Promise.resolve({ documentId: "document/1" }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/knowledge-documents/document%2F1/download",
      {
        cache: "no-store",
        headers: { cookie: "session=knowledge-user" },
      }
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="guide.pdf"'
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.text()).resolves.toBe("document bytes");
  });
});
