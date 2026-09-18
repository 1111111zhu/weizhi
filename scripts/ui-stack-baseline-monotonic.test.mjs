import assert from "node:assert/strict";
import test from "node:test";

import {
  findBaselineGrowth,
  validateMonotonicBaselineShape,
} from "./ui-stack-baseline-monotonic.mjs";

function baseline({ i18n = {}, ui = {} } = {}) {
  return {
    version: 2,
    files: {},
    findingBaseline: { version: 1, files: ui },
    i18nStaticCopyBaseline: { version: 1, files: i18n },
  };
}

test("allows an unchanged debt baseline", () => {
  const value = baseline({
    i18n: { "app.tsx": { copyHash: 1 } },
    ui: { "app.tsx": { "native-control": { controlHash: 2 } } },
  });
  assert.deepEqual(findBaselineGrowth(value, structuredClone(value)), []);
});

test("allows fingerprints and occurrences to be removed", () => {
  const base = baseline({
    i18n: { "app.tsx": { copyHash: 2 } },
    ui: {
      "app.tsx": {
        "native-control": { controlHash: 2, removedHash: 1 },
      },
    },
  });
  const current = baseline({
    i18n: { "app.tsx": { copyHash: 1 } },
    ui: { "app.tsx": { "native-control": { controlHash: 1 } } },
  });
  assert.deepEqual(findBaselineGrowth(base, current), []);
});

test("blocks a new ordinary UI fingerprint", () => {
  const growth = findBaselineGrowth(
    baseline(),
    baseline({
      ui: { "app.tsx": { "native-control": { addedHash: 1 } } },
    })
  );
  assert.deepEqual(growth, [
    {
      allowed: 0,
      count: 1,
      file: "app.tsx",
      fingerprint: "addedHash",
      rule: "native-control",
    },
  ]);
});

test("blocks another occurrence of an existing fingerprint", () => {
  const base = baseline({
    ui: { "app.tsx": { "native-control": { controlHash: 1 } } },
  });
  const current = baseline({
    ui: { "app.tsx": { "native-control": { controlHash: 2 } } },
  });
  assert.equal(findBaselineGrowth(base, current)[0].allowed, 1);
  assert.equal(findBaselineGrowth(base, current)[0].count, 2);
});

test("blocks a new i18n fingerprint", () => {
  const growth = findBaselineGrowth(
    baseline(),
    baseline({ i18n: { "app.tsx": { addedCopyHash: 1 } } })
  );
  assert.equal(growth[0].rule, "i18n-static-copy");
  assert.equal(growth[0].allowed, 0);
});

test("treats moving debt to another file as new debt", () => {
  const base = baseline({
    ui: { "old.tsx": { "native-control": { controlHash: 1 } } },
  });
  const current = baseline({
    ui: { "new.tsx": { "native-control": { controlHash: 1 } } },
  });
  assert.equal(findBaselineGrowth(base, current)[0].file, "new.tsx");
});

test("rejects downgrading or removing exact baseline structures", () => {
  assert.throws(
    () => validateMonotonicBaselineShape({ version: 1 }),
    /version must remain 2/
  );
  assert.throws(
    () =>
      validateMonotonicBaselineShape({
        version: 2,
        findingBaseline: { version: 1, files: {} },
      }),
    /i18nStaticCopyBaseline must be an object/
  );
});

test("rejects zero or non-integer occurrence counts", () => {
  assert.throws(
    () =>
      findBaselineGrowth(
        baseline(),
        baseline({
          ui: { "app.tsx": { "native-control": { controlHash: 0 } } },
        })
      ),
    /must be a positive integer/
  );
  assert.throws(
    () =>
      findBaselineGrowth(
        baseline(),
        baseline({ i18n: { "app.tsx": { copyHash: 1.5 } } })
      ),
    /must be a positive integer/
  );
});
