ALTER TABLE "cmp_acceptance_requests"
  ADD COLUMN IF NOT EXISTS "draft_name" TEXT;

UPDATE "cmp_acceptance_requests"
SET "draft_name" = COALESCE(
  NULLIF(BTRIM("client_payload" ->> 'nameEn'), ''),
  NULLIF(BTRIM("client_payload" ->> 'nameZh'), ''),
  NULLIF(BTRIM("client_payload" ->> 'clientCode'), ''),
  NULLIF(BTRIM("engagement_payload" ->> 'engagementName'), ''),
  NULLIF(BTRIM("engagement_payload" ->> 'engagementCode'), ''),
  "request_no"
)
WHERE "draft_name" IS NULL
  AND "status" IN ('DRAFT', 'STAFF_EDITING', 'RETURNED')
  AND "type" IN ('CLIENT', 'CLIENT_CHANGE', 'ENGAGEMENT', 'ENGAGEMENT_CHANGE');
