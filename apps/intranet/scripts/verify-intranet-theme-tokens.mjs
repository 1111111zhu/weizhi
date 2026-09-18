import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import nodePath from "node:path";

import { chromium } from "playwright-core";

const { resolve } = nodePath;

const baseUrl = process.env.PROJECTWING_INTRANET_URL ?? "http://127.0.0.1:3010";
const outputDir = resolve("output/playwright/design-first");
const browserCandidates = [
  process.env.PROJECTWING_INTRANET_CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

async function findBrowser() {
  for (const candidate of browserCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next locally installed browser.
    }
  }
}

async function verifyAppearance(browser, flavor, viewport) {
  const context = await browser.newContext({ locale: "zh-CN", viewport });
  await context.addCookies([
    {
      name: "project-wing-theme-flavor",
      value: flavor,
      url: baseUrl,
    },
  ]);
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`
    );
  });
  await page.route(/\/account\/me/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "null",
    })
  );
  await page.route(/\/auth\/development\/accounts/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accounts: [] }),
    })
  );

  try {
    await page.goto(`${baseUrl}/zh-CN/login`, { waitUntil: "networkidle" });
    await page.locator("body").waitFor();

    const result = await page.evaluate(() => {
      const root = document.documentElement;
      const probe = document.createElement("div");
      probe.style.position = "fixed";
      probe.style.visibility = "hidden";
      document.body.append(probe);

      const resolveColor = (token) => {
        probe.style.backgroundColor = `var(${token})`;
        return getComputedStyle(probe).backgroundColor;
      };
      const pairs = [
        ["--background", "--project-wing-intranet-background"],
        ["--foreground", "--project-wing-intranet-foreground"],
        ["--card", "--project-wing-intranet-surface"],
        ["--primary", "--project-wing-intranet-primary"],
        ["--secondary", "--project-wing-intranet-secondary"],
        ["--muted", "--project-wing-intranet-muted"],
        ["--accent", "--project-wing-intranet-accent"],
        ["--border", "--project-wing-intranet-border"],
        ["--ring", "--project-wing-intranet-ring"],
      ];
      const colors = pairs.map(([semantic, publicToken]) => ({
        publicColor: resolveColor(publicToken),
        semantic,
        semanticColor: resolveColor(semantic),
      }));
      probe.remove();

      return {
        colors,
        dark: root.classList.contains("dark"),
        overflow:
          root.scrollWidth > root.clientWidth ||
          document.body.scrollWidth > document.body.clientWidth,
      };
    });

    assert.equal(result.dark, flavor === "mocha");
    assert.equal(result.overflow, false, "login page must not overflow");
    for (const color of result.colors) {
      assert.notEqual(color.semanticColor, "rgba(0, 0, 0, 0)");
      assert.equal(
        color.semanticColor,
        color.publicColor,
        `${color.semantic} must resolve through its public Intranet token`
      );
    }
    assert.deepEqual(
      consoleErrors,
      [],
      `browser console must remain clean; failed requests: ${failedRequests.join(", ")}`
    );
    assert.deepEqual(failedRequests, [], "browser requests must remain clean");

    await page.screenshot({
      path: resolve(
        outputDir,
        `intranet-public-theme-${flavor}-${viewport.width}.png`
      ),
      fullPage: true,
    });
  } finally {
    await context.close();
  }
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findBrowser();
const browser = await chromium.launch({ executablePath, headless: true });

try {
  await verifyAppearance(browser, "latte", { width: 1440, height: 1000 });
  await verifyAppearance(browser, "mocha", { width: 1440, height: 1000 });
  await verifyAppearance(browser, "latte", { width: 390, height: 844 });
} finally {
  await browser.close();
}

console.log("Intranet public theme token verification passed.");
