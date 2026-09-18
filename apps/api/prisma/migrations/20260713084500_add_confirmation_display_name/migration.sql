ALTER TABLE "project_confirmations"
  ADD COLUMN "display_name" TEXT;

UPDATE "project_confirmations"
SET "display_name" = NULLIF(BTRIM("counterparty_name"), '')
WHERE "display_name" IS NULL;
