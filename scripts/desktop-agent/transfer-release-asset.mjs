#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const [operation, platform, target] = process.argv.slice(2);
const supportedOperations = new Set(["exists", "push", "pull", "delete"]);
const supportedPlatforms = new Set(["windows", "macos"]);

if (!supportedOperations.has(operation) || !supportedPlatforms.has(platform)) {
  fail(
    "Usage: transfer-release-asset.mjs <exists|push|pull|delete> <windows|macos> [path]"
  );
}

const repositoryOwner = required("GITHUB_REPOSITORY_OWNER").toLowerCase();
const runId = required("GITHUB_RUN_ID");
const tagPrefix = process.env.DESKTOP_AGENT_ASSET_TAG_PREFIX?.trim() || runId;
const assetTag = `${tagPrefix}-${platform}`;
const packageName = "projectwing-desktop-agent-assets";
const reference = `ghcr.io/${repositoryOwner}/${packageName}:${assetTag}`;

if (operation === "delete") {
  deleteAsset();
} else {
  login();
  try {
    if (operation === "exists") {
      checkAsset();
    }
    if (operation === "push") {
      pushAsset();
    }
    if (operation === "pull") {
      pullAsset();
    }
  } finally {
    runOras(["logout", "ghcr.io"], { allowFailure: true });
  }
}

function checkAsset() {
  const result = spawnSync("oras", ["manifest", "fetch", reference], {
    encoding: "utf-8",
    stdio: "ignore",
  });
  if (result.error && result.error.code !== "ENOENT") {
    fail(`ORAS manifest lookup failed: ${result.error.message}`);
  }
  process.stdout.write(result.status === 0 ? "true\n" : "false\n");
}

function login() {
  const result = spawnSync(
    "oras",
    [
      "login",
      "ghcr.io",
      "--username",
      required("GITHUB_ACTOR"),
      "--password-stdin",
    ],
    { encoding: "utf-8", input: required("GH_TOKEN") }
  );
  assertSucceeded(result, "ORAS login");
}

function pushAsset() {
  if (!target) {
    fail("A release directory is required for push.");
  }
  const directory = path.resolve(target);
  const layers = getReleaseLayers(directory);
  runOras(
    [
      "push",
      "--artifact-type",
      "application/vnd.projectwing.desktop-agent.release.v1",
      "--annotation",
      `org.opencontainers.image.revision=${required("GITHUB_SHA")}`,
      "--annotation",
      `cn.superfx.projectwing.platform=${platform}`,
      reference,
      ...layers,
    ],
    { cwd: directory }
  );
  process.stdout.write(`Pushed ${platform} release assets to ${reference}.\n`);
}

function getReleaseLayers(directory) {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    fail(`Release directory is missing: ${directory}`);
  }
  const files = readdirSync(directory)
    .filter((name) => isReleaseAsset(name))
    .sort();
  if (!files.some((name) => /^releases\..+\.json$/.test(name))) {
    fail("Release directory must include a VeloPack release feed.");
  }
  if (!files.some((name) => name.endsWith("-full.nupkg"))) {
    fail("Release directory must include a VeloPack full package.");
  }
  for (const name of files) {
    const asset = path.join(directory, name);
    if (!statSync(asset).isFile() || statSync(asset).size === 0) {
      fail(`Release asset is missing or empty: ${asset}`);
    }
  }
  return files.map((name) => `${name}:application/octet-stream`);
}

function isReleaseAsset(name) {
  return (
    name === "RELEASES" ||
    /^assets\..+\.json$/.test(name) ||
    /^releases\..+\.json$/.test(name) ||
    name.endsWith(".nupkg") ||
    name.endsWith(".zip") ||
    name.endsWith(".exe") ||
    name.endsWith(".pkg")
  );
}

function pullAsset() {
  if (!target) {
    fail("An output directory is required for pull.");
  }
  const outputDirectory = path.resolve(target);
  mkdirSync(outputDirectory, { recursive: true });
  runOras(["pull", "--output", outputDirectory, reference]);
  process.stdout.write(`Pulled ${reference} into ${outputDirectory}.\n`);
}

function deleteAsset() {
  const endpoint = `/orgs/${repositoryOwner}/packages/container/${packageName}/versions`;
  const versions = JSON.parse(runGh(["api", `${endpoint}?per_page=100`]));
  const matches = versions.filter((version) =>
    version.metadata?.container?.tags?.includes(assetTag)
  );
  for (const version of matches) {
    runGh(["api", "--method", "DELETE", `${endpoint}/${version.id}`]);
    process.stdout.write(`Deleted ${reference}.\n`);
  }
}

function runOras(arguments_, options = {}) {
  const result = spawnSync("oras", arguments_, {
    cwd: options.cwd,
    encoding: "utf-8",
    stdio: options.allowFailure ? "ignore" : "inherit",
  });
  if (!options.allowFailure) {
    assertSucceeded(result, `oras ${arguments_[0]}`);
  }
}

function assertSucceeded(result, label) {
  if (result.error) {
    fail(`${label} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${label} failed with exit code ${result.status}.`);
  }
}

function runGh(arguments_) {
  const result = spawnSync("gh", arguments_, {
    encoding: "utf-8",
    env: process.env,
  });
  assertSucceeded(result, `gh ${arguments_[0]}`);
  return result.stdout;
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    fail(`Required environment variable is missing: ${name}`);
  }
  return value;
}

function fail(message) {
  throw new Error(message);
}
