DROP INDEX IF EXISTS "working_paper_signoffs_working_paper_id_user_id_type_key";

CREATE UNIQUE INDEX "attachments_active_workflow_node_code_key"
  ON "attachments"("workflow_node_id", "code")
  WHERE "deleted_at" IS NULL
    AND "workflow_node_id" IS NOT NULL
    AND "code" IS NOT NULL;
