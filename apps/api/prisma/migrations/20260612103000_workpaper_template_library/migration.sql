CREATE TABLE "workpaper_templates" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subject_code" TEXT NOT NULL,
  "subject_name" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'zh-CN',
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "workpaper_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workpaper_template_items" (
  "id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "item_code" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "paper_type" "PaperType" NOT NULL DEFAULT 'WORKING_PAPER',
  "bucket" "WorkingPaperBucket" NOT NULL DEFAULT 'CURRENT',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "workpaper_template_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "working_papers"
  ADD COLUMN "template_item_id" TEXT;

CREATE UNIQUE INDEX "workpaper_templates_code_key"
  ON "workpaper_templates"("code");

CREATE INDEX "workpaper_templates_language_is_active_idx"
  ON "workpaper_templates"("language", "is_active");

CREATE INDEX "workpaper_templates_subject_code_is_active_idx"
  ON "workpaper_templates"("subject_code", "is_active");

CREATE INDEX "workpaper_template_items_template_id_sort_order_idx"
  ON "workpaper_template_items"("template_id", "sort_order");

CREATE INDEX "workpaper_template_items_template_id_item_code_idx"
  ON "workpaper_template_items"("template_id", "item_code");

CREATE INDEX "working_papers_template_item_id_idx"
  ON "working_papers"("template_item_id");

CREATE UNIQUE INDEX "working_papers_workflow_node_id_template_item_id_key"
  ON "working_papers"("workflow_node_id", "template_item_id");

ALTER TABLE "workpaper_template_items"
  ADD CONSTRAINT "workpaper_template_items_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "workpaper_templates"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "working_papers"
  ADD CONSTRAINT "working_papers_template_item_id_fkey"
  FOREIGN KEY ("template_item_id") REFERENCES "workpaper_template_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
