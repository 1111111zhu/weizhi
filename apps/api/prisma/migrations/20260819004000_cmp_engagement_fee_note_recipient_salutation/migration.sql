ALTER TABLE "cmp_engagement_fee_notes"
ADD COLUMN "recipient_attention" TEXT,
ADD COLUMN "recipient_salutation" TEXT,
ADD COLUMN "disbursement_amount" DECIMAL(18,2),
ADD COLUMN "total_amount" DECIMAL(18,2);
