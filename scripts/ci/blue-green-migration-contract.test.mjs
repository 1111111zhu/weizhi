import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const controller = await readFile(
  new URL("./blue-green-controller.sh", import.meta.url),
  "utf8"
);
const schema = await readFile(
  new URL("./blue-green-schema.sh", import.meta.url),
  "utf8"
);
const remoteDeploy = await readFile(
  new URL("./blue-green-remote-deploy.sh", import.meta.url),
  "utf8"
);
const remoteFunctionsUrl = new URL(
  "./blue-green-remote-functions.sh",
  import.meta.url
);
const remoteFunctions = await readFile(remoteFunctionsUrl, "utf8");
const edgeHaRemote = await readFile(
  new URL("./edge-ha-remote.sh", import.meta.url),
  "utf8"
);
const deploymentHealth = await readFile(
  new URL("./deployment-health.sh", import.meta.url),
  "utf8"
);
const deployWorkflow = await readFile(
  new URL("../../.github/workflows/deploy.yml", import.meta.url),
  "utf8"
);
const bundleWorkflow = await readFile(
  new URL(
    "../../.github/workflows/oss-image-bundle-pilot.yml",
    import.meta.url
  ),
  "utf8"
);
const developmentCompose = await readFile(
  new URL("../../docker-compose.development.yml", import.meta.url),
  "utf8"
);
const colorCompose = await readFile(
  new URL("../../deploy/blue-green/docker-compose.color.yml", import.meta.url),
  "utf8"
);
const routing = await readFile(
  new URL("../../deploy/traefik/dynamic/routing.yml", import.meta.url),
  "utf8"
);
const edgeRouting = await readFile(
  new URL("../../deploy/traefik/dynamic/edge-routing.yml", import.meta.url),
  "utf8"
);
const routingRendererPath = fileURLToPath(
  new URL("./render-candidate-admin-route.sh", import.meta.url)
);
const routingRenderer = await readFile(
  new URL("./render-candidate-admin-route.sh", import.meta.url),
  "utf8"
);
const protectedRouteVerifierPath = fileURLToPath(
  new URL("./verify-protected-edge-route.sh", import.meta.url)
);
const apiEntrypoint = await readFile(
  new URL("../../apps/api/docker-entrypoint.sh", import.meta.url),
  "utf8"
);
const studioVerifier = controller.slice(
  controller.indexOf("verify_prisma_studio()"),
  controller.indexOf("\nverify_gateway()")
);

function runStudioVerifier(
  body,
  assetResult = "200 application/javascript",
  rootStatus = "200",
  curlExit = "0"
) {
  const script = `set -Eeuo pipefail
${studioVerifier}
curl() {
  local argument output url
  output=''
  url=''
  for argument in "$@"; do url="$argument"; done
  if [[ "$url" == */studio.js ]]; then printf '%s' "$ASSET_RESULT"; return "$CURL_EXIT"; fi
  while (( $# )); do
    if [[ "$1" == --output ]]; then output="$2"; break; fi
    shift
  done
  printf '%s' "$STUDIO_BODY" > "$output"
  printf '%s' "$ROOT_STATUS"
  return "$CURL_EXIT"
}
color=green
backend_address=127.0.0.1
backend_port=18080
verify_prisma_studio`;
  return spawnSync("bash", ["-c", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      ASSET_RESULT: assetResult,
      CURL_EXIT: curlExit,
      ROOT_STATUS: rootStatus,
      STUDIO_BODY: body,
    },
  });
}

function renderCandidateRouting(edgeIds, edgeGateway) {
  const script = `set -Eeuo pipefail
docker() {
  if [[ "$1" == ps ]]; then printf '%s\\n' "$EDGE_IDS"; else printf '%s\\n' "$EDGE_IP"; fi
}
export -f docker
release_dir="$(mktemp -d)"
trap 'rm -rf "$release_dir"' EXIT
candidate_dynamic_dir="$release_dir/candidate-dynamic"
mkdir -p "$release_dir/deploy/traefik/dynamic" "$candidate_dynamic_dir"
printf '%s\\n' '          - "192.0.2.1/32"' > "$release_dir/deploy/traefik/dynamic/routing.yml"
PROJECTWING_RELEASE_DIR="$release_dir" PROJECTWING_CANDIDATE_DYNAMIC_DIR="$candidate_dynamic_dir" \
  bash "$ROUTING_RENDERER"
cat "$candidate_dynamic_dir/routing.yml"`;
  return spawnSync("bash", ["-c", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      EDGE_IDS: edgeIds,
      EDGE_IP: edgeGateway,
      ROUTING_RENDERER: routingRendererPath,
    },
  });
}

