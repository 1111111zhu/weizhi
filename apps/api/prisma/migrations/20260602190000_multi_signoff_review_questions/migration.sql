CREATE TYPE "WorkingPaperSignoffType" AS ENUM ('PREPARER', 'REVIEWER');
CREATE TYPE "ReviewQuestionStatus" AS ENUM ('OPEN', 'REPLIED', 'CLEARED');

CREATE TABLE "working_paper_signoffs" (
  "id" TEXT NOT NULL,
  "working_paper_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "WorkingPaperSignoffType" NOT NULL,
  "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "working_paper_signoffs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "working_paper_questions" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "working_paper_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "ReviewQuestionStatus" NOT NULL DEFAULT 'OPEN',
  "assigned_to_id" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "replied_by_id" TEXT,
  "reply_body" TEXT,
  "replied_at" TIMESTAMP(3),
  "cleared_by_id" TEXT,
  "cleared_at" TIMESTAMP(3),
  "reopened_by_id" TEXT,
  "reopened_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "working_paper_questions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "working_paper_signoffs_working_paper_id_user_id_type_key"
  ON "working_paper_signoffs"("working_paper_id", "user_id", "type");

CREATE INDEX "working_paper_signoffs_working_paper_id_signed_at_idx"
  ON "working_paper_signoffs"("working_paper_id", "signed_at");

CREATE INDEX "working_paper_questions_project_id_working_paper_id_status_idx"
  ON "working_paper_questions"("project_id", "working_paper_id", "status");

CREATE INDEX "working_paper_questions_assigned_to_id_status_idx"
  ON "working_paper_questions"("assigned_to_id", "status");

ALTER TABLE "working_paper_signoffs"
  ADD CONSTRAINT "working_paper_signoffs_working_paper_id_fkey"
    FOREIGN KEY ("working_paper_id") REFERENCES "working_papers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "working_paper_signoffs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "working_paper_questions"
  ADD CONSTRAINT "working_paper_questions_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "working_paper_questions_working_paper_id_fkey"
    FOREIGN KEY ("working_paper_id") REFERENCES "working_papers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "working_paper_questions_assigned_to_id_fkey"
    FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "working_paper_questions_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "working_paper_questions_replied_by_id_fkey"
    FOREIGN KEY ("replied_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "working_paper_questions_cleared_by_id_fkey"
    FOREIGN KEY ("cleared_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "working_paper_questions_reopened_by_id_fkey"
    FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "working_paper_signoffs" (
  "id",
  "working_paper_id",
  "user_id",
  "type",
  "signed_at",
  "created_at"
)
SELECT
  'signoff_preparer_' || md5("id" || ':' || "preparer_id"),
  "id",
  "preparer_id",
  'PREPARER',
  COALESCE("prepared_at", "updated_at"),
  COALESCE("prepared_at", "updated_at")
FROM "working_papers"
WHERE "preparer_id" IS NOT NULL
ON CONFLICT ("working_paper_id", "user_id", "type") DO NOTHING;

INSERT INTO "working_paper_signoffs" (
  "id",
  "working_paper_id",
  "user_id",
  "type",
  "signed_at",
  "created_at"
)
SELECT
  'signoff_reviewer_' || md5("id" || ':' || "reviewer_id"),
  "id",
  "reviewer_id",
  'REVIEWER',
  COALESCE("reviewed_at", "updated_at"),
  COALESCE("reviewed_at", "updated_at")
FROM "working_papers"
WHERE "reviewer_id" IS NOT NULL
ON CONFLICT ("working_paper_id", "user_id", "type") DO NOTHING;

ALTER TABLE "working_paper_questions"
  ALTER COLUMN "updated_at" DROP DEFAULT;
