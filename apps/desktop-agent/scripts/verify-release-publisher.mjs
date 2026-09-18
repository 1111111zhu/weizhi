import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import { publishVeloPackBundle } from "../../../scripts/desktop-agent/publish-installer-to-oss.mjs";
import { assertEqual } from "./runtime-test-support.mjs";

const { join } = pathModule;
const temporaryRoot = await mkdtemp(
  join(tmpdir(), "project-wing-release-publisher-")
);
const setupName = "com.superfx.projectwing.desktop-agent-win-Setup.exe";

try {
  await writeFile(join(temporaryRoot, setupName), "project-wing-windows-setup");
  await writeFile(join(temporaryRoot, "releases.win.json"), "{}");
  await writeFile(
    join(
      temporaryRoot,
      "com.superfx.projectwing.desktop-agent-0.3.0-full.nupkg"
    ),
    "project-wing-windows-package"
  );
  Object.assign(process.env, createPublisherEnvironment());
  const bucket = createFakeBucket();
  await publishVeloPackBundle({ velopackBundle: temporaryRoot }, { bucket });
  for (const key of [
    "desktop-agent/windows/desktop-agent-win-x64.exe",
    "desktop-agent/windows/updates/releases.win.json",
    "desktop-agent/windows/latest.json",
  ]) {
    assertEqual(bucket.objects.has(key), true);
  }
  console.log("Desktop Agent release publisher verification passed.");
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}

function createPublisherEnvironment() {
  return {
    DESKTOP_AGENT_RELEASE_VERSION: "0.3.0",
    OSS_PREFIX: "desktop-agent/windows",
    OSS_ACCESS_KEY_ID: "test-access-key",
    OSS_ACCESS_KEY_SECRET: "test-secret",
    OSS_BUCKET: "test-bucket",
    OSS_ENDPOINT: "https://oss.example",
  };
}

function createFakeBucket() {
  const objects = new Map();
  return {
    objects,
    async multipartUpload(key, source, options) {
      const sourceStats = await stat(source);
      objects.set(key, {
        headers: options.headers,
        size: sourceStats.size,
      });
      options.progress?.(1);
    },
    copy(destination, source) {
      objects.set(destination, objects.get(source));
    },
    head(key) {
      const record = objects.get(key);
      return {
        res: {
          headers: {
            "content-length": String(record.size),
            "x-oss-meta-sha256": record.headers["x-oss-meta-sha256"],
          },
        },
      };
    },
    put(key, body, options) {
      objects.set(key, {
        body,
        headers: options.headers,
        size: Buffer.byteLength(body),
      });
    },
  };
}
