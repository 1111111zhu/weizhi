ALTER TABLE "cmp_acceptance_requests"
ADD CONSTRAINT "cmp_acceptance_requests_staff_editing_assignment_check"
CHECK (
  (
    "status" <> 'STAFF_EDITING'
    OR (
      "draft_assignee_id" IS NOT NULL
      AND "draft_completed_at" IS NULL
    )
  )
  AND (
    "status" NOT IN ('DRAFT', 'RETURNED')
    OR "draft_assignee_id" IS NULL
    OR "draft_completed_at" IS NOT NULL
  )
);
