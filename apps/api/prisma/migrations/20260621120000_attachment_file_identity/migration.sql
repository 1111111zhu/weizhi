ALTER TABLE "attachments"
  ADD COLUMN "workflow_node_id" TEXT,
  ADD COLUMN "bucket" "WorkingPaperBucket" NOT NULL DEFAULT 'CURRENT',
  ADD COLUMN "code" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "preparer_id" TEXT,
  ADD COLUMN "reviewer_id" TEXT,
  ADD COLUMN "prepared_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "returned_at" TIMESTAMP(3),
  ADD COLUMN "review_note" TEXT,
  ADD COLUMN "template_item_id" TEXT;

WITH ranked_attachments AS (
  SELECT
    attachment."id",
    paper."workflow_node_id",
    paper."bucket",
    paper."code",
    paper."title",
    paper."preparer_id",
    paper."reviewer_id",
    paper."prepared_at",
    paper."reviewed_at",
    paper."returned_at",
    paper."review_note",
    paper."template_item_id",
    ROW_NUMBER() OVER (
      PARTITION BY paper."id"
      ORDER BY
        CASE WHEN attachment."deleted_at" IS NULL THEN 0 ELSE 1 END,
        attachment."created_at",
        attachment."id"
    ) AS paper_attachment_rank
  FROM "attachments" AS attachment
  JOIN "working_papers" AS paper ON paper."id" = attachment."working_paper_id"
)
UPDATE "attachments" AS attachment
SET
  "workflow_node_id" = ranked."workflow_node_id",
  "bucket" = ranked."bucket",
  "code" = CASE
    WHEN ranked."paper_attachment_rank" = 1 THEN ranked."code"
    ELSE CONCAT(ranked."code", '-', ranked."paper_attachment_rank"::text)
  END,
  "title" = COALESCE(NULLIF(attachment."original_name", ''), NULLIF(attachment."file_name", ''), ranked."title"),
  "preparer_id" = CASE WHEN ranked."paper_attachment_rank" = 1 THEN ranked."preparer_id" ELSE NULL END,
  "reviewer_id" = CASE WHEN ranked."paper_attachment_rank" = 1 THEN ranked."reviewer_id" ELSE NULL END,
  "prepared_at" = CASE WHEN ranked."paper_attachment_rank" = 1 THEN ranked."prepared_at" ELSE NULL END,
  "reviewed_at" = CASE WHEN ranked."paper_attachment_rank" = 1 THEN ranked."reviewed_at" ELSE NULL END,
  "returned_at" = CASE WHEN ranked."paper_attachment_rank" = 1 THEN ranked."returned_at" ELSE NULL END,
  "review_note" = CASE WHEN ranked."paper_attachment_rank" = 1 THEN ranked."review_note" ELSE NULL END,
  "template_item_id" = CASE WHEN ranked."paper_attachment_rank" = 1 THEN ranked."template_item_id" ELSE NULL END
FROM ranked_attachments AS ranked
WHERE ranked."id" = attachment."id";

ALTER TABLE "working_paper_signoffs"
  ADD COLUMN "attachment_id" TEXT;

ALTER TABLE "working_paper_questions"
  ADD COLUMN "attachment_id" TEXT;

ALTER TABLE "inbox_messages"
  ADD COLUMN "attachment_id" TEXT;

WITH first_attachment AS (
  SELECT DISTINCT ON ("working_paper_id")
    "id",
    "working_paper_id"
  FROM "attachments"
  WHERE "working_paper_id" IS NOT NULL
  ORDER BY
    "working_paper_id",
    CASE WHEN "deleted_at" IS NULL THEN 0 ELSE 1 END,
    "created_at",
    "id"
)
UPDATE "working_paper_signoffs" AS signoff
SET "attachment_id" = first_attachment."id"
FROM first_attachment
WHERE first_attachment."working_paper_id" = signoff."working_paper_id";

WITH first_attachment AS (
  SELECT DISTINCT ON ("working_paper_id")
    "id",
    "working_paper_id"
  FROM "attachments"
  WHERE "working_paper_id" IS NOT NULL
  ORDER BY
    "working_paper_id",
    CASE WHEN "deleted_at" IS NULL THEN 0 ELSE 1 END,
    "created_at",
    "id"
)
UPDATE "working_paper_questions" AS question
SET "attachment_id" = first_attachment."id"
FROM first_attachment
WHERE first_attachment."working_paper_id" = question."working_paper_id";

WITH first_attachment AS (
  SELECT DISTINCT ON ("working_paper_id")
    "id",
    "working_paper_id"
  FROM "attachments"
  WHERE "working_paper_id" IS NOT NULL
  ORDER BY
    "working_paper_id",
    CASE WHEN "deleted_at" IS NULL THEN 0 ELSE 1 END,
    "created_at",
    "id"
)
UPDATE "inbox_messages" AS message
SET "attachment_id" = first_attachment."id"
FROM first_attachment
WHERE first_attachment."working_paper_id" = message."working_paper_id";

CREATE INDEX "attachments_workflow_node_id_bucket_idx"
  ON "attachments"("workflow_node_id", "bucket");

CREATE INDEX "attachments_template_item_id_idx"
  ON "attachments"("template_item_id");

CREATE UNIQUE INDEX "working_paper_signoffs_attachment_id_user_id_type_key"
  ON "working_paper_signoffs"("attachment_id", "user_id", "type");

CREATE INDEX "working_paper_signoffs_attachment_id_signed_at_idx"
  ON "working_paper_signoffs"("attachment_id", "signed_at");

CREATE INDEX "working_paper_questions_project_id_attachment_id_status_idx"
  ON "working_paper_questions"("project_id", "attachment_id", "status");

CREATE INDEX "inbox_messages_attachment_id_created_at_idx"
  ON "inbox_messages"("attachment_id", "created_at");

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_workflow_node_id_fkey"
    FOREIGN KEY ("workflow_node_id") REFERENCES "workflow_nodes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "attachments_template_item_id_fkey"
    FOREIGN KEY ("template_item_id") REFERENCES "workpaper_template_items"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "attachments_preparer_id_fkey"
    FOREIGN KEY ("preparer_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "attachments_reviewer_id_fkey"
    FOREIGN KEY ("reviewer_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "working_paper_signoffs"
  ADD CONSTRAINT "working_paper_signoffs_attachment_id_fkey"
    FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "working_paper_questions"
  ADD CONSTRAINT "working_paper_questions_attachment_id_fkey"
    FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inbox_messages"
  ADD CONSTRAINT "inbox_messages_attachment_id_fkey"
    FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
