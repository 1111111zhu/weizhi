import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  new URL("confirmation-overview-matrix.module.css", import.meta.url),
  "utf-8"
);
const normalizedStylesheet = stylesheet.replaceAll(/\s+/g, " ");

describe("confirmation overview matrix semantic styles", () => {
  it("preserves the established layout and motion values", () => {
    for (const declaration of [
      "transition-duration: 180ms",
      "transition-duration: 80ms !important",
      "transition-delay: 20ms",
      "transition-delay: 40ms",
      "transition-delay: 60ms",
      "transition-delay: 80ms",
      "min-width: 88rem",
      "min-width: 82rem",
      "min-width: 70rem",
      "min-width: 64rem",
      "min-width: 5.5rem",
      "0 18px 45px -32px color-mix(in srgb, var(--foreground) 42%, transparent)",
      "0 1px 0 color-mix(in srgb, var(--border) 75%, transparent)",
      "background: color-mix(in srgb, var(--muted) 95%, var(--card))",
      "background: color-mix(in srgb, var(--muted) 40%, var(--card))",
      "transition-property: translate",
      "transition-property: opacity, transform",
      "transition-property: width, opacity, transform, clip-path",
      "transition-property: background-color, border-color, box-shadow, color, transform",
    ]) {
      expect(normalizedStylesheet).toContain(
        declaration.replaceAll(/\s+/g, " ")
      );
    }
  });
});
