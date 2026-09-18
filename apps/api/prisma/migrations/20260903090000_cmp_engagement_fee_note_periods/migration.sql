ALTER TABLE "cmp_engagement_fee_notes"
ADD COLUMN "period_number" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "planned_issue_date" DATE,
ADD COLUMN "planned_amount" DECIMAL(18,2),
ADD COLUMN "received_amount" DECIMAL(18,2),
ADD COLUMN "received_date" DATE;

UPDATE "cmp_engagement_fee_notes"
SET
  "planned_issue_date" = "issue_date",
  "planned_amount" = "total_amount"
WHERE "planned_issue_date" IS NULL AND "planned_amount" IS NULL;

ALTER TABLE "cmp_engagement_fee_notes"
DROP CONSTRAINT IF EXISTS "cmp_engagement_fee_notes_engagement_id_key";

DROP INDEX IF EXISTS "cmp_engagement_fee_notes_engagement_id_key";

CREATE UNIQUE INDEX "cmp_engagement_fee_notes_engagement_id_period_number_key"
ON "cmp_engagement_fee_notes"("engagement_id", "period_number");

CREATE INDEX "cmp_engagement_fee_notes_engagement_id_period_number_idx"
ON "cmp_engagement_fee_notes"("engagement_id", "period_number");
