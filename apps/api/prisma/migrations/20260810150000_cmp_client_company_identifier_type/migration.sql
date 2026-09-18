ALTER TABLE "cmp_clients"
ADD COLUMN "company_identifier_type" TEXT NOT NULL DEFAULT 'COMPANY_REGISTRATION_NUMBER';

CREATE INDEX "cmp_clients_company_identifier_type_company_number_idx"
  ON "cmp_clients"("company_identifier_type", "company_number");

-- A canonical company identity can be established from identifier type + value
-- before descriptive profile fields are known during client onboarding.
ALTER TABLE "cmp_company_profiles"
  ALTER COLUMN "incorporation_date" DROP NOT NULL,
  ALTER COLUMN "registered_address" DROP NOT NULL;

-- Normalize legacy UI aliases so the same official identifier cannot bypass
-- canonical matching merely because it was entered under an older label.
UPDATE "cmp_company_profiles"
SET "identifier_type" = CASE UPPER(BTRIM("identifier_type"))
  WHEN 'CR_NUMBER' THEN 'COMPANY_REGISTRATION_NUMBER'
  WHEN 'BR_NUMBER' THEN 'BUSINESS_REGISTRATION_NUMBER'
  ELSE UPPER(BTRIM("identifier_type"))
END,
"updated_at" = CURRENT_TIMESTAMP;

-- Root entities are now maintained by the application because a canonical
-- firm-level company may be referenced by more than one Client. The legacy
-- trigger always recreated a client-owned entity and would undo that link.
DROP TRIGGER IF EXISTS "cmp_clients_sync_root_entity" ON "cmp_clients";
DROP FUNCTION IF EXISTS "sync_cmp_client_root_entity"();

-- Promote legacy Client root companies to canonical company identities.
INSERT INTO "cmp_company_profiles" (
  "entity_id",
  "identifier_type",
  "identifier_value",
  "incorporation_date",
  "company_type",
  "industry_classification",
  "registered_address",
  "principal_business_address",
  "created_at",
  "updated_at"
)
SELECT DISTINCT ON (scope."entity_id")
  scope."entity_id",
  client."company_identifier_type",
  BTRIM(client."company_number"),
  client."date_of_incorporation",
  CASE
    WHEN client."listed_or_private" = 'LISTED' THEN 'LISTED'::"CmpCompanyType"
    WHEN client."listed_or_private" = 'PRIVATE' THEN 'PRIVATE'::"CmpCompanyType"
    ELSE 'OTHER'::"CmpCompanyType"
  END,
  COALESCE(
    NULLIF(BTRIM(client."industry_business_nature_details"), ''),
    NULLIF(BTRIM(client."industry_or_business_nature"), '')
  ),
  NULLIF(BTRIM(client."address"), ''),
  NULLIF(BTRIM(client."address"), ''),
  entity."created_at",
  CURRENT_TIMESTAMP
FROM "cmp_client_entity_scopes" scope
JOIN "cmp_clients" client ON client."id" = scope."client_id"
JOIN "cmp_entities" entity ON entity."id" = scope."entity_id"
WHERE scope."role" = 'ROOT'
  AND entity."kind" = 'COMPANY'
  AND NULLIF(BTRIM(client."company_number"), '') IS NOT NULL
ON CONFLICT ("entity_id") DO NOTHING;

-- Consolidate legacy duplicates before enforcing the canonical identity key.
CREATE TEMP TABLE "_cmp_company_identity_duplicates" AS
WITH ranked AS (
  SELECT
    profile."entity_id",
    FIRST_VALUE(profile."entity_id") OVER (
      PARTITION BY LOWER(BTRIM(profile."identifier_type")),
                   LOWER(BTRIM(profile."identifier_value"))
      ORDER BY entity."created_at", profile."entity_id"
    ) AS "canonical_entity_id",
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(BTRIM(profile."identifier_type")),
                   LOWER(BTRIM(profile."identifier_value"))
      ORDER BY entity."created_at", profile."entity_id"
    ) AS "identity_rank"
  FROM "cmp_company_profiles" profile
  JOIN "cmp_entities" entity ON entity."id" = profile."entity_id"
  WHERE NULLIF(BTRIM(profile."identifier_type"), '') IS NOT NULL
    AND NULLIF(BTRIM(profile."identifier_value"), '') IS NOT NULL
)
SELECT
  "entity_id" AS "duplicate_entity_id",
  "canonical_entity_id"
FROM ranked
WHERE "identity_rank" > 1;

CREATE TEMP TABLE "_cmp_company_identity_scopes" AS
SELECT
  scope."client_id",
  duplicate."canonical_entity_id" AS "entity_id",
  CASE
    WHEN BOOL_OR(scope."role" = 'ROOT') THEN 'ROOT'::"CmpClientEntityRole"
    ELSE 'RELATED'::"CmpClientEntityRole"
  END AS "role",
  MIN(scope."created_at") AS "created_at"
