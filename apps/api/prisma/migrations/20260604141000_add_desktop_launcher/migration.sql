CREATE TABLE "desktop_folders" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "desktop_folders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "desktop_project_placements" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "folder_id" TEXT NOT NULL,
  "desktop_x" INTEGER NOT NULL DEFAULT 0,
  "desktop_y" INTEGER NOT NULL DEFAULT 0,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "last_opened_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "desktop_project_placements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "desktop_folders_owner_id_name_key"
  ON "desktop_folders"("owner_id", "name");

CREATE INDEX "desktop_folders_owner_id_sort_order_idx"
  ON "desktop_folders"("owner_id", "sort_order");

CREATE UNIQUE INDEX "desktop_project_placements_user_id_project_id_key"
  ON "desktop_project_placements"("user_id", "project_id");

CREATE INDEX "desktop_project_placements_user_id_folder_id_idx"
  ON "desktop_project_placements"("user_id", "folder_id");

CREATE INDEX "desktop_project_placements_folder_id_sort_order_idx"
  ON "desktop_project_placements"("folder_id", "sort_order");

ALTER TABLE "desktop_folders"
  ADD CONSTRAINT "desktop_folders_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "desktop_project_placements"
  ADD CONSTRAINT "desktop_project_placements_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "desktop_project_placements_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "desktop_project_placements_folder_id_fkey"
    FOREIGN KEY ("folder_id") REFERENCES "desktop_folders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "desktop_folders" (
  "id",
  "owner_id",
  "name",
  "sort_order",
  "is_default",
  "created_at",
  "updated_at"
)
SELECT
  'desktop_folder_default_' || user_row."id",
  user_row."id",
  'Default',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" AS user_row
WHERE EXISTS (
  SELECT 1
  FROM "project_members" AS member
  WHERE member."user_id" = user_row."id"
    AND member."status" = 'ACTIVE'
)
ON CONFLICT ("owner_id", "name") DO NOTHING;

WITH ranked_member_projects AS (
  SELECT
    member."user_id",
    member."project_id",
    folder."id" AS "folder_id",
    row_number() OVER (
      PARTITION BY member."user_id"
      ORDER BY project."created_at", project."id"
    ) - 1 AS "rank_index"
  FROM "project_members" AS member
  JOIN "projects" AS project ON project."id" = member."project_id"
  JOIN "desktop_folders" AS folder
    ON folder."owner_id" = member."user_id"
   AND folder."is_default" = true
  WHERE member."status" = 'ACTIVE'
    AND project."status" = 'ACTIVE'
)
INSERT INTO "desktop_project_placements" (
  "id",
  "user_id",
  "project_id",
  "folder_id",
  "desktop_x",
  "desktop_y",
  "sort_order",
  "created_at",
  "updated_at"
)
SELECT
  'desktop_placement_' || md5("user_id" || ':' || "project_id"),
  "user_id",
  "project_id",
  "folder_id",
  (("rank_index" % 6)::int * 132) + 24,
  (("rank_index" / 6)::int * 128) + 24,
  "rank_index"::int,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM ranked_member_projects
ON CONFLICT ("user_id", "project_id") DO NOTHING;
