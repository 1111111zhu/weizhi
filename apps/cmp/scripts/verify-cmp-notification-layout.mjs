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
  id: "notification-layout-manager",
  email: "notification-layout-manager@example.com",
  name: "Notification Layout Manager",
  globalRole: "MANAGER",
};
const notifications = Array.from({ length: 6 }, (_, index) => ({
  id: `notification-${index + 1}`,
  recipientId: currentUser.id,
  senderId: index === 0 ? "mic-reviewer" : null,
  type: "SYSTEM_NOTIFICATION",
  title:
    index === 0
      ? "CA-MRNN-TYA7-XCHJ 已进入 PIC 审批并等待后续处理"
      : `CA-MRG5-RQTB-W8PC-${index + 1} 已提交成功`,
  body:
    index === 0
      ? "Leo Li 已提交 Client Acceptance：CMP E2E Approval 20260716，当前等待 MIC 审批，请及时查看并完成后续操作。"
      : "Client Acceptance 已提交，当前等待 MIC 审批：Harbour Retail Limited。",
  actionUrl: `/cmp/acceptance?tab=approvals&requestId=request-${index + 1}`,
  readAt: index === 0 ? null : "2026-07-11T09:24:00.000Z",
  createdAt: `2026-07-${String(16 - index).padStart(2, "0")}T15:28:00.000Z`,
}));

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
  if (pathname === "/cmp/inbox/messages") {
    return notifications;
  }
  if (
    pathname.startsWith("/cmp/inbox/messages/") &&
    pathname.endsWith("/read")
  ) {
    return { ...notifications[0], readAt: "2026-07-16T15:30:00.000Z" };
  }
  if (pathname === "/cmp/users") {
    return [];
  }
  if (pathname === "/cmp/client-groups") {
    return { groups: [] };
  }
  if (pathname === "/cmp/clients") {
    return { clients: [] };
  }
  if (pathname === "/cmp/acceptance") {
    return { requests: [] };
  }
  if (pathname === "/cmp/approvals") {
    return { requests: [] };
  }
}

async function assertStackedNotification(card) {
  const geometry = await card.evaluate((element) => {
    const label = element.querySelector(":scope > .pw-button-label");
    const content = label?.querySelector(
      ":scope > .cmp-notification-card-content"
    );
    const title = content?.querySelector(
      ":scope > .cmp-notification-card-title-row"
    );
    const body = content?.querySelector(":scope > .cmp-notification-body");
    const meta = content?.querySelector(":scope > .cmp-notification-meta");
    if (!(label && content && title && body && meta)) {
      return null;
    }

    const cardBox = element.getBoundingClientRect();
    const contentBox = content.getBoundingClientRect();
    const titleBox = title.getBoundingClientRect();
    const bodyBox = body.getBoundingClientRect();
    const metaBox = meta.getBoundingClientRect();
    return {
      card: { left: cardBox.left, right: cardBox.right },
      childCount: label.children.length,
      content: {
        display: getComputedStyle(content).display,
        left: contentBox.left,
        right: contentBox.right,
      },
      title: {
        bottom: titleBox.bottom,
        left: titleBox.left,
        right: titleBox.right,
      },
      body: {
        top: bodyBox.top,
        bottom: bodyBox.bottom,
        left: bodyBox.left,
        right: bodyBox.right,
      },
      meta: { top: metaBox.top, left: metaBox.left, right: metaBox.right },
    };
  });

  assert.ok(
    geometry,
    "notification card must expose its stacked content regions"
  );
  assert.equal(
    geometry.childCount,
    1,
    "Button label must own one domain content container"
  );
  assert.equal(
    geometry.content.display,
    "grid",
    "notification content must use a grid stack"
  );
  assert.ok(
    geometry.body.top >= geometry.title.bottom,
    "body must follow the title vertically"
  );
  assert.ok(
    geometry.meta.top >= geometry.body.bottom,
    "metadata must follow the body vertically"
  );
  for (const region of [
    geometry.content,
    geometry.title,
    geometry.body,
    geometry.meta,
  ]) {
    assert.ok(
      region.left >= geometry.card.left - 1,
      "notification content must stay inside its card"
    );
    assert.ok(
      region.right <= geometry.card.right + 1,
      "notification content must stay inside its card"
    );
  }
}

async function verifyViewport(
  browser,
  viewport,
  screenshotName,
  activation,
  appearance = "day"
) {
  const context = await browser.newContext({ locale: "zh-CN", viewport });
  await context.addCookies([
    {
      name: "project-wing-theme-flavor",
      value: appearance === "night" ? "mocha" : "latte",
      url: baseUrl,
    },
  ]);
  const page = await context.newPage();
  const consoleErrors = [];
  const unexpectedRequests = [];
  let markReadRequestCount = 0;

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await context.addInitScript((preferredAppearance) => {
    if (!["http:", "https:"].includes(window.location.protocol)) {
      return;
    }
    try {
      window.sessionStorage.setItem("project-wing-cmp-login-admission", "1");
      window.localStorage.setItem("cmp-appearance", preferredAppearance);
    } catch {
      // Storage can be unavailable for transient browser documents.
    }
  }, appearance);

  const corsHeaders = {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
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
          body: JSON.stringify({
            message: "Unmocked notification regression request",
          }),
        });
      }
      if (pathname.endsWith("/read")) {
        markReadRequestCount += 1;
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
    await page.goto(`${baseUrl}/zh-CN/acceptance`, {
      waitUntil: "networkidle",
    });

    await page.locator(".cmp-shell").waitFor();
    await page.waitForFunction(
      (expectsNight) =>
        document.querySelector(".cmp-shell")?.classList.contains("is-night") ===
        expectsNight,
      appearance === "night"
    );
    assert.equal(
      await page
        .locator(".cmp-shell")
        .evaluate((element) => element.classList.contains("is-night")),
      appearance === "night",
      `CMP shell must render the requested ${appearance} appearance`
    );

    const inboxButton = page.getByRole("button", { name: "收件箱" });
    if (activation === "keyboard") {
      await inboxButton.focus();
      await inboxButton.press("Space");
    } else {
      await inboxButton.click();
    }

    const drawer = page.getByRole("dialog", { name: "通知" });
    await drawer.waitFor();
    const firstCard = drawer.locator(".cmp-notification-card-main").first();
    await firstCard.waitFor();
    await assertStackedNotification(firstCard);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    assert.equal(
      overflow,
      false,
      "notification drawer must not overflow the page"
    );

    await page.screenshot({
      fullPage: true,
      path: resolve(outputDir, screenshotName),
    });

    if (activation === "keyboard") {
      await firstCard.focus();
      await firstCard.press("Space");
    } else {
      await firstCard.click();
    }
    await page.waitForURL(
      /\/zh-CN\/acceptance\?tab=approvals&requestId=request-1$/
    );
    assert.equal(
      markReadRequestCount,
      1,
      "opening an unread notification must mark it read once"
    );
    assert.deepEqual(unexpectedRequests, []);
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
    "cmp-notification-layout-wide.png",
    "pointer"
  );
  await verifyViewport(
    browser,
    { width: 390, height: 844 },
    "cmp-notification-layout-narrow.png",
    "keyboard"
  );
  await verifyViewport(
    browser,
    { width: 1440, height: 1000 },
    "cmp-notification-layout-night.png",
    "pointer",
    "night"
  );
  console.log(
    "CMP notifications stay stacked at 1440px and 390px in day and night appearances."
  );
} finally {
  await browser.close();
}
