#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import { promisify } from "node:util";

const { basename, join, resolve } = nodePath;

const execFileAsync = promisify(execFile);
const healthUrl = "http://127.0.0.1:17862/health";
const sessionsUrl = "http://127.0.0.1:17862/sessions";
const verifyMode = process.env.PROJECTWING_VERIFY_MODE ?? "install";
const defaultStopAgentFirst =
  verifyMode !== "trusted-update" && verifyMode !== "open-only";
const screenshots = [
  "01-agent-unavailable-dialog.png",
  "02-after-install.png",
  "03-master-open.png",
  "04-after-release.png",
];
const config = {
  siteUrl: trimTrailingSlash(
    process.env.PROJECTWING_VERIFY_SITE_URL ?? "https://wing.superfx.cn"
  ),
  locale: process.env.PROJECTWING_VERIFY_LOCALE ?? "zh-CN",
  email: requiredEnv("PROJECTWING_VERIFY_EMAIL"),
  password: requiredEnv("PROJECTWING_VERIFY_PASSWORD"),
  projectId: requiredEnv("PROJECTWING_VERIFY_PROJECT_ID"),
  targetAttachmentId:
    process.env.PROJECTWING_VERIFY_ATTACHMENT_ID?.trim() || null,
  expectedAgentVersion: requiredEnv("PROJECTWING_VERIFY_AGENT_VERSION"),
  apiBaseUrl: trimTrailingSlash(
    process.env.PROJECTWING_VERIFY_API_BASE_URL ??
      `${trimTrailingSlash(process.env.PROJECTWING_VERIFY_SITE_URL ?? "https://wing.superfx.cn")}/api`
  ),
  masterButtonPattern:
    process.env.PROJECTWING_VERIFY_MASTER_BUTTON_PATTERN ??
    "以 Master 打开 副本采购全量发票查询导出结果",
  mode: verifyMode,
  chromePath:
    process.env.PROJECTWING_VERIFY_CHROME_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  outputDir: resolve(
    process.env.PROJECTWING_VERIFY_OUTPUT_DIR ??
      "output/playwright/desktop-agent-health"
  ),
  stopAgentFirst: readBooleanEnv(
    "PROJECTWING_VERIFY_STOP_AGENT_FIRST",
    defaultStopAgentFirst
  ),
};

