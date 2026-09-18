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
  id: "client-preview-manager",
  email: "client-preview-manager@example.com",
  name: "Client Preview Manager",
  globalRole: "MANAGER",
};
const client = {
  id: "client-1",
  clientCode: "C001",
  companyNumber: "1234567",
  nameZh: "华勤有限公司",
  nameEn: "Huaqian Limited",
  groupId: "group-1",
  group: {
    id: "group-1",
    groupCode: "G001",
    nameZh: "华勤集团",
    nameEn: "Huaqian Group",
    status: "ACTIVE",
  },
  address: "1 Queen's Road Central",
  contactPerson: "Amy Chan",
  telephone: "+852 1111 2222",
  email: "amy@example.com",
  website: "https://example.com",
  hsicSectionCode: "C",
  industryOtherDescription: null,
  reportingGaap: null,
  yearEndDate: "2026-12-31",
  yearEndMonth: 12,
  placeOfIncorporation: "Hong Kong",
  listedOrPrivate: "PRIVATE",
  clientPartnerPic: "Partner A",
  clientManagerMic: "Manager B",
  serviceLines: "Audit, Tax",
  approvalReferenceNumber: "NCA-001",
  remarks: "Priority client",
  status: "ACTIVE",
  createdById: "user-1",
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
};
const clientPreview = {
  kind: "CLIENT",
  recordId: client.id,
  code: client.clientCode,
  title: client.nameEn,
  status: client.status,
  updatedAt: client.updatedAt,
  sections: [
    {
      id: "basic",
      title: "Basic information",
      fields: [
        { id: "clientCode", label: "Client Code", value: client.clientCode },
        {
          id: "companyNumber",
          label: "Company Number",
          value: client.companyNumber,
        },
        { id: "nameZh", label: "Company Name Chinese", value: client.nameZh },
      ],
    },
  ],
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
    return { groups: [client.group] };
  }
  if (pathname === "/cmp/clients/client-1/preview") {
    return clientPreview;
  }
  if (pathname === "/cmp/clients") {
    return { clients: [client] };
  }
  if (pathname === "/cmp/users") {
    return [];
  }
  if (pathname === "/cmp/inbox/messages") {
    return [];
  }
}

function watchPage(page, consoleErrors, failedRequests) {
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
}

async function assertNoPageOverflow(page, label) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
  );
  assert.equal(overflow, false, `${label} must not overflow the viewport`);
}

async function verifyViewport(browser, viewport, screenshotSuffix, activation) {
  const context = await browser.newContext({ locale: "en-US", viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  const unexpectedRequests = [];

  context.on("page", (openedPage) =>
    watchPage(openedPage, consoleErrors, failedRequests)
  );
  watchPage(page, consoleErrors, failedRequests);
  await context.addInitScript(() => {
    if (!["http:", "https:"].includes(window.location.protocol)) {
      return;
    }
    try {
      window.sessionStorage.setItem("project-wing-cmp-login-admission", "1");
    } catch {
      // Storage can be unavailable on the browser's initial blank document.
    }
  });

  const corsHeaders = {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-origin": baseUrl,
  };
  await context.route("https://flagcdn.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>',
    })
  );
  await context.route(
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

    const preview = page.getByRole("button", { name: "Preview Client C001" });
    await preview.waitFor();
    assert.equal(await preview.getAttribute("data-variant"), "quiet");
    assert.equal(await preview.getAttribute("data-size"), "md");
    assert.equal(await preview.getAttribute("data-legacy-variant"), null);
    assert.equal(await preview.getAttribute("data-legacy-size"), null);
    await assertNoPageOverflow(page, "Client grid");
    await page.screenshot({
      fullPage: true,
      path: resolve(
        outputDir,
        `cmp-client-preview-source-${screenshotSuffix}.png`
      ),
    });

    const popupPromise = context.waitForEvent("page");
    if (activation === "keyboard") {
      await preview.focus();
      await preview.press("Enter");
    } else {
      await preview.click();
    }
    const popup = await popupPromise;
    await popup.waitForLoadState("networkidle");
    assert.equal(
      new URL(popup.url()).pathname,
      "/en-US/client/client-1",
      "Preview must open the Client profile route"
    );
    assert.equal(
      await popup.evaluate(() => window.opener === null),
      true,
      "Preview tab must not retain an opener"
    );
    await popup.getByRole("heading", { name: "Huaqian Limited" }).waitFor();
    await assertNoPageOverflow(popup, "Client preview");
    await popup.screenshot({
      fullPage: true,
      path: resolve(
        outputDir,
        `cmp-client-preview-destination-${screenshotSuffix}.png`
      ),
    });

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
    "wide",
    "pointer"
  );
  await verifyViewport(
    browser,
    { width: 390, height: 844 },
    "narrow",
    "keyboard"
  );
  console.log("CMP Client preview Button passed at 1440px and 390px.");
} finally {
  await browser.close();
}
