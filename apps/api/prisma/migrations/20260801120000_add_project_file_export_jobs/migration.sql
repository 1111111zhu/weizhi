CREATE TYPE "ProjectFileExportJobStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'DOWNLOADED',
  'EXPIRED'
);

CREATE TYPE "ProjectFileExportJobPhase" AS ENUM (
  'COLLECTING',
  'PACKAGING',
  'UPLOADING',
  'READY'
);

CREATE TYPE "ProjectFileExportJobScope" AS ENUM (
  'ATTACHMENTS',
  'WORKFLOW_NODE'
);

CREATE TABLE "project_file_export_jobs" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "created_by" TEXT NOT NULL,
  "scope" "ProjectFileExportJobScope" NOT NULL,
  "bucket" "WorkingPaperBucket" NOT NULL,
  "workflow_node_id" TEXT,
  "status" "ProjectFileExportJobStatus" NOT NULL DEFAULT 'QUEUED',
  "current_phase" "ProjectFileExportJobPhase" NOT NULL DEFAULT 'COLLECTING',
  "completed_files" INTEGER NOT NULL DEFAULT 0,
  "total_files" INTEGER NOT NULL DEFAULT 0,
  "total_source_bytes" BIGINT NOT NULL DEFAULT 0,
  "snapshot_json" JSONB NOT NULL,
  "error_message" TEXT,
  "output_object_key" TEXT,
  "output_file_name" TEXT,
  "output_file_size" BIGINT,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "downloaded_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "worker_token" TEXT,
  "lease_expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_file_export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_file_export_jobs_project_id_created_by_status_updated_at_idx"
  ON "project_file_export_jobs"("project_id", "created_by", "status", "updated_at");

CREATE INDEX "project_file_export_jobs_status_expires_at_idx"
  ON "project_file_export_jobs"("status", "expires_at");

CREATE INDEX "project_file_export_jobs_status_lease_expires_at_idx"
  ON "project_file_export_jobs"("status", "lease_expires_at");

CREATE UNIQUE INDEX "project_file_export_jobs_one_active_per_user_project"
  ON "project_file_export_jobs"("project_id", "created_by")
  WHERE "status" IN ('QUEUED', 'RUNNING');

ALTER TABLE "project_file_export_jobs"
  ADD CONSTRAINT "project_file_export_jobs_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_file_export_jobs"
  ADD CONSTRAINT "project_file_export_jobs_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