async function main() {
  await mkdir(config.outputDir, { recursive: true });
  const downloadsDir = join(config.outputDir, "downloads");
  await mkdir(downloadsDir, { recursive: true });
  const runState = {
    apiEvents: [],
    preflightReleases: [],
    lastObservedHealth: null,
    lastObservedSessions: null,
  };
  const { apiEvents } = runState;
  let browser = null;
  let page = null;

  try {
    const { chromium } = await import("playwright-core");

    if (config.stopAgentFirst) {
      await releasePreexistingTargetSessions(runState);
      await stopDesktopAgent();
    }

    browser = await chromium.launch({
      executablePath: config.chromePath,
      headless: false,
    });
    const context = await browser.newContext({
      acceptDownloads: true,
      locale: config.locale,
      viewport: { width: 1440, height: 960 },
    });
    page = await context.newPage();

    page.on("response", (response) => {
      const url = response.url();
      if (
        url.includes("/master/open") ||
        url.includes("127.0.0.1:17862/open") ||
        url.includes("127.0.0.1:17862/sessions")
      ) {
        apiEvents.push({
          url,
          status: response.status(),
          receivedAt: new Date().toISOString(),
        });
      }
    });

    await login(page);
    await openProject(page);

    let dialogText = null;
    let health = null;
    let installerPath = null;
    if (config.mode !== "open-only") {
      await clickMaster(page);
      dialogText = await assertAgentGuidanceDialog(page);
      await screenshot(page, screenshots[0]);

      if (config.mode === "trusted-update") {
        await clickDesktopAgentUpdate(page);
      } else {
        installerPath = await downloadInstaller(page, downloadsDir);
        await runInstaller(installerPath);
      }
      health = await waitForExpectedHealth(runState);

      await closeOrDismissDialog(page);
      await screenshot(page, screenshots[1]);
    }

    const existingSessionIds = await snapshotExistingSessionIds(runState);
    const masterClickStartedAt = new Date();
    await clickMaster(page);
    const openSession = await waitForOpenMasterSession(runState, {
      openedAfter: masterClickStartedAt,
      existingSessionIds,
    });
    await page.waitForTimeout(2000);
    await screenshot(page, screenshots[2]);

    const closeResult = await closeOpenedExcelWorkbook(openSession);
    await waitForSessionReleased(openSession.sessionId, runState);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await screenshot(page, screenshots[3]);
    await waitForMasterButtonVisible(page);

    const report = {
      ok: true,
      dialogText,
      installerPath,
      health,
      openSession: redactSessionSecret(openSession),
      closeResult,
      preflightReleases: runState.preflightReleases,
      apiEvents,
      screenshots: screenshotPaths(),
      finishedAt: new Date().toISOString(),
      lastObservedHealth: runState.lastObservedHealth,
      lastObservedSessions: redactSessionSecrets(runState.lastObservedSessions),
    };
    await writeFile(
      join(config.outputDir, "desktop-agent-health-report.json"),
      JSON.stringify(report, null, 2),
      "utf-8"
    );
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await captureFailurePage(page, runState);
    await writeFailureReport(error, runState);
    throw error;
  } finally {
    await browser?.close();
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function login(page) {
  await page.goto(`${config.siteUrl}/${config.locale}/login`, {
    waitUntil: "networkidle",
  });

  const emailInput = page
    .locator('input[type="email"], input[name="email"], input[name="username"]')
    .first();
  if (!(await emailInput.isVisible().catch(() => false))) {
    return;
  }

  await emailInput.fill(config.email);
  await page
    .locator('input[type="password"], input[name="password"]')
    .first()
    .fill(config.password);
  await Promise.all([
    page
      .waitForResponse(
        (response) => response.url().includes("/api/auth/login"),
        {
          timeout: 15_000,
        }
      )
      .catch(() => {}),
    page.getByRole("button", { name: /登录|Login|Sign in/i }).click(),
  ]);
  await page
    .waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 })
    .catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1000);
}

async function openProject(page) {
  await page.goto(
    `${config.siteUrl}/${config.locale}/projects/${config.projectId}`,
    {
      waitUntil: "networkidle",
    }
  );

  const confirmationPattern =
    /确认并进入项目|确认无误|继续|进入项目|Confirm|Continue|Enter project/i;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const button = page
      .getByRole("button", { name: confirmationPattern })
      .first();
    if (!(await button.isVisible().catch(() => false))) {
      break;
    }
    await button.click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(500);
  }
}

async function clickMaster(page) {
  const directButton = page.getByRole("button", {
    name: new RegExp(escapeRegExp(config.masterButtonPattern)),
  });
  if (
    (await directButton
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false)) &&
    (await directButton
      .first()
      .isEnabled()
      .catch(() => false))
  ) {
    await directButton.first().click();
    return;
  }

  const fileHint = extractExpectedFileHint(config.masterButtonPattern);
  if (!fileHint) {
    await directButton.first().waitFor({ state: "visible", timeout: 30_000 });
    await directButton.first().click();
    return;
  }

  const fileText = page.getByText(fileHint, { exact: false }).first();
  await fileText.waitFor({ state: "visible", timeout: 30_000 });
  const row = fileText.locator("xpath=ancestor::*[count(.//button) > 1][1]");
  const actionsButton = row
    .getByRole("button", {
      name: new RegExp(`File actions for ${escapeRegExp(fileHint)}`),
    })
    .first();
  await ((await actionsButton.isVisible().catch(() => false))
    ? actionsButton.click()
    : row.getByRole("button").nth(1).click());

  const masterAction = page
    .getByRole("menuitem", { name: /Master|以 Master 打开|Open \(Master\)/i })
    .or(
      page.getByRole("button", {
        name: /Master|以 Master 打开|Open \(Master\)/i,
      })
    )
    .or(
      page.getByRole("link", { name: /Master|以 Master 打开|Open \(Master\)/i })
    )
    .first();
  await masterAction.waitFor({ state: "visible", timeout: 10_000 });
  await masterAction.click();
}

function readBooleanEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  return value !== "false" && value !== "0";
}

async function assertAgentGuidanceDialog(page) {
  const dialog = page.getByRole("dialog").first();
  await dialog.waitFor({ state: "visible", timeout: 20_000 });
  const text = await dialog.textContent();
  if (
    !text.includes("Desktop Agent 未运行") &&
    !text.includes("Desktop Agent is not running") &&
    !text.includes("安装或更新 Desktop Agent") &&
    !text.includes("Install the latest agent") &&
    !text.includes("版本过旧") &&
    !text.includes("too old")
  ) {
    throw new Error(`Expected Desktop Agent guidance. Dialog text: ${text}`);
  }
  return text;
}

async function clickDesktopAgentUpdate(page) {
  const dialog = page.getByRole("dialog").first();
  const updateButton = dialog.getByRole("button", {
    name: /更新 Desktop Agent|Update Desktop Agent/i,
  });
  await updateButton.first().waitFor({ state: "visible", timeout: 20_000 });
  await updateButton.first().click();
}

async function downloadInstaller(page, downloadsDir) {
  const downloadPromise = page.waitForEvent("download", { timeout: 120_000 });
  const downloadAction = page
    .getByRole("link", { name: /Download Desktop Agent for Windows/i })
    .first();
  await ((await downloadAction.isVisible().catch(() => false))
    ? downloadAction.click()
    : page
        .getByRole("button", {
          name: /Download Desktop Agent for Windows/i,
        })
        .first()
        .click());

  const download = await downloadPromise;
  const targetPath = join(downloadsDir, download.suggestedFilename());
  await download.saveAs(targetPath);

  const fileStat = await stat(targetPath);
  if (fileStat.size < 50_000_000) {
    throw new Error(
      `Installer download is unexpectedly small: ${fileStat.size}`
    );
  }
  return targetPath;
}

async function runInstaller(installerPath) {
  const escapedInstallerPath = escapePowerShellSingleQuoted(installerPath);
  await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    [
      "$ErrorActionPreference = 'Stop'",
      `Unblock-File -LiteralPath '${escapedInstallerPath}' -ErrorAction SilentlyContinue`,
      `& '${escapedInstallerPath}'`,
    ].join("; "),
  ]);
}

async function waitForExpectedHealth(runState) {
  let health = null;
  await waitFor(
    async () => {
      health = await fetchJson(healthUrl, { runState });
      runState.lastObservedHealth = health;
      return health?.version === config.expectedAgentVersion;
    },
    () =>
      [
        `Desktop Agent did not report version ${config.expectedAgentVersion}.`,
        `Last observed health: ${JSON.stringify(runState.lastObservedHealth)}`,
      ].join(" ")
  );
  return health;
}

async function closeOrDismissDialog(page) {
  const dialog = page.getByRole("dialog").first();
  if (!(await dialog.isVisible().catch(() => false))) {
    return;
  }

  const closeButton = dialog
    .getByRole("button", {
      name: /关闭|完成|知道了|稍后|取消|Close|Done|OK|Cancel/i,
    })
    .first();
  await ((await closeButton.isVisible().catch(() => false))
    ? closeButton.click()
    : page.keyboard.press("Escape"));

  await dialog.waitFor({ state: "hidden", timeout: 10_000 }).catch(async () => {
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: 5000 });
  });
}

async function waitForOpenMasterSession(runState, options) {
  let openSession = null;
  await waitFor(
    async () => {
      openSession = await findOpenSession(runState, options);
      return true;
    },
    () =>
      [
        "Could not find an open observed Master session created by this run.",
        `Last observed sessions: ${JSON.stringify(runState.lastObservedSessions)}`,
      ].join(" ")
  );
  return openSession;
}

