import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const helper = path.join(root, "scripts/ci/edge-ha-image.sh");
const digest = "a".repeat(64);
const sourceId = `sha256:${"b".repeat(64)}`;
const alias = `projectwing-traefik:${digest}`;
const source = `traefik:v3.7.1@sha256:${digest}`;

function runHelper({ aliasId = "", sourceAvailable = true, runtimeImage = alias, sourceImage = source } = {}) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "edge-ha-image-"));
  const binary = path.join(temporary, "bin");
  const runtime = path.join(temporary, "edge.env");
  const foundations = path.join(temporary, "foundations.env");
  const log = path.join(temporary, "docker.log");
  const restored = path.join(temporary, "restored");
  fs.mkdirSync(binary);
  fs.writeFileSync(runtime, `PROJECTWING_TRAEFIK_IMAGE=${runtimeImage}\n`);
  fs.writeFileSync(
    foundations,
    `PROJECTWING_TRAEFIK_SOURCE_IMAGE=${sourceImage}\nPROJECTWING_TRAEFIK_IMAGE_ID=${sourceId}\n`,
  );
  fs.writeFileSync(
    path.join(binary, "docker"),
    `#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$1 $2 $3" == "image inspect --format" ]]; then
  format="$4"
  ref="$5"
  if [[ "\${format}" == "{{.Id}}" && "\${ref}" == "\${MOCK_SOURCE}" && "\${MOCK_SOURCE_AVAILABLE}" == 1 ]]; then
    printf '%s\\n' "\${MOCK_SOURCE_ID}"
  elif [[ "\${format}" == "{{.Id}}" && "\${ref}" == "\${MOCK_ALIAS}" && -e "\${MOCK_RESTORED}" ]]; then
    printf '%s\\n' "\${MOCK_SOURCE_ID}"
  elif [[ "\${format}" == "{{.Id}}" && "\${ref}" == "\${MOCK_ALIAS}" && -n "\${MOCK_ALIAS_ID}" ]]; then
    printf '%s\\n' "\${MOCK_ALIAS_ID}"
  elif [[ "\${format}" == *RepoDigests* && "\${ref}" == "\${MOCK_SOURCE}" && "\${MOCK_SOURCE_AVAILABLE}" == 1 ]]; then
    printf '%s\\n' "\${MOCK_REPO_DIGEST}"
  elif [[ "\${format}" == *RepoDigests* && "\${ref}" == "\${MOCK_ALIAS}" && -e "\${MOCK_RESTORED}" ]]; then
    printf '%s\\n' "\${MOCK_REPO_DIGEST}"
  elif [[ "\${format}" == *RepoDigests* && "\${ref}" == "\${MOCK_ALIAS}" && "\${MOCK_ALIAS_ID}" == "\${MOCK_SOURCE_ID}" ]]; then
    printf '%s\\n' "\${MOCK_REPO_DIGEST}"
  elif [[ "\${format}" == *RepoDigests* && "\${ref}" == "\${MOCK_ALIAS}" && -n "\${MOCK_ALIAS_ID}" ]]; then
    printf '%s\\n' "traefik@sha256:%064d" 0
  else
    exit 1
  fi
elif [[ "$1 $2" == "image inspect" && "$3" == "\${MOCK_SOURCE}" && "\${MOCK_SOURCE_AVAILABLE}" == 1 ]]; then
  exit 0
elif [[ "$1 $2" == "image tag" ]]; then
  printf '%s %s\\n' "$3" "$4" >> "\${MOCK_LOG}"
  touch "\${MOCK_RESTORED}"
else
  exit 64
fi
`,
    { mode: 0o755 },
  );
  const result = spawnSync("bash", [helper, runtime, foundations], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binary}:${process.env.PATH}`,
      MOCK_ALIAS: alias,
      MOCK_ALIAS_ID: aliasId,
      MOCK_LOG: log,
      MOCK_RESTORED: restored,
      MOCK_REPO_DIGEST: `traefik@sha256:${digest}`,
      MOCK_SOURCE: sourceId,
      MOCK_SOURCE_AVAILABLE: sourceAvailable ? "1" : "0",
      MOCK_SOURCE_ID: sourceId,
    },
  });
  const dockerLog = fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "";
  fs.rmSync(temporary, { force: true, recursive: true });
  return { log: dockerLog, result };
}

test("restores a missing alias from the exact pinned local image ID", () => {
  const { log, result } = runHelper();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(log, `${sourceId} ${alias}\n`);
  assert.match(result.stdout, /Restored pinned Edge image alias/);
});

test("keeps an existing alias only when it resolves to the pinned source ID", () => {
  const { log, result } = runHelper({ aliasId: sourceId });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(log, "");
});

test("accepts a verified existing alias when the standalone image ID lookup is absent", () => {
  const { log, result } = runHelper({ aliasId: sourceId, sourceAvailable: false });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(log, "");
});

test("rejects a conflicting alias without overwriting it", () => {
  const { log, result } = runHelper({ aliasId: `sha256:${"c".repeat(64)}` });
  assert.equal(result.status, 1);
  assert.equal(log, "");
  assert.match(result.stderr, /unexpected image ID/);
});

test("rejects a missing pinned image ID without attempting a tag", () => {
  const { log, result } = runHelper({ sourceAvailable: false });
  assert.equal(result.status, 1);
  assert.equal(log, "");
  assert.match(result.stderr, /image ID is not present locally/);
});

test("rejects mismatched or malformed image references before Docker mutation", () => {
  const mismatch = runHelper({
    sourceImage: `traefik:v3.7.1@sha256:${"d".repeat(64)}`,
  });
  assert.equal(mismatch.result.status, 1);
  assert.equal(mismatch.log, "");
  assert.match(mismatch.result.stderr, /digest do not match/);

  const malformed = runHelper({ runtimeImage: `${alias}; touch /tmp/edge-ha-injected` });
  assert.equal(malformed.result.status, 1);
  assert.equal(malformed.log, "");
  assert.match(malformed.result.stderr, /deterministic local Traefik alias/);
});
