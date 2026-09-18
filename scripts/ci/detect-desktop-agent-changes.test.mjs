import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  detectDesktopAgentChanges,
  detectDesktopAgentChangesFromGit,
  extractLockfileImporter,
  isUnavailablePreviousRevision,
} from "./detect-desktop-agent-changes.mjs";

const ROOT_PACKAGE = JSON.stringify({ packageManager: "pnpm@11.5.0" });
const ROOT_PACKAGE_WITH_SCRIPT = JSON.stringify({
  packageManager: "pnpm@11.5.0",
  scripts: { format: "oxfmt ." },
});

test("direct Agent and desktop contract paths trigger a build", () => {
  for (const file of [
    "apps/desktop-agent/runtime/ProjectWing.DesktopAgent.Runtime/Program.cs",
    "apps/desktop-agent-desktop/src/main/index.ts",
    "scripts/desktop-agent/build-macos-runtime.sh",
    "deploy/docker/Dockerfile.desktop-agent-release",
    "packages/shared/src/desktop.ts",
    "packages/shared/package.json",
    "packages/shared/tsconfig.json",
    "tsconfig.base.json",
    "pnpm-workspace.yaml",
  ]) {
    assert.equal(detect({ changedFiles: [file] }).changed, true, file);
  }
});

test("ordinary applications and shared business contracts do not trigger", () => {
  const result = detect({
    changedFiles: [
      "apps/cmp/src/components/cmp-clients-view.tsx",
      "apps/api/src/cmp/cmp.service.ts",
      "packages/shared/src/index.ts",
    ],
  });
  assert.deepEqual(result, { changed: false, reason: "no-agent-impact" });
});

test("root package scripts do not trigger when packageManager is unchanged", () => {
  const result = detect({
    changedFiles: ["package.json"],
    beforeRootPackage: ROOT_PACKAGE,
    afterRootPackage: ROOT_PACKAGE_WITH_SCRIPT,
  });
  assert.equal(result.changed, false);
});

test("root packageManager changes trigger", () => {
  const result = detect({
    changedFiles: ["package.json"],
    beforeRootPackage: ROOT_PACKAGE,
    afterRootPackage: JSON.stringify({ packageManager: "pnpm@12.0.0" }),
  });
  assert.deepEqual(result, {
    changed: true,
    reason: "package-manager-changed",
  });
});

test("unrelated lockfile importer changes do not trigger", () => {
  const result = detect({
    changedFiles: ["pnpm-lock.yaml"],
    beforeLockfile: makeLockfile({ cmp: "react@19.2.5" }),
    afterLockfile: makeLockfile({ cmp: "react@19.2.6" }),
  });
  assert.deepEqual(result, { changed: false, reason: "no-agent-impact" });
});

test("Desktop Agent lockfile importer changes trigger", () => {
  const result = detect({
    changedFiles: ["pnpm-lock.yaml"],
    beforeLockfile: makeLockfile({ agent: "typescript@6.0.1" }),
    afterLockfile: makeLockfile({ agent: "typescript@6.0.2" }),
  });
  assert.deepEqual(result, {
    changed: true,
    reason: "lock-importer-changed:apps/desktop-agent",
  });
});

test("Electron Desktop Agent lockfile importer changes trigger", () => {
  const result = detect({
    changedFiles: ["pnpm-lock.yaml"],
    beforeLockfile: makeLockfile({ electron: "electron@43.4.0" }),
    afterLockfile: makeLockfile({ electron: "electron@43.4.1" }),
  });
  assert.deepEqual(result, {
    changed: true,
    reason: "lock-importer-changed:apps/desktop-agent-desktop",
  });
});

test("shared lockfile importer changes trigger", () => {
  const result = detect({
    changedFiles: ["pnpm-lock.yaml"],
    beforeLockfile: makeLockfile({ shared: "zod@4.1.12" }),
    afterLockfile: makeLockfile({ shared: "zod@4.1.13" }),
  });
  assert.deepEqual(result, {
    changed: true,
    reason: "lock-importer-changed:packages/shared",
  });
});

