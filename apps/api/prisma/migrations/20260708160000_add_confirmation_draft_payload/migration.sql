ALTER TABLE "project_confirmations"
  ADD COLUMN "draft_template_code" TEXT,
  ADD COLUMN "draft_payload" JSONB,
  ADD COLUMN "draft_updated_at" TIMESTAMP(3);
