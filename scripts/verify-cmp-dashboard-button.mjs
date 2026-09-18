import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import nodePath from "node:path";

import { chromium } from "playwright-core";

const { resolve } = nodePath;

const baseUrl = process.env.PROJECTWING_CMP_URL ?? "http://localhost:3002";
const outputDir = resolve("output/playwright/design-first");
const chromeCandidates = [
  process.env.PROJECTWING_CMP_CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);
const currentUser = {
  id: "design-first-super-admin",
  email: "design-first@example.com",
  name: "DesignFirst Reviewer",
  globalRole: "SUPER_ADMIN",
};
const dashboardSummary = {
  draftsAssignedToMe: 0,
  approvalsAssignedToMe: 0,
  returnedRequests: 0,
  myClients: 0,
  myEngagements: 0,
  recentChanges: [],
  recentApprovals: [],
};

async function findBrowser() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next locally installed browser.
    }
  }
}

async function verifyViewport(browser, viewport, screenshotName, activation) {
  const context = await browser.newContext({ locale: "en-US", viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const observedRequests = [];
  let dashboardRequests = 0;

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("request", (request) => {
    if (/account\/me|cmp\/dashboard/.test(request.url())) {
      observedRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.addInitScript(() => {
    window.sessionStorage.setItem("project-wing-cmp-login-admission", "1");
  });
  const corsHeaders = {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-origin": baseUrl,
  };
  await page.route("**/account/me", (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: corsHeaders });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify(currentUser),
    });
  });
  await page.route("**/cmp/dashboard", (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: corsHeaders });
    }
    dashboardRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify(dashboardRequests === 1 ? null : dashboardSummary),
    });
  });

  try {
    await page.goto(`${baseUrl}/en-US/dashboard`, {
      waitUntil: "networkidle",
    });

    const retry = page.getByRole("button", { name: /retry/i });
    try {
      await retry.waitFor();
    } catch (error) {
      const bodyContent = await page.locator("body").textContent();
      const bodyText = bodyContent.slice(0, 1200);
      const pageHtml = await page.content();
      const html = pageHtml.slice(0, 1200);
      throw new Error(
        `Retry action did not render at ${page.url()}. Body: ${bodyText}. HTML: ${html}. Requests: ${observedRequests.join(" | ")}. Console: ${consoleErrors.join(" | ")}`,
        { cause: error }
      );
    }
    assert.equal(await retry.getAttribute("data-variant"), "primary");
    assert.equal(await retry.getAttribute("data-size"), "lg");
    assert.equal(await retry.getAttribute("data-full-width"), "true");

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    assert.equal(overflow, false, "dashboard recovery state must not overflow");

    await page.screenshot({
      fullPage: true,
      path: resolve(outputDir, screenshotName),
    });

    if (activation === "keyboard") {
      await retry.focus();
      await retry.press("Space");
    } else {
      await retry.click();
    }

    await page
      .getByRole("heading", { name: "Client Management Platform" })
      .waitFor();
    assert.equal(dashboardRequests, 2);
    assert.deepEqual(consoleErrors, []);
  } finally {
    await context.close();
  }
}

await mkdir(outputDir, { recursive: true });
const executablePath = await findBrowser();
const browser = await chromium.launch({ executablePath, headless: true });

try {
  await verifyViewport(
    browser,
    { width: 1440, height: 1000 },
    "cmp-dashboard-button-wide.png",
    "pointer"
  );
  await verifyViewport(
    browser,
    { width: 390, height: 844 },
    "cmp-dashboard-button-narrow.png",
    "keyboard"
  );
  console.log("CMP dashboard Button verification passed at 1440px and 390px.");
} finally {
  await browser.close();
}
