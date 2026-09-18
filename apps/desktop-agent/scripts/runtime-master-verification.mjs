import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import pathModule from "node:path";

import {
  DesktopAgentCheckInResponseSchema,
  DesktopAgentOpenResponseSchema,
  DesktopAgentSessionsResponseSchema,
} from "@project-wing/shared";

import { assertEqual, postJson, readJson } from "./runtime-test-support.mjs";

const { dirname, join } = pathModule;

export async function verifyMasterFlows({ url, authServer, stateRoot }) {
  await verifyMasterOpen(url, authServer, stateRoot);
  await verifyLaunchFailureEvent(url, authServer);
  await verifyRevokedReleaseCleanup(url, authServer);
  await verifyConcurrentSmallFileClose(url, authServer);
  if (process.platform === "win32") {
    await verifyAutomaticCloseRecovery(url, authServer);
  }
  await verifyMasterCacheHit(url, authServer);
  await verifyLegacyCachePromotion(url, authServer, stateRoot);
  await verifyRecentSessionLimit(url);
}

async function verifyMasterCacheHit(url, authServer) {
  const content = "audit-report-content";
  const request = {
    ...makeMasterOpenRequest(authServer),
    projectId: "project-master-cache",
    attachmentId: "attachment-master-cache",
    fileName: "master-cache.xlsx",
    lockSessionId: "lock-master-cache-1",
    grantSecret: "grant-master-cache-1",
    cacheVersionId: "attachment-master-cache:v1",
    contentToken: "attachment-master-cache:v1",
    contentHash: createHash("sha256").update(content).digest("hex"),
    fileSize: Buffer.byteLength(content),
  };
  const downloadsBefore = authServer.downloadRequests.length;
  const firstResponse = await postJson(url, "/open", request);
  assertEqual(firstResponse.status, 200);
  const first = await firstResponse.json();
  assertEqual(authServer.downloadRequests.length, downloadsBefore + 1);
  const firstRelease = await postJson(
    url,
    `/sessions/${first.sessionId}/release`,
    { releaseUrl: `${authServer.origin}/desktop-agent/release` }
  );
  assertEqual(firstRelease.status, 200);
  await assertMissing(first.localPath);
  const firstHistory = await readJson(url, "/sessions");
  assertEqual(
    firstHistory.recentSessions.some(
      (session) =>
        session.projectId === request.projectId &&
        session.attachmentId === request.attachmentId
    ),
    true
  );

  const secondResponse = await postJson(url, "/open", {
    ...request,
    lockSessionId: "lock-master-cache-2",
    grantSecret: "grant-master-cache-2",
  });
  assertEqual(secondResponse.status, 200);
  const second = await secondResponse.json();
  assertEqual(await readFile(second.localPath, "utf-8"), content);
  assertEqual(authServer.downloadRequests.length, downloadsBefore + 1);
  const metrics = await readJson(url, "/cache/settings");
  assertEqual(metrics.hitCount >= 2, true);
  assertEqual(metrics.bytesSaved >= Buffer.byteLength(content) * 2, true);

  const secondRelease = await postJson(
    url,
    `/sessions/${second.sessionId}/release`,
    { releaseUrl: `${authServer.origin}/desktop-agent/release` }
  );
  assertEqual(secondRelease.status, 200);
  await assertMissing(second.localPath);
  const secondHistory = await readJson(url, "/sessions");
  assertEqual(
    secondHistory.recentSessions.filter(
      (session) =>
        session.projectId === request.projectId &&
        session.attachmentId === request.attachmentId
    ).length,
    1
  );
}

