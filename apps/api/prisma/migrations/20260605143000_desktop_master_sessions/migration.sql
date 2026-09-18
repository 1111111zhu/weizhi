-- Add durable desktop Master session tracking.
ALTER TABLE "attachments"
  ADD COLUMN "lock_session_id" TEXT,
  ADD COLUMN "lock_heartbeat_at" TIMESTAMP(3),
  ADD COLUMN "lock_stale_at" TIMESTAMP(3),
  ADD COLUMN "lock_revoked_at" TIMESTAMP(3),
  ADD COLUMN "lock_revoked_by" TEXT,
  ADD COLUMN "lock_release_reason" TEXT;

CREATE INDEX "attachments_lock_session_id_idx" ON "attachments"("lock_session_id");

-- Existing development locks predate desktop Master sessions. Give them a
-- recoverable legacy session id and mark them stale instead of treating them
-- as free or unrecoverable.
UPDATE "attachments"
SET
  "lock_session_id" = CONCAT(
    'legacy-',
    MD5("id" || ':' || COALESCE("locked_by", '') || ':' || CLOCK_TIMESTAMP()::TEXT)
  ),
  "lock_heartbeat_at" = COALESCE("locked_at", CURRENT_TIMESTAMP),
  "lock_stale_at" = CURRENT_TIMESTAMP
WHERE "locked_by" IS NOT NULL
  AND "lock_session_id" IS NULL;

CREATE TABLE "desktop_master_grants" (
  "id" TEXT NOT NULL,
  "lock_session_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "attachment_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "secret_hash" TEXT NOT NULL,
  "allowed_actions" TEXT NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "last_used_at" TIMESTAMP(3),

  CONSTRAINT "desktop_master_grants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "desktop_master_grants_lock_session_id_idx" ON "desktop_master_grants"("lock_session_id");
CREATE INDEX "desktop_master_grants_project_id_attachment_id_idx" ON "desktop_master_grants"("project_id", "attachment_id");

ALTER TABLE "desktop_master_grants"
  ADD CONSTRAINT "desktop_master_grants_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "desktop_master_grants"
  ADD CONSTRAINT "desktop_master_grants_attachment_id_fkey"
  FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "desktop_master_grants"
  ADD CONSTRAINT "desktop_master_grants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "desktop_check_in_idempotencies" (
  "id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "lock_session_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "attachment_id" TEXT NOT NULL,
  "local_content_hash" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "response_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "desktop_check_in_idempotencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "desktop_check_in_idempotencies_idempotency_key_key" ON "desktop_check_in_idempotencies"("idempotency_key");
CREATE INDEX "desktop_check_in_idempotencies_lock_session_id_idx" ON "desktop_check_in_idempotencies"("lock_session_id");
CREATE INDEX "desktop_check_in_idempotencies_project_id_attachment_id_idx" ON "desktop_check_in_idempotencies"("project_id", "attachment_id");

ALTER TABLE "desktop_check_in_idempotencies"
  ADD CONSTRAINT "desktop_check_in_idempotencies_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "desktop_check_in_idempotencies"
  ADD CONSTRAINT "desktop_check_in_idempotencies_attachment_id_fkey"
  FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
