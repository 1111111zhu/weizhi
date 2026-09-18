CREATE TABLE "cmp_aml_configurations" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "credential_ciphertext" TEXT,
  "credential_iv" TEXT,
  "credential_auth_tag" TEXT,
  "updated_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cmp_aml_configurations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cmp_aml_configurations"
  ADD CONSTRAINT "cmp_aml_configurations_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "cmp_aml_configurations_updated_by_id_idx"
  ON "cmp_aml_configurations"("updated_by_id");
