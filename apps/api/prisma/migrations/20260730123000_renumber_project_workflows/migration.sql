-- Renumber existing project workflow directories and files with the
-- hierarchical numeric scheme:
--   directories: 1000, 1100, 1110, ... and 1-10-10-0 on overflow
--   files:       <directory-code>.1, <directory-code>.2, ...
--
-- The migration keeps human-authored titles and attachment reference codes.
-- It only rewrites attachment codes that still match their generated paper
-- code, while working paper and directory codes are migrated consistently.

BEGIN;

-- The old API may still be serving writes while the new container starts.
-- Block workflow/template mutations for the transaction so no legacy row can
-- arrive after the mapping snapshot and escape this one-time migration.
LOCK TABLE
  "workflow_nodes",
  "working_papers",
  "attachments",
  "project_template_nodes",
  "project_template_files",
  "project_template_smart_forms"
IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE "_projectwing_workflow_node_renumber" ON COMMIT DROP AS
WITH RECURSIVE
"ordered_nodes" AS (
  SELECT
    "node".*,
    ROW_NUMBER() OVER (
      PARTITION BY "node"."project_id", "node"."parent_id"
      ORDER BY "node"."sort_order", "node"."created_at", "node"."id"
    )::INTEGER AS "sibling_ordinal"
  FROM "workflow_nodes" AS "node"
),
"numbered_tree" AS (
  SELECT
    "node"."id",
    "node"."project_id",
    "node"."parent_id",
    "node"."code" AS "old_code",
    "node"."title" AS "old_title",
    ARRAY["node"."sibling_ordinal"] AS "number_path"
  FROM "ordered_nodes" AS "node"
  WHERE "node"."parent_id" IS NULL

  UNION ALL

  SELECT
    "child"."id",
    "child"."project_id",
    "child"."parent_id",
    "child"."code" AS "old_code",
    "child"."title" AS "old_title",
    "parent"."number_path" || "child"."sibling_ordinal"
  FROM "ordered_nodes" AS "child"
  INNER JOIN "numbered_tree" AS "parent"
    ON "parent"."id" = "child"."parent_id"
   AND "parent"."project_id" = "child"."project_id"
)
SELECT
  "tree"."id",
  "tree"."project_id",
  "tree"."parent_id",
  "tree"."old_code",
  "tree"."old_title",
  CASE
    WHEN CARDINALITY("tree"."number_path") <= 4
      AND NOT EXISTS (
        SELECT 1
        FROM UNNEST("tree"."number_path") AS "path_part"("value")
        WHERE "value" < 1 OR "value" > 9
      )
    THEN
      ARRAY_TO_STRING("tree"."number_path", '')
      || REPEAT('0', 4 - CARDINALITY("tree"."number_path"))
    ELSE
      ARRAY_TO_STRING("tree"."number_path", '-')
      || CASE
        WHEN CARDINALITY("tree"."number_path") < 4
        THEN '-' || REPEAT('0', 4 - CARDINALITY("tree"."number_path"))
        ELSE ''
      END
  END AS "new_code"
FROM "numbered_tree" AS "tree";

-- Move every directory through a collision-proof temporary namespace because
-- directory codes are unique among siblings.
UPDATE "workflow_nodes" AS "node"
SET
  "code" = '__projectwing_renumber__' || "node"."id",
  "updated_at" = NOW()
FROM "_projectwing_workflow_node_renumber" AS "mapping"
WHERE "mapping"."id" = "node"."id";

UPDATE "workflow_nodes" AS "node"
SET
  "code" = "mapping"."new_code",
  "title" = CASE
    -- Repair legacy rows where the name and numeric reference were stored in
    -- opposite columns, for example code=A and title=1000.
    WHEN BTRIM("mapping"."old_title") = "mapping"."new_code"
      AND BTRIM("mapping"."old_code") !~ '^(?:[0-9]{1,4}|[0-9]+(?:-[0-9]+)+)$'
    THEN BTRIM("mapping"."old_code")
    ELSE "mapping"."old_title"
  END,
  "updated_at" = NOW()
FROM "_projectwing_workflow_node_renumber" AS "mapping"
WHERE "mapping"."id" = "node"."id";

