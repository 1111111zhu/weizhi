ALTER TABLE "project_confirmation_dispatches"
  ADD COLUMN "tracking_provider" TEXT,
  ADD COLUMN "tracking_carrier_code" INTEGER,
  ADD COLUMN "tracking_carrier_name" TEXT,
  ADD COLUMN "tracking_status" TEXT,
  ADD COLUMN "tracking_substatus" TEXT,
  ADD COLUMN "tracking_description" TEXT,
  ADD COLUMN "tracking_location" TEXT,
  ADD COLUMN "tracking_events" JSONB,
  ADD COLUMN "tracking_registered_at" TIMESTAMP(3),
  ADD COLUMN "tracking_last_event_at" TIMESTAMP(3),
  ADD COLUMN "tracking_updated_at" TIMESTAMP(3),
  ADD COLUMN "tracking_stopped_at" TIMESTAMP(3),
  ADD COLUMN "tracking_error" TEXT;

CREATE INDEX "project_confirmation_dispatches_tracking_number_idx"
  ON "project_confirmation_dispatches"("tracking_number");
