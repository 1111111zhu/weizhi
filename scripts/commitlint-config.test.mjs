import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function lintCommit(message) {
  return spawnSync("corepack", ["pnpm", "exec", "commitlint"], {
    encoding: "utf-8",
    input: `${message}\n`,
    shell: process.platform === "win32",
  });
}

test("accepts the repository Conventional Commit format", () => {
  assert.equal(lintCommit("fix(hooks): enforce repository policy").status, 0);
});

test("rejects malformed and overlong Conventional Commit headers", () => {
  const malformed = lintCommit("update hooks");
  assert.notEqual(malformed.status, 0);
  assert.match(malformed.stdout, /type may not be empty/);

  const overlong = lintCommit(`fix: ${"a".repeat(51)}`);
  assert.notEqual(overlong.status, 0);
  assert.match(overlong.stdout, /subject must not be longer than 50/);
});
