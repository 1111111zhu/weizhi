import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import pathModule from "node:path";

const { join } = pathModule;

export async function readJson(url, path) {
  const response = await fetch(`${url}${path}`);
  assertEqual(response.status, 200);
  return response.json();
}

export function postJson(url, path, body) {
  return fetch(`${url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function buildDotnetProject(project, cwd) {
  const result = spawnSync(
    "dotnet",
    ["build", project, "-c", "Debug", "--nologo"],
    { cwd, encoding: "utf-8" }
  );
  if (result.status === 0) {
    return;
  }
  process.stderr.write(result.stdout);
  process.stderr.write(result.stderr);
  throw new Error(`Desktop Agent build failed for ${project}.`);
}

export function assertEqual(actual, expected) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}.`);
  }
}

export async function waitUntilReady(url, timeoutMilliseconds = 30_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the runtime has started listening.
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error("Desktop Agent runtime did not become ready.");
}

export function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createTcpServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

export function startAuthServer() {
  const tokenRequests = [];
  const downloadRequests = [];
  const redirectRequests = [];
  const uploadRequests = [];
  const directUploadBodies = [];
  const releaseRequests = [];
  const server = createHttpServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/auth/get-session") {
      assertEqual(request.headers.authorization, "Bearer private-token");
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        user: { id: "runtime-test-user", email: "runtime-test@projectwing.local", name: "Runtime Test" },
      }));
      return;
    }
    if (request.method === "GET" && request.url === "/downloads/redirect.pdf") {
      redirectRequests.push(request.url);
      response.writeHead(302, {
        Location: "https://untrusted.example/audit-report.pdf",
      });
      response.end();
      return;
    }
    if (
      request.method === "GET" &&
      request.url === "/downloads/audit-report.pdf"
    ) {
      downloadRequests.push({
        authorization: request.headers.authorization ?? null,
      });
      response.writeHead(200, { "Content-Type": "application/pdf" });
      response.end("audit-report-content");
      return;
    }
    if (
      request.method === "POST" &&
      request.url === "/desktop-agent/check-in/prepare"
    ) {
      await readRequestBody(request);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          ok: true,
          mode: "DIRECT_PUT",
          objectKey: "desktop-test/object",
          uploadUrl: `http://127.0.0.1:${server.address().port}/oss/object`,
          headers: { "Content-Type": "application/octet-stream" },
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        })
      );
      return;
    }
    if (request.method === "PUT" && request.url === "/oss/object") {
      directUploadBodies.push(await readRequestBody(request));
      response.writeHead(200, { ETag: '"direct-test"' });
      response.end();
      return;
    }
    if (
      request.method === "POST" &&
      request.url === "/desktop-agent/check-in"
    ) {
      uploadRequests.push({
        contentType: request.headers["content-type"] ?? null,
        body: await readRequestBody(request),
      });
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    if (request.method === "POST" && request.url === "/desktop-agent/release") {
      const body = JSON.parse(await readRequestBody(request));
      releaseRequests.push(body);
      if (body.projectId === "project-release-revoked") {
        response.writeHead(409, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            ok: false,
            code: "LOCK_REVOKED",
            message: "Master lock was already revoked.",
          })
        );
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    if (request.method !== "POST" || request.url !== "/auth/device/token") {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "not_found" }));
      return;
    }
    const body = JSON.parse(await readRequestBody(request));
    tokenRequests.push({
      authorization: request.headers.authorization ?? null,
      body,
    });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({ access_token: "private-token", expires_in: 60 })
    );
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        tokenRequests,
        downloadRequests,
        redirectRequests,
        uploadRequests,
        directUploadBodies,
        releaseRequests,
        origin: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

