CREATE TABLE "confirmation_response_library_files" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "courier_tracking_number" TEXT,
    "reference_number" TEXT,
    "client_name" TEXT NOT NULL,
    "responding_entity" TEXT NOT NULL,
    "notes" TEXT,
    "file_name" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "confirmation_response_library_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "confirmation_response_library_files_code_key"
ON "confirmation_response_library_files"("code");

CREATE UNIQUE INDEX "confirmation_response_library_files_object_key_key"
ON "confirmation_response_library_files"("object_key");

CREATE INDEX "confirmation_response_library_files_received_at_updated_at_idx"
ON "confirmation_response_library_files"("received_at", "updated_at");

ALTER TABLE "confirmation_response_library_files"
ADD CONSTRAINT "confirmation_response_library_files_uploaded_by_id_fkey"
FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
