import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const controller = fs.readFileSync(path.join(root, "scripts/ci/blue-green-remote-deploy.sh"), "utf8");
const remoteFunctions = fs.readFileSync(path.join(root, "scripts/ci/blue-green-remote-functions.sh"), "utf8");
const orderGuard = fs.readFileSync(path.join(root, "scripts/ci/deployment-order-guard.sh"), "utf8");
const resolver = fs.readFileSync(path.join(root, "scripts/ci/resolve-edge-runtime-secrets.sh"), "utf8");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/oss-image-bundle-pilot.yml"), "utf8");

test("single-host recovery is symmetric for Blue and Green", () => {
  assert.match(controller, /case "\$\{single_host_color\}" in/);
  assert.match(controller, /blue\)[\s\S]*configuring only Blue/);
  assert.match(controller, /green\)[\s\S]*configuring only Green/);
  assert.match(controller, /stage_target "\$\{candidate_host\}" "\$\{candidate_known_hosts\}"/);
  assert.match(resolver, /PROJECTWING_SINGLE_HOST_COLOR=%s/);
});

test("runtime fallback uses the committed release rather than newest mtime", () => {
  assert.match(resolver, /EXPECTED_RELEASE_KEY/);
  assert.match(resolver, /\$\{release_root\}\/\$\{expected_release_key\}\/secrets\/projectwing\.env/);
  assert.doesNotMatch(resolver, /sort -rn|stat -c '%Y/);
  assert.match(resolver, /active Edge is reachable but could not provide its committed runtime secrets/);
});

test("runtime secret resolution accepts the transactional Edge state", () => {
  assert.match(resolver, /\.schemaVersion == 4/);
  assert.match(resolver, /\.sourceCommitSha/);
  assert.match(resolver, /\.imageSourceSha/);
  assert.match(resolver, /\.routeMode/);
});

test("overlay recovery attempts are bounded", () => {
  assert.match(workflow, /PROJECTWING_DEPLOY_SSH_CONFIGURE_ATTEMPTS: 6/);
  assert.doesNotMatch(workflow, /take several minutes|CONFIGURE_ATTEMPTS: 36/);
});

test("non-HA promotion requires an explicit one-time bootstrap input", () => {
  assert.match(workflow, /edge_ha_bootstrap:/);
  assert.match(workflow, /PROJECTWING_EDGE_HA_BOOTSTRAP/);
});

test("runner runtime secrets are removed on every terminal path", () => {
  assert.match(workflow, /Remove deployment secret material from the runner[\s\S]*if: always\(\)/);
  assert.match(workflow, /inherited-runtime\.env/);
  assert.match(workflow, /projectwing-traefik-alidns-secret-key/);
});

test("failed promotion cleanup runs only after verified Edge rollback", () => {
  assert.match(controller, /promotion_status == 1[\s\S]*cleanup_failed_promotion_candidate/);
  assert.match(controller, /preserving the candidate because Edge rollback was not verified/);
});

test("completed migration maintenance recovery is explicit and image-pinned", () => {
  assert.match(remoteFunctions, /PROJECTWING_ALLOW_COMPLETED_MAINTENANCE_RECOVERY/);
  assert.match(remoteFunctions, /database-migration\.completed/);
  assert.match(remoteFunctions, /pendingImageSourceSha/);
  assert.match(controller, /recover-maintenance/);
  assert.match(orderGuard, /recover-maintenance/);
});

test("writer shutdown has a dedicated remote timeout and transport retry", () => {
  assert.match(controller, /retry_remote_transport 'Stop previous writers' stop_previous_writers/);
  assert.match(remoteFunctions, /PROJECTWING_STOP_PREVIOUS_WRITERS_TIMEOUT_SECONDS:-600/);
  assert.match(remoteFunctions, /PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS="\$\{timeout_seconds\}"/);
  assert.match(remoteFunctions, /docker stop --timeout 30/);
});

test("a committed dual promotion retires the previous application stack", () => {
  assert.match(remoteFunctions, /retire_previous_active_stack\(\)/);
  assert.match(remoteFunctions, /PROJECTWING_CLEANUP_REASON='retired-previous'/);
  assert.ok(controller.lastIndexOf("edge_ha_promote_candidate") < controller.lastIndexOf("retire_previous_active_stack"));
  assert.match(controller, /retry_remote_transport 'Retire previous application stack' retire_previous_active_stack/);
  assert.match(remoteFunctions, /PROJECTWING_RETIRE_PREVIOUS_STACK_TIMEOUT_SECONDS:-600/);
  assert.match(remoteFunctions, /PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS="\$\{timeout_seconds\}"/);
  assert.match(controller, /Edge promotion committed, but the previous application stack was not retired/);
  assert.ok(controller.split("\n").length <= 300);
});
