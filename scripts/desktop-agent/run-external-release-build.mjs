#!/usr/bin/env node

import { fetchWithRetry, formatHttpFailure } from "./external-build-http.mjs";

const [provider, platform, version, channel] = process.argv.slice(2);
const supportedProviders = new Set(["azure", "codemagic"]);
const supportedPlatforms = new Set(["windows", "macos"]);

if (!supportedProviders.has(provider) || !supportedPlatforms.has(platform)) {
  fail(
    "Usage: run-external-release-build.mjs <azure|codemagic> <windows|macos> <version> <preview|stable>"
  );
}
if (provider === "codemagic" && platform !== "macos") {
  fail("Codemagic is only configured for macOS releases.");
}
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  fail(`Desktop Agent release must be plain SemVer: ${version}`);
}
if (!["preview", "stable"].includes(channel)) {
  fail(`Unsupported Desktop Agent release channel: ${channel}`);
}

await (provider === "azure" ? runAzure() : runCodemagic());

async function runAzure() {
  const organization = required("AZURE_DEVOPS_ORGANIZATION").replace(/\/$/, "");
  const project = encodeURIComponent(required("AZURE_DEVOPS_PROJECT"));
  const pipelineId = required(
    platform === "windows"
      ? "AZURE_WINDOWS_PIPELINE_ID"
      : "AZURE_MACOS_PIPELINE_ID"
  );
  const authorization = basicAuthorization(required("AZURE_DEVOPS_PAT"));
  const baseUrl = `${organization}/${project}/_apis`;
  const started = await fetchJson(
    `${baseUrl}/pipelines/${pipelineId}/runs?api-version=7.1`,
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(azureRequest()),
    },
    "Azure build start"
  );
  if (!started.id) {
    fail("Azure build did not return an id.");
  }
  console.log(`Started Azure ${platform} build ${started.id}.`);
  await pollAzure(baseUrl, started.id, authorization);
}

function azureRequest() {
  return {
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
      ...(platform === "macos" ? { runtimeIdentifier: "osx-arm64" } : {}),
    },
    variables: externalBuildVariables(),
  };
}

function externalBuildVariables() {
  const values = {
    GHCR_TOKEN: required("GH_TOKEN"),
    GHCR_USERNAME: required("GITHUB_ACTOR"),
    GHCR_REPOSITORY_OWNER: required("GITHUB_REPOSITORY_OWNER"),
    GHCR_ASSET_TAG_PREFIX: required("DESKTOP_AGENT_ASSET_TAG_PREFIX"),
    SOURCE_COMMIT: required("GITHUB_SHA"),
    DESKTOP_AGENT_VELOPACK_UPDATE_URL:
      process.env.DESKTOP_AGENT_VELOPACK_UPDATE_URL?.trim() ?? "",
  };
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      { value, isSecret: name === "GHCR_TOKEN" },
    ])
  );
}

async function pollAzure(baseUrl, buildId, authorization) {
  const url = `${baseUrl}/build/builds/${buildId}?api-version=7.1`;
  const logOffsets = new Map();
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const build = await fetchJson(
      url,
      { headers: { Authorization: authorization } },
      `Azure build ${buildId} status`
    );
    await streamAzureLogs(baseUrl, buildId, authorization, logOffsets);
    if (build.status === "completed") {
      if (build.result !== "succeeded") {
        fail(`Azure build ${buildId} ended with ${build.result}.`);
      }
      console.log(
        `Azure ${platform} build ${buildId} pushed its bundle to GHCR.`
      );
      return;
    }
    await delay(15_000);
  }
  fail(`Azure build ${buildId} did not finish within 45 minutes.`);
}

async function streamAzureLogs(baseUrl, buildId, authorization, offsets) {
  try {
    const timeline = await fetchJson(
      `${baseUrl}/build/builds/${buildId}/timeline?api-version=7.1`,
      { headers: { Authorization: authorization } },
      `Azure build ${buildId} timeline`
    );
    for (const record of timeline.records ?? []) {
      if (!record.log?.id) {
        continue;
      }
      await streamAzureLog(baseUrl, buildId, record, authorization, offsets);
    }
  } catch (error) {
    console.warn(
      `Unable to stream Azure build ${buildId} logs: ${error.message}`
    );
  }
}

