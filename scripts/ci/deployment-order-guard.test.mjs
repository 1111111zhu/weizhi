import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const guard = path.join(root, "scripts/ci/deployment-order-guard.sh");
const fakeBin = mkdtempSync(path.join(tmpdir(), "projectwing-order-"));
const fakeGh = path.join(fakeBin, "gh");
writeFileSync(fakeGh, `#!/usr/bin/env bash
if [[ "$*" == *'/commits/main'* ]]; then printf '%s\\n' "$GH_MAIN"; else printf '%s\\n' "\${GH_COMPARE:-ahead}"; fi
`);
chmodSync(fakeGh, 0o755);
test.after(() => rmSync(fakeBin, { recursive: true, force: true }));

const oldSha = "a".repeat(40);
const sourceSha = "b".repeat(40);
const otherSha = "c".repeat(40);

function state(overrides = {}) {
  return JSON.stringify({
    schemaVersion: 4,
    activeColor: "green",
    activeGateway: "http://172.19.143.158:18080",
    releaseKey: `${oldSha}-1-1`,
    version: oldSha,
    sourceCommitSha: oldSha,
    imageSourceSha: oldSha,
    generation: 4,
    routeMode: "serving",
    ...overrides,
  });
}

function run(activeState, environment = {}) {
  return spawnSync("bash", [guard], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      GITHUB_REPOSITORY: "owner/repo",
      GH_MAIN: sourceSha,
      PROJECTWING_SOURCE_COMMIT_SHA: sourceSha,
      PROJECTWING_ACTIVE_EDGE_STATE: activeState,
      ...environment,
    },
  });
}

test("only the current main descendant may proceed", () => {
  assert.equal(run(state()).stdout.trim(), "proceed");
  assert.equal(run(state(), { PROJECTWING_SOURCE_COMMIT_SHA: otherSha }).stdout.trim(), "superseded");
  assert.equal(run(state({ sourceCommitSha: sourceSha, version: sourceSha })).stdout.trim(), "already-active");
  assert.equal(run(state(), { GH_COMPARE: "diverged" }).stdout.trim(), "superseded");
});

test("a stale maintenance transaction resumes only with its persisted marker authorization", () => {
  const maintenance = state({
    routeMode: "maintenance",
    pendingReleaseKey: `${sourceSha}-9-1`,
    pendingSourceCommitSha: sourceSha,
  });
  const stale = { GH_MAIN: otherSha };
  assert.equal(run(maintenance, stale).stdout.trim(), "maintenance-stale");
  assert.equal(
    run(maintenance, { ...stale, PROJECTWING_ALLOW_STALE_MAINTENANCE_RESUME: "true" }).stdout.trim(),
    "resume",
  );
  const takeover = run(maintenance, { PROJECTWING_SOURCE_COMMIT_SHA: otherSha, GH_MAIN: otherSha });
  assert.notEqual(takeover.status, 0);
  assert.match(takeover.stderr, /Maintenance belongs to/);
});

test("completed stale maintenance can be recovered only with matching image authorization", () => {
  const maintenance = state({
    routeMode: "maintenance",
    pendingReleaseKey: `${sourceSha}-9-1`,
    pendingSourceCommitSha: sourceSha,
    pendingImageSourceSha: sourceSha,
  });
  const recovery = run(maintenance, {
    PROJECTWING_SOURCE_COMMIT_SHA: otherSha,
    GH_MAIN: otherSha,
    PROJECTWING_ALLOW_COMPLETED_MAINTENANCE_RECOVERY: "true",
    PROJECTWING_PENDING_IMAGE_SOURCE_SHA: sourceSha,
    PROJECTWING_IMAGE_SOURCE_SHA: sourceSha,
  });
  assert.equal(recovery.stdout.trim(), "recover-maintenance");
  const mismatchedImage = run(maintenance, {
    PROJECTWING_SOURCE_COMMIT_SHA: otherSha,
    GH_MAIN: otherSha,
    PROJECTWING_ALLOW_COMPLETED_MAINTENANCE_RECOVERY: "true",
    PROJECTWING_PENDING_IMAGE_SOURCE_SHA: sourceSha,
    PROJECTWING_IMAGE_SOURCE_SHA: otherSha,
  });
  assert.notEqual(mismatchedImage.status, 0);
});
