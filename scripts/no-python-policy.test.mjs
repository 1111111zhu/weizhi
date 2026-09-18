import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const forbiddenExtension = [".", "py"].join("");
const languageCommand = ["py", "thon"].join("");
const setupAction = `setup-${languageCommand}`;
const quotedCommand = new RegExp(`["']${languageCommand}3?["']`);
const shellCommand = new RegExp(
  `\\b${languageCommand}3?\\s+(?:-[A-Za-z<]|[^\\s]+\\${forbiddenExtension}\\b)`
);
const sourceReference = new RegExp(
  `(?:^|[\\s"'()])[^\\s"'()]+\\${forbiddenExtension}\\b`
);

function repositoryFiles() {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf-8" }
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split("\0").filter((file) => file && existsSync(file));
}

test("repository contains no Python source or invocation", () => {
  const violations = [];
  for (const file of repositoryFiles()) {
    if (file.endsWith(forbiddenExtension)) {
      violations.push(`${file}: forbidden source file`);
      continue;
    }
    const contents = readFileSync(file);
    if (contents.includes(0)) {
      continue;
    }
    const text = contents.toString("utf-8");
    if (
      text.includes(setupAction) ||
      quotedCommand.test(text) ||
      shellCommand.test(text) ||
      sourceReference.test(text)
    ) {
      violations.push(`${file}: forbidden source reference or invocation`);
    }
  }
  assert.deepEqual(violations, []);
});
