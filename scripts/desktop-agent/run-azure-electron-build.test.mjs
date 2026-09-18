import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "run-azure-electron-build.mjs"
);
const pipelinePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../azure-pipelines-windows.yml"
);

test("Azure Electron build only accepts the Windows platform", () => {
  const result = run("macos", "0.3.0", "preview", "release-assets");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported Electron Azure platform: macos/);
});

test("Azure Electron build requires a plain SemVer release version", () => {
  const result = run("windows", "v0.3.0", "preview", "release-assets");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Desktop Agent release must be plain SemVer/);
});

test("Azure Electron build rejects unknown release channels", () => {
  const result = run("windows", "0.3.0", "nightly", "release-assets");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported Desktop Agent release channel/);
});

test("Azure publishes the complete release directory directly to GHCR", () => {
  const pipeline = readFileSync(pipelinePath, "utf-8");

  assert.match(
    pipeline,
    /transfer-release-asset\.mjs push windows output\/desktop-agent\/windows\/releases/
  );
  assert.doesNotMatch(pipeline, /Build\.ArtifactStagingDirectory|\n\s+- publish:/);
});

test("Azure Electron fallback streams logs and uses bounded retries", () => {
  const source = readFileSync(scriptPath, "utf-8");

  assert.match(source, /streamBuildLogs\(buildId, logOffsets\)/);
  assert.match(source, /\/timeline\?api-version=7\.1/);
  assert.match(source, /\/logs\/\$\{record\.log\.id\}\?startLine=/);
  assert.match(source, /fetchWithRetry\(url, options, \{/);
  assert.match(
    source,
    /settings\.timeoutMilliseconds \?\? requestTimeoutMilliseconds/
  );
  assert.match(source, /timeoutMilliseconds: logRequestTimeoutMilliseconds/);
});

function run(...arguments_) {
  return spawnSync(process.execPath, [scriptPath, ...arguments_], {
    encoding: "utf-8",
  });
}
