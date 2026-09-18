ALTER TYPE "InboxMessageType" ADD VALUE 'ATTACHMENT_CONFLICT';

ALTER TABLE "attachments"
  ADD COLUMN "content_hash" TEXT,
  ADD COLUMN "lock_epoch" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "conflict_frozen_at" TIMESTAMP(3),
  ADD COLUMN "conflict_candidate_version_id" TEXT;

ALTER TABLE "attachment_versions"
  ADD COLUMN "content_hash" TEXT,
  ADD COLUMN "conflict_state" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "conflict_base_version_id" TEXT,
  ADD COLUMN "conflict_server_version_id" TEXT,
  ADD COLUMN "conflict_resolved_by" TEXT,
  ADD COLUMN "conflict_resolved_at" TIMESTAMP(3),
  ADD COLUMN "conflict_resolution" TEXT;

CREATE INDEX "attachment_versions_attachment_id_conflict_state_idx"
  ON "attachment_versions"("attachment_id", "conflict_state");
