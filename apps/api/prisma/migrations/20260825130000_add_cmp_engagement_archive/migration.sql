CREATE TABLE "cmp_engagement_archive_drafts" (
  "id" TEXT NOT NULL,
  "engagement_id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "source_updated_at" TIMESTAMP(3) NOT NULL,
  "tms_fingerprint" TEXT NOT NULL,
  "editor_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cmp_engagement_archive_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cmp_engagement_archive_snapshots" (
  "id" TEXT NOT NULL,
  "engagement_id" TEXT NOT NULL,
  "engagement_payload" JSONB NOT NULL,
  "currency" TEXT NOT NULL,
  "budget_cost" DECIMAL(18,2) NOT NULL,
  "actual_cost" DECIMAL(18,2) NOT NULL,
  "tms_fingerprint" TEXT NOT NULL,
  "archived_by_id" TEXT NOT NULL,
  "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cmp_engagement_archive_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cmp_engagement_archive_member_costs" (
  "id" TEXT NOT NULL,
  "snapshot_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "user_name" TEXT NOT NULL,
  "user_email" TEXT NOT NULL,
  "grade" "CmpEngagementFeePlanGrade" NOT NULL,
  "historical" BOOLEAN NOT NULL DEFAULT false,
  "budget_normal" DECIMAL(12,2) NOT NULL,
  "budget_ot" DECIMAL(12,2) NOT NULL,
  "actual_normal" DECIMAL(12,2) NOT NULL,
  "actual_ot" DECIMAL(12,2) NOT NULL,
  "absent" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "hourly_rate" DECIMAL(18,2) NOT NULL,
  "budget_cost" DECIMAL(18,2) NOT NULL,
  "actual_cost" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL,
  CONSTRAINT "cmp_engagement_archive_member_costs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cmp_engagement_archive_drafts_engagement_id_key" ON "cmp_engagement_archive_drafts"("engagement_id");
CREATE INDEX "cmp_engagement_archive_drafts_editor_user_id_updated_at_idx" ON "cmp_engagement_archive_drafts"("editor_user_id", "updated_at");
CREATE UNIQUE INDEX "cmp_engagement_archive_snapshots_engagement_id_key" ON "cmp_engagement_archive_snapshots"("engagement_id");
CREATE INDEX "cmp_engagement_archive_snapshots_archived_at_idx" ON "cmp_engagement_archive_snapshots"("archived_at");
CREATE INDEX "cmp_engagement_archive_member_costs_snapshot_id_sort_order_idx" ON "cmp_engagement_archive_member_costs"("snapshot_id", "sort_order");
CREATE UNIQUE INDEX "cmp_engagement_archive_member_costs_snapshot_id_user_id_key" ON "cmp_engagement_archive_member_costs"("snapshot_id", "user_id");

ALTER TABLE "cmp_engagement_archive_drafts" ADD CONSTRAINT "cmp_engagement_archive_drafts_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "cmp_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cmp_engagement_archive_snapshots" ADD CONSTRAINT "cmp_engagement_archive_snapshots_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "cmp_engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cmp_engagement_archive_member_costs" ADD CONSTRAINT "cmp_engagement_archive_member_costs_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "cmp_engagement_archive_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
