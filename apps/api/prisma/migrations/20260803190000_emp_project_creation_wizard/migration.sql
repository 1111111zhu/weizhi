ALTER TABLE "projects"
  ADD COLUMN "industry_code" TEXT,
  ADD COLUMN "industry_source_text" TEXT,
  ADD COLUMN "audit_area_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "project_template_nodes"
  ADD COLUMN "audit_area_code" TEXT;

CREATE INDEX "project_template_nodes_audit_area_code_idx"
  ON "project_template_nodes"("audit_area_code");
