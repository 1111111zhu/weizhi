import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const nodeScript = path.join(root, "scripts/ci/edge-ha-node.sh");
const imageHelper = path.join(root, "scripts/ci/edge-ha-image.sh");
const stateScript = path.join(root, "scripts/ci/edge-ha-state.sh");
const healthScript = path.join(root, "scripts/ci/edge-ha-health.sh");
const keepalived = path.join(root, "deploy/edge-ha/keepalived.conf.template");
const edgeCompose = path.join(root, "deploy/blue-green/docker-compose.edge.yml");
const developmentCompose = path.join(root, "docker-compose.development.yml");
const edgeAdmin = path.join(root, "deploy/traefik/dynamic/edge-admin.yml");
const candidateRouteRenderer = path.join(root, "scripts/ci/render-candidate-admin-route.sh");
const protectedRouteVerifier = path.join(root, "scripts/ci/verify-protected-edge-route.sh");
const recoveryNode = path.join(root, "scripts/ci/edge-recovery-node.sh");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function lines(file) {
  return read(file).split("\n").length;
}

test("Edge HA artifacts stay within the maintenance size limit", () => {
  for (const file of [nodeScript, imageHelper, stateScript, healthScript, recoveryNode, candidateRouteRenderer, protectedRouteVerifier, keepalived]) {
    assert.ok(lines(file) <= 300, `${file} exceeds 300 lines`);
  }
});

test("node controller exposes the five lifecycle operations", () => {
  const source = `${read(nodeScript)}\n${read(stateScript)}`;
  for (const operation of ["prepare", "switch", "rollback", "commit", "read"]) {
    assert.match(source, new RegExp(`\\b${operation}\\b`));
  }
  assert.match(source, /--project-name projectwing-edge/);
  assert.match(source, /config_dir=.*config/);
});

test("controller validates only approved VPC gateways", () => {
  const source = read(nodeScript);
  assert.ok(source.includes("^http://172\\.19\\.143\\.(157|158):18080$"));
  assert.match(source, /18080/);
  assert.doesNotMatch(source, /0\.0\.0\.0|public.*gateway/i);
});

test("runtime, route, and state writes use temporary files and atomic moves", () => {
  const source = `${read(nodeScript)}\n${read(stateScript)}`;
  assert.ok((source.match(/mktemp/g) ?? []).length >= 4);
  assert.ok((source.match(/mv -f/g) ?? []).length >= 4);
  assert.match(source, /write_serving_state_v4/);
  assert.match(source, /schemaVersion:4/);
  for (const field of [
    "activeColor",
    "activeGateway",
    "releaseKey",
    "version",
    "generation",
    "degraded",
    "previousColor",
    "previousGateway",
    "previousReleaseKey",
    "previousVersion",
  ]) {
    assert.match(source, new RegExp(field));
  }
  assert.match(source, /schemaVersion == 2 or \.schemaVersion == 3 or \.schemaVersion == 4/);
  assert.match(source, /staged_route=.*staged/);
  assert.match(source, /rollback_route_file/);
  assert.match(source, /rollback_state_file/);
  assert.match(source, /legacy_route=.*edge_root.*dynamic/);
  assert.match(source, /PROJECTWING_PREVIOUS_GATEWAY/);
  assert.ok(
    source.indexOf('render_route "${gateway}" "${staged_route}"') <
      source.indexOf('atomic_copy "${staged_route}" "${route_target}"'),
    "prepare must stage outside the watched dynamic directory before switch",
  );
});

test("controller has no sudo or broad cleanup escape hatch", () => {
  const source = read(nodeScript);
  assert.doesNotMatch(source, /(^|[^[:alnum:]_])sudo([^[:alnum:]_]|$)/m);
  assert.doesNotMatch(source, /docker\s+(system\s+)?prune/);
  assert.doesNotMatch(source, /rm\s+-rf/);
});

test("Edge owns lifecycle but reuses the persistent ACME volume explicitly", () => {
  const controller = read(nodeScript);
  const compose = read(edgeCompose);
  assert.match(controller, /docker volume inspect/);
  assert.match(controller, /docker volume create/);
  assert.match(compose, /traefik_acme:/);
  assert.match(compose, /external: true/);
});

