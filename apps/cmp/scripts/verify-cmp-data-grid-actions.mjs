import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";

const { resolve } = path;

const baseUrl = process.env.PROJECTWING_CMP_URL ?? "http://localhost:3002";
const outputDir = resolve("output/playwright/design-first");
const chromeCandidates = [
  process.env.PROJECTWING_CMP_CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);
const currentUser = {
  id: "design-first-manager",
  email: "design-first-manager@example.com",
  name: "DesignFirst Manager",
  globalRole: "MANAGER",
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

function responseBody(pathname) {
  if (pathname === "/account/me") {
    return currentUser;
  }
  if (pathname === "/auth/development/accounts") {
    return { accounts: [] };
  }
  if (pathname === "/cmp/client-groups") {
    return { groups: [] };
  }
  if (pathname === "/cmp/clients") {
    return { clients: [] };
  }
  if (pathname === "/cmp/users") {
    return [];
  }
  if (pathname === "/cmp/inbox/messages") {
    return [];
  }
}

async function assertTmsToolbarButton(button, label) {
  assert.equal(await button.getAttribute("data-variant"), "secondary", label);
  assert.equal(await button.getAttribute("data-size"), "icon", label);
  assert.equal(await button.getAttribute("data-legacy-variant"), null, label);
  assert.equal(await button.getAttribute("data-legacy-size"), null, label);
  const text = await button.textContent();
  assert.equal(text.trim(), "", label);
}

async function verifyViewport(browser, viewport, screenshotName, activation) {
  const context = await browser.newContext({ locale: "en-US", viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  const unexpectedRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.method()} ${request.url()} (${request.failure()?.errorText ?? "unknown"})`
    );
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
  await page.route(
    /\/account\/|\/auth\/development\/accounts|\/cmp\//,
    (route) => {
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: corsHeaders });
      }
      const { pathname } = new URL(route.request().url());
      const body = responseBody(pathname);
      if (body === undefined) {
        unexpectedRequests.push(`${route.request().method()} ${pathname}`);
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          headers: corsHeaders,
          body: JSON.stringify({ message: "Unmocked governance request" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify(body),
      });
    }
  );

  try {
    await page.goto(`${baseUrl}/en-US/client`, { waitUntil: "networkidle" });

    const columns = page.getByRole("button", { name: "Columns" });
    const create = page.getByRole("button", { name: "New" });
    await columns.waitFor();
    await create.waitFor();
    await assertTmsToolbarButton(columns, "Columns must match TMS toolbar");
    await assertTmsToolbarButton(create, "New must match TMS toolbar");

    if (activation === "keyboard") {
      await columns.focus();
      await columns.press("Enter");
    } else {
      await columns.click();
    }
    await page.getByRole("menu", { name: "Columns" }).waitFor();
    await page.waitForTimeout(300);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    assert.equal(
      overflow,
      false,
      "Client data grid must not overflow the page"
    );

    await page.screenshot({
      fullPage: true,
      path: resolve(outputDir, screenshotName),
    });
    await page.keyboard.press("Escape");

    if (activation === "keyboard") {
      await create.focus();
      await create.press("Space");
    } else {
      await create.click();
    }
    await page.waitForURL(/\/en-US\/client\/new$/);

    assert.deepEqual(unexpectedRequests, []);
    assert.deepEqual(
      consoleErrors,
      [],
      `Failed requests: ${failedRequests.join(" | ")}`
    );
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
    "cmp-data-grid-actions-wide.png",
    "pointer"
  );
  await verifyViewport(
    browser,
    { width: 390, height: 844 },
    "cmp-data-grid-actions-narrow.png",
    "keyboard"
  );
  console.log("CMP data-grid Button verification passed at 1440px and 390px.");
} finally {
  await browser.close();
}
