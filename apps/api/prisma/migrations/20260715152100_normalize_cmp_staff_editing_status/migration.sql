UPDATE "cmp_acceptance_requests"
SET "status" = 'STAFF_EDITING'
WHERE "status" IN ('DRAFT', 'RETURNED')
  AND "draft_assignee_id" IS NOT NULL
  AND "draft_completed_at" IS NULL;
