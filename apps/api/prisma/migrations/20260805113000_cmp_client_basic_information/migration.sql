-- Normalize CMP Client basic information while preserving the legacy columns
-- for old drafts, integrations, and approved historical request snapshots.
CREATE TYPE "CmpClientAddressType" AS ENUM ('REGISTERED', 'PRINCIPAL', 'OTHER');

ALTER TABLE "cmp_clients"
  ADD COLUMN "year_end_month" INTEGER,
  ADD COLUMN "hsic_section_code" TEXT,
  ADD COLUMN "industry_business_nature_details" TEXT,
  ADD COLUMN "contact_position" TEXT,
  ADD COLUMN "contact_department" TEXT,
  ADD COLUMN "contact_mobile" TEXT,
  ADD COLUMN "contact_remarks" TEXT,
  ADD COLUMN "principal_address_same_as_registered" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "cmp_clients"
  ADD CONSTRAINT "cmp_clients_year_end_month_check"
  CHECK ("year_end_month" IS NULL OR "year_end_month" BETWEEN 1 AND 12);

CREATE TABLE "cmp_client_addresses" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "type" "CmpClientAddressType" NOT NULL,
  "label" TEXT,
  "address" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cmp_client_addresses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cmp_client_addresses_client_id_type_sort_order_idx"
  ON "cmp_client_addresses"("client_id", "type", "sort_order");

ALTER TABLE "cmp_client_addresses"
  ADD CONSTRAINT "cmp_client_addresses_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "cmp_clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing full dates become a Client fiscal month; Engagement keeps its full date.
UPDATE "cmp_clients"
SET "year_end_month" = EXTRACT(MONTH FROM "year_end_date")::INTEGER
WHERE "year_end_date" IS NOT NULL;

UPDATE "cmp_clients"
SET "industry_business_nature_details" = NULLIF(BTRIM("industry_or_business_nature"), '')
WHERE "industry_or_business_nature" IS NOT NULL;

-- Legacy address is duplicated as the initial Registered and Principal address.
INSERT INTO "cmp_client_addresses" (
  "id", "client_id", "type", "label", "address", "sort_order", "created_at", "updated_at"
)
SELECT
  'cmp_client_address_registered_' || "id",
  "id",
  'REGISTERED'::"CmpClientAddressType",
  'Registered address',
  BTRIM("address"),
  0,
  "created_at",
  "updated_at"
FROM "cmp_clients"
WHERE NULLIF(BTRIM("address"), '') IS NOT NULL;

INSERT INTO "cmp_client_addresses" (
  "id", "client_id", "type", "label", "address", "sort_order", "created_at", "updated_at"
)
SELECT
  'cmp_client_address_principal_' || "id",
  "id",
  'PRINCIPAL'::"CmpClientAddressType",
  'Principal business address',
  BTRIM("address"),
  0,
  "created_at",
  "updated_at"
FROM "cmp_clients"
WHERE NULLIF(BTRIM("address"), '') IS NOT NULL;

UPDATE "cmp_clients"
SET "principal_address_same_as_registered" = true
WHERE NULLIF(BTRIM("address"), '') IS NOT NULL;
