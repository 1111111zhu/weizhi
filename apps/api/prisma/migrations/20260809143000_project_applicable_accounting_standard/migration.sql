-- New EMP project creation stores a free-text accounting standard. Existing
-- Framework links stay intact and remain the backward-compatible fallback.
ALTER TABLE "projects"
  ADD COLUMN "applicable_accounting_standard" TEXT;

ALTER TABLE "projects"
  ALTER COLUMN "framework_template_id" DROP NOT NULL;

ALTER TABLE "projects"
  DROP CONSTRAINT IF EXISTS "projects_framework_template_id_fkey";

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_framework_template_id_fkey"
  FOREIGN KEY ("framework_template_id") REFERENCES "framework_templates"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
