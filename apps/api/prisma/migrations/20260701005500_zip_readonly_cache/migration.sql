CREATE TABLE "zip_archive_snapshots" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "attachment_id" TEXT NOT NULL,
  "attachment_version" INTEGER NOT NULL,
  "entry_tree_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "zip_archive_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "zip_archive_entry_caches" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "attachment_id" TEXT NOT NULL,
  "attachment_version" INTEGER NOT NULL,
  "entry_path" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "object_key" TEXT NOT NULL,
  "content_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "zip_archive_entry_caches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "zip_archive_snapshots_attachment_id_attachment_version_key"
  ON "zip_archive_snapshots"("attachment_id", "attachment_version");

CREATE INDEX "zip_archive_snapshots_project_id_attachment_id_attachment_version_idx"
  ON "zip_archive_snapshots"("project_id", "attachment_id", "attachment_version");

CREATE UNIQUE INDEX "zip_archive_entry_caches_attachment_id_attachment_version_entry_path_key"
  ON "zip_archive_entry_caches"("attachment_id", "attachment_version", "entry_path");

CREATE INDEX "zip_archive_entry_caches_project_id_attachment_id_attachment_version_idx"
  ON "zip_archive_entry_caches"("project_id", "attachment_id", "attachment_version");

ALTER TABLE "zip_archive_snapshots"
  ADD CONSTRAINT "zip_archive_snapshots_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "zip_archive_snapshots"
  ADD CONSTRAINT "zip_archive_snapshots_attachment_id_fkey"
  FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "zip_archive_entry_caches"
  ADD CONSTRAINT "zip_archive_entry_caches_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "zip_archive_entry_caches"
  ADD CONSTRAINT "zip_archive_entry_caches_attachment_id_fkey"
  FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
