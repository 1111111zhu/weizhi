-- A client group is identified by an existing client rather than a separate
-- business code. Empty legacy groups remain repairable through the CMP UI.
ALTER TABLE "cmp_client_groups"
ADD COLUMN "primary_client_id" TEXT;

UPDATE "cmp_client_groups" AS "group"
SET "primary_client_id" = (
  SELECT "client"."id"
  FROM "cmp_clients" AS "client"
  WHERE "client"."group_id" = "group"."id"
  ORDER BY "client"."created_at" ASC, "client"."client_code" ASC
  LIMIT 1
);

DROP INDEX IF EXISTS "cmp_client_groups_status_group_code_idx";
DROP INDEX IF EXISTS "cmp_client_groups_group_code_key";

ALTER TABLE "cmp_client_groups"
DROP COLUMN "group_code";

CREATE UNIQUE INDEX "cmp_client_groups_primary_client_id_key"
ON "cmp_client_groups"("primary_client_id");

CREATE INDEX "cmp_client_groups_status_primary_client_id_idx"
ON "cmp_client_groups"("status", "primary_client_id");

ALTER TABLE "cmp_client_groups"
ADD CONSTRAINT "cmp_client_groups_primary_client_id_fkey"
FOREIGN KEY ("primary_client_id") REFERENCES "cmp_clients"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- The two foreign keys cannot express that the primary client must also be a
-- member of the same group. Deferred constraint triggers allow group creation
-- and membership assignment to happen in either order inside one transaction,
-- while still enforcing the invariant at commit time.
CREATE FUNCTION "enforce_cmp_group_primary_client_membership"()
RETURNS TRIGGER AS $$
DECLARE
  "identified_group_id" TEXT;
BEGIN
  IF TG_TABLE_NAME = 'cmp_client_groups' THEN
    IF NEW."primary_client_id" IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM "cmp_clients" AS "client"
      WHERE "client"."id" = NEW."primary_client_id"
        AND "client"."group_id" = NEW."id"
    ) THEN
      RAISE EXCEPTION 'CMP client group primary client must be a member of the same group'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1
      FROM "cmp_client_groups" AS "group"
      WHERE "group"."primary_client_id" = OLD."id"
    ) THEN
      RAISE EXCEPTION 'CMP client group primary client cannot be deleted while referenced'
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  SELECT "group"."id"
  INTO "identified_group_id"
  FROM "cmp_client_groups" AS "group"
  WHERE "group"."primary_client_id" = NEW."id";

  IF "identified_group_id" IS NOT NULL
    AND NEW."group_id" IS DISTINCT FROM "identified_group_id" THEN
    RAISE EXCEPTION 'CMP client group primary client must remain in the identified group'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "cmp_client_groups_primary_membership_check"
AFTER INSERT OR UPDATE ON "cmp_client_groups"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_cmp_group_primary_client_membership"();

CREATE CONSTRAINT TRIGGER "cmp_clients_primary_membership_check"
AFTER INSERT OR UPDATE OR DELETE ON "cmp_clients"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "enforce_cmp_group_primary_client_membership"();
