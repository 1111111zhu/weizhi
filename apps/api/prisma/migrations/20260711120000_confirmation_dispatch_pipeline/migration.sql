-- CreateEnum
CREATE TYPE "ConfirmationArtifactDisposition" AS ENUM ('ACTIVE', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "ConfirmationDispatchBatchStatus" AS ENUM ('QUEUED', 'EXECUTING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConfirmationDispatchBatchItemStatus" AS ENUM ('QUEUED', 'CLAIMED', 'SENT', 'FAILED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ConfirmationDispatchExecutionStatus" AS ENUM ('QUEUED', 'STARTED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConfirmationDispatchEventType" AS ENUM ('QUEUED', 'CLAIMED', 'RETURNED', 'STARTED', 'SENT', 'DELIVERED', 'FAILED', 'DISPATCHED', 'RECEIVED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ConfirmationPhysicalPackageStatus" AS ENUM ('CREATED', 'IN_CUSTODY', 'DISPATCHED', 'DELIVERED', 'RECEIVED', 'VOIDED', 'REPLACED');

-- CreateEnum
CREATE TYPE "ConfirmationResponseChannel" AS ENUM ('PAPER', 'EMAIL', 'PORTAL', 'ELECTRONIC', 'OTHER');

-- CreateEnum
CREATE TYPE "ConfirmationResponseMatchMethod" AS ENUM ('SCAN_TOKEN', 'PACKAGE_CODE', 'MANUAL');

-- CreateEnum
CREATE TYPE "ConfirmationResponseRoutingStatus" AS ENUM ('PENDING', 'ROUTED', 'CONCLUDED');

-- CreateEnum
CREATE TYPE "ConfirmationIntakeExceptionReason" AS ENUM ('UNKNOWN_SCAN_TOKEN', 'INVALID_PACKAGE_CODE', 'DUPLICATE_RESPONSE', 'UNMATCHED_RESPONSE', 'DAMAGED_RESPONSE', 'OTHER');

-- CreateEnum
CREATE TYPE "ConfirmationIntakeExceptionStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "project_confirmations"
  ADD COLUMN "current_artifact_id" TEXT,
  ADD COLUMN "queue_claimed_at" TIMESTAMP(3),
  ADD COLUMN "queue_claimed_by" TEXT,
  ADD COLUMN "queued_at" TIMESTAMP(3),
  ADD COLUMN "revision_reason" TEXT,
  ADD COLUMN "revision_requested_at" TIMESTAMP(3),
  ADD COLUMN "revision_requested_by" TEXT,
  ADD COLUMN "submission_version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "type_sequence" INTEGER;

-- AlterTable
ALTER TABLE "project_confirmation_dispatches"
  ADD COLUMN "artifact_id" TEXT,
  ADD COLUMN "batch_item_id" TEXT,
  ADD COLUMN "delivered_at" TIMESTAMP(3),
  ADD COLUMN "execution_status" "ConfirmationDispatchExecutionStatus" NOT NULL DEFAULT 'QUEUED',
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "provider_error_code" TEXT,
  ADD COLUMN "provider_error_message" TEXT,
  ADD COLUMN "provider_name" TEXT,
  ADD COLUMN "provider_reference" TEXT,
  ADD COLUMN "started_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "project_confirmation_responses"
  ADD COLUMN "condition_notes" TEXT,
  ADD COLUMN "match_method" "ConfirmationResponseMatchMethod",
  ADD COLUMN "page_count" INTEGER,
  ADD COLUMN "receiving_user_id" TEXT,
  ADD COLUMN "response_channel" "ConfirmationResponseChannel",
  ADD COLUMN "responsible_user_id" TEXT,
  ADD COLUMN "routing_status" "ConfirmationResponseRoutingStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "source_package_id" TEXT,
  ADD COLUMN "storage_location" TEXT;

-- CreateTable
CREATE TABLE "project_confirmation_sequences" (
  "project_id" TEXT NOT NULL,
  "type" "ConfirmationType" NOT NULL,
  "next_value" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "project_confirmation_sequences_pkey" PRIMARY KEY ("project_id", "type")
);

-- CreateTable
CREATE TABLE "confirmation_artifacts" (
  "id" TEXT NOT NULL,
  "confirmation_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "disposition" "ConfirmationArtifactDisposition" NOT NULL DEFAULT 'ACTIVE',
  "template_code" TEXT NOT NULL,
  "template_version" TEXT NOT NULL,
  "docx_object_key" TEXT NOT NULL,
  "docx_size" INTEGER NOT NULL,
  "pdf_object_key" TEXT NOT NULL,
  "pdf_size" INTEGER NOT NULL,
  "pdf_sha256" TEXT NOT NULL,
  "structured_snapshot" JSONB NOT NULL,
  "derived_snapshot" JSONB NOT NULL,
  "submission_key" TEXT NOT NULL,
  "submitted_by" TEXT NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL,
  "invalidated_by" TEXT,
  "invalidated_at" TIMESTAMP(3),
  "invalidation_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "confirmation_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmation_dispatch_batches" (
  "id" TEXT NOT NULL,
  "method" "ConfirmationDispatchMethod" NOT NULL,
  "status" "ConfirmationDispatchBatchStatus" NOT NULL DEFAULT 'QUEUED',
  "idempotency_key" TEXT NOT NULL,
  "created_by" TEXT NOT NULL,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "print_bundle_object_key" TEXT,
  "print_bundle_sha256" TEXT,
  "print_bundle_generated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "confirmation_dispatch_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmation_dispatch_batch_items" (
  "id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "confirmation_id" TEXT NOT NULL,
  "artifact_id" TEXT NOT NULL,
  "status" "ConfirmationDispatchBatchItemStatus" NOT NULL DEFAULT 'QUEUED',
  "idempotency_key" TEXT NOT NULL,
  "dispatch_id" TEXT,
  "error_code" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "confirmation_dispatch_batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmation_dispatch_events" (
  "id" TEXT NOT NULL,
  "dispatch_id" TEXT NOT NULL,
  "event_type" "ConfirmationDispatchEventType" NOT NULL,
  "actor_id" TEXT,
  "source" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "confirmation_dispatch_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmation_physical_packages" (
  "id" TEXT NOT NULL,
  "dispatch_id" TEXT NOT NULL,
  "scan_token" TEXT NOT NULL,
  "package_code" TEXT NOT NULL,
  "status" "ConfirmationPhysicalPackageStatus" NOT NULL DEFAULT 'CREATED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "package_pdf_object_key" TEXT NOT NULL,
  "package_pdf_sha256" TEXT NOT NULL,
  "courier_name" TEXT,
  "tracking_number" TEXT,
  "custodian_user_id" TEXT,
  "storage_location" TEXT,
  "replaces_package_id" TEXT,
  "voided_at" TIMESTAMP(3),
  "custody_received_at" TIMESTAMP(3),
  "custody_released_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "confirmation_physical_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmation_response_artifacts" (
  "id" TEXT NOT NULL,
  "response_id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "object_key" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "uploaded_by" TEXT NOT NULL,
  "captured_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "confirmation_response_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmation_intake_exceptions" (
  "id" TEXT NOT NULL,
  "reason" "ConfirmationIntakeExceptionReason" NOT NULL,
  "status" "ConfirmationIntakeExceptionStatus" NOT NULL DEFAULT 'OPEN',
  "scan_token_hash" TEXT,
  "scan_token_suffix" TEXT,
  "notes" TEXT,
  "suggested_matches" JSONB,
  "resolved_confirmation_id" TEXT,
  "resolved_package_id" TEXT,
  "resolved_by" TEXT,
  "resolution_reason" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "confirmation_intake_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmation_intake_exception_artifacts" (
  "id" TEXT NOT NULL,
  "exception_id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "object_key" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "uploaded_by" TEXT NOT NULL,
  "captured_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "confirmation_intake_exception_artifacts_pkey" PRIMARY KEY ("id")
);

-- Backfill legacy dispatches without fabricating artifacts or packages.
UPDATE "project_confirmation_dispatches"
SET "execution_status" = CASE
  WHEN "sent_at" IS NOT NULL THEN 'SENT'::"ConfirmationDispatchExecutionStatus"
  ELSE 'QUEUED'::"ConfirmationDispatchExecutionStatus"
END;

-- CreateIndex
CREATE UNIQUE INDEX "confirmation_artifacts_submission_key_key" ON "confirmation_artifacts"("submission_key");
CREATE UNIQUE INDEX "confirmation_artifacts_confirmation_id_version_key" ON "confirmation_artifacts"("confirmation_id", "version");
CREATE INDEX "confirmation_artifacts_confirmation_id_submitted_at_idx" ON "confirmation_artifacts"("confirmation_id", "submitted_at");
CREATE UNIQUE INDEX "confirmation_dispatch_batches_idempotency_key_key" ON "confirmation_dispatch_batches"("idempotency_key");
CREATE INDEX "confirmation_dispatch_batches_status_created_at_idx" ON "confirmation_dispatch_batches"("status", "created_at");
CREATE UNIQUE INDEX "confirmation_dispatch_batch_items_idempotency_key_key" ON "confirmation_dispatch_batch_items"("idempotency_key");
CREATE INDEX "confirmation_dispatch_batch_items_batch_id_status_idx" ON "confirmation_dispatch_batch_items"("batch_id", "status");
CREATE INDEX "confirmation_dispatch_batch_items_confirmation_id_idx" ON "confirmation_dispatch_batch_items"("confirmation_id");
CREATE INDEX "confirmation_dispatch_batch_items_artifact_id_idx" ON "confirmation_dispatch_batch_items"("artifact_id");
CREATE INDEX "confirmation_dispatch_batch_items_dispatch_id_idx" ON "confirmation_dispatch_batch_items"("dispatch_id");
CREATE INDEX "confirmation_dispatch_events_dispatch_id_occurred_at_idx" ON "confirmation_dispatch_events"("dispatch_id", "occurred_at");
CREATE UNIQUE INDEX "confirmation_physical_packages_scan_token_key" ON "confirmation_physical_packages"("scan_token");
CREATE UNIQUE INDEX "confirmation_physical_packages_package_code_key" ON "confirmation_physical_packages"("package_code");
CREATE UNIQUE INDEX "confirmation_physical_packages_replaces_package_id_key" ON "confirmation_physical_packages"("replaces_package_id");
CREATE INDEX "confirmation_physical_packages_dispatch_id_idx" ON "confirmation_physical_packages"("dispatch_id");
CREATE INDEX "confirmation_physical_packages_status_custody_received_at_idx" ON "confirmation_physical_packages"("status", "custody_received_at");
CREATE UNIQUE INDEX "confirmation_response_artifacts_response_id_sequence_key" ON "confirmation_response_artifacts"("response_id", "sequence");
CREATE INDEX "confirmation_intake_exceptions_status_created_at_idx" ON "confirmation_intake_exceptions"("status", "created_at");
CREATE INDEX "confirmation_intake_exceptions_resolved_confirmation_id_idx" ON "confirmation_intake_exceptions"("resolved_confirmation_id");
CREATE INDEX "confirmation_intake_exceptions_resolved_package_id_idx" ON "confirmation_intake_exceptions"("resolved_package_id");
CREATE UNIQUE INDEX "confirmation_intake_exception_artifacts_exception_id_sequen_key" ON "confirmation_intake_exception_artifacts"("exception_id", "sequence");
CREATE UNIQUE INDEX "project_confirmation_dispatches_batch_item_id_key" ON "project_confirmation_dispatches"("batch_item_id");
CREATE UNIQUE INDEX "project_confirmation_dispatches_idempotency_key_key" ON "project_confirmation_dispatches"("idempotency_key");
CREATE INDEX "project_confirmation_dispatches_artifact_id_idx" ON "project_confirmation_dispatches"("artifact_id");
CREATE UNIQUE INDEX "project_confirmation_responses_source_package_id_key" ON "project_confirmation_responses"("source_package_id");
CREATE INDEX "project_confirmation_responses_source_package_id_idx" ON "project_confirmation_responses"("source_package_id");
CREATE UNIQUE INDEX "project_confirmations_current_artifact_id_key" ON "project_confirmations"("current_artifact_id");
CREATE UNIQUE INDEX "project_confirmations_project_id_type_type_sequence_key" ON "project_confirmations"("project_id", "type", "type_sequence");
CREATE INDEX "project_confirmations_project_id_confirmation_code_idx" ON "project_confirmations"("project_id", "confirmation_code");
CREATE UNIQUE INDEX "project_confirmations_project_id_confirmation_code_not_null_key"
  ON "project_confirmations"("project_id", "confirmation_code")
  WHERE "confirmation_code" IS NOT NULL;
CREATE UNIQUE INDEX "confirmation_physical_packages_dispatch_id_active_key"
  ON "confirmation_physical_packages"("dispatch_id")
  WHERE "voided_at" IS NULL;

-- AddForeignKey
ALTER TABLE "project_confirmations" ADD CONSTRAINT "project_confirmations_current_artifact_id_fkey" FOREIGN KEY ("current_artifact_id") REFERENCES "confirmation_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_confirmation_dispatches" ADD CONSTRAINT "project_confirmation_dispatches_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "confirmation_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_confirmation_sequences" ADD CONSTRAINT "project_confirmation_sequences_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "confirmation_artifacts" ADD CONSTRAINT "confirmation_artifacts_confirmation_id_fkey" FOREIGN KEY ("confirmation_id") REFERENCES "project_confirmations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "confirmation_dispatch_batch_items" ADD CONSTRAINT "confirmation_dispatch_batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "confirmation_dispatch_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "confirmation_dispatch_batch_items" ADD CONSTRAINT "confirmation_dispatch_batch_items_confirmation_id_fkey" FOREIGN KEY ("confirmation_id") REFERENCES "project_confirmations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "confirmation_dispatch_batch_items" ADD CONSTRAINT "confirmation_dispatch_batch_items_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "confirmation_artifacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "confirmation_dispatch_events" ADD CONSTRAINT "confirmation_dispatch_events_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "project_confirmation_dispatches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "confirmation_physical_packages" ADD CONSTRAINT "confirmation_physical_packages_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "project_confirmation_dispatches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "confirmation_physical_packages" ADD CONSTRAINT "confirmation_physical_packages_replaces_package_id_fkey" FOREIGN KEY ("replaces_package_id") REFERENCES "confirmation_physical_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "confirmation_response_artifacts" ADD CONSTRAINT "confirmation_response_artifacts_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "project_confirmation_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "confirmation_intake_exception_artifacts" ADD CONSTRAINT "confirmation_intake_exception_artifacts_exception_id_fkey" FOREIGN KEY ("exception_id") REFERENCES "confirmation_intake_exceptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Normalize confirmation ownership. The conceptual batch-item dispatch mirror is
-- canonicalized as the nullable unique dispatch.batch_item_id relation.
ALTER TABLE "confirmation_dispatch_batch_items" DROP CONSTRAINT "confirmation_dispatch_batch_items_artifact_id_fkey";
ALTER TABLE "confirmation_physical_packages" DROP CONSTRAINT "confirmation_physical_packages_dispatch_id_fkey";
ALTER TABLE "project_confirmation_dispatches" DROP CONSTRAINT "project_confirmation_dispatches_artifact_id_fkey";
ALTER TABLE "project_confirmations" DROP CONSTRAINT "project_confirmations_current_artifact_id_fkey";
DROP INDEX "confirmation_dispatch_batch_items_dispatch_id_idx";
ALTER TABLE "confirmation_dispatch_batch_items" DROP COLUMN "dispatch_id";
ALTER TABLE "confirmation_physical_packages" ADD COLUMN "confirmation_id" TEXT NOT NULL;

CREATE UNIQUE INDEX "confirmation_artifacts_id_confirmation_id_key" ON "confirmation_artifacts"("id", "confirmation_id");
CREATE UNIQUE INDEX "confirmation_dispatch_batch_items_id_confirmation_id_key" ON "confirmation_dispatch_batch_items"("id", "confirmation_id");
CREATE UNIQUE INDEX "confirmation_physical_packages_id_confirmation_id_key" ON "confirmation_physical_packages"("id", "confirmation_id");
CREATE UNIQUE INDEX "project_confirmation_dispatches_id_confirmation_id_key" ON "project_confirmation_dispatches"("id", "confirmation_id");
CREATE UNIQUE INDEX "project_confirmation_dispatches_batch_item_id_confirmation__key" ON "project_confirmation_dispatches"("batch_item_id", "confirmation_id");
CREATE UNIQUE INDEX "project_confirmation_responses_source_package_id_confirmati_key" ON "project_confirmation_responses"("source_package_id", "confirmation_id");
CREATE UNIQUE INDEX "project_confirmations_current_artifact_id_id_key" ON "project_confirmations"("current_artifact_id", "id");

ALTER TABLE "project_confirmations" ADD CONSTRAINT "project_confirmations_current_artifact_id_id_fkey" FOREIGN KEY ("current_artifact_id", "id") REFERENCES "confirmation_artifacts"("id", "confirmation_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_confirmation_dispatches" ADD CONSTRAINT "project_confirmation_dispatches_batch_item_id_confirmation_fkey" FOREIGN KEY ("batch_item_id", "confirmation_id") REFERENCES "confirmation_dispatch_batch_items"("id", "confirmation_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_confirmation_dispatches" ADD CONSTRAINT "project_confirmation_dispatches_artifact_id_confirmation_i_fkey" FOREIGN KEY ("artifact_id", "confirmation_id") REFERENCES "confirmation_artifacts"("id", "confirmation_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_confirmation_responses" ADD CONSTRAINT "project_confirmation_responses_source_package_id_confirmat_fkey" FOREIGN KEY ("source_package_id", "confirmation_id") REFERENCES "confirmation_physical_packages"("id", "confirmation_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "confirmation_dispatch_batch_items" ADD CONSTRAINT "confirmation_dispatch_batch_items_artifact_id_confirmation_fkey" FOREIGN KEY ("artifact_id", "confirmation_id") REFERENCES "confirmation_artifacts"("id", "confirmation_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "confirmation_physical_packages" ADD CONSTRAINT "confirmation_physical_packages_dispatch_id_confirmation_id_fkey" FOREIGN KEY ("dispatch_id", "confirmation_id") REFERENCES "project_confirmation_dispatches"("id", "confirmation_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "confirmation_intake_exceptions" ADD CONSTRAINT "confirmation_intake_exceptions_resolved_confirmation_id_fkey" FOREIGN KEY ("resolved_confirmation_id") REFERENCES "project_confirmations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "confirmation_intake_exceptions" ADD CONSTRAINT "confirmation_intake_exceptions_resolved_package_id_fkey" FOREIGN KEY ("resolved_package_id") REFERENCES "confirmation_physical_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
