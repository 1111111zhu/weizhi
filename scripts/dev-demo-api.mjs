import { spawn } from "node:child_process";

import {
  demoAuthSecret,
  demoDatabaseUrl,
  demoUploadDir,
  repoRoot,
} from "./local-demo-config.mjs";

const apiRoot = `${repoRoot}/apps/api`;
const target = process.argv[2] ?? "api";
const command =
  target === "preview-worker"
    ? ["pnpm", "exec", "tsx", "watch", "src/preview-worker.main.ts"]
    : ["pnpm", "exec", "nest", "start", "--watch"];

if (target !== "api" && target !== "preview-worker") {
  throw new Error(`Unknown local backend target: ${target}`);
}

const api = spawn(
  process.platform === "win32" ? "corepack.cmd" : "corepack",
  command,
  {
    cwd: apiRoot,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? demoDatabaseUrl,
      UPLOAD_DIR: process.env.UPLOAD_DIR ?? demoUploadDir,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? demoAuthSecret,
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
      BETTER_AUTH_TRUSTED_ORIGINS:
        process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "http://localhost:3001",
      PROJECTWING_ENVIRONMENT:
        process.env.PROJECTWING_ENVIRONMENT ?? "development",
    },
    stdio: "inherit",
  }
);

api.on("exit", (code) => process.exit(code ?? 1));
