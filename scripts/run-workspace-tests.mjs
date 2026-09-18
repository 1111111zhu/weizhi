#!/usr/bin/env node
import { spawn } from "node:child_process";

const DEFAULT_CONCURRENCY = 2;
const DEFAULT_EMP_SHARDS = 2;
const DEFAULT_VITEST_MAX_WORKERS = 2;
const SERIAL_WORKSPACES = new Set([
  "@project-wing/api",
  "@project-wing/cmp",
  "@project-wing/intranet",
  "@project-wing/tms",
]);

function pnpmArgs(...args) {
  return ["pnpm", ...args];
}

function createVitestTask(packageName, vitestWorkerArgs, testFilters = []) {
  return {
    label: packageName,
    command: "corepack",
    args: pnpmArgs(
      "--filter",
      packageName,
      "exec",
      "vitest",
      "run",
      ...testFilters,
      ...vitestWorkerArgs
    ),
  };
}

export function parsePositiveInteger(value, fallback) {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

export function createWorkspaceTestTasks({
  empShards = DEFAULT_EMP_SHARDS,
  vitestMaxWorkers = DEFAULT_VITEST_MAX_WORKERS,
} = {}) {
  const tasks = [];
  const vitestWorkerArgs = vitestMaxWorkers
    ? [`--maxWorkers=${vitestMaxWorkers}`]
    : [];

  for (let shard = 1; shard <= empShards; shard += 1) {
    tasks.push({
      label: `@project-wing/emp shard ${shard}/${empShards}`,
      command: "corepack",
      args: pnpmArgs(
        "--filter",
        "@project-wing/emp",
        "exec",
        "vitest",
        "run",
        `--shard=${shard}/${empShards}`,
        ...vitestWorkerArgs
      ),
    });
  }

  return [
    ...tasks,
    {
      label: "@project-wing/api",
      command: "corepack",
      args: pnpmArgs("--filter", "@project-wing/api", "test:ci"),
    },
    createVitestTask("@project-wing/desktop-agent", vitestWorkerArgs),
    createVitestTask("@project-wing/shared", vitestWorkerArgs, ["src"]),
    createVitestTask("@project-wing/cmp", vitestWorkerArgs),
    createVitestTask("@project-wing/tms", vitestWorkerArgs),
    createVitestTask("@project-wing/intranet", vitestWorkerArgs),
    createVitestTask("@project-wing/desktop-agent-ui", vitestWorkerArgs),
    createVitestTask("@project-wing/ui", vitestWorkerArgs),
    createVitestTask("@project-wing/ui-showroom", vitestWorkerArgs),
    createVitestTask("@project-wing/desktop-agent-desktop", vitestWorkerArgs),
  ];
}

function runCommand(task) {
  return new Promise((resolve) => {
    console.log(`\nworkspace-test: starting ${task.label}`);
    const child = spawn(task.command, task.args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", (error) => {
      console.error(`workspace-test: ${task.label} failed to start`);
      console.error(error.message);
      resolve({ ...task, status: 1 });
    });
    child.on("close", (status = 1) => {
      const exitStatus = status ?? 1;
      const result = exitStatus === 0 ? "passed" : `failed (${exitStatus})`;
      console.log(`workspace-test: ${task.label} ${result}`);
      resolve({ ...task, status: exitStatus });
    });
  });
}

async function runPool(tasks, concurrency) {
  const results = [];
  const pending = [...tasks];
  const workers = Array.from(
    { length: Math.min(concurrency, pending.length) },
    async () => {
      while (pending.length > 0) {
        const task = pending.shift();
        if (!task) {
          return;
        }
        results.push(await runCommand(task));
      }
    }
  );
  await Promise.all(workers);
  return results;
}

export function groupWorkspaceTestTasks(tasks) {
  return {
    emp: tasks.filter((task) => task.label.startsWith("@project-wing/emp ")),
    parallel: tasks.filter(
      (task) =>
        !task.label.startsWith("@project-wing/emp ") &&
        !SERIAL_WORKSPACES.has(task.label)
    ),
    serial: tasks.filter((task) => SERIAL_WORKSPACES.has(task.label)),
  };
}

async function runWorkspaceTestPhases(tasks, concurrency) {
  const groups = groupWorkspaceTestTasks(tasks);
  return [
    ...(await runPool(groups.emp, concurrency)),
    ...(await runPool(groups.parallel, concurrency)),
    ...(await runPool(groups.serial, 1)),
  ];
}

export async function runWorkspaceTests({
  concurrency = parsePositiveInteger(
    process.env.PW_TEST_WORKSPACE_CONCURRENCY,
    DEFAULT_CONCURRENCY
  ),
  empShards = parsePositiveInteger(
    process.env.PW_TEST_EMP_SHARDS,
    DEFAULT_EMP_SHARDS
  ),
  vitestMaxWorkers = parsePositiveInteger(
    process.env.PW_TEST_VITEST_MAX_WORKERS,
    DEFAULT_VITEST_MAX_WORKERS
  ),
} = {}) {
  const prebuild = {
    label: "@project-wing/shared build",
    command: "corepack",
    args: pnpmArgs("--filter", "@project-wing/shared", "build"),
  };
  const prebuildResult = await runCommand(prebuild);
  if (prebuildResult.status !== 0) {
    return prebuildResult.status;
  }

  const tasks = createWorkspaceTestTasks({ empShards, vitestMaxWorkers });
  const results = await runWorkspaceTestPhases(tasks, concurrency);
  const failed = results.filter((result) => result.status !== 0);
  if (failed.length === 0) {
    return 0;
  }

  console.error(
    `workspace-test: ${failed.length} task(s) failed: ${failed
      .map((result) => result.label)
      .join(", ")}`
  );
  return 1;
}

if (process.argv[1] === import.meta.filename) {
  const status = await runWorkspaceTests();
  process.exit(status);
}
