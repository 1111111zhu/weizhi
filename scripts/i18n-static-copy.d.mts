export type I18nStaticCopyFinding = {
  file: string;
  fingerprint: string;
  rule: "i18n-static-copy";
  line: number;
  copy: string;
  snippet: string;
};

export function analyzeI18nStaticCopy(
  filePath: string,
  source: string
): I18nStaticCopyFinding[];
export function createI18nStaticCopyBaseline(
  findings: I18nStaticCopyFinding[]
): { version: number; files: Record<string, Record<string, number>> };
export function diffI18nStaticCopyAgainstBaseline(
  findings: I18nStaticCopyFinding[],
  baseline: { files?: Record<string, Record<string, number>> }
): { allowed: number; count: number; file: string; rule: "i18n-static-copy" }[];
