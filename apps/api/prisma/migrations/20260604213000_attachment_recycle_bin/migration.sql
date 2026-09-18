ALTER TABLE "attachments"
ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "deleted_by" TEXT,
ADD COLUMN "deleted_from_working_paper_id" TEXT,
ADD COLUMN "deleted_from_working_paper_code" TEXT,
ADD COLUMN "deleted_from_working_paper_title" TEXT,
ADD COLUMN "restored_at" TIMESTAMP(3),
ADD COLUMN "restored_by" TEXT,
ADD COLUMN "last_modified_by" TEXT,
ADD COLUMN "last_modified_at" TIMESTAMP(3);

UPDATE "attachments"
SET
  "last_modified_by" = "uploaded_by",
  "last_modified_at" = "updated_at"
WHERE "last_modified_by" IS NULL
  AND "last_modified_at" IS NULL;

ALTER TABLE "attachments"
ADD CONSTRAINT "attachments_deleted_by_fkey"
FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attachments"
ADD CONSTRAINT "attachments_restored_by_fkey"
FOREIGN KEY ("restored_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attachments"
ADD CONSTRAINT "attachments_last_modified_by_fkey"
FOREIGN KEY ("last_modified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "attachments_project_id_deleted_at_idx" ON "attachments"("project_id", "deleted_at");
CREATE INDEX "attachments_deleted_from_working_paper_id_idx" ON "attachments"("deleted_from_working_paper_id");
CREATE INDEX "attachments_last_modified_at_idx" ON "attachments"("last_modified_at");
