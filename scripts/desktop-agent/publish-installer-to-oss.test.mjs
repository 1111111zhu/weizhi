import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RETRY_ATTEMPTS,
  UPLOAD_THREADS,
  ossClientOptions,
  publishVeloPackBundle,
  publishWindowsManifest,
  retryOssOperation,
  uploadInstaller,
} from "./publish-installer-to-oss.mjs";

class FakeBucket {
  constructor() {
    this.objects = new Map();
    this.calls = [];
  }

  async multipartUpload(key, source, options) {
    const body = await readFile(source);
    this.objects.set(key, { body, headers: options.headers });
    options.progress?.(0, { key, part: 1 });
    options.progress?.(1);
  }

  copy(target, source) {
    this.calls.push(["copy", target, source]);
    this.objects.set(target, this.objects.get(source));
  }

  head(key) {
    const object = this.objects.get(key);
    return {
      res: {
        headers: {
          "content-length": String(object.body.length),
          ...object.headers,
        },
      },
    };
  }

  put(key, body, options) {
    this.calls.push(["put", key]);
    this.objects.set(key, { body, headers: options.headers });
  }
}

test("publishes private versioned and stable installer objects", async () => {
  const bucket = new FakeBucket();
  const root = await mkdtemp(path.join(tmpdir(), "desktop-agent-oss-"));
  try {
    const installer = path.join(root, "installer.exe");
    await writeFile(installer, "installer");
    const digest = "a".repeat(64);
    bucket.objects.set("versioned", {
      body: Buffer.from("installer"),
      headers: { "x-oss-meta-sha256": digest },
    });
    await uploadInstaller(
      bucket,
      installer,
      "versioned",
      "stable",
      "desktop-agent-win-x64.exe",
      digest
    );
    assert.deepEqual(bucket.calls, [["copy", "stable", "versioned"]]);
    assert.equal(
      bucket.objects.get("stable").headers["x-oss-meta-sha256"],
      digest
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("retries transient OSS request errors", async () => {
  let calls = 0;
  const sleeps = [];
  await retryOssOperation(
    () => {
      calls += 1;
      if (calls === 1) {
        const error = new Error("host unreachable");
        error.name = "RequestError";
        throw error;
      }
    },
    "OSS upload",
    (milliseconds) => sleeps.push(milliseconds)
  );
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [1000]);
});

test("retries OSS response timeouts and nested socket errors", async () => {
  for (const error of [
    Object.assign(new Error("response timed out"), {
      name: "ResponseTimeoutError",
    }),
    Object.assign(new Error("request failed"), {
      cause: new Error("socket hang up"),
    }),
  ]) {
    let calls = 0;
    await retryOssOperation(
      () => {
        calls += 1;
        if (calls === 1) {
          throw error;
        }
      },
      "OSS upload",
      () => {}
    );
    assert.equal(calls, 2);
  }
});

test("uses conservative WARP upload and client settings", () => {
  assert.equal(RETRY_ATTEMPTS, 8);
  assert.equal(UPLOAD_THREADS, 1);
  const options = ossClientOptions({
    OSS_ENDPOINT: "oss.example.test",
    OSS_BUCKET: "desktop-agent",
    OSS_ACCESS_KEY_ID: "key",
    OSS_ACCESS_KEY_SECRET: "secret",
    ALL_PROXY: "socks5h://127.0.0.1:40000",
  });
  assert.equal(options.timeout, 300_000);
  assert.equal(options.proxy, "socks5h://127.0.0.1:40000");
});

test("publishes the Windows manifest with update policy", async () => {
  const bucket = new FakeBucket();
  const root = await mkdtemp(path.join(tmpdir(), "desktop-agent-oss-"));
  const original = { ...process.env };
  try {
    process.env.DESKTOP_AGENT_SELF_UPDATE_MINIMUM_VERSION = "0.2.10";
    process.env.DESKTOP_AGENT_WINDOWS_SIGNATURE_POLICY = "optional";
    const installer = path.join(root, "installer.exe");
    await writeFile(installer, "signed-installer");
    await publishWindowsManifest(
      bucket,
      "desktop-agent/windows",
      "0.2.1",
      installer,
      "a".repeat(64),
      "desktop-agent-win-x64-0.2.1.exe"
    );
    const manifest = JSON.parse(
      bucket.objects.get("desktop-agent/windows/latest.json").body
    );
    assert.equal(manifest.version, "0.2.1");
    assert.equal(manifest.installerFileName, "desktop-agent-win-x64-0.2.1.exe");
    assert.equal(manifest.fileSize, Buffer.byteLength("signed-installer"));
    assert.equal(manifest.minimumSelfUpdateVersion, "0.2.10");
    assert.equal(manifest.signaturePolicy, "optional");
  } finally {
    restoreEnvironment(original);
    await rm(root, { force: true, recursive: true });
  }
});

test("publishes the VeloPack feed while preserving installer names", async () => {
  const bucket = new FakeBucket();
  const root = await mkdtemp(path.join(tmpdir(), "desktop-agent-oss-"));
  const original = { ...process.env };
  try {
    process.env.DESKTOP_AGENT_RELEASE_VERSION = "0.3.0";
    process.env.OSS_PREFIX = "desktop-agent/windows";
    const files = [
      ["com.superfx.projectwing.desktop-agent-win-Setup.exe", "setup"],
      ["releases.win.json", "{}"],
      ["com.superfx.projectwing.desktop-agent-0.3.0-full.nupkg", "package"],
    ];
    await Promise.all(
      files.map(([name, body]) => writeFile(path.join(root, name), body))
    );
    await publishVeloPackBundle({ velopackBundle: root }, { bucket });
    assert.ok(
      bucket.objects.has(
        "desktop-agent/windows/releases/v0.3.0/desktop-agent-win-x64-0.3.0.exe"
      )
    );
    assert.ok(
      bucket.objects.has("desktop-agent/windows/updates/releases.win.json")
    );
    assert.ok(bucket.objects.has("desktop-agent/windows/latest.json"));
  } finally {
    restoreEnvironment(original);
    await rm(root, { force: true, recursive: true });
  }
});

function restoreEnvironment(original) {
  for (const name of Object.keys(process.env)) {
    if (!(name in original)) {
      Reflect.deleteProperty(process.env, name);
    }
  }
  Object.assign(process.env, original);
}
