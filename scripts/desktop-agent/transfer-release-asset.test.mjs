import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const transferScript = path.join(
  repositoryRoot,
  "scripts/desktop-agent/transfer-release-asset.mjs"
);

test("pushes a complete Windows release directory", async () => {
  const result = await runPush("windows", [
    "com.superfx.projectwing.desktop-agent-win-Setup.exe",
    "releases.win.json",
    "com.superfx.projectwing.desktop-agent-0.3.0-full.nupkg",
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.calls, /cn\.superfx\.projectwing\.platform=windows/);
  assert.match(result.calls, /releases\.win\.json/);
  assert.match(result.calls, /-full\.nupkg/);
});

test("pushes a complete macOS release directory", async () => {
  const result = await runPush("macos", [
    "com.superfx.projectwing.desktop-agent-osx-Setup.pkg",
    "releases.osx.json",
    "com.superfx.projectwing.desktop-agent-0.3.0-full.nupkg",
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.calls, /cn\.superfx\.projectwing\.platform=macos/);
  assert.match(result.calls, /releases\.osx\.json/);
});

test("rejects a release directory without a feed", async () => {
  const result = await runPush("windows", [
    "com.superfx.projectwing.desktop-agent-0.3.0-full.nupkg",
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /VeloPack release feed/);
});

test("reports whether a cached platform bundle exists", async () => {
  const present = await runExists("windows", 0);
  const missing = await runExists("macos", 1);

  assert.equal(present.status, 0, present.stderr);
  assert.equal(present.stdout.trim(), "true");
  assert.equal(missing.status, 0, missing.stderr);
  assert.equal(missing.stdout.trim(), "false");
});

async function runPush(platform, assets) {
  const root = await mkdtemp(path.join(tmpdir(), "desktop-agent-oras-"));
  const fakeOras = path.join(root, "oras");
  const callsPath = path.join(root, "calls.log");
  const releaseDirectory = path.join(root, "releases");
  try {
    await mkdir(releaseDirectory);
    await Promise.all(
      assets.map((name) =>
        writeFile(path.join(releaseDirectory, name), "asset")
      )
    );
    await writeFile(
      fakeOras,
      [
        "#!/bin/sh",
        'printf "%s\\n" "$*" >> "$ORAS_CALLS"',
        'if [ "$1" = "login" ]; then cat >/dev/null; fi',
        "exit 0",
        "",
      ].join("\n")
    );
    await chmod(fakeOras, 0o755);
    const result = spawnSync(
      process.execPath,
      [transferScript, "push", platform, releaseDirectory],
      {
        encoding: "utf-8",
        env: {
          ...process.env,
          PATH: `${root}:${process.env.PATH}`,
          ORAS_CALLS: callsPath,
          GH_TOKEN: "test-token",
          GITHUB_ACTOR: "release-bot",
          GITHUB_REPOSITORY_OWNER: "Fin-Agent-Lab",
          GITHUB_RUN_ID: "98765",
          GITHUB_SHA: "abc123",
        },
      }
    );
    return {
      ...result,
      calls: await readFile(callsPath, "utf-8").catch(() => ""),
    };
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

async function runExists(platform, manifestStatus) {
  const root = await mkdtemp(path.join(tmpdir(), "desktop-agent-oras-"));
  const fakeOras = path.join(root, "oras");
  try {
    await writeFile(
      fakeOras,
      [
        "#!/bin/sh",
        'if [ "$1" = "login" ]; then cat >/dev/null; exit 0; fi',
        'if [ "$1" = "logout" ]; then exit 0; fi',
        `exit ${manifestStatus}`,
        "",
      ].join("\n")
    );
    await chmod(fakeOras, 0o755);
    return spawnSync(process.execPath, [transferScript, "exists", platform], {
      encoding: "utf-8",
      env: {
        ...process.env,
        PATH: `${root}:${process.env.PATH}`,
        GH_TOKEN: "test-token",
        GITHUB_ACTOR: "release-bot",
        GITHUB_REPOSITORY_OWNER: "Fin-Agent-Lab",
        GITHUB_RUN_ID: "98765",
        GITHUB_SHA: "abc123",
      },
    });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}