async function snapshotExistingSessionIds(runState) {
  const response = await fetchJson(sessionsUrl, { runState });
  const sessions = Array.isArray(response.sessions) ? response.sessions : [];
  runState.lastObservedSessions = sessions;
  return new Set(
    sessions
      .map((session) => session?.sessionId)
      .filter((sessionId) => typeof sessionId === "string" && sessionId.trim())
  );
}

async function findOpenSession(runState, options) {
  const response = await fetchJson(sessionsUrl, { runState });
  const sessions = Array.isArray(response.sessions) ? response.sessions : [];
  runState.lastObservedSessions = sessions;
  const candidates = sessions.filter((item) =>
    isExpectedOpenSession(item, options)
  );
  if (candidates.length === 0) {
    throw new Error(
      [
        "Could not find an open observed Master session created by this run.",
        `Sessions: ${JSON.stringify(sessions)}`,
      ].join(" ")
    );
  }
  return candidates.sort(compareSessionTimes).at(-1);
}

async function closeOpenedExcelWorkbook(openSession) {
  if (
    typeof openSession?.localPath !== "string" ||
    !openSession.localPath.trim()
  ) {
    throw new Error(
      `Open session is missing localPath, refusing to close by title. Session: ${JSON.stringify(
        openSession
      )}`
    );
  }

  const escapedLocalPath = escapePowerShellSingleQuoted(openSession.localPath);
  try {
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-Command",
      [
        "$ErrorActionPreference = 'Stop'",
        `$target = [System.IO.Path]::GetFullPath('${escapedLocalPath}')`,
        "$excel = $null",
        "$matched = $null",
        "try {",
        "  $excel = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')",
        "  foreach ($workbook in @($excel.Workbooks)) {",
        "    $fullName = [System.IO.Path]::GetFullPath($workbook.FullName)",
        "    if ([string]::Equals($fullName, $target, [System.StringComparison]::OrdinalIgnoreCase)) { $matched = $workbook; break }",
        "  }",
        '  if (-not $matched) { throw "Could not find Excel workbook for $target" }',
        "  $matched.Close($false)",
        "  Start-Sleep -Seconds 8",
        "} finally {",
        "  if ($matched) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($matched) | Out-Null }",
        "  if ($excel) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null }",
        "}",
      ].join("; "),
    ]);
    return { strategy: "COM_FULL_NAME", localPath: openSession.localPath };
  } catch (error) {
    if (openSession.contentState !== "UNCHANGED") {
      throw error;
    }
    return closeExcelWorkbookWindowByTitle(openSession, error);
  }
}

async function closeExcelWorkbookWindowByTitle(openSession, exactCloseError) {
  const leafName = basename(openSession.localPath);
  const escapedLeafName = escapePowerShellSingleQuoted(leafName);
  await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-Command",
    [
      "$ErrorActionPreference = 'Stop'",
      `$leaf = '${escapedLeafName}'`,
      "$matches = @(Get-Process EXCEL -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.Contains($leaf) })",
      'if ($matches.Count -eq 0) { throw "Could not find Excel window for $leaf" }',
      "foreach ($process in $matches) { [void]$process.CloseMainWindow() }",
      "Start-Sleep -Seconds 8",
      "$remaining = @(Get-Process EXCEL -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.Contains($leaf) })",
      'if ($remaining.Count -gt 0) { throw "Excel workbook window did not close for $leaf" }',
    ].join("; "),
  ]);
  return {
    strategy: "WINDOW_TITLE",
    localPath: openSession.localPath,
    exactCloseError:
      exactCloseError instanceof Error ? exactCloseError.message : null,
  };
}

async function stopDesktopAgent() {
  await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-Command",
    [
      "$ErrorActionPreference = 'Stop'",
      String.raw`$agentRoot = Join-Path $env:LOCALAPPDATA 'ProjectWing\DesktopAgent'`,
      String.raw`$agentRoot = [System.IO.Path]::GetFullPath($agentRoot).TrimEnd('\') + '\'`,
      "$agents = Get-Process -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -and [System.IO.Path]::GetFullPath($_.Path).StartsWith($agentRoot, [System.StringComparison]::OrdinalIgnoreCase) } catch { $false } }",
      "if ($agents) { $agents | Stop-Process -Force }",
      "Start-Sleep -Seconds 1",
    ].join("; "),
  ]);
}

