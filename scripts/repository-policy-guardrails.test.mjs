import assert from "node:assert/strict";
import test from "node:test";

import {
  dependencyFingerprint,
  forbiddenFileReason,
  hasDirectPrettierDependency,
  repositoryPolicyViolations,
} from "./repository-policy-guardrails.mjs";

function inspect({
  branch = "feat/example",
  changedFiles = [],
  presentFiles = changedFiles,
  headFiles = {},
  indexFiles = {},
} = {}) {
  return repositoryPolicyViolations({
    branch,
    changedFiles,
    presentFiles,
    readHeadFile: (filePath) => headFiles[filePath],
    readIndexFile: (filePath) => indexFiles[filePath],
  });
}

test("blocks direct commits on main", () => {
  assert.match(inspect({ branch: "main" })[0], /Direct commits on main/);
});

test("blocks commits from a detached HEAD", () => {
  assert.match(inspect({ branch: "" })[0], /detached HEAD/);
});

test("blocks local environment, database, credential, and test output files", () => {
  for (const filePath of [
    ".env.local",
    "local.sqlite",
    "certificate.pfx",
    ["scripts/tool.", "py"].join(""),
    "package-lock.json",
    "PACKAGE-LOCK.JSON",
    ".prettierrc.json",
    "playwright-report/index.html",
    "screenshot-login.png",
  ]) {
    assert.ok(forbiddenFileReason(filePath), filePath);
  }
  assert.equal(forbiddenFileReason("apps/api/.env.example"), undefined);
  assert.equal(forbiddenFileReason("public/brand/login.png"), undefined);
});

test("blocks direct Prettier dependencies", () => {
  assert.equal(
    hasDirectPrettierDependency('{"devDependencies":{"prettier":"3"}}'),
    true
  );
  assert.equal(
    hasDirectPrettierDependency('{"devDependencies":{"oxfmt":"1"}}'),
    false
  );

  const filePath = "package.json";
  const violations = inspect({
    changedFiles: [filePath, "pnpm-lock.yaml"],
    headFiles: { [filePath]: '{"devDependencies":{}}' },
    indexFiles: {
      [filePath]: '{"devDependencies":{"prettier":"3"}}',
    },
  });
  assert.match(violations[0], /Prettier dependencies are prohibited/);
});

test("compares dependency metadata independent of key order", () => {
  assert.equal(
    dependencyFingerprint('{"dependencies":{"b":"2","a":"1"}}'),
    dependencyFingerprint('{"dependencies":{"a":"1","b":"2"}}')
  );
});

test("requires the lockfile only when dependency metadata changes", () => {
  const filePath = "apps/emp/package.json";
  const unchanged = inspect({
    changedFiles: [filePath],
    headFiles: { [filePath]: '{"scripts":{"test":"old"}}' },
    indexFiles: { [filePath]: '{"scripts":{"test":"new"}}' },
  });
  assert.deepEqual(unchanged, []);

  const changed = inspect({
    changedFiles: [filePath],
    headFiles: { [filePath]: '{"dependencies":{"react":"18"}}' },
    indexFiles: { [filePath]: '{"dependencies":{"react":"19"}}' },
  });
  assert.match(changed[0], /pnpm-lock\.yaml is not staged/);
});

test("requires a staged migration with a Prisma schema change", () => {
  const violation = inspect({
    changedFiles: ["apps/api/prisma/schema.prisma"],
  });
  assert.match(violation[0], /without a staged Prisma migration/);

  const documentationOnly = inspect({
    changedFiles: [
      "apps/api/prisma/schema.prisma",
      "apps/api/prisma/migrations/README.md",
    ],
  });
  assert.match(documentationOnly[0], /without a staged Prisma migration/);

  assert.deepEqual(
    inspect({
      changedFiles: [
        "apps/api/prisma/schema.prisma",
        "apps/api/prisma/migrations/20260824030000_example/migration.sql",
      ],
    }),
    []
  );
});
