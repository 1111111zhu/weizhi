CREATE TYPE "ConfirmationStatus_new" AS ENUM (
  'DRAFT',
  'PREPARED',
  'AWAITING_RESPONSE',
  'CLOSED',
  'VOIDED'
);

ALTER TABLE "project_confirmations"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "project_confirmations"
  ALTER COLUMN "status" TYPE "ConfirmationStatus_new"
  USING (
    CASE "status"::text
      WHEN 'DRAFT' THEN 'DRAFT'
      WHEN 'PREPARED' THEN 'PREPARED'
      WHEN 'SENT' THEN 'AWAITING_RESPONSE'
      WHEN 'AWAITING_RESPONSE' THEN 'AWAITING_RESPONSE'
      WHEN 'RETURNED_ASSIGNED' THEN 'AWAITING_RESPONSE'
      WHEN 'UNDER_REVIEW' THEN 'AWAITING_RESPONSE'
      WHEN 'MATCHED' THEN 'CLOSED'
      WHEN 'EXCEPTION' THEN 'CLOSED'
      WHEN 'NO_RESPONSE' THEN 'CLOSED'
      WHEN 'CLOSED' THEN 'CLOSED'
      WHEN 'ARCHIVED' THEN 'CLOSED'
      ELSE 'VOIDED'
    END
  )::"ConfirmationStatus_new";

DROP TYPE "ConfirmationStatus";
ALTER TYPE "ConfirmationStatus_new" RENAME TO "ConfirmationStatus";

ALTER TABLE "project_confirmations"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';
