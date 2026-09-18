import assert from "node:assert/strict";
import test from "node:test";

import {
  createDesignFirstBaseline,
  findDesignFirstDrift,
  findDesignFirstGrowth,
  validateDesignFirstBaseline,
} from "./design-first-baseline.mjs";

function report(findings = []) {
  return {
    valid: true,
    filesScanned: 1,
    errors: 0,
    warnings: findings.length,
    findings,
  };
}

function finding(message, overrides = {}) {
  return {
    rule: "arbitrary-value",
    severity: "warning",
    path: "apps/emp/src/view.tsx",
    message,
    ...overrides,
  };
}

test("creates a stable fingerprint baseline without line numbers", () => {
  const first = createDesignFirstBaseline(
    report([finding("Use token 'w-[20px]'", { line: 10 })])
  );
  const moved = createDesignFirstBaseline(
    report([finding("Use token 'w-[20px]'", { line: 99 })])
  );
  assert.deepEqual(first, moved);
  assert.equal(first.warnings, 1);
  assert.deepEqual(first.byRule, { "arbitrary-value": 1 });
});

test("counts repeated evidence in the same file", () => {
  const baseline = createDesignFirstBaseline(
    report([finding("Use a token"), finding("Use a token")])
  );
  const counts = Object.values(
    baseline.findings["apps/emp/src/view.tsx"]["arbitrary-value"]
  );
  assert.deepEqual(counts, [2]);
});

test("blocks new fingerprints and additional occurrences", () => {
  const base = createDesignFirstBaseline(report([finding("Existing")]));
  const current = createDesignFirstBaseline(
    report([finding("Existing"), finding("Existing"), finding("New")])
  );
  const growth = findDesignFirstGrowth(base, current);
  assert.equal(growth.length, 2);
  assert.deepEqual(
    growth.map(({ allowed, count }) => ({ allowed, count })),
    [
      { allowed: 1, count: 2 },
      { allowed: 0, count: 1 },
    ]
  );
});

test("allows findings to be removed", () => {
  const base = createDesignFirstBaseline(
    report([finding("Keep"), finding("Remove")])
  );
  const current = createDesignFirstBaseline(report([finding("Keep")]));
  assert.deepEqual(findDesignFirstGrowth(base, current), []);
});

test("requires the checked-in baseline to equal the current findings", () => {
  const checkedIn = createDesignFirstBaseline(
    report([finding("Stale"), finding("Shared")])
  );
  const scanned = createDesignFirstBaseline(
    report([finding("Shared"), finding("Added")])
  );
  const drift = findDesignFirstDrift(checkedIn, scanned);
  assert.equal(drift.length, 2);
  assert.deepEqual(
    drift
      .map(({ expected, scanned: count }) => ({ expected, count }))
      .sort((left, right) => left.expected - right.expected),
    [
      { expected: 0, count: 1 },
      { expected: 1, count: 0 },
    ]
  );
});

test("treats scanned file count as metadata while still blocking new findings", () => {
  const checkedIn = createDesignFirstBaseline(report([finding("Shared")]));
  const cleanAdditionalFile = {
    ...createDesignFirstBaseline(report([finding("Shared")])),
    filesScanned: 2,
  };
  assert.deepEqual(findDesignFirstDrift(checkedIn, cleanAdditionalFile), []);

  const addedWarning = {
    ...createDesignFirstBaseline(
      report([finding("Shared"), finding("New warning")])
    ),
    filesScanned: 2,
  };
  const drift = findDesignFirstDrift(checkedIn, addedWarning);
  assert.equal(drift.length, 1);
  assert.equal(drift[0].expected, 0);
  assert.equal(drift[0].scanned, 1);
});

test("rejects malformed summary and fingerprint data", () => {
  const baseline = createDesignFirstBaseline(report([finding("Existing")]));
  assert.throws(
    () => validateDesignFirstBaseline({ ...baseline, warnings: 2 }),
    /findings contain 1/
  );
  const malformed = structuredClone(baseline);
  const fingerprints =
    malformed.findings["apps/emp/src/view.tsx"]["arbitrary-value"];
  const [fingerprint] = Object.keys(fingerprints);
  const invalidFingerprint = fingerprints[fingerprint];
  const { [fingerprint]: _fingerprint, ...remainingFingerprints } =
    fingerprints;
  malformed.findings["apps/emp/src/view.tsx"]["arbitrary-value"] = {
    ...remainingFingerprints,
    invalid: invalidFingerprint,
  };
  assert.throws(
    () => validateDesignFirstBaseline(malformed),
    /invalid fingerprint/
  );
});
