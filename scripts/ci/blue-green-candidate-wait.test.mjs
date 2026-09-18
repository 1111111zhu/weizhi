import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const remoteFunctionsUrl = new URL(
  "./blue-green-remote-functions.sh",
  import.meta.url
);
const remoteFunctions = await readFile(remoteFunctionsUrl, "utf8");

test("candidate waits cover sequential startup and expose timeout diagnostics", () => {
  const script = `set -Eeuo pipefail
release_key=${"a".repeat(40)}-1-1
candidate_color=green
candidate_host=host
candidate_known_hosts=known-hosts
PROJECTWING_CANDIDATE_STATUS_ATTEMPTS=1
sleep() { :; }
remote_ssh() {
  if [[ "$*" == *"tail -n 180"* ]]; then
    printf 'candidate-log-tail\\n'
    return 0
  fi
  return 1
}
. "$REMOTE_FUNCTIONS"
wait_for_candidate_job activate`;
  const result = spawnSync("bash", ["-c", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      REMOTE_FUNCTIONS: fileURLToPath(remoteFunctionsUrl),
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /timed out after 5 seconds/);
  assert.match(result.stdout, /candidate-log-tail/);
  assert.match(remoteFunctions, /PROJECTWING_CANDIDATE_STATUS_ATTEMPTS:-720/);
});
