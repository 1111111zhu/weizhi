import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.resolve(
    process.cwd(),
    "prisma/migrations/20260901152000_reconcile_linked_cmp_project_members/migration.sql"
  ),
  "utf-8"
);

describe("linked CMP project responsibility backfill", () => {
  it("reconciles existing linked projects with the same PIC and MIC rules as runtime linking", () => {
    expect(migration).toContain("'PARTNER_IN_CHARGE'");
    expect(migration).toContain("'MANAGER_IN_CHARGE'");
    expect(migration).toContain("IN ('PARTNER', 'PRINCIPAL')");
    expect(migration).toContain("IN ('MANAGER', 'SENIOR_MANAGER')");
    expect(
      migration.match(/ON CONFLICT \("project_id", "user_id"\)/g)
    ).toHaveLength(2);
    expect(migration).toContain('"project_role" = EXCLUDED."project_role"');
    expect(migration).toContain("\"status\" = 'ACTIVE'");
  });
});
