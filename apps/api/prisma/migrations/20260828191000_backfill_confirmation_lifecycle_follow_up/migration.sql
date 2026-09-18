-- Preserve lifecycle operations that happened before lifecycle events were persisted.
INSERT INTO "confirmation_follow_up_events" (
  "id", "confirmation_id", "event_type", "actor_id", "source", "payload", "occurred_at", "created_at"
)
SELECT
  'lifecycle-backfill-' || log."id",
  log."target_id",
  CASE log."action"
    WHEN 'PROJECT_CONFIRMATION_CREATED' THEN 'CONFIRMATION_CREATED'::"ConfirmationFollowUpEventType"
    WHEN 'PROJECT_CONFIRMATION_UPLOADED_FILE_FROZEN' THEN 'CONFIRMATION_FROZEN'::"ConfirmationFollowUpEventType"
    WHEN 'PROJECT_CONFIRMATION_WITHDRAWN' THEN 'CONFIRMATION_UNFROZEN'::"ConfirmationFollowUpEventType"
  END,
  log."actor_id",
  'PROJECT_TEAM_SYSTEM',
  jsonb_build_object('backfilled', true, 'auditLogId', log."id"),
  log."created_at",
  log."created_at"
FROM "audit_logs" AS log
JOIN "project_confirmations" AS confirmation
  ON confirmation."id" = log."target_id"
WHERE log."target_type" = 'PROJECT_CONFIRMATION'
  AND log."target_id" IS NOT NULL
  AND log."action" IN (
    'PROJECT_CONFIRMATION_CREATED',
    'PROJECT_CONFIRMATION_UPLOADED_FILE_FROZEN',
    'PROJECT_CONFIRMATION_WITHDRAWN'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "confirmation_follow_up_events" AS event
    WHERE event."id" = 'lifecycle-backfill-' || log."id"
  );
