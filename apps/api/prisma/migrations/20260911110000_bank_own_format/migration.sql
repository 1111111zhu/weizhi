ALTER TABLE "confirmation_information_library_entries"
ADD COLUMN "requires_bank_template" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "confirmation_information_library_entries"
SET "requires_bank_template" = TRUE
WHERE TRIM("notes") = '要求自有格式';
