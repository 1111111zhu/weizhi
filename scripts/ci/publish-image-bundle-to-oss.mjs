#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createManifest, parseArgs } from "./publish-image-bundle-contract.mjs";

export { createManifest, parseArgs } from "./publish-image-bundle-contract.mjs";

export const RETRY_ATTEMPTS = 8;
export const MAX_RETRY_DELAY_SECONDS = 30;
export const OSS_TIMEOUT_MS = 300_000;
export const MULTIPART_BYTES = 8 * 1024 * 1024;
export const UPLOAD_THREADS = 1;
export const PROGRESS_STEP_PERCENT = 5;

export function requireEnvironment(name, environment = process.env) {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`Required environment variable is missing: ${name}`);
  }
  return value;
}

export async function sha256File(filePath) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    digest.update(chunk);
  }
  return digest.digest("hex");
}

export function formatSize(input) {
  let size = input;
  for (const unit of ["B", "KiB", "MiB", "GiB", "TiB"]) {
    if (size < 1024 || unit === "TiB") {
      return `${size.toFixed(1)} ${unit}`;
    }
    size /= 1024;
  }
  throw new Error("unreachable");
}

function isRequestError(error, seen = new Set()) {
  if (!error || seen.has(error)) {
    return false;
  }
  seen.add(error);
  const message = String(error.message ?? "").toLowerCase();
  return (
    [
      "RequestError",
      "ConnectionTimeoutError",
      "ResponseTimeoutError",
      "ConnectionError",
    ].includes(error?.name) ||
    ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"].includes(
      error?.code
    ) ||
    message.includes("socket hang up") ||
    message.includes("hostunreachable") ||
    isRequestError(error.cause, seen)
  );
}

const sleep = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export function summarizeRequestError(error) {
  const summary = String(error).replaceAll(/\s+/g, " ").trim();
  return `${error?.name ?? "Error"}: ${summary.slice(0, 300) || "no details"}`;
}

export async function retry(operation, description, { sleepFn = sleep } = {}) {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      if (!isRequestError(error) || attempt === RETRY_ATTEMPTS) {
        if (attempt === RETRY_ATTEMPTS) {
          console.error(
            `${description} failed after ${RETRY_ATTEMPTS} attempts: ${summarizeRequestError(error)}`
          );
        }
        throw error;
      }
      const delay = Math.min(2 ** (attempt - 1), MAX_RETRY_DELAY_SECONDS);
      console.warn(
        `${description} had a transient network failure (${summarizeRequestError(error)}); retrying in ${delay}s (${attempt}/${RETRY_ATTEMPTS - 1}).`
      );
      await sleepFn(delay * 1000);
    }
  }
}

function loadOssClient() {
  const moduleDirectory = process.env.OSS_NODE_MODULES?.trim();
  const requireFrom = createRequire(
    moduleDirectory
      ? pathToFileURL(path.resolve(moduleDirectory, "package.json"))
      : new URL("../../apps/api/package.json", import.meta.url)
  );
  return requireFrom("ali-oss");
}

export function ossClientOptions(environment = process.env) {
  const proxy =
    environment.OSS_PROXY ??
    environment.HTTPS_PROXY ??
    environment.HTTP_PROXY ??
    environment.ALL_PROXY;
  return {
    accessKeyId: requireEnvironment("OSS_ACCESS_KEY_ID", environment),
    accessKeySecret: requireEnvironment("OSS_ACCESS_KEY_SECRET", environment),
    endpoint: requireEnvironment("OSS_ENDPOINT", environment),
    bucket: requireEnvironment("OSS_BUCKET", environment),
    timeout: OSS_TIMEOUT_MS,
    enableProxy: Boolean(proxy),
    proxy,
  };
}

export function createBucket() {
  const OSS = loadOssClient();
  return new OSS(ossClientOptions());
}

