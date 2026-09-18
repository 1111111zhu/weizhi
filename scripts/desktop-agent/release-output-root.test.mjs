import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { resolveReleaseOutputRoot } from "../../apps/desktop-agent-desktop/scripts/release-output-root.mjs";

test("resolves configured relative output roots from the repository", () => {
  assert.equal(
    resolveReleaseOutputRoot(
      "/workspace/project-wing",
      "output/desktop-agent/windows",
      "output/default"
    ),
    path.resolve("/workspace/project-wing/output/desktop-agent/windows")
  );
});

test("preserves configured absolute output roots", () => {
  assert.equal(
    resolveReleaseOutputRoot(
      "/workspace/project-wing",
      "/agent/output/windows",
      "output/default"
    ),
    path.resolve("/agent/output/windows")
  );
});

test("uses the repository-relative default output root", () => {
  assert.equal(
    resolveReleaseOutputRoot(
      "/workspace/project-wing",
      undefined,
      "output/desktop-agent/velopack"
    ),
    path.resolve("/workspace/project-wing/output/desktop-agent/velopack")
  );
});
