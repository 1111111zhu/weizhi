-- This migration is intentionally destructive. Take and verify a PostgreSQL
-- backup before it is deployed to any shared environment.

ALTER TABLE "cmp_engagements"
  DROP COLUMN "engagement_name",
  DROP COLUMN "estimated_disbursements",
  DROP COLUMN "is_recurring_fee",
  DROP COLUMN "budget_fee_next_year",
  ADD COLUMN "recovery_rate" DECIMAL(5,2);

ALTER TABLE "cmp_engagements"
  ADD CONSTRAINT "cmp_engagements_recovery_rate_range"
  CHECK ("recovery_rate" IS NULL OR ("recovery_rate" >= 0 AND "recovery_rate" <= 100));

UPDATE "cmp_acceptance_requests"
SET
  "engagement_payload" = CASE
    WHEN "engagement_payload" IS NULL THEN NULL
    ELSE "engagement_payload"
      - 'engagementName'
      - 'estimatedDisbursements'
      - 'isRecurringFee'
      - 'budgetFeeNextYear'
  END,
  "change_baseline_payload" = CASE
    WHEN "change_baseline_payload" IS NULL THEN NULL
    ELSE "change_baseline_payload"
      - 'engagementName'
      - 'estimatedDisbursements'
      - 'isRecurringFee'
      - 'budgetFeeNextYear'
  END;
