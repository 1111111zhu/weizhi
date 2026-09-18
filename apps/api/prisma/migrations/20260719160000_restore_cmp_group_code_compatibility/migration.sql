-- Restore the legacy group-code model after the primary-client experiment was
-- reverted. The guards keep this migration safe for databases that never ran
-- the experimental migration.
ALTER TABLE "cmp_client_groups"
ADD COLUMN IF NOT EXISTS "group_code" TEXT;

DROP TRIGGER IF EXISTS "cmp_client_groups_primary_membership_check"
ON "cmp_client_groups";

DROP TRIGGER IF EXISTS "cmp_clients_primary_membership_check"
ON "cmp_clients";

DROP FUNCTION IF EXISTS "enforce_cmp_group_primary_client_membership"();

ALTER TABLE "cmp_client_groups"
DROP CONSTRAINT IF EXISTS "cmp_client_groups_primary_client_id_fkey";

DROP INDEX IF EXISTS "cmp_client_groups_primary_client_id_key";
DROP INDEX IF EXISTS "cmp_client_groups_status_primary_client_id_idx";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cmp_client_groups'
      AND column_name = 'primary_client_id'
  ) THEN
    EXECUTE $sql$
      UPDATE "cmp_client_groups" AS "group"
      SET "group_code" = "client"."client_code"
      FROM "cmp_clients" AS "client"
      WHERE "group"."group_code" IS NULL
        AND "group"."primary_client_id" = "client"."id"
        AND NOT EXISTS (
          SELECT 1
          FROM "cmp_client_groups" AS "other_group"
          WHERE "other_group"."id" <> "group"."id"
            AND "other_group"."group_code" = "client"."client_code"
        )
    $sql$;
  END IF;
END
$$;

UPDATE "cmp_client_groups"
SET "group_code" = 'GROUP-' || "id"
WHERE "group_code" IS NULL OR BTRIM("group_code") = '';

ALTER TABLE "cmp_client_groups"
ALTER COLUMN "group_code" SET NOT NULL;

ALTER TABLE "cmp_client_groups"
DROP COLUMN IF EXISTS "primary_client_id";

CREATE UNIQUE INDEX IF NOT EXISTS "cmp_client_groups_group_code_key"
ON "cmp_client_groups"("group_code");

CREATE INDEX IF NOT EXISTS "cmp_client_groups_status_group_code_idx"
ON "cmp_client_groups"("status", "group_code");
