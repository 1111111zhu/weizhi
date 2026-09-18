/// <reference types="node" />
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { badgeVariants } from "./badge";

const css = readFileSync(
  new URL("color-palette.css", import.meta.url),
  "utf-8"
);

const tones = ["success", "warning", "info", "destructive"] as const;

function luminance(hex: string) {
  const matches = hex.slice(1).match(/../g);
  if (!matches) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const channels = matches.map((part) => {
    const c = Number.parseInt(part, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [red = 0, green = 0, blue = 0] = channels;
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  const [lighter = 0, darker = 0] = values;
  return (lighter + 0.05) / (darker + 0.05);
}

function requiredColor(colors: Record<string, string>, name: string) {
  const value = colors[name];
  if (!value) {
    throw new Error(`Missing color token: ${name}`);
  }
  return value;
}

describe("enterprise color accessibility contract", () => {
  it("keeps content white and neutral grouping surfaces light without weakening text", () => {
    const [light = ""] = css.split(".dark");
    const colors = Object.fromEntries(
      [...light.matchAll(/--pw-color-([\w-]+): (#[\da-f]{6});/g)].map(
        (match) => [match[1], match[2]]
      )
    ) as Record<string, string>;
    expect(requiredColor(colors, "card")).toBe("#ffffff");
    expect(requiredColor(colors, "surface")).toBe("#ffffff");
    for (const role of [
      "foreground",
      "muted-foreground",
      "background",
      "muted",
    ]) {
      const channels =
        requiredColor(colors, role)
          .slice(1)
          .match(/../g)
          ?.map((part) => Number.parseInt(part, 16)) ?? [];
      expect(channels).toHaveLength(3);
      expect(Math.max(...channels) - Math.min(...channels)).toBeLessThanOrEqual(
        12
      );
    }
    for (const role of [
      "background",
      "muted",
      "secondary",
      "brand-tint-soft",
    ]) {
      expect(luminance(requiredColor(colors, role))).toBeGreaterThan(0.9);
    }
    expect(
      contrast(
        requiredColor(colors, "foreground"),
        requiredColor(colors, "accent")
      )
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps canvas grids on the same semantic palette as HTML grids", () => {
    const source = readFileSync(
      new URL("styles.css", import.meta.url),
      "utf-8"
    );
    const tokens = [
      ...source.matchAll(/--project-wing-canvas-grid-[\w-]+: ([^;]+);/g),
    ];
    expect(tokens.length).toBeGreaterThan(0);
    for (const [, value] of tokens) {
      expect(value).toMatch(/^var\(\s*--pw-color-[\w-]+\s*\)$/);
    }
  });

  it.each([
    "./data-grid/master-data-grid.tsx",
    "../../../apps/cmp/src/components/cmp-clients-data-grid.tsx",
    "../../../apps/emp/src/components/workbench-paper-section.tsx",
  ])("%s does not shadow status roles inside a grid", (path) => {
    const source = readFileSync(new URL(path, import.meta.url), "utf-8");
    expect(source).not.toMatch(
      /\[--(?:info|success|warning|destructive)(?:-foreground)?:/
    );
  });

  it.each([
    "./styles.css",
    "../../../apps/emp/src/styles.css",
    "../../../apps/cmp/src/app/styles.css",
    "../../../apps/tms/src/styles.css",
    "../../../apps/intranet/src/app/styles.css",
  ])("%s keeps global semantic roles on the shared palette", (path) => {
    const source = readFileSync(new URL(path, import.meta.url), "utf-8");
    const scopes = [...source.matchAll(/(?:^:root|^\.dark) \{([\s\S]*?)^\}/gm)];
    expect(scopes.length).toBeGreaterThan(0);
    for (const [, block = ""] of scopes) {
      for (const [, role, value] of block.matchAll(
        /--(background|foreground|muted-foreground|primary|primary-foreground|success|warning|info|destructive|success-foreground|warning-foreground|info-foreground|destructive-foreground): ([^;]+);/g
      )) {
        expect(value, `${path}: ${role}`).toBe(`var(--pw-color-${role})`);
      }
    }
  });

  describe.each([":root", ".dark"])("%s palette", (mode) => {
    const [block = ""] = css.slice(css.indexOf(`${mode} {`)).split("}");
    const colors = Object.fromEntries(
      [...block.matchAll(/--pw-color-([\w-]+): (#[\da-f]{6});/g)].map((m) => [
        m[1],
        m[2],
      ])
    ) as Record<string, string>;
    const pairs = [
      ["foreground", "background"],
      ["foreground", "card"],
      ["muted-foreground", "card"],
      ["muted-foreground", "muted"],
      ["primary", "card"],
      ["primary-foreground", "primary"],
      ["secondary-foreground", "secondary"],
      ["accent-foreground", "accent"],
      ...tones.flatMap((tone) => [
        [`${tone}-foreground`, tone],
        [`${tone}-text`, `${tone}-subtle`],
        [`${tone}-text`, "card"],
        [`${tone}-accent-foreground`, `${tone}-accent`],
        ["foreground", `${tone}-subtle`],
      ]),
    ];

    it.each(pairs)(
      `${mode}: %s on %s meets 4.5:1 for ordinary text`,
      (fg, bg) => {
        expect(
          contrast(requiredColor(colors, fg), requiredColor(colors, bg))
        ).toBeGreaterThanOrEqual(4.5);
      }
    );

    it.each([
      ["ring", "card"],
      ["ring", "background"],
      ["input", "card"],
      ["input", "background"],
    ])(`${mode}: %s boundary on %s meets 3:1`, (foreground, background) => {
      expect(
        contrast(
          requiredColor(colors, foreground),
          requiredColor(colors, background)
        )
      ).toBeGreaterThanOrEqual(3);
    });
  });

  it.each(tones)(
    "%s badge separates filled and subtle foreground roles",
    (tone) => {
      expect(badgeVariants({ variant: tone })).toContain(
        `text-${tone}-accent-foreground`
      );
      expect(badgeVariants({ variant: `${tone}-light` })).toContain(
        "text-foreground"
      );
      expect(badgeVariants({ variant: `${tone}-light` })).toContain(
        `before:bg-${tone}-accent`
      );
      expect(badgeVariants({ variant: `${tone}-light` })).toContain(
        `bg-${tone}-subtle`
      );
      expect(badgeVariants({ variant: `${tone}-outline` })).toContain(
        "text-foreground"
      );
      expect(badgeVariants({ variant: `${tone}-outline` })).toContain(
        `before:bg-${tone}-accent`
      );
    }
  );
});
