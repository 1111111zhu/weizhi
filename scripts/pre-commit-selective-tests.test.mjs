import assert from "node:assert/strict";
import test from "node:test";

import {
  deploySystemsForTargets,
  isDocsOnlyPath,
  normalizePath,
  planPreCommitTests,
} from "./pre-commit-selective-tests.mjs";

test("maps staged applications to the same deploy systems as CI", () => {
  assert.deepEqual(
    deploySystemsForTargets(["shared", "api", "ibApi", "desktopAgent", "emp"]),
    ["api", "ib-api", "emp"]
  );
});

test("runs the Next image dependency contract for build-only repairs", () => {
  const plan = planPreCommitTests([
    "deploy/docker/Dockerfile.next-app",
    "scripts/ci/next-app-build-contract.test.mjs",
  ]);
  assert.equal(plan.runWorkflowTests, true);
  assert.equal(plan.runFullSuite, false);
  assert.deepEqual(plan.targets, []);
});

test("normalizes relative Windows-style paths", () => {
  assert.equal(
    normalizePath(String.raw`.\apps\emp\src\page.tsx`),
    "apps/emp/src/page.tsx"
  );
});

test("treats docs and markdown files as docs-only", () => {
  assert.equal(isDocsOnlyPath("docs/testing.md"), true);
  assert.equal(isDocsOnlyPath("reference/product-notes.md"), true);
  assert.equal(isDocsOnlyPath("AGENTS.md"), true);
});

test("skips workspace tests for docs-only changes", () => {
  assert.deepEqual(planPreCommitTests(["docs/testing.md"]), {
    runFormatCheck: false,
    runFullSuite: false,
    runOxlint: false,
    runUiStackGuardrails: false,
    runWorkflowTests: false,
    targets: [],
  });
});

test("skips workspace tests for local development templates", () => {
  assert.deepEqual(planPreCommitTests([".env.example", ".gitignore"]), {
    runFormatCheck: false,
    runFullSuite: false,
    runOxlint: false,
    runUiStackGuardrails: false,
    runWorkflowTests: false,
    targets: [],
  });
});

test("runs API tests for local demo backend scripts", () => {
  assert.deepEqual(
    planPreCommitTests([
      "scripts/dev-demo-api.mjs",
      "scripts/local-demo-config.mjs",
      "scripts/setup-demo-db.mjs",
    ]),
    {
      runFormatCheck: false,
      runFullSuite: false,
      runOxlint: false,
      runUiStackGuardrails: false,
      runWorkflowTests: false,
      targets: ["api"],
    }
  );
});

test("runs API tests for API fixtures without testing local upload artifacts", () => {
  assert.deepEqual(
    planPreCommitTests([
      "test-fixtures/filecheck/filecheck-demo-errors-comments.xlsx",
      "uploads-demo/working-papers/project-1/paper-1/demo.pdf",
    ]),
    {
      runFormatCheck: false,
      runFullSuite: false,
      runOxlint: false,
      runUiStackGuardrails: false,
      runWorkflowTests: false,
      targets: ["api"],
    }
  );
});

test("runs only EMP tests for EMP-only changes", () => {
  assert.deepEqual(planPreCommitTests(["apps/emp/src/views/projects.tsx"]), {
    runFormatCheck: false,
    runFullSuite: false,
    runOxlint: true,
    runUiStackGuardrails: true,
    runWorkflowTests: false,
    targets: ["emp"],
  });
});

test("runs only CMP tests for CMP-only changes", () => {
  assert.deepEqual(planPreCommitTests(["apps/cmp/src/app/page.tsx"]), {
    runFormatCheck: false,
    runFullSuite: false,
    runOxlint: true,
    runUiStackGuardrails: true,
    runWorkflowTests: false,
    targets: ["cmp"],
  });
});

test("runs only Showroom validation for Showroom changes", () => {
  assert.deepEqual(planPreCommitTests(["apps/ui-showroom/src/app/page.tsx"]), {
    runFormatCheck: false,
    runFullSuite: false,
    runOxlint: true,
    runUiStackGuardrails: true,
    runWorkflowTests: false,
    targets: ["showroom"],
  });
});

test("validates the Showroom when its registry changes", () => {
  assert.deepEqual(planPreCommitTests(["docs/design-system.registry.json"]), {
    runFormatCheck: false,
    runFullSuite: false,
    runOxlint: true,
    runUiStackGuardrails: true,
    runWorkflowTests: false,
    targets: ["showroom"],
  });
});

test("runs only TMS tests for TMS-only changes", () => {
  assert.deepEqual(planPreCommitTests(["apps/tms/src/app/page.tsx"]), {
    runFormatCheck: false,
    runFullSuite: false,
    runOxlint: true,
    runUiStackGuardrails: true,
    runWorkflowTests: false,
    targets: ["tms"],
  });
});

test("runs only intranet tests for intranet-only changes", () => {
  assert.deepEqual(planPreCommitTests(["apps/intranet/src/app/page.tsx"]), {
    runFormatCheck: false,
    runFullSuite: false,
    runOxlint: true,
    runUiStackGuardrails: true,
    runWorkflowTests: false,
    targets: ["intranet"],
  });
});

test("runs only IB tests for IB-only changes", () => {
  assert.deepEqual(planPreCommitTests(["apps/ib/src/app/page.tsx"]), {
    runFormatCheck: false,
    runFullSuite: false,
    runOxlint: false,
    runUiStackGuardrails: false,
    runWorkflowTests: false,
    targets: ["ib"],
  });
});

