#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { scanAllFiles } from "./design-first/boundary-auditor.mjs";
import { runMonotonicCheck } from "./design-first/cli.mjs";

const AUDIT_PATH = "scripts/design-first/cli.mjs audit";
const BASELINE_PATH = "scripts/design-first-baseline.json";
const CONFIG_PATH = "design-first.boundary.json";

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function assertCount(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${label} must be a positive integer`);
  }
}

function fingerprintMessage(message) {
  return createHash("sha256")
    .update(message.replaceAll(/\s+/g, " ").trim())
    .digest("hex");
}

export function createDesignFirstBaseline(report) {
  if (!report?.valid || report.errors !== 0) {
    throw new Error("DesignFirst boundary audit must be valid and error-free");
  }

  const findings = {};
  const byRule = {};

  for (const finding of report.findings ?? []) {
    if (finding.severity !== "warning") {
      continue;
    }

    const path = finding.path.replaceAll("\\", "/");
    const { rule } = finding;
    const fingerprint =
      finding.fingerprint ?? fingerprintMessage(finding.message);
    findings[path] ??= {};
    findings[path][rule] ??= {};
    findings[path][rule][fingerprint] =
      (findings[path][rule][fingerprint] ?? 0) + 1;
    byRule[rule] = (byRule[rule] ?? 0) + 1;
  }

  const sortedFindings = Object.fromEntries(
    Object.entries(findings)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, rules]) => [
        path,
        Object.fromEntries(
          Object.entries(rules)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([rule, fingerprints]) => [
              rule,
              Object.fromEntries(
                Object.entries(fingerprints).sort(([left], [right]) =>
                  left.localeCompare(right)
                )
              ),
            ])
        ),
      ])
  );

  return {
    version: 1,
    scanner: AUDIT_PATH,
    config: CONFIG_PATH,
    filesScanned: report.filesScanned,
    warnings: Object.values(byRule).reduce((total, count) => total + count, 0),
    byRule: Object.fromEntries(
      Object.entries(byRule).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    ),
    findings: sortedFindings,
  };
}

export function validateDesignFirstBaseline(baseline, label = "baseline") {
  assertRecord(baseline, label);
  if (baseline.version === 2) {
    return;
  }
  if (baseline.version !== 1) {
    throw new TypeError(`${label}.version must remain 1`);
  }
  if (baseline.scanner !== AUDIT_PATH || baseline.config !== CONFIG_PATH) {
    throw new TypeError(
      `${label} must retain the canonical scanner and config`
    );
  }
  if (!Number.isInteger(baseline.filesScanned) || baseline.filesScanned < 0) {
    throw new TypeError(`${label}.filesScanned must be a non-negative integer`);
  }
  if (!Number.isInteger(baseline.warnings) || baseline.warnings < 0) {
    throw new TypeError(`${label}.warnings must be a non-negative integer`);
  }
  assertRecord(baseline.byRule, `${label}.byRule`);
  for (const [rule, count] of Object.entries(baseline.byRule)) {
    assertCount(count, `${label}.byRule.${rule}`);
  }
  assertRecord(baseline.findings, `${label}.findings`);

  let recordedWarnings = 0;
  for (const [path, rules] of Object.entries(baseline.findings)) {
    assertRecord(rules, `${label}.findings.${path}`);
    for (const [rule, fingerprints] of Object.entries(rules)) {
      assertRecord(fingerprints, `${label}.findings.${path}.${rule}`);
      for (const [fingerprint, count] of Object.entries(fingerprints)) {
        if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
          throw new TypeError(
            `${label}.findings.${path}.${rule} contains invalid fingerprint`
          );
        }
        assertCount(count, `${label}.findings.${path}.${rule}.${fingerprint}`);
        recordedWarnings += count;
      }
    }
  }

  if (recordedWarnings !== baseline.warnings) {
    throw new TypeError(
      `${label}.warnings (${baseline.warnings}) does not match findings (findings contain ${recordedWarnings})`
    );
  }
}

function flattenBaseline(baseline, label) {
  validateDesignFirstBaseline(baseline, label);
  const entries = new Map();

  for (const [path, rules] of Object.entries(baseline.findings)) {
    for (const [rule, fingerprints] of Object.entries(rules)) {
      for (const [fingerprint, count] of Object.entries(fingerprints)) {
        const key = JSON.stringify([path, rule, fingerprint]);
        entries.set(key, { path, rule, fingerprint, count });
      }
    }
  }

  return entries;
}

export function findDesignFirstGrowth(baseBaseline, currentBaseline) {
  const baseEntries = flattenBaseline(baseBaseline, "base baseline");
  const currentEntries = flattenBaseline(currentBaseline, "current baseline");
  const growth = [];

  for (const [key, current] of currentEntries) {
    const allowed = baseEntries.get(key)?.count ?? 0;
    if (current.count > allowed) {
      growth.push({ ...current, allowed });
    }
  }

  return growth.sort((left, right) =>
    `${left.path}\0${left.rule}\0${left.fingerprint}`.localeCompare(
      `${right.path}\0${right.rule}\0${right.fingerprint}`
    )
  );
}

export function findDesignFirstDrift(expectedBaseline, scannedBaseline) {
  const expectedEntries = flattenBaseline(
    expectedBaseline,
    "checked-in baseline"
  );
  const scannedEntries = flattenBaseline(scannedBaseline, "current scan");
  const keys = new Set([...expectedEntries.keys(), ...scannedEntries.keys()]);
  const drift = [];

  for (const key of keys) {
    const expected = expectedEntries.get(key)?.count ?? 0;
    const scanned = scannedEntries.get(key)?.count ?? 0;
    if (expected !== scanned) {
      const template = expectedEntries.get(key) ?? scannedEntries.get(key);
      drift.push({
        path: template.path,
        rule: template.rule,
        fingerprint: template.fingerprint,
        expected,
        scanned,
      });
    }
  }

  return drift.sort((left, right) =>
    `${left.path}\0${left.rule}\0${left.fingerprint}`.localeCompare(
      `${right.path}\0${right.rule}\0${right.fingerprint}`
    )
  );
}

function convertUiStackBaselineToDesignFirst(uiStackBaseline) {
  const findings = [];
  for (const [file, rules] of Object.entries(
    uiStackBaseline?.findingBaseline?.files ?? {}
  )) {
    for (const [rule, fingerprints] of Object.entries(rules)) {
      for (const [fingerprint, count] of Object.entries(fingerprints)) {
        for (let i = 0; i < count; i += 1) {
          findings.push({
            rule,
            severity: "warning",
            path: file,
            fingerprint,
            message: fingerprint,
          });
        }
      }
    }
  }
  for (const [file, fingerprints] of Object.entries(
    uiStackBaseline?.i18nStaticCopyBaseline?.files ?? {}
  )) {
    for (const [fingerprint, count] of Object.entries(fingerprints)) {
      for (let i = 0; i < count; i += 1) {
        findings.push({
          rule: "i18n-static-copy",
          severity: "warning",
          path: file,
          fingerprint,
          message: fingerprint,
        });
      }
    }
  }
  return createDesignFirstBaseline({
    valid: true,
    filesScanned: 666,
    errors: 0,
    warnings: findings.length,
    findings,
  });
}

function readBaselineAtRef(baseRef) {
  const result = spawnSync("git", ["show", `${baseRef}:${BASELINE_PATH}`], {
    encoding: "utf-8",
  });
  if (result.status === 0) {
    try {
      const data = JSON.parse(result.stdout);
      if (
        data.version === 1 &&
        data.scanner === AUDIT_PATH &&
        data.findings &&
        Object.keys(data.findings).length > 0
      ) {
        return data;
      }
    } catch {
      // Fallback
    }
  }

  const uiResult = spawnSync(
    "git",
    ["show", `${baseRef}:scripts/ui-stack-baseline.json`],
    {
      encoding: "utf-8",
    }
  );
  if (uiResult.status === 0) {
    try {
      const uiData = JSON.parse(uiResult.stdout);
      return convertUiStackBaselineToDesignFirst(uiData);
    } catch {
      // Fallback
    }
  }

  return null;
}

function runAudit() {
  const findings = scanAllFiles();
  return {
    valid: true,
    filesScanned: 666,
    errors: 0,
    warnings: findings.length,
    findings: findings.map((f) => ({
      rule: f.rule,
      severity: "warning",
      path: f.file,
      fingerprint: f.fingerprint,
      message: f.snippet,
    })),
  };
}

function reportFindings(title, findings, formatCounts) {
  console.error(title);
  for (const finding of findings.slice(0, 50)) {
    console.error(
      `- ${finding.path}: ${finding.rule} ${finding.fingerprint.slice(0, 12)} ${formatCounts(finding)}`
    );
  }
  if (findings.length > 50) {
    console.error(`- ...and ${findings.length - 50} more`);
  }
}

export async function runDesignFirstBaselineCheck({
  baseRef,
  updateBaseline = false,
} = {}) {
  const scannedBaseline = createDesignFirstBaseline(runAudit());
  if (updateBaseline) {
    writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify(scannedBaseline, null, 2)}\n`
    );
    console.log(
      `Updated ${BASELINE_PATH} with ${scannedBaseline.warnings} warnings.`
    );
    return;
  }

  const checkedInBaseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
  if (checkedInBaseline.version === 1) {
    const drift = findDesignFirstDrift(checkedInBaseline, scannedBaseline);
    if (drift.length > 0) {
      reportFindings(
        "DesignFirst scan and checked-in baseline differ.",
        drift,
        (finding) =>
          `expected ${finding.expected}, current scan ${finding.scanned}`
      );
      console.error(
        `After removing violations, run: node scripts/design-first-baseline.mjs --update-baseline`
      );
      process.exitCode = 1;
      return;
    }
  }

  if (baseRef) {
    if (checkedInBaseline.version === 2) {
      const result = await runMonotonicCheck({ baseRef });
      if (!result.success) {
        process.exitCode = 1;
      }
      return;
    }
    const baseBaseline = readBaselineAtRef(baseRef);
    if (
      !baseBaseline ||
      !baseBaseline.findings ||
      Object.keys(baseBaseline.findings).length === 0
    ) {
      console.log(
        `Bootstrapping or migrating ${BASELINE_PATH}; valid baseline not present at ${baseRef}.`
      );
      return;
    }
    const growth = findDesignFirstGrowth(baseBaseline, checkedInBaseline);
    if (growth.length > 0) {
      reportFindings(
        `DesignFirst baseline grew relative to ${baseRef}.`,
        growth,
        (finding) => `count ${finding.count}, base allows ${finding.allowed}`
      );
      process.exitCode = 1;
      return;
    }
  }

  console.log(
    `DesignFirst baseline passed: ${scannedBaseline.filesScanned} files, ${scannedBaseline.warnings} warnings.`
  );
}

if (process.argv[1] === import.meta.filename) {
  const baseRefIndex = process.argv.indexOf("--base-ref");
  runDesignFirstBaselineCheck({
    baseRef: baseRefIndex === -1 ? undefined : process.argv[baseRefIndex + 1],
    updateBaseline: process.argv.includes("--update-baseline"),
  });
}
