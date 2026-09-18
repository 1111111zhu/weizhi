-- Freeze the exchange rate actually applied to each engagement. Historical
-- amounts remain unchanged when the system refreshes its rate catalogue.
ALTER TABLE "cmp_engagements"
  ADD COLUMN "fee_exchange_rate_hkd_per_unit" DECIMAL(18, 8),
  ADD COLUMN "fee_exchange_rate_source" TEXT NOT NULL DEFAULT 'SYSTEM';

ALTER TABLE "users"
  ADD COLUMN "cmp_currency_order" JSONB;

ALTER TABLE "cmp_budget_exchange_rate_snapshots"
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'SYSTEM';

CREATE TABLE "cmp_budget_exchange_rate_fallbacks" (
  "currency" TEXT NOT NULL,
  "hkd_per_unit" DECIMAL(18, 8) NOT NULL,
  "updated_by_id" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cmp_budget_exchange_rate_fallbacks_pkey" PRIMARY KEY ("currency")
);

CREATE INDEX "cmp_budget_exchange_rate_fallbacks_updated_by_id_idx"
  ON "cmp_budget_exchange_rate_fallbacks"("updated_by_id");
ALTER TABLE "cmp_budget_exchange_rate_fallbacks"
  ADD CONSTRAINT "cmp_budget_exchange_rate_fallbacks_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- VND is not published by the configured HKMA daily feed. This retained
-- system fallback remains editable from CMP settings and is copied into each
-- rate batch used for new engagements.
INSERT INTO "cmp_budget_exchange_rate_fallbacks" ("currency", "hkd_per_unit")
VALUES ('VND', 0.00030000)
ON CONFLICT ("currency") DO NOTHING;

UPDATE "cmp_budget_exchange_rate_snapshots" AS snapshot
SET "source" = CASE
  WHEN snapshot."currency" = 'VND' THEN 'FALLBACK'
  WHEN batch."provider" = 'LEGACY_FIXED' THEN 'LEGACY'
  ELSE 'SYSTEM'
END
FROM "cmp_exchange_rate_batches" AS batch
WHERE snapshot."exchange_rate_batch_id" = batch."id";

UPDATE "cmp_engagements"
SET "fee_exchange_rate_hkd_per_unit" = 1.00000000,
    "fee_exchange_rate_source" = 'SYSTEM'
WHERE "fee_currency" = 'HKD';

UPDATE "cmp_engagements" AS engagement
SET "fee_exchange_rate_hkd_per_unit" = snapshot."hkd_per_unit",
    "fee_exchange_rate_source" = 'SYSTEM'
FROM "cmp_budget_exchange_rate_snapshots" AS snapshot
WHERE engagement."fee_currency" <> 'HKD'
  AND engagement."fee_exchange_rate_snapshot_id" = snapshot."id";

-- Populate every supported currency in the latest existing batch. This keeps
-- existing deployments usable before their first live HKMA refresh.
WITH latest_batch AS (
  SELECT "id"
  FROM "cmp_exchange_rate_batches"
  ORDER BY "source_date" DESC, "fetched_at" DESC
  LIMIT 1
), definitions("currency", "hkd_per_unit", "source") AS (
  VALUES
    ('HKD', 1.00000000::DECIMAL(18,8), 'SYSTEM'),
    ('EUR', 8.48000000::DECIMAL(18,8), 'LEGACY'),
    ('GBP', 9.93000000::DECIMAL(18,8), 'LEGACY'),
    ('JPY', 0.05400000::DECIMAL(18,8), 'LEGACY'),
    ('SGD', 5.80000000::DECIMAL(18,8), 'LEGACY'),
    ('AUD', 5.07000000::DECIMAL(18,8), 'LEGACY'),
    ('CAD', 5.67000000::DECIMAL(18,8), 'LEGACY'),
    ('MYR', 1.84000000::DECIMAL(18,8), 'LEGACY'),
    ('VND', 0.00030000::DECIMAL(18,8), 'FALLBACK'),
    ('THB', 0.24200000::DECIMAL(18,8), 'LEGACY')
)
INSERT INTO "cmp_budget_exchange_rate_snapshots" (
  "id", "currency", "hkd_per_unit", "period_start", "period_end",
  "source_url", "fetched_at", "exchange_rate_batch_id", "source"
)
SELECT
  'CMP-EXCHANGE-RATE-SNAPSHOT-' || definitions."currency" || '-MULTICURRENCY-SEED',
  definitions."currency",
  definitions."hkd_per_unit",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'SYSTEM_MULTICURRENCY_FALLBACK_2026_08',
  CURRENT_TIMESTAMP,
  latest_batch."id",
  definitions."source"
FROM definitions
CROSS JOIN latest_batch
WHERE NOT EXISTS (
  SELECT 1
  FROM "cmp_budget_exchange_rate_snapshots" snapshot
  WHERE snapshot."exchange_rate_batch_id" = latest_batch."id"
    AND snapshot."currency" = definitions."currency"
);
