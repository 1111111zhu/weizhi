import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const remote = fs.readFileSync(path.join(root, "scripts/ci/remote-oss-image-bundle-deploy.sh"), "utf8");
const controller = fs.readFileSync(path.join(root, "scripts/ci/blue-green-remote-deploy.sh"), "utf8");
const controllerHelpers = fs.readFileSync(path.join(root, "scripts/ci/blue-green-remote-functions.sh"), "utf8");
const controllerBundle = `${controller}\n${controllerHelpers}`;
const reclaimer = fs.readFileSync(path.join(root, "scripts/ci/reclaim-blue-green-capacity.sh"), "utf8");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/oss-image-bundle-pilot.yml"), "utf8");
const provenance = fs.readFileSync(path.join(root, "scripts/ci/image-bundle-provenance.sh"), "utf8");

test("compressed and expanded bundle sizes reach the remote candidate", () => {
  for (const name of [
    "PROJECTWING_OSS_IMAGE_BUNDLE_SIZE_BYTES",
    "PROJECTWING_OSS_IMAGE_BUNDLE_UNCOMPRESSED_SIZE_BYTES",
  ]) {
    assert.match(workflow, new RegExp(name));
    assert.match(controllerBundle, new RegExp(name));
    assert.match(remote, new RegExp(name));
  }
});

test("candidate cleanup runs under the deployment lock before bundle download", () => {
  assert.ok(remote.indexOf("acquire_deployment_lock") < remote.indexOf("reclaim_candidate_capacity"));
  assert.ok(remote.lastIndexOf("reclaim_candidate_capacity") < remote.lastIndexOf("download_bundle"));
  assert.match(remote, /bundle_size_expected \+ bundle_uncompressed_size \+ reserve_bytes/);
  assert.match(remote, /OSS image bundle size mismatch/);
  assert.ok(reclaimer.lastIndexOf("validate-blue-green-release-tree.sh") < reclaimer.lastIndexOf("remove_stopped_candidate_containers"));
  assert.match(reclaimer, /pendingReleaseKey/);
});

test("preloaded images still pass reclamation and bundle-bound provenance", () => {
  const deployStart = remote.lastIndexOf('if [[ "${operation}" == "deploy" ]]');
  const deployPath = remote.slice(deployStart);
  const fastPath = deployPath.indexOf("verified_required_images_present");
  assert.ok(deployStart > remote.indexOf("acquire_deployment_lock"));
  assert.ok(fastPath > 0);
  assert.ok(deployPath.indexOf("reclaim_candidate_capacity preloaded") < fastPath);
  assert.match(remote, /record_verified_image_bundle/);
  assert.match(remote, /activate-preloaded[\s\S]*reclaim_candidate_capacity preloaded[\s\S]*verified_required_images_present/);
  assert.match(provenance, /PROJECTWING_OSS_IMAGE_BUNDLE_SHA256/);
  assert.match(provenance, /docker image inspect --format '\{\{\.Id\}\}'/);
  assert.match(provenance, /imageId/);
  assert.doesNotMatch(remote, /all_required_images_present/);
});

test("remote archive contains every HA and reclamation controller", () => {
  const archiveCopy = workflow.split("\n").find((line) => line.includes("cp scripts/ci/deployment-health.sh"));
  assert.ok(archiveCopy, "remote archive copy command is missing");
  for (const file of [
    "reclaim-blue-green-capacity.sh",
    "validate-blue-green-release-tree.sh",
    "cleanup-blue-green-candidate.sh",
    "cleanup-blue-green-staged-inputs.sh",
    "edge-ha-node.sh",
    "edge-ha-image.sh",
    "edge-ha-health.sh",
    "edge-ha-remote.sh",
    "render-candidate-admin-route.sh",
    "verify-protected-edge-route.sh",
    "configure-edge-keepalived.sh",
    "image-bundle-provenance.sh",
  ]) {
    assert.match(archiveCopy, new RegExp(file.replaceAll(".", "\\.")));
  }
  assert.match(workflow, /cp -R[^\n]+deploy\/images/);
});
