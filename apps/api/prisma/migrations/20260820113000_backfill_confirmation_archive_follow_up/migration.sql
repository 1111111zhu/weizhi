-- Imports completed before archive follow-up auditing was introduced must be
-- visible in the same confirmation timeline as newly archived responses.
INSERT INTO "confirmation_follow_up_events" (
  "id",
  "confirmation_id",
  "event_type",
  "actor_id",
  "source",
  "notes",
  "payload",
  "occurred_at",
  "created_at"
)
SELECT
  'archive-backfill-' || item."id",
  item."confirmation_id",
  'REVIEW_RECORDED'::"ConfirmationFollowUpEventType",
  job."created_by",
  'PROJECT_TEAM_MANUAL',
  '回函已归档至 ' ||
    COALESCE(target_node."code", item."emp_workflow_node_id") || '/' ||
    COALESCE(item."working_paper_code", paper."code", item."working_paper_id") || '/' ||
    COALESCE(item."working_paper_title", paper."title", item."source_file_name"),
  jsonb_build_object(
    'operation', 'RESPONSE_ARCHIVED_TO_EMP',
    'responseId', item."response_id",
    'responseArtifactId', item."response_artifact_id",
    'importJobId', job."id",
    'workflowNodeId', item."emp_workflow_node_id",
    'workflowNodeCode', target_node."code",
    'workflowNodeTitle', target_node."title",
    'workingPaperId', item."working_paper_id",
    'workingPaperCode', COALESCE(item."working_paper_code", paper."code"),
    'workingPaperTitle', COALESCE(item."working_paper_title", paper."title"),
    'attachmentId', item."attachment_id",
    'fileName', item."source_file_name",
    'objectKey', item."attachment_object_key",
    'backfilled', true
  ),
  COALESCE(job."completed_at", item."updated_at", job."updated_at", job."created_at"),
  COALESCE(job."completed_at", item."updated_at", job."updated_at", job."created_at")
FROM "confirmation_emp_import_items" AS item
JOIN "confirmation_emp_import_jobs" AS job
  ON job."id" = item."job_id"
LEFT JOIN "workflow_nodes" AS target_node
  ON target_node."id" = item."emp_workflow_node_id"
LEFT JOIN "working_papers" AS paper
  ON paper."id" = item."working_paper_id"
WHERE item."source_kind" = 'RESPONSE_ARTIFACT'
  AND item."status" = 'SUCCEEDED'
  AND item."withdrawn_at" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "confirmation_follow_up_events" AS event
    WHERE event."confirmation_id" = item."confirmation_id"
      AND event."payload"->>'operation' = 'RESPONSE_ARCHIVED_TO_EMP'
      AND event."payload"->>'importJobId' = job."id"
      AND event."payload"->>'responseArtifactId' = item."response_artifact_id"
  );
