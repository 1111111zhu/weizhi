ALTER TYPE "CmpEntityStatus" ADD VALUE IF NOT EXISTS 'DISSOLVED';
ALTER TYPE "CmpEntityStatus" ADD VALUE IF NOT EXISTS 'DECEASED';
ALTER TYPE "CmpEntityStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN';

CREATE TYPE "CmpCompanyType" AS ENUM ('PRIVATE', 'LISTED', 'OTHER');

CREATE TABLE "cmp_company_profiles" (
  "entity_id" TEXT NOT NULL,
  "identifier_type" TEXT NOT NULL,
  "identifier_value" TEXT NOT NULL,
  "incorporation_date" TIMESTAMP(3) NOT NULL,
  "company_type" "CmpCompanyType" NOT NULL,
  "industry_classification" TEXT,
  "registered_address" TEXT NOT NULL,
  "principal_business_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cmp_company_profiles_pkey" PRIMARY KEY ("entity_id")
);

CREATE TABLE "cmp_person_profiles" (
  "entity_id" TEXT NOT NULL,
  "date_of_birth" TIMESTAMP(3),
  "identifier_type" TEXT,
  "identifier_value" TEXT,
  "nationality" TEXT,
  "residence_jurisdiction" TEXT,
  "correspondence_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cmp_person_profiles_pkey" PRIMARY KEY ("entity_id")
);

CREATE INDEX "cmp_company_profiles_identifier_type_identifier_value_idx"
  ON "cmp_company_profiles"("identifier_type", "identifier_value");
CREATE INDEX "cmp_person_profiles_identifier_type_identifier_value_idx"
  ON "cmp_person_profiles"("identifier_type", "identifier_value");

ALTER TABLE "cmp_company_profiles"
  ADD CONSTRAINT "cmp_company_profiles_entity_id_fkey"
  FOREIGN KEY ("entity_id") REFERENCES "cmp_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cmp_person_profiles"
  ADD CONSTRAINT "cmp_person_profiles_entity_id_fkey"
  FOREIGN KEY ("entity_id") REFERENCES "cmp_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