CREATE TEMP TABLE "_projectwing_working_paper_renumber" ON COMMIT DROP AS
WITH "paper_order" AS (
  SELECT
    "paper"."id",
    "paper"."workflow_node_id",
    "paper"."code" AS "old_code",
    "paper"."title" AS "old_title",
    "node_mapping"."new_code" AS "node_code",
    ROW_NUMBER() OVER (
      PARTITION BY "paper"."workflow_node_id"
      ORDER BY
        CASE "paper"."bucket"::TEXT
          WHEN 'CURRENT' THEN 0
          WHEN 'PRIOR' THEN 1
          ELSE 2
        END,
        COALESCE("attachment_order"."first_sort_order", 2147483647),
        "paper"."created_at",
        "paper"."id"
    )::INTEGER AS "file_ordinal"
  FROM "working_papers" AS "paper"
  INNER JOIN "_projectwing_workflow_node_renumber" AS "node_mapping"
    ON "node_mapping"."id" = "paper"."workflow_node_id"
  LEFT JOIN LATERAL (
    SELECT MIN("attachment"."sort_order") AS "first_sort_order"
    FROM "attachments" AS "attachment"
    WHERE "attachment"."working_paper_id" = "paper"."id"
      AND "attachment"."deleted_at" IS NULL
  ) AS "attachment_order" ON TRUE
  WHERE "paper"."bucket"::TEXT <> 'TEMPORARY'
)
SELECT
  "paper_order"."id",
  "paper_order"."workflow_node_id",
  "paper_order"."old_code",
  "paper_order"."old_title",
  "paper_order"."node_code"
    || '.'
    || "paper_order"."file_ordinal"::TEXT AS "new_code"
FROM "paper_order";

-- Update active attachment identity while the old paper codes are still
-- available in the mapping. Explicit user-authored attachment codes survive.
UPDATE "attachments" AS "attachment"
SET
  "code" = CASE
    WHEN "attachment"."code" IS NULL
      OR BTRIM("attachment"."code") = BTRIM("mapping"."old_code")
    THEN "mapping"."new_code"
    ELSE "attachment"."code"
  END,
  "title" = CASE
    WHEN "attachment"."title" = "mapping"."old_code"
    THEN "mapping"."new_code"
    ELSE "attachment"."title"
  END,
  "updated_at" = NOW()
FROM "_projectwing_working_paper_renumber" AS "mapping"
WHERE "attachment"."working_paper_id" = "mapping"."id";

-- Deleted attachments retain the former paper id as a non-FK snapshot. When
-- that paper still exists, keep the recycle-bin reference aligned with it.
UPDATE "attachments" AS "attachment"
SET
  "code" = CASE
    WHEN "attachment"."code" IS NULL
      OR BTRIM("attachment"."code") = BTRIM("mapping"."old_code")
    THEN "mapping"."new_code"
    ELSE "attachment"."code"
  END,
  "deleted_from_working_paper_code" = "mapping"."new_code",
  "deleted_from_working_paper_title" = CASE
    WHEN "attachment"."deleted_from_working_paper_title" = "mapping"."old_code"
    THEN "mapping"."new_code"
    ELSE "attachment"."deleted_from_working_paper_title"
  END,
  "updated_at" = NOW()
FROM "_projectwing_working_paper_renumber" AS "mapping"
WHERE "attachment"."deleted_at" IS NOT NULL
  AND "attachment"."deleted_from_working_paper_id" = "mapping"."id";

-- If a deleted file's paper no longer exists but its directory does, allocate
-- it after the live papers in that directory so the recycle-bin snapshot also
-- follows the new scheme without colliding with a live file.
CREATE TEMP TABLE "_projectwing_deleted_attachment_renumber" ON COMMIT DROP AS
WITH "live_counts" AS (
  SELECT
    "mapping"."workflow_node_id",
    COUNT(*)::INTEGER AS "live_count"
  FROM "_projectwing_working_paper_renumber" AS "mapping"
  GROUP BY "mapping"."workflow_node_id"
),
"deleted_order" AS (
  SELECT
    "attachment"."id",
    "node_mapping"."id" AS "workflow_node_id",
    "node_mapping"."new_code" AS "node_code",
    COALESCE("live_counts"."live_count", 0)
      + ROW_NUMBER() OVER (
          PARTITION BY "node_mapping"."id"
          ORDER BY
            "attachment"."deleted_at",
            "attachment"."created_at",
            "attachment"."id"
        )::INTEGER AS "file_ordinal"
  FROM "attachments" AS "attachment"
  INNER JOIN "_projectwing_workflow_node_renumber" AS "node_mapping"
    ON "node_mapping"."id" = "attachment"."deleted_from_workflow_node_id"
  LEFT JOIN "live_counts"
    ON "live_counts"."workflow_node_id" = "node_mapping"."id"
  WHERE "attachment"."deleted_at" IS NOT NULL
    AND "attachment"."working_paper_id" IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "_projectwing_working_paper_renumber" AS "paper_mapping"
      WHERE "paper_mapping"."id" =
        "attachment"."deleted_from_working_paper_id"
    )
)
SELECT
  "deleted_order"."id",
  "deleted_order"."node_code"
    || '.'
    || "deleted_order"."file_ordinal"::TEXT AS "new_code"
