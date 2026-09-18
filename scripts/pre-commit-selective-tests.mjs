#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const { join } = path;
const TARGETS = {
  shared: "@project-wing/shared",
  api: "@project-wing/api",
  ibApi: "@project-wing/ib-api",
  desktopAgent: "@project-wing/desktop-agent",
  desktopAgentDesktop: "@project-wing/desktop-agent-desktop",
  desktopAgentUi: "@project-wing/desktop-agent-ui",
  ui: "@project-wing/ui",
  emp: "@project-wing/emp",
  cmp: "@project-wing/cmp",
  showroom: "@project-wing/ui-showroom",
  tms: "@project-wing/tms",
  intranet: "@project-wing/intranet",
  ib: "@project-wing/ib",
};
const DEPLOY_SYSTEMS = {
  api: "api",
  ibApi: "ib-api",
  emp: "emp",
  cmp: "cmp",
  showroom: "showroom",
  tms: "tms",
  intranet: "intranet",
  ib: "ib",
};
const TARGET_ORDER = [
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
  "ibApi",
  "ib",
];
const DOC_PATHS = ["docs/", "reference/"];
const LOCAL_DEVELOPMENT_CONFIG_FILES = [".env.example", ".gitignore"];
const LOCAL_DEVELOPMENT_ARTIFACT_DIRECTORIES = ["uploads-demo/"];
const LOCAL_DEVELOPMENT_API_FILES = [
  "scripts/dev-demo-api.mjs",
  "scripts/local-demo-config.mjs",
  "scripts/setup-demo-db.mjs",
];
const API_TEST_FIXTURE_DIRECTORIES = ["test-fixtures/"];
const WORKFLOW_TEST_FILES = [
  ".dockerignore",
  ".husky/pre-commit",
  ".husky/commit-msg",
  ".husky/pre-push",
  ".lintstagedrc.json",
  "commitlint.config.mjs",
  ".github/workflows/deploy.yml",
  ".github/workflows/desktop-agent-native.yml",
  ".github/workflows/oss-image-bundle-pilot.yml",
  ".github/workflows/runner-smoke.yml",
  ".github/workflows/runtime-diagnostics.yml",
  "deploy/docker/Dockerfile.next-app",
  "scripts/ci/next-app-build-contract.test.mjs",
  "deploy/traefik/dynamic.yml",
  "deploy/traefik/traefik.yml",
  "docker-compose.development.yml",
  "scripts/ci/build-registry-images.sh",
  "scripts/ci/publish-github-deployments.sh",
  "scripts/ci/blue-green-controller.sh",
  "scripts/ci/resolve-deploy-env.sh",
  "oxfmt.config.ts",
  "oxlint.config.ts",
  "scripts/pre-commit-selective-tests.mjs",
  "scripts/pre-commit-selective-tests.test.mjs",
  "scripts/hooks-doctor.mjs",
  "scripts/hooks-doctor.test.mjs",
  "scripts/commit-message-guard.mjs",
  "scripts/commit-message-guard.test.mjs",
  "scripts/commitlint-config.test.mjs",
  "scripts/pre-push-guard.mjs",
  "scripts/pre-push-guard.test.mjs",
  "scripts/repository-policy-guardrails.mjs",
  "scripts/repository-policy-guardrails.test.mjs",
  "scripts/ci/run-cmp-api-validation.sh",
  "scripts/ci/run-cmp-ui-validation.sh",
  "scripts/ci/run-scoped-validation.sh",
  "scripts/ci/with-validation-postgres.sh",
  "scripts/run-workspace-tests.mjs",
  "scripts/run-workspace-tests.test.mjs",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
];
const RETIRED_WORKFLOW_TEST_FILES = ["scripts/ci/showroom-deploy.test.mjs"];
const WORKFLOW_TEST_DIRECTORIES = ["deploy/traefik/"];
const FRONTEND_TARGETS = ["emp", "cmp", "showroom", "tms", "intranet"];
const UI_STACK_GUARDRAIL_FILES = [
  "design-first.boundary.json",
  "scripts/design-first-baseline.json",
  "scripts/design-first-baseline.mjs",
  "scripts/design-first-baseline.test.mjs",
  "scripts/i18n-static-copy.mjs",
  "scripts/i18n-static-copy.test.mjs",
  "scripts/ui-stack-guardrails.mjs",
  "scripts/ui-stack-guardrails.test.mjs",
  "scripts/ui-stack-baseline.json",
  "scripts/ui-stack-baseline-monotonic.mjs",
  "scripts/ui-stack-baseline-monotonic.test.mjs",
  "scripts/volatile-test-assertions.mjs",
  "scripts/volatile-test-assertions.test.mjs",
];

