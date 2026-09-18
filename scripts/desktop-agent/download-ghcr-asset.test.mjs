import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { CHUNK_SIZE, main } from "./download-ghcr-asset.mjs";

const PAYLOAD = Buffer.concat([
  Buffer.from("project-wing-native-installer").subarray(0, 25),
  Buffer.alloc(CHUNK_SIZE * 2 + 123, 0x61),
  Buffer.from("complete"),
]);
const DIGEST = `sha256:${createHash("sha256").update(PAYLOAD).digest("hex")}`;
const INSTALLER = "desktop-agent-win-x64-0.2.0.exe";

test("resumes an interrupted blob download with parallel byte ranges", async () => {
  const state = {
    interrupted: false,
    resumed: false,
    ranges: [],
    active: 0,
    maxActive: 0,
  };
  const server = createServer((request, response) => {
    if (request.url?.startsWith("/token?")) {
      sendJson(response, { token: "registry-token" });
      return;
    }
    if (request.url?.includes("/manifests/")) {
      sendJson(response, {
        schemaVersion: 2,
        layers: [
          {
            digest: DIGEST,
            size: PAYLOAD.length,
            annotations: { "org.opencontainers.image.title": INSTALLER },
          },
        ],
      });
      return;
    }
    if (request.url?.includes("/blobs/")) {
      const match = /^bytes=(\d+)-(\d+)$/.exec(request.headers.range ?? "");
      assert.ok(match);
      const start = Number(match[1]);
      const end = Number(match[2]);
      state.ranges.push([start, end]);
      if (start > 0) {
        state.resumed = true;
      }
      const body = PAYLOAD.subarray(start, end + 1);
      response.writeHead(206, {
        "Content-Length": body.length,
        "Content-Range": `bytes ${start}-${end}/${PAYLOAD.length}`,
      });
      state.active += 1;
      state.maxActive = Math.max(state.maxActive, state.active);
      const interrupt = !state.interrupted;
      state.interrupted = true;
      setTimeout(() => {
        if (interrupt) {
          response.destroy();
        } else {
          response.end(body);
        }
        state.active -= 1;
      }, 10);
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const root = await mkdtemp(path.join(tmpdir(), "desktop-agent-ghcr-"));
  try {
    const { port } = server.address();
    await main(
      [
        "--repository",
        "fin-agent-lab/projectwing-desktop-agent-assets",
        "--tag",
        "0.2.0-windows",
        "--expected-name",
        INSTALLER,
        "--output",
        root,
        "--registry-url",
        `http://127.0.0.1:${port}`,
        "--token-url",
        `http://127.0.0.1:${port}/token`,
      ],
      { ...process.env, GHCR_USERNAME: "bot", GHCR_TOKEN: "token" }
    );
    assert.deepEqual(PAYLOAD, await readFile(path.join(root, INSTALLER)));
    assert.equal(state.resumed, true);
    assert.ok(state.ranges.length > 2);
    assert.ok(state.maxActive > 1);
    assert.ok(
      state.ranges.every(([start, end]) => end - start + 1 <= CHUNK_SIZE)
    );
  } finally {
    await rm(root, { force: true, recursive: true });
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
});

function sendJson(response, value) {
  const body = Buffer.from(JSON.stringify(value));
  response
    .writeHead(200, {
      "Content-Type": "application/json",
      "Content-Length": body.length,
    })
    .end(body);
}
