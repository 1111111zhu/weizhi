CREATE TYPE "TmsTimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');

CREATE TABLE "tms_timesheet_months" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "draft_rows" JSONB NOT NULL DEFAULT '[]',
    "first_status" "TmsTimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "first_submitted_revision" INTEGER NOT NULL DEFAULT 0,
    "first_submitted_rows" JSONB,
    "first_approved_by_id" TEXT,
    "first_approved_at" TIMESTAMP(3),
    "second_status" "TmsTimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "second_submitted_revision" INTEGER NOT NULL DEFAULT 0,
    "second_submitted_rows" JSONB,
    "second_approved_by_id" TEXT,
    "second_approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tms_timesheet_months_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tms_timesheet_months_user_id_year_month_key"
ON "tms_timesheet_months"("user_id", "year", "month");

CREATE INDEX "tms_timesheet_months_year_month_first_status_second_status_idx"
ON "tms_timesheet_months"("year", "month", "first_status", "second_status");

ALTER TABLE "tms_timesheet_months"
ADD CONSTRAINT "tms_timesheet_months_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
