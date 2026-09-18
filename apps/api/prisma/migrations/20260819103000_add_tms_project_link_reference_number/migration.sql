CREATE SEQUENCE IF NOT EXISTS "tms_project_links_reference_number_seq"
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER TABLE "tms_project_links"
  ADD COLUMN "reference_number" INTEGER;

WITH numbered_links AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS reference_number
  FROM "tms_project_links"
)
UPDATE "tms_project_links"
SET "reference_number" = numbered_links.reference_number
FROM numbered_links
WHERE "tms_project_links"."id" = numbered_links."id";

SELECT setval(
  '"tms_project_links_reference_number_seq"',
  GREATEST(
    1,
    COALESCE((SELECT MAX("reference_number") + 1 FROM "tms_project_links"), 1)
  ),
  false
);

ALTER TABLE "tms_project_links"
  ALTER COLUMN "reference_number" SET DEFAULT nextval('"tms_project_links_reference_number_seq"'),
  ALTER COLUMN "reference_number" SET NOT NULL;

ALTER SEQUENCE "tms_project_links_reference_number_seq"
  OWNED BY "tms_project_links"."reference_number";

CREATE UNIQUE INDEX "tms_project_links_reference_number_key"
ON "tms_project_links"("reference_number");
