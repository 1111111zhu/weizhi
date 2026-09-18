ALTER TABLE "cmp_acceptance_requests"
  ADD COLUMN "target_client_id" TEXT,
  ADD COLUMN "target_engagement_id" TEXT;

CREATE INDEX "cmp_acceptance_requests_target_client_id_idx"
  ON "cmp_acceptance_requests"("target_client_id");

CREATE INDEX "cmp_acceptance_requests_target_engagement_id_idx"
  ON "cmp_acceptance_requests"("target_engagement_id");
