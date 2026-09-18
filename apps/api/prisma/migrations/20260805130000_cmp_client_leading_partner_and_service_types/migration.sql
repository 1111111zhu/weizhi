-- Add the new Client Leading Partner and conditional Company Type detail
-- without rewriting existing Client master data.
ALTER TABLE "cmp_clients"
  ADD COLUMN "client_leading_partner_id" TEXT,
  ADD COLUMN "client_leading_partner" TEXT,
  ADD COLUMN "company_type_other_description" TEXT;

ALTER TABLE "cmp_clients"
  ADD CONSTRAINT "cmp_clients_client_leading_partner_id_fkey"
  FOREIGN KEY ("client_leading_partner_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "cmp_clients_client_leading_partner_id_idx"
  ON "cmp_clients"("client_leading_partner_id");

-- PostgreSQL enum values are appended so legacy service values remain readable.
ALTER TYPE "CmpEngagementServiceType" ADD VALUE IF NOT EXISTS 'ANNUAL_AUDIT';
ALTER TYPE "CmpEngagementServiceType" ADD VALUE IF NOT EXISTS 'REVIEW';
ALTER TYPE "CmpEngagementServiceType" ADD VALUE IF NOT EXISTS 'SPECIAL_AUDIT_PRIVATE_CO';

ALTER TABLE "cmp_engagements"
  ADD COLUMN "other_service_description" TEXT;
