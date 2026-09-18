ALTER TABLE "cmp_acceptance_requests"
  ALTER COLUMN "pic_approver_id" DROP NOT NULL,
  ALTER COLUMN "it_approver_id" DROP NOT NULL,
  ADD COLUMN "workflow_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "draft_assignee_id" TEXT,
ADD COLUMN "draft_completed_at" TIMESTAMP(3),
ADD COLUMN "draft_completed_by_id" TEXT,
ADD COLUMN "returned_from_step" "CmpAcceptanceStep",
ADD COLUMN "pic_approved_at" TIMESTAMP(3);

CREATE INDEX "cmp_acceptance_requests_draft_assignee_id_status_idx"
ON "cmp_acceptance_requests"("draft_assignee_id", "status");

ALTER TABLE "cmp_acceptance_requests"
ADD CONSTRAINT "cmp_acceptance_requests_draft_assignee_id_fkey"
FOREIGN KEY ("draft_assignee_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cmp_acceptance_requests"
ADD CONSTRAINT "cmp_acceptance_requests_draft_completed_by_id_fkey"
FOREIGN KEY ("draft_completed_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
