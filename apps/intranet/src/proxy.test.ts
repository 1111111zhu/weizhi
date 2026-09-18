import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "./proxy";

describe("intranet proxy", () => {
  it.each([
    "knowledge-preview/doc-1",
    "knowledge-download/doc-1",
    "knowledge-source/doc-1",
    "knowledge-attachment-preview/attachment-1",
    "knowledge-attachment-download/attachment-1",
    "knowledge-attachment-source/attachment-1",
  ])("does not add a locale prefix to internal file route %s", (path) => {
    const response = proxy(
      new NextRequest(`https://intranet.example.test/${path}`)
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
