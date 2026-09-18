ALTER TABLE "cmp_engagement_fee_plan_lines"
  ADD COLUMN "date_from" DATE,
  ADD COLUMN "date_to" DATE;

ALTER TABLE "cmp_engagement_fee_plan_lines"
  ADD CONSTRAINT "cmp_engagement_fee_plan_lines_date_range_check"
  CHECK (
    ("date_from" IS NULL AND "date_to" IS NULL)
    OR ("date_from" IS NOT NULL AND "date_to" IS NOT NULL AND "date_to" >= "date_from")
  );
