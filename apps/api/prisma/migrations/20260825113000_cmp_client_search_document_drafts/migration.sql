ALTER TABLE "cmp_client_search_documents"
  ALTER COLUMN "client_id" DROP NOT NULL,
  ADD COLUMN "acceptance_request_id" TEXT;

ALTER TABLE "cmp_client_search_documents"
  ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT;

DROP TYPE "CmpClientSearchDocumentCategory";

ALTER TABLE "cmp_client_search_documents"
  ADD CONSTRAINT "cmp_client_search_documents_acceptance_request_id_fkey"
  FOREIGN KEY ("acceptance_request_id") REFERENCES "cmp_acceptance_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cmp_client_search_documents"
  ADD CONSTRAINT "cmp_client_search_documents_single_owner_check"
  CHECK (
    ("client_id" IS NOT NULL AND "acceptance_request_id" IS NULL)
    OR ("client_id" IS NULL AND "acceptance_request_id" IS NOT NULL)
  );

CREATE INDEX "cmp_client_search_documents_acceptance_request_id_category_created_at_idx"
  ON "cmp_client_search_documents"("acceptance_request_id", "category", "created_at");
