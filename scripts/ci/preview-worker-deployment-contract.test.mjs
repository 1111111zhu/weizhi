import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const controller = fs.readFileSync(
  path.join(root, "scripts/ci/blue-green-controller.sh"),
  "utf-8"
);
const compose = fs.readFileSync(
  path.join(root, "docker-compose.development.yml"),
  "utf-8"
);
const previewWorker = compose.match(
  /^  preview-worker:\r?\n(?<service>[\s\S]*?)(?=^  [a-z0-9-]+:\r?\n|(?![\s\S]))/m
)?.groups?.service;

test("candidate activation starts the attachment preview worker after the API", () => {
  const services =
    controller.match(/services=\(([^)]+)\)/)?.[1]?.split(/\s+/) ?? [];
  assert.ok(services.includes("preview-worker"));
  assert.ok(services.indexOf("api") < services.indexOf("preview-worker"));
  assert.ok(
    services.indexOf("preview-worker") < services.indexOf("prisma-studio")
  );
});

test("the preview worker uses the API image entrypoint and bounds document conversion time", () => {
  assert.ok(previewWorker, "preview-worker service is missing from Compose");
  assert.match(previewWorker, /command: \["preview-worker"\]/);
  assert.match(
    previewWorker,
    /DOCUMENT_CONVERSION_TIMEOUT_MS: \$\{DOCUMENT_CONVERSION_TIMEOUT_MS:-120000\}/
  );
});
