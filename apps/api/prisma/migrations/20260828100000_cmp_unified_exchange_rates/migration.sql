CREATE TABLE "cmp_exchange_rate_batches" (
  "id" TEXT NOT NULL,
  "base_currency" TEXT NOT NULL DEFAULT 'HKD',
  "provider" TEXT NOT NULL,
  "source_date" DATE NOT NULL,
  "source_url" TEXT NOT NULL,
  "fetched_at" TIMESTAMP(3) NOT NULL,
  "refreshed_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cmp_exchange_rate_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cmp_exchange_rate_batches_provider_source_date_key"
  ON "cmp_exchange_rate_batches"("provider", "source_date");
CREATE INDEX "cmp_exchange_rate_batches_source_date_idx"
  ON "cmp_exchange_rate_batches"("source_date");
CREATE INDEX "cmp_exchange_rate_batches_refreshed_by_id_idx"
  ON "cmp_exchange_rate_batches"("refreshed_by_id");

ALTER TABLE "cmp_exchange_rate_batches"
  ADD CONSTRAINT "cmp_exchange_rate_batches_refreshed_by_id_fkey"
  FOREIGN KEY ("refreshed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cmp_budget_exchange_rate_snapshots"
  ADD COLUMN "exchange_rate_batch_id" TEXT;
CREATE INDEX "cmp_budget_exchange_rate_snapshots_exchange_rate_batch_id_idx"
  ON "cmp_budget_exchange_rate_snapshots"("exchange_rate_batch_id");
ALTER TABLE "cmp_budget_exchange_rate_snapshots"
  ADD CONSTRAINT "cmp_budget_exchange_rate_snapshots_exchange_rate_batch_id_fkey"
  FOREIGN KEY ("exchange_rate_batch_id") REFERENCES "cmp_exchange_rate_batches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cmp_billing_finance_receipts"
  ADD COLUMN "exchange_rate_batch_id" TEXT;
CREATE INDEX "cmp_billing_finance_receipts_exchange_rate_batch_id_idx"
  ON "cmp_billing_finance_receipts"("exchange_rate_batch_id");
ALTER TABLE "cmp_billing_finance_receipts"
  ADD CONSTRAINT "cmp_billing_finance_receipts_exchange_rate_batch_id_fkey"
  FOREIGN KEY ("exchange_rate_batch_id") REFERENCES "cmp_exchange_rate_batches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "cmp_exchange_rate_batches" (
  "id", "base_currency", "provider", "source_date", "source_url", "fetched_at"
) VALUES (
  'CMP-EXCHANGE-RATE-BATCH-LEGACY-FIXED',
  'HKD',
  'LEGACY_FIXED',
  DATE '2026-07-31',
  'SYSTEM_FIXED_HKMA_AVERAGE_2025_08_2026_07',
  CURRENT_TIMESTAMP
) ON CONFLICT ("provider", "source_date") DO NOTHING;

UPDATE "cmp_budget_exchange_rate_snapshots"
SET "exchange_rate_batch_id" = 'CMP-EXCHANGE-RATE-BATCH-LEGACY-FIXED'
WHERE "exchange_rate_batch_id" IS NULL
  AND "source_url" = 'SYSTEM_FIXED_HKMA_AVERAGE_2025_08_2026_07';

-- Older databases may never have opened the budget screen, so their legacy
-- fixed snapshots were not created by the former lazy-read implementation.
-- Seed only the missing currency records; existing snapshots remain intact.
INSERT INTO "cmp_budget_exchange_rate_snapshots" (
  "id", "currency", "hkd_per_unit", "period_start", "period_end",
  "source_url", "fetched_at", "exchange_rate_batch_id"
)
SELECT
  'CMP-EXCHANGE-RATE-SNAPSHOT-LEGACY-CNY',
  'CNY',
  1.12268295,
  TIMESTAMP '2025-08-01 00:00:00',
  TIMESTAMP '2026-07-31 23:59:59.999',
  'SYSTEM_FIXED_HKMA_AVERAGE_2025_08_2026_07',
  CURRENT_TIMESTAMP,
  'CMP-EXCHANGE-RATE-BATCH-LEGACY-FIXED'
WHERE NOT EXISTS (
  SELECT 1
  FROM "cmp_budget_exchange_rate_snapshots"
  WHERE "currency" = 'CNY'
    AND "source_url" = 'SYSTEM_FIXED_HKMA_AVERAGE_2025_08_2026_07'
);

INSERT INTO "cmp_budget_exchange_rate_snapshots" (
  "id", "currency", "hkd_per_unit", "period_start", "period_end",
  "source_url", "fetched_at", "exchange_rate_batch_id"
)
SELECT
  'CMP-EXCHANGE-RATE-SNAPSHOT-LEGACY-USD',
  'USD',
  7.81175674,
  TIMESTAMP '2025-08-01 00:00:00',
  TIMESTAMP '2026-07-31 23:59:59.999',
  'SYSTEM_FIXED_HKMA_AVERAGE_2025_08_2026_07',
  CURRENT_TIMESTAMP,
  'CMP-EXCHANGE-RATE-BATCH-LEGACY-FIXED'
WHERE NOT EXISTS (
  SELECT 1
  FROM "cmp_budget_exchange_rate_snapshots"
  WHERE "currency" = 'USD'
    AND "source_url" = 'SYSTEM_FIXED_HKMA_AVERAGE_2025_08_2026_07'
);
