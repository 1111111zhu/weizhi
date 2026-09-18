ALTER TABLE "cmp_entities"
ADD COLUMN "company_code" TEXT;

CREATE INDEX "cmp_entities_company_code_idx"
ON "cmp_entities"("company_code");
