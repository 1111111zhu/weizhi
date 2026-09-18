import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { deflateRawSync } from "node:zlib";

import { buildReport } from "./report-package-size.mjs";

test("reports raw and archive sizes by group", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "report-package-size-"));
  try {
    const payload = path.join(root, "payload");
    const archive = path.join(root, "payload.zip");
    await mkdir(path.join(payload, "managed"), { recursive: true });
    await mkdir(path.join(payload, "ui"));
    await writeFile(
      path.join(payload, "managed", "runtime.dll"),
      "a".repeat(1000)
    );
    await writeFile(path.join(payload, "ui", "app.exe"), "b".repeat(2000));
    await writeFile(
      archive,
      createDeflatedZip([
        ["managed/runtime.dll", "a".repeat(1000)],
        ["ui/app.exe", "b".repeat(2000)],
      ])
    );

    const report = buildReport(payload, archive);

    assert.equal(report.bytes, 3000);
    assert.ok(report.compressedBytes > 0);
    assert.ok(report.compressedBytes < report.bytes);
    assert.equal(report.groups.managed.bytes, 1000);
    assert.equal(report.groups.ui.bytes, 2000);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("marks compressed size unavailable without an archive", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "report-package-size-"));
  try {
    const payload = path.join(root, "payload");
    await mkdir(payload);
    await writeFile(path.join(payload, "app"), "content");
    const report = buildReport(payload, null);
    assert.equal(report.compressedBytes, null);
    assert.equal(report.groups.app.compressedBytes, null);
    assert.equal(report.files[0].compressedBytes, null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function createDeflatedZip(entries) {
  const localRecords = [];
  const centralRecords = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);
    const compressed = deflateRawSync(data);
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04_03_4b_50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(local, 30);
    localRecords.push(Buffer.concat([local, compressed]));

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02_01_4b_50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);
    centralRecords.push(central);
    offset += local.length + compressed.length;
  }
  const centralDirectory = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06_05_4b_50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localRecords, centralDirectory, end]);
}
