CREATE TYPE "TmsPendingLinkStatus" AS ENUM ('PENDING_LINK', 'LINKED', 'SUPERSEDED');

CREATE TABLE "tms_pending_link_submissions" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "half" "TmsTimesheetHalf" NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "TmsPendingLinkStatus" NOT NULL DEFAULT 'PENDING_LINK',
    "submitted_rows" JSONB NOT NULL,
    "linked_engagement_id" TEXT,
    "linked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tms_pending_link_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tms_pending_link_submissions_owner_user_id_project_id_year_month_half_revision_key"
ON "tms_pending_link_submissions"("owner_user_id", "project_id", "year", "month", "half", "revision");

CREATE INDEX "tms_pending_link_submissions_project_id_status_idx"
ON "tms_pending_link_submissions"("project_id", "status");

CREATE INDEX "tms_pending_link_submissions_owner_user_id_year_month_half_status_idx"
ON "tms_pending_link_submissions"("owner_user_id", "year", "month", "half", "status");

ALTER TABLE "tms_pending_link_submissions"
ADD CONSTRAINT "tms_pending_link_submissions_owner_user_id_fkey"
FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tms_pending_link_submissions"
ADD CONSTRAINT "tms_pending_link_submissions_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tms_pending_link_submissions"
ADD CONSTRAINT "tms_pending_link_submissions_linked_engagement_id_fkey"
FOREIGN KEY ("linked_engagement_id") REFERENCES "cmp_engagements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
