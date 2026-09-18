import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

const apiDirectory = fileURLToPath(new URL("../", import.meta.url));
// This migration can fail on installations that already contain duplicate
// Active change requests. The registered recovery SQL performs an
// Audit-preserving cleanup before the migration is marked rolled back and
// Retried.
const recoverableMigrations = [
  "20260723103000_cmp_single_active_change_request",
  "20260731123000_remove_legacy_smart_form_v1",
];
const recoverySqlByMigration = new Map([
  [
    "20260723103000_cmp_single_active_change_request",
    new URL("recover-cmp-single-active-change-request.sql", import.meta.url),
  ],
  [
    "20260731123000_remove_legacy_smart_form_v1",
    new URL("recover-smart-form-v1.sql", import.meta.url),
  ],
]);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to inspect failed migrations.");
}

let failedMigrations = [];
const inspectionClient = new Client({ connectionString: databaseUrl });
await inspectionClient.connect();
try {
  const tableResult = await inspectionClient.query(
    `SELECT to_regclass('"_prisma_migrations"') AS table_name`
  );
  if (tableResult.rows[0]?.table_name) {
    const result = await inspectionClient.query(
      `
        SELECT migration_name
        FROM "_prisma_migrations"
        WHERE migration_name = ANY($1::text[])
          AND finished_at IS NULL
          AND rolled_back_at IS NULL
          AND logs IS NOT NULL
        ORDER BY started_at
      `,
      [recoverableMigrations]
    );
    failedMigrations = result.rows.map((row) => row.migration_name);
  }
} finally {
  await inspectionClient.end();
}

for (const migrationName of failedMigrations) {
  const recoverySqlPath = recoverySqlByMigration.get(migrationName);
  if (!recoverySqlPath) {
    throw new Error(`No recovery SQL is registered for ${migrationName}.`);
  }
  const recoverySql = await readFile(recoverySqlPath, "utf-8");
  const recoveryClient = new Client({ connectionString: databaseUrl });
  await recoveryClient.connect();
  try {
    await recoveryClient.query("BEGIN");
    await recoveryClient.query(recoverySql);
    await recoveryClient.query("COMMIT");
  } catch (error) {
    await recoveryClient.query("ROLLBACK");
    throw error;
  } finally {
    await recoveryClient.end();
  }

  console.log(
    `Recovering failed migration ${migrationName} before a safe retry.`
  );
  const result = spawnSync(
    "./node_modules/.bin/prisma",
    ["migrate", "resolve", "--rolled-back", migrationName],
    {
      cwd: apiDirectory,
      env: process.env,
      stdio: "inherit",
    }
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Failed to mark migration ${migrationName} as rolled back (exit ${result.status}).`
    );
  }
}
