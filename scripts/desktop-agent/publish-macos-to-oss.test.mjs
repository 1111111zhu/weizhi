import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RETRY_ATTEMPTS,
  SETUP_NAME,
  STABLE_NAME,
  publish,
  semanticVersion,
} from "./publish-macos-to-oss.mjs";

class FakeBucket {
  constructor() {
    this.objects = new Map();
    this.calls = [];
  }

  async multipartUpload(key, source, options) {
    this.objects.set(key, {
      body: await readFile(source),
      headers: options.headers,
    });
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
}

test("keeps the browser download object names", () => {
  assert.equal(STABLE_NAME, "desktop-agent-macos-arm64.pkg");
  assert.equal(
    SETUP_NAME,
    "com.superfx.projectwing.desktop-agent-osx-Setup.pkg"
  );
  assert.equal(RETRY_ATTEMPTS, 8);
  assert.equal(semanticVersion("0.3.0"), "0.3.0");
  assert.throws(() => semanticVersion("0.3"), /Invalid Desktop Agent version/);
});

test("publishes the macOS stable object and update feed", async () => {
  const bucket = new FakeBucket();
  const root = await mkdtemp(path.join(tmpdir(), "desktop-agent-macos-"));
  const original = { ...process.env };
  try {
    process.env.DESKTOP_AGENT_RELEASE_VERSION = "0.3.0";
    delete process.env.OSS_PREFIX;
    await Promise.all([
      writeFile(path.join(root, SETUP_NAME), "setup"),
      writeFile(path.join(root, "releases.osx.json"), "{}"),
      writeFile(
        path.join(
          root,
          "com.superfx.projectwing.desktop-agent-0.3.0-full.nupkg"
        ),
        "package"
      ),
      writeFile(path.join(root, "assets.osx.json"), "{}"),
    ]);
    await publish(root, { bucket });
    assert.ok(
      bucket.objects.has(
        "desktop-agent/macos/releases/v0.3.0/desktop-agent-macos-arm64-0.3.0.pkg"
      )
    );
    assert.ok(bucket.objects.has(`desktop-agent/macos/${STABLE_NAME}`));
    assert.ok(
      bucket.objects.has("desktop-agent/macos/updates/releases.osx.json")
    );
    assert.ok(
      bucket.objects.has("desktop-agent/macos/updates/assets.osx.json")
    );
    assert.deepEqual(bucket.calls, [
      [
        "copy",
        `desktop-agent/macos/${STABLE_NAME}`,
        "desktop-agent/macos/releases/v0.3.0/desktop-agent-macos-arm64-0.3.0.pkg",
      ],
    ]);
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
