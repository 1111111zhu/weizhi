CREATE TYPE "AttachmentPlaceholderType" AS ENUM (
  'WORD',
  'SPREADSHEET',
  'PRESENTATION',
  'PDF',
  'IMAGE',
  'ZIP',
  'TEXT'
);

ALTER TABLE "attachments"
ADD COLUMN "placeholder_type" "AttachmentPlaceholderType";
