import assert from "node:assert/strict";
import test from "node:test";

import {
  createWorkspaceTestTasks,
  groupWorkspaceTestTasks,
  parsePositiveInteger,
} from "./run-workspace-tests.mjs";

test("parses positive integer environment overrides", () => {
  assert.equal(parsePositiveInteger("3", 1), 3);
  assert.equal(parsePositiveInteger("0", 4), 4);
  assert.equal(parsePositiveInteger("invalid", 4), 4);
  assert.equal(parsePositiveInteger(undefined, 2), 2);
});

test("creates workspace test tasks with EMP shards", () => {
  const tasks = createWorkspaceTestTasks({ empShards: 3, vitestMaxWorkers: 1 });

  assert.deepEqual(
    tasks.map((task) => task.label),
    [
      "@project-wing/emp shard 1/3",
      "@project-wing/emp shard 2/3",
      "@project-wing/emp shard 3/3",
      "@project-wing/api",
      "@project-wing/desktop-agent",
      "@project-wing/shared",
      "@project-wing/cmp",
      "@project-wing/tms",
      "@project-wing/intranet",
      "@project-wing/desktop-agent-ui",
      "@project-wing/ui",
      "@project-wing/ui-showroom",
      "@project-wing/desktop-agent-desktop",
    ]
  );
  assert.deepEqual(tasks[0].args.slice(-3), [
    "run",
    "--shard=1/3",
    "--maxWorkers=1",
  ]);
  assert.deepEqual(tasks[4].args.slice(-3), [
    "vitest",
    "run",
    "--maxWorkers=1",
  ]);
  assert.deepEqual(tasks[5].args.slice(-3), ["run", "src", "--maxWorkers=1"]);
});

test("caps Vitest workers when no override is set", () => {
  const tasks = createWorkspaceTestTasks({ empShards: 1 });

  assert.deepEqual(tasks[0].args.slice(-3), [
    "run",
    "--shard=1/1",
    "--maxWorkers=2",
  ]);
  assert.deepEqual(tasks[2].args.slice(-3), [
    "vitest",
    "run",
    "--maxWorkers=2",
  ]);
  assert.deepEqual(tasks[3].args.slice(-3), ["run", "src", "--maxWorkers=2"]);
});

test("serializes resource-heavy workspace suites", () => {
  const groups = groupWorkspaceTestTasks(
    createWorkspaceTestTasks({ empShards: 2 })
  );

  assert.deepEqual(
    groups.emp.map((task) => task.label),
    ["@project-wing/emp shard 1/2", "@project-wing/emp shard 2/2"]
  );
  assert.deepEqual(
    groups.parallel.map((task) => task.label),
    [
      "@project-wing/desktop-agent",
      "@project-wing/shared",
      "@project-wing/desktop-agent-ui",
      "@project-wing/ui",
      "@project-wing/ui-showroom",
      "@project-wing/desktop-agent-desktop",
    ]
  );
  assert.deepEqual(
    groups.serial.map((task) => task.label),
    [
      "@project-wing/api",
      "@project-wing/cmp",
      "@project-wing/tms",
      "@project-wing/intranet",
    ]
  );
});
