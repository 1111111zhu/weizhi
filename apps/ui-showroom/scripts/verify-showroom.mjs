import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";

const baseUrl = (
  process.env.PROJECTWING_SHOWROOM_URL ?? "http://localhost:3008"
).replace(/\/$/, "");
const outputDir = path.resolve("output/playwright/design-first");
const chromeCandidates = [
  process.env.PROJECTWING_SHOWROOM_CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

async function findBrowser() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next locally installed browser.
    }
  }
  throw new Error(
    "No Chrome-compatible browser found. Set PROJECTWING_SHOWROOM_CHROME_PATH."
  );
}

async function assertNoOverflow(page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
  );
  assert.equal(overflow, false, "Showroom must not overflow its viewport");
}

async function assertButtonContract(specimen) {
  await specimen
    .getByRole("heading", { name: "Button", exact: true })
    .waitFor();

  for (const variant of [
    "primary",
    "secondary",
    "outline",
    "quiet",
    "danger",
  ]) {
    const button = specimen.getByRole("button", {
      name: variant,
      exact: true,
    });
    await button.waitFor();
    assert.equal(await button.getAttribute("data-variant"), variant);
  }

  for (const size of ["xs", "sm", "md", "lg"]) {
    const button = specimen.getByRole("button", { name: size, exact: true });
    await button.waitFor();
    assert.equal(await button.getAttribute("data-size"), size);
  }

  const disabled = specimen.getByRole("button", {
    name: "Disabled",
    exact: true,
  });
  assert.equal(await disabled.isDisabled(), true);

  const iconButton = specimen.getByRole("button", {
    name: "Add",
    exact: true,
  });
  assert.equal(await iconButton.getAttribute("aria-label"), "Add");
  assert.equal(await iconButton.getAttribute("data-size"), "icon");
  assert.equal(await iconButton.getAttribute("data-variant"), "quiet");
  const iconButtonText = await iconButton.textContent();
  assert.equal(iconButtonText.trim(), "");
}

function captureDiagnostics(page) {
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (isCancelledRscPrefetch(request)) {
      return;
    }
    failedRequests.push(
      `${request.method()} ${request.url()} (${request.failure()?.errorText ?? "unknown"})`
    );
  });
  return { consoleErrors, failedRequests };
}

function isCancelledRscPrefetch(request) {
  return (
    request.method() === "GET" &&
    request.url().includes("_rsc=") &&
    request.failure()?.errorText === "net::ERR_ABORTED"
  );
}

async function openButtonSpecimen(page) {
  await page.goto(`${baseUrl}/components/Button`, {
    waitUntil: "networkidle",
  });
  await page.locator("h1").filter({ hasText: "Button" }).waitFor();
  const frameSelector = 'iframe[title="Button isolated component preview"]';
  await page.locator(frameSelector).waitFor();
  const specimen = page.frameLocator(frameSelector);
  await assertButtonContract(specimen);
  await assertNoOverflow(page);
  return specimen;
}

async function activateLoading({ activation, page, specimen }) {
  const loading = specimen.getByRole("button", {
    name: "Loading",
    exact: true,
  });
  if (activation === "keyboard") {
    await loading.focus();
    await loading.press("Space");
  } else {
    await loading.click();
  }
  await page.waitForFunction(
    () =>
      document
        .querySelector('iframe[title="Button isolated component preview"]')
        ?.contentDocument?.querySelector('button[data-loading="true"]')
        ?.textContent?.includes("Saving"),
    undefined,
    { timeout: 2000 }
  );
  const saving = specimen.locator('button[data-loading="true"]');
  assert.equal(await saving.getAttribute("aria-busy"), "true");
  const savingText = await saving.textContent();
  assert.equal(savingText.trim(), "Saving");
  await page.waitForFunction(
    () =>
      !document
        .querySelector('iframe[title="Button isolated component preview"]')
        ?.contentDocument?.querySelector('button[data-loading="true"]'),
    undefined,
    { timeout: 2000 }
  );
}

async function verifyIconButtonFocus(specimen) {
  const iconButton = specimen.getByRole("button", {
    name: "Add",
    exact: true,
  });
  await iconButton.focus();
  await iconButton.press("Enter");
  assert.equal(
    await iconButton.evaluate((element) => document.activeElement === element),
    true
  );
}

function assertDiagnostics(diagnostics, viewport) {
  assert.deepEqual(
    diagnostics.consoleErrors,
    [],
    `Showroom console errors at ${viewport.width}px: ${diagnostics.consoleErrors.join(" | ")}`
  );
  assert.deepEqual(
    diagnostics.failedRequests,
    [],
    `Showroom request failures at ${viewport.width}px: ${diagnostics.failedRequests.join(" | ")}`
  );
}

async function verifyViewport({
  activation,
  browser,
  screenshotName,
  viewport,
}) {
  const context = await browser.newContext({ locale: "en-US", viewport });
  const page = await context.newPage();
  const diagnostics = captureDiagnostics(page);

  try {
    const specimen = await openButtonSpecimen(page);
    await page.screenshot({
      fullPage: true,
      path: resolve(outputDir, screenshotName),
    });
    await activateLoading({ activation, page, specimen });
    await verifyIconButtonFocus(specimen);
    assertDiagnostics(diagnostics, viewport);
  } finally {
    await context.close();
  }
}

async function verifyMobileNavigation(browser) {
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ locale: "en-US", viewport });
  const page = await context.newPage();
  const diagnostics = captureDiagnostics(page);

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    const trigger = page.getByRole("button", { name: /Toggle Menu/ });
    await trigger.click();
    await page.locator('[data-slot="popover-content"]').waitFor();
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    await page.screenshot({
      fullPage: true,
      path: resolve(outputDir, "showroom-mobile-navigation.png"),
    });
    await assertNoOverflow(page);
    assertDiagnostics(diagnostics, viewport);
  } finally {
    await context.close();
  }
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: await findBrowser(),
  headless: true,
});

try {
  await verifyViewport({
    activation: "pointer",
    browser,
    screenshotName: "showroom-button-wide.png",
    viewport: { width: 1440, height: 1000 },
  });
  await verifyViewport({
    activation: "keyboard",
    browser,
    screenshotName: "showroom-button-narrow.png",
    viewport: { width: 390, height: 844 },
  });
  await verifyMobileNavigation(browser);
  console.log(
    "Showroom Button/IconButton and mobile navigation verification passed."
  );
} finally {
  await browser.close();
}
