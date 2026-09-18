ALTER TABLE "attachments"
ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "attachments_working_paper_id_sort_order_idx"
ON "attachments"("working_paper_id", "sort_order");
