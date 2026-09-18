import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ZERO_SHA = /^0+$/;

function usableSha(value) {
  return Boolean(value && !ZERO_SHA.test(value));
}

export function selectDeployDiffBase({
  after,
  before,
  commitExists,
  isAncestor,
  latestSuccessfulSha,
}) {
  const fallback = before ?? "";

  if (!usableSha(latestSuccessfulSha)) {
    return {
      base: fallback,
      reason: "no-successful-push-deployment",
      source: "push-before",
    };
  }
  if (!commitExists(latestSuccessfulSha)) {
    return {
      base: fallback,
      reason: "successful-deployment-sha-unavailable",
      source: "push-before",
    };
  }
  if (!isAncestor(latestSuccessfulSha, after)) {
    return {
      base: fallback,
      reason: "successful-deployment-sha-not-ancestor",
      source: "push-before",
    };
  }

  return {
    base: latestSuccessfulSha,
    reason: "accumulate-since-last-successful-push-deployment",
    source: "last-successful-push-deployment",
  };
}

export function fetchLatestSuccessfulPushSha({ branch, repository, token }) {
  if (!repository || !token) {
    return "";
  }

  return execFileSync(
    "gh",
    [
      "api",
      "--method",
      "GET",
      `repos/${repository}/actions/workflows/deploy.yml/runs`,
      "-f",
      `branch=${branch}`,
      "-f",
      "event=push",
      "-f",
      "status=success",
      "-f",
      "per_page=1",
      "--jq",
      ".workflow_runs[0].head_sha // empty",
    ],
    {
      encoding: "utf-8",
      env: { ...process.env, GH_TOKEN: token },
      stdio: ["ignore", "pipe", "pipe"],
    }
  ).trim();
}

function gitCommitExists(sha) {
  return (
    spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
      stdio: "ignore",
    }).status === 0
  );
}

function gitIsAncestor(ancestor, descendant) {
  return (
    spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      stdio: "ignore",
    }).status === 0
  );
}

export function resolveDeployDiffBase({ after, before, environment }) {
  let latestSuccessfulSha = "";
  try {
    latestSuccessfulSha = fetchLatestSuccessfulPushSha({
      branch: environment.GITHUB_REF_NAME || "main",
      repository: environment.GITHUB_REPOSITORY,
      token: environment.GH_TOKEN || environment.GITHUB_TOKEN,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Unable to read the last successful push deployment; falling back to the push before SHA: ${message}`
    );
  }

  return selectDeployDiffBase({
    after,
    before,
    commitExists: gitCommitExists,
    isAncestor: gitIsAncestor,
    latestSuccessfulSha,
  });
}

function main() {
  const [before = "", after = ""] = process.argv.slice(2);
  if (!after) {
    console.error(
      "Usage: node scripts/ci/resolve-deploy-diff-base.mjs <before> <after>"
    );
    process.exitCode = 2;
    return;
  }

  const result = resolveDeployDiffBase({
    after,
    before,
    environment: process.env,
  });
  console.error(
    `deploy-diff-base=${result.base || "<none>"} source=${result.source} reason=${result.reason}`
  );
  process.stdout.write(result.base);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
