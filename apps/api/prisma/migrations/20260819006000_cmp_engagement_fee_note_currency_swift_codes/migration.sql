ALTER TABLE "cmp_engagement_fee_notes"
ADD COLUMN "hkd_swift_code" TEXT,
ADD COLUMN "cny_swift_code" TEXT,
ADD COLUMN "usd_swift_code" TEXT;

UPDATE "cmp_engagement_fee_notes"
SET
  "hkd_swift_code" = "swift_code",
  "cny_swift_code" = "swift_code",
  "usd_swift_code" = "swift_code"
WHERE "swift_code" IS NOT NULL;
