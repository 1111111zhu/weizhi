-- Add user references for CMP client responsible-person fields while keeping
-- existing text snapshots for legacy display and audit readability.
ALTER TABLE "cmp_clients"
  ADD COLUMN "client_partner_pic_id" TEXT,
  ADD COLUMN "client_manager_mic_id" TEXT,
  ADD COLUMN "alternative_partner_second_mic_id" TEXT;

CREATE INDEX "cmp_clients_client_partner_pic_id_idx"
  ON "cmp_clients"("client_partner_pic_id");

CREATE INDEX "cmp_clients_client_manager_mic_id_idx"
  ON "cmp_clients"("client_manager_mic_id");

CREATE INDEX "cmp_clients_alternative_partner_second_mic_id_idx"
  ON "cmp_clients"("alternative_partner_second_mic_id");

ALTER TABLE "cmp_clients"
  ADD CONSTRAINT "cmp_clients_client_partner_pic_id_fkey"
    FOREIGN KEY ("client_partner_pic_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "cmp_clients_client_manager_mic_id_fkey"
    FOREIGN KEY ("client_manager_mic_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "cmp_clients_alternative_partner_second_mic_id_fkey"
    FOREIGN KEY ("alternative_partner_second_mic_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
