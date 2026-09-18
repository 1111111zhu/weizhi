CREATE TABLE "project_archive_jobs" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "current_phase" TEXT NOT NULL,
  "current_label" TEXT,
  "completed_units" INTEGER NOT NULL DEFAULT 0,
  "total_units" INTEGER NOT NULL DEFAULT 4,
  "error_message" TEXT,
  "artifact_id" TEXT,
  "created_by" TEXT NOT NULL,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "project_archive_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_archive_jobs_artifact_id_key" ON "project_archive_jobs"("artifact_id");
CREATE INDEX "project_archive_jobs_project_id_created_at_idx" ON "project_archive_jobs"("project_id", "created_at");
CREATE INDEX "project_archive_jobs_project_id_status_updated_at_idx" ON "project_archive_jobs"("project_id", "status", "updated_at");

ALTER TABLE "project_archive_jobs" ADD CONSTRAINT "project_archive_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_archive_jobs" ADD CONSTRAINT "project_archive_jobs_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "project_archive_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_archive_jobs" ADD CONSTRAINT "project_archive_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
