CREATE TYPE "CmpMasterStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "cmp_client_groups" (
    "id" TEXT NOT NULL,
    "group_code" TEXT NOT NULL,
    "name_zh" TEXT NOT NULL,
    "name_en" TEXT,
    "status" "CmpMasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cmp_client_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cmp_clients" (
    "id" TEXT NOT NULL,
    "client_code" TEXT NOT NULL,
    "company_number" TEXT,
    "name_zh" TEXT NOT NULL,
    "name_en" TEXT,
    "group_id" TEXT,
    "address" TEXT,
    "contact_person" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "industry_or_business_nature" TEXT,
    "year_end_date" TIMESTAMP(3),
    "place_of_incorporation" TEXT,
    "date_of_incorporation" TIMESTAMP(3),
    "country_or_district" TEXT,
    "listed_or_private" TEXT,
    "stock_exchange_or_listing_place" TEXT,
    "stock_code" TEXT,
    "market_segment" TEXT,
    "regulated_entities" TEXT,
    "company_type_or_special_industry" TEXT,
    "is_subsidiary" BOOLEAN NOT NULL DEFAULT false,
    "parent_client_code" TEXT,
    "subsidiaries_or_associates" TEXT,
    "referred_by" TEXT,
    "internal_source" TEXT,
    "external_source" TEXT,
    "source_description" TEXT,
    "client_partner_pic" TEXT,
    "client_manager_mic" TEXT,
    "alternative_partner_second_mic" TEXT,
    "expected_job_or_engagement_type" TEXT,
    "service_lines" TEXT,
    "approval_reference_number" TEXT,
    "approval_date" TIMESTAMP(3),
    "has_prc_operation" BOOLEAN NOT NULL DEFAULT false,
    "books_and_records_in_prc" BOOLEAN NOT NULL DEFAULT false,
    "has_prc_archive" BOOLEAN NOT NULL DEFAULT false,
    "shareholding_by_prc_enterprise" TEXT,
    "shareholding_by_prc_individual" TEXT,
    "shareholding_by_hk_macao_taiwan_investors" TEXT,
    "other_investors" TEXT,
    "prepared_by" TEXT,
    "approved_by" TEXT,
    "mic_approval" TEXT,
    "pic_approval" TEXT,
    "it_admin" TEXT,
    "sign_off_date" TIMESTAMP(3),
    "status" "CmpMasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cmp_clients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cmp_client_groups_group_code_key" ON "cmp_client_groups"("group_code");
CREATE INDEX "cmp_client_groups_status_group_code_idx" ON "cmp_client_groups"("status", "group_code");

CREATE UNIQUE INDEX "cmp_clients_client_code_key" ON "cmp_clients"("client_code");
CREATE INDEX "cmp_clients_group_id_status_idx" ON "cmp_clients"("group_id", "status");
CREATE INDEX "cmp_clients_status_client_code_idx" ON "cmp_clients"("status", "client_code");
CREATE INDEX "cmp_clients_client_partner_pic_idx" ON "cmp_clients"("client_partner_pic");
CREATE INDEX "cmp_clients_client_manager_mic_idx" ON "cmp_clients"("client_manager_mic");

ALTER TABLE "cmp_clients" ADD CONSTRAINT "cmp_clients_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "cmp_client_groups"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
