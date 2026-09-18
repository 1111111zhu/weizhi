import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeNativeControls,
  analyzePackageFile,
  analyzeSourceFile,
  analyzeUiWrapperImports,
  shouldScanPath,
  shouldScanUiWrapperImports,
} from "./boundary-auditor.mjs";

test("shouldScanPath correctly includes product source and excludes wrappers", () => {
  assert.equal(shouldScanPath("apps/emp/src/views/projects.tsx"), true);
  assert.equal(shouldScanPath("apps/cmp/src/app/page.tsx"), true);
  assert.equal(shouldScanPath("apps/tms/src/app/page.tsx"), true);
  assert.equal(shouldScanPath("apps/ib/src/app/page.tsx"), true);
  assert.equal(shouldScanPath("apps/intranet/src/app/page.tsx"), true);
  assert.equal(shouldScanPath("apps/emp/src/components/ui/button.tsx"), false);
  assert.equal(
    shouldScanUiWrapperImports("apps/emp/src/components/ui/button.tsx"),
    true
  );
  assert.equal(shouldScanPath("apps/emp/src/components/reui/tree.tsx"), false);
  assert.equal(
    shouldScanPath("apps/emp/src/components/motion/button/base.tsx"),
    false
  );
  assert.equal(
    shouldScanPath("apps/emp/src/components/motion/button/custom.tsx"),
    true
  );
  assert.equal(shouldScanPath("apps/api/src/main.ts"), false);
});

test("shouldScanPath scans authored showroom files", () => {
  assert.equal(shouldScanPath("apps/ui-showroom/app/page.tsx"), true);
  assert.equal(
    shouldScanPath("apps/ui-showroom/components/site-header.tsx"),
    true
  );
  assert.equal(shouldScanPath("apps/ui-showroom/lib/registry.ts"), true);
  assert.equal(shouldScanPath("apps/ui-showroom/lib/sponsors.ts"), true);
  assert.equal(shouldScanPath("apps/ui-showroom/lib/colors.ts"), true);
  assert.equal(
    shouldScanPath("apps/ui-showroom/lib/registry-colors.ts"),
    false
  );
  assert.equal(
    shouldScanPath("apps/ui-showroom/lib/registry-base-colors.ts"),
    false
  );
});

test("shouldScanPath excludes generated showroom files", () => {
  assert.equal(
    shouldScanPath("apps/ui-showroom/lib/registry-colors-1.ts"),
    false
  );
  assert.equal(
    shouldScanPath("apps/ui-showroom/lib/registry-base-colors-oklch-4.ts"),
    false
  );
  assert.equal(shouldScanPath("apps/ui-showroom/styles/globals.css"), false);
  assert.equal(
    shouldScanPath("apps/ui-showroom/components/ui/button.tsx"),
    false
  );
  assert.equal(
    shouldScanUiWrapperImports("apps/ui-showroom/components/ui/button.tsx"),
    true
  );
  assert.equal(
    shouldScanPath("apps/ui-showroom/registry/new-york/button.tsx"),
    false
  );
  assert.equal(shouldScanPath("apps/ui-showroom/public/r/button.json"), false);
  assert.equal(
    shouldScanPath("apps/ui-showroom/.next/server/app/page.tsx"),
    false
  );
  assert.equal(
    shouldScanPath("apps/ui-showroom/components/example.test.tsx"),
    false
  );
  assert.equal(
    shouldScanPath("apps/ui-showroom/react-experimental.d.ts"),
    false
  );
});

test("flags native button and input tags in product UI", () => {
  const source = `
    export function CustomComponent() {
      return (
        <div>
          <button type="button">Click</button>
          <input type="text" />
          <select><option>1</option></select>
          <textarea />
        </div>
      );
    }
  `;
  const findings = analyzeNativeControls(
    "apps/emp/src/views/custom.tsx",
    source
  );
  assert.equal(findings.length, 4);
  assert.equal(findings[0].rule, "native-control");
  assert.ok(findings[0].snippet.includes("<button>"));
  assert.ok(findings[1].snippet.includes("<input>"));
  assert.ok(findings[2].snippet.includes("<select>"));
  assert.ok(findings[3].snippet.includes("<textarea>"));
});

test("flags restricted UI imports like radix-ui and antd", () => {
  const source = `
    import { Dialog } from "radix-ui";
    import { Button } from "antd";
    import { Box } from "@mui/material";
  `;
  const findings = analyzeSourceFile("apps/emp/src/views/custom.tsx", source);
  const importFindings = findings.filter(
    (f) => f.rule === "no-restricted-imports"
  );
  assert.equal(importFindings.length, 3);
});

test("allows Base UI but rejects Radix inside UI wrappers", () => {
  const source = `
    import { Dialog } from "@base-ui/react/dialog";
    import { Tooltip } from "radix-ui";
  `;
  const findings = analyzeUiWrapperImports(
    "apps/ui-showroom/components/ui/dialog.tsx",
    source
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "no-restricted-imports");
  assert.ok(findings[0].snippet.includes("radix-ui"));
});

test("flags raw hex colors and inline styles", () => {
  const source = `
    export function Box() {
      return <div style={{ margin: 10 }} className="text-[#ff0000]" />;
    }
  `;
  const findings = analyzeSourceFile("apps/emp/src/views/custom.tsx", source);
  const syntaxFindings = findings.filter(
    (f) => f.rule === "no-restricted-syntax"
  );
  assert.equal(syntaxFindings.length, 2);
});

test("flags restricted dependencies in package.json", () => {
  const manifest = {
    dependencies: {
      "radix-ui": "^1.0.0",
      antd: "^5.0.0",
    },
  };
  const findings = analyzePackageFile("apps/emp/package.json", manifest);
  assert.equal(findings.length, 2);
  assert.equal(findings[0].rule, "restricted-ui-dependency");
});

test("keeps restricted showroom package dependencies visible", () => {
  const findings = analyzePackageFile("apps/ui-showroom/package.json", {
    dependencies: {
      "radix-ui": "^1.4.3",
    },
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, "apps/ui-showroom/package.json");
  assert.equal(findings[0].snippet, "radix-ui");
  assert.equal(findings[0].rule, "restricted-ui-dependency");
});
