ALTER TABLE "cmp_engagement_fee_notes"
ADD COLUMN "localized_content" JSONB NOT NULL DEFAULT '{}';

UPDATE "cmp_engagement_fee_notes"
SET "localized_content" = jsonb_build_object(
  'zh-CN', jsonb_build_object(
    'recipientName', COALESCE("recipient_name", ''),
    'recipientAttention', COALESCE("recipient_attention", ''),
    'recipientSalutation', COALESCE("recipient_salutation", ''),
    'recipientAddress', COALESCE("recipient_address", ''),
    'serviceDescription', COALESCE("service_description", ''),
    'lineItemDescriptions', COALESCE((
      SELECT jsonb_object_agg(item->>'id', COALESCE(item->>'description', ''))
      FROM jsonb_array_elements(COALESCE("line_items", '[]'::jsonb)) AS item
      WHERE COALESCE(item->>'id', '') <> ''
    ), '{}'::jsonb),
    'signatoryName', COALESCE("signatory_name", ''),
    'bankPayeeName', COALESCE(NULLIF("bank_payee_name_zh", ''), "bank_payee_name", ''),
    'bankName', COALESCE("bank_name", ''),
    'firmLegalName', COALESCE("firm_legal_name", ''),
    'firmAddress', COALESCE("firm_address", '')
  ),
  'en-US', jsonb_build_object(
    'recipientName', COALESCE("recipient_name", ''),
    'recipientAttention', COALESCE("recipient_attention", ''),
    'recipientSalutation', COALESCE("recipient_salutation", ''),
    'recipientAddress', COALESCE("recipient_address", ''),
    'serviceDescription', COALESCE("service_description", ''),
    'lineItemDescriptions', COALESCE((
      SELECT jsonb_object_agg(item->>'id', COALESCE(item->>'description', ''))
      FROM jsonb_array_elements(COALESCE("line_items", '[]'::jsonb)) AS item
      WHERE COALESCE(item->>'id', '') <> ''
    ), '{}'::jsonb),
    'signatoryName', COALESCE("signatory_name", ''),
    'bankPayeeName', COALESCE(NULLIF("bank_payee_name", ''), "bank_payee_name_zh", ''),
    'bankName', COALESCE("bank_name", ''),
    'firmLegalName', COALESCE("firm_legal_name", ''),
    'firmAddress', COALESCE("firm_address", '')
  )
)
WHERE "localized_content" = '{}'::jsonb;
