/// <reference types="node" />
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const tokens = readFileSync(
  new URL("material3-tokens.css", import.meta.url),
  "utf-8"
);
const components = readFileSync(
  new URL("material3-components.css", import.meta.url),
  "utf-8"
);
const applicationStyles = [
  "../../../apps/cmp/src/app/mobile-material.css",
  "../../../apps/tms/src/mobile-material.css",
  "../../../apps/intranet/src/app/mobile-material.css",
  "../../../apps/emp/src/components/emp-mobile-navigation.css",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf-8"));
function palette(pattern: RegExp) {
  const block = tokens.match(pattern)?.[1];
  if (!block) {
    throw new Error("Missing theme");
  }
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/g)].map((match) => [
      match[1],
      match[2],
    ])
  );
}
function luminance(hex: string) {
  if (!hex) {
    throw new Error("Missing color");
  }
  const channels = [1, 3, 5]
    .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
describe("mobile-only Material 3 contract", () => {
  it.each([tokens, components, ...applicationStyles])(
    "contains no desktop-active rules",
    (css) => {
      const source = css.replaceAll(/\/\*[\s\S]*?\*\//g, "").trim();
      expect(source).toMatch(/^@media (?:screen and )?\(width < 48rem\)/);
      let depth = 0;
      let trailing = "unclosed";
      for (let i = source.indexOf("{"); i < source.length; i += 1) {
        if (source[i] === "{") {
          depth += 1;
        }
        if (source[i] === "}") {
          depth -= 1;
        }
        if (depth === 0) {
          trailing = source.slice(i + 1).trim();
          break;
        }
      }
      expect(trailing).toBe("");
      expect(depth).toBe(0);
    }
  );

  it.each([
    ["light", /:root\s*\{([^{}]*)\}/],
    ["dark", /\.dark,\s*\.extend-viewer-surface-dark\s*\{([^{}]*)\}/],
  ] as const)(
    "%s preserves readable tone pairs and control boundaries",
    (_name, pattern) => {
      const colors = palette(pattern);
      for (const [text, surface] of [
        ["on-primary", "primary"],
        ["on-primary-container", "primary-container"],
        ["on-secondary-container", "secondary-container"],
        ["on-tertiary-container", "tertiary-container"],
        ["on-surface", "surface"],
        ["on-surface-variant", "surface-container"],
        ["on-error", "error"],
        ["on-error-container", "error-container"],
        ["inverse-on-surface", "inverse-surface"],
      ]) {
        expect(
          contrast(
            colors[`md-sys-color-${text}`],
            colors[`md-sys-color-${surface}`]
          )
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrast(
          colors["md-sys-color-outline"],
          colors["md-sys-color-surface-container-lowest"]
        )
      ).toBeGreaterThanOrEqual(3);
      for (const tone of ["success", "warning", "info"]) {
        expect(
          contrast(
            colors[`pw-sys-color-on-${tone}`],
            colors[`pw-sys-color-${tone}`]
          )
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  );

  it("includes pressed, keyboard, invalid, disabled and reduced-motion treatments", () => {
    expect(tokens).toContain("--pw-control-target: max(44px, 2.75rem)");
    for (const state of [
      "focus-visible",
      "aria-pressed",
      "aria-invalid",
      ":disabled",
      "prefers-reduced-motion",
    ]) {
      expect(components).toContain(state);
    }
  });
});
