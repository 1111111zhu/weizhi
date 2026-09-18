// Isolated Electron smoke fixture. Never connects to an installed Agent or
// performs registration, updates, file launches, or user-cache operations.
const { app, BrowserWindow } = require("electron");
const { mkdtempSync, mkdirSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { setTimeout: delay } = require("node:timers/promises");

const root = mkdtempSync(
  path.join(os.tmpdir(), "project-wing-launch-fixture-")
);
const profile = path.join(root, "profile");
mkdirSync(profile);
app.setName("Project Wing Launch Fixture");
// Deterministic fixture rendering on hosts without a usable GPU capture context.
// This is not a production application setting.
app.disableHardwareAcceleration();
app.setPath("userData", profile);
app.setPath("sessionData", profile);
app.setPath("appData", root);
process.env.LOCALAPPDATA = root;
process.env.PROJECT_WING_AGENT_STATE_ROOT = path.join(root, "state");
process.env.PROJECT_WING_AGENT_CACHE_ROOT = path.join(root, "cache");
process.env.PROJECT_WING_AGENT_DISABLE_FILE_LAUNCH = "true";
delete process.env.PROJECT_WING_AGENT_MANAGER_PATH;
delete process.env.PROJECT_WING_AGENT_RUNTIME_PATH;
delete process.env.PROJECT_WING_AGENT_APP_DIRECTORY;
delete process.env.ELECTRON_RENDERER_URL;
const sessionsFixture = process.argv.includes("--sessions-fixture");
const fixtureSessions = Array.from({ length: 6 }, (_, index) => ({
  sessionId: `fixture-${index}`,
  fileName: `fixture-${index}.xlsx`,
  projectId: "fixture-project",
  mode: index === 3 ? "READ_ONLY" : "MASTER",
  status: index < 4 ? "LOCAL_FILE_MISSING" : "LEASE_LOST",
  lifecycleState: index < 4 ? "LOCAL_FILE_MISSING" : "LEASE_LOST",
  ...(index === 3
    ? {}
    : {
        checkInUrl: "https://example.test/check-in",
        releaseUrl: "https://example.test/release",
      }),
}));
globalThis.fetch = (input, options) => {
  if (sessionsFixture && options?.method !== "POST") {
    const url = String(input);
    const payload = url.endsWith("/health")
      ? {
          ok: true,
          app: "project-wing-desktop-runtime",
          version: app.getVersion(),
          agentState: "READY_WITH_ATTENTION",
          attentionCount: 6,
        }
      : url.endsWith("/auth/status")
        ? {
            ok: true,
            authenticated: true,
            user: {
              id: "fixture-user",
              name: "Fixture User",
              email: "fixture@example.test",
            },
          }
        : url.endsWith("/sessions")
          ? { ok: true, sessions: fixtureSessions }
          : null;
    if (payload) {
      return Promise.resolve(Response.json(payload));
    }
  }
  return Promise.reject(
    new TypeError("Isolated fixture: no local or remote service access", {
      cause: { code: "ECONNREFUSED" },
    })
  );
};
const background = process.argv.includes("--background");
const expectedVisible = !background;
const containsAllSessions = (text) =>
  fixtureSessions.every((s) => text.includes(s.fileName));
const timeout = setTimeout(() => {
  console.error("FAIL: no rendered fixture window", root);
  app.exit(1);
}, 20_000);
app.on("browser-window-created", (_event, window) => {
  window.once("ready-to-show", () => {
    setTimeout(async () => {
      try {
        const visible = window.isVisible() && window.getOpacity() > 0;
        const result = {
          background,
          expectedVisible,
          visible,
          windows: BrowserWindow.getAllWindows().length,
          root,
        };
        if (sessionsFixture) {
          let renderedText = "";
          const deadline = Date.now() + 5000;
          while (Date.now() < deadline) {
            renderedText = await window.webContents.executeJavaScript(
              "document.body.innerText"
            );
            if (containsAllSessions(renderedText)) {
              break;
            }
            await delay(100);
          }
          writeFileSync(path.join(root, "rendered-text.txt"), renderedText);
          if (!containsAllSessions(renderedText)) {
            throw new Error("Mixed session list was not fully rendered");
          }
          if (
            renderedText.includes("Last-known files") ||
            renderedText.includes(
              "Current local service state could not be confirmed"
            )
          ) {
            throw new Error(
              "Valid read-only record incorrectly made the snapshot stale"
            );
          }
          result.sessionsVisible = fixtureSessions.length;
          await delay(500);
        }
        writeFileSync(
          path.join(root, "result.json"),
          JSON.stringify(result, null, 2)
        );
        const capture = await window.webContents.capturePage();
        writeFileSync(path.join(root, "window.png"), capture.toPNG());
        console.log(JSON.stringify(result));
        clearTimeout(timeout);
        // Native Computer Use captures the actual window during --keep-open.
        // Avoid conflating Chromium capturePage/GPU failures with visibility.
        setTimeout(
          () => app.exit(visible === expectedVisible ? 0 : 1),
          process.argv.includes("--keep-open") ? 120_000 : 0
        );
      } catch (error) {
        console.error(error);
        app.exit(1);
      }
    }, 50);
  });
});
import(pathToFileURL(path.join(__dirname, "../out/main/index.js")).href).catch(
  (error) => {
    console.error(error);
    app.exit(1);
  }
);
