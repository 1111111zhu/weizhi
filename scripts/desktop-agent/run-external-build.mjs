#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";

import { fetchWithRetry } from "./external-build-http.mjs";

const { basename, join } = nodePath;

const [provider, platform, version, runtime, outputDirectory] =
  process.argv.slice(2);
const expectedName = resolveInstallerName(platform, version, runtime);
const diagnosticNames = resolveDiagnosticNames(platform, runtime);

if (!provider || !platform || !version || !runtime || !outputDirectory) {
  fail(
    "Usage: run-external-build.mjs <azure|codemagic> <windows|macos> <version> <runtime> <output-directory>"
  );
}
if (!/^0\.2\.\d+$/.test(version)) {
  fail(`Unsupported release version: ${version}`);
}

await mkdir(outputDirectory, { recursive: true });
if (provider === "azure") {
  await runAzureBuild();
} else if (provider === "codemagic") {
  await runCodemagicBuild();
} else {
  fail(`Unsupported external build provider: ${provider}`);
}

async function runAzureBuild() {
  const organization = required("AZURE_DEVOPS_ORGANIZATION").replace(/\/$/, "");
  const project = encodeURIComponent(required("AZURE_DEVOPS_PROJECT"));
  const pipelineId = required(
    platform === "windows"
      ? "AZURE_WINDOWS_PIPELINE_ID"
      : "AZURE_MACOS_PIPELINE_ID"
  );
  const authorization = `Basic ${Buffer.from(`:${required("AZURE_DEVOPS_PAT")}`).toString("base64")}`;
  const baseUrl = `${organization}/${project}/_apis`;
  const started = await fetchJson(
    `${baseUrl}/pipelines/${pipelineId}/runs?api-version=7.1`,
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(azureRunRequest()),
    },
    { label: "Azure build start", retry: false }
  );
  console.log(`Started Azure ${platform} build ${started.id}.`);
  const logOffsets = new Map();
  const build = await pollAzureBuild(
    baseUrl,
    started.id,
    authorization,
    logOffsets
  );
  if (build.result !== "succeeded") {
    fail(`Azure build ${started.id} ended with ${build.result}.`);
  }
  await downloadAzureArtifact(baseUrl, started.id, authorization);
}

function azureRunRequest() {
  const requestPayload = {
    resources: {
      repositories: {
        self: {
          refName: `refs/heads/${process.env.GITHUB_REF_NAME || "main"}`,
          version: process.env.GITHUB_SHA,
        },
      },
    },
    templateParameters: {
      releaseVersion: version,
      ...(platform === "macos" ? { runtimeIdentifier: runtime } : {}),
    },
  };
  if (platform === "windows") {
    requestPayload.variables = windowsSigningVariables();
  }
  return requestPayload;
}

function windowsSigningVariables() {
  const requiredSigning = isTruthy(
    process.env.PROJECT_WING_WINDOWS_SIGNING_REQUIRED
  );
  const values = {
    PROJECT_WING_WINDOWS_SIGNING_REQUIRED: requiredSigning ? "true" : "false",
    PROJECT_WING_WINDOWS_SIGNING_PFX_BASE64:
      process.env.PROJECT_WING_WINDOWS_SIGNING_PFX_BASE64 ?? "",
    PROJECT_WING_WINDOWS_SIGNING_PFX_PASSWORD:
      process.env.PROJECT_WING_WINDOWS_SIGNING_PFX_PASSWORD ?? "",
    PROJECT_WING_WINDOWS_SIGNING_ROOT_CERT_BASE64:
      process.env.PROJECT_WING_WINDOWS_SIGNING_ROOT_CERT_BASE64 ?? "",
    PROJECT_WING_WINDOWS_SIGNING_EXPECTED_SUBJECT:
      process.env.PROJECT_WING_WINDOWS_SIGNING_EXPECTED_SUBJECT ?? "",
    PROJECT_WING_WINDOWS_SIGNING_TIMESTAMP_URL:
      process.env.PROJECT_WING_WINDOWS_SIGNING_TIMESTAMP_URL ?? "",
  };
  if (requiredSigning) {
    for (const [name, value] of Object.entries(values)) {
      if (name !== "PROJECT_WING_WINDOWS_SIGNING_REQUIRED" && !value.trim()) {
        fail(`Required Windows signing configuration is missing: ${name}`);
      }
    }
  }
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      {
        value,
        isSecret: name.includes("PFX") || name.includes("ROOT_CERT_BASE64"),
      },
    ])
  );
}