FROM "deleted_order";

UPDATE "attachments" AS "attachment"
SET
  "code" = CASE
    WHEN "attachment"."code" IS NULL
      OR BTRIM("attachment"."code") = BTRIM(
        "attachment"."deleted_from_working_paper_code"
      )
    THEN "mapping"."new_code"
    ELSE "attachment"."code"
  END,
  "deleted_from_working_paper_code" = "mapping"."new_code",
  "updated_at" = NOW()
FROM "_projectwing_deleted_attachment_renumber" AS "mapping"
WHERE "mapping"."id" = "attachment"."id";

-- Working paper codes are unique within a directory, so use the same
-- temporary-namespace strategy before applying the final numeric sequence.
UPDATE "working_papers" AS "paper"
SET
  "code" = '__projectwing_renumber__' || "paper"."id",
  "updated_at" = NOW()
FROM "_projectwing_working_paper_renumber" AS "mapping"
WHERE "mapping"."id" = "paper"."id";

UPDATE "working_papers" AS "paper"
SET
  "code" = "mapping"."new_code",
  "title" = CASE
    WHEN "mapping"."old_title" = "mapping"."old_code"
    THEN "mapping"."new_code"
    ELSE "mapping"."old_title"
  END,
  "updated_at" = NOW()
FROM "_projectwing_working_paper_renumber" AS "mapping"
WHERE "mapping"."id" = "paper"."id";

-- Existing project templates are also persistent database content. Renumber
-- them in the same deployment so projects created after this migration do not
-- clone the retired A/A1/-F001 scheme back into the live workflow.
CREATE TEMP TABLE "_projectwing_template_node_renumber" ON COMMIT DROP AS
WITH RECURSIVE
"ordered_template_nodes" AS (
  SELECT
    "node".*,
    ROW_NUMBER() OVER (
      PARTITION BY "node"."project_template_id", "node"."parent_id"
      ORDER BY "node"."sort_order", "node"."created_at", "node"."id"
    )::INTEGER AS "sibling_ordinal"
  FROM "project_template_nodes" AS "node"
),
"numbered_template_tree" AS (
  SELECT
    "node"."id",
    "node"."project_template_id",
    "node"."parent_id",
    "node"."code" AS "old_code",
    "node"."title" AS "old_title",
    ARRAY["node"."sibling_ordinal"] AS "number_path"
  FROM "ordered_template_nodes" AS "node"
  WHERE "node"."parent_id" IS NULL

  UNION ALL

  SELECT
    "child"."id",
    "child"."project_template_id",
    "child"."parent_id",
    "child"."code" AS "old_code",
    "child"."title" AS "old_title",
    "parent"."number_path" || "child"."sibling_ordinal"
  FROM "ordered_template_nodes" AS "child"
  INNER JOIN "numbered_template_tree" AS "parent"
    ON "parent"."id" = "child"."parent_id"
   AND "parent"."project_template_id" = "child"."project_template_id"
)
SELECT
  "tree"."id",
  "tree"."project_template_id",
  "tree"."parent_id",
  "tree"."old_code",
  "tree"."old_title",
  CASE
    WHEN CARDINALITY("tree"."number_path") <= 4
      AND NOT EXISTS (
        SELECT 1
        FROM UNNEST("tree"."number_path") AS "path_part"("value")
        WHERE "value" < 1 OR "value" > 9
      )
    THEN
      ARRAY_TO_STRING("tree"."number_path", '')
      || REPEAT('0', 4 - CARDINALITY("tree"."number_path"))
    ELSE
      ARRAY_TO_STRING("tree"."number_path", '-')
      || CASE
        WHEN CARDINALITY("tree"."number_path") < 4
        THEN '-' || REPEAT('0', 4 - CARDINALITY("tree"."number_path"))
        ELSE ''
      END
  END AS "new_code"
