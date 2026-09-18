import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("unified work-item migration", () => {
  const database = new PGlite();

  beforeAll(async () => {
    const migration = readFileSync(
      "prisma/migrations/20260831170000_unified_work_items/migration.sql",
      "utf-8"
    );
    await database.exec(migration);
  });

  afterAll(async () => {
    await database.close();
  });

  it("allows an active item with a responsibility selector", async () => {
    await expect(
      database.exec(`
        BEGIN;
        INSERT INTO work_item_records (
          id, dedupe_key, rule_id, domain, subject_type, subject_id,
          state, severity, priority, display_content, content_key,
          content_params, action_target, opened_at, source_updated_at
        ) VALUES (
          'item-valid', 'PRJ-005:REVIEW_QUESTION:q-1:active', 'PRJ-005',
          'PROJECT', 'REVIEW_QUESTION', 'q-1', 'OPEN', 'BLOCKER', 'HIGH',
          'Question remains open', 'PRJ-005', '{}'::jsonb, '{}'::jsonb,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );
        INSERT INTO work_item_responsibilities (
          id, work_item_id, selector_type, selector_key, user_id
        ) VALUES (
          'responsibility-valid', 'item-valid', 'USER', 'USER:user-1', 'user-1'
        );
        COMMIT;
      `)
    ).resolves.toBeDefined();
  });

  it("rejects an active item without a responsibility selector", async () => {
    await expect(
      database.exec(`
        INSERT INTO work_item_records (
          id, dedupe_key, rule_id, domain, subject_type, subject_id,
          state, severity, priority, display_content, content_key,
          content_params, action_target, opened_at, source_updated_at
        ) VALUES (
          'item-orphan', 'CMP-999:OBJECT:o-1:active', 'CMP-999',
          'CMP', 'OBJECT', 'o-1', 'OPEN', 'BLOCKER', 'HIGH',
          'Orphan item', 'CMP-999', '{}'::jsonb, '{}'::jsonb,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );
      `)
    ).rejects.toThrow("must have at least one responsibility selector");
  });
});
