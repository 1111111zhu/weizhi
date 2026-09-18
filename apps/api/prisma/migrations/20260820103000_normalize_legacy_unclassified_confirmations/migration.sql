-- The confirmation center no longer exposes an "unclassified" category.
-- Keep the historical records, but place them in OTHER and give them the
-- OTHER code/sequence so the stored data agrees with the current workflow.
WITH legacy AS (
  SELECT
    c.id,
    c.project_id,
    COALESCE(
      (
        SELECT MAX(existing.type_sequence)
        FROM project_confirmations AS existing
        WHERE existing.project_id = c.project_id
          AND existing.type = 'OTHER'
      ),
      0
    ) + ROW_NUMBER() OVER (
      PARTITION BY c.project_id
      ORDER BY c.type_sequence NULLS LAST, c.created_at, c.id
    ) AS new_sequence
  FROM project_confirmations AS c
  WHERE c.type = 'UNCLASSIFIED'
)
UPDATE project_confirmations AS c
SET
  type = 'OTHER',
  type_sequence = legacy.new_sequence,
  confirmation_code = CASE
    WHEN c.confirmation_code IS NULL THEN NULL
    ELSE regexp_replace(
      c.confirmation_code,
      '-WGL-[0-9]+$',
      '-QT-' || lpad(legacy.new_sequence::text, 3, '0')
    )
  END
FROM legacy
WHERE c.id = legacy.id;

INSERT INTO project_confirmation_sequences (
  project_id,
  type,
  next_value,
  updated_at
)
SELECT
  project_id,
  'OTHER',
  COALESCE(MAX(type_sequence), 0) + 1,
  NOW()
FROM project_confirmations
WHERE type = 'OTHER'
GROUP BY project_id
ON CONFLICT (project_id, type) DO UPDATE
SET
  next_value = GREATEST(
    project_confirmation_sequences.next_value,
    EXCLUDED.next_value
  ),
  updated_at = NOW();

DELETE FROM project_confirmation_sequences
WHERE type = 'UNCLASSIFIED';

UPDATE confirmation_template_library_files
SET confirmation_type = 'OTHER'
WHERE confirmation_type = 'UNCLASSIFIED';

UPDATE confirmation_response_library_files
SET provisional_type = 'OTHER'
WHERE provisional_type = 'UNCLASSIFIED';
