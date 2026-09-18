CREATE TYPE "ConfirmationResponseStatus" AS ENUM ('NOT_RECEIVED', 'RECEIVED', 'UNIDENTIFIED', 'ASSIGNED');

CREATE TYPE "ConfirmationTeamConfirmStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

CREATE TYPE "ConfirmationDifferenceStatus" AS ENUM ('MATCHED', 'EXCEPTION', 'PENDING_FOLLOW_UP', 'NO_RESPONSE');

ALTER TABLE "project_confirmations"
  ADD COLUMN "client_name" TEXT,
  ADD COLUMN "confirmation_code" TEXT,
  ADD COLUMN "audit_period" TEXT,
  ADD COLUMN "responding_entity_name" TEXT,
  ADD COLUMN "third_party_name" TEXT,
  ADD COLUMN "subject_name" TEXT,
  ADD COLUMN "attachment_name" TEXT,
  ADD COLUMN "team_confirm_status" "ConfirmationTeamConfirmStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "team_confirmed_by_name" TEXT,
  ADD COLUMN "team_confirmed_at" TIMESTAMP(3),
  ADD COLUMN "difference_status" "ConfirmationDifferenceStatus";

ALTER TABLE "project_confirmation_dispatches"
  ADD COLUMN "sender_name" TEXT,
  ADD COLUMN "applicant_name" TEXT,
  ADD COLUMN "dispatch_reference" TEXT;

ALTER TABLE "project_confirmation_responses"
  ADD COLUMN "response_status" "ConfirmationResponseStatus" NOT NULL DEFAULT 'RECEIVED',
  ADD COLUMN "response_reference" TEXT,
  ADD COLUMN "response_address" TEXT;
