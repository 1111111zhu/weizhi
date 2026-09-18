-- Rename the Engagement business date without touching the Client approval date
-- or the workflow's approved_at timestamps.
ALTER TABLE "cmp_engagements"
  RENAME COLUMN "approval_date" TO "engagement_date";

-- Canonicalise only Engagement Acceptance JSON. If a partially migrated row
-- already contains engagementDate, that value wins and the retired key is removed.
UPDATE "cmp_acceptance_requests"
SET
  "engagement_payload" = CASE
    WHEN "engagement_payload" IS NULL THEN NULL
    WHEN "engagement_payload" ? 'engagementDate' THEN "engagement_payload" - 'approvalDate'
    WHEN "engagement_payload" ? 'approvalDate' THEN
      ("engagement_payload" - 'approvalDate') || jsonb_build_object('engagementDate', "engagement_payload" -> 'approvalDate')
    ELSE "engagement_payload"
  END,
  "change_baseline_payload" = CASE
    WHEN "change_baseline_payload" IS NULL THEN NULL
    WHEN "change_baseline_payload" ? 'engagementDate' THEN "change_baseline_payload" - 'approvalDate'
    WHEN "change_baseline_payload" ? 'approvalDate' THEN
      ("change_baseline_payload" - 'approvalDate') || jsonb_build_object('engagementDate', "change_baseline_payload" -> 'approvalDate')
    ELSE "change_baseline_payload"
  END
WHERE "type" IN ('ENGAGEMENT', 'ENGAGEMENT_CHANGE')
  AND (
    "engagement_payload" ? 'approvalDate'
    OR "change_baseline_payload" ? 'approvalDate'
  );
