-- Project-template Smart Form references are library metadata, not project instances.
-- Keep those references on the Smart Form template's latest published version while
-- leaving SmartFormInstance rows and materialized project .sf files untouched.

-- Bring existing project-template references up to the current published version.
UPDATE "project_template_smart_forms" AS "reference"
SET "smart_form_template_version_id" = "template"."current_published_version_id"
FROM "smart_form_templates" AS "template"
WHERE "reference"."smart_form_template_id" = "template"."id"
  AND "template"."current_published_version_id" IS NOT NULL
  AND "reference"."smart_form_template_version_id" IS DISTINCT FROM "template"."current_published_version_id";

CREATE FUNCTION "sync_project_template_smart_form_published_version"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."current_published_version_id" IS NOT NULL
     AND NEW."current_published_version_id" IS DISTINCT FROM OLD."current_published_version_id" THEN
    UPDATE "project_template_smart_forms"
    SET "smart_form_template_version_id" = NEW."current_published_version_id"
    WHERE "smart_form_template_id" = NEW."id"
      AND "smart_form_template_version_id" IS DISTINCT FROM NEW."current_published_version_id";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "smart_form_templates_sync_project_template_version"
AFTER UPDATE OF "current_published_version_id"
ON "smart_form_templates"
FOR EACH ROW
EXECUTE FUNCTION "sync_project_template_smart_form_published_version"();
