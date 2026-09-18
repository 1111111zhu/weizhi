CREATE TYPE "CmpClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RESIGNED');

ALTER TABLE "cmp_clients"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "CmpClientStatus"
    USING (
      CASE
        WHEN "status"::text = 'ACTIVE' THEN 'ACTIVE'
        ELSE 'INACTIVE'
      END
    )::"CmpClientStatus",
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
