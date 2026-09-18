import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../../.github/workflows/oss-image-bundle-pilot.yml", import.meta.url),
  "utf8"
);
const publisherContract = await readFile(
  new URL("./publish-image-bundle-contract.mjs", import.meta.url),
  "utf8"
);

test("OSS bundle manifests use schema 2 with compressed and uncompressed sizes", () => {
  assert.match(publisherContract, /schemaVersion: 2/);
  assert.match(publisherContract, /uncompressedSize/);
  assert.match(workflow, /\.schemaVersion == 2/);
  assert.doesNotMatch(workflow, /\.schemaVersion == 1/);
  assert.match(workflow, /\.bundle\.uncompressedSize/);
});

test("bundle capacity is measured by decompressing the finished gzip stream", () => {
  assert.match(workflow, /docker save "\$\{images\[@\]\}" \| gzip -1 > "\$\{bundle\}"/);
  assert.match(workflow, /gzip -dc "\$\{bundle\}" \| wc -c/);
  assert.doesNotMatch(workflow, /docker save "\$\{images\[@\]\}"[^\n]*>[^\n]*\.tar(?:\s|"|$)/);
  assert.match(workflow, /BUNDLE_UNCOMPRESSED_SIZE: \$\{\{ steps\.package\.outputs\.bundle_uncompressed_size \}\}/);
});

test("retained and published bundle outputs reach deployment capacity guards", () => {
  assert.match(workflow, /echo "bundle_size=\$\{bundle_size\}"/);
  assert.match(workflow, /echo "bundle_uncompressed_size=\$\{bundle_uncompressed_size\}"/);
  assert.match(workflow, /bundle_size: \$\{\{ steps\.retained_bundle\.outputs\.bundle_size/);
  assert.match(
    workflow,
    /bundle_uncompressed_size: \$\{\{ steps\.retained_bundle\.outputs\.bundle_uncompressed_size/
  );
  assert.match(
    workflow,
    /PROJECTWING_OSS_IMAGE_BUNDLE_SIZE_BYTES: \$\{\{ needs\.package-and-upload\.outputs\.bundle_size \}\}/
  );
  assert.match(
    workflow,
    /PROJECTWING_OSS_IMAGE_BUNDLE_UNCOMPRESSED_SIZE_BYTES: \$\{\{ needs\.package-and-upload\.outputs\.bundle_uncompressed_size \}\}/
  );
});

test("compressed and uncompressed sizes are required positive integers", () => {
  assert.match(workflow, /bundle_uncompressed_size\}" =~ \^\[1-9\]\[0-9\]\*\$/);
  assert.match(publisherContract, /Number\(args\.uncompressed_size\)/);
  assert.match(publisherContract, /uncompressedSize <= 0/);
});

test("source, image, and secret contracts remain present", () => {
  assert.match(workflow, /source_sha=.*inputs\.image_source_sha/);
  assert.match(workflow, /PROJECTWING_SOURCE_COMMIT_SHA:/);
  assert.match(workflow, /PROJECTWING_IMAGE_SOURCE_SHA:/);
  assert.match(workflow, /PROJECTWING_TRAEFIK_ALIDNS_ACCESS_KEY/);
  assert.match(workflow, /DATABASE_URL/);
  assert.match(workflow, /BETTER_AUTH_SECRET/);
  assert.match(workflow, /PROJECTWING_OSS_IMAGE_BUNDLE_SHA256/);
});

test("OSS replay uses exact foundation images and removes replay tags", () => {
  assert.match(workflow, /Resolve pinned foundation images/);
  assert.match(workflow, /PROJECTWING_TRAEFIK_SOURCE_IMAGE/);
  assert.match(workflow, /PROJECTWING_GOTENBERG_IMAGE=projectwing-gotenberg:/);
  assert.doesNotMatch(workflow, /packages\/container\/projectwing-gotenberg\/versions\?per_page=1/);
  assert.match(workflow, /Remove replay image tags from the runner/);
  assert.match(workflow, /docker image rm/);
});

test("bundle packaging allows slow cross-region uploads to finish", () => {
  const packageJob = workflow.slice(
    workflow.indexOf("  package-and-upload:"),
    workflow.indexOf("  deploy-blue-green:")
  );
  assert.match(packageJob, /timeout-minutes: 180/);
});
