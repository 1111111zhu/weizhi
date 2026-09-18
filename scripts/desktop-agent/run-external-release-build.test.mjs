import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/desktop-agent/run-external-release-build.mjs");

test("accepts all plain SemVer release lines", () => {
  const result = run("azure", "windows", "v0.3.0", "stable");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /plain SemVer/);
  assert.doesNotMatch(readFileSync(script, "utf-8"), /\^0\\\.2/);
});

test("external builders receive GHCR relay credentials and do not download artifacts", () => {
  const source = readFileSync(script, "utf-8");

  assert.match(source, /GHCR_TOKEN: required\("GH_TOKEN"\)/);
  assert.match(source, /GHCR_ASSET_TAG_PREFIX/);
  assert.match(source, /isSecret: name === "GHCR_TOKEN"/);
  assert.doesNotMatch(source, /downloadAzureArtifact|downloadCodemagicArtifact/);
});

test("Azure status polling streams logs with bounded network retries", () => {
  const source = readFileSync(script, "utf-8");

  assert.match(source, /streamAzureLogs\(baseUrl, buildId, authorization, logOffsets\)/);
  assert.match(source, /\/timeline\?api-version=7\.1/);
  assert.match(source, /\?startLine=\$\{startLine\}/);
  assert.match(source, /attempts: 8/);
  assert.match(source, /timeoutMilliseconds: 45_000/);
});

test("Codemagic remains limited to the final macOS fallback", () => {
  const result = run("codemagic", "windows", "0.3.0", "stable");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /only configured for macOS/);
});

function run(...args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf-8" });
}
