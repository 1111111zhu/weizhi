CREATE TYPE "CompanyRegion" AS ENUM ('HONG_KONG', 'MAINLAND');
CREATE TYPE "ListingStatus" AS ENUM ('LISTED', 'UNLISTED');

ALTER TABLE "projects"
  ADD COLUMN "company_region" "CompanyRegion",
  ADD COLUMN "listing_status" "ListingStatus";

UPDATE "projects"
SET
  "company_region" = CASE
    WHEN "company_type" = 'HK_STOCK' THEN 'HONG_KONG'::"CompanyRegion"
    ELSE 'MAINLAND'::"CompanyRegion"
  END,
  "listing_status" = CASE
    WHEN "company_type" IN ('LISTED', 'HK_STOCK', 'A_SHARE') THEN 'LISTED'::"ListingStatus"
    ELSE 'UNLISTED'::"ListingStatus"
  END;

ALTER TABLE "projects"
  ALTER COLUMN "company_region" SET NOT NULL,
  ALTER COLUMN "listing_status" SET NOT NULL,
  DROP COLUMN "company_type";

DROP TYPE "CompanyType";
