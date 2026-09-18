CREATE TYPE "TmsApprovalStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'RETURNED');

CREATE TYPE "TmsTimesheetHalf" AS ENUM ('FIRST_HALF', 'SECOND_HALF');

CREATE TABLE "tms_approval_submissions" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "engagement_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "half" "TmsTimesheetHalf" NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "TmsApprovalStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submitted_rows" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "return_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tms_approval_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tms_approval_submissions_owner_user_id_engagement_id_year_month_half_revision_key"
ON "tms_approval_submissions"("owner_user_id", "engagement_id", "year", "month", "half", "revision");

CREATE INDEX "tms_approval_submissions_engagement_id_year_month_half_status_idx"
ON "tms_approval_submissions"("engagement_id", "year", "month", "half", "status");

CREATE INDEX "tms_approval_submissions_owner_user_id_year_month_half_idx"
ON "tms_approval_submissions"("owner_user_id", "year", "month", "half");
