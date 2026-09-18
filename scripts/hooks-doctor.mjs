#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const { dirname, join } = path;
const repositoryRoot = import.meta.dirname;
const rootDirectory = dirname(repositoryRoot);

function check(name, passed, detail) {
  return { name, passed, detail };
}

function isHuskyHooksPath(hooksPath) {
  return (
    hooksPath?.replaceAll(String.raw`\\`, "/").endsWith(".husky/_") ?? false
  );
}

function hasExpectedPreCommitOrder(contents) {
  const policyIndex = contents.indexOf(
    "node scripts/repository-policy-guardrails.mjs"
  );
  const formatterIndex = contents.indexOf("corepack pnpm exec lint-staged");
  const testsIndex = contents.indexOf("corepack pnpm test:precommit");
  return (
    policyIndex !== -1 &&
    formatterIndex !== -1 &&
    testsIndex !== -1 &&
    policyIndex < formatterIndex &&
    formatterIndex < testsIndex
  );
}

export function assessHookSetup({
  hooksPath,
  hookFilesExist,
  hookLaunchersExist,
  lintStagedConfigExists,
  commitlintConfigExists,
  preCommitContents,
  commitMessageContents,
  prePushContents,
  manifest,
}) {
  return [
    check(
      "Git uses Husky's hook path",
      isHuskyHooksPath(hooksPath),
      hooksPath
        ? `core.hooksPath=${hooksPath}`
        : "core.hooksPath is unset; Husky has not installed its hook launcher."
    ),
    check(
      "Husky policy hook files exist",
      hookFilesExist && hookLaunchersExist,
      hookFilesExist && hookLaunchersExist
        ? "pre-commit, commit-msg, and pre-push hooks and launchers are present."
        : "Run the repository install so Husky can generate .husky/_."
    ),
    check(
      "Staged-file formatter configuration exists",
      lintStagedConfigExists,
      lintStagedConfigExists
        ? ".lintstagedrc.json is present."
        : ".lintstagedrc.json is missing."
    ),
    check(
      "Commitlint configuration exists",
      commitlintConfigExists,
      commitlintConfigExists
        ? "commitlint.config.mjs is present."
        : "commitlint.config.mjs is missing."
    ),
    check(
      "Pre-commit hook runs the expected gate",
      hasExpectedPreCommitOrder(preCommitContents),
      "Expected order: repository policy, lint-staged/Ultracite, then selective tests."
    ),
    check(
      "Commit and push hooks run repository policy",
      commitMessageContents.includes("commitlint --edit") &&
        commitMessageContents.includes("scripts/commit-message-guard.mjs") &&
        prePushContents.includes("scripts/pre-push-guard.mjs"),
      "Expected commit-msg to invoke commitlint and the metadata policy, and pre-push to invoke its Node policy script."
    ),
    check(
      "Package scripts install Husky",
      manifest.scripts?.prepare === "husky" &&
        Boolean(manifest.devDependencies?.husky) &&
        Boolean(manifest.devDependencies?.["@commitlint/cli"]) &&
        Boolean(manifest.devDependencies?.["@commitlint/config-conventional"]),
      'Expected package.json to contain "prepare": "husky" and the Husky and commitlint devDependencies.'
    ),
  ];
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDirectory,
    encoding: "utf-8",
    shell: process.platform === "win32",
  });
  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .trim();

  return {
    passed: result.status === 0 && !result.error,
    detail:
      output ||
      result.error?.message ||
      `Exit status ${result.status ?? "unknown"}.`,
  };
}

function commandCheck(name, command, args) {
  const result = runCommand(command, args);
  return check(name, result.passed, result.detail);
}

