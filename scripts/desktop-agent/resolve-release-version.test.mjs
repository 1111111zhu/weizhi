import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("resolve-release-version.mjs", import.meta.url)
);

test("uses an explicit version for a publish-only retry", () => {
  const result = resolveVersion("0.3.0");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout)["release-version"], "0.3.0");
});

test("rejects an override outside the package version series", () => {
  const result = resolveVersion("0.2.0");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must match the package series/);
});

function resolveVersion(version) {
  return spawnSync(process.execPath, [script], {
    encoding: "utf-8",
    env: {
      ...process.env,
      DESKTOP_AGENT_RELEASE_VERSION_OVERRIDE: version,
      GITHUB_REPOSITORY: "",
      GITHUB_TOKEN: "",
    },
  });
}
