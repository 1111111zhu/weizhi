#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { fetchWithRetry } from "./external-build-http.mjs";

const buildPollIntervalMilliseconds = 15_000;
const buildPollAttempts = 120;
const requestAttempts = 6;
const requestTimeoutMilliseconds = 30_000;
const logRequestAttempts = 2;
const logRequestTimeoutMilliseconds = 10_000;

const [platform, version, channel, outputDirectory] = process.argv.slice(2);

if (!platform || !version || !channel || !outputDirectory) {
  throw new Error(
    "Usage: run-azure-electron-build.mjs <windows> <version> <preview|stable> <output-directory>"
  );
}
if (platform !== "windows") {
  throw new Error(`Unsupported Electron Azure platform: ${platform}`);
}
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Desktop Agent release must be plain SemVer: ${version}`);
}
if (channel !== "preview" && channel !== "stable") {
  throw new Error(`Unsupported Desktop Agent release channel: ${channel}`);
}

const organization = required("AZURE_DEVOPS_ORGANIZATION").replace(/\/$/, "");
const project = encodeURIComponent(required("AZURE_DEVOPS_PROJECT"));
const pipelineId = required("AZURE_WINDOWS_PIPELINE_ID");
const authorization = `Basic ${Buffer.from(`:${required("AZURE_DEVOPS_PAT")}`).toString("base64")}`;
const baseUrl = `${organization}/${project}/_apis`;

await mkdir(outputDirectory, { recursive: true });
const build = await startBuild();
await waitForBuild(build.id);
await downloadReleaseAssets(build.id);

async function startBuild() {
  const response = await request(
    `${baseUrl}/pipelines/${pipelineId}/runs?api-version=7.1`,
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resources: {
          repositories: {
            self: {
              refName: `refs/heads/${process.env.GITHUB_REF_NAME || "main"}`,
              version: required("GITHUB_SHA"),
            },
          },
        },
        templateParameters: {
          releaseVersion: version,
          releaseChannel: channel,
        },
      }),
    },
    "Azure Windows build start"
  );
  const build = await response.json();
  if (!build.id) throw new Error("Azure Windows build did not return an id.");
  console.log(`Started Azure Windows build ${build.id}.`);
  return build;
}

async function waitForBuild(buildId) {
  const logOffsets = new Map();
  for (let attempt = 0; attempt < buildPollAttempts; attempt += 1) {
    const response = await request(
      `${baseUrl}/build/builds/${buildId}?api-version=7.1`,
      { headers: { Authorization: authorization } },
      `Azure Windows build ${buildId} status`
    );
    const build = await response.json();
    await streamBuildLogs(buildId, logOffsets);
    if (build.status === "completed") {
      if (build.result !== "succeeded") {
        throw new Error(
          `Azure Windows build ${buildId} ended with ${build.result}.`
        );
      }
      return;
    }
    await delay(buildPollIntervalMilliseconds);
  }
  throw new Error(
    `Azure Windows build ${buildId} did not finish within 30 minutes.`
  );
}

async function streamBuildLogs(buildId, logOffsets) {
  try {
    const response = await request(
      `${baseUrl}/build/builds/${buildId}/timeline?api-version=7.1`,
      { headers: { Authorization: authorization } },
      `Azure Windows build ${buildId} timeline`,
      logRequestSettings()
    );
    const timeline = await response.json();
    for (const record of timeline.records ?? []) {
      if (!record.log?.id) continue;
      await streamBuildLog(buildId, record, logOffsets);
    }
  } catch (error) {
    console.warn(
      `Unable to stream Azure Windows build ${buildId} logs: ${error.message}`
    );
  }
}

async function streamBuildLog(buildId, record, logOffsets) {
  const startLine = logOffsets.get(record.log.id) ?? 1;
  const response = await request(
    `${baseUrl}/build/builds/${buildId}/logs/${record.log.id}?startLine=${startLine}&api-version=7.1`,
    { headers: { Accept: "text/plain", Authorization: authorization } },
    `Azure Windows build ${buildId} log ${record.log.id}`,
    logRequestSettings()
  );
  const lines = (await response.text()).split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  if (lines.length === 0) return;
  if (startLine === 1) {
    console.log(`--- Azure ${record.type ?? "task"}: ${record.name} ---`);
  }
  console.log(lines.join("\n"));
  logOffsets.set(record.log.id, startLine + lines.length);
}

async function downloadReleaseAssets(buildId) {
  const response = await request(
    `${baseUrl}/build/builds/${buildId}/artifacts?artifactName=desktop-agent-windows&api-version=7.1`,
    { headers: { Authorization: authorization } },
    `Azure Windows build ${buildId} artifact lookup`
  );
  const artifact = await response.json();
  if (!artifact.resource?.downloadUrl) {
    throw new Error(
      `Azure Windows build ${buildId} has no desktop-agent-windows artifact.`
    );
  }
  const archive = await request(
    artifact.resource.downloadUrl,
    { headers: { Authorization: authorization } },
    `Azure Windows build ${buildId} artifact download`
  );
  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), "desktop-agent-azure-")
  );
  try {
    const archivePath = path.join(temporaryRoot, "artifact.zip");
    const extractRoot = path.join(temporaryRoot, "artifact");
    await writeFile(archivePath, Buffer.from(await archive.arrayBuffer()));
    await mkdir(extractRoot);
    const extraction = spawnSync("unzip", [
      "-q",
      archivePath,
      "-d",
      extractRoot,
    ]);
    if (extraction.status !== 0) {
      throw new Error("Azure Windows artifact extraction failed.");
    }
    const releaseRoot = await findReleaseRoot(extractRoot);
    await copyReleaseAssets(releaseRoot, outputDirectory);
    await assertReleaseAssets(outputDirectory);
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

async function findReleaseRoot(root) {
  const entries = await readdir(root, { withFileTypes: true });
  if (entries.some((entry) => entry.name === "releases.win.json")) return root;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nested = path.join(root, entry.name);
    try {
      return await findReleaseRoot(nested);
    } catch {
      // Continue looking through the provider's archive wrapper directories.
    }
  }
  throw new Error(
    "Azure Windows artifact does not contain a VeloPack release directory."
  );
}

async function assertReleaseAssets(root) {
  const names = await readdir(root);
  if (
    !names.includes("releases.win.json") ||
    !names.some((name) => name.endsWith("-win-Setup.exe"))
  ) {
    throw new Error(
      "Azure Windows artifact is missing required VeloPack assets."
    );
  }
}

async function copyReleaseAssets(source, destination) {
  const entries = await readdir(source, { withFileTypes: true });
  await Promise.all(
    entries.map((entry) =>
      cp(path.join(source, entry.name), path.join(destination, entry.name), {
        force: true,
        recursive: entry.isDirectory(),
      })
    )
  );
}

function logRequestSettings() {
  return {
    attempts: logRequestAttempts,
    timeoutMilliseconds: logRequestTimeoutMilliseconds,
  };
}

async function request(url, options, label, settings = {}) {
  const response = await fetchWithRetry(url, options, {
    attempts: settings.attempts ?? requestAttempts,
    label,
    timeoutMilliseconds:
      settings.timeoutMilliseconds ?? requestTimeoutMilliseconds,
  });
  if (!response.ok) {
    throw new Error(`${label} failed with HTTP ${response.status}.`);
  }
  return response;
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`Required environment variable is missing: ${name}`);
  return value;
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
