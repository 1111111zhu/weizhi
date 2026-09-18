ALTER TABLE "tms_approval_submissions"
ADD COLUMN "project_id" TEXT;

UPDATE "tms_approval_submissions" AS submission
SET "project_id" = project."id"
FROM "projects" AS project
WHERE jsonb_typeof(submission."submitted_rows") = 'array'
  AND jsonb_array_length(submission."submitted_rows") > 0
  AND project."id" = NULLIF(submission."submitted_rows"->0->>'projectId', '');

DROP INDEX "tms_approval_submissions_owner_user_id_engagement_id_year_month_half_revision_key";

CREATE UNIQUE INDEX "tms_approval_submissions_owner_user_id_engagement_id_project_id_year_month_half_revision_key"
ON "tms_approval_submissions"("owner_user_id", "engagement_id", "project_id", "year", "month", "half", "revision");

CREATE INDEX "tms_approval_submissions_project_id_year_month_half_status_idx"
ON "tms_approval_submissions"("project_id", "year", "month", "half", "status");

ALTER TABLE "tms_approval_submissions"
ADD CONSTRAINT "tms_approval_submissions_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
