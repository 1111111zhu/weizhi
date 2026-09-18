import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import pathModule from "node:path";

import {
  DesktopAgentDeviceAuthStatusResponseSchema,
  DesktopAgentHealthResponseSchema,
  DesktopAgentOpenResponseSchema,
  DesktopAgentSessionsResponseSchema,
  DesktopAgentUpdateStatusResponseSchema,
} from "@project-wing/shared";

import { verifyMasterFlows } from "./runtime-master-verification.mjs";
import {
  makePrintRequest,
  verifyPlatformContracts,
  verifyPrintEndpoint,
} from "./runtime-platform-verification.mjs";
import {
  assertEqual,
  buildDotnetProject,
  closeServer,
  findAvailablePort,
  makeSessionState,
  postJson,
  readJson,
  startAuthServer,
  waitForExit,
  waitUntilReady,
} from "./runtime-test-support.mjs";

const { dirname, join } = pathModule;

const root = join(import.meta.dirname, "..");
const project = join(
  root,
  "runtime",
  "ProjectWing.DesktopAgent.Runtime",
  "ProjectWing.DesktopAgent.Runtime.csproj"
);
const assembly = join(
  root,
  "runtime",
  "ProjectWing.DesktopAgent.Runtime",
  "bin",
  "Debug",
  "net8.0",
  "ProjectWing.DesktopAgent.Runtime.dll"
);
const port = await findAvailablePort();
const baseUrl = `http://127.0.0.1:${port}`;

buildDotnetProject(project, root);
const authServerFixture = await startAuthServer();
const stateRootFixture = await makeSessionState({ includeLeaseLost: true });
const trustedPdfEditorPath =
  process.platform === "win32" ? join(stateRootFixture, "MasterPDF.exe") : null;
