CREATE TABLE "knowledge_document_attachments" (
  "id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "object_key" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_document_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_document_attachments_object_key_key"
  ON "knowledge_document_attachments"("object_key");
CREATE INDEX "knowledge_document_attachments_document_id_created_at_idx"
  ON "knowledge_document_attachments"("document_id", "created_at");
ALTER TABLE "knowledge_document_attachments"
  ADD CONSTRAINT "knowledge_document_attachments_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
