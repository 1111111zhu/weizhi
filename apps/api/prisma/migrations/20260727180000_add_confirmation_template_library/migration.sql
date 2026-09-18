CREATE TABLE "confirmation_template_library_files" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "confirmation_type" "ConfirmationType" NOT NULL,
    "description" TEXT,
    "file_name" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "confirmation_template_library_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "confirmation_template_library_files_code_key"
ON "confirmation_template_library_files"("code");

CREATE UNIQUE INDEX "confirmation_template_library_files_object_key_key"
ON "confirmation_template_library_files"("object_key");

CREATE INDEX "confirmation_template_library_files_confirmation_type_updated_at_idx"
ON "confirmation_template_library_files"("confirmation_type", "updated_at");
