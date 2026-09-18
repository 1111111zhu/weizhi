import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const schemaFile = path.join(root, "scripts/ci/blue-green-schema.sh");
const controller = fs.readFileSync(path.join(root, "scripts/ci/blue-green-remote-deploy.sh"), "utf8");
const maintenance = fs.readFileSync(path.join(root, "scripts/ci/edge-maintenance-remote.sh"), "utf8");
const maintenanceRoute = fs.readFileSync(path.join(root, "deploy/traefik/dynamic/edge-maintenance.yml"), "utf8");
const edgeCompose = fs.readFileSync(path.join(root, "deploy/blue-green/docker-compose.edge.yml"), "utf8");
const legacyPromotion = fs.readFileSync(path.join(root, "scripts/ci/promote-edge-color.sh"), "utf8");
const edgeStateFile = path.join(root, "scripts/ci/edge-ha-state.sh");
const deploymentLock = fs.readFileSync(path.join(root, "scripts/ci/deployment-lock-remote.sh"), "utf8");
const deployWorkflow = fs.readFileSync(path.join(root, ".github/workflows/deploy.yml"), "utf8");

function classify(output, status) {
  return spawnSync(
    "bash",
    ["-c", `. "$SCHEMA_FILE"; compose() { printf '%s\\n' "$MIGRATION_OUTPUT"; return "$MIGRATION_STATUS"; }; database_migration_status`],
    {
      encoding: "utf8",
      env: { ...process.env, SCHEMA_FILE: schemaFile, MIGRATION_OUTPUT: output, MIGRATION_STATUS: String(status) },
    },
  );
}

test("migration status is fail-closed for drift, failure, and unknown errors", () => {
  assert.equal(classify("Database schema is up to date!", 0).stdout.trim(), "current");
  assert.equal(classify("2 migrations have not yet been applied", 1).stdout.trim(), "pending");
  for (const output of [
    "A migration failed to apply",
    "Migration history is divergent",
    "The migration was modified after it was applied",
    "P1001: cannot reach database",
  ]) {
    assert.notEqual(classify(output, 1).status, 0, output);
  }
});

test("maintenance is verified before writers stop and migration becomes irreversible", () => {
  const enter = controller.indexOf("edge_ha_enter_maintenance");
  const stop = controller.indexOf("stop_previous_writers");
  const irreversible = controller.indexOf("migration_started=true", stop);
  const migrate = controller.indexOf("start_candidate_job migrate-and-activate true");
  assert.ok(enter < stop && stop < irreversible && irreversible < migrate);
  assert.match(controller, /Failure occurred before migration; restoring the serving Edge route/);
  assert.match(controller, /migration_started.*false/);
  assert.match(controller, /prepare_maintenance_resume/);
});

test("both Edge nodes and the HaVip must return the maintenance contract", () => {
  assert.match(maintenance, /edge_ha_wait_maintenance_node "\$\{edge_first_host\}"/);
  assert.match(maintenance, /edge_ha_wait_maintenance_node "\$\{edge_second_host\}"/);
  assert.match(maintenance, /edge_ha_verify_maintenance_vip/);
  assert.match(maintenance, /DEPLOYMENT_MAINTENANCE/);
  assert.match(maintenanceRoute, /wing\.superfx\.cn/);
  assert.match(maintenanceRoute, /ib\.superfx\.cn/);
  assert.doesNotMatch(maintenanceRoute, /traefik\.superfx\.cn/);
});

test("maintenance reuses the pinned Traefik image without exposing another host port", () => {
  assert.match(edgeCompose, /maintenance:[\s\S]*PROJECTWING_TRAEFIK_IMAGE/);
  const service = edgeCompose.split("  maintenance:")[1].split("\nvolumes:")[0];
  assert.doesNotMatch(service, /ports:/);
  assert.match(service, /read_only: true/);
  assert.match(service, /no-new-privileges:true/);
});

test("legacy direct promotion cannot bypass transactional Edge state", () => {
  assert.match(legacyPromotion, /schemaVersion \/\/ 0\) >= 4/);
  assert.match(legacyPromotion, /Legacy direct promotion is disabled/);
  assert.ok(legacyPromotion.indexOf("Legacy direct promotion") < legacyPromotion.lastIndexOf("\nwrite_edge_env\n"));
});

test("maintenance commits a new generation and enforces expected-state CAS", () => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), "projectwing-edge-state-"));
  const stateFile = path.join(directory, "release.json");
  const source = "d".repeat(40);
  fs.writeFileSync(stateFile, JSON.stringify({
    schemaVersion: 4,
    activeColor: "green",
    activeGateway: "http://172.19.143.158:18080",
    releaseKey: `${source}-1-1`,
    version: source,
    sourceCommitSha: source,
    imageSourceSha: source,
    generation: 7,
    routeMode: "serving",
  }));
  const command = `set -Eeuo pipefail
fail() { echo "$*" >&2; exit 1; }
require_command() { command -v "$1" >/dev/null; }
operation=commit
. "$EDGE_STATE_LIBRARY"
write_maintenance_state_v4
jq -r '[.generation,.routeMode,.pendingSourceCommitSha] | @tsv' "$EDGE_STATE_FILE"`;
  const environment = {
    ...process.env,
    EDGE_STATE_LIBRARY: edgeStateFile,
    EDGE_STATE_FILE: stateFile,
    PROJECTWING_RELEASE_KEY: `${source}-2-1`,
    PROJECTWING_TRANSACTION_ID: `${source}-2-1`,
    PROJECTWING_VERSION: source,
    PROJECTWING_SOURCE_COMMIT_SHA: source,
    PROJECTWING_IMAGE_SOURCE_SHA: source,
  };
  const result = spawnSync("bash", ["-c", `state_file="$EDGE_STATE_FILE"; ${command}`], { encoding: "utf8", env: environment });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), `8\tmaintenance\t${source}`);
  const stale = spawnSync("bash", ["-c", `state_file="$EDGE_STATE_FILE"; ${command.replace("write_maintenance_state_v4", "PROJECTWING_EXPECTED_GENERATION=7 assert_expected_state")}`], { encoding: "utf8", env: environment });
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /generation changed/);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("the lock holder writes heartbeat state as the deployment user", () => {
  assert.match(deploymentLock, /--user "\$\(id -u\):\$\(id -g\)"/);
  assert.match(deploymentLock, /lock_is_healthy/);
  assert.match(deploymentLock, /heartbeat/);
  assert.match(deploymentLock, /\[\[ -f "\$\{status_file\}" && ! -L "\$\{status_file\}" \]\]/);
  assert.match(deploymentLock, /status_json="\$\(cat -- "\$\{status_file\}" 2>\/dev\/null\)"/);
  assert.match(deploymentLock, /<<<"\$\{status_json\}"/);
  assert.doesNotMatch(deploymentLock, /jq[^\n]*"\$\{status_file\}"/);
  assert.match(deploymentLock, /\.heartbeat \| numbers/);
});

test("the Deploy caller converts string job outputs to reusable number inputs", () => {
  assert.match(
    deployWorkflow,
    /build_run_id: \$\{\{ fromJSON\(needs\.resolve-image-source\.outputs\.build-run-id\) \}\}/,
  );
  assert.match(
    deployWorkflow,
    /build_run_attempt: \$\{\{ fromJSON\(needs\.resolve-image-source\.outputs\.build-run-attempt\) \}\}/,
  );
});
