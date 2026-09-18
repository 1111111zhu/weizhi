ALTER TABLE "projects"
  DROP COLUMN "company_region",
  DROP COLUMN "listing_status";

DROP TYPE IF EXISTS "CompanyRegion";
DROP TYPE IF EXISTS "ListingStatus";
