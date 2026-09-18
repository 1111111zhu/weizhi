import assert from "node:assert/strict";
import test from "node:test";

import { parsePushUpdates, pushPolicyViolations } from "./pre-push-guard.mjs";

const featureUpdate = {
  localRef: "refs/heads/fix/enforce-hooks",
  localSha: "2222222222222222222222222222222222222222",
  remoteRef: "refs/heads/fix/enforce-hooks",
  remoteSha: "0000000000000000000000000000000000000000",
};

test("parses Git pre-push input", () => {
  assert.deepEqual(
    parsePushUpdates(
      `${featureUpdate.localRef} ${featureUpdate.localSha} ${featureUpdate.remoteRef} ${featureUpdate.remoteSha}\n`
    ),
    [featureUpdate]
  );
});

test("accepts a valid task branch containing remote main", () => {
  assert.deepEqual(
    pushPolicyViolations({
      updates: [featureUpdate],
      remoteMainSha: "1111111111111111111111111111111111111111",
      isAncestor: () => true,
    }),
    []
  );
});

test("blocks direct main pushes and invalid branch names", () => {
  const violations = pushPolicyViolations({
    updates: [
      { ...featureUpdate, remoteRef: "refs/heads/main" },
      { ...featureUpdate, remoteRef: "refs/heads/my-feature" },
    ],
    remoteMainSha: undefined,
    isAncestor: () => true,
  });
  assert.match(violations[0], /Direct pushes to main/);
  assert.match(violations[1], /Conventional Commit type/);
});

test("blocks a branch that is behind remote main", () => {
  const violations = pushPolicyViolations({
    updates: [featureUpdate],
    remoteMainSha: "1111111111111111111111111111111111111111",
    isAncestor: () => false,
  });
  assert.match(violations[0], /does not contain the current remote main/);
});

test("ignores tags and branch deletions", () => {
  assert.deepEqual(
    pushPolicyViolations({
      updates: [
        {
          localRef: "refs/tags/v1.0.0",
          localSha: featureUpdate.localSha,
          remoteRef: "refs/tags/v1.0.0",
          remoteSha: featureUpdate.remoteSha,
        },
        {
          localRef: "(delete)",
          localSha: "0000000000000000000000000000000000000000",
          remoteRef: "refs/heads/fix/old-branch",
          remoteSha: featureUpdate.localSha,
        },
      ],
      remoteMainSha: undefined,
      isAncestor: () => true,
    }),
    []
  );
});
