DROP INDEX IF EXISTS "working_papers_workflow_node_id_template_item_id_key";

CREATE UNIQUE INDEX "working_papers_workflow_node_id_template_item_id_bucket_key"
  ON "working_papers"("workflow_node_id", "template_item_id", "bucket");
