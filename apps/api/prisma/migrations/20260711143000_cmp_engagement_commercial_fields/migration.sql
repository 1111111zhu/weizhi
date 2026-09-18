ALTER TABLE "cmp_engagements"
ADD COLUMN "budgeted_hours" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "agreed_fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN "estimated_disbursements" DECIMAL(18,2),
ADD COLUMN "is_recurring_fee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "budget_fee_next_year" DECIMAL(18,2),
ADD COLUMN "fee_currency" TEXT NOT NULL DEFAULT 'HKD';
