UPDATE users
SET staff_no = NULL
WHERE staff_no IS NOT NULL;

WITH numbered_users AS (
  SELECT
    id,
    LPAD((ROW_NUMBER() OVER (ORDER BY created_at, id) - 1)::text, 3, '0') AS staff_no
  FROM users
)
UPDATE users AS user_row
SET staff_no = numbered_users.staff_no
FROM numbered_users
WHERE user_row.id = numbered_users.id;
