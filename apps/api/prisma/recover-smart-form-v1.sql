-- The failed migration is transactional. Its cleanup and seed statements were
-- rolled back by PostgreSQL, so no additional data repair is required before
-- marking it rolled back and retrying the corrected migration.
SELECT 1;
