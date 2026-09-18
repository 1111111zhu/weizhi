ALTER TABLE "attachments"
ADD COLUMN "work_date" TIMESTAMP(3);

UPDATE "attachments"
SET "work_date" = COALESCE("last_modified_at", "created_at")
WHERE "work_date" IS NULL;

CREATE TABLE "attachment_versions" (
  "id" TEXT NOT NULL,
  "attachment_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "file_kind" "AttachmentFileKind" NOT NULL,
  "file_name" TEXT NOT NULL,
  "original_name" TEXT,
  "file_url" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "mime_type" TEXT NOT NULL,
  "work_date" TIMESTAMP(3),
  "uploaded_by" TEXT,
  "uploaded_at" TIMESTAMP(3) NOT NULL,
  "archived_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attachment_versions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "attachment_versions"
ADD CONSTRAINT "attachment_versions_attachment_id_fkey"
FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attachment_versions"
ADD CONSTRAINT "attachment_versions_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attachment_versions"
ADD CONSTRAINT "attachment_versions_archived_by_fkey"
FOREIGN KEY ("archived_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attachment_versions"
ADD CONSTRAINT "attachment_versions_uploaded_by_fkey"
FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "attachment_versions_attachment_id_version_key"
ON "attachment_versions"("attachment_id", "version");

CREATE INDEX "attachment_versions_project_id_attachment_id_version_idx"
ON "attachment_versions"("project_id", "attachment_id", "version");

CREATE INDEX "attachment_versions_uploaded_by_idx"
ON "attachment_versions"("uploaded_by");
