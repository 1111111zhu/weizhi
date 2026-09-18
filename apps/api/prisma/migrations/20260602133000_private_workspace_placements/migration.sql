CREATE TABLE "project_workspace_placements" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "project_workspace_placements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_workspace_placements_user_id_project_id_key"
  ON "project_workspace_placements"("user_id", "project_id");

CREATE INDEX "project_workspace_placements_workspace_id_idx"
  ON "project_workspace_placements"("workspace_id");

ALTER TABLE "project_workspace_placements"
  ADD CONSTRAINT "project_workspace_placements_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_workspace_placements_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_workspace_placements_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "workspaces" (
  "id",
  "name",
  "client_name",
  "description",
  "owner_id",
  "created_at",
  "updated_at"
)
SELECT
  'workspace_auto_' || user_row."id",
  '我的项目',
  user_row."name",
  '系统为既有项目成员自动创建的私人收纳空间',
  user_row."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" AS user_row
WHERE EXISTS (
  SELECT 1
  FROM "project_members" AS member
  WHERE member."user_id" = user_row."id"
    AND member."status" = 'ACTIVE'
)
AND NOT EXISTS (
  SELECT 1
  FROM "workspaces" AS workspace
  WHERE workspace."owner_id" = user_row."id"
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "project_workspace_placements" (
  "id",
  "user_id",
  "project_id",
  "workspace_id",
  "created_at",
  "updated_at"
)
SELECT
  'placement_' || md5(member."user_id" || ':' || member."project_id"),
  member."user_id",
  member."project_id",
  (
    SELECT workspace."id"
    FROM "workspaces" AS workspace
    WHERE workspace."owner_id" = member."user_id"
    ORDER BY
      CASE WHEN workspace."id" = project."workspace_id" THEN 0 ELSE 1 END,
      workspace."created_at"
    LIMIT 1
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "project_members" AS member
JOIN "projects" AS project ON project."id" = member."project_id"
WHERE member."status" = 'ACTIVE'
ON CONFLICT ("user_id", "project_id") DO NOTHING;

ALTER TABLE "project_workspace_placements"
  ALTER COLUMN "updated_at" DROP DEFAULT;
