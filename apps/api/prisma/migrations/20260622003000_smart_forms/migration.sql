CREATE TYPE "SmartFormTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TYPE "SmartFormInstanceStatus" AS ENUM ('INCOMPLETE', 'COMPLETE');

ALTER TYPE "AttachmentFileKind" ADD VALUE 'SMART_FORM';

CREATE TABLE "smart_form_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'zh-CN',
    "framework_template_id" TEXT NOT NULL,
    "description" TEXT,
    "status" "SmartFormTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "draft_definition_json" JSONB NOT NULL,
    "current_published_version_id" TEXT,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_form_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "smart_form_template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definition_json" JSONB NOT NULL,
    "definition_hash" TEXT NOT NULL,
    "published_by" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smart_form_template_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_template_smart_forms" (
    "id" TEXT NOT NULL,
    "project_template_id" TEXT NOT NULL,
    "template_node_id" TEXT NOT NULL,
    "smart_form_template_id" TEXT NOT NULL,
    "smart_form_template_version_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_template_smart_forms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "smart_form_instances" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "attachment_id" TEXT NOT NULL,
    "smart_form_template_id" TEXT NOT NULL,
    "smart_form_template_version_id" TEXT NOT NULL,
    "schema_hash" TEXT NOT NULL,
    "answer_hash" TEXT NOT NULL,
    "status" "SmartFormInstanceStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "completed_at" TIMESTAMP(3),
    "last_saved_by" TEXT,
    "last_saved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_form_instances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "smart_form_templates_code_key" ON "smart_form_templates"("code");
CREATE UNIQUE INDEX "smart_form_templates_current_published_version_id_key" ON "smart_form_templates"("current_published_version_id");
CREATE INDEX "smart_form_templates_language_status_idx" ON "smart_form_templates"("language", "status");
CREATE INDEX "smart_form_templates_framework_template_id_status_idx" ON "smart_form_templates"("framework_template_id", "status");

CREATE UNIQUE INDEX "smart_form_template_versions_template_id_version_key" ON "smart_form_template_versions"("template_id", "version");
CREATE INDEX "smart_form_template_versions_template_id_published_at_idx" ON "smart_form_template_versions"("template_id", "published_at");

CREATE UNIQUE INDEX "project_template_smart_forms_template_node_id_code_key" ON "project_template_smart_forms"("template_node_id", "code");
CREATE INDEX "project_template_smart_forms_project_template_id_template_node_id_sort_order_idx" ON "project_template_smart_forms"("project_template_id", "template_node_id", "sort_order");
CREATE INDEX "project_template_smart_forms_smart_form_template_version_id_idx" ON "project_template_smart_forms"("smart_form_template_version_id");

CREATE UNIQUE INDEX "smart_form_instances_attachment_id_key" ON "smart_form_instances"("attachment_id");
CREATE INDEX "smart_form_instances_project_id_status_idx" ON "smart_form_instances"("project_id", "status");
CREATE INDEX "smart_form_instances_smart_form_template_version_id_idx" ON "smart_form_instances"("smart_form_template_version_id");

ALTER TABLE "smart_form_templates" ADD CONSTRAINT "smart_form_templates_framework_template_id_fkey" FOREIGN KEY ("framework_template_id") REFERENCES "framework_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "smart_form_templates" ADD CONSTRAINT "smart_form_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "smart_form_templates" ADD CONSTRAINT "smart_form_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "smart_form_template_versions" ADD CONSTRAINT "smart_form_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "smart_form_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "smart_form_template_versions" ADD CONSTRAINT "smart_form_template_versions_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "smart_form_templates" ADD CONSTRAINT "smart_form_templates_current_published_version_id_fkey" FOREIGN KEY ("current_published_version_id") REFERENCES "smart_form_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_template_smart_forms" ADD CONSTRAINT "project_template_smart_forms_project_template_id_fkey" FOREIGN KEY ("project_template_id") REFERENCES "project_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_template_smart_forms" ADD CONSTRAINT "project_template_smart_forms_template_node_id_fkey" FOREIGN KEY ("template_node_id") REFERENCES "project_template_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_template_smart_forms" ADD CONSTRAINT "project_template_smart_forms_smart_form_template_id_fkey" FOREIGN KEY ("smart_form_template_id") REFERENCES "smart_form_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_template_smart_forms" ADD CONSTRAINT "project_template_smart_forms_smart_form_template_version_id_fkey" FOREIGN KEY ("smart_form_template_version_id") REFERENCES "smart_form_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "smart_form_instances" ADD CONSTRAINT "smart_form_instances_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "smart_form_instances" ADD CONSTRAINT "smart_form_instances_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "smart_form_instances" ADD CONSTRAINT "smart_form_instances_smart_form_template_id_fkey" FOREIGN KEY ("smart_form_template_id") REFERENCES "smart_form_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "smart_form_instances" ADD CONSTRAINT "smart_form_instances_smart_form_template_version_id_fkey" FOREIGN KEY ("smart_form_template_version_id") REFERENCES "smart_form_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "smart_form_instances" ADD CONSTRAINT "smart_form_instances_last_saved_by_fkey" FOREIGN KEY ("last_saved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
