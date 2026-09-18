-- Replace staff-grade project roles with project responsibility roles.
CREATE TYPE "ProjectRole_new" AS ENUM ('PARTNER', 'REVIEWER', 'PREPARER', 'EQCR', 'TAX_REVIEWER');

ALTER TABLE "workspace_members"
  ALTER COLUMN "role" TYPE "ProjectRole_new"
  USING (
    CASE "role"::text
      WHEN 'PARTNER' THEN 'PARTNER'
      WHEN 'MANAGER' THEN 'REVIEWER'
      WHEN 'SENIOR' THEN 'REVIEWER'
      WHEN 'STAFF' THEN 'PREPARER'
      ELSE "role"::text
    END
  )::"ProjectRole_new";

ALTER TABLE "project_members"
  ALTER COLUMN "project_role" TYPE "ProjectRole_new"
  USING (
    CASE "project_role"::text
      WHEN 'PARTNER' THEN 'PARTNER'
      WHEN 'MANAGER' THEN 'REVIEWER'
      WHEN 'SENIOR' THEN 'REVIEWER'
      WHEN 'STAFF' THEN 'PREPARER'
      ELSE "project_role"::text
    END
  )::"ProjectRole_new";

ALTER TABLE "project_invitations"
  ALTER COLUMN "invited_role" TYPE "ProjectRole_new"
  USING (
    CASE "invited_role"::text
      WHEN 'PARTNER' THEN 'PARTNER'
      WHEN 'MANAGER' THEN 'REVIEWER'
      WHEN 'SENIOR' THEN 'REVIEWER'
      WHEN 'STAFF' THEN 'PREPARER'
      ELSE "invited_role"::text
    END
  )::"ProjectRole_new";

DROP TYPE "ProjectRole";
ALTER TYPE "ProjectRole_new" RENAME TO "ProjectRole";