export async function makeSessionState(options = {}) {
  const stateRoot = await mkdtemp(join(tmpdir(), "project-wing-runtime-"));
  const fixtureRoot = join(stateRoot, "cache", "fixtures");
  const readOnlyPath = join(fixtureRoot, "audit-report.pdf");
  const masterPath = join(fixtureRoot, "launch-failed.xlsx");
  const leaseLostPath = join(fixtureRoot, "lease-lost.xlsx");
  await mkdir(fixtureRoot, { recursive: true });
  await writeFile(readOnlyPath, "fixture-read-only", "utf-8");
  await writeFile(masterPath, "fixture-master", "utf-8");
  if (options.includeLeaseLost) {
    await writeFile(leaseLostPath, "fixture-lease-lost", "utf-8");
  }
  const sessions = [
    makeSession({
      localPath: readOnlyPath,
      originalHash: hashText("fixture-read-only"),
      lastKnownHash: hashText("fixture-read-only"),
    }),
    makeLaunchingMasterSession({
      localPath: masterPath,
      originalHash: hashText("fixture-master"),
      lastKnownHash: hashText("fixture-master"),
      ...options.masterOverrides,
    }),
  ];
  if (options.includeLeaseLost) {
    sessions.push(
      makeLaunchingMasterSession({
        sessionId: "session-lease-lost",
        projectId: "project-lease-lost",
        attachmentId: "attachment-lease-lost",
        fileName: "lease-lost.xlsx",
        localPath: leaseLostPath,
        originalHash: hashText("fixture-lease-lost"),
        lastKnownHash: hashText("fixture-lease-lost"),
        lifecycleState: "LEASE_LOST",
        status: "LEASE_LOST",
        contentState: "UNCHANGED",
        lockSessionId: "lock-lease-lost",
        grantSecret: "grant-lease-lost",
        openSignalToken: "open-lease-lost",
        closeSignalToken: "close-lease-lost",
      })
    );
  }
  await writeFile(
    join(stateRoot, "sessions.json"),
    `\uFEFF${JSON.stringify(sessions)}`,
    "utf-8"
  );
  await writeFile(
    join(stateRoot, "update-status.json"),
    JSON.stringify({
      ok: true,
      status: "DOWNLOADING",
      stage: "DOWNLOADING",
      message: "Downloading Desktop Agent installer.",
      expectedVersion: "0.2.0",
    }),
    "utf-8"
  );
  return stateRoot;
}

export function makeSession(overrides = {}) {
  return {
    sessionId: "session-1",
    generation: 1,
    mode: "READ_ONLY",
    projectId: "project-1",
    attachmentId: "attachment-1",
    fileName: "audit-report.pdf",
    localPath: "/tmp/audit-report.pdf",
    originalHash: "hash-1",
    lastKnownHash: "hash-1",
    status: "OPEN_UNCHANGED",
    lifecycleState: "OPEN",
    contentState: "UNCHANGED",
    openedAt: "2026-07-15T08:00:00.000Z",
    launchStartedAt: "2026-07-15T08:00:00.000Z",
    lastSeenAt: "2026-07-15T08:00:00.000Z",
    ...overrides,
  };
}

export function makeLaunchingMasterSession(overrides = {}) {
  return {
    sessionId: "session-launch-failed",
    generation: 1,
    mode: "MASTER",
    projectId: "project-launch-failed",
    attachmentId: "attachment-launch-failed",
    fileName: "launch-failed.xlsx",
    localPath: "/tmp/launch-failed.xlsx",
    originalHash: "hash-launch-failed",
    lastKnownHash: "hash-launch-failed",
    status: "OPEN_UNCHANGED",
    lifecycleState: "LAUNCHING",
    contentState: "UNCHANGED",
    openedAt: "2026-07-15T08:00:00.000Z",
    launchStartedAt: "2026-07-15T08:00:00.000Z",
    lastSeenAt: "2026-07-15T08:00:00.000Z",
    lockSessionId: "lock-launch-failed",
    baseVersion: 1,
    grantSecret: "grant-launch-failed",
    openSignalToken: "open-launch-failed",
    closeSignalToken: "close-launch-failed",
    retryCount: 0,
    ...overrides,
  };
}

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf-8");
    request.on("data", (chunk) => (body += chunk));
    request.once("end", () => resolve(body));
    request.once("error", reject);
  });
}

export function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export function waitForExit(process) {
  if (process.exitCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    process.once("exit", resolve);
  });
}
