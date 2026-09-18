import { rename, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire("/app/apps/api/package.json");
const { Client } = require("pg");

const databaseUrl = process.env.DATABASE_URL;
const releaseKey = process.env.PROJECTWING_RELEASE_KEY;
const statusFile = "/deployment-lock/status.json";
const temporaryFile = `${statusFile}.tmp`;
const lockKey = process.env.PROJECTWING_DEPLOYMENT_LOCK_KEY ?? "578523119473";
const waitSeconds = Number(process.env.PROJECTWING_DEPLOYMENT_LOCK_WAIT_SECONDS ?? "300");
const maximumSeconds = Number(process.env.PROJECTWING_DEPLOYMENT_LOCK_MAX_SECONDS ?? "5400");

if (!databaseUrl || !releaseKey || !/^\w[\w.-]+$/.test(releaseKey)) {
  throw new Error("DATABASE_URL and a valid PROJECTWING_RELEASE_KEY are required.");
}
if (!/^\d+$/.test(lockKey) || !Number.isInteger(waitSeconds) || !Number.isInteger(maximumSeconds)) {
  throw new Error("Deployment lock settings are invalid.");
}

async function writeStatus(state, detail = "") {
  const value = JSON.stringify({ state, detail, releaseKey, heartbeat: Date.now() });
  await writeFile(temporaryFile, `${value}\n`, { mode: 0o600 });
  await rename(temporaryFile, statusFile);
}

const client = new Client({ connectionString: databaseUrl });
let stopping = false;
let heartbeat;
let deadline;

async function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  clearInterval(heartbeat);
  clearTimeout(deadline);
  try {
    await client.query("SELECT pg_advisory_unlock($1::bigint)", [lockKey]);
  } finally {
    await client.end().catch(() => undefined);
    process.exit(exitCode);
  }
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => void stop(0));
}

await client.connect();
const waitDeadline = Date.now() + waitSeconds * 1000;
await writeStatus("waiting");
while (true) {
  const result = await client.query(
    "SELECT pg_try_advisory_lock($1::bigint) AS acquired",
    [lockKey],
  );
  if (result.rows[0]?.acquired === true) break;
  if (Date.now() >= waitDeadline) {
    await writeStatus("busy", "Timed out waiting for the global deployment lock.");
    await client.end();
    process.exit(75);
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

await writeStatus("acquired");
heartbeat = setInterval(async () => {
  try {
    await client.query("SELECT 1");
    await writeStatus("acquired");
  } catch (error) {
    await writeStatus("error", error instanceof Error ? error.message : String(error));
    await stop(1);
  }
}, 10000);
deadline = setTimeout(() => void stop(1), maximumSeconds * 1000);
