ALTER TABLE "cmp_engagements"
ADD COLUMN "pic_user_id" TEXT,
ADD COLUMN "mic_user_id" TEXT;

WITH unique_active_users AS (
  SELECT LOWER(TRIM("name")) AS normalized_name, MIN("id") AS user_id
  FROM "users"
  WHERE "status" = 'ACTIVE'
  GROUP BY LOWER(TRIM("name"))
  HAVING COUNT(*) = 1
)
UPDATE "cmp_engagements" AS engagement
SET "pic_user_id" = matched.user_id
FROM unique_active_users AS matched
WHERE engagement."pic" IS NOT NULL
  AND LOWER(TRIM(engagement."pic")) = matched.normalized_name;

WITH unique_active_users AS (
  SELECT LOWER(TRIM("name")) AS normalized_name, MIN("id") AS user_id
  FROM "users"
  WHERE "status" = 'ACTIVE'
  GROUP BY LOWER(TRIM("name"))
  HAVING COUNT(*) = 1
)
UPDATE "cmp_engagements" AS engagement
SET "mic_user_id" = matched.user_id
FROM unique_active_users AS matched
WHERE engagement."mic" IS NOT NULL
  AND LOWER(TRIM(engagement."mic")) = matched.normalized_name;

CREATE INDEX "cmp_engagements_pic_user_id_idx"
ON "cmp_engagements"("pic_user_id");

CREATE INDEX "cmp_engagements_mic_user_id_idx"
ON "cmp_engagements"("mic_user_id");

ALTER TABLE "cmp_engagements"
ADD CONSTRAINT "cmp_engagements_pic_user_id_fkey"
FOREIGN KEY ("pic_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cmp_engagements"
ADD CONSTRAINT "cmp_engagements_mic_user_id_fkey"
FOREIGN KEY ("mic_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
