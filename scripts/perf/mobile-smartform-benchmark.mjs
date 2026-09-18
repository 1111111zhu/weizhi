// Run with playwright-cli run-code --filename scripts/perf/mobile-smartform-benchmark.mjs.
// The current page must be the production-built English deferred-income fixture.
// eslint-disable-next-line no-unused-vars -- The CLI consumes the whole file as a function expression.
async function benchmark(page) {
  const cdp = await page.context().newCDPSession(page);
  const reports = [];
  const keys = "abcdefghijklmnopqrstuvwx";
  await page.setViewportSize({ width: 390, height: 844 });
  try {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    for (let run = 0; run < 3; run += 1) {
      await page.reload();
      await page
        .getByRole("button", { name: "Edit: Comments", exact: true })
        .first()
        .waitFor();
      await page.evaluate(() => document.fonts.ready);
      const dom = await page.evaluate(() => ({
        nodes: document
          .querySelector(".smart-form-v2-document")
          .querySelectorAll("*").length,
        tables: document
          .querySelector(".smart-form-v2-document")
          .querySelectorAll("table").length,
      }));
      await page
        .getByRole("button", { name: "Edit: Comments", exact: true })
        .first()
        .click();
      const editor = page
        .getByRole("dialog")
        .getByRole("textbox", { name: "Edit rich text", exact: true });
      await editor.click();
      await editor.press("ControlOrMeta+End");
      await page.keyboard.insertText(" warmup ");
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          })
      );
      await page.evaluate(() => {
        const state = { samples: [], longTasks: [], mutations: 0 };
        const keydown = (event) => {
          if (event.key.length !== 1 || !event.target.isContentEditable) {
            return;
          }
          const start = performance.now();
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              state.samples.push(performance.now() - start)
            )
          );
        };
        const observer = new PerformanceObserver((list) =>
          state.longTasks.push(
            ...list.getEntries().map((entry) => entry.duration)
          )
        );
        observer.observe({ type: "longtask", buffered: false });
        const mutations = new MutationObserver((records) => {
          state.mutations += records.length;
        });
        mutations.observe(document.querySelector(".smart-form-v2-document"), {
          subtree: true,
          childList: true,
          characterData: true,
        });
        document.addEventListener("keydown", keydown, true);
        window.__wingPerfProbe = {
          state,
          stop: () => {
            document.removeEventListener("keydown", keydown, true);
            observer.disconnect();
            mutations.disconnect();
          },
        };
      });
      for (const key of keys) {
        await page.keyboard.press(key);
      }
      await page.waitForFunction(
        (count) => window.__wingPerfProbe.state.samples.length >= count,
        keys.length
      );
      const metrics = await page.evaluate(() => {
        const { state, stop } = window.__wingPerfProbe;
        stop();
        delete window.__wingPerfProbe;
        const sorted = state.samples.toSorted((a, b) => a - b);
        return {
          samples: sorted.length,
          keydownToTwoFramesP50Ms: sorted[Math.floor(sorted.length * 0.5)],
          keydownToTwoFramesP95Ms:
            sorted[
              Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))
            ],
          longTasks: state.longTasks.length,
          totalLongTaskMs: state.longTasks.reduce(
            (sum, duration) => sum + duration,
            0
          ),
          backgroundDomMutations: state.mutations,
        };
      });
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Close/ })
        .first()
        .click();
      reports.push({ run: run + 1, ...dom, ...metrics });
    }
    return { url: page.url(), cpuSlowdown: 4, viewport: "390x844", reports };
  } finally {
    await page.evaluate(() => {
      window.__wingPerfProbe?.stop();
      delete window.__wingPerfProbe;
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await cdp.detach();
  }
}