FROM "numbered_template_tree" AS "tree";

UPDATE "project_template_nodes" AS "node"
SET
  "code" = '__projectwing_renumber__' || "node"."id",
  "updated_at" = NOW()
FROM "_projectwing_template_node_renumber" AS "mapping"
WHERE "mapping"."id" = "node"."id";

UPDATE "project_template_nodes" AS "node"
SET
  "code" = "mapping"."new_code",
  "title" = CASE
    WHEN BTRIM("mapping"."old_title") = "mapping"."new_code"
      AND BTRIM("mapping"."old_code") !~ '^(?:[0-9]{1,4}|[0-9]+(?:-[0-9]+)+)$'
    THEN BTRIM("mapping"."old_code")
    ELSE "mapping"."old_title"
  END,
  "updated_at" = NOW()
FROM "_projectwing_template_node_renumber" AS "mapping"
WHERE "mapping"."id" = "node"."id";

CREATE TEMP TABLE "_projectwing_template_item_renumber" ON COMMIT DROP AS
WITH
"template_items" AS (
  SELECT
    'FILE'::TEXT AS "item_type",
    "file"."id",
    "file"."template_node_id",
    "file"."code" AS "old_code",
    "file"."title" AS "old_title",
    "file"."sort_order",
    "file"."created_at"
  FROM "project_template_files" AS "file"

  UNION ALL

  SELECT
    'SMART_FORM'::TEXT AS "item_type",
    "smart_form"."id",
    "smart_form"."template_node_id",
    "smart_form"."code" AS "old_code",
    "smart_form"."title" AS "old_title",
    "smart_form"."sort_order",
    "smart_form"."created_at"
  FROM "project_template_smart_forms" AS "smart_form"
),
"numbered_items" AS (
  SELECT
    "item".*,
    "node_mapping"."new_code" AS "node_code",
    ROW_NUMBER() OVER (
      PARTITION BY "item"."template_node_id"
      ORDER BY
        "item"."sort_order",
        "item"."created_at",
        "item"."item_type",
        "item"."id"
    )::INTEGER AS "file_ordinal"
  FROM "template_items" AS "item"
  INNER JOIN "_projectwing_template_node_renumber" AS "node_mapping"
    ON "node_mapping"."id" = "item"."template_node_id"
)
SELECT
  "item_type",
  "id",
  "template_node_id",
  "old_code",
  "old_title",
  "node_code" || '.' || "file_ordinal"::TEXT AS "new_code"
FROM "numbered_items";

UPDATE "project_template_files" AS "file"
SET
  "code" = '__projectwing_renumber__' || "file"."id",
  "updated_at" = NOW()
FROM "_projectwing_template_item_renumber" AS "mapping"
WHERE "mapping"."item_type" = 'FILE'
  AND "mapping"."id" = "file"."id";

UPDATE "project_template_files" AS "file"
SET
  "code" = "mapping"."new_code",
  "title" = CASE
    WHEN "mapping"."old_title" = "mapping"."old_code"
    THEN "mapping"."new_code"
    ELSE "mapping"."old_title"
  END,
  "updated_at" = NOW()
FROM "_projectwing_template_item_renumber" AS "mapping"
WHERE "mapping"."item_type" = 'FILE'
  AND "mapping"."id" = "file"."id";

UPDATE "project_template_smart_forms" AS "smart_form"
SET
  "code" = '__projectwing_renumber__' || "smart_form"."id",
  "updated_at" = NOW()
FROM "_projectwing_template_item_renumber" AS "mapping"
WHERE "mapping"."item_type" = 'SMART_FORM'
  AND "mapping"."id" = "smart_form"."id";

UPDATE "project_template_smart_forms" AS "smart_form"
SET
  "code" = "mapping"."new_code",
  "title" = CASE
    WHEN "mapping"."old_title" = "mapping"."old_code"
    THEN "mapping"."new_code"
    ELSE "mapping"."old_title"
  END,
  "updated_at" = NOW()
FROM "_projectwing_template_item_renumber" AS "mapping"
WHERE "mapping"."item_type" = 'SMART_FORM'
  AND "mapping"."id" = "smart_form"."id";

COMMIT;
