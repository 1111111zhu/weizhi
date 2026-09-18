import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const cleanup = fs.readFileSync(
  path.join(root, "scripts/ci/cleanup-blue-green-staged-inputs.sh"),
  "utf8",
);
const controller = fs.readFileSync(
  path.join(root, "scripts/ci/blue-green-remote-deploy.sh"),
  "utf8",
);
const controllerHelpers = fs.readFileSync(
  path.join(root, "scripts/ci/blue-green-remote-functions.sh"),
  "utf8",
);
const deploy = fs.readFileSync(
  path.join(root, "scripts/ci/remote-oss-image-bundle-deploy.sh"),
  "utf8",
);

test("staged input cleanup is root-scoped and strictly allowlisted", () => {
  assert.match(cleanup, /project_root.*\/opt\/projectwing/);
  assert.match(cleanup, /projectwing-\(oss-\|images-\)\?/);
  assert.match(cleanup, /projectwing-traefik-\(access\|secret\)-key/);
  assert.match(cleanup, /projectwing-oss-image-bundle-deploy/);
  assert.match(cleanup, /! -L/);
  assert.match(cleanup, /\[\[ -f/);
  assert.doesNotMatch(cleanup, /rm\s+-rf|docker\s+system\s+prune/);
});

test("both hosts clean transfers before the candidate starts", () => {
  assert.ok(controller.indexOf("cleanup_staged_inputs") < controller.indexOf("start_candidate"));
  assert.equal((controller.match(/cleanup_staged_inputs \"\$\{/g) ?? []).length, 3);
  assert.match(controllerHelpers, /releases\/\$\{release_key\}\/secrets\/projectwing\.env/);
});

test("release secrets are persistent canonical inputs, not ephemeral files", () => {
  assert.match(deploy, /release_dir.*secrets\/projectwing\.env/);
  assert.match(deploy, /release_dir.*secrets\/projectwing-oss\.env/);
  assert.match(deploy, /release_dir.*secrets\/projectwing-registry\.env/);
});