async function verifyLegacyCachePromotion(url, authServer, stateRoot) {
  const content = "legacy-cache-content";
  const contentHash = createHash("sha256").update(content).digest("hex");
  const cacheVersionId = "attachment-legacy-cache:v1";
  const versionSegment = `version-${createHash("sha256")
    .update(cacheVersionId)
    .digest("hex")
    .slice(0, 32)}`;
  const legacyPath = join(
    stateRoot,
    "cache",
    "project-legacy-cache",
    "attachment-legacy-cache",
    "master",
    versionSegment,
    "legacy-cache.xlsx"
  );
  await mkdir(dirname(legacyPath), { recursive: true });
  await writeFile(legacyPath, content, "utf-8");
  await writeFile(
    join(dirname(legacyPath), ".project-wing-cache.json"),
    JSON.stringify({
      version: 2,
      projectId: "project-legacy-cache",
      attachmentId: "attachment-legacy-cache",
      lockSessionId: "legacy-lock",
      cacheVersionId,
      cacheOwnerId: "owner-1",
      fileSize: Buffer.byteLength(content),
      contentHash,
      fileName: "legacy-cache.xlsx",
      originalHash: contentHash,
      createdAt: new Date().toISOString(),
    }),
    "utf-8"
  );

  const downloadsBefore = authServer.downloadRequests.length;
  const response = await postJson(url, "/open", {
    ...makeMasterOpenRequest(authServer),
    projectId: "project-legacy-cache",
    attachmentId: "attachment-legacy-cache",
    fileName: "legacy-cache.xlsx",
    lockSessionId: "lock-legacy-cache-new",
    grantSecret: "grant-legacy-cache-new",
    cacheVersionId,
    cacheOwnerId: "owner-1",
    contentToken: contentHash,
    contentHash,
    fileSize: Buffer.byteLength(content),
  });
  assertEqual(response.status, 200);
  const opened = await response.json();
  assertEqual(await readFile(opened.localPath, "utf-8"), content);
  assertEqual(authServer.downloadRequests.length, downloadsBefore);

  const release = await postJson(url, `/sessions/${opened.sessionId}/release`, {
    releaseUrl: `${authServer.origin}/desktop-agent/release`,
  });
  assertEqual(release.status, 200);
  await assertMissing(opened.localPath);
}

async function verifyRevokedReleaseCleanup(url, authServer) {
  const response = await postJson(url, "/open", {
    ...makeMasterOpenRequest(authServer),
    projectId: "project-release-revoked",
    attachmentId: "attachment-release-revoked",
    fileName: "release-revoked.xlsx",
    lockSessionId: "lock-release-revoked",
    grantSecret: "grant-release-revoked",
  });
  assertEqual(response.status, 200);
  const result = await response.json();
  const release = await postJson(url, `/sessions/${result.sessionId}/release`, {
    releaseUrl: `${authServer.origin}/desktop-agent/release`,
  });
  assertEqual(release.status, 200);
  const releasePayload = await release.json();
  assertEqual(releasePayload.session.lifecycleState, "CLOSED");
  await assertMissing(result.localPath);
  const sessions = await readJson(url, "/sessions");
  assertEqual(
    sessions.recentSessions.some(
      (session) =>
        session.projectId === "project-release-revoked" &&
        session.attachmentId === "attachment-release-revoked"
    ),
    true
  );
}

async function verifyRecentSessionLimit(url) {
  const sessions = await readJson(url, "/sessions");
  DesktopAgentSessionsResponseSchema.parse(sessions);
  assertEqual(sessions.recentSessions.length <= 5, true);
  const keys = sessions.recentSessions.map(
    (session) => `${session.projectId}\u0000${session.attachmentId}`
  );
  assertEqual(new Set(keys).size, keys.length);
  for (const session of sessions.recentSessions) {
    assertEqual(Object.keys(session).sort(), [
      "attachmentId",
      "closedAt",
      "fileName",
      "mode",
      "openedAt",
      "projectId",
    ]);
  }
}

