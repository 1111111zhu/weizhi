DO $$
BEGIN
  CREATE TYPE "CmpAcceptanceRequestType" AS ENUM ('CLIENT', 'ENGAGEMENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CmpAcceptanceStatus" AS ENUM (
    'DRAFT',
    'PENDING_MIC',
    'PENDING_PIC',
    'PENDING_IT',
    'APPROVED',
    'RETURNED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CmpAcceptanceStep" AS ENUM ('MIC', 'PIC', 'IT', 'DONE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CmpAcceptanceStepStatus" AS ENUM ('PENDING', 'APPROVED', 'RETURNED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "cmp_acceptance_requests" (
  "id" TEXT NOT NULL,
  "request_no" TEXT NOT NULL,
  "type" "CmpAcceptanceRequestType" NOT NULL,
  "status" "CmpAcceptanceStatus" NOT NULL DEFAULT 'DRAFT',
  "current_step" "CmpAcceptanceStep" NOT NULL DEFAULT 'MIC',
  "submitted_by_id" TEXT NOT NULL,
  "mic_approver_id" TEXT NOT NULL,
  "pic_approver_id" TEXT NOT NULL,
  "it_approver_id" TEXT NOT NULL,
  "client_payload" JSONB,
  "engagement_payload" JSONB,
  "return_reason" TEXT,
  "submitted_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "returned_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cmp_acceptance_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cmp_acceptance_approval_steps" (
  "id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "step" "CmpAcceptanceStep" NOT NULL,
  "approver_id" TEXT NOT NULL,
  "status" "CmpAcceptanceStepStatus" NOT NULL DEFAULT 'PENDING',
  "comment" TEXT,
  "acted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cmp_acceptance_approval_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cmp_acceptance_requests_request_no_key"
  ON "cmp_acceptance_requests"("request_no");
CREATE INDEX IF NOT EXISTS "cmp_acceptance_requests_status_current_step_idx"
  ON "cmp_acceptance_requests"("status", "current_step");
CREATE INDEX IF NOT EXISTS "cmp_acceptance_requests_type_status_idx"
  ON "cmp_acceptance_requests"("type", "status");
CREATE INDEX IF NOT EXISTS "cmp_acceptance_requests_submitted_by_id_status_idx"
  ON "cmp_acceptance_requests"("submitted_by_id", "status");
CREATE INDEX IF NOT EXISTS "cmp_acceptance_requests_mic_approver_id_status_idx"
  ON "cmp_acceptance_requests"("mic_approver_id", "status");
CREATE INDEX IF NOT EXISTS "cmp_acceptance_requests_pic_approver_id_status_idx"
  ON "cmp_acceptance_requests"("pic_approver_id", "status");
CREATE INDEX IF NOT EXISTS "cmp_acceptance_requests_it_approver_id_status_idx"
  ON "cmp_acceptance_requests"("it_approver_id", "status");
CREATE INDEX IF NOT EXISTS "cmp_acceptance_approval_steps_request_id_step_idx"
  ON "cmp_acceptance_approval_steps"("request_id", "step");
CREATE INDEX IF NOT EXISTS "cmp_acceptance_approval_steps_approver_id_status_idx"
  ON "cmp_acceptance_approval_steps"("approver_id", "status");

DO $$
BEGIN
  ALTER TABLE "cmp_acceptance_requests"
    ADD CONSTRAINT "cmp_acceptance_requests_submitted_by_id_fkey"
    FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "cmp_acceptance_requests"
    ADD CONSTRAINT "cmp_acceptance_requests_mic_approver_id_fkey"
    FOREIGN KEY ("mic_approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "cmp_acceptance_requests"
    ADD CONSTRAINT "cmp_acceptance_requests_pic_approver_id_fkey"
    FOREIGN KEY ("pic_approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "cmp_acceptance_requests"
    ADD CONSTRAINT "cmp_acceptance_requests_it_approver_id_fkey"
    FOREIGN KEY ("it_approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "cmp_acceptance_approval_steps"
    ADD CONSTRAINT "cmp_acceptance_approval_steps_request_id_fkey"
    FOREIGN KEY ("request_id") REFERENCES "cmp_acceptance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "cmp_acceptance_approval_steps"
    ADD CONSTRAINT "cmp_acceptance_approval_steps_approver_id_fkey"
    FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
