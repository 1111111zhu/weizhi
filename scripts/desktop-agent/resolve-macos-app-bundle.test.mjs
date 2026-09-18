import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  resolveMacosAppBundle,
  resolveMacosMainExecutable,
} from "../../apps/desktop-agent-desktop/scripts/resolve-macos-app-bundle.mjs";

test("resolves the configured product app without hard-coding its name", async () => {
  const root = await createOutputRoot();
  try {
    const bundle = path.join(
      root,
      "electron/mac-arm64/Project Wing Desktop Agent.app"
    );
    await mkdir(bundle);

    assert.equal(await resolveMacosAppBundle(root, "arm64"), bundle);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("rejects ambiguous Electron app output", async () => {
  const root = await createOutputRoot();
  try {
    const output = path.join(root, "electron/mac-arm64");
    await Promise.all([
      mkdir(path.join(output, "First.app")),
      mkdir(path.join(output, "Second.app")),
      writeFile(path.join(output, "builder-debug.yml"), "debug"),
    ]);

    await assert.rejects(
      resolveMacosAppBundle(root, "arm64"),
      /Expected one macOS app bundle.*found 2/
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("resolves the packaged Electron main executable", async () => {
  const root = await createOutputRoot();
  try {
    const appBundle = path.join(root, "electron/mac-arm64/Desktop Agent.app");
    const executableRoot = path.join(appBundle, "Contents/MacOS");
    await mkdir(executableRoot, { recursive: true });
    await writeFile(path.join(executableRoot, "ProjectWingDesktopAgent"), "bin");

    assert.equal(
      await resolveMacosMainExecutable(appBundle),
      "ProjectWingDesktopAgent"
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("rejects ambiguous packaged executables", async () => {
  const root = await createOutputRoot();
  try {
    const appBundle = path.join(root, "electron/mac-arm64/Desktop Agent.app");
    const executableRoot = path.join(appBundle, "Contents/MacOS");
    await mkdir(executableRoot, { recursive: true });
    await Promise.all([
      writeFile(path.join(executableRoot, "First"), "bin"),
      writeFile(path.join(executableRoot, "Second"), "bin"),
    ]);

    await assert.rejects(
      resolveMacosMainExecutable(appBundle),
      /Expected one macOS main executable.*found 2/
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

async function createOutputRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "projectwing-macos-app-"));
  await mkdir(path.join(root, "electron/mac-arm64"), { recursive: true });
  return root;
}
