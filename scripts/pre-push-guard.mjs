#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BRANCH_PATTERN =
  /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const ZERO_SHA_PATTERN = /^0+$/;

function runGit(args) {
  return spawnSync("git", args, { encoding: "utf-8" });
}

export function parsePushUpdates(contents) {
  return contents
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
      return { localRef, localSha, remoteRef, remoteSha };
    });
}

export function pushPolicyViolations({
  updates,
  remoteMainSha,
  isAncestor: isAncestorCheck,
}) {
  const violations = [];
  const branchUpdates = updates.filter(
    ({ localSha, remoteRef }) =>
      remoteRef?.startsWith("refs/heads/") &&
      localSha &&
      !ZERO_SHA_PATTERN.test(localSha)
  );

  for (const update of branchUpdates) {
    const branch = update.remoteRef.slice("refs/heads/".length);
    if (branch === "main") {
      violations.push(
        "Direct pushes to main are blocked; merge a pull request."
      );
      continue;
    }
    if (!BRANCH_PATTERN.test(branch)) {
      violations.push(
        `${branch}: use <type>/<imperative-kebab-summary> with a supported Conventional Commit type.`
      );
    }
    if (remoteMainSha && !isAncestorCheck(remoteMainSha, update.localSha)) {
      violations.push(
        `${branch}: the pushed commit does not contain the current remote main; fetch and rebase or merge main first.`
      );
    }
  }

  return violations;
}

function resolveRemoteMainSha(remote) {
  const result = runGit(["ls-remote", "--heads", remote, "refs/heads/main"]);
  if (result.status !== 0) {
    throw new Error(
      result.stderr || `Unable to read refs/heads/main from ${remote}.`
    );
  }
  return result.stdout.trim().split(/\s+/)[0] || undefined;
}

function isAncestor(ancestor, descendant) {
  return (
    runGit(["merge-base", "--is-ancestor", ancestor, descendant]).status === 0
  );
}

function main() {
  const remote = process.argv.at(2);
  const updates = parsePushUpdates(readFileSync(0, "utf-8"));
  const hasBranchUpdate = updates.some(
    ({ localSha, remoteRef }) =>
      remoteRef?.startsWith("refs/heads/") &&
      localSha &&
      !ZERO_SHA_PATTERN.test(localSha)
  );
  if (!hasBranchUpdate) {
    return;
  }

  let remoteMainSha;
  try {
    remoteMainSha = resolveRemoteMainSha(remote);
  } catch (error) {
    console.error(`pre-push: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const violations = pushPolicyViolations({
    updates,
    remoteMainSha,
    isAncestor,
  });
  if (violations.length === 0) {
    return;
  }

  console.error("pre-push: push blocked\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] === import.meta.filename) {
  main();
}
