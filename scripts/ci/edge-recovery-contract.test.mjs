import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const reconcile = fs.readFileSync(path.join(root, "scripts/ci/reconcile-degraded-edge-state.sh"), "utf8");
const recoveryNode = fs.readFileSync(path.join(root, "scripts/ci/edge-recovery-node.sh"), "utf8");
const health = fs.readFileSync(path.join(root, "scripts/ci/edge-ha-health.sh"), "utf8");
const recoveryWorkflow = fs.readFileSync(path.join(root, ".github/workflows/edge-state-recovery.yml"), "utf8");
const bundleWorkflow = fs.readFileSync(path.join(root, ".github/workflows/oss-image-bundle-pilot.yml"), "utf8");

test("degraded reconciliation holds the global lease and repairs the lagging data plane", () => {
  assert.match(reconcile, /deployment-lock-remote\.sh[^\n]+\$\{action\}/);
  assert.match(reconcile, /global_lock acquire/);
  assert.match(reconcile, /global_lock assert/);
  assert.match(reconcile, /global_lock release/);
  assert.match(reconcile, /edge-recovery-node\.sh/);
  assert.match(reconcile, /recover/);
  assert.match(reconcile, /rollback/);
  assert.doesNotMatch(reconcile, /mv -f "\$\{new_file\}" "\$\{state_file\}"/);
});

test("lagging recovery makes Keepalived fail closed until route and state converge", () => {
  assert.match(recoveryNode, /reconcile\.in-progress/);
  assert.match(recoveryNode, /edge-routing\.yml/);
  assert.match(recoveryNode, /pw_wait_for_full_edge_stack/);
  assert.match(recoveryNode, /pw_verify_api_route 'Prisma Studio'/);
  assert.match(recoveryNode, /flock --nonblock/);
  assert.match(recoveryNode, /flock --wait 180/);
  assert.match(recoveryNode, /assert_state_matches/);
  assert.match(recoveryNode, /validate_keepalived_heartbeat/);
  assert.match(recoveryNode, /assert_marker_blocks_keepalived/);
  assert.match(recoveryNode, /recover\) recover_node/);
  assert.ok(recoveryNode.indexOf("verify_runtime") < recoveryNode.indexOf("write_desired_state"));
  assert.ok(recoveryNode.indexOf("write_desired_state") < recoveryNode.lastIndexOf("verify_runtime"));
  assert.match(health, /reconcile\.in-progress/);
  assert.match(health, /\/proc\/\$\{PPID\}\/comm/);
  assert.match(reconcile, /watch_global_lock/);
  assert.match(reconcile, /retaining the global deployment lease until its safety timeout/);
});

test("all state-changing deployments share the single Deploy entry lane", () => {
  assert.match(recoveryWorkflow, /PROJECTWING_RECOVERY_RUN_ID: \$\{\{ github\.run_id \}\}/);
  assert.match(recoveryWorkflow, /PROJECTWING_RECOVERY_RUN_ATTEMPT: \$\{\{ github\.run_attempt \}\}/);
  assert.doesNotMatch(bundleWorkflow.split("permissions:")[0], /workflow_dispatch:/);
  assert.match(bundleWorkflow, /workflow_call:/);
});
