-- A withdrawn response import remains in the import history after its project
-- response is returned to the confirmation center.  Once the response row is
-- deleted, its foreign keys must be cleared while the immutable source
-- metadata (object key, hash and file name) remains available for audit.
ALTER TABLE "confirmation_emp_import_items"
  DROP CONSTRAINT "confirmation_emp_import_items_source_kind_check";

ALTER TABLE "confirmation_emp_import_items"
  ADD CONSTRAINT "confirmation_emp_import_items_source_kind_check"
  CHECK (
    (
      "source_kind" = 'OUTGOING_ARTIFACT'::"ConfirmationEmpImportSourceKind"
      AND "outgoing_artifact_id" IS NOT NULL
      AND "response_id" IS NULL
      AND "response_artifact_id" IS NULL
    )
    OR
    (
      "source_kind" = 'RESPONSE_ARTIFACT'::"ConfirmationEmpImportSourceKind"
      AND "outgoing_artifact_id" IS NULL
      AND "response_id" IS NOT NULL
      AND "response_artifact_id" IS NOT NULL
    )
    OR
    (
      "source_kind" = 'RESPONSE_ARTIFACT'::"ConfirmationEmpImportSourceKind"
      AND "outgoing_artifact_id" IS NULL
      AND "response_id" IS NULL
      AND "response_artifact_id" IS NULL
      AND "withdrawn_at" IS NOT NULL
    )
  );
