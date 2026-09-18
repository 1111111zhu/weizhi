ALTER TYPE "ConfirmationStatus" ADD VALUE IF NOT EXISTS 'RESPONSE_RECEIVED';

CREATE TYPE "ConfirmationFollowUpEventType" AS ENUM (
  'COUNTERPARTY_RECEIVED',
  'COUNTERPARTY_SENT_RESPONSE',
  'REDISPATCH_REQUESTED',
  'RESPONSE_RECEIVED',
  'RESPONSE_WITHDRAWN',
  'PROGRAM_COMPLETED'
);

CREATE TABLE "confirmation_follow_up_events" (
  "id" TEXT NOT NULL,
  "confirmation_id" TEXT NOT NULL,
  "event_type" "ConfirmationFollowUpEventType" NOT NULL,
  "actor_id" TEXT,
  "source" TEXT NOT NULL,
  "notes" TEXT,
  "payload" JSONB,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "confirmation_follow_up_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "confirmation_follow_up_events_confirmation_id_occurred_at_idx"
  ON "confirmation_follow_up_events"("confirmation_id", "occurred_at");

ALTER TABLE "confirmation_follow_up_events"
  ADD CONSTRAINT "confirmation_follow_up_events_confirmation_id_fkey"
  FOREIGN KEY ("confirmation_id") REFERENCES "project_confirmations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
