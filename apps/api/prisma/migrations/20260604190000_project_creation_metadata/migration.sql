CREATE TABLE "framework_templates" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'zh-CN',
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "framework_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "framework_templates_code_key" ON "framework_templates"("code");

INSERT INTO "framework_templates" ("id", "code", "name", "language", "description")
VALUES
  ('framework-hkfrs', 'HKFRS', 'HKFRS audit framework', 'zh-CN', 'Default Hong Kong Financial Reporting Standards audit framework.'),
  ('framework-ifrs', 'IFRS', 'IFRS audit framework', 'en-US', 'Default International Financial Reporting Standards audit framework.'),
  ('framework-cas', 'CAS', 'CAS audit framework', 'zh-CN', 'Default China Accounting Standards audit framework.')
ON CONFLICT ("code") DO NOTHING;

ALTER TABLE "projects" ADD COLUMN "name" TEXT;
ALTER TABLE "projects" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'zh-CN';
ALTER TABLE "projects" ADD COLUMN "framework_template_id" TEXT;
ALTER TABLE "projects" ADD COLUMN "year_end_date" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN "report_date" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN "archive_deadline" TIMESTAMP(3);

UPDATE "projects"
SET
  "name" = "company_name",
  "framework_template_id" = 'framework-hkfrs',
  "year_end_date" = "reporting_date",
  "report_date" = "reporting_date",
  "archive_deadline" = "reporting_date" + INTERVAL '90 days'
WHERE "name" IS NULL;

ALTER TABLE "projects" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "framework_template_id" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "year_end_date" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "report_date" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "archive_deadline" SET NOT NULL;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_framework_template_id_fkey"
  FOREIGN KEY ("framework_template_id")
  REFERENCES "framework_templates"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
