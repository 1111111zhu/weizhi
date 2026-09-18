-- Give active legacy Master sessions a deployment grace window while still
-- allowing genuinely stale sessions to age into the normal reclaim path.
UPDATE "attachments"
SET "lock_expires_at" =
  COALESCE("lock_heartbeat_at", "locked_at", CURRENT_TIMESTAMP) + INTERVAL '2 hours'
WHERE "locked_by" IS NOT NULL
  AND "lock_session_id" IS NOT NULL
  AND "lock_revoked_at" IS NULL
  AND "lock_expires_at" IS NULL;

UPDATE "desktop_master_grants"
SET "expires_at" =
  COALESCE("last_used_at", "issued_at", CURRENT_TIMESTAMP) + INTERVAL '2 hours'
WHERE "revoked_at" IS NULL
  AND "expires_at" IS NULL;

ALTER TABLE "desktop_check_in_idempotencies"
  ADD COLUMN "attempt_token" TEXT,
  ADD COLUMN "lease_expires_at" TIMESTAMP(3);

-- Existing work may still be running while a rolling deployment applies this
-- migration, so give current IN_PROGRESS records one full takeover lease.
UPDATE "desktop_check_in_idempotencies"
SET "lease_expires_at" = GREATEST(
  "updated_at" + INTERVAL '15 minutes',
  CURRENT_TIMESTAMP + INTERVAL '15 minutes'
)
WHERE "status" = 'IN_PROGRESS'
  AND "lease_expires_at" IS NULL;

CREATE INDEX "desktop_check_in_idempotencies_status_lease_expires_at_idx"
  ON "desktop_check_in_idempotencies"("status", "lease_expires_at");