test("runs only IB API tests for IB API-only changes", () => {
  assert.deepEqual(planPreCommitTests(["apps/ib-api/src/main.ts"]), {
    runFormatCheck: false,
    runFullSuite: false,
    runOxlint: false,
    runUiStackGuardrails: false,
    runWorkflowTests: false,
    targets: ["ibApi"],
  });
});

test("runs desktop-agent tests for desktop app and installer script changes", () => {
  assert.deepEqual(
    planPreCommitTests([
      "apps/desktop-agent/src/server.ts",
      "scripts/desktop-agent/build-windows-installer.ps1",
    ]),
    {
      runFormatCheck: false,
      runFullSuite: false,
      runOxlint: false,
      runUiStackGuardrails: false,
      runWorkflowTests: false,
      targets: ["desktopAgent"],
    }
  );
});

test("runs every dependent workspace when shared contracts change", () => {
  assert.deepEqual(planPreCommitTests(["packages/shared/src/index.ts"]), {
    runFormatCheck: false,
    runFullSuite: false,
    runOxlint: true,
    runUiStackGuardrails: true,
    runWorkflowTests: false,
    targets: [
      "shared",
      "api",
      "desktopAgent",
      "desktopAgentDesktop",
      "desktopAgentUi",
      "ui",
      "emp",
      "cmp",
      "showroom",
      "tms",
      "intranet",
    ],
  });
});

test("runs every frontend deploy validation when shared UI changes", () => {
  assert.deepEqual(planPreCommitTests(["packages/ui/src/auth.tsx"]), {
    runFormatCheck: false,
    runFullSuite: false,
    runOxlint: true,
    runUiStackGuardrails: true,
    runWorkflowTests: false,
    targets: ["ui", "emp", "cmp", "showroom", "tms", "intranet"],
  });
});

test("runs desktop-agent UI tests for shared native UI changes", () => {
  assert.deepEqual(
    planPreCommitTests(["packages/desktop-agent-ui/src/status-header.tsx"]),
    {
      runFormatCheck: false,
      runFullSuite: false,
      runOxlint: false,
      runUiStackGuardrails: false,
      runWorkflowTests: false,
      targets: ["desktopAgentUi"],
    }
  );
});

test("validates the active Electron workspace without misclassifying it as an unknown global file", () => {
  assert.deepEqual(
    planPreCommitTests([
      "apps/desktop-agent-desktop/src/main/managed-runtime-host.ts",
    ]),
    {
      runFormatCheck: false,
      runFullSuite: false,
      runOxlint: false,
      runUiStackGuardrails: false,
      runWorkflowTests: false,
      targets: ["desktopAgentDesktop"],
    }
  );
});

test("validates global workspace configuration without a full suite", () => {
  assert.deepEqual(planPreCommitTests(["pnpm-lock.yaml"]), {
    runFormatCheck: false,
    runFullSuite: false,
    runOxlint: false,
    runUiStackGuardrails: false,
    runWorkflowTests: true,
    targets: [],
  });
});

test("validates root scripts without a full workspace suite", () => {
  assert.deepEqual(planPreCommitTests(["package.json"]), {
    runFormatCheck: false,
    runFullSuite: false,
    runOxlint: false,
    runUiStackGuardrails: false,
    runWorkflowTests: true,
    targets: [],
  });
});

test("validates workflow rules without workspace tests for pre-commit files", () => {
  assert.deepEqual(
    planPreCommitTests([
      ".dockerignore",
      ".husky/commit-msg",
      ".husky/pre-commit",
      ".husky/pre-push",
      ".lintstagedrc.json",
      "commitlint.config.mjs",
      "scripts/commitlint-config.test.mjs",
      "scripts/commit-message-guard.mjs",
      "scripts/hooks-doctor.mjs",
      "scripts/hooks-doctor.test.mjs",
      "scripts/pre-push-guard.mjs",
      "scripts/pre-commit-selective-tests.mjs",
      "scripts/repository-policy-guardrails.mjs",
      "scripts/ci/showroom-deploy.test.mjs",
      ".github/workflows/deploy.yml",
      "deploy/traefik/dynamic/routing.yml",
      "scripts/run-workspace-tests.mjs",
    ]),
    {
      runFormatCheck: false,
      runFullSuite: false,
      runOxlint: false,
      runUiStackGuardrails: false,
      runWorkflowTests: true,
      targets: [],
    }
  );
});

test("runs UI stack guardrails for guardrail files", () => {
  assert.deepEqual(
    planPreCommitTests([
      "oxlint.config.ts",
      "scripts/design-first-baseline.mjs",
      "scripts/design-first-baseline.json",
      "scripts/ui-stack-baseline-monotonic.mjs",
      "scripts/ui-stack-guardrails.mjs",
      "scripts/volatile-test-assertions.mjs",
      "scripts/ui-stack-baseline.json",
    ]),
    {
      runFormatCheck: false,
      runFullSuite: false,
      runOxlint: true,
      runUiStackGuardrails: true,
      runWorkflowTests: true,
      targets: [],
    }
  );
});

test("runs i18n guardrail logic for i18n guardrail files", () => {
  assert.deepEqual(planPreCommitTests(["scripts/i18n-static-copy.mjs"]), {
    runFormatCheck: false,
    runFullSuite: false,
    runOxlint: false,
    runUiStackGuardrails: true,
    runWorkflowTests: true,
    targets: [],
  });
});

test("tracks formatter configuration as workflow logic", () => {
  assert.deepEqual(planPreCommitTests(["oxfmt.config.ts"]), {
    runFormatCheck: true,
    runFullSuite: false,
    runOxlint: false,
    runUiStackGuardrails: false,
    runWorkflowTests: true,
    targets: [],
  });
});
