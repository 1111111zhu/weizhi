CREATE TYPE "CmpEngagementFeePlanGrade" AS ENUM (
  'PARTNER',
  'PRINCIPAL',
  'MANAGER',
  'SENIOR',
  'STAFF',
  'ASSISTANT'
);

CREATE TABLE "cmp_engagement_fee_plan_lines" (
  "id" TEXT NOT NULL,
  "engagement_id" TEXT NOT NULL,
  "grade" "CmpEngagementFeePlanGrade" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "hourly_rate" DECIMAL(18,2) NOT NULL,
  "hours_per_person" DECIMAL(12,2) NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cmp_engagement_fee_plan_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cmp_engagement_fee_plan_lines_engagement_id_fkey"
    FOREIGN KEY ("engagement_id") REFERENCES "cmp_engagements"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "cmp_engagement_fee_plan_lines_engagement_id_sort_order_idx"
  ON "cmp_engagement_fee_plan_lines"("engagement_id", "sort_order");
