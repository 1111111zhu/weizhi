#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  createManifest,
  main,
  ossClientOptions,
  parseArgs,
  retry,
  sha256File,
  uploadBundle,
} from "./publish-image-bundle-to-oss.mjs";

const workflowPath = new URL(
  "../../.github/workflows/oss-image-bundle-pilot.yml",
  import.meta.url
);

const commit = "a".repeat(40);
const args = {
  bundle: "bundle.tar.gz",
  commit,
  systems: "api,emp,reverse-proxy",
  images: ["projectwing-api:test", "projectwing-traefik:test"],
  output: "output",
  uncompressed_size: "4096",
  prefix: "ci-images",
};

test("parseArgs accepts repeated images and required bundle metadata", () => {
  assert.deepEqual(
    parseArgs([
      "--bundle",
      args.bundle,
      "--commit",
      commit,
      "--systems",
      args.systems,
      "--uncompressed-size",
      args.uncompressed_size,
      "--output",
      args.output,
      "--image",
      args.images[0],
      "--image",
      args.images[1],
    ]),
    args
  );
});

test("parseArgs rejects missing values and unknown options", () => {
  assert.throws(() => parseArgs(["--bundle"]), /Missing value for --bundle/);
  assert.throws(() => parseArgs(["--nope", "value"]), /Unknown argument/);
});

test("createManifest preserves the version 2 OSS bundle contract", () => {
  const manifest = createManifest(
    args,
    "ci-images/a/images.tar.gz",
    "b".repeat(64),
    128
  );
  assert.deepEqual(manifest, {
    schemaVersion: 2,
    commit,
    createdAt: manifest.createdAt,
    systems: ["api", "emp", "reverse-proxy"],
    images: args.images,
    bundle: {
      key: "ci-images/a/images.tar.gz",
      sha256: "b".repeat(64),
      size: 128,
      uncompressedSize: 4096,
    },
  });
  assert.match(manifest.createdAt, /^\d{4}-\d\d-\d\dT/);
  assert.throws(
    () => createManifest({ ...args, uncompressed_size: "0" }, "key", "hash", 1),
    /positive integer/
  );
});

test("retry retries transient network errors but not ordinary errors", async () => {
  let attempts = 0;
  const delays = [];
  await retry(
    () => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error("temporary");
        error.code = "ETIMEDOUT";
        throw error;
      }
    },
    "test operation",
    { sleepFn: (delay) => delays.push(delay) }
  );
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [1000, 2000]);
  await assert.rejects(
    retry(
      () => {
        throw new Error("invalid input");
      },
      "test operation",
      { sleepFn: () => assert.fail("ordinary errors must not retry") }
    ),
    /invalid input/
  );
});

test("retry handles proxy socket failures and uses a long OSS timeout", async () => {
  for (const error of [
    new Error("socket hang up"),
    Object.assign(new Error("outer failure"), {
      cause: Object.assign(new Error("timed out"), {
        name: "ResponseTimeoutError",
      }),
    }),
  ]) {
    let attempts = 0;
    await retry(
      () => {
        attempts += 1;
        if (attempts === 1) {
          throw error;
        }
      },
      "test operation",
      { sleepFn: () => {} }
    );
    assert.equal(attempts, 2);
  }

  const options = ossClientOptions({
    OSS_ACCESS_KEY_ID: "key",
    OSS_ACCESS_KEY_SECRET: "secret",
    OSS_ENDPOINT: "oss.example.test",
    OSS_BUCKET: "bundles",
    ALL_PROXY: "socks5h://127.0.0.1:40000",
  });
  assert.equal(options.timeout, 300_000);
});

test("deployment reconnects WARP between resumable upload sessions", async () => {
  const workflow = await readFile(workflowPath, "utf-8");
  assert.match(workflow, /for upload_session in 1 2 3/);
  assert.match(workflow, /scripts\/ci\/ensure-warp-proxy\.sh/);
  assert.match(
    workflow,
    /PROJECTWING_WARP_CHECK_URL: \$\{\{ secrets\.OSS_ENDPOINT \}\}/
  );
});

test("uploadBundle uses smaller versioned multipart checkpoints and removes them on success", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "projectwing-oss-test-"));
  const bundle = path.join(root, "images.tar.gz");
  const checkpointRoot = path.join(root, "checkpoints");
  const legacyCheckpoint = path.join(
    checkpointRoot,
    "ci-images_a_images.tar.gz.checkpoint.json"
  );
  await writeFile(bundle, Buffer.from("bundle data"));
  await mkdir(checkpointRoot);
  await writeFile(legacyCheckpoint, JSON.stringify({ uploadId: "legacy" }));
  const calls = [];
  await uploadBundle(
    {
      multipartUpload: (key, source, options) => {
        calls.push({ key, source, options });
        options.progress(1, { uploadId: "test" });
        options.progress(1, null);
      },
    },
    bundle,
    "ci-images/a/images.tar.gz",
    "b".repeat(64),
    { checkpointRoot, sleepFn: () => {} }
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].source, bundle);
  assert.equal(calls[0].options.partSize, 8 * 1024 * 1024);
  assert.equal(calls[0].options.parallel, 1);
  assert.equal(calls[0].options.checkpoint, undefined);
  assert.deepEqual(JSON.parse(await readFile(legacyCheckpoint, "utf-8")), {
    uploadId: "legacy",
  });
  assert.deepEqual(calls[0].options.headers, {
    "Content-Type": "application/gzip",
    "x-oss-meta-sha256": "b".repeat(64),
  });
});

test("main publishes bundle and manifest and writes deployment outputs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "projectwing-oss-main-"));
  const bundle = path.join(root, "images.tar.gz");
  const output = path.join(root, "output");
  await writeFile(bundle, Buffer.from("bundle data"));
  const uploaded = [];
  const bucket = {
    multipartUpload: (key) => uploaded.push(["bundle", key]),
    put: (key, content, options) => {
      uploaded.push(["manifest", key, JSON.parse(content.toString()), options]);
    },
  };
  await main({ bucket, args: { ...args, bundle, output } });
  const expectedSha = await sha256File(bundle);
  assert.equal(uploaded[0][0], "bundle");
  assert.equal(uploaded[1][0], "manifest");
  assert.equal(uploaded[1][2].schemaVersion, 2);
  assert.equal(uploaded[1][2].bundle.sha256, expectedSha);
  assert.equal(uploaded[1][2].bundle.uncompressedSize, 4096);
  assert.equal(
    await readFile(output, "utf-8"),
    `bundle_object_key=ci-images/${commit}/images.tar.gz\n` +
      `bundle_sha256=${expectedSha}\n` +
      "bundle_size=11\n" +
      "bundle_uncompressed_size=4096\n" +
      `manifest_object_key=ci-images/${commit}/manifest.json\n`
  );
});