async function pollAzureBuild(baseUrl, buildId, authorization, logOffsets) {
  const url = `${baseUrl}/build/builds/${buildId}?api-version=7.1`;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const build = await fetchJson(
      url,
      {
        headers: { Authorization: authorization },
      },
      { label: `Azure build ${buildId} status` }
    );
    await streamAzureLogs(baseUrl, buildId, authorization, logOffsets);
    if (build.status === "completed") {
      return build;
    }
    await delay(15_000);
  }
  fail(`Azure build ${buildId} did not finish within 30 minutes.`);
}

async function streamAzureLogs(baseUrl, buildId, authorization, logOffsets) {
  try {
    const timeline = await fetchJson(
      `${baseUrl}/build/builds/${buildId}/timeline?api-version=7.1`,
      { headers: { Authorization: authorization } },
      { label: `Azure build ${buildId} timeline` }
    );
    for (const record of timeline.records ?? []) {
      if (!record.log?.id) {
        continue;
      }
      const startLine = logOffsets.get(record.log.id) ?? 1;
      const text = await fetchText(
        `${baseUrl}/build/builds/${buildId}/logs/${record.log.id}?startLine=${startLine}&api-version=7.1`,
        { headers: { Accept: "text/plain", Authorization: authorization } },
        `Azure build ${buildId} log ${record.log.id}`
      );
      const lines = text.split(/\r?\n/);
      if (lines.at(-1) === "") {
        lines.pop();
      }
      if (lines.length === 0) {
        continue;
      }
      if (startLine === 1) {
        console.log(`--- Azure ${record.type ?? "task"}: ${record.name} ---`);
      }
      console.log(lines.join("\n"));
      logOffsets.set(record.log.id, startLine + lines.length);
    }
  } catch (error) {
    console.error(
      `Unable to stream Azure build ${buildId} logs: ${error.message}`
    );
  }
}

async function downloadAzureArtifact(baseUrl, buildId, authorization) {
  const artifactName =
    platform === "windows" ? "desktop-agent-windows" : "desktop-agent-macos";
  const url = `${baseUrl}/build/builds/${buildId}/artifacts?artifactName=${artifactName}&api-version=7.1`;
  const artifact = await fetchJson(url, {
    headers: { Authorization: authorization },
  });
  if (!artifact.resource?.downloadUrl) {
    fail(`Azure build ${buildId} has no download URL for ${artifactName}.`);
  }
  const archive = await fetchBytes(artifact.resource.downloadUrl, {
    headers: { Authorization: authorization },
  });
  const temporaryRoot = await mkdtemp(join(tmpdir(), "desktop-agent-azure-"));
  try {
    const archivePath = join(temporaryRoot, "artifact.zip");
    const extractRoot = join(temporaryRoot, "artifact");
    await writeFile(archivePath, archive);
    await mkdir(extractRoot);
    const extracted = spawnSync("unzip", [
      "-q",
      archivePath,
      "-d",
      extractRoot,
    ]);
    if (extracted.status !== 0) {
      fail("Azure artifact extraction failed.");
    }
    await copyArtifact(await findFile(extractRoot, expectedName), expectedName);
    for (const diagnosticName of diagnosticNames) {
      await copyArtifact(
        await findFile(extractRoot, diagnosticName),
        diagnosticName
      );
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function runCodemagicBuild() {
  if (platform !== "macos") {
    fail("Codemagic is only configured for macOS builds.");
  }
  const token = required("CODEMAGIC_API_TOKEN");
  const workflowId =
    runtime === "osx-x64" ? "desktop-agent-macos-x64" : "desktop-agent-macos";
  const started = await fetchJson("https://api.codemagic.io/builds", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": token },
    body: JSON.stringify({
      appId: required("CODEMAGIC_APP_ID"),
      workflowId,
      branch: process.env.GITHUB_REF_NAME || "main",
      environment: { variables: { DESKTOP_AGENT_RELEASE_VERSION: version } },
    }),
  });
  console.log(`Started Codemagic build ${started.buildId}.`);
  const completed = await pollCodemagicBuild(started.buildId, token);
  const build = await pollCodemagicArtifacts(started.buildId, token, completed);
  const installer = findCodemagicArtifact(build, expectedName);
  if (!installer?.url) {
    fail(`Codemagic build ${started.buildId} did not publish ${expectedName}.`);
  }
  await downloadCodemagicArtifact(installer, expectedName, token);
  for (const artifactName of diagnosticNames) {
    const artifact = findCodemagicArtifact(build, artifactName);
    if (!artifact?.url) {
      console.warn(
        `Codemagic build ${started.buildId} did not expose optional diagnostic ${artifactName}.`
      );
      continue;
    }
    await downloadCodemagicArtifact(artifact, artifactName, token);
  }
}

async function downloadCodemagicArtifact(artifact, artifactName, token) {
  await writeFile(
    join(outputDirectory, artifactName),
    await fetchBytes(artifact.url, {
      headers: { "x-auth-token": token },
    })
  );
}

async function pollCodemagicArtifacts(buildId, token, initialBuild) {
  const expectedArtifacts = [expectedName, ...diagnosticNames];
  let build = initialBuild;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const currentBuild = build;
    if (
      expectedArtifacts.every((name) =>
        findCodemagicArtifact(currentBuild, name)
      )
    ) {
      return build;
    }
    await delay(5000);
    const response = await fetchJson(
      `https://api.codemagic.io/builds/${buildId}`,
      {
        headers: { "x-auth-token": token },
      }
    );
    ({ build } = response);
  }
  const available = (build.artefacts ?? []).map((item) => item.name).join(", ");
  console.warn(
    `Codemagic artifact list remained incomplete after 2 minutes. Available: ${available || "none"}`
  );
  return build;
}

function findCodemagicArtifact(build, artifactName) {
  return build.artefacts?.find((item) => {
    const name = item.name?.split(/[\\/]/).at(-1);
    return name === artifactName;
  });
}

async function pollCodemagicBuild(buildId, token) {
  const url = `https://api.codemagic.io/builds/${buildId}`;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const response = await fetchJson(
      url,
      {
        headers: { "x-auth-token": token },
      },
      {
        label: `Codemagic build ${buildId} availability`,
        retryStatusCodes: [404],
      }
    );
    const { build } = response;
    if (build.status === "finished") {
      return build;
    }
    if (["failed", "canceled", "cancelled"].includes(build.status)) {
      fail(`Codemagic build ${buildId} ended with ${build.status}.`);
    }
    await delay(15_000);
  }
  fail(`Codemagic build ${buildId} did not finish within 30 minutes.`);
}

