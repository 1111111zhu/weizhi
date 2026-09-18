import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

const apiDirectory = fileURLToPath(new URL("../", import.meta.url));
const databaseUrl = process.env.DATABASE_URL;
const lockKey = process.env.PROJECTWING_MIGRATION_LOCK_KEY ?? "578523119474";
const lockWaitSeconds = Number(process.env.PROJECTWING_MIGRATION_LOCK_WAIT_SECONDS ?? "60");

if (!databaseUrl || !/^\d+$/.test(lockKey) || !Number.isInteger(lockWaitSeconds)) {
  throw new Error("Valid database and migration lock settings are required.");
}

function run(command, arguments_) {
  const pgOptions = [
    process.env.PGOPTIONS ?? "",
    "-c lock_timeout=30000",
    "-c statement_timeout=1800000",
  ]
    .filter(Boolean)
    .join(" ");
  const result = spawnSync(command, arguments_, {
    cwd: apiDirectory,
    env: { ...process.env, PGOPTIONS: pgOptions },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}.`);
  }
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();
let acquired = false;
try {
  const deadline = Date.now() + lockWaitSeconds * 1000;
  while (!acquired) {
    const result = await client.query(
      "SELECT pg_try_advisory_lock($1::bigint) AS acquired",
      [lockKey],
    );
    acquired = result.rows[0]?.acquired === true;
    if (acquired) break;
    if (Date.now() >= deadline) {
      throw new Error("Timed out waiting for the migration advisory lock.");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  run("node", ["prisma/recover-failed-migrations.mjs"]);
  run("./node_modules/.bin/prisma", ["migrate", "deploy"]);
  run("./node_modules/.bin/tsx", ["prisma/backfill-cmp-client-versions.ts"]);
} finally {
  if (acquired) {
    await client.query("SELECT pg_advisory_unlock($1::bigint)", [lockKey]);
  }
  await client.end();
}
