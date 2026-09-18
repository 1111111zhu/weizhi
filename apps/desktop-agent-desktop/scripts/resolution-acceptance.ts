import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

// Isolated interactive fixture: actual renderer, preload, IPC and .NET Runtime.
// No installed Agent, user files, Office, production auth or production network.
import { app, BrowserWindow } from "electron";

import { configureDesktopAgentIpc } from "../src/main/desktop-agent-ipc";
import { DesktopAgentRuntimeClient } from "../src/main/runtime-client";
import { getTrayWindowPlatformOptions } from "../src/main/tray-flyout-visibility";
import { configureTrayWindowEvents } from "../src/main/tray-window-events";

async function start() {
  const workspace = process.cwd();
  const root = mkdtempSync(path.join(tmpdir(), "wing-resolution-acceptance-"));
  const stateRoot = path.join(root, "state");
  const cacheRoot = path.join(root, "cache");
  mkdirSync(stateRoot);
  mkdirSync(cacheRoot);
  app.setPath("userData", path.join(root, "profile"));
  let fail = true;
  const remote = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/fixture/quit") {
      res.end("{}");
      setTimeout(() => app.quit(), 0);
      return;
    }
    if (req.url === "/auth/device/token")
      res.end(
        JSON.stringify({ access_token: "synthetic-token", expires_in: 3600 })
      );
    else if (req.url === "/auth/get-session")
      res.end(
        JSON.stringify({
          user: {
            id: "fixture",
            name: "隔离验证",
            email: "fixture@example.invalid",
          },
        })
      );
    else if (req.url === "/end-tracking") {
      res.statusCode = fail ? 503 : 200;
      res.end(
        JSON.stringify({
          ok: !fail,
          recoveryEnded: !fail,
          code: "RELEASE_FAILED",
          message: "Synthetic offline service; retry later.",
        })
      );
    } else {
      res.statusCode = 404;
      res.end("{}");
    }
  });
  const listen = (server: ReturnType<typeof createServer>) =>
    new Promise<number>((resolve) =>
      server.listen(0, "127.0.0.1", () =>
        resolve((server.address() as { port: number }).port)
      )
    );
  const remotePort = await listen(remote);
  const reservation = createServer();
  const nativePort = await listen(reservation);
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const remoteOrigin = `http://127.0.0.1:${remotePort}`;
  const nativeOrigin = `http://127.0.0.1:${nativePort}`;
  const rows = ["missing", "readonly", "lease"].map((id, index) => {
    const localPath = path.join(cacheRoot, `${id}.txt`);
    if (id === "lease")
      writeFileSync(localPath, "synthetic unsynchronized edits");
    return {
      sessionId: id,
      generation: 1,
      mode: id === "readonly" ? "READ_ONLY" : "MASTER",
      projectId: "fixture",
      attachmentId: id,
      fileName: [
        "测试底稿 · 缓存缺失.docx",
        "测试只读文件.pdf",
        "测试底稿 · 会话过期.xlsx",
      ][index],
      localPath,
      originalHash: "a".repeat(64),
      lastKnownHash: "b".repeat(64),
      status: id === "lease" ? "LEASE_LOST" : "LOCAL_FILE_MISSING",
      lifecycleState: id === "lease" ? "LEASE_LOST" : "LOCAL_FILE_MISSING",
      contentState: "DIRTY",
      openedAt: new Date().toISOString(),
      launchStartedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      checkInUrl: `${remoteOrigin}/check-in`,
      releaseUrl: `${remoteOrigin}/release`,
      grantSecret: "synthetic-only",
      lockSessionId: id,
      lockEpoch: 1,
    };
  });
  writeFileSync(path.join(stateRoot, "sessions.json"), JSON.stringify(rows));
  const cachedFiles = ["年度报表.xlsx", "项目说明.pdf"].map((name, index) => {
    const filePath = path.join(cacheRoot, name);
    const bytes = Buffer.alloc((index + 1) * 1024 * 128, index);
    writeFileSync(filePath, bytes);
    return {
      path: filePath,
      kind: index === 0 ? "CONTENT" : "READ_ONLY",
      size: bytes.length,
      lastAccessAt: new Date().toISOString(),
      expiresAt: "2099-01-01T00:00:00Z",
    };
  });
  writeFileSync(
    path.join(stateRoot, "cache-index.json"),
    JSON.stringify(cachedFiles)
  );
  const worker = spawn(
    "dotnet",
    [
      path.join(
        workspace,
        "apps/desktop-agent/runtime/ProjectWing.DesktopAgent.Runtime/bin/Debug/net8.0/ProjectWing.DesktopAgent.Runtime.dll"
      ),
    ],
    {
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        ASPNETCORE_URLS: nativeOrigin,
        PROJECT_WING_AGENT_BASE_URL: nativeOrigin,
        PROJECT_WING_AGENT_STATE_ROOT: stateRoot,
        PROJECT_WING_AGENT_CACHE_ROOT: cacheRoot,
        PROJECT_WING_AGENT_DISABLE_FILE_LAUNCH: "true",
        PROJECT_WING_AGENT_ALLOWED_AUTH_ORIGINS: remoteOrigin,
        PROJECT_WING_AGENT_ALLOWED_DOWNLOAD_ORIGINS: remoteOrigin,
        PROJECT_WING_AGENT_API_BASE_URL: remoteOrigin,
      },
    }
  );
  await app.whenReady();
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(`${nativeOrigin}/health`)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await fetch(`${nativeOrigin}/auth/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: "project-wing-desktop-agent",
      deviceCode: "synthetic",
      authBaseUrl: remoteOrigin,
      expiresInSeconds: 300,
      intervalSeconds: 1,
    }),
  });
  // A manager-health envelope is fixture-only; the file operations below are
  // forwarded to the actual isolated Runtime, with its real device pairing.
  const proxy = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const response = await fetch(`${nativeOrigin}${req.url}`, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      ...(req.method === "POST" ? { body: Buffer.concat(chunks) } : {}),
    });
    const payload = await response.json();
    if (req.url === "/health")
      Object.assign(payload, {
        managerInstanceId: "isolated-fixture",
        stateRoot,
      });
    res.writeHead(response.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
  });
  const proxyPort = await listen(proxy);
  const runtime = new DesktopAgentRuntimeClient(
    remoteOrigin,
    `http://127.0.0.1:${proxyPort}`
  );
  let quitting = false;
  app.on("before-quit", () => {
    quitting = true;
  });
  const window = new BrowserWindow({
    width: 900,
    height: 680,
    ...getTrayWindowPlatformOptions(process.platform),
    autoHideMenuBar: true,
    maximizable: false,
    resizable: false,
    show: true,
    title: "Desktop Agent · ISOLATED QA",
    webPreferences: {
      preload: path.join(
        workspace,
        "apps/desktop-agent-desktop/out/preload/index.js"
      ),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  configureTrayWindowEvents(window, {
    onClose: () => window.hide(),
    onReady: () => {},
    shouldClose: () => quitting,
  });
  configureDesktopAgentIpc({
    runtime,
    showWindow: () => {
      window.restore();
      window.show();
    },
    refreshTray: async () => {},
    updateController: {
      check: async () => null,
      download: async () => null,
      apply: async () => false,
    } as never,
  });
  await window.loadFile(
    path.join(workspace, "apps/desktop-agent-desktop/out/renderer/index.html")
  );
  window.setTitle("Desktop Agent · ISOLATED QA");
  window.show();
  window.focus();
  const evidence = path.join(workspace, "output/resolution-acceptance");
  mkdirSync(evidence, { recursive: true });
  const record = () =>
    writeFileSync(
      path.join(evidence, "window-state.json"),
      JSON.stringify({
        root,
        nativeOrigin,
        remoteOrigin,
        windowId: window.id,
        processId: process.pid,
        visible: window.isVisible(),
        minimized: window.isMinimized(),
        bounds: window.getBounds(),
      })
    );
  for (const event of ["move", "minimize", "restore", "blur", "focus"] as const)
    window.on(event, record);
  record();
  setInterval(async () => {
    if (!window.isVisible() || window.isDestroyed()) return;
    try {
      const label = await window.webContents.executeJavaScript(
        `document.querySelector('[data-slot="settings-scroll-content"]')?.getAttribute('aria-label') ?? 'window'`
      );
      const key = String(label).startsWith("异常")
        ? "issues"
        : label === "缓存"
          ? "cache"
          : label === "设置"
            ? "settings"
            : "current";
      writeFileSync(
        path.join(evidence, `${key}.png`),
        (await window.capturePage()).toPNG()
      );
    } catch {
      /* A minimized or newly swapped renderer can briefly lack a surface. */
    }
  }, 3000);
  setTimeout(async () => {
    writeFileSync(
      path.join(evidence, "layout.json"),
      JSON.stringify(
        await window.webContents.executeJavaScript(
          `(() => { const h = document.querySelector('header'); const c = document.querySelector('#root > div'); return { header: h?.getBoundingClientRect().toJSON(), background: c ? getComputedStyle(c).backgroundColor : null, viewport: [innerWidth, innerHeight], content: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] }; })()`
        )
      )
    );
    writeFileSync(
      path.join(evidence, "initial.png"),
      (await window.capturePage()).toPNG()
    );
  }, 5000);
  // Timed fixture server recovery exercises failure followed by retry; no external service changes.
  setTimeout(() => {
    fail = false;
  }, 120_000);
  app.on("will-quit", () => {
    worker.kill();
    remote.close();
    proxy.close();
  });
  // Keep this explicit test session bounded. Does not terminate any other process.
  setTimeout(() => app.quit(), 600_000);
}
void start().catch((error) => {
  console.error(error);
  app.quit();
});