async function verifyMasterOpen(url, authServer, stateRoot) {
  const request = makeMasterOpenRequest(authServer);
  const response = await postJson(url, "/open", request);
  assertEqual(response.status, 200);
  const result = await response.json();
  DesktopAgentOpenResponseSchema.parse(result);
  assertEqual(
    await readFile(result.localPath, "utf-8"),
    "audit-report-content"
  );
  assertEqual(result.localPath.startsWith(join(stateRoot, "cache")), true);
  const fileStatus = await stat(result.localPath);
  assertEqual((fileStatus.mode & 0o200) !== 0, true);

  const duplicate = await postJson(url, "/open", request);
  assertEqual(duplicate.status, 409);
  const duplicatePayload = await duplicate.json();
  assertEqual(duplicatePayload.code, "SESSION_ALREADY_OPEN");

  const sessions = await readJson(url, "/sessions");
  DesktopAgentSessionsResponseSchema.parse(sessions);
  const opened = sessions.sessions.find(
    (session) => session.sessionId === result.sessionId
  );
  assertEqual(opened.mode, "MASTER");
  assertEqual(opened.lifecycleState, "OPEN");
  assertEqual(opened.openObservedSource, "LAUNCHER_PROCESS");
  assertEqual(opened.lockSessionId, "lock-master-open");
  const duplicateOpenObserved = await postJson(
    url,
    `/sessions/${result.sessionId}/open-observed`,
    {
      generation: opened.generation,
      openSignalToken: opened.openSignalToken,
      source: "WATCHER_COM",
    }
  );
  assertEqual(duplicateOpenObserved.status, 200);

  const lateLaunchFailure = await postJson(
    url,
    `/sessions/${result.sessionId}/launch-failed`,
    {
      generation: opened.generation,
      openSignalToken: opened.openSignalToken,
      reason: "OPEN_OBSERVATION_TIMEOUT",
      message: "A delayed timeout must not overwrite an observed open.",
    }
  );
  assertEqual(lateLaunchFailure.status, 409);

  const afterLateFailure = await readJson(url, "/sessions");
  const stillOpen = afterLateFailure.sessions.find(
    (session) => session.sessionId === result.sessionId
  );
  assertEqual(stillOpen.lifecycleState, "OPEN");
  assertEqual(Boolean(stillOpen.openObservedAt), true);

  await writeFile(result.localPath, "changed-audit-report-content", "utf-8");
  const refreshed = await readJson(url, "/sessions");
  DesktopAgentSessionsResponseSchema.parse(refreshed);
  const dirty = refreshed.sessions.find(
    (session) => session.sessionId === result.sessionId
  );
  assertEqual(dirty.lifecycleState, "OPEN");
  assertEqual(dirty.contentState, "DIRTY");
  assertEqual(dirty.status, "DIRTY_PENDING_CHECKIN");

  const closeRequest = {
    generation: opened.generation,
    closeSignalToken: opened.closeSignalToken,
    source: "MANUAL",
  };
  const [closed, duplicateClosed] = await Promise.all([
    postJson(url, `/sessions/${result.sessionId}/closed`, closeRequest),
    postJson(url, `/sessions/${result.sessionId}/closed`, closeRequest),
  ]);
  assertEqual(closed.status, 200);
  assertEqual(duplicateClosed.status, 200);
  const closedResult = await closed.json();
  DesktopAgentCheckInResponseSchema.parse(closedResult);
  assertEqual(closedResult.session.lifecycleState, "CLOSE_DETECTED");
  assertEqual(closedResult.session.contentState, "DIRTY");
  assertEqual(closedResult.session.closeDetectedSource, "MANUAL");
  await waitForSessionCleanup(
    url, result.sessionId, authServer, "project-master-open"
  );
  await assertMissing(result.localPath);
  assertEqual(authServer.downloadRequests.length, 2);
  assertUpload(authServer.uploadRequests[0]);
  assertEqual(authServer.directUploadBodies[0], "changed-audit-report-content");
  assertEqual(authServer.releaseRequests[0], {
    projectId: "project-master-open",
    attachmentId: "attachment-master-open",
    grantSecret: "grant-master-open",
    reason: "CHECKED_IN",
  });
}

