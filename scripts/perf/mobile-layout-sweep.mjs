// Read-only UI inventory: run with playwright-cli run-code --filename.
// eslint-disable-next-line no-unused-vars -- Playwright consumes the file as a function expression.
async function sweep(page) {
  const routes = [
    ["cmp-clients", "http://127.0.0.1:3052/zh-CN/client"],
    ["cmp-engagements", "http://127.0.0.1:3052/zh-CN/engagement"],
    ["cmp-acceptance", "http://127.0.0.1:3052/zh-CN/acceptance"],
    ["cmp-billing", "http://127.0.0.1:3052/zh-CN/billing"],
    ["cmp-approvals", "http://127.0.0.1:3052/zh-CN/approvals"],
    ["cmp-dashboard", "http://127.0.0.1:3052/zh-CN/dashboard"],
    ["cmp-maps", "http://127.0.0.1:3052/zh-CN/maps"],
    ["cmp-archive", "http://127.0.0.1:3052/zh-CN/engagement/archive"],
    ["cmp-new-client", "http://127.0.0.1:3052/zh-CN/client/new"],
    ["cmp-new-engagement", "http://127.0.0.1:3052/zh-CN/engagement/new"],
    ["emp-engagement", "http://127.0.0.1:3048/zh-CN/engagement"],
    ["emp-workspaces", "http://127.0.0.1:3048/zh-CN/workspaces"],
    ["emp-inbox", "http://127.0.0.1:3048/zh-CN/inbox"],
    ["emp-confirmations", "http://127.0.0.1:3048/zh-CN/confirmations"],
    ["emp-users", "http://127.0.0.1:3048/zh-CN/admin/users"],
    ["emp-roles", "http://127.0.0.1:3048/zh-CN/admin/roles"],
    ["emp-declaration", "http://127.0.0.1:3048/zh-CN/declaration"],
    [
      "emp-project",
      "http://127.0.0.1:3048/zh-CN/engagement/project-orchid-2026",
    ],
  ];
  const reports = [];
  const audit = await page.context().newPage();
  await audit.setViewportSize({ width: 390, height: 844 });
  try {
    for (const [name, url] of routes) {
      let readiness;
      try {
        await audit.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        await audit.waitForFunction(
          // eslint-disable-next-line unicorn/prefer-dom-node-text-content -- Read visible UI, not hidden menu/SSR text.
          () => document.body.innerText.trim().length > 40,
          undefined,
          { timeout: 15_000 }
        );
        await audit.evaluate(() => document.fonts.ready);
      } catch (error) {
        readiness = String(error).slice(0, 180);
      }
      const metrics = await audit.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const overflowing = [
          ...document.querySelectorAll("main *, header *, [role=dialog] *"),
        ]
          .filter((element) => {
            const box = element.getBoundingClientRect();
            return (
              box.width > 0 &&
              (box.right > width + 1 || box.left < -1) &&
              getComputedStyle(element).visibility !== "hidden"
            );
          })
          .slice(0, 12)
          .map((element) => ({
            tag: element.tagName,
            cls: element.className?.toString().slice(0, 160),
            text: element.textContent?.trim().slice(0, 80),
          }));
        return {
          rootOverflow: document.documentElement.scrollWidth > width + 1,
          // eslint-disable-next-line unicorn/prefer-dom-node-text-content -- The audit reports visible page content.
          text: document.body.innerText.slice(0, 2600),
          overflowing,
        };
      });
      await audit.screenshot({
        path: `output/playwright/layout-sweep-${name}.png`,
        caret: "initial",
      });
      reports.push({ name, url: audit.url(), readiness, ...metrics });
    }
    return reports;
  } finally {
    await audit.close();
  }
}
