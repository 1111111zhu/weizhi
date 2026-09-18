import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { verifyWindowsSigningReport } from "./verify-windows-signing-report.mjs";

test("accepts a valid timestamped signing report", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "verify-signing-report-"));
  try {
    const installer = path.join(root, "ProjectWingDesktopAgentSetup.exe");
    const reportPath = path.join(root, "signing.json");
    const sha256 = createHash("sha256").update("installer").digest("hex");
    await writeFile(installer, "installer");
    await writeFile(
      reportPath,
      `\uFEFF${JSON.stringify({
        timestampRequired: true,
        certificateThumbprint: "ABC123",
        expectedSubject: "CN=Project Wing",
        files: [
          {
            fileName: path.basename(installer),
            sha256,
            status: "Valid",
            timestamped: true,
            signerSubject: "CN=Project Wing",
            signerThumbprint: "ABC123",
          },
        ],
      })}`
    );
    assert.deepEqual(verifyWindowsSigningReport(installer, reportPath), {
      ok: true,
      fileName: path.basename(installer),
      sha256,
      signerThumbprint: "ABC123",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a report with a mismatched installer hash", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "verify-signing-report-"));
  try {
    const installer = path.join(root, "setup.exe");
    const reportPath = path.join(root, "signing.json");
    await writeFile(installer, "installer");
    await writeFile(
      reportPath,
      JSON.stringify({ files: [{ fileName: "setup.exe", sha256: "wrong" }] })
    );
    assert.throws(
      () => verifyWindowsSigningReport(installer, reportPath),
      /SHA-256 does not match/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
