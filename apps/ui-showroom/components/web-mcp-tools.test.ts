import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { normalizeDocsToolPath } from "./web-mcp-tools";

describe("components/web-mcp-tools contracts", () => {
  test("keeps navigation inside the docs route", () => {
    assert.equal(
      normalizeDocsToolPath({ path: "/docs/installation?mode=full#setup" }),
      "/docs/installation?mode=full#setup"
    );
    assert.equal(
      normalizeDocsToolPath({ path: "docs/components" }),
      "/docs/components"
    );
  });

  test("rejects external and non-docs navigation", () => {
    assert.equal(
      normalizeDocsToolPath({ path: "//evil.example/path" }),
      "/docs"
    );
    assert.equal(
      normalizeDocsToolPath({ path: "https://evil.example/docs" }),
      "/docs"
    );
    assert.equal(normalizeDocsToolPath({ path: "/review" }), "/docs");
    assert.equal(
      normalizeDocsToolPath({ path: "/docs/../../review" }),
      "/docs"
    );
  });
});
