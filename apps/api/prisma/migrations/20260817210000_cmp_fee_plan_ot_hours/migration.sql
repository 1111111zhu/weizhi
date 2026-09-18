-- Existing hours_per_person values remain the Normal budget hours.
ALTER TABLE "cmp_engagement_fee_plan_lines"
ADD COLUMN "ot_hours_per_person" DECIMAL(12, 2) NOT NULL DEFAULT 0;
