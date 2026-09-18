import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const file = path.join(root, "scripts/ci/edge-ha-remote.sh");
const stateFile = path.join(root, "scripts/ci/edge-ha-remote-state.sh");
const source = `${fs.readFileSync(file, "utf8")}\n${fs.readFileSync(stateFile, "utf8")}`;

function runFunction(command, environment) {
  return spawnSync("bash", ["-c", `root_dir="$ROOT"; . "$EDGE_HA_FILE"; ${command}`], {
    encoding: "utf8",
    env: { ...process.env, EDGE_HA_FILE: file, ROOT: root, ...environment },
  });
}

test("dual Edge promotion is standby-first and fail-closed", () => {
  assert.match(source, /edge_ha_order_nodes/);
  assert.match(source, /Exactly one Edge node must currently hold the HaVip/);
  assert.match(source, /HaVip is required after the one-time Edge HA bootstrap/);
  assert.match(source, /systemctl is-active --quiet keepalived\.service/);
  assert.ok(source.indexOf("edge_first_host") < source.indexOf("edge_second_host"));
  assert.match(source, /edge_ha_rollback_both/);
});

test("state consensus rejects split brain and commits one generation", () => {
  assert.match(source, /Edge state disagree/);
  assert.match(source, /PROJECTWING_GENERATION/);
  assert.match(source, /Dual Edge commit did not converge/);
  assert.match(source, /\.schemaVersion == 4/);
  assert.match(source, /degraded:\(\.degraded\/\/false\)/);
  assert.match(source, /previousReleaseKey:\(\.previousReleaseKey\/\/null\)/);
  assert.match(source, /test\("\^\[a-f0-9\]\{40\}/);
});

test("state input rejects shell metacharacters in persisted release fields", () => {
  const state = JSON.stringify({
    schemaVersion: 3,
    activeColor: "green",
    activeGateway: "http://172.19.143.158:18080",
    releaseKey: "'$(touch /tmp/projectwing-invalid-state)'",
    version: "a".repeat(40),
    generation: 1,
    degraded: false,
  });
  const result = runFunction('edge_ha_validate_state "$STATE"', { STATE: state });
  assert.notEqual(result.status, 0);
});

test("state consensus includes degraded and rollback metadata", () => {
  const base = {
    schemaVersion: 3,
    activeColor: "green",
    activeGateway: "http://172.19.143.158:18080",
    releaseKey: `${"a".repeat(40)}-1-1`,
    version: "a".repeat(40),
    generation: 1,
    degraded: false,
    previousReleaseKey: `${"b".repeat(40)}-2-1`,
  };
  const result = runFunction('edge_ha_select_consensus "$BLUE" "$GREEN"', {
    BLUE: JSON.stringify(base),
    GREEN: JSON.stringify({ ...base, degraded: true }),
  });
  assert.notEqual(result.status, 0);
});

test("rollback failure returns a distinct critical status", () => {
  const result = runFunction(`
    PROJECTWING_EDGE_ROLLBACK_ATTEMPTS=1
    edge_second_host=green; edge_second_known_hosts=green-key
    edge_first_host=blue; edge_first_known_hosts=blue-key
    blue_host=blue; blue_known_hosts=blue-key; green_host=green; green_known_hosts=green-key
    edge_ha_node() { return 1; }
    edge_ha_verify_rollback_node() { return 0; }
    edge_ha_rollback_both
  `);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /CRITICAL: dual Edge rollback/);
});

test("every switched Edge gets full service identity verification", () => {
  assert.equal((source.match(/edge_ha_wait_verify_node "\$\{edge_/g) ?? []).length, 2);
  assert.match(source, /sleep 10\npw_wait_for_full_edge_stack 4 10 1/);
  assert.match(source, /PROJECTWING_AUTH_URL/);
  assert.match(source, /PROJECTWING_IB_URL/);
  assert.match(source, /PROJECTWING_DB_URL=https:\/\/db\.superfx\.cn/);
  assert.match(source, /pw_verify_api_route 'Prisma Studio'.*window\.__STUDIO_CONFIG__/);
  assert.match(source, /for attempt in 1 2 3 4; do/);
  assert.match(source, /Edge admin routes are not ready .*retrying in 10s/);
  const adminRetry = source.slice(
    source.indexOf("for attempt in 1 2 3 4; do"),
    source.indexOf('sleep "${PROJECTWING_EDGE_SETTLE_SECONDS:-60}"'),
  );
  assert.match(adminRetry, /pw_verify_api_route 'Auth API'/);
  assert.match(adminRetry, /pw_verify_api_route 'Prisma Studio'/);
  const verification = source.slice(
    source.indexOf("edge_ha_wait_verify_node()"),
    source.indexOf("\nedge_ha_retry_rollback_node()"),
  );
  assert.match(verification, /host.*candidate_host/);
  assert.ok(
    verification.indexOf("render-candidate-admin-route.sh") < verification.indexOf("edge_ha_verify_node"),
  );
});

test("Edge verification has a dedicated remote execution budget", () => {
  const result = runFunction(`
    remote_ssh() {
      printf '%s' "\${PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS:-missing}"
      cat >/dev/null
    }
    PROJECTWING_EDGE_VERIFY_TIMEOUT_SECONDS=900 edge_ha_verify_node green green-key
  `);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "900");
  assert.match(source, /PROJECTWING_EDGE_VERIFY_TIMEOUT_SECONDS:-900/);
});

test("Edge rollback has a dedicated remote execution budget", () => {
  const result = runFunction(`
    edge_ha_node() { printf '%s' "\${PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS:-missing}"; }
    PROJECTWING_EDGE_ROLLBACK_ATTEMPTS=1 PROJECTWING_EDGE_ROLLBACK_TIMEOUT_SECONDS=300 \
      edge_ha_retry_rollback_node green green-key
  `);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "300");
  assert.match(source, /PROJECTWING_EDGE_ROLLBACK_TIMEOUT_SECONDS:-300/);
});

test("single-host recovery is explicit and degraded", () => {
  assert.match(source, /Single-host recovery requires readable Edge state/);
  assert.match(source, /Single-host recovery requires the configured private HaVip/);
  assert.match(source, /Single-host recovery target does not hold the HaVip/);
  assert.match(source, /edge_ha_node .* prepare true/);
  assert.match(source, /edge_ha_node .* commit true/);
});

test("remote orchestrator stays within the repository file limit", () => {
  for (const target of [file, stateFile]) {
    assert.ok(fs.readFileSync(target, "utf8").split("\n").length <= 300);
  }
});
