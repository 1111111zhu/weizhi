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
  id: "button-regression-manager",
  email: "button-regression-manager@example.com",
  name: "Button Regression Manager",
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

async function assertInlineHeader(button, label) {
  const geometry = await button.evaluate((element) => {
    const content = element.querySelector(".pw-button-label");
    const title = content?.querySelector("span");
    const icon = content?.querySelector("svg");
    if (!(content && title && icon)) {
      return null;
    }
    const titleBox = title.getBoundingClientRect();
    const iconBox = icon.getBoundingClientRect();
    return {
      display: getComputedStyle(content).display,
      iconCenter: iconBox.top + iconBox.height / 2,
      titleCenter: titleBox.top + titleBox.height / 2,
    };
  });

  assert.ok(geometry, `${label} must contain a title and sort icon`);
  assert.ok(
    ["flex", "inline-flex"].includes(geometry.display),
    `${label} content layout must be flex`
  );
  assert.ok(
    Math.abs(geometry.iconCenter - geometry.titleCenter) <= 2,
    `${label} title and sort icon must share one row`
  );
}

async function verifyViewport(browser, viewport, screenshotName, headerName) {
  const context = await browser.newContext({ locale: "en-US", viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const unexpectedRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
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
          body: JSON.stringify({ message: "Unmocked regression request" }),
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

    const header = page.getByRole("columnheader", { name: headerName });
    const button = header.getByRole("button");
    await button.waitFor();
    await assertInlineHeader(button, `${headerName} unsorted header`);

    await button.click();
    await assertInlineHeader(button, `${headerName} sorted header`);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    assert.equal(overflow, false, "Client grid must not overflow the page");
    assert.deepEqual(unexpectedRequests, []);
    assert.deepEqual(consoleErrors, []);

    await page.screenshot({
      fullPage: true,
      path: resolve(outputDir, screenshotName),
    });
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
    "cmp-data-grid-headers-wide.png",
    "Client Code"
  );
  await verifyViewport(
    browser,
    { width: 390, height: 844 },
    "cmp-data-grid-headers-narrow.png",
    "Client"
  );
  console.log("CMP data-grid headers stay inline at 1440px and 390px.");
} finally {
  await browser.close();
}
