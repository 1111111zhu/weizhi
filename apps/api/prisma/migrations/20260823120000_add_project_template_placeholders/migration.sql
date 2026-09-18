ALTER TYPE "AttachmentPlaceholderType" ADD VALUE IF NOT EXISTS 'GENERIC';

ALTER TABLE "project_template_files"
ADD COLUMN "placeholder_type" "AttachmentPlaceholderType";
