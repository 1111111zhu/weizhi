import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "prisma/migrations/20260902170000_cmp_group_relationship_refactor/migration.sql"
  ),
  "utf8"
);

describe("CMP group relationship refactor migration", () => {
  it("converts only company-to-company legacy associate and joint-venture facts", () => {
    expect(migration).toContain("target.\"kind\" = 'COMPANY'");
    expect(migration).toContain("participant.\"kind\" = 'COMPANY'");
    expect(migration).toContain("WHEN 'ASSOCIATE_OF' THEN 'ASSOCIATE'");
    expect(migration).toContain("ELSE 'JOINT_VENTURE'");
  });

  it("removes control and voting-right data while preserving only mutable drafts", () => {
    expect(migration).toContain(
      "'CONTROLS', 'ASSOCIATE_OF', 'JOINT_VENTURE_WITH'"
    );
    expect(migration).toContain('DROP COLUMN "voting_percentage"');
    expect(migration).toContain("'DRAFT', 'STAFF_EDITING', 'RETURNED'");
    expect(migration).not.toContain("WHERE \"status\" IN ('SUBMITTED'");
  });
});
