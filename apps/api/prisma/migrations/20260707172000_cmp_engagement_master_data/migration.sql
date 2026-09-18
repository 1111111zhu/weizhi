ALTER TYPE "CmpMasterStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "CmpMasterStatus" ADD VALUE IF NOT EXISTS 'PROSPECT';
ALTER TYPE "CmpMasterStatus" ADD VALUE IF NOT EXISTS 'LEAD';
ALTER TYPE "CmpMasterStatus" ADD VALUE IF NOT EXISTS 'FILES_ARCHIVED';

CREATE TYPE "CmpEngagementServiceType" AS ENUM ('AUDIT', 'TAX', 'RISK', 'ACCOUNTING', 'COM_SEC', 'OTHERS');

CREATE TYPE "CmpEngagementStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'COMPLETED', 'ARCHIVED');

CREATE TABLE "cmp_engagements" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "engagement_code" TEXT NOT NULL,
    "engagement_name" TEXT NOT NULL,
    "service_type" "CmpEngagementServiceType" NOT NULL,
    "year_end_date" TIMESTAMP(3),
    "report_date" TIMESTAMP(3),
    "approval_reference_number" TEXT,
    "approval_date" TIMESTAMP(3),
    "pic" TEXT,
    "mic" TEXT,
    "status" "CmpEngagementStatus" NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cmp_engagements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cmp_engagements_engagement_code_key" ON "cmp_engagements"("engagement_code");
CREATE INDEX "cmp_engagements_client_id_status_idx" ON "cmp_engagements"("client_id", "status");
CREATE INDEX "cmp_engagements_status_engagement_code_idx" ON "cmp_engagements"("status", "engagement_code");
CREATE INDEX "cmp_engagements_service_type_status_idx" ON "cmp_engagements"("service_type", "status");
CREATE INDEX "cmp_engagements_pic_idx" ON "cmp_engagements"("pic");
CREATE INDEX "cmp_engagements_mic_idx" ON "cmp_engagements"("mic");

ALTER TABLE "cmp_engagements" ADD CONSTRAINT "cmp_engagements_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "cmp_clients"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
