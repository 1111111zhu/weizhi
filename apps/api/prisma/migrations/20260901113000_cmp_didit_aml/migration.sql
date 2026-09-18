CREATE TYPE "CmpAmlBatchStatus" AS ENUM (
  'RUNNING',
  'COMPLETED',
  'PARTIAL_FAILED',
  'FAILED'
);

CREATE TYPE "CmpAmlScreeningStatus" AS ENUM (
  'APPROVED',
  'IN_REVIEW',
  'DECLINED',
  'ERROR'
);

CREATE TYPE "CmpAmlEntityType" AS ENUM ('PERSON', 'COMPANY');

CREATE TYPE "CmpAmlReviewStatus" AS ENUM (
  'UNREVIEWED',
  'CONFIRMED_MATCH',
  'FALSE_POSITIVE',
  'INCONCLUSIVE'
);

CREATE TABLE "cmp_aml_screening_batches" (
  "id" TEXT NOT NULL,
  "acceptance_request_id" TEXT NOT NULL,
  "client_id" TEXT,
  "request_fingerprint" TEXT NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "force_run" BOOLEAN NOT NULL DEFAULT false,
  "status" "CmpAmlBatchStatus" NOT NULL DEFAULT 'RUNNING',
  "subject_count" INTEGER NOT NULL DEFAULT 0,
  "attention_count" INTEGER NOT NULL DEFAULT 0,
  "error_count" INTEGER NOT NULL DEFAULT 0,
  "triggered_by_id" TEXT NOT NULL,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cmp_aml_screening_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cmp_aml_screening_subjects" (
  "id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "subject_key" TEXT NOT NULL,
  "entity_type" "CmpAmlEntityType" NOT NULL,
  "roles_json" JSONB NOT NULL,
  "display_name" TEXT NOT NULL,
  "input_json" JSONB NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "didit_request_id" TEXT,
  "status" "CmpAmlScreeningStatus" NOT NULL,
  "score" DOUBLE PRECISION,
  "total_hits" INTEGER NOT NULL DEFAULT 0,
  "warnings_json" JSONB NOT NULL,
  "provider_response_json" JSONB,
  "error_code" TEXT,
  "error_message" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cmp_aml_screening_subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cmp_aml_hits" (
  "id" TEXT NOT NULL,
  "screening_id" TEXT NOT NULL,
  "didit_hit_id" TEXT NOT NULL,
  "review_status" "CmpAmlReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
  "match_score" DOUBLE PRECISION,
  "risk_score" DOUBLE PRECISION,
  "details_json" JSONB NOT NULL,
  "reviewed_by_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "review_comment" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cmp_aml_hits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cmp_aml_screening_batches_dedupe_key_key"
  ON "cmp_aml_screening_batches"("dedupe_key");
CREATE INDEX "cmp_aml_screening_batches_acceptance_request_id_created_at_idx"
  ON "cmp_aml_screening_batches"("acceptance_request_id", "created_at");
CREATE INDEX "cmp_aml_screening_batches_client_id_created_at_idx"
  ON "cmp_aml_screening_batches"("client_id", "created_at");
CREATE INDEX "cmp_aml_screening_batches_request_fingerprint_idx"
  ON "cmp_aml_screening_batches"("request_fingerprint");

CREATE UNIQUE INDEX "cmp_aml_screening_subjects_idempotency_key_key"
  ON "cmp_aml_screening_subjects"("idempotency_key");
CREATE UNIQUE INDEX "cmp_aml_screening_subjects_didit_request_id_key"
  ON "cmp_aml_screening_subjects"("didit_request_id");
CREATE UNIQUE INDEX "cmp_aml_screening_subjects_batch_id_subject_key_key"
  ON "cmp_aml_screening_subjects"("batch_id", "subject_key");
CREATE INDEX "cmp_aml_screening_subjects_batch_id_status_idx"
  ON "cmp_aml_screening_subjects"("batch_id", "status");

CREATE UNIQUE INDEX "cmp_aml_hits_screening_id_didit_hit_id_key"
  ON "cmp_aml_hits"("screening_id", "didit_hit_id");
CREATE INDEX "cmp_aml_hits_screening_id_review_status_idx"
  ON "cmp_aml_hits"("screening_id", "review_status");
CREATE INDEX "cmp_aml_hits_reviewed_by_id_idx"
  ON "cmp_aml_hits"("reviewed_by_id");

ALTER TABLE "cmp_aml_screening_batches"
  ADD CONSTRAINT "cmp_aml_screening_batches_acceptance_request_id_fkey"
  FOREIGN KEY ("acceptance_request_id") REFERENCES "cmp_acceptance_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cmp_aml_screening_batches"
  ADD CONSTRAINT "cmp_aml_screening_batches_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "cmp_clients"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cmp_aml_screening_batches"
  ADD CONSTRAINT "cmp_aml_screening_batches_triggered_by_id_fkey"
  FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cmp_aml_screening_subjects"
  ADD CONSTRAINT "cmp_aml_screening_subjects_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "cmp_aml_screening_batches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cmp_aml_hits"
  ADD CONSTRAINT "cmp_aml_hits_screening_id_fkey"
  FOREIGN KEY ("screening_id") REFERENCES "cmp_aml_screening_subjects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cmp_aml_hits"
  ADD CONSTRAINT "cmp_aml_hits_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
