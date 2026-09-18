CREATE TYPE "TmsProjectLinkStatus" AS ENUM ('PENDING', 'LINKED');

CREATE TABLE "tms_project_links" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "row_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "period_scope" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "project_id" TEXT,
    "status" "TmsProjectLinkStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tms_project_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tms_project_links_owner_user_id_row_id_key"
ON "tms_project_links"("owner_user_id", "row_id");

CREATE INDEX "tms_project_links_status_year_month_idx"
ON "tms_project_links"("status", "year", "month");

CREATE INDEX "tms_project_links_project_id_status_idx"
ON "tms_project_links"("project_id", "status");

ALTER TABLE "tms_project_links"
ADD CONSTRAINT "tms_project_links_owner_user_id_fkey"
FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tms_project_links"
ADD CONSTRAINT "tms_project_links_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
