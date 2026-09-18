import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const corepack = process.platform === "win32" ? "corepack.cmd" : "corepack";
const processes = [
  spawn(corepack, ["pnpm", "-r", "--parallel", "dev"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NEXT_PUBLIC_API_MODE: "local",
    },
    stdio: "inherit",
  }),
  spawn(
    corepack,
    ["pnpm", "--filter", "@project-wing/api", "dev:preview-worker"],
    {
      cwd: repoRoot,
      env: { ...process.env, PROJECTWING_ENVIRONMENT: "development" },
      stdio: "inherit",
    }
  ),
];

let stopping = false;
function stop(exitCode) {
  if (stopping) {
    return;
  }
  stopping = true;
  for (const process of processes) {
    process.kill("SIGTERM");
  }
  process.exitCode = exitCode;
}

for (const process of processes) {
  process.on("exit", (code) => stop(code ?? 1));
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
