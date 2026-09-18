#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import nodePath from "node:path";

import { normalizePath } from "./boundary-auditor.mjs";

const { resolve } = nodePath;
const __dirname = import.meta.dirname;
const REPO_ROOT = resolve(__dirname, "../..");
export const BASELINE_PATH = resolve(
  REPO_ROOT,
  "scripts/design-first-baseline.json"
);

export function createFindingFingerprint(finding) {
  const file = normalizePath(finding.file);
  const evidence = String(finding.snippet ?? "")
    .trim()
    .replaceAll(/\s+/g, " ");
  return createHash("sha256")
    .update(`${file}\u0000${finding.rule}\u0000${evidence}`)
    .digest("hex");
}

function sortObjectDeep(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  return Object.fromEntries(
    Object.entries(obj)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, sortObjectDeep(v)])
  );
}

export function buildBaselineStructure(findings) {
  const fileCounts = {};
  const findingFiles = {};
  const i18nFiles = {};

  for (const finding of findings) {
    const file = normalizePath(finding.file);
    const rule = finding.rule;
    const fingerprint =
      finding.fingerprint ?? createFindingFingerprint(finding);

    fileCounts[file] ??= {};
    fileCounts[file][rule] = (fileCounts[file][rule] ?? 0) + 1;

    if (rule === "i18n-static-copy") {
      i18nFiles[file] ??= {};
      i18nFiles[file][fingerprint] = (i18nFiles[file][fingerprint] ?? 0) + 1;
    } else {
      findingFiles[file] ??= {};
      findingFiles[file][rule] ??= {};
      findingFiles[file][rule][fingerprint] =
        (findingFiles[file][rule][fingerprint] ?? 0) + 1;
    }
  }

  return {
    version: 2,
    generatedFrom: [
      "apps/emp/src",
      "apps/cmp/src",
      "apps/tms/src",
      "apps/ib/src",
      "apps/intranet/src",
      "apps/ui-showroom",
    ],
    files: sortObjectDeep(fileCounts),
    findingBaseline: {
      version: 1,
      files: sortObjectDeep(findingFiles),
    },
    i18nStaticCopyBaseline: {
      version: 1,
      files: sortObjectDeep(i18nFiles),
    },
  };
}

function incrementCount(map, key, count = 1) {
  map.set(key, (map.get(key) ?? 0) + count);
}

function findingCounts(findings) {
  const counts = new Map();
  for (const finding of findings) {
    const file = normalizePath(finding.file);
    const rule = finding.rule;
    const fingerprint =
      finding.fingerprint ?? createFindingFingerprint(finding);
    const key = `${file}\u0000${rule}\u0000${fingerprint}`;
    incrementCount(counts, key);
  }
  return counts;
}

function baselineCounts(baseline) {
  const counts = new Map();
  const baselineFiles = baseline?.findingBaseline?.files ?? {};
  for (const [file, rules] of Object.entries(baselineFiles)) {
    for (const [rule, fingerprints] of Object.entries(rules)) {
      for (const [fingerprint, count] of Object.entries(fingerprints)) {
        const key = `${normalizePath(file)}\u0000${rule}\u0000${fingerprint}`;
        counts.set(key, count);
      }
    }
  }
  const i18nBaselineFiles = baseline?.i18nStaticCopyBaseline?.files ?? {};
  for (const [file, fingerprints] of Object.entries(i18nBaselineFiles)) {
    for (const [fingerprint, count] of Object.entries(fingerprints)) {
      const key = `${normalizePath(file)}\u0000i18n-static-copy\u0000${fingerprint}`;
      counts.set(key, count);
    }
  }
  return counts;
}

export function diffFindingsAgainstBaseline(findings, baseline) {
  const current = findingCounts(findings);
  const allowedCounts = baselineCounts(baseline);
  const failures = [];
  for (const [key, count] of current.entries()) {
    const [file, rule, fingerprint] = key.split("\u0000");
    const allowed = allowedCounts.get(key) ?? 0;
    if (count > allowed) {
      failures.push({
        file,
        rule,
        fingerprint,
        count,
        allowed,
      });
    }
  }

  return {
    failures,
    isClean: failures.length === 0,
  };
}

function ordinaryBaselineEntries(files) {
  return Object.entries(files).flatMap(([file, rules]) =>
    Object.entries(rules).flatMap(([rule, fingerprints]) =>
      Object.entries(fingerprints).map(([fingerprint, count]) => ({
        count,
        file,
        fingerprint,
        rule,
      }))
    )
  );
}

function i18nBaselineEntries(files) {
  return Object.entries(files).flatMap(([file, fingerprints]) =>
    Object.entries(fingerprints).map(([fingerprint, count]) => ({
      count,
      file,
      fingerprint,
      rule: "i18n-static-copy",
    }))
  );
}

function collectBaselineGrowth(currentEntries, baseCountFor) {
  const growth = [];
  for (const entry of currentEntries) {
    const baseCount = baseCountFor(entry);
    if (entry.count > baseCount) {
      growth.push({
        baseCount,
        currentCount: entry.count,
        file: entry.file,
        fingerprint: entry.fingerprint,
        rule: entry.rule,
      });
    }
  }
  return growth;
}

export function diffBaselinesMonotonic(currentBaseline, baseBaseline) {
  const currentFiles = currentBaseline?.findingBaseline?.files ?? {};
  const baseFiles = baseBaseline?.findingBaseline?.files ?? {};
  const currentI18n = currentBaseline?.i18nStaticCopyBaseline?.files ?? {};
  const baseI18n = baseBaseline?.i18nStaticCopyBaseline?.files ?? {};
  const ordinaryGrowth = collectBaselineGrowth(
    ordinaryBaselineEntries(currentFiles),
    (entry) => baseFiles[entry.file]?.[entry.rule]?.[entry.fingerprint] ?? 0
  );
  const i18nGrowth = collectBaselineGrowth(
    i18nBaselineEntries(currentI18n),
    (entry) => baseI18n[entry.file]?.[entry.fingerprint] ?? 0
  );
  const growth = [...ordinaryGrowth, ...i18nGrowth];

  return {
    growth,
    isMonotonic: growth.length === 0,
  };
}

export function loadBaselineFromGit(
  baseRef,
  baselineRelativePath = "scripts/design-first-baseline.json"
) {
  try {
    const content = execFileSync(
      "git",
      ["show", `${baseRef}:${baselineRelativePath}`],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
    );
    const parsed = JSON.parse(content);
    if (parsed && parsed.version === 2) {
      return parsed;
    }
  } catch {
    // fallback
  }

  try {
    const content = execFileSync(
      "git",
      ["show", `${baseRef}:scripts/ui-stack-baseline.json`],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
    );
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function saveBaseline(baselinePath, baselineData) {
  writeFileSync(
    baselinePath,
    JSON.stringify(baselineData, null, 2) + "\n",
    "utf-8"
  );
}
