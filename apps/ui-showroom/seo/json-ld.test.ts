import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { serializeJsonLd } from "./json-ld";

describe("seo/json-ld contracts", () => {
  test("escapes characters that could terminate a JSON-LD script", () => {
    const serialized = serializeJsonLd({ value: "</script><script>&" });
    assert.equal(serialized.includes("</script>"), false);
    assert.equal(
      serialized,
      '{"value":"\\u003c/script\\u003e\\u003cscript\\u003e\\u0026"}'
    );
  });
});
