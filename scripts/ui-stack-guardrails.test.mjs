import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeNativeControls,
  analyzePackageFile,
  analyzeSourceFile,
  createFindingBaseline,
  diffAgainstBaseline,
  shouldScanPath,
} from "./ui-stack-guardrails.mjs";

test("scans frontend production TypeScript and TSX files", () => {
  assert.equal(shouldScanPath("apps/emp/src/views/projects.tsx"), true);
  assert.equal(shouldScanPath("apps/cmp/src/app/page.tsx"), true);
  assert.equal(shouldScanPath("apps/tms/src/app/page.tsx"), true);
  assert.equal(shouldScanPath("apps/ib/src/app/page.tsx"), true);
  assert.equal(shouldScanPath("apps/intranet/src/app/page.tsx"), true);
  assert.equal(shouldScanPath("apps/emp/src/components/ui/button.tsx"), false);
  assert.equal(shouldScanPath("apps/emp/src/components/reui/tree.tsx"), false);
  assert.equal(
    shouldScanPath("apps/emp/src/components/motion/button/base.tsx"),
    false
  );
  assert.equal(
    shouldScanPath("apps/emp/src/components/motion/button/custom.tsx"),
    true
  );
  assert.equal(
    shouldScanPath("apps/emp/src/components/motion/expandable-action-bar.tsx"),
    false
  );
  assert.equal(
    shouldScanPath("apps/emp/src/components/motion/popover.tsx"),
    false
  );
  assert.equal(
    shouldScanPath("apps/cmp/src/components/motion/expandable-action-bar.tsx"),
    false
  );
  assert.equal(
    shouldScanPath("apps/tms/src/components/motion/expandable-action-bar.tsx"),
    false
  );
  assert.equal(
    shouldScanPath("apps/emp/src/components/motion/custom-action-bar.tsx"),
    true
  );
  assert.equal(shouldScanPath("apps/cmp/src/components/ui/button.tsx"), false);
  assert.equal(shouldScanPath("apps/emp/src/views/projects.test.tsx"), false);
  assert.equal(shouldScanPath("apps/emp/src/app/globals.css"), false);
  assert.equal(shouldScanPath("apps/api/src/main.ts"), false);
});

test("allows native buttons only in exact vendored action bar sources", () => {
  const source =
    'export function Action() { return <button type="button">Run</button>; }\n';

  assert.deepEqual(
    analyzeNativeControls(
      "apps/emp/src/components/motion/expandable-action-bar.tsx",
      source
    ),
    []
  );
  assert.equal(
    analyzeNativeControls(
      "apps/emp/src/components/motion/custom-action-bar.tsx",
      source
    ).length,
    1
  );
});

test("guardrail flags direct UI primitive imports outside shadcn wrappers", () => {
  const findings = analyzeSourceFile(
    "apps/emp/src/views/settings.tsx",
    'import { Dialog } from "@base-ui/react/dialog";\n' +
      'import { Button } from "@project-wing/ui";\n'
  );

  assert.deepEqual(
    findings.map((finding) => finding.rule),
    ["no-restricted-imports"]
  );
});

test("guardrail flags Radix UI imports outside shadcn wrappers", () => {
  const findings = analyzeSourceFile(
    "apps/emp/src/views/settings.tsx",
    'import * as Dialog from "@radix-ui/react-dialog";\n'
  );

  assert.deepEqual(
    findings.map((finding) => finding.rule),
    ["no-restricted-imports"]
  );
});

test("guardrail flags NativeSelect wrapper imports in product UI", () => {
  const findings = analyzeSourceFile(
    "apps/emp/src/views/settings.tsx",
    'import { NativeSelect } from "@/components/ui/native-select";\n'
  );

  assert.deepEqual(
    findings.map((finding) => finding.rule),
    ["no-restricted-imports"]
  );
});

test("guardrail flags inline styling in product UI", () => {
  const findings = analyzeSourceFile(
    "apps/emp/src/views/settings.tsx",
    'export function Example() { return <div style={{ color: "red" }}>Warning</div>; }\n'
  );

  assert.deepEqual(
    findings.map((finding) => finding.rule),
    ["no-restricted-syntax"]
  );
});

test("flags unsupported UI dependencies in frontend package manifests", () => {
  const findings = analyzePackageFile("apps/emp/package.json", {
    dependencies: {
      "@chakra-ui/react": "^2.8.2",
      "@mui/material": "^5.15.0",
      "lucide-react": "^0.475.0",
    },
    devDependencies: {
      "@headlessui/react": "^1.7.18",
      typescript: "^5.7.3",
    },
    peerDependencies: {
      antd: "^5.12.0",
    },
  });

  assert.deepEqual(
    findings.map((finding) => finding.snippet),
    ["@chakra-ui/react", "@headlessui/react", "@mui/material", "antd"]
  );
});

test("flags Radix UI dependencies in frontend package manifests", () => {
  const findings = analyzePackageFile("apps/emp/package.json", {
    dependencies: {
      "@radix-ui/react-dialog": "^1.1.0",
    },
    devDependencies: {
      "radix-ui": "^1.0.0",
    },
  });

  assert.deepEqual(
    findings.map((finding) => finding.snippet),
    ["@radix-ui/react-dialog", "radix-ui"]
  );
});

test("fails only when current findings exceed the checked-in baseline", () => {
  const baseline = createFindingBaseline([
    {
      file: "apps/emp/src/views/settings.tsx",
      rule: "no-restricted-syntax",
      snippet: 'style={{ color: "red" }}',
    },
  ]);

  assert.equal(
    diffAgainstBaseline(
      [
        {
          file: "apps/emp/src/views/settings.tsx",
          rule: "no-restricted-syntax",
          snippet: 'style={{ color: "red" }}',
        },
      ],
      baseline
    ).isClean,
    true
  );

  assert.equal(
    diffAgainstBaseline(
      [
        {
          file: "apps/emp/src/views/settings.tsx",
          rule: "no-restricted-syntax",
          snippet: 'style={{ color: "red" }}',
        },
        {
          file: "apps/emp/src/views/settings.tsx",
          rule: "no-restricted-syntax",
          snippet: 'style={{ color: "blue" }}',
        },
      ],
      baseline
    ).isClean,
    false
  );
});
