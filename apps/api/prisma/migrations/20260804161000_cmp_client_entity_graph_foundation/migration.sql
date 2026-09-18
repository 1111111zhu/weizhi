-- Add a client-centric entity graph alongside the legacy Group/Client model.
CREATE TYPE "CmpEntityKind" AS ENUM (
  'COMPANY',
  'PERSON',
  'TRUST',
  'PARTNERSHIP',
  'OTHER_ORGANISATION'
);

CREATE TYPE "CmpClientEntityRole" AS ENUM (
  'ROOT',
  'RELATED'
);

CREATE TYPE "CmpEntityRelationshipType" AS ENUM (
  'OWNS',
  'CONTROLS',
  'DIRECTOR_OF',
  'BENEFICIAL_OWNER_OF',
  'COMPANY_SECRETARY_OF',
  'MANAGES',
  'ASSOCIATE_OF',
  'JOINT_VENTURE_WITH',
  'OTHER'
);

CREATE TABLE "cmp_entities" (
  "id" TEXT NOT NULL,
  "kind" "CmpEntityKind" NOT NULL,
  "display_name" TEXT NOT NULL,
  "name_zh" TEXT,
  "name_en" TEXT,
  "jurisdiction" TEXT,
  "registration_number" TEXT,
  "incorporation_date" TIMESTAMP(3),
  "date_of_birth" TIMESTAMP(3),
  "nationality" TEXT,
  "remarks" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cmp_entities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cmp_entities_kind_display_name_idx"
ON "cmp_entities"("kind", "display_name");

CREATE INDEX "cmp_entities_jurisdiction_registration_number_idx"
ON "cmp_entities"("jurisdiction", "registration_number");

CREATE TABLE "cmp_client_entity_scopes" (
  "client_id" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "role" "CmpClientEntityRole" NOT NULL DEFAULT 'RELATED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cmp_client_entity_scopes_pkey" PRIMARY KEY ("client_id", "entity_id")
);

CREATE INDEX "cmp_client_entity_scopes_client_id_role_idx"
ON "cmp_client_entity_scopes"("client_id", "role");

CREATE INDEX "cmp_client_entity_scopes_entity_id_role_idx"
ON "cmp_client_entity_scopes"("entity_id", "role");

CREATE UNIQUE INDEX "cmp_client_entity_scopes_single_root_idx"
ON "cmp_client_entity_scopes"("client_id")
WHERE "role" = 'ROOT';

ALTER TABLE "cmp_client_entity_scopes"
ADD CONSTRAINT "cmp_client_entity_scopes_client_id_fkey"
FOREIGN KEY ("client_id") REFERENCES "cmp_clients"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cmp_client_entity_scopes"
ADD CONSTRAINT "cmp_client_entity_scopes_entity_id_fkey"
FOREIGN KEY ("entity_id") REFERENCES "cmp_entities"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cmp_entity_relationships" (
  "id" TEXT NOT NULL,
  "from_entity_id" TEXT NOT NULL,
  "to_entity_id" TEXT NOT NULL,
  "type" "CmpEntityRelationshipType" NOT NULL,
  "ownership_percentage" DECIMAL(5, 2),
  "voting_percentage" DECIMAL(5, 2),
  "effective_from" TIMESTAMP(3),
  "effective_to" TIMESTAMP(3),
  "remarks" TEXT,
  "created_by_id" TEXT,
  "reviewed_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cmp_entity_relationships_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cmp_entity_relationships_from_entity_id_effective_to_idx"
ON "cmp_entity_relationships"("from_entity_id", "effective_to");

CREATE INDEX "cmp_entity_relationships_to_entity_id_effective_to_idx"
ON "cmp_entity_relationships"("to_entity_id", "effective_to");

CREATE INDEX "cmp_entity_relationships_type_effective_to_idx"
ON "cmp_entity_relationships"("type", "effective_to");

ALTER TABLE "cmp_entity_relationships"
ADD CONSTRAINT "cmp_entity_relationships_from_entity_id_fkey"
FOREIGN KEY ("from_entity_id") REFERENCES "cmp_entities"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cmp_entity_relationships"
ADD CONSTRAINT "cmp_entity_relationships_to_entity_id_fkey"
FOREIGN KEY ("to_entity_id") REFERENCES "cmp_entities"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill one root Company entity per existing Client.
INSERT INTO "cmp_entities" (
  "id",
  "kind",
  "display_name",
  "name_zh",
  "name_en",
  "jurisdiction",
  "registration_number",
  "incorporation_date",
  "remarks",
  "created_at",
  "updated_at"
)
SELECT
  'cmp_entity_' || "id",
  'COMPANY'::"CmpEntityKind",
  COALESCE(
    NULLIF(BTRIM("name_en"), ''),
    NULLIF(BTRIM("name_zh"), ''),
    "client_code"
  ),
  NULLIF(BTRIM("name_zh"), ''),
  NULLIF(BTRIM("name_en"), ''),
  COALESCE(
    NULLIF(BTRIM("place_of_incorporation"), ''),
    NULLIF(BTRIM("country_or_district"), '')
  ),
  NULLIF(BTRIM("company_number"), ''),
  "date_of_incorporation",
  "remarks",
  "created_at",
  "updated_at"
FROM "cmp_clients";

INSERT INTO "cmp_client_entity_scopes" (
  "client_id",
  "entity_id",
  "role",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  'cmp_entity_' || "id",
  'ROOT'::"CmpClientEntityRole",
  "created_at",
  "updated_at"
FROM "cmp_clients";

-- A Client initially sees the other existing Client entities in its legacy Group.
INSERT INTO "cmp_client_entity_scopes" (
  "client_id",
  "entity_id",
  "role",
  "created_at",
  "updated_at"
)
SELECT
  "viewer"."id",
  'cmp_entity_' || "member"."id",
  'RELATED'::"CmpClientEntityRole",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "cmp_clients" AS "viewer"
JOIN "cmp_clients" AS "member"
  ON "viewer"."group_id" = "member"."group_id"
WHERE "viewer"."group_id" IS NOT NULL
  AND "viewer"."id" <> "member"."id"
ON CONFLICT ("client_id", "entity_id") DO NOTHING;

-- Preserve visibility for legacy relationships that cross Group boundaries.
INSERT INTO "cmp_client_entity_scopes" (
  "client_id",
  "entity_id",
  "role",
  "created_at",
  "updated_at"
)
SELECT
  "relationship"."from_client_id",
  'cmp_entity_' || "relationship"."to_client_id",
  'RELATED'::"CmpClientEntityRole",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "cmp_client_relationships" AS "relationship"
ON CONFLICT ("client_id", "entity_id") DO NOTHING;

INSERT INTO "cmp_client_entity_scopes" (
  "client_id",
  "entity_id",
  "role",
  "created_at",
  "updated_at"
)
SELECT
  "relationship"."to_client_id",
  'cmp_entity_' || "relationship"."from_client_id",
  'RELATED'::"CmpClientEntityRole",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "cmp_client_relationships" AS "relationship"
ON CONFLICT ("client_id", "entity_id") DO NOTHING;

-- Convert the existing Client relationship history into Entity edges.
INSERT INTO "cmp_entity_relationships" (
  "id",
  "from_entity_id",
  "to_entity_id",
  "type",
  "ownership_percentage",
  "effective_from",
  "effective_to",
  "remarks",
  "created_by_id",
  "created_at",
  "updated_at"
)
SELECT
  'cmp_entity_relationship_' || "id",
  'cmp_entity_' || "from_client_id",
  'cmp_entity_' || "to_client_id",
  CASE "type"::TEXT
    WHEN 'SUBSIDIARY' THEN 'OWNS'::"CmpEntityRelationshipType"
    WHEN 'ASSOCIATE' THEN 'ASSOCIATE_OF'::"CmpEntityRelationshipType"
    WHEN 'JOINT_VENTURE' THEN 'JOINT_VENTURE_WITH'::"CmpEntityRelationshipType"
    ELSE 'OTHER'::"CmpEntityRelationshipType"
  END,
  "ownership_percentage",
  "effective_from",
  "effective_to",
  "remarks",
  "created_by_id",
  "created_at",
  "updated_at"
FROM "cmp_client_relationships";

-- Keep the root Entity synchronized while the legacy Client form remains writable.
CREATE FUNCTION "sync_cmp_client_root_entity"()
RETURNS TRIGGER AS $$
DECLARE
  root_entity_id TEXT := 'cmp_entity_' || NEW."id";
BEGIN
  INSERT INTO "cmp_entities" (
    "id",
    "kind",
    "display_name",
    "name_zh",
    "name_en",
    "jurisdiction",
    "registration_number",
    "incorporation_date",
    "remarks",
    "created_at",
    "updated_at"
  )
  VALUES (
    root_entity_id,
    'COMPANY'::"CmpEntityKind",
    COALESCE(
      NULLIF(BTRIM(NEW."name_en"), ''),
      NULLIF(BTRIM(NEW."name_zh"), ''),
      NEW."client_code"
    ),
    NULLIF(BTRIM(NEW."name_zh"), ''),
    NULLIF(BTRIM(NEW."name_en"), ''),
    COALESCE(
      NULLIF(BTRIM(NEW."place_of_incorporation"), ''),
      NULLIF(BTRIM(NEW."country_or_district"), '')
    ),
    NULLIF(BTRIM(NEW."company_number"), ''),
    NEW."date_of_incorporation",
    NEW."remarks",
    NEW."created_at",
    NEW."updated_at"
  )
  ON CONFLICT ("id") DO UPDATE SET
    "display_name" = EXCLUDED."display_name",
    "name_zh" = EXCLUDED."name_zh",
    "name_en" = EXCLUDED."name_en",
    "jurisdiction" = EXCLUDED."jurisdiction",
    "registration_number" = EXCLUDED."registration_number",
    "incorporation_date" = EXCLUDED."incorporation_date",
    "remarks" = EXCLUDED."remarks",
    "updated_at" = EXCLUDED."updated_at";

  INSERT INTO "cmp_client_entity_scopes" (
    "client_id",
    "entity_id",
    "role",
    "created_at",
    "updated_at"
  )
  VALUES (
    NEW."id",
    root_entity_id,
    'ROOT'::"CmpClientEntityRole",
    NEW."created_at",
    NEW."updated_at"
  )
  ON CONFLICT ("client_id", "entity_id") DO UPDATE SET
    "role" = 'ROOT'::"CmpClientEntityRole",
    "updated_at" = EXCLUDED."updated_at";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cmp_clients_sync_root_entity"
AFTER INSERT OR UPDATE OF
  "client_code",
  "company_number",
  "name_zh",
  "name_en",
  "place_of_incorporation",
  "country_or_district",
  "date_of_incorporation",
  "remarks"
ON "cmp_clients"
FOR EACH ROW
EXECUTE FUNCTION "sync_cmp_client_root_entity"();
