CREATE TYPE "CmpEngagementArchiveWorkflowStatus" AS ENUM ('DRAFT', 'PENDING_PIC', 'RETURNED');

ALTER TABLE "cmp_engagement_archive_drafts"
  ADD COLUMN "workflow_status" "CmpEngagementArchiveWorkflowStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "submitted_by_id" TEXT,
  ADD COLUMN "submitted_at" TIMESTAMP(3),
  ADD COLUMN "returned_by_id" TEXT,
  ADD COLUMN "returned_at" TIMESTAMP(3),
  ADD COLUMN "return_reason" TEXT,
  ADD COLUMN "override_reason" TEXT;

CREATE INDEX "cmp_engagement_archive_drafts_workflow_status_updated_at_idx"
  ON "cmp_engagement_archive_drafts"("workflow_status", "updated_at");

ALTER TABLE "cmp_engagement_archive_snapshots"
  ADD COLUMN "workflow_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "prepared_by_id" TEXT,
  ADD COLUMN "submitted_at" TIMESTAMP(3),
  ADD COLUMN "approved_by_id" TEXT,
  ADD COLUMN "approval_note" TEXT,
  ADD COLUMN "acknowledged_warnings" JSONB NOT NULL DEFAULT '[]';
