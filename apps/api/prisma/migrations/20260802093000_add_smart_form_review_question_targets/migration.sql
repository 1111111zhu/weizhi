ALTER TABLE "working_paper_questions"
ADD COLUMN "smart_form_node_id" TEXT,
ADD COLUMN "smart_form_row_id" TEXT,
ADD COLUMN "smart_form_target_label" TEXT;

CREATE INDEX "working_paper_questions_attachment_id_smart_form_node_id_smart_form_row_id_idx"
ON "working_paper_questions"("attachment_id", "smart_form_node_id", "smart_form_row_id");
