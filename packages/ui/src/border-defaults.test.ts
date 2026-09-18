/// <reference types="node" />
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("styles.css", import.meta.url), "utf-8");

describe("shared border theme contract", () => {
  it("defaults elements and pseudo-elements to the theme divider in the base layer", () => {
    expect(css).toMatch(
      /@layer base\s*\{\s*\*,\s*::before,\s*::after\s*\{\s*border-color: var\(--border\);\s*\}/
    );
  });
});
