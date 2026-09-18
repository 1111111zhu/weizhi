UPDATE "project_members" AS member
SET "joined_at" = latest_join."created_at"
FROM (
  SELECT
    "project_id",
    "actor_id" AS "user_id",
    MAX("created_at") AS "created_at"
  FROM "audit_logs"
  WHERE "action" = 'PROJECT_JOINED'
  GROUP BY "project_id", "actor_id"
) AS latest_join
WHERE member."project_id" = latest_join."project_id"
  AND member."user_id" = latest_join."user_id"
  AND member."status" = 'ACTIVE'
  AND latest_join."created_at" > member."joined_at";