function posixShellCandidates() {
  const candidates = ["sh"];
  if (process.platform !== "win32") {
    return candidates;
  }

  const gitExecPath = spawnSync("git", ["--exec-path"], {
    cwd: rootDirectory,
    encoding: "utf-8",
    shell: true,
  }).stdout?.trim();
  if (gitExecPath) {
    const gitRoot = dirname(dirname(dirname(gitExecPath)));
    candidates.push(
      join(gitRoot, "usr", "bin", "sh.exe"),
      join(gitRoot, "bin", "sh.exe")
    );
  }

  for (const programFiles of [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
  ]) {
    if (programFiles) {
      candidates.push(
        join(programFiles, "Git", "usr", "bin", "sh.exe"),
        join(programFiles, "Git", "bin", "sh.exe")
      );
    }
  }

  return [...new Set(candidates)];
}

export function findPosixShell() {
  for (const candidate of posixShellCandidates()) {
    const result = spawnSync(candidate, ["-c", "exit 0"], {
      cwd: rootDirectory,
      encoding: "utf-8",
      shell: false,
    });
    if (result.status === 0 && !result.error) {
      return {
        passed: true,
        detail: `${candidate} can execute the Husky shell entrypoint.`,
      };
    }
  }

  return {
    passed: false,
    detail:
      "Git for Windows sh.exe is unavailable; reinstall Git for Windows or fix its installation path.",
  };
}

function readHooksPath() {
  const result = runCommand("git", ["config", "--get", "core.hooksPath"]);
  return result.passed ? result.detail : undefined;
}

function printReport(checks) {
  for (const result of checks) {
    const status = result.passed ? "ok" : "fail";
    console.log(`[${status}] ${result.name}: ${result.detail}`);
  }

  if (checks.every((result) => result.passed)) {
    console.log(
      "\nHook chain is ready: staged formatting and policy, commit-message policy, selective tests, and push policy."
    );
    return;
  }

  console.error("\nRepair steps:");
  console.error("  1. corepack enable");
  console.error("  2. corepack pnpm install");
  console.error("  3. corepack pnpm hooks:doctor");
  console.error(
    "On Windows, PowerShell, a VS Code terminal, and Git Bash are supported; Git for Windows must provide its bundled sh.exe. Do not invoke the hook through a broken WSL relay."
  );
}

function main() {
  const manifest = JSON.parse(
    readFileSync(join(rootDirectory, "package.json"), "utf-8")
  );
  const readHook = (name) => {
    const hookPath = join(rootDirectory, ".husky", name);
    return existsSync(hookPath) ? readFileSync(hookPath, "utf-8") : "";
  };
  const hookNames = ["pre-commit", "commit-msg", "pre-push"];
  const posixShell = findPosixShell();
  const checks = [
    check(
      "Repository root is a Git worktree",
      existsSync(join(rootDirectory, ".git")),
      rootDirectory
    ),
    ...assessHookSetup({
      hooksPath: readHooksPath(),
      hookFilesExist: hookNames.every((name) =>
        existsSync(join(rootDirectory, ".husky", name))
      ),
      hookLaunchersExist: hookNames.every((name) =>
        existsSync(join(rootDirectory, ".husky", "_", name))
      ),
      lintStagedConfigExists: existsSync(
        join(rootDirectory, ".lintstagedrc.json")
      ),
      commitlintConfigExists: existsSync(
        join(rootDirectory, "commitlint.config.mjs")
      ),
      preCommitContents: readHook("pre-commit"),
      commitMessageContents: readHook("commit-msg"),
      prePushContents: readHook("pre-push"),
      manifest,
    }),
    check("POSIX shell is available", posixShell.passed, posixShell.detail),
    commandCheck("Corepack is available", "corepack", ["--version"]),
    commandCheck("Corepack resolves pnpm", "corepack", ["pnpm", "--version"]),
    commandCheck("Corepack resolves lint-staged", "corepack", [
      "pnpm",
      "exec",
      "lint-staged",
      "--version",
    ]),
    commandCheck("Corepack resolves commitlint", "corepack", [
      "pnpm",
      "exec",
      "commitlint",
      "--version",
    ]),
    commandCheck("Corepack resolves Ultracite", "corepack", [
      "pnpm",
      "exec",
      "ultracite",
      "--version",
    ]),
  ];

  printReport(checks);
  process.exitCode = checks.every((result) => result.passed) ? 0 : 1;
}

if (process.argv[1] === import.meta.filename) {
  main();
}
