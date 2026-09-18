import assert from "node:assert/strict";
import test from "node:test";

import { assessHookSetup } from "./hooks-doctor.mjs";

const completeSetup = {
  hooksPath: ".husky/_",
  hookFilesExist: true,
  hookLaunchersExist: true,
  lintStagedConfigExists: true,
  commitlintConfigExists: true,
  preCommitContents:
    "node scripts/repository-policy-guardrails.mjs\ncorepack pnpm exec lint-staged\ncorepack pnpm test:precommit\n",
  commitMessageContents:
    'corepack pnpm exec commitlint --edit "$1"\nnode scripts/commit-message-guard.mjs "$1"\n',
  prePushContents: 'node scripts/pre-push-guard.mjs "$1" "$2"\n',
  manifest: {
    scripts: { prepare: "husky" },
    devDependencies: {
      "@commitlint/cli": "^21.2.2",
      "@commitlint/config-conventional": "^21.2.2",
      husky: "^9.1.7",
    },
  },
};

test("accepts the repository Husky and staged-file gate", () => {
  assert.deepEqual(
    assessHookSetup(completeSetup).map((result) => result.passed),
    [true, true, true, true, true, true, true]
  );
});

test("explains when Husky has not installed its hook launcher", () => {
  const checks = assessHookSetup({
    ...completeSetup,
    hooksPath: undefined,
    hookLaunchersExist: false,
  });

  assert.equal(checks[0].passed, false);
  assert.match(checks[0].detail, /has not installed/i);
  assert.equal(checks[1].passed, false);
});

test("rejects a hook that no longer runs formatting before tests", () => {
  const checks = assessHookSetup({
    ...completeSetup,
    preCommitContents: "corepack pnpm test:precommit\n",
  });

  assert.equal(checks[4].passed, false);
});

test("rejects a pre-commit hook with policy checks in the wrong order", () => {
  const checks = assessHookSetup({
    ...completeSetup,
    preCommitContents:
      "corepack pnpm exec lint-staged\nnode scripts/repository-policy-guardrails.mjs\ncorepack pnpm test:precommit\n",
  });

  assert.equal(checks[4].passed, false);
});

test("rejects missing commit-message and push policies", () => {
  const checks = assessHookSetup({
    ...completeSetup,
    commitMessageContents: "",
    prePushContents: "",
  });

  assert.equal(checks[5].passed, false);
});
