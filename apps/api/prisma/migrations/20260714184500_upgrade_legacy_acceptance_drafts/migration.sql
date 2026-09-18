UPDATE "cmp_acceptance_requests"
SET "workflow_version" = 2
WHERE "workflow_version" < 2
  AND "status" IN ('DRAFT', 'RETURNED');