function verifyProtectedEdgeRoute(edgeIds, responseBody) {
  const script = `set -Eeuo pipefail
docker() {
  if [[ "$1" == ps ]]; then printf '%s\\n' "$EDGE_IDS"; else printf '%s' "$RESPONSE_BODY"; fi
}
export -f docker
bash "$PROTECTED_ROUTE_VERIFIER"`;
  return spawnSync("bash", ["-c", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      EDGE_IDS: edgeIds,
      RESPONSE_BODY: responseBody,
      PROTECTED_ROUTE_VERIFIER: protectedRouteVerifierPath,
    },
  });
}

test("pending production migrations require verified maintenance and no local backup", () => {
  assert.match(schema, /maintenance_confirmed.*true/);
  assert.match(schema, /RUN_DATABASE_BACKUP=false/);
  assert.match(schema, /api migrate-only/);
  assert.match(schema, /migration_started_file/);
  assert.match(schema, /migration_completed_file/);
  assert.doesNotMatch(schema, /pg_dump|pre-migration/);
});

test("automatic migration and maintenance authorization reach the controller", () => {
  assert.match(remoteFunctions, /PROJECTWING_CANDIDATE_ACTION='\$\{action\}'/);
  assert.match(
    remoteFunctions,
    /PROJECTWING_MAINTENANCE_CONFIRMED='\$\{maintenance_confirmed\}'/
  );
  assert.match(remoteDeploy, /start_candidate_job migrate-and-activate true/);
  assert.match(deployWorkflow, /apply_pending_migrations:/);
  assert.match(bundleWorkflow, /apply_pending_migrations:[\s\S]*default: true/);
});

test("candidate page probes verify headers without downloading response bodies", () => {
  assert.match(controller, /--head --location/);
  assert.match(controller, /--retry 2 --retry-all-errors/);
  assert.match(controller, /Verifying candidate .* headers for/);
  assert.match(controller, /API health returned/);
});

test("Prisma Studio follows the candidate color and protected Edge route", () => {
  assert.match(apiEntrypoint, /prisma studio --port 5555 --browser none/);
  assert.doesNotMatch(apiEntrypoint, /prisma studio --hostname/);
  assert.match(developmentCompose, /prisma-studio:[\s\S]*127\.0\.0\.1:5555/);
  assert.match(
    colorCompose,
    /prisma-studio:[\s\S]*prisma-studio-\$\{PROJECTWING_COLOR\}/
  );
  assert.match(controller, /services=.*prisma-studio/);
  assert.match(controller, /Prisma Studio identity and asset returned 200/);
  assert.match(controller, /grep -Fq 'window\.__STUDIO_CONFIG__'/);
  assert.match(
    controller,
    /grep -Eq '"adapter"\[\[:space:\]\]\*:\[\[:space:\]\]\*"postgres"'/
  );
  assert.match(controller, /grep -Fq 'src="\/studio\.js"'/);
  assert.match(controller, /\/studio\.js/);
  assert.match(studioVerifier, /%\{content_type\}/);
  assert.doesNotMatch(studioVerifier, /--location|--max-redirs/);
  assert.doesNotMatch(controller, /grep -Fq 'Prisma Studio'/);
  assert.match(
    routing,
    /Host\(`db\.superfx\.cn`\)[\s\S]*admin-access[\s\S]*prisma-studio-service/
  );
  assert.match(routing, /172\.19\.143\.157\/32/);
  assert.match(routing, /172\.19\.143\.158\/32/);
  assert.match(
    edgeRouting,
    /Host\(`db\.superfx\.cn`\)[\s\S]*edge-admin-access[\s\S]*projectwing-active-gateway/
  );
  assert.match(
    edgeRouting,
    /projectwing-db-verification:[\s\S]*entryPoints:[\s\S]*verification/
  );
  assert.match(controller, /render-candidate-admin-route\.sh/);
  assert.match(
    routingRenderer,
    /Candidate routing requires exactly one local Edge reverse proxy/
  );
  assert.match(routingRenderer, /192\.0\.2\.1\/32/);
  assert.match(routingRenderer, /projectwing-proxy.*Gateway/s);
  assert.match(routingRenderer, /edge_proxy_gateway.*\/32/);
});

