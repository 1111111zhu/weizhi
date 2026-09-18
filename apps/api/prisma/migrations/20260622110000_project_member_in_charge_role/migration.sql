CREATE TYPE "InChargeRole" AS ENUM ('PARTNER_IN_CHARGE', 'MANAGER_IN_CHARGE');

ALTER TABLE "project_members"
ADD COLUMN "in_charge_role" "InChargeRole";
