ALTER TABLE "working_paper_questions"
  ALTER COLUMN "assigned_to_id" DROP NOT NULL;

ALTER TABLE "working_paper_questions"
  DROP CONSTRAINT "working_paper_questions_assigned_to_id_fkey";

ALTER TABLE "working_paper_questions"
  ADD CONSTRAINT "working_paper_questions_assigned_to_id_fkey"
    FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
