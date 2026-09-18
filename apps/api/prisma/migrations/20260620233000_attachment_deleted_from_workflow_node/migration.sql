ALTER TABLE "attachments"
  ADD COLUMN "deleted_from_workflow_node_id" TEXT;

CREATE INDEX "attachments_deleted_from_workflow_node_id_idx"
  ON "attachments"("deleted_from_workflow_node_id");