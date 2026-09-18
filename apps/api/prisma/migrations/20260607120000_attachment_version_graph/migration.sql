ALTER TABLE "attachments"
ADD COLUMN "head_version_id" TEXT;

ALTER TABLE "attachment_versions"
ADD COLUMN "parent_version_id" TEXT,
ADD COLUMN "source_version_id" TEXT,
ADD COLUMN "action" TEXT NOT NULL DEFAULT 'UPLOAD',
ADD COLUMN "message" TEXT,
ADD COLUMN "is_current" BOOLEAN NOT NULL DEFAULT false;

WITH ordered_versions AS (
  SELECT
    "id",
    LAG("id") OVER (
      PARTITION BY "attachment_id"
      ORDER BY "version" ASC, "created_at" ASC, "id" ASC
    ) AS "parent_version_id"
  FROM "attachment_versions"
)
UPDATE "attachment_versions" AS version
SET "parent_version_id" = ordered_versions."parent_version_id"
FROM ordered_versions
WHERE version."id" = ordered_versions."id";

INSERT INTO "attachment_versions" (
  "id",
  "attachment_id",
  "project_id",
  "version",
  "parent_version_id",
  "source_version_id",
  "file_kind",
  "file_name",
  "original_name",
  "file_url",
  "file_size",
  "mime_type",
  "work_date",
  "uploaded_by",
  "uploaded_at",
  "archived_by",
  "action",
  "message",
  "is_current",
  "created_at"
)
SELECT
  'attachment_version_head_' || MD5(attachment."id" || ':' || attachment."version"::TEXT),
  attachment."id",
  attachment."project_id",
  attachment."version",
  (
    SELECT previous_version."id"
    FROM "attachment_versions" AS previous_version
    WHERE previous_version."attachment_id" = attachment."id"
      AND previous_version."version" < attachment."version"
    ORDER BY previous_version."version" DESC, previous_version."created_at" DESC, previous_version."id" DESC
    LIMIT 1
  ),
  NULL,
  attachment."file_kind",
  attachment."file_name",
  attachment."original_name",
  attachment."file_url",
  attachment."file_size",
  attachment."mime_type",
  attachment."work_date",
  COALESCE(attachment."last_modified_by", attachment."uploaded_by"),
  COALESCE(attachment."last_modified_at", attachment."created_at", CURRENT_TIMESTAMP),
  COALESCE(attachment."last_modified_by", attachment."uploaded_by"),
  'MIGRATION',
  'Imported current attachment state',
  true,
  COALESCE(attachment."last_modified_at", attachment."created_at", CURRENT_TIMESTAMP)
FROM "attachments" AS attachment
WHERE NOT EXISTS (
  SELECT 1
  FROM "attachment_versions" AS existing_version
  WHERE existing_version."attachment_id" = attachment."id"
    AND existing_version."version" = attachment."version"
);

WITH current_heads AS (
  SELECT
    attachment."id" AS "attachment_id",
    head_version."id" AS "version_id"
  FROM "attachments" AS attachment
  JOIN LATERAL (
    SELECT version."id"
    FROM "attachment_versions" AS version
    WHERE version."attachment_id" = attachment."id"
    ORDER BY
      CASE WHEN version."version" = attachment."version" THEN 0 ELSE 1 END ASC,
      version."version" DESC,
      version."created_at" DESC,
      version."id" DESC
    LIMIT 1
  ) AS head_version ON true
)
UPDATE "attachment_versions" AS version
SET "is_current" = true
FROM current_heads
WHERE version."id" = current_heads."version_id";

WITH current_heads AS (
  SELECT
    attachment."id" AS "attachment_id",
    head_version."id" AS "version_id"
  FROM "attachments" AS attachment
  JOIN LATERAL (
    SELECT version."id"
    FROM "attachment_versions" AS version
    WHERE version."attachment_id" = attachment."id"
    ORDER BY
      CASE WHEN version."version" = attachment."version" THEN 0 ELSE 1 END ASC,
      version."version" DESC,
      version."created_at" DESC,
      version."id" DESC
    LIMIT 1
  ) AS head_version ON true
)
UPDATE "attachments" AS attachment
SET "head_version_id" = current_heads."version_id"
FROM current_heads
WHERE attachment."id" = current_heads."attachment_id";

CREATE UNIQUE INDEX "attachments_head_version_id_key"
ON "attachments"("head_version_id");

CREATE INDEX "attachment_versions_attachment_id_parent_version_id_idx"
ON "attachment_versions"("attachment_id", "parent_version_id");

CREATE INDEX "attachment_versions_attachment_id_is_current_idx"
ON "attachment_versions"("attachment_id", "is_current");

CREATE INDEX "attachment_versions_source_version_id_idx"
ON "attachment_versions"("source_version_id");

ALTER TABLE "attachments"
ADD CONSTRAINT "attachments_head_version_id_fkey"
FOREIGN KEY ("head_version_id") REFERENCES "attachment_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attachment_versions"
ADD CONSTRAINT "attachment_versions_parent_version_id_fkey"
FOREIGN KEY ("parent_version_id") REFERENCES "attachment_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attachment_versions"
ADD CONSTRAINT "attachment_versions_source_version_id_fkey"
FOREIGN KEY ("source_version_id") REFERENCES "attachment_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
