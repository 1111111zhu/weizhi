import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBaselineStructure,
  createFindingFingerprint,
  diffBaselinesMonotonic,
  diffFindingsAgainstBaseline,
} from "./baseline-engine.mjs";

test("creates baseline structure and calculates deterministic fingerprints", () => {
  const finding = {
    file: "apps/emp/src/page.tsx",
    rule: "native-control",
    snippet: '<button type="button">Click</button>',
  };
  const fingerprint = createFindingFingerprint(finding);
  assert.equal(typeof fingerprint, "string");
  assert.equal(fingerprint.length, 64);

  const baseline = buildBaselineStructure([finding]);
  assert.equal(baseline.version, 2);
  assert.equal(baseline.files["apps/emp/src/page.tsx"]["native-control"], 1);
  assert.equal(
    baseline.findingBaseline.files["apps/emp/src/page.tsx"]["native-control"][
      fingerprint
    ],
    1
  );
});

test("allows matching findings and rejects unexpected new debt", () => {
  const finding1 = {
    file: "apps/emp/src/page.tsx",
    rule: "native-control",
    snippet: '<button type="button">Click</button>',
  };
  const baseline = buildBaselineStructure([finding1]);
  const cleanDiff = diffFindingsAgainstBaseline([finding1], baseline);
  assert.equal(cleanDiff.isClean, true);
  assert.equal(cleanDiff.failures.length, 0);

  const finding2 = {
    file: "apps/emp/src/page.tsx",
    rule: "no-restricted-syntax",
    snippet: 'style={{ color: "red" }}',
  };
  const dirtyDiff = diffFindingsAgainstBaseline([finding1, finding2], baseline);
  assert.equal(dirtyDiff.isClean, false);
  assert.equal(dirtyDiff.failures.length, 1);
  assert.equal(dirtyDiff.failures[0].rule, "no-restricted-syntax");
});

test("detects non-monotonic baseline growth", () => {
  const finding = {
    file: "apps/emp/src/page.tsx",
    rule: "native-control",
    snippet: '<button type="button">Click</button>',
  };
  const baseBaseline = buildBaselineStructure([finding]);
  const updatedFinding = {
    file: "apps/emp/src/new-page.tsx",
    rule: "native-control",
    snippet: '<button type="button">Click</button>',
  };
  const grownBaseline = buildBaselineStructure([finding, updatedFinding]);
  const monotonicDiff = diffBaselinesMonotonic(grownBaseline, baseBaseline);
  assert.equal(monotonicDiff.isMonotonic, false);
  assert.equal(monotonicDiff.growth.length, 1);
  assert.equal(monotonicDiff.growth[0].file, "apps/emp/src/new-page.tsx");
});
