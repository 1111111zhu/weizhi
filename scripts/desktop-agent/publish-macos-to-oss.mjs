#!/usr/bin/env node

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import {
  createBucket,
  RETRY_ATTEMPTS as OSS_RETRY_ATTEMPTS,
  requiredEnvironment,
  resumableUpload,
  retryOssOperation,
  sha256File,
  verifyRemoteObject,
} from "./publish-installer-to-oss.mjs";

export const RETRY_ATTEMPTS = OSS_RETRY_ATTEMPTS;
export const SETUP_NAME = "com.superfx.projectwing.desktop-agent-osx-Setup.pkg";
export const STABLE_NAME = "desktop-agent-macos-arm64.pkg";

export function semanticVersion(value) {
  if (!/^\d+\.\d+\.\d+$/.test(value)) {
    fail(`Invalid Desktop Agent version: ${value}`);
  }
  return value;
}

export async function upload(bucket, source, key, cacheControl) {
  const digest = await sha256File(source);
  const sourceStats = await stat(source);
  await resumableUpload(
    bucket,
    key,
    source,
    { "Cache-Control": cacheControl, "x-oss-meta-sha256": digest },
    `OSS upload for ${path.basename(source)}`,
    null,
    RETRY_ATTEMPTS
  );
  await verifyRemoteObject(bucket, key, sourceStats.size, digest);
  return digest;
}

export async function publish(bundle, { bucket } = {}) {
  const bundleStats = await stat(bundle).catch(() => null);
  if (!bundleStats?.isDirectory()) {
    fail(`macOS VeloPack bundle not found: ${bundle}`);
  }
  const version = semanticVersion(
    requiredEnvironment("DESKTOP_AGENT_RELEASE_VERSION")
  );
  const setup = path.join(bundle, SETUP_NAME);
  const feed = path.join(bundle, "releases.osx.json");
  const assets = await readdir(bundle, { withFileTypes: true });
  const [setupStats, feedStats] = await Promise.all([
    stat(setup).catch(() => null),
    stat(feed).catch(() => null),
  ]);
  if (
    !setupStats?.isFile() ||
    !feedStats?.isFile() ||
    !assets.some(
      (asset) => asset.isFile() && asset.name.endsWith("-full.nupkg")
    )
  ) {
    fail("macOS VeloPack bundle is incomplete");
  }

  const client = bucket ?? (await createBucket());
  const prefix = (process.env.OSS_PREFIX ?? "desktop-agent/macos")
    .trim()
    .replaceAll(/^\/+|\/+$/g, "");
  const versionedName = `desktop-agent-macos-arm64-${version}.pkg`;
  const versionedKey = `${prefix}/releases/v${version}/${versionedName}`;
  const digest = await upload(
    client,
    setup,
    versionedKey,
    "private, max-age=31536000, immutable"
  );
  const stableKey = `${prefix}/${STABLE_NAME}`;
  await retryOssOperation(
    () => client.copy(stableKey, versionedKey),
    "OSS macOS stable object promotion",
    null,
    RETRY_ATTEMPTS
  );
  await verifyRemoteObject(client, stableKey, setupStats.size, digest);

  for (const asset of assets
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort()) {
    if (![".json", ".nupkg", ".pkg"].includes(path.extname(asset))) {
      continue;
    }
    const cacheControl = /^(assets\.|releases\.)/.test(asset)
      ? "no-cache, no-store, must-revalidate"
      : "private, max-age=31536000, immutable";
    await upload(
      client,
      path.join(bundle, asset),
      `${prefix}/updates/${asset}`,
      cacheControl
    );
  }
  console.log(`Published macOS ${version} to ${stableKey}.`);
}

export function parseArgs(argumentsList) {
  if (argumentsList.length !== 2 || argumentsList[0] !== "--velopack-bundle") {
    fail("--velopack-bundle is required");
  }
  return argumentsList[1];
}

export async function main(argumentsList = process.argv.slice(2)) {
  await publish(parseArgs(argumentsList));
}

function fail(message) {
  throw new Error(message);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
