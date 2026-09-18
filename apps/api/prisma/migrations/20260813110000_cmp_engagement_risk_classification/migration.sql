CREATE TYPE "CmpAmlRiskClassification" AS ENUM ('HIGH', 'NOT_HIGH');
CREATE TYPE "CmpEngagementRiskClassification" AS ENUM ('NORMAL', 'GREATER_THAN_NORMAL', 'EXCEPTIONAL_HIGH');

ALTER TABLE "cmp_engagements"
  ADD COLUMN "aml_risk_classification" "CmpAmlRiskClassification" NOT NULL DEFAULT 'NOT_HIGH',
  ADD COLUMN "engagement_risk_classification" "CmpEngagementRiskClassification" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "eq_reviewer_user_id" TEXT,
  ADD COLUMN "risk_management_partner_user_id" TEXT,
  ADD COLUMN "eq_reviewer" TEXT,
  ADD COLUMN "risk_management_partner" TEXT;

ALTER TABLE "cmp_engagements"
  ADD CONSTRAINT "cmp_engagements_eq_reviewer_user_id_fkey"
    FOREIGN KEY ("eq_reviewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "cmp_engagements_risk_management_partner_user_id_fkey"
    FOREIGN KEY ("risk_management_partner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "cmp_engagements_eq_reviewer_user_id_idx"
  ON "cmp_engagements"("eq_reviewer_user_id");
CREATE INDEX "cmp_engagements_risk_management_partner_user_id_idx"
  ON "cmp_engagements"("risk_management_partner_user_id");
