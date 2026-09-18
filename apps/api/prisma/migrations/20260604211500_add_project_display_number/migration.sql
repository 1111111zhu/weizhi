CREATE SEQUENCE IF NOT EXISTS "projects_project_number_seq"
  START WITH 1000000
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER TABLE "projects"
  ADD COLUMN "project_number" INTEGER;

WITH numbered_projects AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "created_at", "id") - 1 AS offset
  FROM "projects"
)
UPDATE "projects"
SET "project_number" = 1000000 + numbered_projects.offset
FROM numbered_projects
WHERE "projects"."id" = numbered_projects."id";

SELECT setval(
  '"projects_project_number_seq"',
  GREATEST(
    1000000,
    COALESCE((SELECT MAX("project_number") + 1 FROM "projects"), 1000000)
  ),
  false
);

ALTER TABLE "projects"
  ALTER COLUMN "project_number" SET DEFAULT nextval('"projects_project_number_seq"'),
  ALTER COLUMN "project_number" SET NOT NULL;

ALTER SEQUENCE "projects_project_number_seq" OWNED BY "projects"."project_number";

CREATE UNIQUE INDEX "projects_project_number_key" ON "projects"("project_number");
