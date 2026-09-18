-- Invoice versions must be unique for each bill and locale, including when two
-- users generate the same invoice concurrently.  A partial index keeps upload
-- artifacts outside the invoice version namespace.
CREATE UNIQUE INDEX "cmp_billing_artifacts_invoice_locale_version_key"
ON "cmp_billing_artifacts" ("billing_id", "type", "locale", "version")
WHERE "type" = 'INVOICE' AND "locale" IS NOT NULL AND "version" IS NOT NULL;

-- The original backfill predates empty historic line-item payloads.  Make any
-- affected historical bill editable by giving it one amount-preserving line.
INSERT INTO "cmp_billing_line_items" (
  "id", "billing_id", "description_zh", "description_en", "amount", "sort_order", "created_at", "updated_at"
)
SELECT
  'legacy-billing-fallback-line-' || note.id,
  billing.id,
  COALESCE(note.localized_content #>> ARRAY['zh-CN','serviceDescription'], note.service_description, ''),
  COALESCE(note.localized_content #>> ARRAY['en-US','serviceDescription'], note.service_description, ''),
  billing.total_amount,
  0,
  note.created_at,
  note.updated_at
FROM "cmp_engagement_fee_notes" note
JOIN "cmp_billings" billing ON billing.id = 'legacy-billing-' || note.id
WHERE NOT EXISTS (
  SELECT 1
  FROM "cmp_billing_line_items" item
  WHERE item.billing_id = billing.id
);
