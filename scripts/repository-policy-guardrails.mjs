#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "packageManager",
  "pnpm",
];
const FORBIDDEN_DIRECTORIES = new Set([
  ".nyc_output",
  "coverage",
  "playwright-report",
  "test-results",
]);
const FORBIDDEN_EXTENSIONS = new Set([
  ".db",
  ".key",
  ".log",
  ".p12",
  ".pfx",
  ".py",
  ".sqlite",
  ".sqlite3",
]);
const FORBIDDEN_FILE_NAMES = new Set([
  ".ds_store",
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "thumbs.db",
  "yarn.lock",
]);

function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { encoding: "utf-8" });
  if (result.status === 0) {
    return result.stdout;
  }
  if (allowFailure) {
    return;
  }
  throw new Error(result.stderr || `git ${args.join(" ")} failed`);
}

export function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function basename(filePath) {
  return normalizePath(filePath).split("/").at(-1) ?? "";
}

function extension(filePath) {
  const name = basename(filePath).toLowerCase();
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot);
}

export function forbiddenFileReason(filePath) {
  const normalized = normalizePath(filePath);
  const name = basename(normalized);
  const lowerName = name.toLowerCase();
  const segments = normalized.toLowerCase().split("/");

  if (
    lowerName === ".env" ||
    (lowerName.startsWith(".env.") &&
      !lowerName.endsWith(".example") &&
      !lowerName.endsWith(".template"))
  ) {
    return "environment files must stay local; commit an example or template instead";
  }
  if (FORBIDDEN_FILE_NAMES.has(lowerName)) {
    return "unsupported package-manager output and operating-system metadata must not be committed";
  }
  if (/^(?:\.prettierrc(?:\..+)?|prettier\.config\..+)$/.test(lowerName)) {
    return "Prettier configuration is prohibited; use the root Ultracite and Oxfmt configuration";
  }
  if (FORBIDDEN_EXTENSIONS.has(extension(normalized))) {
    return "local data, credentials, logs, and generated runtime files must not be committed";
  }
  if (segments.some((segment) => FORBIDDEN_DIRECTORIES.has(segment))) {
    return "generated test and coverage output must not be committed";
  }
  if (/^screenshot(?:[-_.].*)?\.(?:jpe?g|png|webp)$/i.test(name)) {
    return "temporary screenshots must stay outside the repository";
  }
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)])
  );
}

export function dependencyFingerprint(contents) {
  if (contents === undefined) {
    return null;
  }
  try {
    const manifest = JSON.parse(contents);
    return JSON.stringify(
      stableValue(
        Object.fromEntries(
          DEPENDENCY_FIELDS.filter((field) => field in manifest).map(
            (field) => [field, manifest[field]]
          )
        )
      )
    );
  } catch {
    return "invalid-package-json";
  }
}

export function hasDirectPrettierDependency(contents) {
  if (contents === undefined) {
    return false;
  }
  try {
    const manifest = JSON.parse(contents);
    return DEPENDENCY_FIELDS.some(
      (field) =>
        manifest[field] &&
        typeof manifest[field] === "object" &&
        "prettier" in manifest[field]
    );
  } catch {
    return false;
  }
}

export function repositoryPolicyViolations({
  branch,
  changedFiles,
  presentFiles,
  readHeadFile,
  readIndexFile,
}) {
  const violations = [];
  const changed = changedFiles.map(normalizePath);
  const present = presentFiles.map(normalizePath);
  const presentSet = new Set(present);

  if (!branch) {
    violations.push(
      "Commits from a detached HEAD are blocked; create or switch to a task branch."
    );
  } else if (branch === "main") {
    violations.push(
      "Direct commits on main are blocked; create a task branch in an isolated worktree."
    );
  }

  for (const file of present) {
    const reason = forbiddenFileReason(file);
    if (reason) {
      violations.push(`${file}: ${reason}.`);
    }
  }

  const changedManifests = changed.filter(
    (file) => basename(file) === "package.json"
  );
  const dependencyChanges = changedManifests.filter(
    (file) =>
      dependencyFingerprint(readHeadFile(file)) !==
      dependencyFingerprint(readIndexFile(file))
  );
  if (dependencyChanges.length > 0 && !presentSet.has("pnpm-lock.yaml")) {
    violations.push(
      `Dependency metadata changed in ${dependencyChanges.join(
        ", "
      )}, but pnpm-lock.yaml is not staged.`
    );
  }
  for (const file of changedManifests) {
    if (hasDirectPrettierDependency(readIndexFile(file))) {
      violations.push(
        `${file}: direct Prettier dependencies are prohibited; use Ultracite and Oxfmt.`
      );
    }
  }

  if (
    changed.includes("apps/api/prisma/schema.prisma") &&
    !present.some((file) =>
      /^apps\/api\/prisma\/migrations\/[^/]+\/migration\.sql$/.test(file)
    )
  ) {
    violations.push(
      "apps/api/prisma/schema.prisma changed without a staged Prisma migration."
    );
  }

  return violations;
}

function listStagedFiles(diffFilter) {
  return runGit([
    "diff",
    "--cached",
    "--name-only",
    `--diff-filter=${diffFilter}`,
  ])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function readGitFile(revision, filePath) {
  return runGit(["show", `${revision}:${filePath}`], { allowFailure: true });
}

function main() {
  const violations = repositoryPolicyViolations({
    branch: runGit(["branch", "--show-current"]).trim(),
    changedFiles: listStagedFiles("ACMRD"),
    presentFiles: listStagedFiles("ACMR"),
    readHeadFile: (filePath) => readGitFile("HEAD", filePath),
    readIndexFile: (filePath) => readGitFile("", filePath),
  });

  if (violations.length === 0) {
    console.log("repository-policy: staged repository constraints passed");
    return;
  }

  console.error("repository-policy: commit blocked\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] === import.meta.filename) {
  main();
}