async function fetchJson(url, options, settings) {
  const response = await request(url, options, settings);
  if (!response.ok) {
    fail(`Request failed with HTTP ${response.status}.`);
  }
  return response.json();
}

async function fetchText(url, options, settings) {
  const response = await request(url, options, settings);
  if (!response.ok) {
    fail(`Log request failed with HTTP ${response.status}.`);
  }
  return response.text();
}

async function fetchBytes(url, options) {
  const response = await request(url, options, { label: "Artifact download" });
  if (!response.ok) {
    fail(`Artifact download failed with HTTP ${response.status}.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function request(
  url,
  options,
  { label = "External build request", retry = true, retryStatusCodes } = {}
) {
  return retry
    ? fetchWithRetry(url, options, { label, retryStatusCodes })
    : fetch(url, options);
}

async function findFile(directory, name) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFile(path, name);
      if (nested) {
        return nested;
      }
    } else if (entry.name === name) {
      return path;
    }
  }
  return null;
}

async function copyArtifact(source, name) {
  if (!source) {
    fail(`External build did not publish ${name}.`);
  }
  await copyFile(source, join(outputDirectory, basename(source)));
}

function resolveInstallerName(
  targetPlatform,
  releaseVersion,
  runtimeIdentifier
) {
  if (targetPlatform === "windows") {
    return `desktop-agent-win-x64-${releaseVersion}.exe`;
  }
  const architecture = runtimeIdentifier.replace(/^osx-/, "");
  return `desktop-agent-macos-${architecture}-${releaseVersion}.pkg`;
}

function resolveDiagnosticNames(targetPlatform, runtimeIdentifier) {
  const mergeReport =
    targetPlatform === "windows"
      ? "managed-runtime-merge.json"
      : `managed-runtime-layout-${runtimeIdentifier}.json`;
  return [
    "payload-size-report.json",
    mergeReport,
    ...(targetPlatform === "windows" &&
    isTruthy(process.env.PROJECT_WING_WINDOWS_SIGNING_REQUIRED)
      ? ["payload-signing-report.json", "installer-signing-report.json"]
      : []),
  ];
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    fail(`Required environment variable is missing: ${name}`);
  }
  return value;
}

function isTruthy(value) {
  return /^(1|true|yes|on)$/i.test(value?.trim() ?? "");
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function fail(message) {
  throw new Error(message);
}
