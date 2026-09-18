import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { analyzeI18nStaticCopy } from "../../../../scripts/i18n-static-copy.mjs";

const srcRoot = path.resolve(import.meta.dirname, "..");
const hanPattern = /\p{Script=Han}/u;
const allowedFiles = new Set([
  "api/mock-actions.ts",
  "api/mock-api.ts",
  "api/mock-data.ts",
  "api/mock-confirmation-library.ts",
]);

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      return collectSourceFiles(fullPath);
    }

    if (!/\.(ts|tsx)$/.test(entry)) {
      return [];
    }
    if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) {
      return [];
    }
    return [fullPath];
  });
}

describe("i18n hardcoded copy guard", () => {
  it("keeps non-dictionary UI source free of hardcoded Chinese copy", () => {
    const offenders = collectSourceFiles(srcRoot)
      .map((filePath) => ({
        filePath,
        relativePath: path
          .relative(srcRoot, filePath)
          .split(path.sep)
          .join("/"),
        content: readFileSync(filePath, "utf-8"),
      }))
      .filter(({ relativePath }) => !allowedFiles.has(relativePath))
      .flatMap(({ relativePath, content }) =>
        analyzeI18nStaticCopy(`apps/emp/src/${relativePath}`, content)
          .filter((finding) => hanPattern.test(finding.copy))
          .map((finding) => `${relativePath}:${finding.line} — ${finding.copy}`)
      );

    expect(offenders).toStrictEqual([]);
  });

  it("rejects Chinese UI text and labels while preserving dictionary ownership and legacy-data comparisons", () => {
    const ui = analyzeI18nStaticCopy(
      "apps/emp/src/components/example.tsx",
      'const label = "中文按钮"; const view = <button aria-label={label}>立即执行</button>;'
    );
    expect(ui.map((finding) => finding.copy)).toContain("中文按钮");
    expect(ui.map((finding) => finding.copy)).toContain("立即执行");
    expect(
      analyzeI18nStaticCopy(
        "apps/emp/src/i18n/feature-copy.ts",
        'export const copy = { title: "标题" };'
      )
    ).toStrictEqual([]);
    expect(
      analyzeI18nStaticCopy(
        "apps/emp/src/components/example.tsx",
        '// 旧版本数据兼容\nconst isQuestion = value === "问题";'
      )
    ).toStrictEqual([]);
  });
});
