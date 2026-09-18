ALTER TABLE "projects" ADD COLUMN "rolled_forward_from_project_id" TEXT;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_rolled_forward_from_project_id_fkey"
  FOREIGN KEY ("rolled_forward_from_project_id")
  REFERENCES "projects"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "projects_rolled_forward_from_project_id_idx"
  ON "projects"("rolled_forward_from_project_id");
