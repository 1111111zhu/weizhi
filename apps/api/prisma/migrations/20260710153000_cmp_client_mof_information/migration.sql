ALTER TABLE "cmp_clients"
  ADD COLUMN "remarks" TEXT,
  ADD COLUMN "mof_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "cmp_client_shareholding_history" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "ultimate_shareholding_available" TEXT,
  "shareholding_by_prc_enterprise" TEXT,
  "shareholding_by_prc_individual" TEXT,
  "shareholding_by_hk_macao_taiwan_investors" TEXT,
  "other_investors" TEXT,
  "other_investors_details" TEXT,
  "shareholding_remark" TEXT,
  "change_details" TEXT,
  "effective_date" TIMESTAMP(3),
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cmp_client_shareholding_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cmp_client_prc_establishments" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "establishment_name" TEXT NOT NULL,
  "registration_number" TEXT,
  "country_or_district" TEXT,
  "establishment_type" TEXT,
  "operation_status" TEXT,
  "ownership_percentage" TEXT,
  "effective_date" TIMESTAMP(3),
  "remarks" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cmp_client_prc_establishments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cmp_client_shareholding_history_client_id_created_at_idx"
  ON "cmp_client_shareholding_history"("client_id", "created_at");
CREATE INDEX "cmp_client_prc_establishments_client_id_sort_order_idx"
  ON "cmp_client_prc_establishments"("client_id", "sort_order");

ALTER TABLE "cmp_client_shareholding_history"
  ADD CONSTRAINT "cmp_client_shareholding_history_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "cmp_clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "cmp_client_shareholding_history_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cmp_client_prc_establishments"
  ADD CONSTRAINT "cmp_client_prc_establishments_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "cmp_clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "cmp_client_shareholding_history" (
  "id",
  "client_id",
  "ultimate_shareholding_available",
  "shareholding_by_prc_enterprise",
  "shareholding_by_prc_individual",
  "shareholding_by_hk_macao_taiwan_investors",
  "other_investors",
  "other_investors_details",
  "shareholding_remark",
  "change_details",
  "effective_date",
  "created_by_id",
  "created_at"
)
SELECT
  'mof_seed_' || md5(client."id"),
  client."id",
  client."ultimate_shareholding_available",
  client."shareholding_by_prc_enterprise",
  client."shareholding_by_prc_individual",
  client."shareholding_by_hk_macao_taiwan_investors",
  client."other_investors",
  client."other_investors_details",
  client."shareholding_remark",
  'Initial snapshot',
  client."updated_at",
  creator."id",
  client."updated_at"
FROM "cmp_clients" AS client
LEFT JOIN "users" AS creator ON creator."id" = client."created_by_id";
