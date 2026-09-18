import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const file = path.join(root, "scripts/ci/cleanup-blue-green-candidate.sh");
const source = fs.readFileSync(file, "utf8");

test("failed promotion cleanup is release and color scoped", () => {
  assert.match(source, /projectwing-\$\{color\}/);
  assert.match(source, /\/opt\/projectwing\/releases/);
  assert.match(source, /down --remove-orphans/);
  assert.doesNotMatch(source, /--volumes|--force|system prune/);
});

test("cleanup distinguishes failed candidates from retired previous stacks", () => {
  assert.match(source, /failed-candidate/);
  assert.match(source, /retired-previous/);
  assert.match(source, /PROJECTWING_CLEANUP_REASON/);
});

test("cleanup removes only allowlisted immutable image tags", () => {
  assert.match(source, /projectwing-\(api\|emp\|cmp/);
  assert.match(source, /docker image rm --no-prune/);
  assert.match(source, /Candidate cleanup left one or more immutable image tags in use/);
});

test("cleanup controller stays within repository limits", () => {
  assert.ok(source.split("\n").length <= 300);
});
