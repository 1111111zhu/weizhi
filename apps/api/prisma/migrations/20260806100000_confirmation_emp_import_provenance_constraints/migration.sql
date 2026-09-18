CREATE UNIQUE INDEX "project_confirmation_responses_id_confirmation_id_key"
  ON "project_confirmation_responses"("id", "confirmation_id");

CREATE UNIQUE INDEX "confirmation_response_artifacts_id_response_id_key"
  ON "confirmation_response_artifacts"("id", "response_id");

ALTER TABLE "confirmation_emp_import_items"
  DROP CONSTRAINT "confirmation_emp_import_items_response_id_fkey";

ALTER TABLE "confirmation_emp_import_items"
  DROP CONSTRAINT "confirmation_emp_import_items_response_artifact_id_fkey";

ALTER TABLE "confirmation_emp_import_items"
  ADD CONSTRAINT "confirmation_emp_import_items_response_confirmation_fkey"
  FOREIGN KEY ("response_id", "confirmation_id")
  REFERENCES "project_confirmation_responses"("id", "confirmation_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "confirmation_emp_import_items"
  ADD CONSTRAINT "confirmation_emp_import_items_response_artifact_response_fkey"
  FOREIGN KEY ("response_artifact_id", "response_id")
  REFERENCES "confirmation_response_artifacts"("id", "response_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

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
  );
