-- Keep the existing working-paper index for legacy attachment queries and add
-- the directory/bucket index used by file-row ordering.
CREATE INDEX "attachments_workflowNodeId_bucket_sortOrder_idx"
ON "attachments"("workflow_node_id", "bucket", "sort_order");