test("lockfile importer extraction stops at the next importer", () => {
  const lockfile = makeLockfile({ agent: "typescript@6.0.2" });
  const section = extractLockfileImporter(lockfile, "apps/desktop-agent");
  assert.match(section, /typescript@6\.0\.2/);
  assert.doesNotMatch(section, /react@19\.2\.6/);
});

test("missing and all-zero previous revisions are unavailable", () => {
  assert.equal(isUnavailablePreviousRevision(), true);
  assert.equal(isUnavailablePreviousRevision("0000000000"), true);
  assert.equal(isUnavailablePreviousRevision("abc123"), false);
});

test("an invalid previous Git revision triggers conservatively", () => {
  const repository = mkdtempSync(
    path.join(tmpdir(), "projectwing-agent-scope-")
  );
  try {
    execGit(repository, "init");
    execGit(repository, "config", "user.email", "ci@example.com");
    execGit(repository, "config", "user.name", "CI");
    writeFileSync(path.join(repository, "README.md"), "test\n");
    execGit(repository, "add", "README.md");
    execGit(repository, "commit", "-m", "initial");
    const after = execGit(repository, "rev-parse", "HEAD").trim();

    assert.deepEqual(
      detectDesktopAgentChangesFromGit({
        before: "missing-revision",
        after,
        cwd: repository,
      }),
      { changed: true, reason: "previous-revision-unavailable" }
    );
  } finally {
    rmSync(repository, { force: true, recursive: true });
  }
});

test("a non-ASCII Desktop Agent path reported by Git triggers", () => {
  const repository = mkdtempSync(
    path.join(tmpdir(), "projectwing-agent-unicode-")
  );
  try {
    execGit(repository, "init");
    execGit(repository, "config", "user.email", "ci@example.com");
    execGit(repository, "config", "user.name", "CI");
    writeFileSync(path.join(repository, "README.md"), "test\n");
    execGit(repository, "add", "README.md");
    execGit(repository, "commit", "-m", "initial");
    const before = execGit(repository, "rev-parse", "HEAD").trim();

    const agentDirectory = path.join(
      repository,
      "apps",
      "desktop-agent",
      "src"
    );
    mkdirSync(agentDirectory, { recursive: true });
    writeFileSync(path.join(agentDirectory, "服务.ts"), "export {};\n");
    execGit(repository, "add", ".");
    execGit(repository, "commit", "-m", "add unicode Agent source");
    const after = execGit(repository, "rev-parse", "HEAD").trim();

    assert.deepEqual(
      detectDesktopAgentChangesFromGit({ before, after, cwd: repository }),
      { changed: true, reason: "direct:apps/desktop-agent/src/服务.ts" }
    );
  } finally {
    rmSync(repository, { force: true, recursive: true });
  }
});

function detect(overrides) {
  return detectDesktopAgentChanges({
    changedFiles: [],
    beforeRootPackage: ROOT_PACKAGE,
    afterRootPackage: ROOT_PACKAGE,
    beforeLockfile: makeLockfile(),
    afterLockfile: makeLockfile(),
    ...overrides,
  });
}

function makeLockfile({
  agent = "typescript@6.0.2",
  electron = "electron@43.4.1",
  shared = "zod@4.1.13",
  cmp = "react@19.2.6",
} = {}) {
  return `lockfileVersion: '9.0'

importers:

  apps/cmp:
    dependencies:
      react:
        version: ${cmp}

  apps/desktop-agent:
    devDependencies:
      typescript:
        version: ${agent}

  apps/desktop-agent-desktop:
    devDependencies:
      electron:
        version: ${electron}

  packages/shared:
    dependencies:
      zod:
        version: ${shared}

packages:
  placeholder: {}
`;
}

function execGit(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    windowsHide: true,
  });
}
