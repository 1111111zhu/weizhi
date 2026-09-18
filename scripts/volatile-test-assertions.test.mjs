import assert from "node:assert/strict";
import test from "node:test";

import {
  findVolatileTestAssertions,
  fingerprintFinding,
  findingsBeyondBaseline,
  validateHistoricalBaseline,
} from "./volatile-test-assertions.mjs";

test("flags pure visual assertions while preserving interaction and accessibility contracts", () => {
  const source = `
    test("hides the old panel", () => {
      expect(screen.queryByText("Legacy panel")).toBeNull();
      expect(button).toHaveClass("rounded-md");
    });
    test("closes the panel after an action", async () => {
      await user.click(button);
      expect(screen.queryByText("Legacy panel")).toBeNull();
    });
    test("keeps its accessibility contract", () => {
      expect(button).toHaveAttribute("aria-label", "Close");
    });
  `;
  const findings = findVolatileTestAssertions(
    "apps/emp/src/components/panel.test.tsx",
    source
  );
  assert.deepEqual(
    findings.map((finding) => finding.reason),
    ["用元素缺失表达可见性或展示状态", "把具体展示实现写死"]
  );
});

test("historical allowances cannot be enlarged or assigned a different source", () => {
  const fingerprint = fingerprintFinding({
    filePath: "legacy.test.ts",
    code: "one",
  });
  const previous = {
    version: 2,
    sourceCommit: "a".repeat(40),
    fingerprints: { [fingerprint]: 1 },
  };
  assert.doesNotThrow(() => validateHistoricalBaseline(previous, previous));
  assert.doesNotThrow(() =>
    validateHistoricalBaseline({ ...previous, fingerprints: {} }, previous)
  );
  assert.throws(
    () =>
      validateHistoricalBaseline(
        { ...previous, fingerprints: { [fingerprint]: 2 } },
        previous
      ),
    /must not grow/
  );
  assert.throws(
    () =>
      validateHistoricalBaseline(
        { ...previous, sourceCommit: "b".repeat(40) },
        previous
      ),
    /must not change/
  );
});

test("does not infer presentation from a filename when checking model and file integrity", () => {
  const source = `
    test("keeps copied files intact", async () => {
      expect(path.basename(target)).toBe("runtime");
      expect(readFile(target)).resolves.toBe("synthetic helper");
    });
    test("decodes PDF bytes and preserves model identity", () => {
      expect(new TextDecoder().decode(bytes)).toBe("%PDF-");
      expect(parseMobileRoute("#tasks").screen).toBe("tasks");
      expect(next.content[0].id).toBe("existing");
      expect(pdfFitWidth(5000, 595, 24)).toBe(2);
    });
  `;
  assert.deepEqual(
    findVolatileTestAssertions("apps/ui-showroom/copy-preview.test.ts", source),
    []
  );
});

test("continues to reject hardcoded style and rendered copy in UI tests", () => {
  const source = `
    test("example", () => {
      const markup = renderToStaticMarkup(<Panel />);
      expect(markup).toContain("Legacy caption");
      expect(button).toHaveClass("rounded-md");
      expect(buttonVariants()).toContain("hover:bg-slate-200");
      expect(element.style.height).toBe("40px");
      expect(screen.queryByText("Legacy panel")).toBeNull();
    });
  `;
  assert.equal(
    findVolatileTestAssertions("src/panel.test.tsx", source).length,
    5
  );
});

test("recognizes lifecycle interactions and attribute-level accessibility contracts", () => {
  const source = `
    test("tracks focus and blur", () => {
      input.focus();
      viewport.dispatchEvent(new Event("resize"));
      expect(section.style.height).toBe("360px");
      input.blur();
      expect(section.style.height).toBe("");
    });
    test("changes data on rerender", () => {
      rerender(<Panel empty />);
      expect(screen.queryByText("Old item")).toBeNull();
    });
    test("names the native control and destination", () => {
      expect(button.getAttribute("aria-label")).toBe("Open chart");
      expect(image.getAttribute("alt")).toBe("Evidence");
      expect(link.getAttribute("href")).toBe("https://example.com/");
    });
  `;
  assert.deepEqual(
    findVolatileTestAssertions("src/example.test.tsx", source),
    []
  );
});

test("allows only exact historical findings including duplicate counts", () => {
  const findings = [
    { filePath: "legacy.test.ts", code: "one" },
    { filePath: "legacy.test.ts", code: "two" },
    { filePath: "new.test.ts", code: "new" },
  ];
  const baseline = { [fingerprintFinding(findings[0])]: 1 };
  assert.deepEqual(findingsBeyondBaseline(findings, baseline), [
    findings[1],
    findings[2],
  ]);
  assert.deepEqual(findingsBeyondBaseline([findings[1]], baseline), [
    findings[1],
  ]);
  assert.deepEqual(
    findingsBeyondBaseline([findings[0], findings[0]], baseline),
    [findings[0]]
  );
});

test("preserves executable-markup rejection assertions without exempting adjacent visual checks", () => {
  const source = `
    test("renders input safely", () => {
      const payload = '<script>alert(1)</script> [bad](javascript:alert(1))';
      const view = renderValue(payload);
      expect(view.querySelector("script")).toBeNull();
      expect(view.querySelector("a")).toBeNull();
      expect(view.querySelector("aside")).toBeNull();
      expect(view).toHaveClass("rounded-xl");
    });
  `;
  const findings = findVolatileTestAssertions("src/message.test.tsx", source);
  assert.equal(findings.length, 2);
  assert.match(findings[0].code, /aside/);
  assert.match(findings[1].code, /rounded-xl/);
});

test("does not treat final cleanup as proof of behavior", () => {
  const source = `
    test("panel appearance", () => {
      try {
        root.render(<Panel />);
        expect(panel).toHaveClass("rounded-xl");
      } finally {
        root.unmount();
      }
    });
    test("reflects replacement data", () => {
      try {
        root.render(<Message time="10:30" />);
        root.render(<Message />);
        expect(view.querySelector("time")).toBeNull();
      } finally { root.unmount(); }
    });
  `;
  const findings = findVolatileTestAssertions("src/panel.test.tsx", source);
  assert.equal(findings.length, 1);
  assert.match(findings[0].code, /rounded-xl/);
});