async function screenshot(page, name) {
  await page.screenshot({
    path: join(config.outputDir, name),
    fullPage: true,
  });
}

async function writeFailureReport(error, runState) {
  const report = {
    ok: false,
    error: {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
    apiEvents: runState.apiEvents,
    screenshots: screenshotPaths(),
    finishedAt: new Date().toISOString(),
    lastObservedHealth: runState.lastObservedHealth,
    lastObservedSessions: redactSessionSecrets(runState.lastObservedSessions),
    failurePage: runState.failurePage,
  };
  await writeFile(
    join(config.outputDir, "desktop-agent-health-report.json"),
    JSON.stringify(report, null, 2),
    "utf-8"
  );
}

async function releasePreexistingTargetSessions(runState) {
  const health = await fetchJson(healthUrl, { runState }).catch(() => null);
  runState.lastObservedHealth = health;
  if (!health) {
    return;
  }

  const response = await fetchJson(sessionsUrl, { runState }).catch(() => null);
  const sessions = Array.isArray(response?.sessions) ? response.sessions : [];
  runState.lastObservedSessions = sessions;
  const targetSessions = sessions
    .filter(isReleasablePreexistingTargetSession)
    .sort(compareSessionTimes);

  for (const session of targetSessions) {
    if (session.contentState === "DIRTY") {
      throw new Error(
        [
          "Pre-existing target Master session is dirty.",
          "Check in or manually release it before running the real health check.",
          `Session: ${JSON.stringify(redactSessionSecret(session))}`,
        ].join(" ")
      );
    }
    if (session.contentState !== "UNCHANGED") {
      continue;
    }
    if (!session.lockSessionId) {
      throw new Error(
        `Pre-existing target Master session is missing lockSessionId: ${JSON.stringify(
          redactSessionSecret(session)
        )}`
      );
    }

    const releaseUrl = `${config.apiBaseUrl}/desktop/master-sessions/${encodeURIComponent(
      session.lockSessionId
    )}/release`;
    const released = await fetchJson(
      `${sessionsUrl}/${encodeURIComponent(session.sessionId)}/release`,
      {
        runState,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId, releaseUrl }),
      }
    );
    runState.preflightReleases.push({
      sessionId: session.sessionId,
      lockSessionId: session.lockSessionId,
      projectId: session.projectId,
      attachmentId: session.attachmentId,
      status: released?.session?.status,
      lifecycleState: released?.session?.lifecycleState,
      releasedAt: new Date().toISOString(),
    });
  }
}

function isReleasablePreexistingTargetSession(session) {
  if (!isTargetMasterSession(session)) {
    return false;
  }
  return session.lifecycleState === "OPEN";
}

function isTargetMasterSession(session) {
  if (session?.mode !== "MASTER") {
    return false;
  }
  if (session.projectId !== config.projectId) {
    return false;
  }
  if (
    config.targetAttachmentId &&
    session.attachmentId !== config.targetAttachmentId
  ) {
    return false;
  }

  const expectedFileHint = extractExpectedFileHint(config.masterButtonPattern);
  if (
    expectedFileHint &&
    typeof session.fileName === "string" &&
    !session.fileName.includes(expectedFileHint)
  ) {
    return false;
  }
  return true;
}

async function captureFailurePage(page, runState) {
  if (!page || page.isClosed()) {
    return;
  }
  const screenshotPath = join(config.outputDir, "failure-page.png");
  await page
    .screenshot({ path: screenshotPath, fullPage: true })
    .catch(() => {});
  runState.failurePage = {
    url: page.url(),
    screenshot: screenshotPath,
    text: await page
      .locator("body")
      .textContent({ timeout: 2000 })
      .then((text) => text.slice(0, 5000))
      .catch(() => null),
  };
}

