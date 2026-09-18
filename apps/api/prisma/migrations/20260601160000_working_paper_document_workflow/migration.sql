ALTER TYPE "PaperStatus" ADD VALUE IF NOT EXISTS 'PREPARED';
ALTER TYPE "PaperStatus" ADD VALUE IF NOT EXISTS 'REVIEWED';
ALTER TYPE "PaperStatus" ADD VALUE IF NOT EXISTS 'RETURNED';

CREATE TYPE "AttachmentFileKind" AS ENUM ('SPREADSHEET', 'SUPPORTING');

ALTER TABLE "working_papers"
  ADD COLUMN "preparer_id" TEXT,
  ADD COLUMN "reviewer_id" TEXT,
  ADD COLUMN "prepared_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "returned_at" TIMESTAMP(3),
  ADD COLUMN "review_note" TEXT;

ALTER TABLE "working_papers"
  ADD CONSTRAINT "working_papers_preparer_id_fkey"
    FOREIGN KEY ("preparer_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "working_papers_reviewer_id_fkey"
    FOREIGN KEY ("reviewer_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attachments"
  ADD COLUMN "file_kind" "AttachmentFileKind" NOT NULL DEFAULT 'SUPPORTING',
  ADD COLUMN "original_name" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "locked_by" TEXT,
  ADD COLUMN "locked_at" TIMESTAMP(3),
  ADD COLUMN "lock_expires_at" TIMESTAMP(3),
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "attachments" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_locked_by_fkey"
    FOREIGN KEY ("locked_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
