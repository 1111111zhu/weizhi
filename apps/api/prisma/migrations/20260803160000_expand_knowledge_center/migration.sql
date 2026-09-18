ALTER TABLE "knowledge_documents"
  ALTER COLUMN "reference_code" DROP NOT NULL,
  ALTER COLUMN "original_name" DROP NOT NULL,
  ALTER COLUMN "object_key" DROP NOT NULL,
  ALTER COLUMN "mime_type" DROP NOT NULL,
  ALTER COLUMN "size" DROP NOT NULL,
  ADD COLUMN "secondary_category" TEXT,
  ADD COLUMN "tertiary_category" TEXT,
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'FILE',
  ADD COLUMN "body" JSONB,
  ADD COLUMN "external_link" TEXT,
  ADD COLUMN "preview_allowed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "download_allowed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE INDEX "knowledge_documents_department_secondary_category_tertiary_category_updated_at_idx"
  ON "knowledge_documents"("department", "secondary_category", "tertiary_category", "updated_at");

CREATE INDEX "knowledge_documents_status_published_at_idx"
  ON "knowledge_documents"("status", "published_at");
