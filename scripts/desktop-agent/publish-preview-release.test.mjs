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
const scriptPath = path.join(
  repositoryRoot,
  "scripts/desktop-agent/publish-preview-release.sh"
);

test("creates a GitHub prerelease without an OSS or Docker operation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "desktop-agent-preview-"));
  const bin = path.join(root, "bin");
  const calls = path.join(root, "gh-calls.log");
  const assets = path.join(root, "release-assets", "windows");
  try {
    await mkdir(bin, { recursive: true });
    await mkdir(assets, { recursive: true });
    await writeFile(path.join(assets, "installer.exe"), "installer");
    await writeFile(
      path.join(bin, "gh"),
      [
        "#!/bin/sh",
        'printf "%s\\n" "$*" >> "$GH_CALLS"',
        'if [ "$1" = "release" ] && [ "$2" = "view" ]; then exit 1; fi',
        "exit 0",
        "",
      ].join("\n")
    );
    await chmod(path.join(bin, "gh"), 0o755);
    const result = spawnSync(
      "bash",
      [scriptPath, path.join(root, "release-assets")],
      {
        encoding: "utf-8",
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          GH_CALLS: calls,
          GH_TOKEN: "test-token",
          GITHUB_SHA: "abc123",
          RELEASE_NOTE: "Tray host preview.",
          RELEASE_VERSION: "0.3.0",
          RUNNER_TEMP: root,
        },
      }
    );

    assert.equal(result.status, 0, result.stderr);
    const callsText = await readFile(calls, "utf-8");
    assert.match(callsText, /release create desktop-agent-v0\.3\.0-preview/);
    assert.match(callsText, /--prerelease/);
    assert.match(callsText, /release upload desktop-agent-v0\.3\.0-preview/);
    assert.match(callsText, /installer\.exe/);
    assert.doesNotMatch(callsText, /oss|docker/i);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("does not create a preview release when the asset directory is empty", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "desktop-agent-preview-init-")
  );
  const bin = path.join(root, "bin");
  const calls = path.join(root, "gh-calls.log");
  try {
    await mkdir(bin, { recursive: true });
    await writeFile(
      path.join(bin, "gh"),
      [
        "#!/bin/sh",
        'printf "%s\\n" "$*" >> "$GH_CALLS"',
        'if [ "$1" = "release" ] && [ "$2" = "view" ]; then exit 1; fi',
        "exit 0",
        "",
      ].join("\n")
    );
    await chmod(path.join(bin, "gh"), 0o755);
    const result = spawnSync("bash", [scriptPath, path.join(root, "missing")], {
      encoding: "utf-8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        GH_CALLS: calls,
        GH_TOKEN: "test-token",
        GITHUB_SHA: "abc123",
        RELEASE_NOTE: "Tray host preview.",
        RELEASE_VERSION: "0.3.0",
        RUNNER_TEMP: root,
      },
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /No preview release assets found/);
    await assert.rejects(readFile(calls, "utf-8"));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
