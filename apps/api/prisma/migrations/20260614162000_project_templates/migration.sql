CREATE TYPE "ProjectTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "project_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'zh-CN',
    "framework_template_id" TEXT,
    "description" TEXT,
    "status" "ProjectTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_template_nodes" (
    "id" TEXT NOT NULL,
    "project_template_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "level" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "node_type" "WorkflowNodeType" NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_template_nodes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_template_files" (
    "id" TEXT NOT NULL,
    "project_template_id" TEXT NOT NULL,
    "template_node_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "original_name" TEXT,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "paper_type" "PaperType" NOT NULL DEFAULT 'WORKING_PAPER',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "template_item_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_template_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_templates_code_key" ON "project_templates"("code");
CREATE INDEX "project_templates_language_status_idx" ON "project_templates"("language", "status");
CREATE INDEX "project_templates_framework_template_id_status_idx" ON "project_templates"("framework_template_id", "status");
CREATE UNIQUE INDEX "project_template_nodes_project_template_id_parent_id_code_key" ON "project_template_nodes"("project_template_id", "parent_id", "code");
CREATE INDEX "project_template_nodes_project_template_id_level_sort_order_idx" ON "project_template_nodes"("project_template_id", "level", "sort_order");
CREATE UNIQUE INDEX "project_template_files_template_node_id_code_key" ON "project_template_files"("template_node_id", "code");
CREATE INDEX "project_template_files_project_template_id_template_node_id_sort_order_idx" ON "project_template_files"("project_template_id", "template_node_id", "sort_order");
CREATE INDEX "project_template_files_template_item_id_idx" ON "project_template_files"("template_item_id");

ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_framework_template_id_fkey" FOREIGN KEY ("framework_template_id") REFERENCES "framework_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_template_nodes" ADD CONSTRAINT "project_template_nodes_project_template_id_fkey" FOREIGN KEY ("project_template_id") REFERENCES "project_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_template_nodes" ADD CONSTRAINT "project_template_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "project_template_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_template_files" ADD CONSTRAINT "project_template_files_project_template_id_fkey" FOREIGN KEY ("project_template_id") REFERENCES "project_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_template_files" ADD CONSTRAINT "project_template_files_template_node_id_fkey" FOREIGN KEY ("template_node_id") REFERENCES "project_template_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_template_files" ADD CONSTRAINT "project_template_files_template_item_id_fkey" FOREIGN KEY ("template_item_id") REFERENCES "workpaper_template_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
