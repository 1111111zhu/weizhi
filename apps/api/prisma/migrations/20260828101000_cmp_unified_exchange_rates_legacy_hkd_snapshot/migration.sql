-- The first unified-rate migration preserved the existing lazily-created CNY
-- and USD snapshots. Add the matching HKD 1:1 snapshot for a complete,
-- auditable legacy batch without rewriting any engagement or receipt.
INSERT INTO "cmp_budget_exchange_rate_snapshots" (
  "id", "currency", "hkd_per_unit", "period_start", "period_end",
  "source_url", "fetched_at", "exchange_rate_batch_id"
)
SELECT
  'CMP-EXCHANGE-RATE-SNAPSHOT-LEGACY-HKD',
  'HKD',
  1.00000000,
  TIMESTAMP '2025-08-01 00:00:00',
  TIMESTAMP '2026-07-31 23:59:59.999',
  'SYSTEM_FIXED_HKMA_AVERAGE_2025_08_2026_07',
  CURRENT_TIMESTAMP,
  'CMP-EXCHANGE-RATE-BATCH-LEGACY-FIXED'
WHERE NOT EXISTS (
  SELECT 1
  FROM "cmp_budget_exchange_rate_snapshots"
  WHERE "currency" = 'HKD'
    AND "exchange_rate_batch_id" = 'CMP-EXCHANGE-RATE-BATCH-LEGACY-FIXED'
);
