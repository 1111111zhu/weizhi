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
  id: "engagement-preview-manager",
  email: "engagement-preview-manager@example.com",
  name: "Engagement Preview Manager",
  globalRole: "MANAGER",
};
const client = {
  id: "client-1",
  clientCode: "C001",
  companyNumber: "1234567",
  nameZh: "华勤有限公司",
  nameEn: "Huaqian Limited",
  groupId: null,
  group: null,
  address: null,
  contactPerson: "Amy Chan",
  telephone: null,
  email: null,
  website: null,
  yearEndDate: "2026-12-31",
  placeOfIncorporation: "Hong Kong",
  listedOrPrivate: "PRIVATE",
  clientPartnerPic: "Partner A",
  clientManagerMic: "Manager B",
  serviceLines: "Audit",
  approvalReferenceNumber: "NCA-001",
  status: "ACTIVE",
  createdById: "user-1",
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
};
const engagement = {
  id: "engagement-1",
  clientId: client.id,
  client: {
    id: client.id,
    clientCode: client.clientCode,
    nameZh: client.nameZh,
    nameEn: client.nameEn,
    status: client.status,
  },
  engagementCode: "C001-2026-AUD",
  serviceType: "ANNUAL_AUDIT",
  yearEndDate: "2026-12-31",
  reportDate: "2027-03-31",
  approvalReferenceNumber: "NEA-001",
  approvalDate: "2026-02-10",
  budgetedHours: "420.00",
  agreedFee: "180000.00",
  recoveryRate: "84.50",
  feeCurrency: "HKD",
  amlRiskClassification: "NOT_HIGH",
  engagementRiskClassification: "NORMAL",
  picUserId: null,
  micUserId: null,
  eqReviewerUserId: null,
  riskManagementPartnerUserId: null,
  pic: "Partner A",
  mic: "Manager B",
  eqReviewer: null,
  riskManagementPartner: null,
  status: "ACTIVE",
  remarks: "Demo engagement",
  createdById: "user-1",
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
  codeAliases: [],
};
const engagementPreview = {
  kind: "ENGAGEMENT",
  recordId: engagement.id,
  code: engagement.engagementCode,
  title: engagement.engagementCode,
  status: engagement.status,
  updatedAt: engagement.updatedAt,
  sections: [
    {
      id: "basic",
      title: "Basic information",
      fields: [
        {
          id: "engagementCode",
          label: "Engagement Code",
          value: engagement.engagementCode,
        },
        { id: "clientCode", label: "Client Code", value: client.clientCode },
        { id: "serviceType", label: "Service Type", value: "Annual audit" },
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
  if (pathname === "/cmp/clients") {
    return { clients: [client] };
  }
  if (pathname === "/cmp/engagements") {
    return { engagements: [engagement] };
  }
  if (pathname === "/cmp/engagements/engagement-1/preview") {
    return engagementPreview;
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

async function verifyViewport(browser, viewport, suffix, activation) {
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
    await page.goto(`${baseUrl}/en-US/engagement`, {
      waitUntil: "networkidle",
    });

    const preview = page.getByRole("button", {
      name: "Preview Engagement C001-2026-AUD",
    });
    await preview.waitFor();
    assert.equal(await preview.getAttribute("data-variant"), "quiet");
    assert.equal(await preview.getAttribute("data-size"), "md");
    assert.equal(await preview.getAttribute("data-legacy-variant"), null);
    assert.equal(await preview.getAttribute("data-legacy-size"), null);
    await assertNoPageOverflow(page, "Engagement grid");
    await page.screenshot({
      fullPage: true,
      path: resolve(outputDir, `cmp-engagement-preview-source-${suffix}.png`),
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
      "/en-US/engagement/engagement-1",
      "Preview must open the Engagement profile route"
    );
    assert.equal(
      await popup.evaluate(() => window.opener === null),
      true,
      "Preview tab must not retain an opener"
    );
    await popup
      .getByRole("heading", { name: engagement.engagementCode })
      .waitFor();
    await assertNoPageOverflow(popup, "Engagement preview");
    await popup.screenshot({
      fullPage: true,
      path: resolve(
        outputDir,
        `cmp-engagement-preview-destination-${suffix}.png`
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
  console.log("CMP Engagement preview Button passed at 1440px and 390px.");
} finally {
  await browser.close();
}
