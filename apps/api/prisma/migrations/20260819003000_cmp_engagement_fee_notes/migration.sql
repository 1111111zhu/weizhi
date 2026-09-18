CREATE TABLE "cmp_engagement_fee_notes" (
    "id" TEXT NOT NULL,
    "engagement_id" TEXT NOT NULL,
    "fee_note_number" TEXT,
    "engagement_reference" TEXT,
    "issue_date" DATE,
    "recipient_name" TEXT,
    "recipient_address" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'HKD',
    "service_description" TEXT,
    "amount" DECIMAL(18,2),
    "issuer_reference" TEXT,
    "signatory_name" TEXT,
    "bank_payee_name" TEXT,
    "bank_name" TEXT,
    "hkd_account_number" TEXT,
    "cny_account_number" TEXT,
    "usd_account_number" TEXT,
    "swift_code" TEXT,
    "firm_legal_name" TEXT,
    "firm_address" TEXT,
    "firm_phone" TEXT,
    "firm_fax" TEXT,
    "firm_email" TEXT,
    "firm_website" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cmp_engagement_fee_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cmp_engagement_fee_notes_engagement_id_key"
ON "cmp_engagement_fee_notes"("engagement_id");

ALTER TABLE "cmp_engagement_fee_notes"
ADD CONSTRAINT "cmp_engagement_fee_notes_engagement_id_fkey"
FOREIGN KEY ("engagement_id") REFERENCES "cmp_engagements"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