async function streamAzureLog(
  baseUrl,
  buildId,
  record,
  authorization,
  offsets
) {
  const startLine = offsets.get(record.log.id) ?? 1;
  const response = await fetchWithRetry(
    `${baseUrl}/build/builds/${buildId}/logs/${record.log.id}?startLine=${startLine}&api-version=7.1`,
    { headers: { Accept: "text/plain", Authorization: authorization } },
    {
      attempts: 3,
      label: `Azure build ${buildId} log ${record.log.id}`,
      timeoutMilliseconds: 15_000,
    }
  );
  if (!response.ok) {
    return;
  }
  const responseBody = await response.text();
  const lines = responseBody.split(/\r?\n/);
  if (lines.at(-1) === "") {
    lines.pop();
  }
  if (lines.length === 0) {
    return;
  }
  if (startLine === 1) {
    console.log(`--- Azure ${record.type ?? "task"}: ${record.name} ---`);
  }
  console.log(lines.join("\n"));
  offsets.set(record.log.id, startLine + lines.length);
}

async function runCodemagic() {
  const token = required("CODEMAGIC_API_TOKEN");
  const started = await fetchJson(
    "https://api.codemagic.io/builds",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-auth-token": token },
      body: JSON.stringify({
        appId: required("CODEMAGIC_APP_ID"),
        workflowId: "desktop-agent-macos",
        branch: process.env.GITHUB_REF_NAME || "main",
        environment: { variables: codemagicVariables() },
      }),
    },
    "Codemagic build start"
  );
  if (!started.buildId) {
    fail("Codemagic build did not return an id.");
  }
  console.log(`Started Codemagic macOS build ${started.buildId}.`);
  await pollCodemagic(started.buildId, token);
}

function codemagicVariables() {
  return {
    DESKTOP_AGENT_RELEASE_VERSION: version,
    DESKTOP_AGENT_RELEASE_CHANNEL: channel,
    DESKTOP_AGENT_RUNTIME_IDENTIFIER: "osx-arm64",
    DESKTOP_AGENT_VELOPACK_UPDATE_URL:
      process.env.DESKTOP_AGENT_VELOPACK_UPDATE_URL?.trim() ?? "",
    GHCR_TOKEN: required("GH_TOKEN"),
    GHCR_USERNAME: required("GITHUB_ACTOR"),
    GHCR_REPOSITORY_OWNER: required("GITHUB_REPOSITORY_OWNER"),
    GHCR_ASSET_TAG_PREFIX: required("DESKTOP_AGENT_ASSET_TAG_PREFIX"),
    SOURCE_COMMIT: required("GITHUB_SHA"),
  };
}

async function pollCodemagic(buildId, token) {
  const url = `https://api.codemagic.io/builds/${buildId}`;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const response = await fetchJson(
      url,
      { headers: { "x-auth-token": token } },
      `Codemagic build ${buildId} status`
    );
    const status = response.build?.status;
    if (status === "finished") {
      console.log(
        `Codemagic macOS build ${buildId} pushed its bundle to GHCR.`
      );
      return;
    }
    if (["failed", "canceled", "cancelled"].includes(status)) {
      fail(`Codemagic build ${buildId} ended with ${status}.`);
    }
    await delay(15_000);
  }
  fail(`Codemagic build ${buildId} did not finish within 45 minutes.`);
}

async function fetchJson(url, options, label) {
  const response = await fetchWithRetry(url, options, {
    attempts: 8,
    label,
    timeoutMilliseconds: 45_000,
  });
  if (!response.ok) {
    const secrets = [
      process.env.AZURE_DEVOPS_PAT,
      process.env.CODEMAGIC_API_TOKEN,
      process.env.GH_TOKEN,
    ];
    fail(await formatHttpFailure(response, label, secrets));
  }
  return response.json();
}

function basicAuthorization(token) {
  return `Basic ${Buffer.from(`:${token}`).toString("base64")}`;
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    fail(`Required environment variable is missing: ${name}`);
  }
  return value;
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function fail(message) {
  throw new Error(message);
}
