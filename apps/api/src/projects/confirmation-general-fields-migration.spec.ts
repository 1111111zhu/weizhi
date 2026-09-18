import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("migrates legacy IDs with the latest name without changing project content", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "CREATE TABLE project_confirmation_defaults (id text, base_information jsonb, updated_at timestamp);"
    );
    for (const [id, name, value, date] of [
      ["a", "Old name", "A content", "2026-09-01"],
      ["b", "New name", "B content", "2026-09-02"],
    ]) {
      await db.query(
        "INSERT INTO project_confirmation_defaults VALUES ($1, $2, $3)",
        [
          id,
          JSON.stringify({ customFields: [{ id: "stable-id", name, value }] }),
          date,
        ]
      );
    }
    await db.exec(
      await readFile(
        "prisma/migrations/20260907031500_confirmation_general_fields/migration.sql",
        "utf8"
      )
    );
    expect(
      (await db.query("SELECT id, name FROM confirmation_general_fields")).rows
    ).toEqual([{ id: "stable-id", name: "New name" }]);
    expect(
      (
        await db.query(
          "SELECT base_information->'customFields'->0->>'value' AS value FROM project_confirmation_defaults ORDER BY id"
        )
      ).rows
    ).toEqual([{ value: "A content" }, { value: "B content" }]);
  } finally {
    await db.close();
  }
}, 15000);
