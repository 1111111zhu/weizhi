-- Preserve legacy budget rows as fully unassigned TBC capacity.
ALTER TABLE "cmp_engagement_fee_plan_lines"
  ADD COLUMN "tbc_quantity" INTEGER NOT NULL DEFAULT 0;

UPDATE "cmp_engagement_fee_plan_lines"
SET "tbc_quantity" = "quantity";

CREATE TABLE "cmp_budget_exchange_rate_snapshots" (
  "id" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "hkd_per_unit" DECIMAL(18,8) NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "source_url" TEXT NOT NULL,
  "fetched_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cmp_budget_exchange_rate_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cmp_budget_exchange_rate_snapshots_currency_fetched_at_idx"
  ON "cmp_budget_exchange_rate_snapshots"("currency", "fetched_at");

CREATE TABLE "cmp_engagement_fee_plan_staff" (
  "id" TEXT NOT NULL,
  "fee_plan_line_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cmp_engagement_fee_plan_staff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cmp_engagement_fee_plan_staff_fee_plan_line_id_user_id_key"
  ON "cmp_engagement_fee_plan_staff"("fee_plan_line_id", "user_id");
CREATE INDEX "cmp_engagement_fee_plan_staff_user_id_idx"
  ON "cmp_engagement_fee_plan_staff"("user_id");

ALTER TABLE "cmp_engagement_fee_plan_staff"
  ADD CONSTRAINT "cmp_engagement_fee_plan_staff_fee_plan_line_id_fkey"
  FOREIGN KEY ("fee_plan_line_id") REFERENCES "cmp_engagement_fee_plan_lines"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cmp_engagement_fee_plan_staff"
  ADD CONSTRAINT "cmp_engagement_fee_plan_staff_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cmp_engagements"
  ADD COLUMN "fee_exchange_rate_snapshot_id" TEXT;
CREATE INDEX "cmp_engagements_fee_exchange_rate_snapshot_id_idx"
  ON "cmp_engagements"("fee_exchange_rate_snapshot_id");
ALTER TABLE "cmp_engagements"
  ADD CONSTRAINT "cmp_engagements_fee_exchange_rate_snapshot_id_fkey"
  FOREIGN KEY ("fee_exchange_rate_snapshot_id")
  REFERENCES "cmp_budget_exchange_rate_snapshots"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