async function verifyAutomaticCloseRecovery(url, authServer) {
  const response = await postJson(url, "/open", {
    ...makeMasterOpenRequest(authServer),
    projectId: "project-observer-recovery",
    attachmentId: "attachment-observer-recovery",
    fileName: "observer-recovery.docx",
    lockSessionId: "lock-observer-recovery",
    grantSecret: "grant-observer-recovery",
  });
  assertEqual(response.status, 200);
  const result = await response.json();
  await writeFile(result.localPath, "observer-recovered-content", "utf-8");

  await waitForSessionCleanup(
    url, result.sessionId, authServer, "project-observer-recovery"
  );
  await assertMissing(result.localPath);
  assertEqual(
    authServer.releaseRequests.some(
      (request) =>
        request.projectId === "project-observer-recovery" &&
        request.reason === "CHECKED_IN"
    ),
    true
  );
}

async function waitForSessionCleanup(url, sessionId, authServer, projectId) {
  const startedAt = Date.now();
  // Two Windows close-confirmation scans can each probe several Office sessions
  // with a three-second COM timeout, in addition to the close grace and sync.
  const deadline = startedAt + 30_000;
  let lastState;
  while (Date.now() < deadline) {
    const sessions = await readJson(url, "/sessions");
    const current = sessions.sessions.find(
      (session) => session.sessionId === sessionId
    );
    lastState = current && {
      lifecycleState: current.lifecycleState,
      contentState: current.contentState,
      status: current.status,
      lastError: current.lastError,
      openObservedAt: current.openObservedAt,
    };
    if (
      !sessions.sessions.some((session) => session.sessionId === sessionId) &&
      authServer.uploadRequests.some(
        (upload) => JSON.parse(upload.body).projectId === projectId
      ) &&
      authServer.releaseRequests.some(
        (request) =>
          request.projectId === projectId && request.reason === "CHECKED_IN"
      )
    ) {
      console.log(`Master check-in and cleanup completed in ${Date.now() - startedAt} ms.`);
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error(`Background Master check-in did not complete: ${JSON.stringify(lastState)}.`);
}

async function verifyLaunchFailureEvent(url, authServer) {
  const response = await postJson(
    url,
    "/sessions/session-launch-failed/launch-failed",
    {
      generation: 1,
      openSignalToken: "open-launch-failed",
      reason: "COM_OPEN_FAILED",
      message: "Office rejected the workbook.",
    }
  );
  assertEqual(response.status, 200);
  const result = await response.json();
  DesktopAgentCheckInResponseSchema.parse(result);
  assertEqual(result.session.lifecycleState, "LAUNCH_FAILED");
  assertEqual(result.session.launchFailedReason, "COM_OPEN_FAILED");
  assertEqual(result.session.lastError, "Office rejected the workbook.");

  const stale = await postJson(
    url,
    "/sessions/session-launch-failed/open-observed",
    {
      generation: 1,
      openSignalToken: "open-launch-failed",
      source: "WATCHER_COM",
    }
  );
  assertEqual(stale.status, 409);

  await verifyLaunchFailureRecovery(url, result.session);

  const release = await postJson(
    url,
    "/sessions/session-launch-failed/release",
    {
      releaseUrl: `${authServer.origin}/desktop-agent/release`,
    }
  );
  assertEqual(release.status, 200);
  const releaseResult = await release.json();
  DesktopAgentCheckInResponseSchema.parse(releaseResult);
  assertEqual(releaseResult.session.lifecycleState, "CLOSED");
  await assertMissing(result.session.localPath);
  assertEqual(authServer.releaseRequests[1], {
    projectId: "project-launch-failed",
    attachmentId: "attachment-launch-failed",
    grantSecret: "grant-launch-failed",
    reason: "UNCHANGED_RELEASE",
  });
}

async function assertMissing(path) {
  try {
    await stat(path);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }
  throw new Error(`Controlled Master file was not removed: ${path}`);
}

async function verifyLaunchFailureRecovery(url, session) {
  const path = "/sessions/session-launch-failed/recover-launch-failed-release";
  const invalid = await postJson(url, path, {
    generation: 1,
    closeSignalToken: "close-launch-failed",
    confirmNoUserVisibleWorkbook: false,
  });
  assertEqual(invalid.status, 400);

  const mismatched = await postJson(url, path, {
    generation: 1,
    closeSignalToken: "wrong-close-token",
    confirmNoUserVisibleWorkbook: true,
  });
  assertEqual(mismatched.status, 409);
  const mismatchedPayload = await mismatched.json();
  assertEqual(mismatchedPayload.code, "CLOSE_SIGNAL_MISMATCH");

  await writeFile(session.localPath, "dirty-launch-failed-content", "utf-8");
  const dirty = await postJson(url, path, {
    generation: 1,
    closeSignalToken: "close-launch-failed",
    confirmNoUserVisibleWorkbook: true,
  });
  assertEqual(dirty.status, 409);
  const dirtyPayload = await dirty.json();
  assertEqual(dirtyPayload.code, "DIRTY_LOCAL_FILE");
  await writeFile(session.localPath, "fixture-master", "utf-8");

  const recovery = await postJson(url, path, {
    generation: 1,
    closeSignalToken: "close-launch-failed",
    confirmNoUserVisibleWorkbook: true,
  });
  assertEqual(recovery.status, 200);
  const recoveryResult = await recovery.json();
  DesktopAgentCheckInResponseSchema.parse(recoveryResult);
  assertEqual(recoveryResult.session.lifecycleState, "RELEASE_PENDING");
  assertEqual(recoveryResult.session.contentState, "UNCHANGED");
  assertEqual(recoveryResult.session.pendingReleaseReason, "UNCHANGED_RELEASE");
}

function assertUpload(upload) {
  assertEqual(upload.contentType.startsWith("application/json"), true);
  const body = JSON.parse(upload.body);
  assertEqual(body.projectId, "project-master-open");
  assertEqual(body.grantSecret, "grant-master-open");
  assertEqual(body.objectKey, "desktop-test/object");
}

function makeMasterOpenRequest(authServer) {
  return {
    mode: "MASTER",
    projectId: "project-master-open",
    attachmentId: "attachment-master-open",
    fileName: "audit-report.xlsx",
    downloadUrl: `${authServer.origin}/downloads/audit-report.pdf`,
    checkInUrl: `${authServer.origin}/desktop-agent/check-in`,
    releaseUrl: `${authServer.origin}/desktop-agent/release`,
    lockSessionId: "lock-master-open",
    baseVersion: 2,
    grantSecret: "grant-master-open",
    directUploadSupported: true,
  };
}

async function verifyConcurrentSmallFileClose(url, authServer) {
  const opened = [];
  for (let index = 0; index < 3; index += 1) {
    const response = await postJson(url, "/open", {
      ...makeMasterOpenRequest(authServer),
      projectId: `project-concurrent-${index}`,
      attachmentId: `attachment-concurrent-${index}`,
      fileName: `concurrent-${index}.xlsx`,
      lockSessionId: `lock-concurrent-${index}`,
      grantSecret: `grant-concurrent-${index}`,
    });
    assertEqual(response.status, 200);
    const result = await response.json();
    const sessions = await readJson(url, "/sessions");
    const session = sessions.sessions.find(
      (candidate) => candidate.sessionId === result.sessionId
    );
    await writeFile(result.localPath, `concurrent-content-${index}`, "utf-8");
    opened.push({ result, session });
  }

  const responses = await Promise.all(
    opened.map(({ result, session }) =>
      postJson(url, `/sessions/${result.sessionId}/closed`, {
        generation: session.generation,
        closeSignalToken: session.closeSignalToken,
        source: "MANUAL",
      })
    )
  );
  for (const response of responses) {
    assertEqual(response.status, 200);
  }
  await Promise.all(
    opened.map(({ result, session }) =>
      waitForSessionCleanup(url, result.sessionId, authServer, session.projectId)
    )
  );
  await Promise.all(
    opened.map(({ result }) => assertMissing(result.localPath))
  );
}