test("Prisma Studio identity rejects generic or incomplete HTTP 200 pages", () => {
  const valid =
    '<div id="root"></div><script>window.__STUDIO_CONFIG__ = {"adapter":"postgres"};</script><script type="module" src="/studio.js"></script>';
  assert.equal(runStudioVerifier(valid).status, 0);
  assert.notEqual(runStudioVerifier("<html>Prisma Studio</html>").status, 0);
  assert.notEqual(
    runStudioVerifier(valid.replace("postgres", "sqlite")).status,
    0
  );
  assert.notEqual(
    runStudioVerifier(valid.replace('src="/studio.js"', "")).status,
    0
  );
  assert.notEqual(
    runStudioVerifier(valid, "404 application/javascript").status,
    0
  );
  assert.notEqual(runStudioVerifier(valid, "200 text/html").status, 0);
  assert.notEqual(
    runStudioVerifier(valid, "200 application/javascript", "302").status,
    0
  );
  assert.notEqual(
    runStudioVerifier(valid, "200 application/javascript", "200", "7").status,
    0
  );
});

test("route verification bypasses host proxy variables", () => {
  assert.equal(
    (deploymentHealth.match(/curl --noproxy '\*'/g) ?? []).length,
    2
  );
  assert.equal((controller.match(/curl --noproxy '\*'/g) ?? []).length, 4);
});

test("candidate routing trusts only the exact local Edge network gateway", () => {
  const rendered = renderCandidateRouting("edge-id", "172.22.0.1");
  assert.equal(rendered.status, 0, rendered.stderr);
  assert.match(rendered.stdout, /172\.22\.0\.1\/32/);
  assert.doesNotMatch(rendered.stdout, /192\.0\.2\.1/);
  assert.notEqual(
    renderCandidateRouting("edge-one\nedge-two", "172.22.0.1").status,
    0
  );
  assert.notEqual(renderCandidateRouting("edge-id", "203.0.113.10").status, 0);
});

test("protected Prisma verification runs inside exactly one Edge proxy", () => {
  const edgeId = "a".repeat(12);
  const postgresStudio = 'window.__STUDIO_CONFIG__ = {"adapter":"postgres"}';
  assert.equal(verifyProtectedEdgeRoute(edgeId, postgresStudio).status, 0);
  assert.notEqual(
    verifyProtectedEdgeRoute(`${edgeId}\n${"b".repeat(12)}`, postgresStudio)
      .status,
    0
  );
  assert.notEqual(
    verifyProtectedEdgeRoute(
      edgeId,
      postgresStudio.replace("postgres", "sqlite")
    ).status,
    0
  );
  assert.notEqual(verifyProtectedEdgeRoute(edgeId, "generic page").status, 0);
  assert.match(deploymentHealth, /verify-protected-edge-route\.sh/);
});

test("Blue and Green explicitly reuse the persistent uploads volume", () => {
  assert.match(
    colorCompose,
    /api_uploads:[\s\S]*external: true[\s\S]*PROJECTWING_API_UPLOADS_VOLUME/
  );
  assert.match(controller, /docker volume inspect "\$\{uploads_volume\}"/);
  assert.match(
    controller,
    /docker volume create --name "\$\{uploads_volume\}"/
  );
});

test("persisted release secrets are reused without copying a file onto itself", () => {
  assert.match(controller, /persist_secret\(\)/);
  assert.match(controller, /"\$\{source\}" -ef "\$\{target\}"/);
  assert.match(
    controller,
    /mktemp "\$\{release_dir\}\/secrets\/\.projectwing-secret/
  );
  assert.match(controller, /mv -f "\$\{temporary\}" "\$\{target\}"/);
  assert.doesNotMatch(controller, /install -m 600 "\$\{app_env\}"/);
});

test("candidate status paths expand after the action local is assigned", () => {
  const script = `set -Eeuo pipefail
release_key=${"a".repeat(40)}-1-1
candidate_color=blue
candidate_host=host
candidate_known_hosts=known-hosts
PROJECTWING_CANDIDATE_STATUS_ATTEMPTS=1
remote_ssh() { printf '0\\n'; }
. "$REMOTE_FUNCTIONS"
wait_for_candidate_job inspect`;
  const result = spawnSync("bash", ["-c", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      REMOTE_FUNCTIONS: fileURLToPath(remoteFunctionsUrl),
    },
  });

  assert.equal(result.status, 0, result.stderr);
});
