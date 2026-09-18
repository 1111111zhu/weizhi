import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const buildScript = fs.readFileSync(path.join(root, "scripts/ci/build-registry-images.sh"), "utf8");
const buildWorkflow = fs.readFileSync(path.join(root, ".github/workflows/build.yml"), "utf8");
const deployWorkflow = fs.readFileSync(path.join(root, ".github/workflows/deploy.yml"), "utf8");
const ossWorkflow = fs.readFileSync(path.join(root, ".github/workflows/oss-image-bundle-pilot.yml"), "utf8");
const foundations = fs.readFileSync(path.join(root, "deploy/images/foundations.env"), "utf8");

test("self-hosted builds bound BuildKit cache before image generation", () => {
  const setup = buildScript.indexOf("setup_buildx_builder\n");
  const initialBound = buildScript.indexOf("  bound_persistent_buildkit_cache\n", setup);
  const firstBuild = buildScript.indexOf("if has_system api;");

  assert.ok(setup >= 0);
  assert.ok(initialBound > setup);
  assert.ok(firstBuild > initialBound);
});

test("completed build batches bound BuildKit cache before the next image", () => {
  const waitFunction = buildScript.slice(
    buildScript.indexOf("wait_for_builds() {"),
    buildScript.indexOf("build_api_images() {"),
  );
  const waitLoop = waitFunction.indexOf('for index in "${!build_pids[@]}"');
  const checkpoint = waitFunction.lastIndexOf("bound_persistent_buildkit_cache");
  const result = waitFunction.lastIndexOf('return "${failed}"');

  assert.ok(waitLoop >= 0);
  assert.ok(checkpoint > waitLoop);
  assert.ok(result > checkpoint);
});

test("foundation inputs are pinned and Gotenberg is reused by fingerprint", () => {
  assert.match(foundations, /TRAEFIK_SOURCE_IMAGE=.*@sha256:[a-f0-9]{64}/);
  assert.match(foundations, /TRAEFIK_IMAGE_ID=sha256:[a-f0-9]{64}/);
  assert.match(ossWorkflow, /actual_traefik_id/);
  assert.match(foundations, /GOTENBERG_BASE_IMAGE=.*@sha256:[a-f0-9]{64}/);
  assert.match(buildScript, /docker manifest inspect "\$\{PROJECTWING_GOTENBERG_IMAGE\}"/);
  assert.match(buildScript, /Reusing \$\{PROJECTWING_GOTENBERG_IMAGE\}/);
  assert.match(buildWorkflow, /deploy\/images\/foundations\.env/);
  assert.doesNotMatch(buildWorkflow, /secrets\.PROJECTWING_GOTENBERG_BASE_IMAGE/);
});

test("missing image-source history rebuilds instead of using a stale variable", () => {
  assert.doesNotMatch(buildWorkflow, /PROJECTWING_ACTIVE_IMAGE_SOURCE_SHA|FALLBACK_IMAGE_SOURCE_SHA/);
  assert.match(buildWorkflow, /No retained image-source artifact exists; safely rebuilding/);
  assert.match(buildWorkflow, /build_images=true/);
});

test("image-source artifacts use the supported Node runtime and repository retention", () => {
  assert.match(buildWorkflow, /actions\/upload-artifact@v7/);
  assert.match(buildWorkflow, /name: projectwing-image-source[\s\S]*path: \$\{\{ runner\.temp \}\}\/image-source\.env[\s\S]*if-no-files-found: error/);
  assert.match(deployWorkflow, /actions\/download-artifact@v8/);
  assert.match(deployWorkflow, /name: projectwing-image-source[\s\S]*run-id: \$\{\{ github\.event\.workflow_run\.id \}\}[\s\S]*github-token: \$\{\{ github\.token \}\}/);
  assert.match(buildWorkflow, /retention-days: 7/);
  assert.doesNotMatch(buildWorkflow, /actions\/upload-artifact@v4/);
  assert.doesNotMatch(deployWorkflow, /actions\/download-artifact@v4/);
});
