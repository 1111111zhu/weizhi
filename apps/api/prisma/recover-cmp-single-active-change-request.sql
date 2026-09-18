-- Preserve the most recently updated active request and retain older
-- duplicates as cancelled audit records before retrying the unique indexes.
WITH ranked_client_changes AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "target_client_id"
      ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
    ) AS duplicate_rank
  FROM "cmp_acceptance_requests"
  WHERE "type" = 'CLIENT_CHANGE'
    AND "target_client_id" IS NOT NULL
    AND "status" IN (
      'DRAFT',
      'STAFF_EDITING',
      'RETURNED',
      'PENDING_MIC',
      'PENDING_PIC',
      'PENDING_IT'
    )
)
UPDATE "cmp_acceptance_requests" AS request
SET
  "status" = 'CANCELLED',
  "return_reason" = CONCAT_WS(
    E'\n',
    NULLIF(request."return_reason", ''),
    '[System migration] Cancelled an older duplicate active client change request while enforcing one active request per client.'
  ),
  "updated_at" = CURRENT_TIMESTAMP
FROM ranked_client_changes AS ranked
WHERE request."id" = ranked."id"
  AND ranked.duplicate_rank > 1;

WITH ranked_engagement_changes AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "target_engagement_id"
      ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
    ) AS duplicate_rank
  FROM "cmp_acceptance_requests"
  WHERE "type" = 'ENGAGEMENT_CHANGE'
    AND "target_engagement_id" IS NOT NULL
    AND "status" IN (
      'DRAFT',
      'STAFF_EDITING',
      'RETURNED',
      'PENDING_MIC',
      'PENDING_PIC',
      'PENDING_IT'
    )
)
UPDATE "cmp_acceptance_requests" AS request
SET
  "status" = 'CANCELLED',
  "return_reason" = CONCAT_WS(
    E'\n',
    NULLIF(request."return_reason", ''),
    '[System migration] Cancelled an older duplicate active engagement change request while enforcing one active request per engagement.'
  ),
  "updated_at" = CURRENT_TIMESTAMP
FROM ranked_engagement_changes AS ranked
WHERE request."id" = ranked."id"
  AND ranked.duplicate_rank > 1;