if (trustedPdfEditorPath) {
  await writeFile(trustedPdfEditorPath, "trusted-pdf-editor-fixture", "utf-8");
}
const runtime = spawn("dotnet", [assembly, "--urls", baseUrl], {
  cwd: root,
  env: {
    ...process.env,
    PROJECT_WING_AGENT_VERSION: "9.8.7-test",
    PROJECT_WING_AGENT_ALLOWED_AUTH_ORIGINS: authServerFixture.origin,
    PROJECT_WING_AGENT_ALLOWED_DOWNLOAD_ORIGINS: authServerFixture.origin,
    PROJECT_WING_AGENT_WINDOWS_DOWNLOAD_URL: `${authServerFixture.origin}/downloads/desktop-agent/windows/latest`,
    PROJECT_WING_AGENT_STATE_ROOT: stateRootFixture,
    PROJECT_WING_AGENT_CACHE_ROOT: join(stateRootFixture, "cache"),
    PROJECT_WING_AGENT_DISABLE_FILE_LAUNCH: "true",
    ...(trustedPdfEditorPath
      ? { PROJECT_WING_PDF_MASTER_EDITOR_EXE_PATH: trustedPdfEditorPath }
      : {}),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
runtime.stdout.on("data", (chunk) => (output += chunk));
runtime.stderr.on("data", (chunk) => (output += chunk));

try {
  await waitUntilReady(baseUrl);
  await verifyContracts(baseUrl, authServerFixture, stateRootFixture);
  console.log(`Desktop Agent runtime verification passed on ${baseUrl}.`);
} catch (error) {
  console.error(output.trim());
  throw error;
} finally {
  runtime.kill();
  await waitForExit(runtime);
  await closeServer(authServerFixture.server);
  await rm(stateRootFixture, { recursive: true, force: true });
}

async function verifyContracts(url, authServer, stateRoot) {
  await verifyPlatformContracts(url, { trustedPdfEditorPath });
  const initialCacheSettings = await readJson(url, "/cache/settings");
  assertEqual(initialCacheSettings.cacheRoot, join(stateRoot, "cache"));
  assertEqual(initialCacheSettings.maxBytes, 5 * 1024 ** 3);
  assertEqual(initialCacheSettings.hitCount, 0);
  assertEqual(initialCacheSettings.missCount, 0);

  const authStatus = await readJson(url, "/auth/status");
  DesktopAgentDeviceAuthStatusResponseSchema.parse(authStatus);
  assertEqual(authStatus, {
    ok: true,
    authenticated: false,
    pairing: false,
  });
  const sessions = await readJson(url, "/sessions");
  DesktopAgentSessionsResponseSchema.parse(sessions);
  assertEqual(sessions.ok, true);
  assertEqual(sessions.sessions.length, 3);
  assertEqual(
    sessions.sessions.map((session) => session.sessionId),
    ["session-1", "session-launch-failed", "session-lease-lost"]
  );
  assertEqual(sessions.sessions[0].lifecycleState, "OPEN");
  assertEqual(sessions.sessions[1].lifecycleState, "LAUNCHING");
  assertEqual(sessions.sessions[2].lifecycleState, "LEASE_LOST");
  assertEqual(sessions.sessions[2].status, "LEASE_LOST");
  await verifyPersistedCleanupRecovery(url, stateRoot);
  await verifyLegacyRevokedMigration(url, stateRoot);
  const updateStatus = await readJson(url, "/update/status");
  DesktopAgentUpdateStatusResponseSchema.parse(updateStatus);
  assertEqual(updateStatus, {
    ok: true,
    status: "DOWNLOADING",
    stage: "DOWNLOADING",
    message: "Downloading Desktop Agent installer.",
    expectedVersion: "0.2.0",
  });
  await verifyUpdateEndpoint(url, authServer);
  await verifyOpenRequiresAuthentication(url, authServer);
  await verifyDeviceAuth(url, authServer);
  await verifyPrintEndpoint(url, authServer);
  await verifyReadOnlyOpen(url, authServer, stateRoot);
  await verifyMasterFlows({ url, authServer, stateRoot });
  await verifyInterruptedSyncRecovery(url, authServer, stateRoot);
  await verifyQuarantineRecovery(url, stateRoot);
  await verifyRecentHistoryRecovery(url, stateRoot);
  await verifyUnknownRoute(url);
  await verifyCacheSettingsUpdate(url, stateRoot);
}

async function verifyPersistedCleanupRecovery(url, stateRoot) {
  const cacheRoot = join(stateRoot, "cache");
  const localPath = join(cacheRoot, "cleanup-recovery", "master.xlsx");
  const snapshotPath = join(
    cacheRoot,
    ".check-in-staging",
    "session-cleanup-recovery",
    "snapshot.xlsx"
  );
  await mkdir(dirname(localPath), { recursive: true });
  await mkdir(dirname(snapshotPath), { recursive: true });
  await writeFile(localPath, "released-master", "utf-8");
  await writeFile(snapshotPath, "released-master", "utf-8");
  const sessionFile = join(stateRoot, "sessions.json");
  const sessionContents = await readFile(sessionFile, "utf-8");
  const current = JSON.parse(sessionContents.replace(/^\uFEFF/, ""));
  current.push({
    ...current.find((session) => session.sessionId === "session-launch-failed"),
    sessionId: "session-cleanup-recovery",
    localPath,
    snapshotPath,
    lifecycleState: "CLEANUP_PENDING",
    status: "CLEANUP_PENDING",
  });
  await writeFile(sessionFile, JSON.stringify(current), "utf-8");

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const sessions = await readJson(url, "/sessions");
    if (
      !sessions.sessions.some(
        (session) => session.sessionId === "session-cleanup-recovery"
      )
    ) {
      await assertPathMissing(localPath);
      await assertPathMissing(snapshotPath);
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error("Persisted CLEANUP_PENDING session was not recovered.");
}

async function verifyQuarantineRecovery(url, stateRoot) {
  const sessionFile = join(stateRoot, "sessions.json");
  const current = JSON.parse(await readFile(sessionFile, "utf-8"));
  current.push({
    ...current[0],
    sessionId: "invalid-future-session",
    schemaVersion: 999,
  });
  await writeFile(sessionFile, JSON.stringify(current), "utf-8");
  await readJson(url, "/sessions");
  await readJson(url, "/sessions");
  const quarantineRoot = join(stateRoot, "session-quarantine");
  const files = await readdir(quarantineRoot);
  assertEqual(files.length, 1);
  const repaired = JSON.parse(await readFile(sessionFile, "utf-8"));
  assertEqual(
    repaired.some((session) => session.sessionId === "invalid-future-session"),
    false
  );
  const health = await readJson(url, "/health");
  assertEqual(health.quarantineCount, 1);
  assertEqual(health.restoreState, "READY_WITH_ATTENTION");

  await writeFile(sessionFile, "{}", "utf-8");
  await writeFile(`${sessionFile}.bak`, "not-json", "utf-8");
  await readJson(url, "/sessions");
  await readJson(url, "/sessions");
  const recovered = JSON.parse(await readFile(sessionFile, "utf-8"));
  assertEqual(Array.isArray(recovered), true);
  const afterRecoveryFiles = await readdir(quarantineRoot);
  assertEqual(afterRecoveryFiles.length, 3);
}

async function verifyRecentHistoryRecovery(url, stateRoot) {
  const recentFile = join(stateRoot, "recent-sessions.json");
  const healthBefore = await readJson(url, "/health");
  await writeFile(recentFile, "{not-valid-json", "utf-8");

  const sessions = await readJson(url, "/sessions");
  DesktopAgentSessionsResponseSchema.parse(sessions);
  assertEqual(Array.isArray(sessions.recentSessions), true);
  assertEqual(
    Array.isArray(JSON.parse(await readFile(recentFile, "utf-8"))),
    true
  );
  const recentQuarantine = await readdir(
    join(stateRoot, "recent-history-quarantine")
  );
  assertEqual(recentQuarantine.length > 0, true);
  const healthAfter = await readJson(url, "/health");
  assertEqual(healthAfter.quarantineCount, healthBefore.quarantineCount);
}

async function verifyLegacyRevokedMigration(url, stateRoot) {
  const localPath = join(
    stateRoot,
    "cache",
    "legacy-revoked",
    "legacy-revoked.xlsx"
  );
  await mkdir(dirname(localPath), { recursive: true });
  await writeFile(localPath, "dirty-content-after-old-revoke", "utf-8");
  const sessionFile = join(stateRoot, "sessions.json");
  const current = JSON.parse(await readFile(sessionFile, "utf-8"));
  const template = current.find(
    (session) => session.sessionId === "session-launch-failed"
  );
  current.push({
    ...template,
    sessionId: "session-legacy-revoked",
    localPath,
    lifecycleState: "LOCK_REVOKED",
    status: "LOCK_REVOKED",
    contentState: "UNCHANGED",
    lockSessionId: "lock-legacy-revoked",
    openSignalToken: "open-legacy-revoked",
    closeSignalToken: "close-legacy-revoked",
  });
  await writeFile(sessionFile, JSON.stringify(current), "utf-8");
  const sessions = await readJson(url, "/sessions");
  const migrated = sessions.sessions.find(
    (session) => session.sessionId === "session-legacy-revoked"
  );
  assertEqual(migrated.lifecycleState, "LEASE_LOST");
  assertEqual(migrated.status, "LEASE_LOST");
  assertEqual(migrated.contentState, "DIRTY");
}

async function verifyInterruptedSyncRecovery(url, authServer, stateRoot) {
  const sessionFile = join(stateRoot, "sessions.json");
  const current = JSON.parse(await readFile(sessionFile, "utf-8"));
  const template = current.find(
    (session) => session.sessionId === "session-lease-lost"
  );
  const checkingPath = join(
    stateRoot,
    "cache",
    "interrupted-checking-in",
    "checking.xlsx"
  );
  const releasingPath = join(
    stateRoot,
    "cache",
    "interrupted-releasing",
    "releasing.xlsx"
  );
  await mkdir(dirname(checkingPath), { recursive: true });
  await mkdir(dirname(releasingPath), { recursive: true });
  await writeFile(checkingPath, "dirty-interrupted-check-in", "utf-8");
  await writeFile(releasingPath, "unchanged-interrupted-release", "utf-8");
  current.push(
    {
      ...template,
      sessionId: "session-interrupted-checking-in",
      projectId: "project-interrupted-checking-in",
      attachmentId: "attachment-interrupted-checking-in",
      localPath: checkingPath,
      lifecycleState: "CHECKING_IN",
      status: "CHECKING_IN",
      contentState: "DIRTY",
      checkInUrl: `${authServer.origin}/desktop-agent/check-in`,
      releaseUrl: `${authServer.origin}/desktop-agent/release`,
      lockSessionId: "lock-interrupted-checking-in",
      grantSecret: "grant-interrupted-checking-in",
      closeDetectedAt: new Date().toISOString(),
      openSignalToken: "open-interrupted-checking-in",
      closeSignalToken: "close-interrupted-checking-in",
    },
    {
      ...template,
      sessionId: "session-interrupted-releasing",
      projectId: "project-interrupted-releasing",
      attachmentId: "attachment-interrupted-releasing",
      localPath: releasingPath,
      originalHash: template.lastKnownHash,
      lifecycleState: "RELEASING",
      status: "RELEASING",
      contentState: "UNCHANGED",
      releaseUrl: `${authServer.origin}/desktop-agent/release`,
      lockSessionId: "lock-interrupted-releasing",
      grantSecret: "grant-interrupted-releasing",
      pendingReleaseReason: "UNCHANGED_RELEASE",
      pendingReleaseHash: template.lastKnownHash,
      openSignalToken: "open-interrupted-releasing",
      closeSignalToken: "close-interrupted-releasing",
    }
  );
  await writeFile(sessionFile, JSON.stringify(current), "utf-8");
  await readJson(url, "/sessions");

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const sessions = await readJson(url, "/sessions");
    const pending = sessions.sessions.some((session) =>
      [
        "session-interrupted-checking-in",
        "session-interrupted-releasing",
      ].includes(session.sessionId)
    );
    if (!pending) {
      await assertPathMissing(checkingPath);
      await assertPathMissing(releasingPath);
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error("Interrupted check-in/release states were not recovered.");
}

async function assertPathMissing(path) {
  try {
    await stat(path);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }
  throw new Error(`Expected controlled cache path to be removed: ${path}`);
}

async function verifyUpdateEndpoint(url, authServer) {
  const invalid = await postJson(url, "/update", {
    expectedVersion: "invalid",
  });
  assertEqual(invalid.status, 400);
  const invalidPayload = await invalid.json();
  assertEqual(invalidPayload.code, "VALIDATION_FAILED");

  const ready = await postJson(url, "/update", {
    expectedVersion: "9.8.7-test",
    expectedSha256: "a".repeat(64),
    expectedFileSize: 1,
    downloadUrl: `${authServer.origin}/downloads/desktop-agent/windows/releases/9.8.7-test`,
  });
  assertEqual(ready.status, 200);
  const result = await ready.json();
  DesktopAgentUpdateStatusResponseSchema.parse(result);
  assertEqual(result.status, "READY");
  assertEqual(result.currentVersion, "9.8.7-test");
  const persisted = await readJson(url, "/update/status");
  DesktopAgentUpdateStatusResponseSchema.parse(persisted);
  assertEqual(persisted.status, "READY");
}

async function verifyOpenRequiresAuthentication(url, authServer) {
  const response = await postJson(url, "/open", makeOpenRequest(authServer));
  assertEqual(response.status, 401);
  assertEqual(await response.json(), {
    ok: false,
    code: "DEVICE_AUTH_REQUIRED",
    message: "Pair this Desktop Agent before opening files.",
  });
  const printResponse = await postJson(
    url,
    "/print",
    makePrintRequest(authServer)
  );
  assertEqual(printResponse.status, 401);
  const printPayload = await printResponse.json();
  assertEqual(printPayload.code, "DEVICE_AUTH_REQUIRED");
}

async function verifyDeviceAuth(url, authServer) {
  const untrusted = await postJson(url, "/auth/pair", {
    clientId: "project-wing-desktop-agent",
    deviceCode: "untrusted-code",
    authBaseUrl: "https://untrusted.example",
    expiresInSeconds: 30,
    intervalSeconds: 1,
  });
  assertEqual(untrusted.status, 400);

  const response = await postJson(url, "/auth/pair", {
    clientId: "project-wing-desktop-agent",
    deviceCode: "verified-device-code",
    authBaseUrl: authServer.origin,
    authorization: "Bearer browser-token-must-not-be-used",
    expiresInSeconds: 30,
    intervalSeconds: 1,
  });
  assertEqual(response.status, 202);
  const startedStatus = await response.json();
  DesktopAgentDeviceAuthStatusResponseSchema.parse(startedStatus);
  assertEqual(startedStatus, {
    ok: true,
    authenticated: false,
    pairing: true,
  });
  await waitForAuthentication(url);
  const authenticatedStatus = await readJson(url, "/auth/status");
  assertEqual(authenticatedStatus.user, {
    id: "runtime-test-user",
    email: "runtime-test@projectwing.local",
    name: "Runtime Test",
  });
  assertEqual(authServer.tokenRequests.length, 1);
  assertEqual(authServer.tokenRequests[0], {
    authorization: null,
    body: {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: "verified-device-code",
      client_id: "project-wing-desktop-agent",
    },
  });
}

async function verifyReadOnlyOpen(url, authServer, stateRoot) {
  const untrusted = await postJson(url, "/open", {
    ...makeOpenRequest(authServer),
    downloadUrl: "https://untrusted.example/audit-report.pdf",
  });
  assertEqual(untrusted.status, 403);

  const redirect = await postJson(url, "/open", {
    ...makeOpenRequest(authServer),
    downloadUrl: `${authServer.origin}/downloads/redirect.pdf`,
  });
  assertEqual(redirect.status, 502);
  assertEqual(await redirect.json(), {
    ok: false,
    code: "DOWNLOAD_REDIRECT_REJECTED",
    message: `Could not download the selected file (unsafe or excessive redirect from ${authServer.origin}).`,
  });
  assertEqual(authServer.redirectRequests.length, 1);

  const response = await postJson(url, "/open", makeOpenRequest(authServer));
  assertEqual(response.status, 200);
  const result = await response.json();
  DesktopAgentOpenResponseSchema.parse(result);
  assertEqual(
    await readFile(result.localPath, "utf-8"),
    "audit-report-content"
  );
  assertEqual(result.localPath.startsWith(join(stateRoot, "cache")), true);
  const fileStatus = await stat(result.localPath);
  assertEqual(fileStatus.mode & 0o222, 0);
  assertEqual(authServer.downloadRequests, [
    { authorization: "Bearer private-token" },
  ]);
  const firstMetrics = await readJson(url, "/cache/settings");
  assertEqual(firstMetrics.hitCount, 0);
  assertEqual(firstMetrics.missCount, 2);

  const cachedResponse = await postJson(
    url,
    "/open",
    makeOpenRequest(authServer)
  );
  assertEqual(cachedResponse.status, 200);
  const cachedResult = await cachedResponse.json();
  assertEqual(
    await readFile(cachedResult.localPath, "utf-8"),
    "audit-report-content"
  );
  assertEqual(authServer.downloadRequests.length, 1);
  const cachedMetrics = await readJson(url, "/cache/settings");
  assertEqual(cachedMetrics.hitCount, 1);
  assertEqual(cachedMetrics.missCount, firstMetrics.missCount);
  assertEqual(
    cachedMetrics.bytesSaved,
    Buffer.byteLength("audit-report-content")
  );

  const sessions = await readJson(url, "/sessions");
  DesktopAgentSessionsResponseSchema.parse(sessions);
  assertEqual(sessions.sessions.length, 6);
  const opened = sessions.sessions.find(
    (session) => session.sessionId === result.sessionId
  );
  assertEqual(opened.projectId, "project-open");
  assertEqual(opened.localPath, result.localPath);
  assertEqual(opened.mode, "READ_ONLY");

  await rm(result.localPath);
  const refreshed = await readJson(url, "/sessions");
  DesktopAgentSessionsResponseSchema.parse(refreshed);
  const missing = refreshed.sessions.find(
    (session) => session.sessionId === result.sessionId
  );
  assertEqual(missing.lifecycleState, "LOCAL_FILE_MISSING");
  assertEqual(missing.contentState, "MISSING");
  assertEqual(missing.status, "LOCAL_FILE_MISSING");
  const health = await readJson(url, "/health");
  DesktopAgentHealthResponseSchema.parse(health);
  assertEqual(health.agentState, "READY_WITH_ATTENTION");
  assertEqual(health.updateState, "READY");
  assertEqual(health.attentionCount, 4);
}

function makeOpenRequest(authServer) {
  const content = "audit-report-content";
  return {
    mode: "READ_ONLY",
    projectId: "project-open",
    attachmentId: "attachment-open",
    fileName: "audit-report.pdf",
    downloadUrl: `${authServer.origin}/downloads/audit-report.pdf`,
    fileSize: Buffer.byteLength(content),
    contentToken: "attachment-open:v1",
    cacheVersionId: "attachment-open:v1",
    contentHash: createHash("sha256").update(content).digest("hex"),
  };
}

async function verifyUnknownRoute(url) {
  const response = await fetch(`${url}/missing`);
  assertEqual(response.status, 404);
  assertEqual(await response.json(), {
    ok: false,
    code: "NOT_FOUND",
    message: "Desktop Agent route was not found.",
  });
}

async function verifyCacheSettingsUpdate(url, stateRoot) {
  const nextRoot = join(stateRoot, "moved-cache");
  const response = await postJson(url, "/cache/settings", {
    cacheRoot: nextRoot,
    maxBytes: 7 * 1024 ** 3,
  });
  assertEqual(response.status, 200);
  const settings = await response.json();
  assertEqual(settings.cacheRoot, nextRoot);
  assertEqual(settings.maxBytes, 7 * 1024 ** 3);
  assertEqual(settings.restartRequired, true);
  const persisted = JSON.parse(
    await readFile(join(stateRoot, "cache-settings.json"), "utf-8")
  );
  assertEqual(persisted, {
    cacheRoot: nextRoot,
    maxBytes: 7 * 1024 ** 3,
  });
}

async function waitForAuthentication(url) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const status = await readJson(url, "/auth/status");
    DesktopAgentDeviceAuthStatusResponseSchema.parse(status);
    if (status.authenticated && !status.pairing) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  }
  throw new Error("Desktop Agent device authorization did not complete.");
}