function addAllTargets(targets) {
  for (const target of [
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
  ]) {
    targets.add(target);
  }
}

export function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

export function isDocsOnlyPath(filePath) {
  return (
    DOC_PATHS.some((prefix) => filePath.startsWith(prefix)) ||
    filePath === "AGENTS.md" ||
    filePath === "README.md" ||
    filePath.endsWith(".md")
  );
}

export function planPreCommitTests(files) {
  const targets = new Set();
  let runFormatCheck = false;
  let runFullSuite = false;
  let runOxlint = false;
  let runUiStackGuardrails = false;
  let runWorkflowTests = false;

  for (const rawFile of files) {
    const file = normalizePath(rawFile);

    if (
      LOCAL_DEVELOPMENT_ARTIFACT_DIRECTORIES.some((directory) =>
        file.startsWith(directory)
      )
    ) {
      continue;
    }
    if (LOCAL_DEVELOPMENT_CONFIG_FILES.includes(file)) {
      continue;
    }
    if (
      API_TEST_FIXTURE_DIRECTORIES.some((directory) =>
        file.startsWith(directory)
      )
    ) {
      targets.add("api");
    } else if (LOCAL_DEVELOPMENT_API_FILES.includes(file)) {
      targets.add("api");
    } else if (
      WORKFLOW_TEST_FILES.includes(file) ||
      RETIRED_WORKFLOW_TEST_FILES.includes(file) ||
      WORKFLOW_TEST_DIRECTORIES.some((directory) => file.startsWith(directory))
    ) {
      runWorkflowTests = true;
      runOxlint ||= file === "oxlint.config.ts";
      runFormatCheck ||= file === "oxfmt.config.ts";
    } else if (
      UI_STACK_GUARDRAIL_FILES.includes(file) ||
      file.startsWith("scripts/design-first/") ||
      file.startsWith(".design-first/")
    ) {
      runWorkflowTests = true;
      runUiStackGuardrails = true;
    } else if (file.startsWith("packages/shared/")) {
      addAllTargets(targets);
    } else if (file.startsWith("packages/ui/")) {
      targets.add("ui");
      for (const target of FRONTEND_TARGETS) {
        targets.add(target);
      }
    } else if (file.startsWith("packages/desktop-agent-ui/")) {
      targets.add("desktopAgentUi");
    } else if (file.startsWith("apps/api/")) {
      targets.add("api");
    } else if (file.startsWith("apps/ib-api/")) {
      targets.add("ibApi");
    } else if (file.startsWith("apps/desktop-agent/")) {
      targets.add("desktopAgent");
    } else if (file.startsWith("apps/desktop-agent-desktop/")) {
      targets.add("desktopAgentDesktop");
    } else if (file.startsWith("scripts/desktop-agent/")) {
      targets.add("desktopAgent");
    } else if (file.startsWith("apps/emp/")) {
      targets.add("emp");
    } else if (file.startsWith("apps/cmp/")) {
      targets.add("cmp");
    } else if (
      file.startsWith("apps/ui-showroom/") ||
      file === "docs/design-system.registry.json"
    ) {
      targets.add("showroom");
    } else if (file.startsWith("apps/tms/")) {
      targets.add("tms");
    } else if (file.startsWith("apps/intranet/")) {
      targets.add("intranet");
    } else if (file.startsWith("apps/ib/")) {
      targets.add("ib");
    } else if (!isDocsOnlyPath(file)) {
      runFullSuite = true;
    }
  }

  runOxlint ||=
    runFullSuite || FRONTEND_TARGETS.some((target) => targets.has(target));

  runUiStackGuardrails ||=
    runFullSuite || FRONTEND_TARGETS.some((target) => targets.has(target));

  return {
    runFormatCheck,
    runFullSuite,
    runOxlint,
    runUiStackGuardrails,
    runWorkflowTests,
    targets: TARGET_ORDER.filter((target) => targets.has(target)),
  };
}

