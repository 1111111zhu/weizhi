ALTER TABLE "project_confirmation_dispatches"
  ADD COLUMN "attachment_object_key" TEXT,
  ADD COLUMN "attachment_mime_type" TEXT,
  ADD COLUMN "attachment_size" INTEGER,
  ADD COLUMN "attachment_sha256" TEXT;
