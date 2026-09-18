-- Keep legacy grade values so existing fee-plan snapshots remain readable.
-- New values are offered to users in the defined budget-table order by CMP.
ALTER TYPE "CmpEngagementFeePlanGrade" ADD VALUE IF NOT EXISTS 'MANAGING_PARTNER';
ALTER TYPE "CmpEngagementFeePlanGrade" ADD VALUE IF NOT EXISTS 'SENIOR_MANAGER';
ALTER TYPE "CmpEngagementFeePlanGrade" ADD VALUE IF NOT EXISTS 'EQ_REVIEWER';
ALTER TYPE "CmpEngagementFeePlanGrade" ADD VALUE IF NOT EXISTS 'ASSISTANT_MANAGER';
ALTER TYPE "CmpEngagementFeePlanGrade" ADD VALUE IF NOT EXISTS 'SENIOR_ACCOUNTANT_II';
ALTER TYPE "CmpEngagementFeePlanGrade" ADD VALUE IF NOT EXISTS 'SENIOR_ACCOUNTANT_I';
ALTER TYPE "CmpEngagementFeePlanGrade" ADD VALUE IF NOT EXISTS 'STAFF_ACCOUNTANT_II';
ALTER TYPE "CmpEngagementFeePlanGrade" ADD VALUE IF NOT EXISTS 'STAFF_ACCOUNTANT_I';
ALTER TYPE "CmpEngagementFeePlanGrade" ADD VALUE IF NOT EXISTS 'TRAINEE';
