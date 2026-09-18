UPDATE "audit_logs"
SET "description" =
  CASE
    WHEN substring("description" from '([A-Z][0-9]{2}-[0-9]{4}-F[0-9]+)$') IS NOT NULL
      THEN 'Reviewer 提出复核意见 ' || substring("description" from '([A-Z][0-9]{2}-[0-9]{4}-F[0-9]+)$')
    ELSE 'Reviewer 提出复核意见'
  END
WHERE "action" = 'WORKING_PAPER_QUESTION_CREATED';

UPDATE "audit_logs"
SET "description" = '回复复核意见'
WHERE "action" = 'WORKING_PAPER_QUESTION_REPLIED';

UPDATE "audit_logs"
SET "description" = '清除复核意见'
WHERE "action" = 'WORKING_PAPER_QUESTION_CLEARED';

UPDATE "audit_logs"
SET "description" = '重新打开复核意见'
WHERE "action" = 'WORKING_PAPER_QUESTION_REOPENED';
