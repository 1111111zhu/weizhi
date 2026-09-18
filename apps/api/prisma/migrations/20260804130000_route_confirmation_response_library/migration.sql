CREATE TYPE "ConfirmationResponseLibraryRoutingStatus" AS ENUM (
  'UNASSIGNED_PROJECT',
  'PENDING_MATCH',
  'MATCHED',
  'NO_SOURCE_REQUEST'
);

ALTER TABLE "confirmation_response_library_files"
  ADD COLUMN "project_id" TEXT,
  ADD COLUMN "confirmation_id" TEXT,
  ADD COLUMN "provisional_type" "ConfirmationType",
  ADD COLUMN "routing_status" "ConfirmationResponseLibraryRoutingStatus" NOT NULL DEFAULT 'UNASSIGNED_PROJECT',
  ADD COLUMN "routed_by_id" TEXT,
  ADD COLUMN "routed_at" TIMESTAMP(3),
  ADD COLUMN "matched_response_id" TEXT;

CREATE UNIQUE INDEX "confirmation_response_library_files_matched_response_id_key"
  ON "confirmation_response_library_files"("matched_response_id");
CREATE INDEX "confirmation_response_library_files_routing_status_updated_at_idx"
  ON "confirmation_response_library_files"("routing_status", "updated_at");
CREATE INDEX "confirmation_response_library_files_project_id_routing_status_updated_at_idx"
  ON "confirmation_response_library_files"("project_id", "routing_status", "updated_at");
CREATE INDEX "confirmation_response_library_files_confirmation_id_idx"
  ON "confirmation_response_library_files"("confirmation_id");

ALTER TABLE "confirmation_response_library_files"
  ADD CONSTRAINT "confirmation_response_library_files_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "confirmation_response_library_files"
  ADD CONSTRAINT "confirmation_response_library_files_confirmation_id_fkey"
  FOREIGN KEY ("confirmation_id") REFERENCES "project_confirmations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "confirmation_response_library_files"
  ADD CONSTRAINT "confirmation_response_library_files_routed_by_id_fkey"
  FOREIGN KEY ("routed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "confirmation_response_library_files"
  ADD CONSTRAINT "confirmation_response_library_files_matched_response_id_fkey"
  FOREIGN KEY ("matched_response_id") REFERENCES "project_confirmation_responses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
