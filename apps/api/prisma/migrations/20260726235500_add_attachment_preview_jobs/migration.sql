ALTER TABLE "attachments"
  ADD COLUMN "preview_status" TEXT NOT NULL DEFAULT 'UNSUPPORTED',
  ADD COLUMN "preview_version" INTEGER,
  ADD COLUMN "preview_error" TEXT,
  ADD COLUMN "preview_attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "preview_next_attempt_at" TIMESTAMP(3),
  ADD COLUMN "preview_lease_token" TEXT,
  ADD COLUMN "preview_lease_expires_at" TIMESTAMP(3),
  ADD COLUMN "preview_updated_at" TIMESTAMP(3);

UPDATE "attachments"
SET "preview_status" = 'QUEUED'
WHERE lower(COALESCE("original_name", "file_name")) ~ '\.(pdf|doc|docx|ppt|pptx|xls|xlsx|xlsm|xlsb|csv)$'
   OR lower("mime_type") IN (
     'application/pdf',
     'application/msword',
     'application/vnd.ms-powerpoint',
     'application/vnd.ms-excel',
     'application/vnd.ms-excel.sheet.binary.macroenabled.12',
     'application/vnd.ms-excel.sheet.macroenabled.12',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.openxmlformats-officedocument.presentationml.presentation',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'text/csv'
   );

CREATE INDEX "attachments_preview_status_preview_next_attempt_at_idx"
  ON "attachments"("preview_status", "preview_next_attempt_at");

CREATE INDEX "attachments_preview_lease_expires_at_idx"
  ON "attachments"("preview_lease_expires_at");
