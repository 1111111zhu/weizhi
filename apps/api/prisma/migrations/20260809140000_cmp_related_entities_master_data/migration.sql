-- Promote CMP entities and relationships to firm-level master data while
-- preserving Entity Maps as a legacy compatibility and layout layer.
CREATE TYPE "CmpEntityStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "cmp_entities"
ADD COLUMN "status" "CmpEntityStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "cmp_entity_relationships"
ADD COLUMN "source_document" TEXT;

-- An Entity may appear in more than one legacy map. It remains unique inside
-- an individual map so historical layouts cannot contain duplicate nodes.
DROP INDEX IF EXISTS "cmp_entity_map_nodes_entity_id_key";
CREATE UNIQUE INDEX "cmp_entity_map_nodes_map_id_entity_id_key"
ON "cmp_entity_map_nodes"("map_id", "entity_id");

-- A map is no longer the owner of a relationship. Keep map_id only as legacy
-- provenance and preserve the relationship if an old map is removed.
ALTER TABLE "cmp_entity_relationships"
DROP CONSTRAINT IF EXISTS "cmp_entity_relationships_map_id_fkey";

ALTER TABLE "cmp_entity_relationships"
ALTER COLUMN "map_id" DROP NOT NULL;

ALTER TABLE "cmp_entity_relationships"
ADD CONSTRAINT "cmp_entity_relationships_map_id_fkey"
FOREIGN KEY ("map_id") REFERENCES "cmp_entity_maps"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill client visibility from legacy maps. Every client sees all entities
-- in the weakly-connected component containing its root entity. This is
-- additive and idempotent; old maps, nodes and edges remain untouched.
WITH RECURSIVE map_roots AS (
  SELECT
    scope."client_id",
    node."map_id",
    scope."entity_id" AS root_entity_id
  FROM "cmp_client_entity_scopes" scope
  JOIN "cmp_entity_map_nodes" node
    ON node."entity_id" = scope."entity_id"
  WHERE scope."role" = 'ROOT'
), reachable AS (
  SELECT
    root."client_id",
    root."map_id",
    root.root_entity_id,
    root.root_entity_id AS entity_id
  FROM map_roots root

  UNION

  SELECT
    reachable."client_id",
    reachable."map_id",
    reachable.root_entity_id,
    CASE
      WHEN rel."from_entity_id" = reachable.entity_id
        THEN rel."to_entity_id"
      ELSE rel."from_entity_id"
    END AS entity_id
  FROM reachable
  JOIN "cmp_entity_relationships" rel
    ON rel."map_id" = reachable."map_id"
   AND (
     rel."from_entity_id" = reachable.entity_id
     OR rel."to_entity_id" = reachable.entity_id
   )
)
INSERT INTO "cmp_client_entity_scopes" (
  "client_id",
  "entity_id",
  "role",
  "created_at",
  "updated_at"
)
SELECT DISTINCT
  reachable."client_id",
  reachable.entity_id,
  'RELATED'::"CmpClientEntityRole",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM reachable
WHERE reachable.entity_id <> reachable.root_entity_id
ON CONFLICT ("client_id", "entity_id") DO NOTHING;
