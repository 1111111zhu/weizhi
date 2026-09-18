CREATE TYPE "CmpClientSearchDocumentCategory" AS ENUM ('AML_SEARCH', 'COMPANY_SEARCH');

CREATE TABLE "cmp_client_search_documents" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "category" "CmpClientSearchDocumentCategory" NOT NULL,
    "file_name" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content_hash" TEXT,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cmp_client_search_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cmp_client_search_documents_client_id_category_created_at_idx"
ON "cmp_client_search_documents"("client_id", "category", "created_at");

ALTER TABLE "cmp_client_search_documents"
ADD CONSTRAINT "cmp_client_search_documents_client_id_fkey"
FOREIGN KEY ("client_id") REFERENCES "cmp_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cmp_client_search_documents"
ADD CONSTRAINT "cmp_client_search_documents_uploaded_by_id_fkey"
FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
