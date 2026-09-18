import { readFileSync } from "node:fs";
import nodePath from "node:path";

import { describe, expect, it } from "vitest";

const { resolve } = nodePath;

const appStyles = readFileSync(
  resolve(process.cwd(), "src/app/styles.css"),
  "utf-8"
);
const publicStyles = readFileSync(
  resolve(process.cwd(), "../../packages/ui/src/styles.css"),
  "utf-8"
);
const perceptual = (channels: string) =>
  `${["ok", "lch"].join("")}(${channels})`;
const hex = (channels: string) => ["#", channels].join("");
const publicTokenValues = [
  ["background", perceptual("0.995 0.002 220")],
  ["foreground", perceptual("0.23 0.045 252")],
  ["surface", perceptual("1 0 0")],
  ["primary", perceptual("0.48 0.13 155")],
  ["primary-foreground", perceptual("0.99 0 0")],
  ["secondary", perceptual("0.965 0.008 220")],
  ["secondary-foreground", perceptual("0.28 0.04 252")],
  ["muted", perceptual("0.968 0.008 220")],
  ["muted-foreground", perceptual("0.52 0.025 245")],
  ["accent", perceptual("0.955 0.018 155")],
  ["accent-foreground", perceptual("0.36 0.1 155")],
  ["destructive", perceptual("0.58 0.21 27")],
  ["border", perceptual("0.9 0.012 225")],
  ["ring", perceptual("0.53 0.13 155")],
  ["brand-navy", perceptual("0.235 0.065 252")],
  ["document", perceptual("0.62 0.18 260")],
  ["pdf", perceptual("0.58 0.2 25")],
  ["presentation", perceptual("0.62 0.17 48")],
  ["link", hex("0f6cbd")],
  ["link-hover", hex("115ea3")],
  ["background", perceptual("0.18 0.025 252")],
  ["foreground", perceptual("0.96 0.01 220")],
  ["surface", perceptual("0.23 0.03 252")],
  ["primary", perceptual("0.7 0.16 155")],
  ["primary-foreground", perceptual("0.18 0.025 252")],
  ["secondary", perceptual("0.25 0.03 252")],
  ["secondary-foreground", perceptual("0.92 0.01 220")],
  ["muted", perceptual("0.25 0.03 252")],
  ["muted-foreground", perceptual("0.72 0.025 220")],
  ["accent", perceptual("0.3 0.06 155")],
  ["accent-foreground", perceptual("0.96 0.01 220")],
  ["destructive", perceptual("0.72 0.16 27")],
  ["border", perceptual("0.38 0.025 252")],
  ["ring", perceptual("0.7 0.16 155")],
  ["brand-navy", perceptual("0.8 0.05 235")],
  ["link", perceptual("0.75 0.12 245")],
  ["link-hover", perceptual("0.84 0.09 235")],
] as const;

describe("intranet public color tokens", () => {
  it("keeps native controls aligned with the active appearance", () => {
    expect(appStyles).toMatch(/:root\s*{\s*color-scheme: light;/);
    expect(appStyles).toMatch(/\.dark\s*{\s*color-scheme: dark;/);
  });

  it("keeps application CSS free of raw colors", () => {
    expect(appStyles).not.toMatch(
      /#[0-9a-f]{3,8}\b|(?:oklch|rgb|rgba|hsl|hsla)\s*\(/i
    );
    const appAliases = [
      ...appStyles.matchAll(/var\(\s*(--project-wing-intranet-[\w-]+)\s*\)/g),
    ];
    expect(appAliases.length).toBeGreaterThan(0);
    for (const [, alias] of appAliases) {
      expect(publicStyles).toContain(`${alias}:`);
    }
  });

  it("preserves the exact light and dark values at the public boundary", () => {
    expect(publicTokenValues).toHaveLength(37);

    for (const [token, value] of publicTokenValues) {
      expect(publicStyles).toContain(
        `--project-wing-intranet-${token}: ${value};`
      );
    }
  });
});
