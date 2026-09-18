import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const DIRECT_TRIGGER_PATTERNS = [
  /^apps\/desktop-agent\//,
  /^apps\/desktop-agent-desktop\//,
  /^scripts\/desktop-agent\//,
  /^deploy\/docker\/Dockerfile\.desktop-agent-release$/,
  /^packages\/shared\/src\/desktop\.ts$/,
  /^packages\/shared\/src\/desktop\//,
  /^packages\/shared\/package\.json$/,
  /^packages\/shared\/tsconfig\.json$/,
  /^pnpm-workspace\.yaml$/,
  /^tsconfig\.base\.json$/,
];
const RELEVANT_LOCKFILE_IMPORTERS = [
  "apps/desktop-agent",
  "apps/desktop-agent-desktop",
  "packages/shared",
];

export function detectDesktopAgentChanges({
  changedFiles,
  beforeRootPackage,
  afterRootPackage,
  beforeLockfile,
  afterLockfile,
}) {
  const normalizedFiles = changedFiles.map(normalizePath);
  const directTrigger = normalizedFiles.find((file) =>
    DIRECT_TRIGGER_PATTERNS.some((pattern) => pattern.test(file))
  );

  if (directTrigger) {
    return { changed: true, reason: `direct:${directTrigger}` };
  }

  if (normalizedFiles.includes("package.json")) {
    const packageManagerComparison = comparePackageManager(
      beforeRootPackage,
      afterRootPackage
    );
    if (!packageManagerComparison.valid) {
      return { changed: true, reason: "package-manager-unreadable" };
    }
    if (packageManagerComparison.changed) {
      return { changed: true, reason: "package-manager-changed" };
    }
  }

  if (normalizedFiles.includes("pnpm-lock.yaml")) {
    if (
      beforeLockfile === null ||
      beforeLockfile === undefined ||
      afterLockfile === null ||
      afterLockfile === undefined
    ) {
      return { changed: true, reason: "lockfile-unavailable" };
    }

    for (const importer of RELEVANT_LOCKFILE_IMPORTERS) {
      const beforeImporter = extractLockfileImporter(beforeLockfile, importer);
      const afterImporter = extractLockfileImporter(afterLockfile, importer);
      if (
        beforeImporter === null ||
        beforeImporter === undefined ||
        afterImporter === null ||
        afterImporter === undefined
      ) {
        return {
          changed: true,
          reason: `lock-importer-unavailable:${importer}`,
        };
      }
      if (beforeImporter !== afterImporter) {
        return { changed: true, reason: `lock-importer-changed:${importer}` };
      }
    }
  }

  return { changed: false, reason: "no-agent-impact" };
}

export function extractLockfileImporter(lockfile, importer) {
  const lines = normalizeText(lockfile).split("\n");
  const importerLine = `  ${importer}:`;
  const start = lines.indexOf(importerLine);
  if (start === -1) {
    return null;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^ {2}\S.*:$/.test(line) || /^\S/.test(line)) {
      end = index;
      break;
    }
  }

  return lines.slice(start, end).join("\n").trimEnd();
}

export function isUnavailablePreviousRevision(revision) {
  return !revision || /^0+$/.test(revision);
}

export function detectDesktopAgentChangesFromGit({
  before,
  after,
  cwd = process.cwd(),
}) {
  if (
    isUnavailablePreviousRevision(before) ||
    !gitRevisionExists(before, cwd)
  ) {
    return { changed: true, reason: "previous-revision-unavailable" };
  }
  if (!after || !gitRevisionExists(after, cwd)) {
    return { changed: true, reason: "current-revision-unavailable" };
  }

  const changedFiles = runGit(
    ["diff", "--name-only", "--no-renames", "-z", before, after],
    cwd
  )
    .split("\0")
    .filter(Boolean);
  const needsRootPackage = changedFiles.some(
    (file) => normalizePath(file) === "package.json"
  );
  const needsLockfile = changedFiles.some(
    (file) => normalizePath(file) === "pnpm-lock.yaml"
  );

  return detectDesktopAgentChanges({
    changedFiles,
    beforeRootPackage: needsRootPackage
      ? readGitFile(before, "package.json", cwd)
      : null,
    afterRootPackage: needsRootPackage
      ? readGitFile(after, "package.json", cwd)
      : null,
    beforeLockfile: needsLockfile
      ? readGitFile(before, "pnpm-lock.yaml", cwd)
      : null,
    afterLockfile: needsLockfile
      ? readGitFile(after, "pnpm-lock.yaml", cwd)
      : null,
  });
}

function comparePackageManager(beforeContent, afterContent) {
  try {
    if (
      beforeContent === null ||
      beforeContent === undefined ||
      afterContent === null ||
      afterContent === undefined
    ) {
      return { valid: false, changed: true };
    }
    const beforePackage = JSON.parse(beforeContent);
    const afterPackage = JSON.parse(afterContent);
    return {
      valid: true,
      changed: beforePackage.packageManager !== afterPackage.packageManager,
    };
  } catch {
    return { valid: false, changed: true };
  }
}

function gitRevisionExists(revision, cwd) {
  return (
    spawnSync("git", ["cat-file", "-e", `${revision}^{commit}`], {
      cwd,
      encoding: "utf-8",
      windowsHide: true,
    }).status === 0
  );
}

function readGitFile(revision, file, cwd) {
  const result = spawnSync("git", ["show", `${revision}:${file}`], {
    cwd,
    encoding: "utf-8",
    windowsHide: true,
  });
  return result.status === 0 ? result.stdout : null;
}

function runGit(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
}

function normalizePath(value) {
  return value.trim().replaceAll("\\", "/");
}

function normalizeText(value) {
  return value.replaceAll("\r\n", "\n");
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function runCli() {
  const before = readArgument("--before");
  const after = readArgument("--after");
  const result = detectDesktopAgentChangesFromGit({ before, after });
  process.stdout.write(
    `changed=${result.changed ? "true" : "false"}\nreason=${result.reason}\n`
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runCli();
}
