#!/usr/bin/env node
import * as fs from "node:fs/promises";
import path from "node:path";

import {
  createBucket,
  DEFAULT_MINIMUM_SELF_UPDATE_VERSION,
  fail,
  objectKey,
  releaseVersionEnvironment,
  requiredEnvironment,
  retryOssOperation,
  sha256File,
  uploadInstaller,
  uploadReleaseAsset,
  windowsSignaturePolicy,
} from "./oss-publisher-support.mjs";

export * from "./oss-publisher-support.mjs";

export function isVeloPackAssetName(name) {
  return (
    [
      "RELEASES",
      "assets.win.json",
      "releases.win.json",
      "com.superfx.projectwing.desktop-agent-win-Setup.exe",
      "com.superfx.projectwing.desktop-agent-win-Portable.zip",
    ].includes(name) ||
    /^com\.superfx\.projectwing\.desktop-agent-\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?-(?:full|delta)\.nupkg$/.test(
      name
    )
  );
}

export async function publishVeloPackBundle(args, { bucket } = {}) {
  const bundle = args.velopackBundle;
  const bundleStats = bundle ? await fs.stat(bundle).catch(() => null) : null;
  if (!bundleStats?.isDirectory()) {
    fail(`VeloPack bundle not found: ${bundle}`);
  }
  const releaseVersion = requiredEnvironment("DESKTOP_AGENT_RELEASE_VERSION");
  const prefix = (process.env.OSS_PREFIX ?? "")
    .trim()
    .replaceAll(/^\/+|\/+$/g, "");
  const entries = await fs.readdir(bundle, { withFileTypes: true });
  const assets = entries
    .filter((entry) => entry.isFile() && isVeloPackAssetName(entry.name))
    .map((entry) => path.join(bundle, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  const setupName = "com.superfx.projectwing.desktop-agent-win-Setup.exe";
  if (
    !assets.some((asset) => path.basename(asset) === setupName) ||
    !assets.some((asset) => path.basename(asset) === "releases.win.json")
  ) {
    fail(
      "VeloPack bundle must include the Setup executable and releases.win.json"
    );
  }
  const client = bucket ?? (await createBucket());
  const setup = path.join(bundle, setupName);
  const digest = await sha256File(setup);
  const releaseName = `desktop-agent-win-x64-${releaseVersion}.exe`;
  const versionedKey = objectKey(
    prefix,
    `releases/v${releaseVersion}/${releaseName}`
  );
  const stableKey = objectKey(prefix, "desktop-agent-win-x64.exe");
  await uploadInstaller(
    client,
    setup,
    versionedKey,
    stableKey,
    "desktop-agent-win-x64.exe",
    digest
  );
  for (const asset of assets) {
    const name = path.basename(asset);
    const cache = ["RELEASES", "assets.win.json", "releases.win.json"].includes(
      name
    )
      ? "no-cache, no-store, must-revalidate"
      : "private, max-age=31536000, immutable";
    await uploadReleaseAsset(
      client,
      asset,
      objectKey(prefix, `updates/${name}`),
      cache
    );
  }
  await publishWindowsManifest(
    client,
    prefix,
    releaseVersion,
    setup,
    digest,
    releaseName
  );
  console.log(
    JSON.stringify(
      {
        version: releaseVersion,
        platform: "windows",
        distribution: "velopack",
        stableObjectKey: stableKey,
        updateFeedKey: objectKey(prefix, "updates/releases.win.json"),
      },
      null,
      2
    )
  );
}

export async function publishWindowsManifest(
  bucket,
  prefix,
  version,
  installer,
  sha256,
  versionedReleaseName
) {
  const installerStats = await fs.stat(installer);
  const manifest = {
    version,
    platform: "windows",
    architecture: "x64",
    installerFileName: versionedReleaseName,
    sha256,
    fileSize: installerStats.size,
    publishedAt: new Date().toISOString(),
    minimumSupportedVersion: releaseVersionEnvironment(
      "DESKTOP_AGENT_MINIMUM_VERSION",
      "0.2.0"
    ),
    minimumSelfUpdateVersion: releaseVersionEnvironment(
      "DESKTOP_AGENT_SELF_UPDATE_MINIMUM_VERSION",
      DEFAULT_MINIMUM_SELF_UPDATE_VERSION
    ),
    signaturePolicy: windowsSignaturePolicy(),
  };
  await retryOssOperation(
    () =>
      bucket.put(
        objectKey(prefix, "latest.json"),
        Buffer.from(JSON.stringify(manifest)),
        {
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Content-Type": "application/json",
          },
        }
      ),
    "OSS release manifest promotion"
  );
}

export function parseArgs(argumentsList) {
  if (argumentsList.length !== 2 || argumentsList[0] !== "--velopack-bundle") {
    fail("--velopack-bundle is required");
  }
  return { velopackBundle: argumentsList[1] };
}

export async function main(argumentsList = process.argv.slice(2)) {
  await publishVeloPackBundle(parseArgs(argumentsList));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
