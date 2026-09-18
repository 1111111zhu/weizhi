WITH missing_users AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS slot
  FROM users
  WHERE NULLIF(BTRIM(staff_no), '') IS NULL
),
available_numbers AS (
  SELECT
    candidates.candidate,
    ROW_NUMBER() OVER (ORDER BY candidates.candidate) - 1 AS slot
  FROM generate_series(
    0,
    (SELECT COUNT(*) FROM users) + (SELECT COUNT(*) FROM missing_users) + 100
  ) AS candidates(candidate)
  WHERE NOT EXISTS (
    SELECT 1
    FROM users AS existing
    WHERE existing.staff_no = LPAD(candidates.candidate::text, 3, '0')
  )
),
assignments AS (
  SELECT
    missing_users.id,
    LPAD(available_numbers.candidate::text, 3, '0') AS staff_no
  FROM missing_users
  JOIN available_numbers USING (slot)
)
UPDATE users AS user_row
SET staff_no = assignments.staff_no
FROM assignments
WHERE user_row.id = assignments.id;

UPDATE users
SET hourly_rate = CASE global_role
  WHEN 'PARTNER' THEN 4500
  WHEN 'MANAGER' THEN 1800
  WHEN 'SENIOR' THEN 900
  WHEN 'STAFF' THEN 600
  WHEN 'TAX_EXPERT' THEN 1800
  ELSE hourly_rate
END
WHERE global_role IN ('PARTNER', 'MANAGER', 'SENIOR', 'STAFF', 'TAX_EXPERT');
