import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const dockerfile = readFileSync(
  path.join(root, "deploy/docker/Dockerfile.next-app"),
  "utf-8"
);
const instructions = dockerfile.replaceAll(/\\\r?\n/g, " ").split(/\r?\n/);

test("builds shared exports unconditionally before every Next application", () => {
  const sourceCopy = instructions.indexOf(
    "COPY packages/shared packages/shared"
  );
  const sharedBuild = instructions.findIndex((line) =>
    /^RUN\s+pnpm --filter @project-wing\/shared build\s*$/.test(line)
  );
  const nextBuild = instructions.findIndex(
    (line) =>
      line.startsWith("RUN ") &&
      line.includes(`pnpm --filter "\${APP_PACKAGE}" exec next build`)
  );
  assert.ok(sourceCopy !== -1);
  assert.ok(
    sharedBuild > sourceCopy,
    "compile the shared package after copying its sources, outside app-specific conditions"
  );
  assert.ok(
    nextBuild > sharedBuild,
    "every Next build, including showroom, must see the compiled exports"
  );
  assert.equal(
    instructions.filter((line) =>
      line.includes("pnpm --filter @project-wing/shared build")
    ).length,
    1
  );
});

test("does not depend on a developer checkout's pre-existing shared dist", () => {
  const shared = JSON.parse(
    readFileSync(path.join(root, "packages/shared/package.json"), "utf-8")
  );
  const ignores = readFileSync(path.join(root, ".dockerignore"), "utf-8").split(
    /\r?\n/
  );
  assert.equal(shared.exports["."].import, "./dist/index.js");
  assert.ok(ignores.includes("**/dist"));
  assert.ok(
    dockerfile.includes(`pnpm --filter "\${APP_PACKAGE}" registry:build;`)
  );
});

test("runs this dependency contract before building CI images", () => {
  const script = readFileSync(
    path.join(root, "scripts/ci/build-registry-images.sh"),
    "utf-8"
  );
  const check = script.indexOf(
    "node --test scripts/ci/next-app-build-contract.test.mjs"
  );
  const build = script.indexOf("\nsetup_buildx_builder\n");
  assert.ok(check !== -1);
  assert.ok(build > check);
});
