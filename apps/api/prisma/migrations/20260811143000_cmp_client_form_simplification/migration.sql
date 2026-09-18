-- CMP Client form simplification. This migration intentionally rewrites
-- Acceptance and version JSON because the removed fields must not remain
-- visible through historical CMP records.

ALTER TABLE "cmp_clients"
  ALTER COLUMN "name_zh" DROP NOT NULL,
  ADD COLUMN "reporting_gaap" TEXT,
  ADD COLUMN "incorporation_year_month" TEXT;

ALTER TABLE "cmp_clients"
  RENAME COLUMN "industry_business_nature_details" TO "industry_other_description";

UPDATE "cmp_clients"
SET "incorporation_year_month" = TO_CHAR("date_of_incorporation", 'YYYY-MM')
WHERE "date_of_incorporation" IS NOT NULL;

-- Preserve unclassified legacy industry text as the new explicit Other value.
UPDATE "cmp_clients"
SET "hsic_section_code" = 'OTHER'
WHERE NULLIF(BTRIM(COALESCE("hsic_section_code", '')), '') IS NULL
  AND NULLIF(BTRIM(COALESCE("industry_other_description", '')), '') IS NOT NULL;

UPDATE "cmp_clients"
SET "industry_other_description" = NULL
WHERE "hsic_section_code" IS DISTINCT FROM 'OTHER';

CREATE OR REPLACE FUNCTION "cmp_simplify_client_payload"("input" JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  "output" JSONB;
  "incorporation" TEXT;
  "industry_detail" JSONB;
BEGIN
  IF "input" IS NULL OR jsonb_typeof("input") <> 'object' THEN
    RETURN "input";
  END IF;

  "output" := "input" - ARRAY[
    'dateOfIncorporation',
    'countryOrDistrict',
    'companyTypeOrSpecialIndustry',
    'specialIndustryDetails',
    'industryOrBusinessNature',
    'internalSource',
    'externalSource',
    'sourceDescription'
  ];

  "incorporation" := NULLIF(SUBSTRING(COALESCE("input"->>'dateOfIncorporation', '') FROM 1 FOR 7), '');
  IF "incorporation" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    "output" := jsonb_set("output", '{incorporationYearMonth}', to_jsonb("incorporation"), true);
  END IF;

  "industry_detail" := COALESCE(
    "input"->'industryOtherDescription',
    "input"->'industryBusinessNatureDetails'
  );
  IF "output"->>'hsicSectionCode' = 'OTHER' AND "industry_detail" IS NOT NULL THEN
    "output" := jsonb_set("output", '{industryOtherDescription}', "industry_detail", true);
  ELSE
    "output" := "output" - 'industryBusinessNatureDetails' - 'industryOtherDescription';
  END IF;

  RETURN "output";
END;
$$;

UPDATE "cmp_acceptance_requests"
SET
  "client_payload" = "cmp_simplify_client_payload"("client_payload"),
  "change_baseline_payload" = "cmp_simplify_client_payload"("change_baseline_payload")
WHERE "client_payload" IS NOT NULL OR "change_baseline_payload" IS NOT NULL;

CREATE OR REPLACE FUNCTION "cmp_simplify_client_change_summary"("input" JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  "group_item" JSONB;
  "clean_changes" JSONB;
  "clean_groups" JSONB := '[]'::JSONB;
  "total" INTEGER := 0;
BEGIN
  IF "input" IS NULL OR jsonb_typeof("input") <> 'object' THEN
    RETURN "input";
  END IF;

  FOR "group_item" IN SELECT value FROM jsonb_array_elements(COALESCE("input"->'groups', '[]'::JSONB))
  LOOP
    SELECT COALESCE(jsonb_agg(
      CASE WHEN "change_row".value->>'field' = 'dateOfIncorporation' THEN
        jsonb_set(
          jsonb_set(
            jsonb_set("change_row".value, '{field}', '"incorporationYearMonth"'::JSONB, true),
            '{before}', to_jsonb(NULLIF(SUBSTRING(COALESCE("change_row".value->>'before', '') FROM 1 FOR 7), '')), true
          ),
          '{after}', to_jsonb(NULLIF(SUBSTRING(COALESCE("change_row".value->>'after', '') FROM 1 FOR 7), '')), true
        )
      ELSE "change_row".value END
    ), '[]'::JSONB)
    INTO "clean_changes"
    FROM jsonb_array_elements(COALESCE("group_item"->'changes', '[]'::JSONB)) AS "change_row"(value)
    WHERE "change_row".value->>'field' NOT IN (
      'countryOrDistrict',
      'companyTypeOrSpecialIndustry',
      'specialIndustryDetails',
      'internalSource',
      'externalSource',
      'sourceDescription',
      'industryBusinessNatureDetails',
      'industryOrBusinessNature'
    );
    "total" := "total" + jsonb_array_length("clean_changes");
    "clean_groups" := "clean_groups" || jsonb_build_array(
      jsonb_set("group_item", '{changes}', "clean_changes", true)
    );
  END LOOP;

  RETURN jsonb_set(
    jsonb_set("input", '{groups}', "clean_groups", true),
    '{changedFieldCount}', to_jsonb("total"), true
  );
END;
$$;

UPDATE "cmp_client_versions"
SET
  "snapshot_json" = "cmp_simplify_client_payload"("snapshot_json"),
  "change_summary_json" = "cmp_simplify_client_change_summary"("change_summary_json"),
  "schema_version" = 2;

DROP FUNCTION "cmp_simplify_client_payload"(JSONB);
DROP FUNCTION "cmp_simplify_client_change_summary"(JSONB);

ALTER TABLE "cmp_clients"
  DROP COLUMN "date_of_incorporation",
  DROP COLUMN "country_or_district",
  DROP COLUMN "company_type_or_special_industry",
  DROP COLUMN "special_industry_details",
  DROP COLUMN "industry_or_business_nature",
  DROP COLUMN "internal_source",
  DROP COLUMN "external_source",
  DROP COLUMN "source_description";
