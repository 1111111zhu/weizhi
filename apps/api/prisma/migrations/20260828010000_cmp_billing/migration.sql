-- CMP Billing: a multi-bill engagement ledger.  The legacy fee-note table is
-- intentionally retained for one release so production data can be checked.
CREATE TYPE "CmpBillingStatus" AS ENUM (
  'DRAFT', 'SUBMITTED', 'APPROVED', 'SENT', 'CLIENT_PAID', 'RECONCILED'
);

CREATE TYPE "CmpBillingArtifactType" AS ENUM (
  'INVOICE', 'CLIENT_PAYMENT_EVIDENCE', 'FINANCE_RECEIPT'
);

CREATE TABLE "cmp_billing_sequences" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cmp_billing_sequences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cmp_billing_sequences_year_key" ON "cmp_billing_sequences"("year");

CREATE TABLE "cmp_billings" (
  "id" TEXT NOT NULL,
  "engagement_id" TEXT NOT NULL,
  "bill_number" TEXT NOT NULL,
  "number_year" INTEGER NOT NULL,
  "sequence_number" INTEGER NOT NULL,
  "legacy_fee_note_number" TEXT,
  "status" "CmpBillingStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "issue_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "currency" TEXT NOT NULL DEFAULT 'HKD',
  "subtotal_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "client_snapshot" JSONB NOT NULL DEFAULT '{}',
  "firm_snapshot" JSONB NOT NULL DEFAULT '{}',
  "localized_content" JSONB NOT NULL DEFAULT '{}',
  "sent_at" TIMESTAMP(3),
  "sent_method" TEXT,
  "sent_note" TEXT,
  "submitted_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "returned_at" TIMESTAMP(3),
  "return_reason" TEXT,
  "client_claim_amount" DECIMAL(18,2),
  "client_claim_currency" TEXT,
  "client_claim_paid_at" DATE,
  "client_claim_reference" TEXT,
  "client_claim_note" TEXT,
  "client_paid_at" TIMESTAMP(3),
  "reconciled_at" TIMESTAMP(3),
  "finance_override_reason" TEXT,
  "created_by_id" TEXT NOT NULL,
  "submitted_by_id" TEXT,
  "approved_by_id" TEXT,
  "sent_by_id" TEXT,
  "client_paid_by_id" TEXT,
  "reconciled_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cmp_billings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cmp_billings_bill_number_key" ON "cmp_billings"("bill_number");
CREATE UNIQUE INDEX "cmp_billings_number_year_sequence_number_key" ON "cmp_billings"("number_year", "sequence_number");
CREATE INDEX "cmp_billings_engagement_id_status_created_at_idx" ON "cmp_billings"("engagement_id", "status", "created_at");
CREATE INDEX "cmp_billings_status_updated_at_idx" ON "cmp_billings"("status", "updated_at");
CREATE INDEX "cmp_billings_client_paid_at_idx" ON "cmp_billings"("client_paid_at");

CREATE TABLE "cmp_billing_line_items" (
  "id" TEXT NOT NULL,
  "billing_id" TEXT NOT NULL,
  "description_zh" TEXT NOT NULL DEFAULT '',
  "description_en" TEXT NOT NULL DEFAULT '',
  "amount" DECIMAL(18,2) NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cmp_billing_line_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cmp_billing_line_items_billing_id_sort_order_idx" ON "cmp_billing_line_items"("billing_id", "sort_order");

CREATE TABLE "cmp_billing_status_events" (
  "id" TEXT NOT NULL,
  "billing_id" TEXT NOT NULL,
  "from_status" "CmpBillingStatus",
  "to_status" "CmpBillingStatus" NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "actor_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cmp_billing_status_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cmp_billing_status_events_billing_id_created_at_idx" ON "cmp_billing_status_events"("billing_id", "created_at");
CREATE INDEX "cmp_billing_status_events_actor_id_created_at_idx" ON "cmp_billing_status_events"("actor_id", "created_at");

CREATE TABLE "cmp_billing_finance_receipts" (
  "id" TEXT NOT NULL,
  "billing_id" TEXT NOT NULL,
  "receipt_date" DATE NOT NULL,
  "bank_reference" TEXT NOT NULL,
  "receipt_amount" DECIMAL(18,2) NOT NULL,
  "receipt_currency" TEXT NOT NULL,
  "exchange_rate_to_bill" DECIMAL(18,8) NOT NULL,
  "bill_currency_amount" DECIMAL(18,2) NOT NULL,
  "internal_note" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cmp_billing_finance_receipts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cmp_billing_finance_receipts_billing_id_receipt_date_idx" ON "cmp_billing_finance_receipts"("billing_id", "receipt_date");

CREATE TABLE "cmp_billing_artifacts" (
  "id" TEXT NOT NULL,
  "billing_id" TEXT NOT NULL,
  "finance_receipt_id" TEXT,
  "type" "CmpBillingArtifactType" NOT NULL,
  "locale" TEXT,
  "version" INTEGER,
  "object_key" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "uploaded_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retention_until" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cmp_billing_artifacts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cmp_billing_artifacts_object_key_key" ON "cmp_billing_artifacts"("object_key");
CREATE INDEX "cmp_billing_artifacts_billing_id_type_created_at_idx" ON "cmp_billing_artifacts"("billing_id", "type", "created_at");
CREATE INDEX "cmp_billing_artifacts_finance_receipt_id_idx" ON "cmp_billing_artifacts"("finance_receipt_id");

ALTER TABLE "cmp_billings" ADD CONSTRAINT "cmp_billings_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "cmp_engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cmp_billings" ADD CONSTRAINT "cmp_billings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cmp_billings" ADD CONSTRAINT "cmp_billings_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cmp_billings" ADD CONSTRAINT "cmp_billings_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cmp_billings" ADD CONSTRAINT "cmp_billings_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cmp_billings" ADD CONSTRAINT "cmp_billings_client_paid_by_id_fkey" FOREIGN KEY ("client_paid_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cmp_billings" ADD CONSTRAINT "cmp_billings_reconciled_by_id_fkey" FOREIGN KEY ("reconciled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cmp_billing_line_items" ADD CONSTRAINT "cmp_billing_line_items_billing_id_fkey" FOREIGN KEY ("billing_id") REFERENCES "cmp_billings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cmp_billing_status_events" ADD CONSTRAINT "cmp_billing_status_events_billing_id_fkey" FOREIGN KEY ("billing_id") REFERENCES "cmp_billings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cmp_billing_status_events" ADD CONSTRAINT "cmp_billing_status_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cmp_billing_finance_receipts" ADD CONSTRAINT "cmp_billing_finance_receipts_billing_id_fkey" FOREIGN KEY ("billing_id") REFERENCES "cmp_billings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cmp_billing_finance_receipts" ADD CONSTRAINT "cmp_billing_finance_receipts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cmp_billing_artifacts" ADD CONSTRAINT "cmp_billing_artifacts_billing_id_fkey" FOREIGN KEY ("billing_id") REFERENCES "cmp_billings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cmp_billing_artifacts" ADD CONSTRAINT "cmp_billing_artifacts_finance_receipt_id_fkey" FOREIGN KEY ("finance_receipt_id") REFERENCES "cmp_billing_finance_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cmp_billing_artifacts" ADD CONSTRAINT "cmp_billing_artifacts_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Historical fee notes become editable draft bills.  We use the original
-- creation year and stable creation order for the new technical bill number;
-- the original human number is preserved separately for reconciliation.
WITH legacy AS (
  SELECT
    note.*,
    engagement.pic_user_id,
    engagement.mic_user_id,
    EXTRACT(YEAR FROM note.created_at)::INTEGER AS number_year,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM note.created_at)::INTEGER
      ORDER BY note.created_at, note.id
    )::INTEGER AS sequence_number
  FROM "cmp_engagement_fee_notes" note
  JOIN "cmp_engagements" engagement ON engagement.id = note.engagement_id
), inserted AS (
  INSERT INTO "cmp_billings" (
    "id", "engagement_id", "bill_number", "number_year", "sequence_number",
    "legacy_fee_note_number", "status", "issue_date", "currency",
    "subtotal_amount", "total_amount", "client_snapshot", "firm_snapshot",
    "localized_content", "created_by_id", "created_at", "updated_at"
  )
  SELECT
    'legacy-billing-' || legacy.id,
    legacy.engagement_id,
    legacy.number_year::TEXT || '-' || LPAD(legacy.sequence_number::TEXT, 4, '0'),
    legacy.number_year,
    legacy.sequence_number,
    legacy.fee_note_number,
    'DRAFT'::"CmpBillingStatus",
    COALESCE(legacy.issue_date, legacy.created_at)::DATE,
    COALESCE(NULLIF(legacy.currency, ''), 'HKD'),
    COALESCE(legacy.amount, legacy.total_amount, 0),
    COALESCE(legacy.total_amount, legacy.amount, 0),
    '{}'::JSONB,
    jsonb_build_object(
      'firmPhone', COALESCE(legacy.firm_phone, ''),
      'firmFax', COALESCE(legacy.firm_fax, ''),
      'firmEmail', COALESCE(legacy.firm_email, ''),
      'firmWebsite', COALESCE(legacy.firm_website, '')
    ),
    COALESCE(legacy.localized_content, '{}'::JSONB),
    COALESCE(legacy.pic_user_id, legacy.mic_user_id, (SELECT id FROM "users" ORDER BY "created_at" LIMIT 1)),
    legacy.created_at,
    legacy.updated_at
  FROM legacy
  RETURNING "id", "number_year", "sequence_number", "created_by_id", "created_at"
)
INSERT INTO "cmp_billing_status_events" (
  "id", "billing_id", "to_status", "action", "payload", "actor_id", "created_at"
)
SELECT
  'legacy-billing-event-' || inserted.id,
  inserted.id,
  'DRAFT'::"CmpBillingStatus",
  'LEGACY_FEE_NOTE_BACKFILL',
  '{"legacy":true}'::JSONB,
  inserted.created_by_id,
  inserted.created_at
FROM inserted;

INSERT INTO "cmp_billing_line_items" (
  "id", "billing_id", "description_zh", "description_en", "amount", "sort_order", "created_at", "updated_at"
)
SELECT
  'legacy-billing-line-' || note.id || '-' || item.ordinality::TEXT,
  'legacy-billing-' || note.id,
  COALESCE(note.localized_content #>> ARRAY['zh-CN','lineItemDescriptions', item.value->>'id'], item.value->>'description', ''),
  COALESCE(note.localized_content #>> ARRAY['en-US','lineItemDescriptions', item.value->>'id'], item.value->>'description', ''),
  COALESCE(NULLIF(item.value->>'amount', '')::DECIMAL(18,2), 0),
  item.ordinality::INTEGER - 1,
  note.created_at,
  note.updated_at
FROM "cmp_engagement_fee_notes" note
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(
    NULLIF(note.line_items, '[]'::JSONB),
    jsonb_build_array(
      jsonb_build_object(
        'id', 'legacy-fallback',
        'description', COALESCE(note.service_description, ''),
        'amount', COALESCE(note.total_amount, note.amount, 0)
      )
    )
  )
) WITH ORDINALITY AS item(value, ordinality);

INSERT INTO "cmp_billing_sequences" ("id", "year", "last_number", "created_at", "updated_at")
SELECT
  'legacy-billing-sequence-' || number_year::TEXT,
  number_year,
  MAX(sequence_number),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "cmp_billings"
GROUP BY number_year;
