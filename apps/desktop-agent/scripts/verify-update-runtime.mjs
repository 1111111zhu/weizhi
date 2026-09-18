import { spawn, spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import pathModule from "node:path";
import { fileURLToPath } from "node:url";

import { DesktopAgentUpdateStatusResponseSchema } from "@project-wing/shared";

import {
  assertEqual,
  closeServer,
  findAvailablePort,
  makeSessionState,
  postJson,
  readJson,
  startAuthServer,
  waitForExit,
  waitUntilReady,
} from "./runtime-test-support.mjs";

const { join } = pathModule;

const root = fileURLToPath(new URL("..", import.meta.url));
const project = join(
  root,
  "runtime/ProjectWing.DesktopAgent.Runtime/ProjectWing.DesktopAgent.Runtime.csproj"
);
const assembly = join(
  root,
  "runtime/ProjectWing.DesktopAgent.Runtime/bin/Debug/net8.0/ProjectWing.DesktopAgent.Runtime.dll"
);

buildRuntime();
const authServer = await startAuthServer();
const stateRoot = await makeSessionState({
  masterOverrides: {
    releaseUrl: `${authServer.origin}/desktop-agent/release`,
  },
});
const port = await findAvailablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const runtime = spawn("dotnet", [assembly, "--urls", baseUrl], {
  cwd: root,
  env: {
    ...process.env,
    PROJECT_WING_AGENT_VERSION: "9.8.7-test",
    PROJECT_WING_AGENT_STATE_ROOT: stateRoot,
    PROJECT_WING_AGENT_CACHE_ROOT: join(stateRoot, "cache"),
    PROJECT_WING_AGENT_DISABLE_FILE_LAUNCH: "true",
    PROJECT_WING_AGENT_ALLOWED_DOWNLOAD_ORIGINS: authServer.origin,
    PROJECT_WING_AGENT_WINDOWS_DOWNLOAD_URL: `${authServer.origin}/downloads/desktop-agent/windows/latest`,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
runtime.stdout.on("data", (chunk) => (output += chunk));
runtime.stderr.on("data", (chunk) => (output += chunk));

try {
  await waitUntilReady(baseUrl);
  const integrity = {
    expectedSha256: "a".repeat(64),
    expectedFileSize: 123_456,
  };
  const missingIntegrity = await postJson(baseUrl, "/update", {
    expectedVersion: "0.2.0",
    downloadUrl: `${authServer.origin}/downloads/desktop-agent/windows/releases/0.2.0`,
  });
  assertEqual(missingIntegrity.status, 400);
  const untrusted = await postJson(baseUrl, "/update", {
    expectedVersion: "0.2.0",
    ...integrity,
    downloadUrl:
      "https://untrusted.example/downloads/desktop-agent/windows/releases/0.2.0",
  });
  assertEqual(untrusted.status, 400);
  const response = await postJson(baseUrl, "/update", {
    expectedVersion: "0.2.0",
    ...integrity,
    downloadUrl: `${authServer.origin}/downloads/desktop-agent/windows/releases/0.2.0`,
  });
  assertEqual(response.status, 202);
  const started = await response.json();
  DesktopAgentUpdateStatusResponseSchema.parse(started);
  assertEqual(started.status, "STARTED");
  const waiting = await waitForWaitingStatus(baseUrl);
  assertEqual(waiting.status, "WAITING_FOR_WORKBOOK_CLOSE");
  assertEqual(waiting.taskId, started.taskId);
  const launchFailed = await postJson(
    baseUrl,
    "/sessions/session-launch-failed/launch-failed",
    {
      generation: 1,
      openSignalToken: "open-launch-failed",
      reason: "COM_OPEN_FAILED",
      message: "Office rejected the workbook.",
    }
  );
  assertEqual(launchFailed.status, 200);
  const failed = await waitForStatus(baseUrl, "FAILED");
  assertEqual(failed.errorCode, "UNKNOWN_ERROR");
  assertEqual(authServer.releaseRequests[0], {
    projectId: "project-launch-failed",
    attachmentId: "attachment-launch-failed",
    grantSecret: "grant-launch-failed",
    reason: "UNCHANGED_RELEASE",
  });
  console.log(`Desktop Agent update verification passed on ${baseUrl}.`);
} catch (error) {
  console.error(output.trim());
  throw error;
} finally {
  runtime.kill("SIGINT");
  await waitForExit(runtime);
  await closeServer(authServer.server);
  await rm(stateRoot, { recursive: true, force: true });
}

function buildRuntime() {
  const result = spawnSync(
    "dotnet",
    ["build", project, "-c", "Debug", "--nologo"],
    {
      cwd: root,
      encoding: "utf-8",
    }
  );
  if (result.status !== 0) {
    throw new Error(result.stdout + result.stderr);
  }
}

async function waitForWaitingStatus(runtimeBaseUrl) {
  await Promise.resolve();
  return waitForStatus(runtimeBaseUrl, "WAITING_FOR_WORKBOOK_CLOSE");
}

async function waitForStatus(runtimeBaseUrl, expectedStatus) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const status = await readJson(runtimeBaseUrl, "/update/status");
    DesktopAgentUpdateStatusResponseSchema.parse(status);
    if (status.status === expectedStatus) {
      return status;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  }
  throw new Error(`Desktop Agent update did not reach ${expectedStatus}.`);
}
