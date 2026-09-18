import assert from "node:assert/strict";
import test from "node:test";

import { commitMessageViolations } from "./commit-message-guard.mjs";

test("accepts repository commit policy metadata", () => {
  assert.deepEqual(
    commitMessageViolations(
      "fix(hooks): enforce repository policy\n\nCo-authored-by: codex <codex@openai.com>\n"
    ),
    []
  );
});

test("allows Git-generated merge and revert messages", () => {
  for (const message of [
    "Merge branch 'main' into fix/hooks",
    'Revert "fix(hooks): enforce repository policy"',
  ]) {
    assert.deepEqual(commitMessageViolations(message), [], message);
  }
});

test("rejects non-English and punctuated summaries", () => {
  assert.match(commitMessageViolations("fix: 修复 hooks")[0], /English/);
  assert.match(commitMessageViolations("fix: починить hooks")[0], /English/);
  assert.match(
    commitMessageViolations("fix: enforce hooks.")[0],
    /punctuation/
  );
});

test("only validates Co-authored-by lines in the Git trailer block", () => {
  assert.deepEqual(
    commitMessageViolations(
      "fix: enforce hooks\n\nCo-authored-by: is discussed in this body paragraph.\n\nBody continues here."
    ),
    []
  );
});

test("rejects malformed and duplicate co-author trailers", () => {
  assert.match(
    commitMessageViolations(
      "fix: enforce hooks\n\nCo-authored-by: codex codex@openai.com"
    )[0],
    /Invalid/
  );

  const duplicate = commitMessageViolations(
    "fix: enforce hooks\n\nCo-authored-by: codex <codex@openai.com>\nCo-authored-by: CODEX <CODEX@OPENAI.COM>"
  );
  assert.match(duplicate[0], /Duplicate/);
});
