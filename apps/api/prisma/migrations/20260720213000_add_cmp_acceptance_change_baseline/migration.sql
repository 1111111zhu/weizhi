ALTER TABLE "cmp_acceptance_requests"
ADD COLUMN "change_baseline_payload" JSONB,
ADD COLUMN "change_baseline_captured_at" TIMESTAMP(3),
ADD COLUMN "change_baseline_target_updated_at" TIMESTAMP(3);
