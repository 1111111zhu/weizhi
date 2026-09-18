import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { mergePublishDirectories } from "./merge-dotnet-publish.mjs";

test("deduplicates runtime files and excludes symbols", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "merge-dotnet-publish-"));
  try {
    const manager = path.join(root, "manager");
    const runtime = path.join(root, "runtime");
    const destination = path.join(root, "managed");
    await write(manager, "hostfxr.dll", "shared-runtime");
    await write(manager, "Manager.exe", "manager");
    await write(manager, "Manager.pdb", "symbols");
    await write(runtime, "hostfxr.dll", "shared-runtime");
    await write(runtime, "Runtime.exe", "runtime");

    const report = mergePublishDirectories(destination, [manager, runtime]);

    assert.equal(report.copiedFiles, 3);
    assert.equal(report.deduplicatedBytes, Buffer.byteLength("shared-runtime"));
    assert.deepEqual(report.preferredConflicts, []);
    assert.equal(
      await readFile(path.join(destination, "Manager.exe"), "utf-8"),
      "manager"
    );
    assert.equal(
      await readFile(path.join(destination, "Runtime.exe"), "utf-8"),
      "runtime"
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects conflicting runtime files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "merge-dotnet-publish-"));
  try {
    const first = path.join(root, "first");
    const second = path.join(root, "second");
    await write(first, "hostfxr.dll", "first");
    await write(second, "hostfxr.dll", "second");
    assert.throws(
      () =>
        mergePublishDirectories(path.join(root, "managed"), [first, second]),
      /Conflicting publish file/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("keeps an explicitly preferred first file", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "merge-dotnet-publish-"));
  try {
    const first = path.join(root, "first");
    const second = path.join(root, "second");
    const destination = path.join(root, "managed");
    await write(first, "WindowsBase.dll", "desktop");
    await write(second, "WindowsBase.dll", "core");
    const report = mergePublishDirectories(
      destination,
      [first, second],
      new Set(["WindowsBase.dll"])
    );
    assert.equal(
      await readFile(path.join(destination, "WindowsBase.dll"), "utf-8"),
      "desktop"
    );
    assert.deepEqual(report.preferredConflicts, ["WindowsBase.dll"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function write(root, name, contents) {
  const filePath = path.join(root, name);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents);
}