test("Edge restores only the pinned local Traefik alias and never pulls during a swap", () => {
  const controller = read(nodeScript);
  const helper = read(imageHelper);
  assert.match(helper, /PROJECTWING_TRAEFIK_IMAGE must be one deterministic local Traefik alias/);
  assert.match(helper, /PROJECTWING_TRAEFIK_SOURCE_IMAGE must be one pinned official Traefik image/);
  assert.match(helper, /desired_digest.*source_digest/);
  assert.match(helper, /docker image tag "\$\{expected_id\}" "\$\{desired_image\}"/);
  assert.ok(controller.indexOf('bash "${image_helper}"') < controller.indexOf("compose up -d"));
  assert.match(controller, /compose up -d --no-build --pull never maintenance/);
  assert.match(controller, /PROJECTWING_EDGE_START_TIMEOUT_SECONDS/);
  assert.match(
    controller,
    /compose up -d --no-build --pull never --force-recreate --no-deps[\s\\]*--wait --wait-timeout "\$\{edge_start_timeout\}" reverse-proxy/,
  );
});

test("candidate activation never pulls an image outside the verified bundle", () => {
  const controller = read(path.join(root, "scripts/ci/blue-green-controller.sh"));
  assert.match(controller, /compose up -d --no-build --pull never --force-recreate --no-deps/);
});

test("Edge admin accepts only overlay and exact routing peer sources", () => {
  const source = read(edgeAdmin);
  assert.match(source, /100\.64\.0\.0\/10/);
  assert.match(source, /172\.19\.143\.157\/32/);
  assert.match(source, /172\.19\.143\.158\/32/);
  assert.doesNotMatch(source, /172\.19\.0\.0\/16|172\.16\.0\.0\/12/);
});

test("remote verification gates memory and NetBird after Edge settles", () => {
  const source = read(path.join(root, "scripts/ci/edge-ha-remote.sh"));
  assert.match(source, /PROJECTWING_EDGE_MIN_AVAILABLE_MIB:-256/);
  assert.match(source, /MemAvailable/);
  assert.match(source, /PROJECTWING_EDGE_VERIFY_ATTEMPTS:-18/);
  assert.match(source, /PROJECTWING_EDGE_ROLLBACK_ATTEMPTS:-18/);
  assert.match(source, /\.management\.connected == true/);
  assert.match(source, /PROJECTWING_HAVIP_ADDRESS=\$\{havip\}/);
  assert.doesNotMatch(source, /grep[^\n]+\/etc\/keepalived\/keepalived\.conf/);
});

test("legacy Edge verification bypasses host proxy variables", () => {
  const source = read(path.join(root, "scripts/ci/promote-edge-color.sh"));
  assert.match(source, /curl --noproxy '\*'.*--resolve/s);
});

test("health checks are limited to Docker, Edge container, and Traefik", () => {
  const source = read(healthScript);
  const compose = read(developmentCompose);
  assert.match(source, /docker\.service/);
  assert.match(source, /projectwing-edge/);
  assert.match(source, /\.State\.Health/);
  assert.match(source, /443/);
  assert.match(compose, /traefik", "healthcheck", "--ping"/);
  assert.doesNotMatch(source, /curl/);
  assert.doesNotMatch(source, /18080|backend|gateway|api\/healthz/);
  assert.doesNotMatch(source, /sleep|seq|attempt/);
  assert.doesNotMatch(source, /docker info/);
  assert.match(source, /EUID == 0/);
  assert.match(source, /edge-ha-health\.status/);
  assert.match(source, /sha256sum/);
  assert.match(source, /mv -f/);
  assert.match(source, /\/etc\/keepalived\/keepalived\.conf/);
  assert.match(source, /health_blocks==1/);
  assert.match(source, /track_refs==1/);
});

test("Keepalived uses unicast and placeholders only", () => {
  const source = read(keepalived);
  assert.match(source, /unicast_src_ip __KEEPALIVED_SOURCE_IP__/);
  assert.match(source, /unicast_peer/);
  assert.match(source, /track_script/);
  assert.match(source, /__PROJECTWING_HAVIP__/);
  assert.doesNotMatch(source, /224\.0\.0|225\.0\.0|239\.0\.0/);
  assert.doesNotMatch(source, /auth_pass\s+(?!__)[^_\s]+/);
});
