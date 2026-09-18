CREATE TYPE "CmpBillingTemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "cmp_billing_firm_templates" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "CmpBillingTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "firm_legal_name_zh" TEXT NOT NULL DEFAULT '',
  "firm_legal_name_en" TEXT NOT NULL DEFAULT '',
  "firm_address_zh" TEXT NOT NULL DEFAULT '',
  "firm_address_en" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "website" TEXT NOT NULL DEFAULT '',
  "created_by_id" TEXT NOT NULL,
  "updated_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cmp_billing_firm_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cmp_billing_bank_templates" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "CmpBillingTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "bank_payee_name_zh" TEXT NOT NULL DEFAULT '',
  "bank_payee_name_en" TEXT NOT NULL DEFAULT '',
  "bank_name_zh" TEXT NOT NULL DEFAULT '',
  "bank_name_en" TEXT NOT NULL DEFAULT '',
  "hkd_account_number" TEXT NOT NULL DEFAULT '',
  "hkd_swift_code" TEXT NOT NULL DEFAULT '',
  "cny_account_number" TEXT NOT NULL DEFAULT '',
  "cny_swift_code" TEXT NOT NULL DEFAULT '',
  "usd_account_number" TEXT NOT NULL DEFAULT '',
  "usd_swift_code" TEXT NOT NULL DEFAULT '',
  "created_by_id" TEXT NOT NULL,
  "updated_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cmp_billing_bank_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cmp_billing_firm_templates_status_name_idx"
  ON "cmp_billing_firm_templates"("status", "name");
CREATE INDEX "cmp_billing_bank_templates_status_name_idx"
  ON "cmp_billing_bank_templates"("status", "name");

CREATE UNIQUE INDEX "cmp_billing_firm_templates_name_ci_key"
  ON "cmp_billing_firm_templates" (LOWER(BTRIM("name")));
CREATE UNIQUE INDEX "cmp_billing_bank_templates_name_ci_key"
  ON "cmp_billing_bank_templates" (LOWER(BTRIM("name")));
CREATE UNIQUE INDEX "cmp_billing_firm_templates_one_active_default"
  ON "cmp_billing_firm_templates" ("is_default")
  WHERE "is_default" AND "status" = 'ACTIVE';
CREATE UNIQUE INDEX "cmp_billing_bank_templates_one_active_default"
  ON "cmp_billing_bank_templates" ("is_default")
  WHERE "is_default" AND "status" = 'ACTIVE';

ALTER TABLE "cmp_billing_firm_templates"
  ADD CONSTRAINT "cmp_billing_firm_templates_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cmp_billing_firm_templates"
  ADD CONSTRAINT "cmp_billing_firm_templates_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cmp_billing_bank_templates"
  ADD CONSTRAINT "cmp_billing_bank_templates_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cmp_billing_bank_templates"
  ADD CONSTRAINT "cmp_billing_bank_templates_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the existing hard-coded WZ details as a visible, editable company
-- default. A new database with no users deliberately starts without a template:
-- templates need an accountable creator before they can be used.
INSERT INTO "cmp_billing_firm_templates" (
  "id", "name", "status", "is_default", "version",
  "firm_legal_name_zh", "firm_legal_name_en",
  "firm_address_zh", "firm_address_en",
  "phone", "email", "website", "created_by_id", "updated_by_id",
  "created_at", "updated_at"
)
SELECT
  'CMP-BILLING-FIRM-WZ-DEFAULT',
  'WZ Default Firm Profile',
  'ACTIVE'::"CmpBillingTemplateStatus",
  true,
  1,
  '维致（香港）会计师事务所',
  'Wing Zenith',
  '香港灣仔駱克道193號東超商業中心17樓1703至1704室',
  'Rooms 1703-4, 17/F, Tung Chiu Commercial Centre, 193 Lockhart Road, Wan Chai, Hong Kong',
  '(852) 53667568',
  'info@wzcpa.hk',
  'www.wzcpa.hk',
  "user"."id",
  "user"."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" AS "user"
ORDER BY "user"."created_at"
LIMIT 1
ON CONFLICT DO NOTHING;
