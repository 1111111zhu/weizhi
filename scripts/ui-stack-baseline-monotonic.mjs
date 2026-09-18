#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BASELINE_PATH = "scripts/ui-stack-baseline.json";

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

export function validateMonotonicBaselineShape(baseline, label = "baseline") {
  assertRecord(baseline, label);
  if (baseline.version !== 2) {
    throw new TypeError(`${label}.version must remain 2`);
  }
  assertRecord(baseline.findingBaseline, `${label}.findingBaseline`);
  if (baseline.findingBaseline.version !== 1) {
    throw new TypeError(`${label}.findingBaseline.version must remain 1`);
  }
  assertRecord(
    baseline.findingBaseline.files,
    `${label}.findingBaseline.files`
  );
  assertRecord(
    baseline.i18nStaticCopyBaseline,
    `${label}.i18nStaticCopyBaseline`
  );
  if (baseline.i18nStaticCopyBaseline.version !== 1) {
    throw new TypeError(
      `${label}.i18nStaticCopyBaseline.version must remain 1`
    );
  }
  assertRecord(
    baseline.i18nStaticCopyBaseline.files,
    `${label}.i18nStaticCopyBaseline.files`
  );
}

function flattenBaseline(baseline, label) {
  validateMonotonicBaselineShape(baseline, label);
  const entries = new Map();

  for (const [file, rules] of Object.entries(baseline.findingBaseline.files)) {
    assertRecord(rules, `${label}.findingBaseline.files[${file}]`);
    for (const [rule, fingerprints] of Object.entries(rules)) {
      assertRecord(
        fingerprints,
        `${label}.findingBaseline.files[${file}][${rule}]`
      );
      for (const [fingerprint, count] of Object.entries(fingerprints)) {
        assertCount(
          count,
          `${label}.findingBaseline.files[${file}][${rule}][${fingerprint}]`
        );
        const key = JSON.stringify([file, rule, fingerprint]);
        entries.set(key, { count, file, fingerprint, rule });
      }
    }
  }

  for (const [file, fingerprints] of Object.entries(
    baseline.i18nStaticCopyBaseline.files
  )) {
    assertRecord(
      fingerprints,
      `${label}.i18nStaticCopyBaseline.files[${file}]`
    );
    for (const [fingerprint, count] of Object.entries(fingerprints)) {
      assertCount(
        count,
        `${label}.i18nStaticCopyBaseline.files[${file}][${fingerprint}]`
      );
      const rule = "i18n-static-copy";
      const key = JSON.stringify([file, rule, fingerprint]);
      entries.set(key, { count, file, fingerprint, rule });
    }
  }

  return entries;
}

export function findBaselineGrowth(baseBaseline, currentBaseline) {
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
    `${left.file}\0${left.rule}\0${left.fingerprint}`.localeCompare(
      `${right.file}\0${right.rule}\0${right.fingerprint}`
    )
  );
}

function readBaselineAtRef(baseRef) {
  const result = spawnSync("git", ["show", `${baseRef}:${BASELINE_PATH}`], {
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(
      `Could not read ${BASELINE_PATH} at ${baseRef}: ${result.stderr.trim()}`
    );
  }
  return JSON.parse(result.stdout);
}

export function runBaselineMonotonicityCheck({
  baseRef,
  currentBaseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8")),
} = {}) {
  if (!baseRef) {
    throw new Error(
      "Usage: ui-stack-baseline-monotonic.mjs --base-ref <git-ref>"
    );
  }
  const growth = findBaselineGrowth(
    readBaselineAtRef(baseRef),
    currentBaseline
  );
  if (growth.length === 0) {
    console.log(`UI debt baseline is monotonic relative to ${baseRef}.`);
    return;
  }

  console.error("UI debt baseline grew; historical debt must be monotonic.");
  for (const finding of growth) {
    console.error(
      `- ${finding.file}: ${finding.rule} fingerprint ${finding.fingerprint.slice(0, 12)} occurs ${finding.count} time(s); base allows ${finding.allowed}`
    );
  }
  process.exitCode = 1;
}

if (process.argv[1] === import.meta.filename) {
  const baseRefIndex = process.argv.indexOf("--base-ref");
  runBaselineMonotonicityCheck({
    baseRef: baseRefIndex === -1 ? undefined : process.argv[baseRefIndex + 1],
  });
}
