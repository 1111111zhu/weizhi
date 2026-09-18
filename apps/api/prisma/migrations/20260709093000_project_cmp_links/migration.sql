ALTER TABLE "projects" ADD COLUMN "cmp_client_id" TEXT;
ALTER TABLE "projects" ADD COLUMN "cmp_engagement_id" TEXT;

CREATE INDEX "projects_cmp_client_id_idx" ON "projects"("cmp_client_id");
CREATE INDEX "projects_cmp_engagement_id_idx" ON "projects"("cmp_engagement_id");

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_cmp_client_id_fkey"
  FOREIGN KEY ("cmp_client_id") REFERENCES "cmp_clients"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_cmp_engagement_id_fkey"
  FOREIGN KEY ("cmp_engagement_id") REFERENCES "cmp_engagements"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
