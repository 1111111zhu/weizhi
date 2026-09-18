import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeI18nStaticCopy,
  createI18nStaticCopyBaseline,
  diffI18nStaticCopyAgainstBaseline,
} from "./i18n-static-copy.mjs";

test("flags literals routed through JSX variables and arrow-function props", () => {
  const findings = analyzeI18nStaticCopy(
    "apps/cmp/src/components/example.tsx",
    'const label = "New Copy";\n' +
      "export function Example() {\n" +
      "  return <button onClick={() => undefined} aria-label={label}>{label}</button>;\n" +
      "}\n"
  );

  assert.equal(findings.length, 2);
});

test("flags user-visible view-model fields in TypeScript source", () => {
  const findings = analyzeI18nStaticCopy(
    "apps/intranet/src/lib/system-links.ts",
    'export const links = [{ label: "Portal", description: "Open the portal" }];\n'
  );

  assert.equal(findings.length, 2);
});

test("permits app-local i18n source", () => {
  assert.deepEqual(
    analyzeI18nStaticCopy(
      "apps/cmp/src/i18n/dictionaries.ts",
      'export const dictionary = { title: "Client Management" };\n'
    ),
    []
  );
});

test("fails when a baseline literal is replaced with new hardcoded copy", () => {
  const baseline = createI18nStaticCopyBaseline(
    analyzeI18nStaticCopy(
      "apps/cmp/src/components/example.tsx",
      "export function Example() { return <span>Old Copy</span>; }\n"
    )
  );
  const failures = diffI18nStaticCopyAgainstBaseline(
    analyzeI18nStaticCopy(
      "apps/cmp/src/components/example.tsx",
      "export function Example() { return <span>New Copy</span>; }\n"
    ),
    baseline
  );

  assert.equal(failures.length, 1);
});
test("distinguishes synthetic business records from real API and control copy", () => {
  const record =
    'export const client = { label: "注册办事处", description: "Audit fieldwork" };';
  assert.deepEqual(
    analyzeI18nStaticCopy("apps/emp/src/api/mock-data.ts", record),
    []
  );
  assert.deepEqual(
    analyzeI18nStaticCopy("apps/emp/src/api/mock-api.ts", record),
    []
  );
  assert.equal(
    analyzeI18nStaticCopy("apps/emp/src/api/client.ts", record).length,
    2
  );
  assert.equal(
    analyzeI18nStaticCopy(
      "apps/emp/src/components/mock-data-view.tsx",
      'export function View(){return <div title="Audit fieldwork" />;}'
    ).length,
    1
  );
});
