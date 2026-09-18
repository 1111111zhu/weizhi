ALTER TYPE "InboxMessageType" ADD VALUE 'REVIEW_QUESTION';
ALTER TYPE "InboxMessageType" ADD VALUE 'REVIEW_REPLY';
ALTER TYPE "InboxMessageType" ADD VALUE 'REVIEW_FOLLOW_UP';
ALTER TYPE "InboxMessageType" ADD VALUE 'REVIEW_REOPENED';
ALTER TYPE "InboxMessageType" ADD VALUE 'SIGNOFF';
ALTER TYPE "InboxMessageType" ADD VALUE 'SYSTEM_NOTIFICATION';

ALTER TABLE "inbox_messages"
  ADD COLUMN "project_id" TEXT,
  ADD COLUMN "working_paper_id" TEXT,
  ADD COLUMN "review_question_id" TEXT;

UPDATE "inbox_messages" AS message
SET "project_id" = invitation."project_id"
FROM "project_invitations" AS invitation
WHERE message."project_invitation_id" = invitation."id"
  AND message."project_id" IS NULL;

CREATE INDEX "inbox_messages_recipient_id_type_read_at_created_at_idx"
  ON "inbox_messages"("recipient_id", "type", "read_at", "created_at");

CREATE INDEX "inbox_messages_project_id_created_at_idx"
  ON "inbox_messages"("project_id", "created_at");

CREATE INDEX "inbox_messages_working_paper_id_created_at_idx"
  ON "inbox_messages"("working_paper_id", "created_at");

CREATE INDEX "inbox_messages_review_question_id_created_at_idx"
  ON "inbox_messages"("review_question_id", "created_at");

ALTER TABLE "inbox_messages"
  ADD CONSTRAINT "inbox_messages_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "inbox_messages_working_paper_id_fkey"
    FOREIGN KEY ("working_paper_id") REFERENCES "working_papers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "inbox_messages_review_question_id_fkey"
    FOREIGN KEY ("review_question_id") REFERENCES "working_paper_questions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
