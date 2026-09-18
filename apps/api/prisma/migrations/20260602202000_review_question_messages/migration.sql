CREATE TYPE "WorkingPaperQuestionMessageType" AS ENUM ('QUESTION', 'REPLY', 'FOLLOW_UP', 'REOPEN');

CREATE TABLE "working_paper_question_messages" (
  "id" TEXT NOT NULL,
  "question_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "message_type" "WorkingPaperQuestionMessageType" NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "working_paper_question_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "working_paper_question_messages_question_id_created_at_idx"
  ON "working_paper_question_messages"("question_id", "created_at");

CREATE INDEX "working_paper_question_messages_author_id_created_at_idx"
  ON "working_paper_question_messages"("author_id", "created_at");

ALTER TABLE "working_paper_question_messages"
  ADD CONSTRAINT "working_paper_question_messages_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "working_paper_questions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "working_paper_question_messages_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "working_paper_question_messages" (
  "id",
  "question_id",
  "author_id",
  "message_type",
  "body",
  "created_at"
)
SELECT
  'qmsg_question_' || md5("id" || ':' || "created_by_id"),
  "id",
  "created_by_id",
  'QUESTION',
  "body",
  "created_at"
FROM "working_paper_questions"
WHERE "body" IS NOT NULL AND length(trim("body")) > 0;

INSERT INTO "working_paper_question_messages" (
  "id",
  "question_id",
  "author_id",
  "message_type",
  "body",
  "created_at"
)
SELECT
  'qmsg_reply_' || md5("id" || ':' || "replied_by_id" || ':' || COALESCE("replied_at"::text, '')),
  "id",
  "replied_by_id",
  'REPLY',
  "reply_body",
  COALESCE("replied_at", "updated_at")
FROM "working_paper_questions"
WHERE "replied_by_id" IS NOT NULL
  AND "reply_body" IS NOT NULL
  AND length(trim("reply_body")) > 0;
