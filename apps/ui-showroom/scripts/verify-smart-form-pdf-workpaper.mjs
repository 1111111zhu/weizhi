import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";

const baseUrl = (
  process.env.PROJECTWING_SHOWROOM_URL ?? "http://localhost:3008"
).replace(/\/$/, "");
const outputDir = path.resolve("output/playwright/design-first");
const browserCandidates = [
  process.env.PROJECTWING_SHOWROOM_CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

async function findBrowser() {
  for (const candidate of browserCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error("No Chrome-compatible browser found.");
}

function captureDiagnostics(page) {
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") {consoleErrors.push(message.text());}
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const cancelledPrefetch =
      request.method() === "GET" &&
      request.url().includes("_rsc=") &&
      request.failure()?.errorText === "net::ERR_ABORTED";
    if (!cancelledPrefetch) {
      failedRequests.push(
        `${request.method()} ${request.url()} (${request.failure()?.errorText ?? "unknown"})`
      );
    }
  });
  return { consoleErrors, failedRequests };
}

function assertDiagnostics(diagnostics, context) {
  assert.deepEqual(
    diagnostics.consoleErrors,
    [],
    `${context} console errors: ${diagnostics.consoleErrors.join(" | ")}`
  );
  assert.deepEqual(
    diagnostics.failedRequests,
    [],
    `${context} request failures: ${diagnostics.failedRequests.join(" | ")}`
  );
}

async function verifyDesktop(browser) {
  const context = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const diagnostics = captureDiagnostics(page);
  try {
    await page.goto(`${baseUrl}/blocks#smart-form-pdf-workpaper`, {
      waitUntil: "networkidle",
    });
    const proposal = page.getByRole("region", {
      name: "SmartForm PDF 审计底稿提案",
    });
    await proposal.waitFor();
    await proposal.getByText("编制签核人", { exact: true }).waitFor();
    await proposal.getByText("审批签核人", { exact: true }).waitFor();
    await proposal.getByText("2026-09-04", { exact: true }).waitFor();
    await proposal.getByText("2026-09-05", { exact: true }).waitFor();

    const specimens = [
      ["审计程序", "审计程序表 PDF 提案", "programme"],
      ["字段与条件", "混合 SmartForm PDF 提案", "fields"],
      ["富文本", "富文本与静态内容 PDF 提案", "rich-text"],
      ["跨页表格", "可重复表格跨页 PDF 提案", "paged"],
      ["多人签核", "多人签核 PDF 提案", "signoffs"],
      ["English", "English SmartForm PDF proposal", "english"],
    ];

    for (const [buttonName, regionName, fileName] of specimens) {
      await proposal
        .getByRole("button", { name: buttonName, exact: true })
        .click();
      const specimen = proposal.locator(`[aria-label="${regionName}"]`);
      await specimen.waitFor();
      await specimen.screenshot({
        path: path.resolve(outputDir, `smart-form-easy-paper-${fileName}.png`),
      });
    }

    await proposal
      .getByRole("button", { name: "字段与条件", exact: true })
      .click();
    for (const [buttonName, expectedText] of [
      ["命中：是", "命中分支：发现控制偏差"],
      ["否则", "否则分支：未发现控制偏差"],
      ["未回答", "分支问题尚未回答"],
    ]) {
      await proposal
        .getByRole("button", { name: buttonName, exact: true })
        .click();
      await proposal.getByText(expectedText, { exact: false }).waitFor();
    }
    await proposal.getByText("待签核", { exact: true }).waitFor();

    await proposal
      .getByRole("button", { name: "多人签核", exact: true })
      .click();
    assert.ok(
      (await proposal.getByText("King Su", { exact: true }).count()) === 1,
      "A preparer must appear exactly once in the author group"
    );
    assert.ok(
      (await proposal.getByText("Partner Chen", { exact: true }).count()) === 1,
      "An approver must appear exactly once in the author group"
    );

    await proposal
      .getByRole("button", { name: "跨页表格", exact: true })
      .click();
    assert.equal(
      await proposal
        .locator('[aria-label="可重复表格跨页 PDF 提案"] article')
        .count(),
      2,
      "The page-continuation specimen must render two A4 pages"
    );
    assert.equal(
      await proposal.getByText("样本编号", { exact: true }).count(),
      2,
      "The table header must repeat on the continuation page"
    );
    assertDiagnostics(diagnostics, "SmartForm EasyPaper desktop showroom");
  } finally {
    await context.close();
  }
}

async function verifyNarrow(browser) {
  const context = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 768, height: 1024 },
  });
  const page = await context.newPage();
  const diagnostics = captureDiagnostics(page);
  try {
    await page.goto(`${baseUrl}/blocks#smart-form-pdf-workpaper`, {
      waitUntil: "networkidle",
    });
    const proposal = page.getByRole("region", {
      name: "SmartForm PDF 审计底稿提案",
    });
    await proposal.waitFor();
    await proposal.screenshot({
      path: path.resolve(outputDir, "smart-form-easy-paper-narrow.png"),
    });
    assert.equal(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth
      ),
      true,
      "The EasyPaper showroom must not overflow the document horizontally"
    );
    assertDiagnostics(diagnostics, "SmartForm EasyPaper narrow showroom");
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
  await verifyDesktop(browser);
  await verifyNarrow(browser);
  console.log("SmartForm EasyPaper showroom verification passed.");
} finally {
  await browser.close();
}
