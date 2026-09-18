-- The first additive graph slice keeps Client linkage as a scalar field so the
-- legacy CmpClient model does not need to be rewritten in the same migration.
-- Remove the database-only foreign key to keep the multi-file Prisma schema and
-- the migrated database aligned. Entity linkage remains fully constrained.
-- A later Client-master migration can restore a Prisma-managed Client relation.
ALTER TABLE "cmp_client_entity_scopes"
DROP CONSTRAINT IF EXISTS "cmp_client_entity_scopes_client_id_fkey";
