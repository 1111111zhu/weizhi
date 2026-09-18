import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { themeFontSizes } from "./theme";

const appStyles = readFileSync(
  new URL("../styles.css", import.meta.url),
  "utf-8"
);
const publicStyles = readFileSync(
  new URL("../../../../packages/ui/src/styles.css", import.meta.url),
  "utf-8"
);
const hex = (channels: string) => ["#", channels].join("");
const cssVariable = (name: string) => ["var(", name, ")"].join("");
const publicEmpTokenValues = [
  ["login-action", hex("006b3f")],
  ["brand-tint-source", cssVariable("--pw-color-brand-tint-source")],
  ["brand-tint", cssVariable("--pw-color-brand-tint")],
  ["brand-tint-soft", cssVariable("--pw-color-brand-tint-soft")],
  ["preview-paper", hex("fefefc")],
  ["preview-surface-light", hex("eef1f4")],
  ["preview-surface-dark", hex("0f172a")],
  ["spreadsheet-body-hover", hex("f8fafc")],
  ["spreadsheet-header", hex("edf3fa")],
  ["spreadsheet-header-hover", hex("e5edf6")],
  ["spreadsheet-header-foreground", hex("64748b")],
  ["spreadsheet-first-row", hex("f8fbff")],
  ["smart-form-table-header", hex("f3f6f8")],
  ["smart-form-table-header-border", hex("d5dde5")],
  ["smart-form-table-header-foreground", hex("334155")],
  ["smart-form-table-group", hex("f8fafb")],
  ["smart-form-table-group-accent", hex("c4d0da")],
  ["scrollbar-track", hex("cbd5e1")],
  ["scrollbar-thumb", hex("94a3b8")],
  ["smart-form-table-header", hex("253340")],
  ["smart-form-table-header-border", hex("536779")],
  ["smart-form-table-header-foreground", hex("e2e8f0")],
  ["smart-form-table-group", hex("1e2934")],
  ["smart-form-table-group-accent", hex("71879a")],
] as const;
const publicCanvasGridTokenValues = [
  ["accent", "primary"],
  ["accent-soft", "accent"],
  ["accent-foreground", "primary-foreground"],
  ["text-strong", "foreground"],
  ["text-medium", "muted-foreground"],
  ["text-light", "muted-foreground"],
  ["text-bubble", "foreground"],
  ["text-header", "foreground"],
  ["text-group-header", "muted-foreground"],
  ["cell", "card"],
  ["cell-subtle", "background"],
  ["header", "muted"],
  ["header-focus", "accent"],
  ["header-hover", "secondary"],
  ["border", "border"],
  ["border-horizontal", "border"],
] as const;

describe("theme settings", () => {
  it("keeps typography settings independent from color mode", () => {
    expect(themeFontSizes).toStrictEqual(["sm", "md", "lg"]);
  });

  it("keeps raw EMP colors behind the public token boundary", () => {
    expect(appStyles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    const appAliases = [
      ...appStyles.matchAll(/var\(\s*(--project-wing-emp-[\w-]+)\s*\)/g),
    ];
    expect(appAliases.length).toBeGreaterThan(0);
    for (const [, alias] of appAliases) {
      expect(publicStyles).toContain(`${alias}:`);
    }
    expect(publicEmpTokenValues).toHaveLength(24);
    for (const mode of ["light", "dark"] as const) {
      expect(appStyles).toContain(
        [
          "--preview-surface: ",
          cssVariable(`--project-wing-emp-preview-surface-${mode}`),
          ";",
        ].join("")
      );
    }

    for (const [token, value] of publicEmpTokenValues) {
      expect(publicStyles).toContain(`--project-wing-emp-${token}: ${value};`);
    }
  });

  it("keeps the canvas data-grid palette behind exact public tokens", () => {
    const csvViewer = readFileSync(
      new URL("../components/extend/csv-viewer.tsx", import.meta.url),
      "utf-8"
    );

    expect(csvViewer).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    for (const mode of [":root", ".dark"]) {
      const [block = ""] = publicStyles
        .slice(publicStyles.indexOf(`${mode} {`))
        .split("}");
      for (const [token, role] of publicCanvasGridTokenValues) {
        expect(block.replaceAll(/\s+/g, "")).toContain(
          `--project-wing-canvas-grid-${token}:${cssVariable(`--pw-color-${role}`)};`
        );
      }
    }
  });
});
