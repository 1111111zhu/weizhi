DROP INDEX IF EXISTS "smart_form_templates_language_status_idx";

ALTER TABLE "smart_form_templates" DROP COLUMN IF EXISTS "language";
