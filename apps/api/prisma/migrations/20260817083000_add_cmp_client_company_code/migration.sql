ALTER TABLE "cmp_clients"
ADD COLUMN "company_code" TEXT;

CREATE UNIQUE INDEX "cmp_clients_company_code_normalized_unique"
ON "cmp_clients" (LOWER(BTRIM("company_code")))
WHERE "company_code" IS NOT NULL
  AND BTRIM("company_code") <> '';