function getStagedFiles() {
  const result = spawnSync("git", ["diff", "--cached", "--name-only"], {
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || "Failed to read staged files");
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function runCommand(command, args, environment = {}) {
  const executable = resolveCommand(command);
  const result = spawnSync(executable, args, {
    env: { ...process.env, ...environment },
    stdio: "inherit",
    shell: process.platform === "win32" && executable === command,
  });
  if (result.error) {
    console.error(result.error.message);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolveCommand(command) {
  if (process.platform !== "win32" || command !== "bash") {
    return command;
  }

  const candidates = [
    join(process.env.ProgramFiles ?? "C:/Program Files", "Git/bin/bash.exe"),
    join(
      process.env["ProgramFiles(x86)"] ?? "C:/Program Files (x86)",
      "Git/bin/bash.exe"
    ),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? command;
}

export function deploySystemsForTargets(targets) {
  return targets.flatMap((target) => DEPLOY_SYSTEMS[target] ?? []);
}

function runLocalTargetValidation(target) {
  console.log(`\npre-commit: running ${TARGETS[target]} tests`);
  runCommand("corepack", [
    "pnpm",
    "--filter",
    TARGETS[target],
    target === "desktopAgent" ? "test:ci" : "test",
  ]);
}

export function runPreCommitTests(files) {
  const plan = planPreCommitTests(files);

  console.log("\npre-commit: validating volatile design assertions");
  runCommand("node", ["scripts/volatile-test-assertions.mjs"]);

  if (plan.runWorkflowTests) {
    console.log("\npre-commit: validating pre-commit selection rules");
    runCommand("node", [
      "--test",
      "scripts/commitlint-config.test.mjs",
      "scripts/pre-commit-selective-tests.test.mjs",
      "scripts/commit-message-guard.test.mjs",
      "scripts/hooks-doctor.test.mjs",
      "scripts/i18n-static-copy.test.mjs",
      "scripts/pre-push-guard.test.mjs",
      "scripts/repository-policy-guardrails.test.mjs",
      "scripts/design-first-baseline.test.mjs",
      "scripts/ui-stack-baseline-monotonic.test.mjs",
      "scripts/ui-stack-guardrails.test.mjs",
      "scripts/volatile-test-assertions.test.mjs",
      "scripts/run-workspace-tests.test.mjs",
      "scripts/ci/next-app-build-contract.test.mjs",
    ]);
    runCommand("bash", ["-n", "scripts/ci/run-cmp-api-validation.sh"]);
    runCommand("bash", ["-n", "scripts/ci/run-cmp-ui-validation.sh"]);
    runCommand("bash", ["-n", "scripts/ci/run-scoped-validation.sh"]);
    runCommand("bash", ["-n", "scripts/ci/with-validation-postgres.sh"]);
  }

  const deploySystems = deploySystemsForTargets(plan.targets);
  if (plan.runFullSuite) {
    console.log("\npre-commit: global files changed; running full test suite");
    runCommand("corepack", ["pnpm", "test"]);
    return;
  }

  if (plan.targets.length === 0) {
    console.log("\npre-commit: no workspace tests needed for staged files");
    return;
  }

  const needsCmpApiValidation = deploySystems.includes("api");

  if (needsCmpApiValidation) {
    console.log(
      "\npre-commit: running fast CMP/API validation (same checks as CI)"
    );
    const validationArgs = ["scripts/ci/run-cmp-api-validation.sh", "fast"];
    runCommand("bash", validationArgs, {
      PROJECTWING_TEST_ONLY: "true",
      PROJECTWING_VALIDATION_BASE_REF: "HEAD",
    });
  } else if (deploySystems.includes("cmp")) {
    console.log("\npre-commit: running fast CMP UI validation");
    const validationArgs = ["scripts/ci/run-cmp-ui-validation.sh"];
    runCommand("bash", validationArgs, {
      PROJECTWING_TEST_ONLY: "true",
      PROJECTWING_VALIDATION_BASE_REF: "HEAD",
    });
  }

  const remainingDeploySystems = deploySystems.filter(
    (system) => system !== "api" && system !== "cmp"
  );
  if (remainingDeploySystems.length > 0) {
    console.log(
      "\npre-commit: running CI scoped validation for remaining systems"
    );
    const validationArgs = [
      "scripts/ci/run-scoped-validation.sh",
      remainingDeploySystems.join(","),
    ];
    runCommand("bash", validationArgs, {
      PROJECTWING_TEST_ONLY: "true",
      PROJECTWING_VALIDATION_BASE_REF: "HEAD",
    });
  }

  for (const target of plan.targets) {
    if (!(target in DEPLOY_SYSTEMS)) {
      runLocalTargetValidation(target);
    }
  }
}

if (process.argv[1] === import.meta.filename) {
  runPreCommitTests(getStagedFiles());
}
