-- Generalise the previously introduced but unexposed joint-control tables.
ALTER TABLE "cmp_joint_control_arrangements"
  RENAME TO "cmp_group_relationships";
ALTER TABLE "cmp_joint_control_participants"
  RENAME TO "cmp_group_relationship_participants";
ALTER TABLE "cmp_group_relationship_participants"
  RENAME COLUMN "arrangement_id" TO "relationship_id";
ALTER TABLE "cmp_group_relationships"
  RENAME CONSTRAINT "cmp_joint_control_arrangements_pkey" TO "cmp_group_relationships_pkey";
ALTER TABLE "cmp_group_relationships"
  RENAME CONSTRAINT "cmp_joint_control_arrangements_dates_check" TO "cmp_group_relationships_dates_check";
ALTER TABLE "cmp_group_relationships"
  RENAME CONSTRAINT "cmp_joint_control_arrangements_target_entity_id_fkey" TO "cmp_group_relationships_target_entity_id_fkey";
ALTER TABLE "cmp_group_relationship_participants"
  RENAME CONSTRAINT "cmp_joint_control_participants_pkey" TO "cmp_group_relationship_participants_pkey";
ALTER TABLE "cmp_group_relationship_participants"
  RENAME CONSTRAINT "cmp_joint_control_participants_ownership_check" TO "cmp_group_relationship_participants_ownership_check";
ALTER TABLE "cmp_group_relationship_participants"
  RENAME CONSTRAINT "cmp_joint_control_participants_arrangement_id_fkey" TO "cmp_group_relationship_participants_relationship_id_fkey";
ALTER TABLE "cmp_group_relationship_participants"
  RENAME CONSTRAINT "cmp_joint_control_participants_entity_id_fkey" TO "cmp_group_relationship_participants_entity_id_fkey";
ALTER INDEX "cmp_joint_control_arrangements_target_entity_id_effective_to_idx"
  RENAME TO "cmp_group_relationships_target_entity_id_effective_to_idx";
ALTER INDEX "cmp_joint_control_arrangements_effective_to_idx"
  RENAME TO "cmp_group_relationships_effective_to_idx";
ALTER INDEX "cmp_joint_control_participants_entity_id_idx"
  RENAME TO "cmp_group_relationship_participants_entity_id_idx";

CREATE TYPE "CmpGroupRelationshipType" AS ENUM ('ASSOCIATE', 'JOINT_VENTURE');
CREATE TYPE "CmpGroupRelationshipMethod" AS ENUM ('OWNERSHIP', 'OTHER');

ALTER TABLE "cmp_group_relationships"
  ADD COLUMN "type" "CmpGroupRelationshipType" NOT NULL DEFAULT 'JOINT_VENTURE';
ALTER TABLE "cmp_group_relationships"
  ALTER COLUMN "type" DROP DEFAULT;

ALTER TABLE "cmp_group_relationship_participants"
  ADD COLUMN "method" "CmpGroupRelationshipMethod" NOT NULL DEFAULT 'OWNERSHIP',
  ADD COLUMN "other_description" TEXT,
  DROP COLUMN "voting_percentage";
ALTER TABLE "cmp_group_relationship_participants"
  ALTER COLUMN "method" DROP DEFAULT;

-- The former table was not exposed as an input surface. Keep only facts that
-- meet the new group-relationship invariant: a company target and at least
-- one company participant. Its voting-right data has already been discarded.
DELETE FROM "cmp_group_relationships" AS relationship
WHERE NOT EXISTS (
  SELECT 1
  FROM "cmp_entities" AS target
  WHERE target."id" = relationship."target_entity_id"
    AND target."kind" = 'COMPANY'
)
OR NOT EXISTS (
  SELECT 1
  FROM "cmp_group_relationship_participants" AS participant
  JOIN "cmp_entities" AS entity ON entity."id" = participant."entity_id"
  WHERE participant."relationship_id" = relationship."id"
    AND entity."kind" = 'COMPANY'
)
OR EXISTS (
  SELECT 1
  FROM "cmp_group_relationship_participants" AS participant
  JOIN "cmp_entities" AS entity ON entity."id" = participant."entity_id"
  WHERE participant."relationship_id" = relationship."id"
    AND entity."kind" <> 'COMPANY'
);

-- Preserve each existing association/joint-venture fact as a one-participant
-- group relationship. They can be combined by users later without guessing a
-- common arrangement during migration.
INSERT INTO "cmp_group_relationships" (
  "id", "target_entity_id", "type", "effective_from", "effective_to",
  "remarks", "created_by_id", "reviewed_by_id", "source_document",
  "created_at", "updated_at"
)
SELECT
  'legacy-group-' || relationship."id",
  relationship."to_entity_id",
  CASE relationship."type"
    WHEN 'ASSOCIATE_OF' THEN 'ASSOCIATE'::"CmpGroupRelationshipType"
    ELSE 'JOINT_VENTURE'::"CmpGroupRelationshipType"
  END,
  relationship."effective_from", relationship."effective_to", relationship."remarks", relationship."created_by_id",
  relationship."reviewed_by_id", relationship."source_document", relationship."created_at", relationship."updated_at"
FROM "cmp_entity_relationships" AS relationship
JOIN "cmp_entities" AS target
  ON target."id" = relationship."to_entity_id"
  AND target."kind" = 'COMPANY'
JOIN "cmp_entities" AS participant
  ON participant."id" = relationship."from_entity_id"
  AND participant."kind" = 'COMPANY'
