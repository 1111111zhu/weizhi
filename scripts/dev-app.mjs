import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const [app, mode] = process.argv.slice(2);
const mockableApps = new Set(["emp", "cmp", "tms", "intranet"]);
const localApps = new Set([...mockableApps, "ib"]);

if (!app || !mode || !localApps.has(app) || !["local", "mock"].includes(mode)) {
  throw new Error("Usage: node scripts/dev-app.mjs <app> <local|mock>");
}
if (mode === "mock" && !mockableApps.has(app)) {
  throw new Error(`${app} does not provide a mock mode.`);
}

const child = spawn(
  process.platform === "win32" ? "corepack.cmd" : "corepack",
  ["pnpm", "--filter", `@project-wing/${app}`, "dev"],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      NEXT_PUBLIC_API_MODE: mode,
    },
    stdio: "inherit",
  }
);

child.on("exit", (code) => process.exit(code ?? 1));
