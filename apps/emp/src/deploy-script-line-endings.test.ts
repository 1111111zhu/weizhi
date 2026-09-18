import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const readFile = (filePath: string) =>
  readFileSync(path.resolve(repoRoot, filePath), "utf-8").replaceAll(
    "\r\n",
    "\n"
  );
const hasBash = (() => {
  try {
    execFileSync("bash", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("development deployment contract", () => {
  it("keeps active Linux deployment entrypoints LF-only", () => {
    const entrypoints = [
      "apps/api/docker-entrypoint.sh",
      "scripts/ci/build-registry-images.sh",
      "scripts/ci/blue-green-remote-deploy.sh",
      "scripts/ci/publish-github-deployments.sh",
      "scripts/ci/remote-oss-image-bundle-deploy.sh",
      "scripts/ci/resolve-deploy-env.sh",
    ];

    expect(
      entrypoints.filter((entryPath) => readFile(entryPath).includes("\r\n"))
    ).toStrictEqual([]);
  });

  it.skipIf(!hasBash)(
    "resolves the single development deployment environment",
    () => {
      expect(resolveDevelopmentEnvironment()).toMatchObject({
        PROJECTWING_ENVIRONMENT: "development",
        PROJECTWING_AUTH_URL: "https://auth.superfx.cn",
        NEXT_PUBLIC_AUTH_BASE_URL: "https://auth.superfx.cn",
        BETTER_AUTH_COOKIE_DOMAIN: ".superfx.cn",
      });
    }
  );

  it.skipIf(!hasBash)("rejects retired deployment environment values", () => {
    const temporaryDirectory = mkdtempSync(
      path.resolve(tmpdir(), "projectwing-deploy-environment-")
    );
    const githubEnvironmentFile = path.resolve(
      temporaryDirectory,
      "github.env"
    );

    try {
      expect(() =>
        execFileSync("bash", ["scripts/ci/resolve-deploy-env.sh"], {
          cwd: repoRoot,
          env: {
            ...process.env,
            GITHUB_ENV: githubEnvironmentFile,
            PROJECTWING_ENVIRONMENT: "production",
          },
          stdio: "pipe",
        })
      ).toThrow(/.+/);
    } finally {
      rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it("uses the OSS bundle as the only activation path", () => {
    const workflow = readFile(".github/workflows/deploy.yml");
    const bundleWorkflow = readFile(
      ".github/workflows/oss-image-bundle-pilot.yml"
    );
    const remoteDeploy = readFile(
      "scripts/ci/remote-oss-image-bundle-deploy.sh"
    );

    expect(workflow).toContain(
      "uses: ./.github/workflows/oss-image-bundle-pilot.yml"
    );
    expect(workflow).toContain("operation: deploy");
    expect(workflow).not.toContain("source-build");
    expect(workflow).not.toContain("deploy_environment:");
    expect(workflow).not.toContain("deploy-source:");
    expect(bundleWorkflow).toContain("PROJECTWING_ENVIRONMENT=development");
    expect(bundleWorkflow).toContain(
      "      - name: Stage release and activate the inactive color"
    );
    expect(
      bundleWorkflow.indexOf("Resolve development runtime URLs")
    ).toBeLessThan(
      bundleWorkflow.indexOf("Stage release and activate the inactive color")
    );
    expect(bundleWorkflow).toContain("docker-compose.development.yml");
    expect(bundleWorkflow).toContain(
      "scripts/ci/remote-oss-image-bundle-deploy.sh"
    );
    expect(bundleWorkflow).toContain("scripts/ci/blue-green-remote-deploy.sh");
    expect(remoteDeploy).toContain(
      "PROJECTWING_OSS_IMAGE_BUNDLE_SHA256 is required"
    );
    expect(remoteDeploy).toContain(
      "PROJECTWING_DEPLOY_ARCHIVE_FILE is required"
    );
    expect(remoteDeploy).toContain("blue_green_controller");
    expect(remoteDeploy).toContain("docker-compose.development.yml");
  });

  it("keeps the development Compose runtime explicit while Next uses its built mode", () => {
    const compose = readFile("docker-compose.development.yml");

    expect(compose).toContain("PROJECTWING_ENVIRONMENT: development");
    expect(compose).toContain("NODE_ENV: production");
    expect(compose).toContain("preview-worker:");
  });

  it("removes retired deployment handlers and entrypoints", () => {
    const repositorySources = [
      readFile(".github/workflows/deploy.yml"),
      readFile(".github/workflows/oss-image-bundle-pilot.yml"),
      readFile("scripts/ci/remote-oss-image-bundle-deploy.sh"),
    ].join("\n");

    for (const retiredPath of [
      "remote-build-deploy.sh",
      "remote-deploy.sh",
      "remote-github-deploy.sh",
      "remote-registry-deploy.sh",
      "github-merge-deploy-webhook",
      "acr-deploy-webhook",
    ]) {
      expect(repositorySources).not.toContain(`scripts/ci/${retiredPath}`);
    }

    for (const retiredPath of ["Dockerfile.api.acr", "Dockerfile.emp.acr"]) {
      expect(existsSync(path.resolve(repoRoot, retiredPath))).toBeFalsy();
    }

    const ignoredFiles = readFile(".gitignore");
    expect(ignoredFiles).not.toContain(".env.acr.local");
    expect(ignoredFiles).not.toContain(".env.fc.local");
  });
});

function resolveDevelopmentEnvironment() {
  const temporaryDirectory = mkdtempSync(
    path.resolve(tmpdir(), "projectwing-deploy-environment-")
  );
  const githubEnvironmentFile = path.resolve(temporaryDirectory, "github.env");

  try {
    execFileSync("bash", ["scripts/ci/resolve-deploy-env.sh"], {
      cwd: repoRoot,
      env: { ...process.env, GITHUB_ENV: githubEnvironmentFile },
    });
    return Object.fromEntries(
      readFileSync(githubEnvironmentFile, "utf-8")
        .trim()
        .split("\n")
        .map((line) => {
          const separator = line.indexOf("=");
          return [line.slice(0, separator), line.slice(separator + 1)];
        })
    );
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}
