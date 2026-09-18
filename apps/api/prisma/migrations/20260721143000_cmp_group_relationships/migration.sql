CREATE TYPE "CmpClientRelationshipType" AS ENUM (
  'SUBSIDIARY',
  'ASSOCIATE',
  'JOINT_VENTURE'
);

ALTER TABLE "cmp_client_groups"
ADD COLUMN "ultimate_parent_client_id" TEXT;

CREATE UNIQUE INDEX "cmp_client_groups_ultimate_parent_client_id_key"
ON "cmp_client_groups"("ultimate_parent_client_id");

ALTER TABLE "cmp_client_groups"
ADD CONSTRAINT "cmp_client_groups_ultimate_parent_client_id_fkey"
FOREIGN KEY ("ultimate_parent_client_id") REFERENCES "cmp_clients"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "cmp_client_relationships" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "from_client_id" TEXT NOT NULL,
  "to_client_id" TEXT NOT NULL,
  "type" "CmpClientRelationshipType" NOT NULL,
  "ownership_percentage" DECIMAL(5,2),
  "effective_from" TIMESTAMP(3),
  "effective_to" TIMESTAMP(3),
  "remarks" TEXT,
  "approved_via_request_id" TEXT,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cmp_client_relationships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cmp_client_relationships_distinct_clients_check"
    CHECK ("from_client_id" <> "to_client_id"),
  CONSTRAINT "cmp_client_relationships_ownership_check"
    CHECK (
      "ownership_percentage" IS NULL OR
      ("ownership_percentage" >= 0 AND "ownership_percentage" <= 100)
    ),
  CONSTRAINT "cmp_client_relationships_effective_dates_check"
    CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" >= "effective_from"),
  CONSTRAINT "cmp_client_relationships_joint_venture_order_check"
    CHECK ("type" <> 'JOINT_VENTURE' OR "from_client_id" < "to_client_id")
);

ALTER TABLE "cmp_client_relationships"
ADD CONSTRAINT "cmp_client_relationships_group_id_fkey"
FOREIGN KEY ("group_id") REFERENCES "cmp_client_groups"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cmp_client_relationships"
ADD CONSTRAINT "cmp_client_relationships_from_client_id_fkey"
FOREIGN KEY ("from_client_id") REFERENCES "cmp_clients"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cmp_client_relationships"
ADD CONSTRAINT "cmp_client_relationships_to_client_id_fkey"
FOREIGN KEY ("to_client_id") REFERENCES "cmp_clients"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cmp_client_relationships"
ADD CONSTRAINT "cmp_client_relationships_approved_via_request_id_fkey"
FOREIGN KEY ("approved_via_request_id") REFERENCES "cmp_acceptance_requests"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cmp_client_relationships"
ADD CONSTRAINT "cmp_client_relationships_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "cmp_client_relationships_group_id_type_effective_to_idx"
ON "cmp_client_relationships"("group_id", "type", "effective_to");

CREATE INDEX "cmp_client_relationships_from_client_id_effective_to_idx"
ON "cmp_client_relationships"("from_client_id", "effective_to");

CREATE INDEX "cmp_client_relationships_to_client_id_effective_to_idx"
ON "cmp_client_relationships"("to_client_id", "effective_to");

CREATE INDEX "cmp_client_relationships_approved_via_request_id_idx"
ON "cmp_client_relationships"("approved_via_request_id");

CREATE UNIQUE INDEX "cmp_client_relationships_active_edge_key"
ON "cmp_client_relationships"("group_id", "from_client_id", "to_client_id", "type")
WHERE "effective_to" IS NULL;

CREATE UNIQUE INDEX "cmp_client_relationships_active_subsidiary_parent_key"
ON "cmp_client_relationships"("group_id", "to_client_id")
WHERE "type" = 'SUBSIDIARY' AND "effective_to" IS NULL;

WITH RECURSIVE parent_matches AS (
  SELECT
    child."id" AS "child_id",
    child."group_id" AS "group_id",
    MIN(parent."id") AS "parent_id",
    COUNT(parent."id") AS "match_count",
    child."updated_at" AS "source_updated_at"
  FROM "cmp_clients" AS child
  JOIN "cmp_clients" AS parent
    ON UPPER(BTRIM(parent."client_code")) = UPPER(BTRIM(child."parent_client_code"))
   AND parent."group_id" = child."group_id"
   AND parent."id" <> child."id"
  WHERE child."group_id" IS NOT NULL
    AND NULLIF(BTRIM(child."parent_client_code"), '') IS NOT NULL
  GROUP BY child."id", child."group_id", child."updated_at"
  HAVING COUNT(parent."id") = 1
),
candidate_edges AS (
  SELECT
    matches."child_id",
    matches."group_id",
    matches."parent_id",
    matches."source_updated_at"
  FROM parent_matches AS matches
),
reachable AS (
  SELECT
    edge."group_id",
    edge."parent_id" AS "start_id",
    edge."child_id" AS "node_id"
  FROM candidate_edges AS edge
  UNION
  SELECT
    reachable."group_id",
    reachable."start_id",
    edge."child_id"
  FROM reachable
  JOIN candidate_edges AS edge
    ON edge."group_id" = reachable."group_id"
   AND edge."parent_id" = reachable."node_id"
),
cyclic_groups AS (
  SELECT DISTINCT "group_id"
  FROM reachable
  WHERE "start_id" = "node_id"
)
INSERT INTO "cmp_client_relationships" (
  "id",
  "group_id",
  "from_client_id",
  "to_client_id",
  "type",
  "effective_from",
  "remarks",
  "created_at",
  "updated_at"
)
SELECT
  'legacy-sub-' || MD5(matches."group_id" || ':' || matches."parent_id" || ':' || matches."child_id"),
  matches."group_id",
  matches."parent_id",
  matches."child_id",
  'SUBSIDIARY'::"CmpClientRelationshipType",
  matches."source_updated_at",
  'Migrated from legacy Parent Client Code',
  matches."source_updated_at",
  matches."source_updated_at"
FROM candidate_edges AS matches
WHERE NOT EXISTS (
  SELECT 1
  FROM cyclic_groups
  WHERE cyclic_groups."group_id" = matches."group_id"
)
ON CONFLICT DO NOTHING;

WITH root_candidates AS (
  SELECT
    client."group_id",
    client."id" AS "client_id",
    COUNT(*) OVER (PARTITION BY client."group_id") AS "root_count"
  FROM "cmp_clients" AS client
  WHERE client."group_id" IS NOT NULL
    AND client."status" = 'ACTIVE'
    AND NOT EXISTS (
      SELECT 1
      FROM "cmp_clients" AS unresolved
      WHERE unresolved."group_id" = client."group_id"
        AND NULLIF(BTRIM(unresolved."parent_client_code"), '') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "cmp_client_relationships" AS migrated
          WHERE migrated."group_id" = unresolved."group_id"
            AND migrated."to_client_id" = unresolved."id"
            AND migrated."type" = 'SUBSIDIARY'
            AND migrated."effective_to" IS NULL
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "cmp_client_relationships" AS relationship
      WHERE relationship."group_id" = client."group_id"
        AND relationship."to_client_id" = client."id"
        AND relationship."type" = 'SUBSIDIARY'
        AND relationship."effective_to" IS NULL
    )
)
UPDATE "cmp_client_groups" AS client_group
SET "ultimate_parent_client_id" = candidate."client_id"
FROM root_candidates AS candidate
WHERE candidate."group_id" = client_group."id"
  AND candidate."root_count" = 1
  AND client_group."ultimate_parent_client_id" IS NULL;
