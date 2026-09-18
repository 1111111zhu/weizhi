UPDATE "cmp_acceptance_requests" AS request
SET "pic_approved_at" = (
  SELECT COALESCE(step."acted_at", step."created_at")
  FROM "cmp_acceptance_approval_steps" AS step
  WHERE step."request_id" = request."id"
    AND step."step" = 'PIC'
    AND step."status" = 'APPROVED'
  ORDER BY COALESCE(step."acted_at", step."created_at") DESC
  LIMIT 1
)
WHERE request."workflow_version" = 2
  AND request."status" IN ('DRAFT', 'RETURNED')
  AND request."pic_approved_at" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "cmp_acceptance_approval_steps" AS step
    WHERE step."request_id" = request."id"
      AND step."step" = 'PIC'
      AND step."status" = 'APPROVED'
  );

UPDATE "cmp_acceptance_requests" AS request
SET "returned_from_step" = (
  SELECT step."step"
  FROM "cmp_acceptance_approval_steps" AS step
  WHERE step."request_id" = request."id"
    AND step."status" = 'RETURNED'
    AND step."step" IN ('PIC', 'IT')
  ORDER BY COALESCE(step."acted_at", step."created_at") DESC
  LIMIT 1
)
WHERE request."workflow_version" = 2
  AND request."status" = 'RETURNED'
  AND request."returned_from_step" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "cmp_acceptance_approval_steps" AS step
    WHERE step."request_id" = request."id"
      AND step."status" = 'RETURNED'
      AND step."step" IN ('PIC', 'IT')
  );