export function createUploadProgress(total) {
  let lastPercent = -PROGRESS_STEP_PERCENT;
  return (consumed, currentTotal = total) => {
    if (currentTotal <= 0) {
      return;
    }
    const percent = Math.min(100, Math.floor((consumed * 100) / currentTotal));
    if (percent < lastPercent + PROGRESS_STEP_PERCENT && percent !== 100) {
      return;
    }
    lastPercent = percent;
    console.log(
      `OSS image bundle upload: ${percent}% (${formatSize(consumed)} / ${formatSize(currentTotal)})`
    );
  };
}

export async function uploadBundle(bucket, bundle, key, sha256, options = {}) {
  const checkpointRoot =
    options.checkpointRoot ??
    path.resolve(process.env.HOME ?? ".", ".cache/projectwing-oss-checkpoints");
  mkdirSync(checkpointRoot, { recursive: true });
  const checkpointPath = path.resolve(
    checkpointRoot,
    `${key.replaceAll(/[^a-zA-Z0-9._-]/g, "_")}.part-${MULTIPART_BYTES}.checkpoint.json`
  );
  const total = statSync(bundle).size;
  const progress = createUploadProgress(total);
  progress(0, total);
  await retry(
    () =>
      bucket.multipartUpload(key, bundle, {
        partSize: MULTIPART_BYTES,
        parallel: UPLOAD_THREADS,
        headers: {
          "Content-Type": "application/gzip",
          "x-oss-meta-sha256": sha256,
        },
        checkpoint: existsSync(checkpointPath)
          ? JSON.parse(readFileSync(checkpointPath, "utf-8"))
          : undefined,
        progress: (percentage, checkpoint) => {
          progress(Math.round(percentage * total), total);
          if (checkpoint) {
            writeFileSync(checkpointPath, JSON.stringify(checkpoint));
          }
        },
      }),
    "OSS image bundle upload",
    options
  );
  if (existsSync(checkpointPath)) {
    unlinkSync(checkpointPath);
  }
}

export async function uploadManifest(bucket, key, content, options = {}) {
  await retry(
    () =>
      bucket.put(key, content, {
        headers: { "Content-Type": "application/json" },
      }),
    "OSS image bundle manifest upload",
    options
  );
}

export function writeOutput(outputPath, values) {
  writeFileSync(
    outputPath,
    Object.entries(values)
      .map(([name, value]) => `${name}=${value}\n`)
      .join(""),
    "utf-8"
  );
}

export async function main({ args = parseArgs(), bucket } = {}) {
  if (!existsSync(args.bundle) || statSync(args.bundle).size === 0) {
    throw new Error(`Image bundle is missing or empty: ${args.bundle}`);
  }
  if (!/^[0-9a-f]{40}$/.test(args.commit)) {
    throw new Error("--commit must be a 40-character lowercase SHA-1");
  }
  const prefix = args.prefix.replaceAll(/^\/+|\/+$/g, "");
  if (!prefix) {
    throw new Error("--prefix must not be empty");
  }
  const objectRoot = `${prefix}/${args.commit}`;
  const bundleKey = `${objectRoot}/images.tar.gz`;
  const manifestKey = `${objectRoot}/manifest.json`;
  const bundleSha256 = await sha256File(args.bundle);
  const bundleSize = statSync(args.bundle).size;
  const manifest = createManifest(args, bundleKey, bundleSha256, bundleSize);
  const client = bucket ?? createBucket();
  console.log(
    `OSS image bundle prepared: commit=${args.commit}, systems=${args.systems}, size=${formatSize(bundleSize)}, images=${args.images.length}.`
  );
  await uploadBundle(client, args.bundle, bundleKey, bundleSha256);
  await uploadManifest(
    client,
    manifestKey,
    Buffer.from(JSON.stringify(manifest))
  );
  writeOutput(args.output, {
    bundle_object_key: bundleKey,
    bundle_sha256: bundleSha256,
    bundle_size: bundleSize,
    bundle_uncompressed_size: manifest.bundle.uncompressedSize,
    manifest_object_key: manifestKey,
  });
  console.log(
    `OSS image bundle published: ${bundleKey} (${formatSize(bundleSize)}, sha256 ${bundleSha256}).`
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
