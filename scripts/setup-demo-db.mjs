import { execFileSync } from "node:child_process";

import {
  demoDatabaseName,
  demoDatabaseUrl,
  demoUploadDir,
  repoRoot,
} from "./local-demo-config.mjs";

const demoEnv = {
  ...process.env,
  DATABASE_URL: demoDatabaseUrl,
  UPLOAD_DIR: demoUploadDir,
};

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: repoRoot,
    env: options.env ?? process.env,
    stdio: "inherit",
  });
}

function read(command, args) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf-8",
  }).trim();
}

function ensureDemoDatabase() {
  const exists = read("docker", [
    "exec",
    "projectwing-postgres",
    "psql",
    "-U",
    "projectwing",
    "-d",
    "postgres",
    "-Atc",
    `select 1 from pg_database where datname = '${demoDatabaseName}'`,
  ]);
  if (exists === "1") {
    return;
  }

  run("docker", [
    "exec",
    "projectwing-postgres",
    "createdb",
    "-U",
    "projectwing",
    demoDatabaseName,
  ]);
}

try {
  try {
    run("docker", ["compose", "up", "-d", "postgres"]);
  } catch {
    const running = read("docker", [
      "inspect",
      "-f",
      "{{.State.Running}}",
      "projectwing-postgres",
    ]);
    if (running !== "true") {
      run("docker", ["start", "projectwing-postgres"]);
    }
  }
  ensureDemoDatabase();
  run("corepack", ["pnpm", "db:generate"], { env: demoEnv });
  run(
    "corepack",
    [
      "pnpm",
      "--filter",
      "@project-wing/api",
      "exec",
      "prisma",
      "migrate",
      "deploy",
    ],
    { env: demoEnv }
  );
  run("corepack", ["pnpm", "db:seed"], { env: demoEnv });
  run("corepack", ["pnpm", "db:seed:demo"], { env: demoEnv });
  console.log(`\nDemo database ready: ${demoDatabaseName}`);
  console.log(`DATABASE_URL=${demoDatabaseUrl}`);
  console.log(`UPLOAD_DIR=${demoUploadDir}`);
} catch (error) {
  console.error("Failed to initialize the demo database.");
  process.exitCode = error instanceof Error ? 1 : 1;
}
