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
      // Try the next installed browser.
    }
  }
  throw new Error(
    "No Chrome-compatible browser found. Set PROJECTWING_SHOWROOM_CHROME_PATH."
  );
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

function assertDiagnostics(diagnostics, width) {
  assert.deepEqual(
    diagnostics.consoleErrors,
    [],
    `PDF template designer console errors at ${width}px: ${diagnostics.consoleErrors.join(" | ")}`
  );
  assert.deepEqual(
    diagnostics.failedRequests,
    [],
    `PDF template designer request failures at ${width}px: ${diagnostics.failedRequests.join(" | ")}`
  );
}

async function assertNoHorizontalOverflow(page) {
  assert.equal(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth
    ),
    true,
    "PDF template designer showroom must not overflow horizontally"
  );
}

async function verifyDesignerAndForm(browser) {
  const viewport = { width: 1440, height: 1000 };
  const context = await browser.newContext({ locale: "zh-CN", viewport });
  const page = await context.newPage();
  const diagnostics = captureDiagnostics(page);
  try {
    await page.goto(`${baseUrl}/blocks#pdf-template-designer`, {
      waitUntil: "networkidle",
    });
    const proposal = page.getByRole("region", {
      name: "PDF template designer proposal",
    });
    await proposal.locator('[data-engine-state="ready"]').waitFor();
    const expandedCanvasWidth = (
      await proposal
        .getByRole("region", { name: "PDF 模板设计器" })
        .boundingBox()
    )?.width;
    assert.ok(
      expandedCanvasWidth && expandedCanvasWidth > 900,
      `Collapsed inspector should leave a wide PDF canvas, got ${expandedCanvasWidth}px`
    );
    await proposal.screenshot({
      path: path.resolve(outputDir, "showroom-pdf-template-designer.png"),
    });

    await proposal.getByRole("button", { name: "加粗" }).click();
    await proposal.getByRole("button", { name: "增大字号" }).click();
    await proposal.getByRole("button", { name: "下划线" }).click();
    const designerRegion = proposal.getByRole("region", {
      name: "PDF 模板设计器",
    });
    const designerEditable = designerRegion
      .getByText("Orchid Holdings Limited", { exact: true })
      .first();
    await designerEditable.waitFor();
    await page.waitForTimeout(200);
    const designerFieldStyle = await designerEditable.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        textDecorationLine: style.textDecorationLine,
        text: element.textContent,
      };
    });
    await proposal.getByRole("button", { name: "填写预览" }).click();
    const form = proposal.getByRole("region", { name: "PDF 模板填写预览" });
    await form.waitFor();
    await proposal.getByRole("button", { name: "显示属性面板" }).click();
    await proposal
      .getByRole("complementary", { name: "模板属性面板" })
      .waitFor();
    const inspectorCanvasWidth = (await form.boundingBox())?.width;
    assert.ok(
      inspectorCanvasWidth && expandedCanvasWidth - inspectorCanvasWidth >= 250,
      "Opening the optional inspector should be the only action that narrows the PDF canvas"
    );
    const editable = form.locator("[contenteditable]").first();
    await page.waitForTimeout(200);
    const fieldStyle = await editable.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        textDecorationLine: style.textDecorationLine,
        text: element.textContent,
      };
    });
    assert.deepEqual(
      fieldStyle,
      designerFieldStyle,
      "Designer and fill views must render identical value and text styling"
    );
    assert.equal(
      fieldStyle.backgroundColor,
      "rgba(0, 0, 0, 0)",
      "Editable fields must remain transparent so the PDF source is not covered"
    );
    await editable.click();
    await editable.press("Control+A");
    await editable.type("Orchid Holdings Updated");
    await editable.press("Tab");
    await page.waitForFunction(
      () =>
        Number(
          document.querySelector('[data-testid="pdf-field-change-count"]')
            ?.textContent ?? "0"
        ) > 0,
      undefined,
      { timeout: 5000 }
    );
    const mountCount = await proposal
      .getByTestId("pdf-engine-mount-count")
      .textContent();
    await editable.click();
    await editable.press("End");
    await editable.type(" Again");
    await editable.press("Tab");
    await page.waitForTimeout(100);
    assert.equal(
      await proposal.getByTestId("pdf-engine-mount-count").textContent(),
      mountCount,
      "Typing must not remount the PDF base"
    );
    assert.equal(
      await editable.textContent(),
      "Orchid Holdings Updated Again",
      "Form input must remain live on the stable PDF base"
    );
    assert.equal(
      (await editable.textContent())?.includes("**"),
      false,
      "WYSIWYG formatting must not insert Markdown markers"
    );
    assertDiagnostics(diagnostics, viewport.width);
  } finally {
    await context.close();
  }
}

async function verifyNarrow(browser) {
  const viewport = { width: 900, height: 900 };
  const context = await browser.newContext({ locale: "zh-CN", viewport });
  const page = await context.newPage();
  const diagnostics = captureDiagnostics(page);
  try {
    await page.goto(`${baseUrl}/blocks#pdf-template-designer`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("region", { name: "PDF 模板设计器" }).waitFor();
    await page.screenshot({
      fullPage: false,
      path: path.resolve(
        outputDir,
        "showroom-pdf-template-designer-narrow.png"
      ),
    });
    await assertNoHorizontalOverflow(page);
    assertDiagnostics(diagnostics, viewport.width);
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
  await verifyDesignerAndForm(browser);
  await verifyNarrow(browser);
  console.log("PDF template designer showroom verification passed.");
} finally {
  await browser.close();
}
