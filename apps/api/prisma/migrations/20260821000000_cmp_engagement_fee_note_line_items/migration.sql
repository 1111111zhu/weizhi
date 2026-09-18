ALTER TABLE "cmp_engagement_fee_notes"
ADD COLUMN "line_items" JSONB NOT NULL DEFAULT '[]'::jsonb;