FROM "cmp_client_entity_scopes" scope
JOIN "_cmp_company_identity_duplicates" duplicate
  ON duplicate."duplicate_entity_id" = scope."entity_id"
GROUP BY scope."client_id", duplicate."canonical_entity_id";

UPDATE "cmp_client_entity_scopes" scope
SET "role" = 'RELATED'::"CmpClientEntityRole",
    "updated_at" = CURRENT_TIMESTAMP
FROM "_cmp_company_identity_duplicates" duplicate
WHERE scope."entity_id" = duplicate."duplicate_entity_id"
  AND scope."role" = 'ROOT';

DELETE FROM "cmp_client_entity_scopes" scope
USING "_cmp_company_identity_duplicates" duplicate
WHERE scope."entity_id" = duplicate."duplicate_entity_id";

INSERT INTO "cmp_client_entity_scopes" (
  "client_id", "entity_id", "role", "created_at", "updated_at"
)
SELECT "client_id", "entity_id", "role", "created_at", CURRENT_TIMESTAMP
FROM "_cmp_company_identity_scopes"
ON CONFLICT ("client_id", "entity_id") DO UPDATE SET
  "role" = CASE
    WHEN EXCLUDED."role" = 'ROOT' THEN 'ROOT'::"CmpClientEntityRole"
    ELSE "cmp_client_entity_scopes"."role"
  END,
  "updated_at" = CURRENT_TIMESTAMP;

DELETE FROM "cmp_entity_relationships" relationship
USING "_cmp_company_identity_duplicates" duplicate
WHERE
  (relationship."from_entity_id" = duplicate."duplicate_entity_id"
    AND relationship."to_entity_id" = duplicate."canonical_entity_id")
  OR
  (relationship."to_entity_id" = duplicate."duplicate_entity_id"
    AND relationship."from_entity_id" = duplicate."canonical_entity_id");

UPDATE "cmp_entity_relationships" relationship
SET "from_entity_id" = duplicate."canonical_entity_id",
    "updated_at" = CURRENT_TIMESTAMP
FROM "_cmp_company_identity_duplicates" duplicate
WHERE relationship."from_entity_id" = duplicate."duplicate_entity_id";

UPDATE "cmp_entity_relationships" relationship
SET "to_entity_id" = duplicate."canonical_entity_id",
    "updated_at" = CURRENT_TIMESTAMP
FROM "_cmp_company_identity_duplicates" duplicate
WHERE relationship."to_entity_id" = duplicate."duplicate_entity_id";

DELETE FROM "cmp_entity_relationships"
WHERE "from_entity_id" = "to_entity_id";

CREATE TEMP TABLE "_cmp_company_identity_map_nodes" AS
SELECT
  node."id" AS "node_id",
  duplicate."canonical_entity_id",
  ROW_NUMBER() OVER (
    PARTITION BY duplicate."canonical_entity_id"
    ORDER BY
      CASE
        WHEN node."entity_id" = duplicate."canonical_entity_id" THEN 0
        ELSE 1
      END,
      node."created_at",
      node."id"
  ) AS "node_rank"
FROM "cmp_entity_map_nodes" node
JOIN (
  SELECT "duplicate_entity_id" AS "entity_id", "canonical_entity_id"
  FROM "_cmp_company_identity_duplicates"
  UNION ALL
  SELECT DISTINCT "canonical_entity_id", "canonical_entity_id"
  FROM "_cmp_company_identity_duplicates"
) duplicate ON duplicate."entity_id" = node."entity_id";

DELETE FROM "cmp_entity_map_nodes" node
USING "_cmp_company_identity_map_nodes" ranked
WHERE node."id" = ranked."node_id" AND ranked."node_rank" > 1;

UPDATE "cmp_entity_map_nodes" node
SET "entity_id" = ranked."canonical_entity_id",
    "updated_at" = CURRENT_TIMESTAMP
FROM "_cmp_company_identity_map_nodes" ranked
WHERE node."id" = ranked."node_id" AND ranked."node_rank" = 1;

DELETE FROM "cmp_company_profiles" profile
USING "_cmp_company_identity_duplicates" duplicate
WHERE profile."entity_id" = duplicate."duplicate_entity_id";

DELETE FROM "cmp_entities" entity
USING "_cmp_company_identity_duplicates" duplicate
WHERE entity."id" = duplicate."duplicate_entity_id";

DROP TABLE "_cmp_company_identity_map_nodes";
DROP TABLE "_cmp_company_identity_scopes";
DROP TABLE "_cmp_company_identity_duplicates";

CREATE UNIQUE INDEX "cmp_company_profiles_canonical_identity_key"
  ON "cmp_company_profiles" (
    LOWER(BTRIM("identifier_type")),
    LOWER(BTRIM("identifier_value"))
  )
  WHERE NULLIF(BTRIM("identifier_type"), '') IS NOT NULL
    AND NULLIF(BTRIM("identifier_value"), '') IS NOT NULL;