async function waitForSessionReleased(sessionId, runState) {
  await waitFor(
    async () => {
      const response = await fetchJson(sessionsUrl, { runState });
      const sessions = Array.isArray(response.sessions)
        ? response.sessions
        : [];
      runState.lastObservedSessions = sessions;
      const session = sessions.find((item) => item?.sessionId === sessionId);
      return !session || session.lifecycleState !== "OPEN";
    },
    () =>
      [
        `Session ${sessionId} remained OPEN after closing Excel.`,
        `Last observed sessions: ${JSON.stringify(runState.lastObservedSessions)}`,
      ].join(" ")
  );
}

function screenshotPaths() {
  return screenshots.map((name) => join(config.outputDir, name));
}

async function fetchJson(url, options = {}) {
  const { runState, ...requestOptions } = options;
  const response = await fetch(url, requestOptions);
  recordNodeApiEvent(url, response.status, runState?.apiEvents);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

async function waitFor(predicate, message, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((_resolve) => {
      setTimeout(_resolve, 1000);
    });
  }

  const resolvedMessage = typeof message === "function" ? message() : message;
  if (lastError) {
    throw new Error(`${resolvedMessage} Last error: ${lastError.message}`);
  }
  throw new Error(resolvedMessage);
}

async function waitForMasterButtonVisible(page) {
  await page
    .getByRole("button", {
      name: new RegExp(escapeRegExp(config.masterButtonPattern)),
    })
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
}

function isExpectedOpenSession(session, options) {
  if (session?.mode !== "MASTER") {
    return false;
  }
  if (options?.existingSessionIds?.has(session.sessionId)) {
    return false;
  }
  if (session.lifecycleState !== "OPEN") {
    return false;
  }
  if (!session.openObservedAt && !session.openObservedSource) {
    return false;
  }
  if (typeof session.fileName !== "string" || !session.fileName.trim()) {
    return false;
  }
  if (typeof session.localPath !== "string" || !session.localPath.trim()) {
    return false;
  }
  if (session.projectId && session.projectId !== config.projectId) {
    return false;
  }

  if (
    options?.openedAfter &&
    !sessionWasOpenedAfter(session, options.openedAfter)
  ) {
    return false;
  }

  const expectedFileHint = extractExpectedFileHint(config.masterButtonPattern);
  if (expectedFileHint && !session.fileName.includes(expectedFileHint)) {
    return false;
  }

  return true;
}

function sessionWasOpenedAfter(session, openedAfter) {
  const threshold = openedAfter.getTime();
  const openedAt = Date.parse(session.openedAt);
  if (Number.isFinite(openedAt)) {
    return openedAt >= threshold;
  }

  const openObservedAt = Date.parse(session.openObservedAt);
  return Number.isFinite(openObservedAt) && openObservedAt >= threshold;
}

function compareSessionTimes(left, right) {
  return getSessionSortTime(left) - getSessionSortTime(right);
}

function getSessionSortTime(session) {
  const timestamps = [session.openObservedAt, session.openedAt]
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));
  return timestamps.length > 0 ? Math.max(...timestamps) : 0;
}

function extractExpectedFileHint(pattern) {
  const marker = "以 Master 打开 ";
  return pattern.startsWith(marker) ? pattern.slice(marker.length).trim() : "";
}

function escapeRegExp(value) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function escapePowerShellSingleQuoted(value) {
  return value.replaceAll("'", "''");
}

function redactSessionSecret(session) {
  if (!session || typeof session !== "object") {
    return session;
  }
  return { ...session, grantSecret: session.grantSecret ? "[redacted]" : null };
}

function redactSessionSecrets(sessions) {
  return Array.isArray(sessions) ? sessions.map(redactSessionSecret) : sessions;
}

function recordNodeApiEvent(url, status, apiEvents) {
  if (!apiEvents) {
    return;
  }
  if (
    url.includes("/master/open") ||
    url.includes("/desktop/master-sessions/") ||
    url.includes("127.0.0.1:17862/open") ||
    url.includes("127.0.0.1:17862/sessions") ||
    url.includes("127.0.0.1:17862/health")
  ) {
    apiEvents.push({
      url,
      status,
      receivedAt: new Date().toISOString(),
      source: "node-fetch",
    });
  }
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
