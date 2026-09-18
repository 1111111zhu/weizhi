CREATE TABLE "confirmation_general_fields" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Preserve every legacy binding ID and project value. If an ID has several
-- names, its most recently saved project supplies the canonical name.
INSERT INTO "confirmation_general_fields" ("id", "name", "position")
SELECT id, name, (row_number() OVER (ORDER BY saved_at, id) - 1)::integer
FROM (
  SELECT DISTINCT ON (field->>'id') field->>'id' AS id,
    btrim(field->>'name') AS name, defaults.updated_at AS saved_at
  FROM project_confirmation_defaults defaults
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(defaults.base_information->'customFields') = 'array'
      THEN defaults.base_information->'customFields' ELSE '[]'::jsonb END
  ) field
  WHERE field->>'id' ~ '^[a-zA-Z0-9-]{1,80}$'
    AND length(btrim(field->>'name')) BETWEEN 1 AND 100
  ORDER BY field->>'id', defaults.updated_at DESC, defaults.id
) legacy;
