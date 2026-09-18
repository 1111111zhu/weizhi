DROP INDEX IF EXISTS "working_paper_signoffs_attachment_id_user_id_type_key";

ALTER TABLE "working_paper_signoffs"
  ADD COLUMN "round_number" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "is_current" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "attachment_version_id" TEXT,
  ADD COLUMN "attachment_version" INTEGER,
  ADD COLUMN "content_hash" TEXT,
  ADD COLUMN "revoked_at" TIMESTAMP(3),
  ADD COLUMN "revoked_by_id" TEXT,
  ADD COLUMN "revocation_reason" TEXT;

ALTER TABLE "working_paper_signoffs"
  ADD CONSTRAINT "working_paper_signoffs_revoked_by_id_fkey"
  FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "working_paper_signoffs_attachment_id_is_current_revoked_at_signed_at_idx"
  ON "working_paper_signoffs"("attachment_id", "is_current", "revoked_at", "signed_at");

CREATE INDEX "working_paper_signoffs_attachment_id_round_number_revoked_at_idx"
  ON "working_paper_signoffs"("attachment_id", "round_number", "revoked_at");

CREATE INDEX "working_paper_signoffs_revoked_by_id_idx"
  ON "working_paper_signoffs"("revoked_by_id");
