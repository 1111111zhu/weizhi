import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));

describe("PDF font delivery boundary", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reads an allowlisted font only from the packaged font directory", async () => {
    vi.mocked(readFile).mockResolvedValue(Buffer.from("font-fixture"));
    const fileName = "LiberationSans-Regular.ttf";
    const response = await GET(new Request("https://showroom.test/font"), {
      params: Promise.resolve({ fileName }),
    });
    expect(readFile).toHaveBeenCalledExactlyOnceWith(
      path.join(process.cwd(), "../emp/public/pdfjs/standard_fonts", fileName)
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("font/ttf");
    await expect(response.text()).resolves.toBe("font-fixture");
  });

  it.each([
    "../../.env",
    "unknown.ttf",
    "LiberationSans-Regular.ttf/../secret",
  ])("rejects unapproved path %s without reading files", async (fileName) => {
    const response = await GET(new Request("https://showroom.test/font"), {
      params: Promise.resolve({ fileName }),
    });
    expect(response.status).toBe(404);
    expect(readFile).not.toHaveBeenCalled();
  });

  it("reports a missing packaged font without searching unrelated directories", async () => {
    vi.mocked(readFile).mockRejectedValue(new Error("missing fixture"));
    const response = await GET(new Request("https://showroom.test/font"), {
      params: Promise.resolve({ fileName: "LiberationSans-Bold.ttf" }),
    });
    expect(response.status).toBe(503);
    expect(readFile).toHaveBeenCalledOnce();
  });
});
