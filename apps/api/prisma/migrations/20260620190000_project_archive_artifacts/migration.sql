CREATE TABLE "project_archive_artifacts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_check_report" JSONB NOT NULL,
    "manifest_json" JSONB NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_archive_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_archive_artifacts_project_id_created_at_idx" ON "project_archive_artifacts"("project_id", "created_at");

ALTER TABLE "project_archive_artifacts" ADD CONSTRAINT "project_archive_artifacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_archive_artifacts" ADD CONSTRAINT "project_archive_artifacts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
