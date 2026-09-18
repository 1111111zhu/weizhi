CREATE TYPE "ConfirmationEmpImportMode" AS ENUM ('FLAT', 'GROUPED', 'ZIP');

CREATE TYPE "ConfirmationEmpImportJobStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'PARTIAL_FAILURE',
  'FAILED'
);

CREATE TYPE "ConfirmationEmpImportItemStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED'
);

CREATE TYPE "ConfirmationEmpImportSourceKind" AS ENUM (
  'OUTGOING_ARTIFACT',
  'RESPONSE_ARTIFACT'
);

CREATE TABLE "confirmation_emp_import_jobs" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "target_workflow_node_id" TEXT NOT NULL,
  "batch_workflow_node_id" TEXT,
  "mode" "ConfirmationEmpImportMode" NOT NULL,
  "batch_code" TEXT,
  "batch_title" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "preview_fingerprint" TEXT NOT NULL,
  "previewed_at" TIMESTAMP(3) NOT NULL,
  "status" "ConfirmationEmpImportJobStatus" NOT NULL DEFAULT 'QUEUED',
  "created_by" TEXT NOT NULL,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "confirmation_emp_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "confirmation_emp_import_items" (
  "id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "confirmation_id" TEXT NOT NULL,
  "source_kind" "ConfirmationEmpImportSourceKind" NOT NULL,
  "outgoing_artifact_id" TEXT,
  "response_id" TEXT,
  "response_artifact_id" TEXT,
  "source_object_key" TEXT NOT NULL,
  "source_file_name" TEXT NOT NULL,
  "source_mime_type" TEXT NOT NULL,
  "source_size" INTEGER NOT NULL,
  "source_sha256" TEXT NOT NULL,
  "source_confirmation_code" TEXT,
  "source_counterparty_name" TEXT,
  "active_link_key" TEXT NOT NULL,
  "status" "ConfirmationEmpImportItemStatus" NOT NULL DEFAULT 'QUEUED',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "error_code" TEXT,
  "error_message" TEXT,
  "package_sequence" INTEGER,
  "zip_entry_name" TEXT,
  "emp_workflow_node_id" TEXT,
  "working_paper_id" TEXT,
  "attachment_id" TEXT,
  "working_paper_code" TEXT,
  "working_paper_title" TEXT,
  "attachment_object_key" TEXT,
  "target_head_version_id" TEXT,
  "target_head_hash" TEXT,
  "prepare_user_id" TEXT,
  "prepared_at" TIMESTAMP(3),
  "review_user_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "withdrawn_at" TIMESTAMP(3),
  "withdrawn_by" TEXT,
  "withdrawal_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "confirmation_emp_import_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "confirmation_emp_import_jobs_idempotency_key_key"
  ON "confirmation_emp_import_jobs"("idempotency_key");
CREATE INDEX "confirmation_emp_import_jobs_project_id_status_created_at_idx"
  ON "confirmation_emp_import_jobs"("project_id", "status", "created_at");
CREATE INDEX "confirmation_emp_import_jobs_target_workflow_node_id_idx"
  ON "confirmation_emp_import_jobs"("target_workflow_node_id");
CREATE INDEX "confirmation_emp_import_items_active_link_key_withdrawn_at_idx"
  ON "confirmation_emp_import_items"("active_link_key", "withdrawn_at");
CREATE UNIQUE INDEX "confirmation_emp_import_items_active_link_key_active_key"
  ON "confirmation_emp_import_items"("active_link_key")
  WHERE "status" = 'SUCCEEDED' AND "withdrawn_at" IS NULL;
CREATE INDEX "confirmation_emp_import_items_job_id_status_idx"
  ON "confirmation_emp_import_items"("job_id", "status");
CREATE INDEX "confirmation_emp_import_items_confirmation_id_idx"
  ON "confirmation_emp_import_items"("confirmation_id");
CREATE INDEX "confirmation_emp_import_items_working_paper_id_idx"
  ON "confirmation_emp_import_items"("working_paper_id");
CREATE INDEX "confirmation_emp_import_items_attachment_id_idx"
  ON "confirmation_emp_import_items"("attachment_id");

ALTER TABLE "confirmation_emp_import_jobs"
  ADD CONSTRAINT "confirmation_emp_import_jobs_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "confirmation_emp_import_jobs"
  ADD CONSTRAINT "confirmation_emp_import_jobs_target_workflow_node_id_fkey"
  FOREIGN KEY ("target_workflow_node_id") REFERENCES "workflow_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "confirmation_emp_import_jobs"
  ADD CONSTRAINT "confirmation_emp_import_jobs_batch_workflow_node_id_fkey"
  FOREIGN KEY ("batch_workflow_node_id") REFERENCES "workflow_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "confirmation_emp_import_jobs"
  ADD CONSTRAINT "confirmation_emp_import_jobs_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "confirmation_emp_import_items"
  ADD CONSTRAINT "confirmation_emp_import_items_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "confirmation_emp_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "confirmation_emp_import_items"
  ADD CONSTRAINT "confirmation_emp_import_items_confirmation_id_fkey"
  FOREIGN KEY ("confirmation_id") REFERENCES "project_confirmations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "confirmation_emp_import_items"
  ADD CONSTRAINT "confirmation_emp_import_items_outgoing_artifact_fkey"
  FOREIGN KEY ("outgoing_artifact_id", "confirmation_id")
  REFERENCES "confirmation_artifacts"("id", "confirmation_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "confirmation_emp_import_items"
  ADD CONSTRAINT "confirmation_emp_import_items_response_id_fkey"
  FOREIGN KEY ("response_id") REFERENCES "project_confirmation_responses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "confirmation_emp_import_items"
  ADD CONSTRAINT "confirmation_emp_import_items_response_artifact_id_fkey"
  FOREIGN KEY ("response_artifact_id") REFERENCES "confirmation_response_artifacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "confirmation_emp_import_items"
  ADD CONSTRAINT "confirmation_emp_import_items_emp_workflow_node_id_fkey"
  FOREIGN KEY ("emp_workflow_node_id") REFERENCES "workflow_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "confirmation_emp_import_items"
  ADD CONSTRAINT "confirmation_emp_import_items_working_paper_id_fkey"
  FOREIGN KEY ("working_paper_id") REFERENCES "working_papers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "confirmation_emp_import_items"
  ADD CONSTRAINT "confirmation_emp_import_items_attachment_id_fkey"
  FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