WHERE relationship."type" IN ('ASSOCIATE_OF', 'JOINT_VENTURE_WITH')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "cmp_group_relationship_participants" (
  "relationship_id", "entity_id", "method", "ownership_percentage",
  "other_description", "created_at", "updated_at"
)
SELECT
  'legacy-group-' || relationship."id", relationship."from_entity_id", 'OWNERSHIP'::"CmpGroupRelationshipMethod",
  relationship."ownership_percentage", NULL, relationship."created_at", relationship."updated_at"
FROM "cmp_entity_relationships" AS relationship
JOIN "cmp_entities" AS target
  ON target."id" = relationship."to_entity_id"
  AND target."kind" = 'COMPANY'
JOIN "cmp_entities" AS participant
  ON participant."id" = relationship."from_entity_id"
  AND participant."kind" = 'COMPANY'
WHERE relationship."type" IN ('ASSOCIATE_OF', 'JOINT_VENTURE_WITH')
ON CONFLICT ("relationship_id", "entity_id") DO NOTHING;

DELETE FROM "cmp_entity_relationships"
WHERE "type" IN ('CONTROLS', 'ASSOCIATE_OF', 'JOINT_VENTURE_WITH');

ALTER TABLE "cmp_entity_relationships"
  DROP COLUMN "voting_percentage";

ALTER TYPE "CmpEntityRelationshipType" RENAME TO "CmpEntityRelationshipType_legacy";
CREATE TYPE "CmpEntityRelationshipType" AS ENUM (
  'OWNS',
  'DIRECTOR_OF',
  'BENEFICIAL_OWNER_OF',
  'COMPANY_SECRETARY_OF',
  'MANAGES',
  'OTHER'
);
ALTER TABLE "cmp_entity_relationships"
  ALTER COLUMN "type" TYPE "CmpEntityRelationshipType"
  USING "type"::text::"CmpEntityRelationshipType";
DROP TYPE "CmpEntityRelationshipType_legacy";

CREATE INDEX "cmp_group_relationships_type_effective_to_idx"
  ON "cmp_group_relationships"("type", "effective_to");

-- Pending client drafts are mutable. Move old association/joint-venture drafts
-- into the new collection, remove controls, and remove voting-right fields.
WITH payload_updates AS (
  SELECT
    "id",
    jsonb_set(
      jsonb_set(
        "client_payload",
        '{relatedRelationships}',
        COALESCE(
          (
            SELECT jsonb_agg(item - 'votingPercentage')
            FROM jsonb_array_elements("client_payload"->'relatedRelationships') AS item
            WHERE item->>'type' NOT IN ('CONTROLS', 'ASSOCIATE_OF', 'JOINT_VENTURE_WITH')
          ),
          '[]'::jsonb
        ),
        true
      ),
      '{relatedGroupRelationships}',
      COALESCE("client_payload"->'relatedGroupRelationships', '[]'::jsonb) || COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'draftKey', 'legacy-group-' || COALESCE(item->>'draftKey', md5(item::text)),
              'targetRef', item->'toRef',
              'type', CASE item->>'type'
                WHEN 'ASSOCIATE_OF' THEN 'ASSOCIATE'
                ELSE 'JOINT_VENTURE'
              END,
              'participants', jsonb_build_array(
                jsonb_strip_nulls(jsonb_build_object(
                  'entityRef', item->'fromRef',
                  'method', 'OWNERSHIP',
                  'ownershipPercentage', item->'ownershipPercentage'
                ))
              ),
              'effectiveFrom', item->'effectiveFrom',
              'effectiveTo', item->'effectiveTo',
              'sourceDocument', item->'sourceDocument',
              'remarks', item->'remarks'
            )
          )
          FROM jsonb_array_elements("client_payload"->'relatedRelationships') AS item
          WHERE item->>'type' IN ('ASSOCIATE_OF', 'JOINT_VENTURE_WITH')
            AND (
              item->'fromRef'->>'type' = 'ROOT'
              OR (
                item->'fromRef'->>'type' = 'EXISTING'
                AND EXISTS (
                  SELECT 1 FROM "cmp_entities" AS entity
                  WHERE entity."id" = item->'fromRef'->>'entityId'
                    AND entity."kind" = 'COMPANY'
                )
              )
              OR (
                item->'fromRef'->>'type' = 'DRAFT'
                AND EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(COALESCE("client_payload"->'relatedEntities', '[]'::jsonb)) AS entity
                  WHERE entity->>'draftKey' = item->'fromRef'->>'draftKey'
                    AND entity->>'kind' = 'COMPANY'
                )
              )
            )
            AND (
              item->'toRef'->>'type' = 'ROOT'
              OR (
                item->'toRef'->>'type' = 'EXISTING'
                AND EXISTS (
                  SELECT 1 FROM "cmp_entities" AS entity
                  WHERE entity."id" = item->'toRef'->>'entityId'
                    AND entity."kind" = 'COMPANY'
                )
              )
              OR (
                item->'toRef'->>'type' = 'DRAFT'
                AND EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(COALESCE("client_payload"->'relatedEntities', '[]'::jsonb)) AS entity
                  WHERE entity->>'draftKey' = item->'toRef'->>'draftKey'
                    AND entity->>'kind' = 'COMPANY'
                )
              )
            )
        ),
        '[]'::jsonb
      ),
      true
    ) AS "client_payload"
  FROM "cmp_acceptance_requests"
  WHERE "status" IN ('DRAFT', 'STAFF_EDITING', 'RETURNED')
    AND jsonb_typeof("client_payload"->'relatedRelationships') = 'array'
)
UPDATE "cmp_acceptance_requests" AS request
SET "client_payload" = payload_updates."client_payload"
FROM payload_updates
WHERE request."id" = payload_updates."id";
